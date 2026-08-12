/** Canvas overlay for modelV2 lanes / path / leads (mirrors ModelRenderer). */

let canvas = null;
let ctx = null;
let rainbowHue = 0;
let lastOverlay = null;

const LANE_GREEN = "rgba(13, 248, 122, 0.55)";
const PATH_WHITE = "rgba(242, 242, 242, 0.7)";
const LEAD_FILL = "rgba(255, 196, 0, 0.45)";

export function initModelCanvas() {
  const host = document.getElementById("model-overlay");
  if (!host || canvas) return;
  canvas = document.createElement("canvas");
  canvas.className = "opui-model-canvas";
  host.appendChild(canvas);
  ctx = canvas.getContext("2d");
}

export function showModelOverlay(show) {
  const el = document.getElementById("model-overlay");
  if (el) el.hidden = !show;
}

function resize(w, h) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function asPoints(raw) {
  if (!raw?.length) return [];
  if (Array.isArray(raw[0])) return raw;
  const pts = [];
  for (let i = 0; i + 1 < raw.length; i += 2) pts.push([raw[i], raw[i + 1]]);
  return pts;
}

function drawPoly(pts, fill, stroke, lineW = 2) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineW;
    ctx.stroke();
  }
}

function drawLane(lane) {
  const prob = lane.prob ?? 0.5;
  const alpha = Math.max(0.15, Math.min(0.85, prob));
  const fill = `rgba(13, 248, 122, ${alpha * 0.55})`;
  const poly = asPoints(lane.polygon);
  if (poly.length >= 3) {
    drawPoly(poly, fill, null);
    return;
  }
  const center = asPoints(lane.center);
  if (center.length >= 2) {
    ctx.strokeStyle = fill;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(center[0][0], center[0][1]);
    for (let i = 1; i < center.length; i++) ctx.lineTo(center[i][0], center[i][1]);
    ctx.stroke();
  }
}

function drawPath(path, experimental, rainbow) {
  const pts = asPoints(path);
  if (pts.length < 2) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 8;

  if (rainbow) {
    for (let i = 0; i < pts.length - 1; i++) {
      const hue = (rainbowHue + i * 8) % 360;
      ctx.strokeStyle = `hsla(${hue}, 95%, 55%, 0.9)`;
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.stroke();
    }
    return;
  }

  if (experimental) {
    const grad = ctx.createLinearGradient(0, pts[0][1], 0, pts[pts.length - 1][1]);
    grad.addColorStop(0, "rgba(13, 248, 122, 0.85)");
    grad.addColorStop(0.5, "rgba(114, 255, 92, 0.65)");
    grad.addColorStop(1, "rgba(114, 255, 92, 0)");
    ctx.strokeStyle = grad;
  } else {
    ctx.strokeStyle = PATH_WHITE;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

function drawLead(lead) {
  const glow = asPoints(lead.glow);
  const chevron = asPoints(lead.chevron);
  const alpha = (lead.alpha ?? 180) / 255;
  if (glow.length >= 3) drawPoly(glow, `rgba(255, 196, 0, ${alpha * 0.35})`, null);
  if (chevron.length >= 3) drawPoly(chevron, LEAD_FILL, "rgba(255, 220, 80, 0.9)", 2);
}

export function drawModelOverlay(data) {
  if (!ctx || !canvas || !data?.ok) return;
  lastOverlay = data;
  const host = document.getElementById("model-overlay");
  const w = data.width || host?.clientWidth || 1600;
  const h = data.height || host?.clientHeight || 900;
  resize(w, h);
  ctx.clearRect(0, 0, w, h);

  for (const lane of data.lanes || []) drawLane(lane);
  for (const edge of data.edges || []) {
    const poly = asPoints(edge.polygon);
    if (poly.length >= 3) drawPoly(poly, "rgba(255, 80, 80, 0.25)", "rgba(255, 120, 120, 0.5)", 2);
  }
  drawPath(data.path, data.experimental, data.rainbow);
  for (const lead of data.leads || []) drawLead(lead);

  if (data.rainbow) {
    rainbowHue = (rainbowHue + 2) % 360;
    requestAnimationFrame(() => {
      if (lastOverlay?.rainbow) drawModelOverlay({ ...lastOverlay, _animate: true });
    });
  }
}
