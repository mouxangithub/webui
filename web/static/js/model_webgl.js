/** WebGL2 model overlay (lanes / path ribbon / leads) — falls back to Canvas 2D in model_canvas.js */

let canvas = null;
let gl = null;
let prog = null;
let posLoc = null;
let colorLoc = null;
let vbo = null;
let ready = false;
let lastOverlay = null;
let rainbowHue = 0;

const PATH_WHITE = [242 / 255, 242 / 255, 242 / 255, 0.7];

function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function asPoints(raw) {
  if (!raw?.length) return [];
  if (Array.isArray(raw[0])) return raw;
  const pts = [];
  for (let i = 0; i + 1 < raw.length; i += 2) pts.push([raw[i], raw[i + 1]]);
  return pts;
}

let cssW = 1600;
let cssH = 900;
let pixelRatio = 1;

function resize(w, h) {
  if (!canvas || !gl) return;
  cssW = w;
  cssH = h;
  pixelRatio = window.devicePixelRatio || 1;
  const pw = Math.max(1, Math.floor(w * pixelRatio));
  const ph = Math.max(1, Math.floor(h * pixelRatio));
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    gl.viewport(0, 0, pw, ph);
  }
}

function drawTriangles(verts, colors) {
  if (!verts.length) return;
  const data = new Float32Array(verts.length * 2);
  const cdata = new Float32Array(colors.length * 4);
  for (let i = 0; i < verts.length; i++) {
    data[i * 2] = verts[i][0] * pixelRatio;
    data[i * 2 + 1] = verts[i][1] * pixelRatio;
    cdata[i * 4] = colors[i][0];
    cdata[i * 4 + 1] = colors[i][1];
    cdata[i * 4 + 2] = colors[i][2];
    cdata[i * 4 + 3] = colors[i][3];
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength + cdata.byteLength, gl.DYNAMIC_DRAW);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
  gl.bufferSubData(gl.ARRAY_BUFFER, data.byteLength, cdata);

  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(colorLoc);
  gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, data.byteLength);

  gl.drawArrays(gl.TRIANGLES, 0, verts.length);
}

function fanTriangulate(poly, rgbaFn) {
  if (poly.length < 3) return { verts: [], colors: [] };
  const verts = [];
  const colors = [];
  const c0 = rgbaFn(poly[0], 0, poly);
  for (let i = 1; i < poly.length - 1; i++) {
    verts.push(poly[0], poly[i], poly[i + 1]);
    colors.push(c0, rgbaFn(poly[i], i, poly), rgbaFn(poly[i + 1], i + 1, poly));
  }
  return { verts, colors };
}

function centroid(poly) {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p[0];
    y += p[1];
  }
  return [x / poly.length, y / poly.length];
}

function expandPoly(poly, scale) {
  const [cx, cy] = centroid(poly);
  return poly.map(([x, y]) => [cx + (x - cx) * scale, cy + (y - cy) * scale]);
}

function pushLaneMesh(allVerts, allColors, poly, rgbaFn, halo = 1.04) {
  if (poly.length < 3) return;
  const haloPoly = expandPoly(poly, halo);
  const haloMesh = fanTriangulate(haloPoly, (_p, _i, _arr) => {
    const c = rgbaFn(_p, _i, poly);
    return [c[0], c[1], c[2], c[3] * 0.35];
  });
  const coreMesh = fanTriangulate(poly, rgbaFn);
  allVerts.push(...haloMesh.verts, ...coreMesh.verts);
  allColors.push(...haloMesh.colors, ...coreMesh.colors);
}

function yGradientColor(pts, y, baseRgb, alpha) {
  const minY = Math.min(...pts.map((p) => p[1]));
  const maxY = Math.max(...pts.map((p) => p[1]));
  const t = maxY === minY ? 0 : (y - minY) / (maxY - minY);
  const g = baseRgb[1] + (114 / 255 - baseRgb[1]) * t;
  return [baseRgb[0], g, baseRgb[2], alpha * (1 - t * 0.3)];
}

function rainbowColor(i, n) {
  const hue = ((rainbowHue + (i / n) * 120) % 360) / 360;
  const s = 0.95;
  const l = 0.55;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = hue + 1 / 3;
  return [hue2rgb(p, q, hk + 1), hue2rgb(p, q, hk), hue2rgb(p, q, hk - 1), 0.85];
}

function hue2rgb(p, q, t) {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

export function initModelWebGL() {
  const host = document.getElementById("model-overlay");
  if (!host || gl) return ready;

  canvas = document.createElement("canvas");
  canvas.className = "opui-model-canvas opui-model-webgl";
  host.appendChild(canvas);
  gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) {
    canvas.remove();
    canvas = null;
    return false;
  }

  const vs = compileShader(gl.VERTEX_SHADER, `#version 300 es
    in vec2 a_pos;
    in vec4 a_color;
    uniform vec2 u_resolution;
    out vec4 v_color;
    void main() {
      vec2 clip = (a_pos / u_resolution) * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      v_color = a_color;
    }`);
  const fs = compileShader(gl.FRAGMENT_SHADER, `#version 300 es
    precision mediump float;
    in vec4 v_color;
    out vec4 outColor;
    void main() { outColor = v_color; }`);
  if (!vs || !fs) return false;

  prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;

  posLoc = gl.getAttribLocation(prog, "a_pos");
  colorLoc = gl.getAttribLocation(prog, "a_color");
  vbo = gl.createBuffer();
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  if (gl.canvas) {
    gl.canvas.style.imageRendering = "auto";
  }
  ready = true;
  return true;
}

export function isModelWebGLReady() {
  return ready;
}

export function drawModelWebGL(data) {
  if (!ready || !gl || !data?.ok) return false;
  if (!data._animate) lastOverlay = data;

  const host = document.getElementById("model-overlay");
  const w = data.width || host?.clientWidth || 1600;
  const h = data.height || host?.clientHeight || 900;
  resize(w, h);

  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(prog);
  gl.uniform2f(gl.getUniformLocation(prog, "u_resolution"), canvas.width, canvas.height);

  const allVerts = [];
  const allColors = [];

  function pushMesh(mesh) {
    allVerts.push(...mesh.verts);
    allColors.push(...mesh.colors);
  }

  for (const lane of data.lanes || []) {
    const poly = asPoints(lane.polygon);
    const prob = lane.prob ?? 0.5;
    const alpha = Math.max(0.15, Math.min(0.85, prob)) * 0.7;
    if (poly.length >= 3) {
      pushLaneMesh(allVerts, allColors, poly, () => [1, 1, 1, alpha], 1.05);
    }
  }

  for (const edge of data.edges || []) {
    const poly = asPoints(edge.polygon);
    if (poly.length >= 3) {
      const std = typeof edge.std === "number" ? edge.std : 0;
      const alpha = Math.max(0, Math.min(1, 1 - std));
      pushLaneMesh(allVerts, allColors, poly, () => [1, 0, 0, alpha], 1.04);
    }
  }

  const pathPoly = asPoints(data.path_polygon);
  if (pathPoly.length >= 4) {
    if (data.rainbow) {
      pushLaneMesh(allVerts, allColors, pathPoly, (_p, i, arr) => rainbowColor(i, arr.length), 1.06);
    } else if (data.experimental && data.path_gradient?.length) {
      const rgbaFn = (p) => {
        const minY = Math.min(...pathPoly.map((q) => q[1]));
        const maxY = Math.max(...pathPoly.map((q) => q[1]));
        const t = maxY === minY ? 0 : (p[1] - minY) / (maxY - minY);
        const stops = data.path_gradient;
        let lo = stops[0];
        let hi = stops[stops.length - 1];
        for (let s = 0; s < stops.length - 1; s++) {
          if (t >= stops[s].pos && t <= stops[s + 1].pos) {
            lo = stops[s];
            hi = stops[s + 1];
            break;
          }
        }
        const span = Math.max(1e-6, (hi.pos ?? 1) - (lo.pos ?? 0));
        const k = (t - (lo.pos ?? 0)) / span;
        const la = lo.rgba || [13, 248, 122, 102];
        const ha = hi.rgba || la;
        return [
          (la[0] + (ha[0] - la[0]) * k) / 255,
          (la[1] + (ha[1] - la[1]) * k) / 255,
          (la[2] + (ha[2] - la[2]) * k) / 255,
          ((la[3] + (ha[3] - la[3]) * k) / 255) * (data.path_blend ?? 1),
        ];
      };
      pushLaneMesh(allVerts, allColors, pathPoly, rgbaFn, 1.08);
    } else {
      const allow = data.allow_throttle !== false;
      const blend = typeof data.path_blend === "number" ? data.path_blend : 1;
      const base = allow ? [13 / 255, 248 / 255, 122 / 255] : PATH_WHITE.slice(0, 3);
      const rgbaFn = (p) => yGradientColor(pathPoly, p[1], base, (allow ? 0.55 : 0.35) * blend);
      pushLaneMesh(allVerts, allColors, pathPoly, rgbaFn, 1.07);
    }
  }

  for (const lead of data.leads || []) {
    const glow = asPoints(lead.glow);
    const chevron = asPoints(lead.chevron);
    const alpha = (lead.alpha ?? 180) / 255;
    if (glow.length >= 3) {
      pushLaneMesh(allVerts, allColors, glow, () => [1, 0.77, 0, alpha * 0.18], 1.12);
      pushLaneMesh(allVerts, allColors, glow, () => [1, 0.77, 0, alpha * 0.28], 1.06);
      pushMesh(fanTriangulate(glow, () => [1, 0.77, 0, alpha * 0.42]));
    }
    if (chevron.length >= 3) {
      pushLaneMesh(allVerts, allColors, chevron, () => [0.79, 0.13, 0.19, alpha * 0.55], 1.04);
      pushMesh(fanTriangulate(chevron, () => [0.79, 0.13, 0.19, alpha]));
    }
  }

  if (allVerts.length) drawTriangles(allVerts, allColors);

  if (data.rainbow) {
    rainbowHue = (rainbowHue + 2) % 360;
    requestAnimationFrame(() => {
      if (lastOverlay?.rainbow) drawModelWebGL({ ...lastOverlay, _animate: true });
    });
  }
  return true;
}
