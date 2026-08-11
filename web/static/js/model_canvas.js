/** ModelV2 lane/path overlay — mirrors device ModelRenderer projection. */

let canvas = null;
let ctx = null;
let lastFrame = null;

export function initModelCanvas() {
  const wrap = document.getElementById("model-overlay");
  if (!wrap) return;
  canvas = document.getElementById("model-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "model-canvas";
    canvas.className = "opui-model-canvas";
    wrap.appendChild(canvas);
  }
  ctx = canvas.getContext("2d");
}

export function showModelOverlay(visible) {
  const wrap = document.getElementById("model-overlay");
  if (wrap) wrap.hidden = !visible;
}

export function drawModelOverlay(frame) {
  if (!ctx || !canvas) return;
  lastFrame = frame;
  if (!frame?.ok) return;

  const w = frame.width || 1600;
  const h = frame.height || 900;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  ctx.clearRect(0, 0, w, h);

  const exp = !!frame.experimental;
  const laneColor = exp ? "rgba(255,200,80,0.75)" : "rgba(255,255,255,0.55)";
  const pathColor = frame.rainbow ? null : (exp ? "rgba(255,200,80,0.9)" : "rgba(0,200,255,0.85)");
  const edgeColor = "rgba(200,60,60,0.5)";

  for (const lane of frame.lanes || []) {
    const prob = lane.prob ?? 0;
    if (prob < 0.3) continue;
    if (lane.center?.length) {
      strokePolyline(lane.center, laneColor, 3 + prob * 2);
    } else if (lane.polygon?.length) {
      fillPolygon(lane.polygon, `rgba(255,255,255,${0.08 + prob * 0.12})`);
    }
  }

  for (const edge of frame.edges || []) {
    if ((edge.std ?? 0) < 0.3) continue;
    if (edge.polygon?.length) fillPolygon(edge.polygon, edgeColor);
  }

  if (frame.path?.length) {
    if (frame.rainbow) {
      strokeRainbowPath(frame.path, 5);
    } else {
      strokePolyline(frame.path, pathColor, 5);
    }
  }

  for (const lead of frame.leads || []) {
    if (lead.glow?.length) fillPolygon(lead.glow, `rgba(255,255,255,${lead.alpha ?? 0.25})`);
    if (lead.chevron?.length) strokePolyline(lead.chevron, "rgba(255,255,255,0.9)", 3);
  }
}

function strokePolyline(pts, color, width) {
  if (!pts.length || !color) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const [x0, y0] = firstPoint(pts);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pointAt(pts, i);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function fillPolygon(pts, color) {
  if (!pts.length) return;
  ctx.beginPath();
  const [x0, y0] = firstPoint(pts);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pointAt(pts, i);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRainbowPath(pts, width) {
  if (pts.length < 2) return;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pointAt(pts, i);
    const [x2, y2] = pointAt(pts, i + 1);
    const hue = (i / pts.length) * 300;
    ctx.beginPath();
    ctx.strokeStyle = `hsla(${hue}, 90%, 60%, 0.9)`;
    ctx.lineWidth = width;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function firstPoint(pts) {
  const p = pts[0];
  if (Array.isArray(p)) return p;
  return [pts[0], pts[1]];
}

function pointAt(pts, i) {
  const p = pts[i];
  if (Array.isArray(p)) return p;
  return [pts[i * 2], pts[i * 2 + 1]];
}

export function getLastFrame() {
  return lastFrame;
}
