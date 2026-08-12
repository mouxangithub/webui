/** Steering torque arc (torque_bar.py simplified). */

const TORQUE_ANGLE_SPAN = 12.7;
let filtered = 0;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function blendColor(c1, c2, t) {
  const k = clamp(t, 0, 1);
  return {
    r: Math.round(lerp(c1.r, c2.r, k)),
    g: Math.round(lerp(c1.g, c2.g, k)),
    b: Math.round(lerp(c1.b, c2.b, k)),
    a: lerp(c1.a, c2.a, k),
  };
}

function rgba(c) {
  return `rgba(${c.r},${c.g},${c.b},${c.a})`;
}

function drawThickArc(ctx, cx, cy, radius, thickness, a0Deg, a1Deg, color) {
  const a0 = (a0Deg * Math.PI) / 180;
  const a1 = (a1Deg * Math.PI) / 180;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, a0, a1, false);
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.stroke();
}

export function updateTorqueBar(st) {
  const canvas = document.getElementById("torque-bar-canvas");
  if (!canvas) return;

  const show = !!st?.started && !!st.torque_bar;
  if (!show) {
    canvas.hidden = true;
    filtered = 0;
    return;
  }

  const wrap = document.getElementById("camera-wrap");
  const w = wrap?.clientWidth || canvas.clientWidth || 1860;
  const h = wrap?.clientHeight || canvas.clientHeight || 1080;
  const dpr = window.devicePixelRatio || 1;
  const pxW = Math.max(1, Math.round(w * dpr));
  const pxH = Math.max(1, Math.round(120 * dpr));

  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
    canvas.style.width = `${w}px`;
    canvas.style.height = "120px";
  }

  const target = clamp(Number(st.torque_utilization) || 0, -1, 1);
  filtered += (target - filtered) * 0.12;

  const engaged = st.ui_status === "engaged" || st.ui_status === "lat_only";
  const alpha = engaged ? 1 : 0.35;
  const util = Math.abs(filtered);
  const offset = lerp(22, 26, clamp((util - 0.5) / 0.5, 0, 1));
  const thickness = lerp(14, 56, clamp((util - 0.5) / 0.5, 0, 1));

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, 120);

  const cx = w / 2 + 8;
  const radius = 1200;
  const cy = 120 + radius - offset;
  const span = TORQUE_ANGLE_SPAN * alpha;
  const top = -90;
  const bgA0 = top - span / 2;
  const bgA1 = top + span / 2;
  const bgAlpha = lerp(0.25, 0.5, clamp((util - 0.5) / 0.5, 0, 1)) * alpha;

  drawThickArc(ctx, cx, cy, radius, thickness, bgA0, bgA1, rgba({ r: 255, g: 255, b: 255, a: bgAlpha }));

  const fillEnd = top + (span / 2) * filtered;
  const hot = clamp((util - 0.75) * 4, 0, 1);
  const start = blendColor(
    { r: 255, g: 255, b: 255, a: 0.9 * alpha },
    { r: 255, g: 200, b: 0, a: alpha },
    hot,
  );
  const end = blendColor(
    { r: 255, g: 255, b: 255, a: 0.9 * alpha },
    { r: 255, g: 115, b: 0, a: alpha },
    hot,
  );
  const grad = ctx.createLinearGradient(cx - w * 0.2, 0, cx + w * 0.2, 0);
  grad.addColorStop(0, rgba(start));
  grad.addColorStop(1, rgba(end));
  drawThickArc(ctx, cx, cy, radius, thickness, top, fillEnd, grad);

  if (util < 0.5) {
    const dotY = 120 - offset - thickness / 2;
    ctx.beginPath();
    ctx.arc(cx, dotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = rgba({ r: 182, g: 182, b: 182, a: 0.9 * alpha });
    ctx.fill();
  }

  canvas.hidden = false;
}
