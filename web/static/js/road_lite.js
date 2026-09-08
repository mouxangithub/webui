/** Road lite view — data-only synthesized driving scene shown when the video
 * stream is off/failing (preview off, connecting, or WebRTC error).
 * Replaces the frozen/black video with a dark perspective road, lane markings,
 * ego car and lead indicators. All data comes from the existing WS state
 * channel. Road curvature, lane count, the Tesla-style rainbow planning path
 * and adjacent vehicles follow the real modelV2 geometry sampled server-side
 * (state.road_model); without model data a straight three-lane fallback road
 * is drawn. */

import { opuiWs } from "./ws.js";

const ROAD_LITE_MS = 400;

let host = null;
let canvas = null;
let ctx = null;
let active = false;
let forced = false;
let rafId = null;
let lastFrameTs = 0;
let distM = 0;
let lastState = null;
let watchTimer = null;
let lastWrapClass = "";
let frameSkip = 0;

/* Fake-live detection: a playing <video> whose frames never change is frozen
   (decoder stall). N identical probes in a row → treat the stream as dead so
   the synthesized scene takes over. */
const FROZEN_PROBES = 3;
let frozenStreak = 0;
let lastFrozenHash = null;
let frozenProbeTs = 0;
let probeCanvas = null;

function isOnroadScreen() {
  const app = document.getElementById("app");
  return !!app && app.dataset.screen === "onroad";
}

function videoActive() {
  const wrap = document.getElementById("camera-wrap");
  if (!wrap) return true;
  if (forced) return false;
  if (lastState?.lite_mode) return false;   // Params OnroadLiteMode
  if (frozenStreak >= FROZEN_PROBES) return false;  // fake-live (frozen) video
  if (wrap.classList.contains("preview-off")) return false;
  if (wrap.classList.contains("is-dev-pc")) return true;
  return wrap.classList.contains("is-playing");
}

function shouldShow() {
  return isOnroadScreen() && !videoActive();
}

export function isRoadLiteActive() {
  return active;
}

function buildDom() {
  host = document.createElement("div");
  host.id = "road-lite";
  host.className = "opui-road-lite";
  host.hidden = true;

  canvas = document.createElement("canvas");
  canvas.className = "opui-road-lite__canvas";
  host.appendChild(canvas);

  const wrap = document.getElementById("camera-wrap");
  if (wrap) wrap.appendChild(host);

  ctx = canvas.getContext("2d");
}

function resizeCanvas() {
  if (!canvas || !host) return;
  const w = host.clientWidth || 1600;
  const h = host.clientHeight || 900;
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.max(1, Math.floor(w * dpr));
  const ph = Math.max(1, Math.floor(h * dpr));
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

/* ---------- scene rendering ---------- */

const HORIZON = 0.42;        // horizon line, fraction of height
const Z_NEAR = 2.5;          // m in front of bumper at canvas bottom
const Z_FAR = 160;           // culling distance, m
const Z0 = 4.5;              // perspective strength (pinhole-ish)
const HALF_ROAD_M = 5.55;    // fallback half road width, m (three ~3.7m lanes)
const DASH_LEN = 3.0;        // m
const DASH_GAP = 6.0;        // m
const POLE_SPACING = 33.0;   // m
const POLE_RANGE = 200.0;    // m
const LINE_PROB_MIN = 0.35;  // model lane line confidence to draw it
// longitudinal sample steps for curved geometry (m)
const Z_STEPS = [2.5, 4, 6.5, 10, 15, 22, 32, 46, 64, 88, 118, 145, 160];

/* ---------- road geometry (model frame: lateral y, +right) ---------- */

function roadGeom() {
  const rm = lastState?.road_model;
  if (!rm || !Array.isArray(rm.dists) || rm.dists.length < 3) return null;
  const dists = rm.dists;
  const valid = (a) => Array.isArray(a) && a.length === dists.length && a.every((v) => Number.isFinite(v));
  const lines = [0, 1, 2, 3].map((i) => (valid(rm.lines?.[i]) ? rm.lines[i] : null));
  const probs = Array.isArray(rm.probs) ? rm.probs : [];
  const visible = lines
    .map((arr, i) => ({
      arr, i, prob: Number(probs[i] ?? 0), y: arr ? arr[arr.length - 1] : 0,
      solid: Number(rm.line_types?.[i] ?? 0) === 1,
    }))
    .filter((l) => l.arr && l.prob >= LINE_PROB_MIN);
  const edges = [valid(rm.edges?.[0]) ? rm.edges[0] : null, valid(rm.edges?.[1]) ? rm.edges[1] : null];
  return {
    dists, lines, probs, visible, edges,
    lineTypes: Array.isArray(rm.line_types) ? rm.line_types : [0, 0, 0, 0],
    leads: Array.isArray(rm.leads) ? rm.leads : [],
    path: valid(rm.path) ? rm.path : null,
    pathStd: valid(rm.path_std) ? rm.path_std : null,
  };
}

function sampleCurve(arr, dists, z) {
  // Catmull-Rom interpolation over the distance samples
  const n = arr.length;
  if (z <= dists[0]) return arr[0];
  if (z >= dists[n - 1]) return arr[n - 1];
  let i = 0;
  while (i < n - 2 && dists[i + 1] < z) i++;
  const t = (z - dists[i]) / (dists[i + 1] - dists[i]);
  const p0 = arr[Math.max(0, i - 1)];
  const p1 = arr[i];
  const p2 = arr[i + 1];
  const p3 = arr[Math.min(n - 1, i + 2)];
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function drawScene() {
  const size = resizeCanvas();
  if (!size) return;
  const { w, h } = size;
  const horizonY = h * HORIZON;
  const cx = w / 2;
  const mToPx = (w * 0.62) / HALF_ROAD_M;       // px per meter at z = Z_NEAR
  const fn = (z) => (Z0 + Z_NEAR) / (Z0 + Math.max(z, 0.4)); // 1 at bumper → 0 far
  const yOf = (z) => horizonY + (h - horizonY) * fn(z);

  // screen x for a point at distance z with model-frame lateral offset yM
  const xOf = (z, yM) => cx + yM * mToPx * fn(z);

  const geom = roadGeom();

  // edge curves: prefer roadEdges, else outermost visible lane lines
  let edgeL = null;
  let edgeR = null;
  let edgesFromLines = false;
  if (geom && geom.edges[0] && geom.edges[1]) {
    edgeL = geom.edges[0];
    edgeR = geom.edges[1];
  } else if (geom && geom.visible.length >= 2) {
    const vis = [...geom.visible].sort((a, b) => a.y - b.y);
    edgeL = vis[0].arr;
    edgeR = vis[vis.length - 1].arr;
    edgesFromLines = true;
  }

  const edgeLatAt = (side, z) => {
    const arr = side < 0 ? edgeL : edgeR;
    if (arr) return sampleCurve(arr, geom.dists, z);
    return side < 0 ? -HALF_ROAD_M : HALF_ROAD_M;
  };
  const lineLatAt = (line, z) => {
    if (!line) return null;
    if (line.y0 !== undefined) return line.y0; // straight fallback divider
    return sampleCurve(line.arr, geom.dists, z);
  };

  // divider lines = visible lines that are not the outermost ones
  let dividers = [];
  if (geom) {
    const vis = [...geom.visible].sort((a, b) => a.y - b.y);
    if (edgesFromLines && vis.length >= 2) dividers = vis.slice(1, -1);
    else dividers = vis;
  } else {
    dividers = [{ y0: -1.85 }, { y0: 1.85 }];
  }

  ctx.clearRect(0, 0, w, h);

  // --- sky gradient ---
  let g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, "#05080f");
  g.addColorStop(0.65, "#0a1120");
  g.addColorStop(1, "#0e1730");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizonY);

  // --- ground gradient ---
  g = ctx.createLinearGradient(0, horizonY, 0, h);
  g.addColorStop(0, "#0c1424");
  g.addColorStop(1, "#05080f");
  ctx.fillStyle = g;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // --- horizon glow (city ambience) ---
  const rg = ctx.createRadialGradient(cx, horizonY, 0, cx, horizonY, w * 0.42);
  rg.addColorStop(0, "rgba(96, 140, 220, 0.20)");
  rg.addColorStop(0.5, "rgba(96, 140, 220, 0.07)");
  rg.addColorStop(1, "rgba(96, 140, 220, 0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);

  // --- road surface: polygon following the (possibly curved) edges ---
  const steps = Z_STEPS.filter((z) => z >= Z_NEAR && z <= Z_FAR);
  ctx.beginPath();
  for (let i = steps.length - 1; i >= 0; i--) {
    const z = steps[i];
    ctx.lineTo(xOf(z, edgeLatAt(-1, z)), yOf(z));
  }
  for (const z of steps) {
    ctx.lineTo(xOf(z, edgeLatAt(1, z)), yOf(z));
  }
  ctx.closePath();
  g = ctx.createLinearGradient(0, yOf(Z_FAR), 0, h);
  g.addColorStop(0, "#141c30");
  g.addColorStop(1, "#232f4c");
  ctx.fillStyle = g;
  ctx.fill();

  // --- subtle sheen along the ego lane (between the dividers when known) ---
  ctx.beginPath();
  for (let i = steps.length - 1; i >= 0; i--) {
    const z = steps[i];
    const lat = sheenLatAt(z);
    ctx.lineTo(xOf(z, lat - 0.9), yOf(z));
  }
  for (const z of steps) {
    const lat = sheenLatAt(z);
    ctx.lineTo(xOf(z, lat + 0.9), yOf(z));
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(140, 170, 230, 0.045)";
  ctx.fill();

  function sheenLatAt(z) {
    if (geom && geom.visible.length >= 2) {
      const vis = [...geom.visible].sort((a, b) => a.y - b.y);
      const inner = (edgesFromLines && vis.length >= 2) ? vis.slice(1, -1) : vis;
      if (inner.length >= 2) {
        return (lineLatAt(inner[0], z) + lineLatAt(inner[inner.length - 1], z)) / 2;
      }
      if (inner.length === 1) return lineLatAt(inner[0], z);
    }
    return 0;
  }

  drawLightPools(w, h, cx, mToPx, fn, yOf, xOf, edgeLatAt);
  drawEdgeLines(w, h, cx, fn, yOf, xOf, edgeLatAt, steps);
  drawLaneLines(w, cx, mToPx, fn, yOf, xOf, dividers, lineLatAt);
  drawPlanPath(w, cx, mToPx, fn, yOf, xOf, geom, steps);
  drawLdw(w, h, fn, yOf, xOf, geom, lineLatAt);
  drawAlcArch(w, h, cx, mToPx, fn, yOf, xOf, geom, lineLatAt);
  drawTrafficLight(w, h, cx, mToPx, fn, yOf, xOf, edgeLatAt);
  drawPoles(w, h, cx, mToPx, fn, yOf, xOf, edgeLatAt);
  drawLeadVehicle(w, cx, mToPx, fn, yOf);
  drawEgoCar(w, h, cx);
  drawBsm(w, h);
  drawTbtBanner(w, h);
  drawCurveSpeedBadge(w, h);
  drawFcw(w, h);
  drawVignette(w, h, cx);
}

function drawLightPools(w, h, cx, mToPx, fn, yOf, xOf, edgeLatAt) {
  // cool light pools cast by the streetlights onto the road
  ctx.lineCap = "round";
  // scroll toward the viewer (same phase convention as the poles below)
  let z = 6 + (POLE_SPACING - (distM % POLE_SPACING)) % POLE_SPACING;
  for (; z < POLE_RANGE; z += POLE_SPACING) {
    if (z > Z_FAR) break;
    const f = fn(z);
    if (f < 0.09) continue;
    const y = yOf(z);
    for (const side of [-1, 1]) {
      const px = xOf(z, edgeLatAt(side, z) + side * -1.2);
      const poolR = mToPx * 2.6 * f;
      ctx.save();
      ctx.translate(px, y);
      ctx.scale(1, 0.32);
      const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, poolR);
      pg.addColorStop(0, "rgba(175, 200, 255, 0.10)");
      pg.addColorStop(1, "rgba(175, 200, 255, 0)");
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(0, 0, poolR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawEdgeLines(w, h, cx, fn, yOf, xOf, edgeLatAt, steps) {
  ctx.lineCap = "round";
  for (const pass of [
    { scale: 3.4, color: "rgba(150, 190, 255, 0.16)" },  // glow
    { scale: 1.0, color: "rgba(228, 236, 250, 0.9)" },   // core
  ]) {
    ctx.strokeStyle = pass.color;
    ctx.lineWidth = Math.max(1.5, w * 0.0035 * pass.scale / 1.6);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i < steps.length; i++) {
        const z = steps[i];
        const x = xOf(z, edgeLatAt(side, z));
        if (i === 0) ctx.moveTo(x, yOf(z));
        else ctx.lineTo(x, yOf(z));
      }
      ctx.stroke();
    }
  }
}

/* Lane dividers: dashed for line_types=0, continuous solid for line_types=1
   (shoulder lines standing in for missing road edges). */
function drawLaneLines(w, cx, mToPx, fn, yOf, xOf, dividers, lineLatAt) {
  const dashPeriod = DASH_LEN + DASH_GAP;
  const phase = distM % dashPeriod;
  for (const pass of [
    { scale: 3.2, color: "rgba(140, 180, 255, 0.14)" },  // glow
    { scale: 1.0, color: "rgba(215, 224, 240, 0.85)" },  // core
  ]) {
    ctx.strokeStyle = pass.color;
    ctx.lineCap = "round";
    for (const line of dividers) {
      const solid = line && line.solid;
      if (solid) {
        ctx.lineWidth = Math.max(1.5, w * 0.0042 * pass.scale / 1.6);
        ctx.beginPath();
        let first = true;
        for (const z of Z_STEPS) {
          if (z < Z_NEAR || z > Z_FAR) continue;
          const x = xOf(z, lineLatAt(line, z));
          if (first) { ctx.moveTo(x, yOf(z)); first = false; }
          else ctx.lineTo(x, yOf(z));
        }
        ctx.stroke();
        continue;
      }
      let z = Z_NEAR + (dashPeriod - phase) % dashPeriod;
      while (z < Z_FAR) {
        const z2 = z + DASH_LEN;
        if (z2 >= Z_FAR) break;
        ctx.lineWidth = Math.max(1.5, w * 0.0042 * fn(z) * pass.scale / 1.6);
        ctx.beginPath();
        ctx.moveTo(xOf(z, lineLatAt(line, z)), yOf(z));
        ctx.lineTo(xOf(z2, lineLatAt(line, z2)), yOf(z2));
        ctx.stroke();
        z = z2 + DASH_GAP;
      }
    }
  }
}

/* LDW: glowing orange line along the lane boundary the ego is drifting toward. */
function drawLdw(w, h, fn, yOf, xOf, geom, lineLatAt) {
  const st = lastState;
  if (!st?.started) return;
  if ((Number(st.speed_raw) || 0) < 3) return;  // not meaningful at a standstill
  const dev = laneDeviation(geom, lineLatAt);
  if (!dev) return;
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 260);
  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(255, 130, 30, 0.95)";
  ctx.shadowBlur = Math.max(8, w * 0.014);
  for (const pass of [
    { scale: 2.6, alpha: 0.5 * pulse * dev.ratio },
    { scale: 1.0, alpha: 0.95 * pulse * dev.ratio },
  ]) {
    ctx.strokeStyle = `rgba(255, 140, 40, ${Math.min(1, pass.alpha)})`;
    ctx.lineWidth = Math.max(2, w * 0.005 * pass.scale);
    ctx.beginPath();
    let first = true;
    for (const z of [4, 6, 9, 13, 18, 25, 33, 42]) {
      const x = xOf(z, lineLatAt(dev.line, z));
      if (first) { ctx.moveTo(x, yOf(z)); first = false; }
      else ctx.lineTo(x, yOf(z));
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* Lane departure warning: deviation of the ego (lateral 0) from the innermost
   visible lane lines bracketing it, evaluated ~8 m ahead. */
function laneDeviation(geom, lineLatAt) {
  if (!geom || geom.visible.length < 2) return null;
  const z = 8;
  const vis = [...geom.visible].sort((a, b) => a.y - b.y);
  const inner = (geom.edges[0] && geom.edges[1]) ? vis.filter((l) => l.arr !== geom.edges[0] && l.arr !== geom.edges[1]) : vis;
  const pool = inner.length >= 2 ? inner : vis;
  let li = null;
  let ri = null;
  for (const l of pool) {
    const y = lineLatAt(l, z);
    if (y < 0 && (li === null || y > lineLatAt(li, z))) li = l;
    if (y > 0 && (ri === null || y < lineLatAt(ri, z))) ri = l;
  }
  if (!li || !ri) return null;
  const yl = lineLatAt(li, z);
  const yr = lineLatAt(ri, z);
  const center = (yl + yr) / 2;
  const half = (yr - yl) / 2;
  if (half < 0.8) return null;
  const dev = (0 - center) / half;          // -1 .. 1, + = drifting right
  const ratio = Math.max(0, Math.min(1, (Math.abs(dev) - 0.55) / 0.35));
  if (ratio <= 0) return null;
  return { side: dev > 0 ? 1 : -1, ratio, line: dev > 0 ? ri : li };
}

/* Auto lane change: golden arch over the target lane while the blinker is on
   and openpilot is engaged. */
function drawAlcArch(w, h, cx, mToPx, fn, yOf, xOf, geom, lineLatAt) {
  const st = lastState;
  if (!st?.engaged) return;
  const sp = st.sp_hud || {};
  const side = sp.turn_signal_left ? -1 : sp.turn_signal_right ? 1 : 0;
  if (!side) return;
  // target lane center: the line on the blinker side of the ego lane
  let lat = side * 1.85;
  if (geom && geom.visible.length >= 2) {
    const z = 12;
    const vis = [...geom.visible].sort((a, b) => a.y - b.y);
    let li = null;   // innermost line y on each side (numbers)
    let ri = null;
    for (const l of vis) {
      const y = lineLatAt(l, z);
      if (y < 0 && (li === null || y > li)) li = y;
      if (y > 0 && (ri === null || y < ri)) ri = y;
    }
    if (li !== null && ri !== null) lat = side < 0 ? (li - 1.85) : (ri + 1.85);
  }
  const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 300);
  const zNear = 8;
  const zFar = 34;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(255, 196, 60, ${0.9 * pulse})`;
  ctx.shadowColor = "rgba(255, 180, 40, 0.9)";
  ctx.shadowBlur = Math.max(8, w * 0.014);
  ctx.lineWidth = Math.max(2.5, w * 0.005);
  ctx.beginPath();
  for (const half of [-1, 1]) {
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const z = zNear + (zFar - zNear) * t;
      // arch: lateral half-width grows with distance then caps at lane width
      const latOff = lat + half * Math.min(0.35 + t * 1.9, 1.85);
      const x = xOf(z, latOff);
      const y = yOf(z) - (h - yOf(z)) * 0.10 * Math.sin(Math.PI * t);
      if (i === 0 && half === -1) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/* Planned trajectory ribbon (Tesla-style rainbow). Data: state.road_model.path
   — modelV2.path sampled server-side at the same distances as the lane lines
   (model frame, +right). Ribbon half-width follows path.std (lateral
   uncertainty); hue sweeps pink-red near the ego car → yellow-green mid-range
   → cyan far, matching the model canvas rainbow gradient. */
function drawPlanPath(w, cx, mToPx, fn, yOf, xOf, geom, steps) {
  const path = geom?.path;
  if (!path || path.length < 3) return;
  const std = geom.pathStd;
  const z0 = steps[0];
  const z1 = steps[steps.length - 1];
  const dists = geom.dists;

  const halfAt = (z) => {
    let s = 0.15;
    if (std) s = sampleCurve(std, dists, z);
    return Math.max(0.32, Math.min(0.85, 0.34 + s * 0.8));
  };
  const hueAt = (z) => {
    // full pink→cyan sweep within the visually meaningful range (~85 m)
    const t = Math.max(0, Math.min(1, (z - z0) / 85));
    return (335 + t * 205) % 360;
  };
  const alphaAt = (z) => {
    const t = Math.max(0, Math.min(1, (z - z0) / (z1 - z0)));
    return 0.14 + 0.42 * Math.pow(1 - t, 0.55);
  };

  // soft glow along the centerline
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < steps.length; i++) {
    const z = steps[i];
    const x = xOf(z, sampleCurve(path, dists, z));
    if (i === 0) ctx.moveTo(x, yOf(z));
    else ctx.lineTo(x, yOf(z));
  }
  ctx.strokeStyle = "rgba(255, 90, 165, 0.22)";
  ctx.shadowColor = "rgba(255, 60, 140, 0.6)";
  ctx.shadowBlur = Math.max(6, w * 0.012);
  ctx.lineWidth = Math.max(2, w * 0.007);
  ctx.stroke();
  ctx.restore();

  // ribbon segments, one quad per step pair, colored by distance
  ctx.lineJoin = "round";
  for (let i = 0; i < steps.length - 1; i++) {
    const za = steps[i];
    const zb = steps[i + 1];
    const zm = (za + zb) * 0.5;
    const hue = hueAt(zm);
    const alpha = alphaAt(zm);
    ctx.beginPath();
    ctx.moveTo(xOf(za, sampleCurve(path, dists, za) - halfAt(za)), yOf(za));
    ctx.lineTo(xOf(zb, sampleCurve(path, dists, zb) - halfAt(zb)), yOf(zb));
    ctx.lineTo(xOf(zb, sampleCurve(path, dists, zb) + halfAt(zb)), yOf(zb));
    ctx.lineTo(xOf(za, sampleCurve(path, dists, za) + halfAt(za)), yOf(za));
    ctx.closePath();
    ctx.fillStyle = `hsla(${hue.toFixed(0)}, 90%, 62%, ${alpha.toFixed(3)})`;
    ctx.fill();
  }
}

function drawPoles(w, h, cx, mToPx, fn, yOf, xOf, edgeLatAt) {
  const horizonBase = h * HORIZON;
  ctx.lineCap = "round";
  // scroll toward the viewer: apparent distance shrinks as the car advances
  let z = 6 + (POLE_SPACING - (distM % POLE_SPACING)) % POLE_SPACING;
  for (; z < POLE_RANGE; z += POLE_SPACING) {
    if (z > Z_FAR) break;
    const f = fn(z);
    if (f < 0.02) continue;
    const y = yOf(z);
    const poleH = Math.min((h - horizonBase) * 1.05 * f, y - h * 0.06);
    const alpha = Math.max(0, Math.min(0.6, f * 2.4));
    for (const side of [-1, 1]) {
      const px = xOf(z, edgeLatAt(side, z) + side * -1.3);
      const topY = y - poleH;
      // pole
      ctx.strokeStyle = `rgba(125, 138, 162, ${alpha})`;
      ctx.lineWidth = Math.max(1.5, w * 0.0028 * f);
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, topY);
      ctx.stroke();
      // arm reaching over the road
      const armDx = -side * mToPx * 1.6 * f;
      ctx.beginPath();
      ctx.moveTo(px, topY);
      ctx.quadraticCurveTo(px + armDx * 0.4, topY - poleH * 0.06, px + armDx, topY - poleH * 0.02);
      ctx.stroke();
      // lamp glow
      const lampX = px + armDx;
      const lampY = topY - poleH * 0.02;
      const lampR = Math.max(4, w * 0.012 * f);
      const lg = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, lampR * 2.4);
      lg.addColorStop(0, `rgba(210, 225, 255, ${alpha * 1.4})`);
      lg.addColorStop(0.35, `rgba(190, 210, 255, ${alpha * 0.5})`);
      lg.addColorStop(1, "rgba(190, 210, 255, 0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lampX, lampY, lampR * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLeadVehicle(w, cx, mToPx, fn, yOf) {
  const st = lastState;
  const bsm = bsmSides();

  // radar leadTwo (+yRel = left): smaller and dimmer — off the ego path.
  let d2 = null;
  let y2 = null;
  if (st?.lead2_d_rel != null && st.lead2_d_rel > 0 && st.lead2_d_rel <= 140) {
    d2 = st.lead2_d_rel;
    const yy = Number(st?.lead2_y_rel);
    y2 = Number.isFinite(yy) ? yy : 0;
    const offM = Math.max(-4.6, Math.min(4.6, y2));
    const bsmOn = (offM >= 0 && bsm.left) || (offM < 0 && bsm.right);
    drawLeadCar(w, cx, mToPx, fn, yOf, d2, offM, 0.55, 0.9, bsmOn);
  }

  // model leads (leadsV3, up to 3 tracks; y is model-frame +right → flip to
  // left-positive to match radar yRel). Dedupe against the radar targets.
  const rm = st?.road_model;
  if (Array.isArray(rm?.leads)) {
    for (const ml of rm.leads) {
      const d = Number(ml?.d);
      const y = Number(ml?.y);
      if (!Number.isFinite(d) || !Number.isFinite(y)) continue;
      const offM = Math.max(-4.6, Math.min(4.6, -y)); // +left like radar yRel
      if (Math.abs(offM) < 1.9) {
        // ego-lane candidate — skip if the radar already shows this lead
        const dl = Number(st?.lead_d_rel);
        if (dl != null && Math.abs(d - dl) < 8) continue;
        if (d2 != null && y2 != null && Math.abs(y2) < 1.9 && Math.abs(d - d2) < 8) continue;
      } else if (d2 != null && y2 != null) {
        // same side as radar leadTwo and close → same vehicle
        if (Math.abs(d - d2) < 8 && Math.abs(offM - y2) < 2.5) continue;
      }
      const bsmOn = (offM >= 0 && bsm.left) || (offM < 0 && bsm.right);
      drawLeadCar(w, cx, mToPx, fn, yOf, d, offM, 0.5, 0.9, bsmOn);
    }
  }

  // lead in the ego lane (radar, most reliable); brake lights follow aLeadK
  const leadBrake = Number(st?.lead_a_lead_k) < -0.5;
  const risk = collisionRisk();
  drawLeadCar(w, cx, mToPx, fn, yOf, st?.lead_d_rel, 0, 1.0, 1.0, false, { brake: leadBrake, risk });
}

/* Forward collision risk 0..1 — TTC from radar closing speed, forced to 1
   when openpilot raises an fcw/aeb alert. */
function collisionRisk() {
  const st = lastState;
  if (!st?.started) return 0;
  const alertStatus = String(st.alert?.status || "");
  const aeb = alertStatus === "aeb" || alertStatus === "fcw";
  const d = Number(st.lead_d_rel);
  const v = Number(st.lead_v_rel);
  let risk = 0;
  if (Number.isFinite(d) && Number.isFinite(v) && d > 0 && v < -0.3) {
    const ttc = d / (-v);
    if (ttc < 3) risk = Math.min(1, (3 - ttc) / 2.4);
  }
  return aeb ? 1 : risk;
}

function bsmSides() {
  const sp = lastState?.sp_hud || {};
  return { left: !!sp.blindspot_left, right: !!sp.blindspot_right };
}

/* BSM (blind spot) indicator: amber edge glow + chevrons on the active side.
   Data: state.sp_hud.blindspot_left / blindspot_right (stock BSM radar). */
function drawBsm(w, h) {
  const { left, right } = bsmSides();
  if (!left && !right) return;
  const pulse = 0.72 + 0.28 * Math.sin(performance.now() / 280);

  for (const [side, on] of [[-1, left], [1, right]]) {
    if (!on) continue;
    const x0 = side < 0 ? 0 : w * 0.90;
    const x1 = side < 0 ? w * 0.10 : w;

    // amber edge glow column
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, `rgba(255, 168, 44, ${0.30 * pulse})`);
    grad.addColorStop(1, "rgba(255, 168, 44, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x0, h * 0.40, x1 - x0, h * 0.54);

    // chevrons pointing toward the ego lane
    const ix = side < 0 ? w * 0.040 : w * 0.960;
    const iy = h * 0.66;
    ctx.save();
    ctx.translate(ix, iy);
    ctx.scale(side, 1);
    ctx.strokeStyle = `rgba(255, 182, 66, ${0.95 * pulse})`;
    ctx.shadowColor = "rgba(255, 160, 30, 0.9)";
    ctx.shadowBlur = Math.max(6, w * 0.014);
    ctx.lineWidth = Math.max(3, w * 0.0065);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < 2; i++) {
      const bx = i * w * 0.024;
      ctx.beginPath();
      ctx.moveTo(bx, -w * 0.017);
      ctx.lineTo(bx + w * 0.019, 0);
      ctx.lineTo(bx, w * 0.017);
      ctx.stroke();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }
}

function drawLeadCar(w, cx, mToPx, fn, yOf, d, offM, alphaMul, sizeMul, bsmOn, opts = {}) {
  if (d == null || d <= 0 || d > 160) return;
  const z = Math.max(d, 2) + Z_NEAR;
  const f = fn(z);
  if (f <= 0.01) return;
  const y = yOf(z);
  const carW = Math.max(9, Math.min(w * 0.3, 4.6 * mToPx * f * sizeMul));
  const carH = carW * 0.66;
  // yRel +left → shift left; clamp to road
  const xCenter = Math.max(cx - mToPx * 5.2 * f, Math.min(cx + mToPx * 5.2 * f, cx - offM * mToPx * f));

  ctx.save();
  const baseAlpha = Math.max(0.3, Math.min(1, (1.15 - d / 160) * alphaMul));
  ctx.globalAlpha = bsmOn ? Math.min(1, baseAlpha + 0.25) : baseAlpha;

  // soft ground shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(xCenter, y - carH * 0.02, carW * 0.56, carH * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  drawCarSprite(xCenter - carW / 2, y, carW, carH, { tone: "lead", bsm: bsmOn, brake: !!opts.brake, risk: opts.risk || 0 });
  ctx.restore();
}

function drawEgoCar(w, h, cx) {
  const carW = w * 0.15;
  const carH = carW * 0.62;
  const y = h * 0.955;                // bottom anchor (rear bumper)
  const x = cx - carW / 2;

  ctx.save();

  // underglow
  const ug = ctx.createRadialGradient(cx, y - carH * 0.4, 0, cx, y - carH * 0.4, carW * 0.85);
  ug.addColorStop(0, "rgba(90, 130, 210, 0.20)");
  ug.addColorStop(1, "rgba(90, 130, 210, 0)");
  ctx.fillStyle = ug;
  ctx.fillRect(cx - carW, y - carH * 1.7, carW * 2, carH * 2.3);

  const braking = lastState?.a_ego != null && Number(lastState.a_ego) < -0.6;
  drawCarSprite(x, y, carW, carH, { tone: "ego", brake: braking });

  // turn indicators: flashing amber lamps at the ego rear corners
  const sp = lastState?.sp_hud || {};
  const blinkOn = Math.floor(performance.now() / 400) % 2 === 0;
  if (blinkOn) {
    ctx.fillStyle = "rgba(255, 180, 40, 0.98)";
    ctx.shadowColor = "rgba(255, 170, 30, 0.95)";
    ctx.shadowBlur = Math.max(6, carW * 0.16);
    const lampR = Math.max(2.5, carW * 0.055);
    if (sp.turn_signal_left) {
      ctx.beginPath();
      ctx.arc(x + carW * 0.015, y - carH * 0.06, lampR, 0, Math.PI * 2);
      ctx.fill();
    }
    if (sp.turn_signal_right) {
      ctx.beginPath();
      ctx.arc(x + carW * 0.985, y - carH * 0.06, lampR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

/* Detailed top-view sedan sprite: body silhouette, wheels, greenhouse glass,
   roof, mirrors, tail lights, headlight hints, specular sheen. */

function carBodyPath(x, y, carW, carH) {
  // x: left edge, y: rear bumper baseline; nose points up (-y)
  ctx.beginPath();
  ctx.moveTo(x + carW * 0.10, y);
  // rear bumper
  ctx.bezierCurveTo(x + carW * 0.12, y + carH * 0.025, x + carW * 0.88, y + carH * 0.025, x + carW * 0.90, y);
  // right side, slight waist then front shoulder
  ctx.bezierCurveTo(x + carW * 1.015, y - carH * 0.12, x + carW * 0.995, y - carH * 0.55, x + carW * 0.895, y - carH * 0.80);
  ctx.bezierCurveTo(x + carW * 0.855, y - carH * 0.965, x + carW * 0.70, y - carH * 1.02, x + carW * 0.57, y - carH * 1.02);
  // hood
  ctx.bezierCurveTo(x + carW * 0.52, y - carH * 1.045, x + carW * 0.48, y - carH * 1.045, x + carW * 0.43, y - carH * 1.02);
  // left front shoulder and side
  ctx.bezierCurveTo(x + carW * 0.30, y - carH * 1.02, x + carW * 0.145, y - carH * 0.965, x + carW * 0.105, y - carH * 0.80);
  ctx.bezierCurveTo(x + carW * 0.005, y - carH * 0.55, x - carW * 0.015, y - carH * 0.12, x + carW * 0.10, y);
  ctx.closePath();
}

function drawCarSprite(x, y, carW, carH, opts = {}) {
  const ego = opts.tone === "ego";

  // wheels poking out slightly
  ctx.fillStyle = "#0a0e18";
  const ww = Math.max(2, carW * 0.055), wh = carH * 0.15;
  for (const [wx, wy] of [
    [x - ww * 0.45, y - carH * 0.86],
    [x + carW - ww * 0.55, y - carH * 0.86],
    [x - ww * 0.45, y - carH * 0.26],
    [x + carW - ww * 0.55, y - carH * 0.26],
  ]) {
    roundRect(wx, wy, ww, wh, ww * 0.4);
    ctx.fill();
  }

  // body
  const bg = ctx.createLinearGradient(x, y - carH, x + carW, y);
  if (ego) {
    bg.addColorStop(0, "#3d4e78");
    bg.addColorStop(0.5, "#253252");
    bg.addColorStop(1, "#141d32");
  } else {
    bg.addColorStop(0, "#52648f");
    bg.addColorStop(0.55, "#354266");
    bg.addColorStop(1, "#232d49");
  }
  carBodyPath(x, y, carW, carH);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = ego ? "rgba(175, 198, 238, 0.5)" : "rgba(160, 182, 218, 0.34)";
  ctx.lineWidth = Math.max(1, carW * 0.012);
  ctx.stroke();

  // BSM alert: amber outline + stronger glow
  if (opts.bsm) {
    ctx.strokeStyle = "rgba(255, 182, 66, 0.95)";
    ctx.shadowColor = "rgba(255, 160, 30, 0.85)";
    ctx.shadowBlur = Math.max(6, carW * 0.18);
    ctx.lineWidth = Math.max(1.5, carW * 0.022);
    carBodyPath(x, y, carW, carH);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // forward collision risk: pulsing red outline
  if (opts.risk > 0.35) {
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 160);
    ctx.strokeStyle = `rgba(255, 46, 30, ${Math.min(1, 0.55 + 0.45 * pulse)})`;
    ctx.shadowColor = "rgba(255, 30, 20, 0.95)";
    ctx.shadowBlur = Math.max(8, carW * 0.26);
    ctx.lineWidth = Math.max(2, carW * 0.03);
    carBodyPath(x, y, carW, carH);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // greenhouse glass
  const gg = ctx.createLinearGradient(0, y - carH * 0.95, 0, y - carH * 0.25);
  gg.addColorStop(0, "rgba(11, 16, 30, 0.96)");
  gg.addColorStop(1, "rgba(32, 44, 68, 0.92)");
  ctx.fillStyle = gg;
  roundRect(x + carW * 0.185, y - carH * 0.93, carW * 0.63, carH * 0.58, carW * 0.13);
  ctx.fill();

  // roof panel
  ctx.fillStyle = ego ? "rgba(78, 96, 140, 0.55)" : "rgba(104, 122, 160, 0.5)";
  roundRect(x + carW * 0.25, y - carH * 0.73, carW * 0.50, carH * 0.27, carW * 0.08);
  ctx.fill();

  // side mirrors
  ctx.fillStyle = ego ? "#2b3752" : "#3e4c70";
  roundRect(x - carW * 0.055, y - carH * 0.73, carW * 0.09, carH * 0.075, carW * 0.03);
  ctx.fill();
  roundRect(x + carW * 0.965, y - carH * 0.73, carW * 0.09, carH * 0.075, carW * 0.03);
  ctx.fill();

  // center specular sheen
  const sp = ctx.createLinearGradient(x + carW * 0.32, 0, x + carW * 0.68, 0);
  sp.addColorStop(0, "rgba(215, 230, 255, 0)");
  sp.addColorStop(0.5, ego ? "rgba(215, 230, 255, 0.12)" : "rgba(215, 230, 255, 0.10)");
  sp.addColorStop(1, "rgba(215, 230, 255, 0)");
  ctx.fillStyle = sp;
  roundRect(x + carW * 0.30, y - carH * 0.98, carW * 0.40, carH * 0.95, carW * 0.2);
  ctx.fill();

  // headlight hints at the nose
  ctx.fillStyle = "rgba(195, 214, 244, 0.22)";
  roundRect(x + carW * 0.17, y - carH * 0.985, carW * 0.155, carH * 0.05, carH * 0.02);
  ctx.fill();
  roundRect(x + carW * 0.675, y - carH * 0.985, carW * 0.155, carH * 0.05, carH * 0.02);
  ctx.fill();

  // tail lights: two wrap-around strips (glow; brighter when braking)
  const brake = !!opts.brake;
  ctx.shadowColor = "rgba(255, 66, 50, 0.9)";
  ctx.shadowBlur = brake ? carW * 0.26 : Math.max(5, carW * 0.11);
  ctx.fillStyle = brake ? "#ff4a38" : "rgba(255, 80, 62, 0.92)";
  roundRect(x + carW * 0.07, y - carH * 0.115, carW * 0.35, Math.max(2, carH * 0.07), carH * 0.035);
  ctx.fill();
  roundRect(x + carW * 0.58, y - carH * 0.115, carW * 0.35, Math.max(2, carH * 0.07), carH * 0.035);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/* Navigation TBT banner: turn arrow + road name + distance, from sp_hud.carrot_nav. */
const TURN_DIR = { 1: "left", 2: "right", 3: "left", 4: "right", 7: "uturn" };

function navInfo() {
  const nav = lastState?.sp_hud?.carrot_nav;
  if (!nav || !Number(nav.active)) return null;
  const turn = Number(nav.turn_info);
  const dist = Number(nav.dist_to_turn) || 0;
  if (!(turn > 0) || dist <= 0) return null;
  return {
    dir: TURN_DIR[turn] || "ahead",
    dist,
    name: nav.tbt_main_text || nav.road_name || "",
  };
}

function drawTbtBanner(w, h) {
  const nav = navInfo();
  if (!nav) return;
  const bw = Math.min(w * 0.62, 460);
  const bh = Math.max(52, w * 0.052);
  const bx = (w - bw) / 2;
  const by = h * 0.045;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "rgba(10, 16, 32, 0.88)";
  ctx.strokeStyle = "rgba(120, 160, 235, 0.35)";
  ctx.lineWidth = 1.5;
  roundRect(bx, by, bw, bh, bh * 0.3);
  ctx.fill();
  ctx.stroke();

  // arrow
  const ax = bx + bh * 0.62;
  const ay = by + bh * 0.5;
  ctx.strokeStyle = "#7fd0ff";
  ctx.fillStyle = "#7fd0ff";
  ctx.lineWidth = Math.max(3, bh * 0.09);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (nav.dir === "left" || nav.dir === "right") {
    const s = nav.dir === "left" ? -1 : 1;
    ctx.moveTo(ax - s * bh * 0.1, ay + bh * 0.26);
    ctx.lineTo(ax - s * bh * 0.1, ay - bh * 0.1);
    ctx.lineTo(ax + s * bh * 0.16, ay - bh * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax + s * bh * 0.3, ay - bh * 0.1);
    ctx.lineTo(ax + s * bh * 0.13, ay - bh * 0.26);
    ctx.lineTo(ax + s * bh * 0.13, ay + 0.06 * bh);
    ctx.closePath();
    ctx.fill();
  } else if (nav.dir === "uturn") {
    ctx.arc(ax, ay, bh * 0.18, Math.PI * 0.9, Math.PI * 1.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax + bh * 0.24, ay - bh * 0.2);
    ctx.lineTo(ax + bh * 0.3, ay - bh * 0.02);
    ctx.lineTo(ax + bh * 0.11, ay - bh * 0.06);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.moveTo(ax, ay + bh * 0.26);
    ctx.lineTo(ax, ay - bh * 0.16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax, ay - bh * 0.3);
    ctx.lineTo(ax - bh * 0.14, ay - bh * 0.1);
    ctx.lineTo(ax + bh * 0.14, ay - bh * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  // text: distance + road name
  ctx.fillStyle = "#eaf1ff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const distTxt = nav.dist >= 1000 ? `${(nav.dist / 1000).toFixed(1)} km` : `${Math.round(nav.dist)} m`;
  ctx.font = `600 ${Math.round(bh * 0.4)}px system-ui, sans-serif`;
  ctx.fillText(distTxt, bx + bh * 1.35, by + bh * 0.34);
  ctx.font = `400 ${Math.round(bh * 0.3)}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(210, 222, 245, 0.85)";
  const name = nav.name.length > 16 ? `${nav.name.slice(0, 15)}…` : nav.name;
  ctx.fillText(name, bx + bh * 1.35, by + bh * 0.72);
  ctx.restore();
}

/* Curve speed advisory badge (bottom-right of the HUD corner strip). */
function drawCurveSpeedBadge(w, h) {
  const nav = lastState?.sp_hud?.carrot_nav;
  const vTurn = Number(nav?.v_turn_speed) || 0;
  if (!nav || !Number(nav.active) || vTurn <= 0) return;
  const r = Math.max(24, w * 0.032);
  const cx = w * 0.855;
  const cy = h * 0.16;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(16, 24, 44, 0.92)";
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.strokeStyle = "#ffb020";
  ctx.stroke();
  ctx.fillStyle = "#ffd77a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(r * 0.72)}px system-ui, sans-serif`;
  ctx.fillText(String(Math.round(vTurn)), cx, cy - r * 0.05);
  ctx.font = `600 ${Math.round(r * 0.3)}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255, 215, 122, 0.9)";
  ctx.fillText("弯道", cx, cy + r * 0.5);
  ctx.restore();
}

/* Traffic light at the end of the road, driven by carrot traffic_state. */
const TRAFFIC_COLOR = { 1: "#ff3232", 2: "#32ff32", 3: "#32ff64" };

function drawTrafficLight(w, h, cx, mToPx, fn, yOf, xOf, edgeLatAt) {
  const nav = lastState?.sp_hud?.carrot_nav;
  const state = Number(nav?.traffic_state) || 0;
  const countdown = Number(nav?.traffic_countdown) || 0;
  if (!nav || !Number(nav.active) || !TRAFFIC_COLOR[state]) return;
  const z = 46;
  const f = fn(z);
  if (f < 0.05) return;
  const side = -1;
  const px = xOf(z, edgeLatAt(side, z) + side * -1.6);
  const y = yOf(z);
  const poleH = Math.min((h - h * HORIZON) * 1.6 * f, y - h * 0.1);
  ctx.save();
  // pole
  ctx.strokeStyle = `rgba(125, 138, 162, ${0.5 * f + 0.1})`;
  ctx.lineWidth = Math.max(1.5, w * 0.003 * f);
  ctx.beginPath();
  ctx.moveTo(px, y);
  ctx.lineTo(px, y - poleH);
  ctx.stroke();
  // head with active lamp
  const headR = Math.max(5, w * 0.011 * (0.6 + f));
  const lampColor = TRAFFIC_COLOR[state];
  ctx.fillStyle = "rgba(12, 18, 34, 0.95)";
  roundRect(px - headR * 0.75, y - poleH - headR * 2.4, headR * 1.5, headR * 2.6, headR * 0.4);
  ctx.fill();
  ctx.fillStyle = lampColor;
  ctx.shadowColor = lampColor;
  ctx.shadowBlur = headR * 2.2;
  ctx.beginPath();
  ctx.arc(px, y - poleH - headR * 1.1, headR * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (countdown > 0) {
    ctx.fillStyle = lampColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = `700 ${Math.round(headR * 1.1)}px system-ui, sans-serif`;
    ctx.fillText(String(countdown), px, y - poleH - headR * 2.7);
  }
  ctx.restore();
}

/* Forward collision warning: full-screen red edge pulse (AEB/FCW or low TTC). */
function drawFcw(w, h) {
  const risk = collisionRisk();
  if (risk <= 0.05) return;
  const pulse = 0.72 + 0.28 * Math.sin(performance.now() / 180);
  const alpha = risk * 0.5 * pulse;
  const vg = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.22, w / 2, h * 0.45, Math.max(w, h) * 0.72);
  vg.addColorStop(0, "rgba(255, 30, 20, 0)");
  vg.addColorStop(0.55, `rgba(255, 30, 20, ${alpha * 0.55})`);
  vg.addColorStop(1, `rgba(255, 20, 12, ${alpha})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function drawVignette(w, h, cx) {
  const vg = ctx.createRadialGradient(cx, h * 0.45, Math.min(w, h) * 0.38, cx, h * 0.45, Math.max(w, h) * 0.78);
  vg.addColorStop(0, "rgba(0, 0, 0, 0)");
  vg.addColorStop(1, "rgba(0, 0, 0, 0.38)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ---------- visibility / lifecycle ---------- */

function probeVideoFrozen(ts) {
  const wrap = document.getElementById("camera-wrap");
  const video = document.getElementById("road-video");
  const playing = wrap && wrap.classList.contains("is-playing") && video && !video.paused && video.readyState >= 2;
  if (!playing) {
    frozenStreak = 0;
    lastFrozenHash = null;
    return;
  }
  if (!probeCanvas) {
    probeCanvas = document.createElement("canvas");
    probeCanvas.width = 48;
    probeCanvas.height = 27;
  }
  if (ts - frozenProbeTs < 1500) return;
  frozenProbeTs = ts;
  let hash = null;
  try {
    const pctx = probeCanvas.getContext("2d", { willReadFrequently: true });
    pctx.drawImage(video, 0, 0, probeCanvas.width, probeCanvas.height);
    const data = pctx.getImageData(0, 0, probeCanvas.width, probeCanvas.height).data;
    let acc = 0;
    for (let i = 0; i < data.length; i += 97) acc = (acc + data[i]) % 100000007;
    hash = acc;
  } catch {
    return; // cross-origin or not decodable yet — do not judge
  }
  if (hash === lastFrozenHash) frozenStreak++;
  else frozenStreak = 0;
  lastFrozenHash = hash;
  if (frozenStreak === FROZEN_PROBES) {
    console.warn("[road_lite] video appears frozen — switching to synthesized scene");
    window.dispatchEvent(new CustomEvent("opui:road-lite", { detail: { active: true, reason: "frozen-video" } }));
  }
}

function renderLoop(ts) {
  rafId = null;
  if (!active) return;
  // adaptive frame rate: idle/standstill scenes drop to ~15 fps
  const v = Math.max(0, Number(lastState?.speed_raw) || 0);
  const slow = v < 2;
  if (slow) {
    frameSkip = (frameSkip + 1) % 4;
    if (frameSkip !== 0) {
      lastFrameTs = ts;
      rafId = requestAnimationFrame(renderLoop);
      return;
    }
  }
  if (lastFrameTs) {
    const dt = Math.min(0.2, (ts - lastFrameTs) / 1000);
    distM += v * dt;
  }
  lastFrameTs = ts;
  try {
    drawScene();
  } catch (err) {
    window.__rlErr = `${err?.message}\n${err?.stack || ""}`;
    console.error("[road_lite] drawScene failed:", err);
    stopRender();
    return;
  }
  rafId = requestAnimationFrame(renderLoop);
}

function startRender() {
  lastFrameTs = 0;
  if (rafId == null) rafId = requestAnimationFrame(renderLoop);
}

function stopRender() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function checkVisibility() {
  probeVideoFrozen(performance.now());
  const wrap = document.getElementById("camera-wrap");
  const cls = wrap?.className || "";
  const show = shouldShow();
  if (show === active && cls === lastWrapClass) return;
  lastWrapClass = cls;
  if (show && !active) {
    active = true;
    host.hidden = false;
    wrap?.classList.add("road-lite-on");
    startRender();
    window.dispatchEvent(new CustomEvent("opui:road-lite", { detail: { active: true } }));
  } else if (!show && active) {
    active = false;
    host.hidden = true;
    wrap?.classList.remove("road-lite-on");
    stopRender();
    window.dispatchEvent(new CustomEvent("opui:road-lite", { detail: { active: false } }));
  }
}

export function initRoadLite() {
  if (host || !document.getElementById("camera-wrap")) return;
  forced = new URLSearchParams(window.location.search).get("lite") === "1";
  buildDom();
  opuiWs.on("state", (msg) => {
    if (msg?.data?.ok) {
      lastState = msg.data;
      // mirror Params OnroadLiteMode for webrtc_stream_adaptive.isPreviewStreamEnabled()
      window.__opuiLiteMode = !!lastState.lite_mode;
    }
  });
  watchTimer = setInterval(checkVisibility, ROAD_LITE_MS);
  window.addEventListener("resize", () => {
    if (active) resizeCanvas();
  });
  checkVisibility();
}
