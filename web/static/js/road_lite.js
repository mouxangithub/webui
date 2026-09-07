/** Road lite view — data-only synthesized driving scene shown when the video
 * stream is off/failing (preview off, connecting, or WebRTC error).
 * Replaces the frozen/black video with a dark perspective road, lane dashes,
 * ego car and lead indicator. All data comes from the existing WS state
 * channel; lanes/path/leads are still drawn by model_canvas into
 * #model-overlay above this canvas. No extra DOM panels — the existing HUD
 * already shows speed / cruise / alerts. */

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

function isOnroadScreen() {
  const app = document.getElementById("app");
  return !!app && app.dataset.screen === "onroad";
}

function videoActive() {
  const wrap = document.getElementById("camera-wrap");
  if (!wrap) return true;
  if (forced) return false;
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
const HALF_ROAD_M = 5.55;    // half road width, m (three ~3.7m lanes)
const DASH_LEN = 3.0;        // m
const DASH_GAP = 6.0;        // m
const POLE_SPACING = 33.0;   // m
const POLE_RANGE = 200.0;    // m

function drawScene() {
  const size = resizeCanvas();
  if (!size) return;
  const { w, h } = size;
  const horizonY = h * HORIZON;
  const cx = w / 2;
  const mToPx = (w * 0.62) / HALF_ROAD_M;       // px per meter at z = Z_NEAR
  const fn = (z) => (Z0 + Z_NEAR) / (Z0 + Math.max(z, 0.4)); // 1 at bumper → 0 far
  const yOf = (z) => horizonY + (h - horizonY) * fn(z);
  const halfAt = (z) => mToPx * HALF_ROAD_M * fn(z);

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

  // --- road surface with depth gradient ---
  const roadTop = yOf(Z_FAR);
  g = ctx.createLinearGradient(0, roadTop, 0, h);
  g.addColorStop(0, "#141c30");
  g.addColorStop(1, "#232f4c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - halfAt(Z_FAR), roadTop);
  ctx.lineTo(cx + halfAt(Z_FAR), roadTop);
  ctx.lineTo(cx + halfAt(Z_NEAR), h);
  ctx.lineTo(cx - halfAt(Z_NEAR), h);
  ctx.closePath();
  ctx.fill();

  // --- subtle center sheen (reflective lane) ---
  ctx.beginPath();
  ctx.moveTo(cx - mToPx * 0.9 * fn(Z_FAR), roadTop);
  ctx.lineTo(cx + mToPx * 0.9 * fn(Z_FAR), roadTop);
  ctx.lineTo(cx + mToPx * 0.9 * fn(Z_NEAR), h);
  ctx.lineTo(cx - mToPx * 0.9 * fn(Z_NEAR), h);
  ctx.closePath();
  ctx.fillStyle = "rgba(140, 170, 230, 0.045)";
  ctx.fill();

  drawLightPools(w, h, cx, mToPx, fn, yOf);
  drawEdgeLines(w, h, cx, fn, roadTop, yOf, halfAt);
  drawLaneDashes(w, cx, mToPx, fn, yOf);
  drawPoles(w, h, cx, mToPx, fn, yOf);
  drawLeadVehicle(w, cx, mToPx, fn, yOf);
  drawEgoCar(w, h, cx);
  drawBsm(w, h);
  drawVignette(w, h, cx);
}

function drawLightPools(w, h, cx, mToPx, fn, yOf) {
  // cool light pools cast by the streetlights onto the road
  const poleOffM = HALF_ROAD_M + 1.3;
  ctx.lineCap = "round";
  for (let z = 6 + (distM % POLE_SPACING); z < POLE_RANGE; z += POLE_SPACING) {
    const f = fn(z);
    if (f < 0.09) continue;
    const y = yOf(z);
    for (const side of [-1, 1]) {
      const px = cx + side * mToPx * (poleOffM - 1.2) * f;
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

function drawEdgeLines(w, h, cx, fn, roadTop, yOf, halfAt) {
  ctx.lineCap = "round";
  for (const pass of [
    { scale: 3.4, color: "rgba(150, 190, 255, 0.16)" },  // glow
    { scale: 1.0, color: "rgba(228, 236, 250, 0.9)" },   // core
  ]) {
    ctx.strokeStyle = pass.color;
    ctx.lineWidth = Math.max(1.5, w * 0.0035 * pass.scale / 1.6);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * halfAt(Z_FAR), roadTop);
      ctx.lineTo(cx + side * halfAt(Z_NEAR), yOf(Z_NEAR) + h * 0.02);
      ctx.stroke();
    }
  }
}

function drawLaneDashes(w, cx, mToPx, fn, yOf) {
  const dashPeriod = DASH_LEN + DASH_GAP;
  const phase = distM % dashPeriod;
  for (const pass of [
    { scale: 3.2, color: "rgba(140, 180, 255, 0.14)" },  // glow
    { scale: 1.0, color: "rgba(215, 224, 240, 0.85)" },  // core
  ]) {
    ctx.strokeStyle = pass.color;
    ctx.lineCap = "round";
    for (const off of [-1.85, 1.85]) {
      let z = Z_NEAR + (dashPeriod - phase) % dashPeriod;
      while (z < Z_FAR) {
        const z2 = z + DASH_LEN;
        if (z2 >= Z_FAR) break;
        ctx.lineWidth = Math.max(1.5, w * 0.0042 * fn(z) * pass.scale / 1.6);
        ctx.beginPath();
        ctx.moveTo(cx + off * mToPx * fn(z), yOf(z));
        ctx.lineTo(cx + off * mToPx * fn(z2), yOf(z2));
        ctx.stroke();
        z = z2 + DASH_GAP;
      }
    }
  }
}

function drawPoles(w, h, cx, mToPx, fn, yOf) {
  const poleOffM = HALF_ROAD_M + 1.3;
  const horizonBase = h * HORIZON;
  ctx.lineCap = "round";
  for (let z = 6 + (distM % POLE_SPACING); z < POLE_RANGE; z += POLE_SPACING) {
    const f = fn(z);
    if (f < 0.02) continue;
    const y = yOf(z);
    const poleH = Math.min((h - horizonBase) * 1.05 * f, y - h * 0.06);
    const alpha = Math.max(0, Math.min(0.6, f * 2.4));
    for (const side of [-1, 1]) {
      const px = cx + side * mToPx * poleOffM * f;
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
  // adjacent-lane lead (leadTwo; yRel is lateral offset, +left). Drawn a bit
  // smaller and dimmer — it is off the ego path. Amber outline when its side
  // BSM is active.
  const d2 = st?.lead2_d_rel;
  if (d2 != null && d2 > 0 && d2 <= 140) {
    const y2 = Number(st?.lead2_y_rel);
    const offM = Number.isFinite(y2) ? Math.max(-4.6, Math.min(4.6, y2)) : 0;
    const bsmOn = (offM >= 0 && bsm.left) || (offM < 0 && bsm.right);
    drawLeadCar(w, cx, mToPx, fn, yOf, d2, offM, 0.55, 0.9, bsmOn);
  }
  // lead in the ego lane
  drawLeadCar(w, cx, mToPx, fn, yOf, st?.lead_d_rel, 0, 1.0, 1.0, false);
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

function drawLeadCar(w, cx, mToPx, fn, yOf, d, offM, alphaMul, sizeMul, bsmOn) {
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

  drawCarSprite(xCenter - carW / 2, y, carW, carH, { tone: "lead", bsm: bsmOn });
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

function renderLoop(ts) {
  rafId = null;
  if (!active) return;
  if (lastFrameTs) {
    const dt = Math.min(0.2, (ts - lastFrameTs) / 1000);
    const v = Math.max(0, Number(lastState?.speed_raw) || 0);
    distM += v * dt;
  }
  lastFrameTs = ts;
  try {
    drawScene();
  } catch (err) {
    window.__rlErr = `${err?.message} @ ${err?.fileName}:${err?.lineNumber}:${err?.columnNumber}`;
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
    if (msg?.data?.ok) lastState = msg.data;
  });
  watchTimer = setInterval(checkVisibility, ROAD_LITE_MS);
  window.addEventListener("resize", () => {
    if (active) resizeCanvas();
  });
  checkVisibility();
}
