/**
 * Carrot navigation HUD (mirrors GUI sunnypilot/onroad/amap_lane_indicators.py).
 *
 * Two components:
 *  - CarrotNavigationPanel: bottom panel fed by state.sp_hud.carrot_nav
 *    (turn icon + ATC, TBT text, ETA/destination, SDI/road name,
 *     road/desired speed boxes, speed camera circle, traffic light).
 *  - AmapLaneIndicators: left/right edge bars fed by state.sp_hud.amap_lines
 *    (orange = lane blocked, green = valid; server-gated by AmapEnabled).
 *
 * Labels use tr(); zh-CHS values mirror the native GUI's Chinese strings.
 */

import { tr } from "./i18n.js";

const ASSET_BASE = "/api/opui/assets/sunnypilot/selfdrive/assets/images";
const TURN_ICONS = {
  1: `${ASSET_BASE}/turn_l.png`,
  2: `${ASSET_BASE}/turn_r.png`,
  3: `${ASSET_BASE}/lane_change_l.png`,
  4: `${ASSET_BASE}/lane_change_r.png`,
  7: `${ASSET_BASE}/turn_u.png`,
};
const TURN_FALLBACK = (t) => (t === 6 ? "TG" : t === 8 ? tr("Destination") : `${tr("Slow down")}:${t}`);
const ROAD_CATE = {
  1: () => tr("Highway"),
  2: () => tr("City Expressway"),
  3: () => tr("National Road"),
  4: () => tr("Provincial Road"),
  5: () => tr("County Road"),
  6: () => tr("Town Road"),
};
const CAMERA_TYPES = {
  2: () => tr("Average Speed Camera"),
  4: () => tr("Average Speed Camera"),
  22: () => tr("Speed Bump"),
  100: () => tr("Mobile Speed Camera"),
};
const TRAFFIC = {
  1: { c: "#ff3232", t: () => tr("Red light") },
  2: { c: "#32ff32", t: () => tr("Green light") },
  3: { c: "#32ff64", t: () => tr("Left-turn green") },
};

let lastNavSig = "";
let styleInjected = false;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement("style");
  style.id = "opui-hud-carrot-style";
  style.textContent = `
.opui-hud-carrot {
  position: absolute; bottom: 120px; width: 790px;
  padding: 8px 20px 16px 20px; box-sizing: border-box;
  background: rgba(0, 105, 148, 1); border: 1px solid rgba(255,255,255,0.3);
  border-radius: 29px; color: #fff; font-family: Inter, sans-serif;
  z-index: 5; transition: opacity 0.15s linear;
}
.opui-hud-carrot.cn-side-l { left: 12px; }
.opui-hud-carrot.cn-side-r { right: 12px; }
.cn-tbt { font-size: 40px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; height: 48px; line-height: 48px; }
.cn-body { display: flex; align-items: flex-start; }
.cn-turn { position: relative; width: 160px; min-height: 230px; flex: 0 0 160px; margin-top: 4px; border-radius: 15px; }
.cn-turn.cn-atc { background: rgba(0, 180, 0, 1); }
.cn-turn.cn-atc.cn-atc-prepare { background: rgba(0, 180, 0, 0.4); }
.cn-turn-icon { display: block; width: 128px; height: 128px; margin: 16px auto 0 auto; }
.cn-turn-fallback { font-size: 35px; font-weight: 700; text-align: center; line-height: 128px; }
.cn-vturn { font-size: 34px; font-weight: 700; color: #ffc832; text-align: center; }
.cn-tdist { font-size: 40px; font-weight: 700; text-align: center; }
.cn-tcd { font-size: 30px; font-weight: 700; color: #ffdc64; text-align: center; }
.cn-info { flex: 1 1 auto; margin-left: 30px; min-width: 0; }
.cn-eta { font-size: 50px; font-weight: 700; }
.cn-dest { font-size: 40px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cn-roadrow { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 40px; font-weight: 700; min-height: 34px; }
.cn-cate { font-size: 28px; padding: 2px 8px; border-radius: 8px; background: #646464; }
.cn-cate.cn-cate-1 { background: rgb(0, 130, 0); }
.cn-cate.cn-cate-2 { background: rgb(200, 130, 0); }
.cn-sdi { display: inline-block; font-size: 40px; font-weight: 700; padding: 0 10px; border-radius: 10px; background: rgb(0, 180, 0); }
.cn-speedrow { display: flex; align-items: flex-end; gap: 20px; margin-top: 10px; }
.cn-speedbox { text-align: center; }
.cn-speedbox .lab { font-size: 24px; font-weight: 700; margin-bottom: 2px; }
.cn-speedbox .val { width: 90px; height: 42px; line-height: 42px; border-radius: 12px; font-size: 36px; font-weight: 700; background: rgba(255,255,255,0.82); color: #000; }
.cn-speedbox .val.cn-over { background: rgb(255, 50, 50); color: #fff; }
.cn-speedbox .val.cn-apply { background: rgb(255, 180, 50); color: #fff; }
.cn-camerarow { display: flex; align-items: center; gap: 15px; margin-top: 10px; }
.cn-camcircle { width: 70px; height: 70px; border-radius: 50%; background: rgba(255,255,255,0.78); border: 4px solid rgb(255, 80, 80); color: #000; font-size: 40px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.cn-camcircle.cn-over { background: rgb(255, 50, 50); color: #fff; }
.cn-cammeta { font-size: 36px; font-weight: 700; }
.cn-camtype { font-size: 26px; color: #ffc832; }
.cn-trafficrow { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: 32px; font-weight: 600; }
.cn-tdot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid rgba(60,60,60,0.9); box-sizing: border-box; }
.cn-tcd2 { font-size: 30px; font-weight: 700; margin-left: 110px; }
.opui-amapbar {
  position: absolute; top: 55%; transform: translateY(-50%);
  width: 8px; height: 120px; border-radius: 4px;
  background: #66ff99; opacity: 1; transition: opacity 0.15s linear, background 0.15s linear;
  z-index: 5;
}
.opui-amapbar--l { left: 12px; }
.opui-amapbar--r { right: 12px; }
.opui-amapbar.is-blocked { background: #ff6633; }
`;
  document.head.appendChild(style);
}

function fmtDist(meters, isMetric) {
  if (isMetric) {
    return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
  }
  const ft = meters * 3.28084;
  return ft < 1609 ? `${Math.round(ft)} ft` : `${(meters / 1609.344).toFixed(1)} mi`;
}

function etaString(seconds) {
  const minutes = seconds / 60;
  const now = new Date();
  const total = now.getHours() * 60 + now.getMinutes() + Math.round(minutes);
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return minutes >= 60
    ? `ETA: ${Math.floor(minutes / 60)}h${Math.round(minutes % 60)}m(${hh}:${mm})`
    : `ETA: ${Math.round(minutes)}min(${hh}:${mm})`;
}

function hasNavContent(nav) {
  return !!(nav
    && ((nav.go_pos_dist > 0 && nav.go_pos_time > 0)
      || nav.goal_name || nav.turn_info > 0
      || (nav.spd_limit > 0 && nav.spd_dist > 0)
      || nav.traffic_state > 0 || nav.road_name || nav.sdi_descr || nav.tbt_main_text));
}

function turnBlockHtml(nav) {
  const t = nav.turn_info;
  const atc = nav.atc_type ? (nav.atc_type.includes("prepare")
    ? "cn-atc cn-atc-prepare" : "cn-atc") : "";
  let inner;
  if (TURN_ICONS[t]) {
    inner = `<img class="cn-turn-icon" src="${TURN_ICONS[t]}" alt="" onerror="this.outerHTML='<div class=&quot;cn-turn-fallback&quot;>${esc(TURN_FALLBACK(t))}</div>'">`;
  } else {
    inner = `<div class="cn-turn-fallback">${esc(TURN_FALLBACK(t))}</div>`;
  }
  const vturn = nav.v_turn_speed > 0 && nav.v_turn_speed < 120
    ? `<div class="cn-vturn">${nav.v_turn_speed}km/h</div>` : "";
  const dist = nav.dist_to_turn > 0 ? `<div class="cn-tdist">${esc(fmtDist(nav.dist_to_turn, true))}</div>` : "";
  const cd = nav.turn_countdown > 0 ? `<div class="cn-tcd">${nav.turn_countdown}s</div>` : "";
  return `<div class="cn-turn ${atc}">${inner}${vturn}${dist}${cd}</div>`;
}

function speedRowHtml(nav, speedKph) {
  const hasLimit = nav.road_limit_speed > 0;
  const hasApply = nav.desired_speed > 0 && !!nav.desired_source;
  if (!hasLimit && !hasApply) return "";
  const over = hasLimit && speedKph > nav.road_limit_speed + 2;
  const limit = hasLimit
    ? `<div class="cn-speedbox"><div class="lab">LIMIT</div><div class="val${over ? " cn-over" : ""}">${nav.road_limit_speed}</div></div>`
    : "";
  const src = esc(nav.desired_source).slice(0, 12);
  const apply = hasApply
    ? `<div class="cn-speedbox"><div class="lab" style="color:#ffb432">${src}</div><div class="val cn-apply">${nav.desired_speed}</div></div>`
    : "";
  return `<div class="cn-speedrow">${limit}${apply}</div>`;
}

function cameraRowHtml(nav, speedKph, isMetric) {
  if (!(nav.spd_limit > 0 && nav.spd_dist > 0)) return "";
  const over = Math.round(speedKph) > nav.spd_limit;
  const dist = fmtDist(nav.spd_dist, isMetric) + (nav.spd_countdown > 0 ? ` ${nav.spd_countdown}s` : "");
  const type = CAMERA_TYPES[nav.spd_type] ? `<div class="cn-camtype">${CAMERA_TYPES[nav.spd_type]()}</div>` : "";
  return `<div class="cn-camerarow"><div class="cn-camcircle${over ? " cn-over" : ""}">${nav.spd_limit}</div><div><div class="cn-cammeta">${esc(dist)}</div>${type}</div></div>`;
}

function roadRowHtml(nav) {
  if (nav.sdi_descr) {
    return `<div class="cn-roadrow"><span class="cn-sdi">${esc(nav.sdi_descr)}</span></div>`;
  }
  if (nav.road_name) {
    const cate = ROAD_CATE[nav.road_cate]
      ? `<span class="cn-cate cn-cate-${nav.road_cate}">${ROAD_CATE[nav.road_cate]()}</span>` : "";
    return `<div class="cn-roadrow">${cate}<span>${esc(nav.road_name)}</span></div>`;
  }
  return "";
}

function trafficRowHtml(nav) {
  if (!(nav.traffic_state > 0)) return "";
  const info = TRAFFIC[nav.traffic_state] || { c: "#c8c832", t: () => tr("Traffic light") };
  const cd = nav.traffic_countdown > 0 ? nav.traffic_countdown : nav.left_sec;
  const cdHtml = cd > 0 ? `<div class="cn-tcd2">${cd}s</div>` : "";
  return `<div class="cn-trafficrow"><div class="cn-tdot" style="background:${info.c}"></div><span style="color:${info.c}">${info.t()}</span>${cdHtml}</div>`;
}

function renderPanel(nav, isMetric, speedKph) {
  const tbt = nav.tbt_main_text
    ? nav.tbt_main_text + (nav.near_dir_name ? " -> " + nav.near_dir_name : "")
    : "";
  const hasEta = nav.go_pos_dist > 0 && nav.go_pos_time > 0;
  const eta = hasEta ? `<div class="cn-eta">${esc(etaString(nav.go_pos_time))}</div>` : "";
  const dest = hasEta
    ? `<div class="cn-dest">${esc(fmtDist(nav.go_pos_dist, isMetric))}${nav.goal_name ? " 🏁 " + esc(nav.goal_name) : ""}</div>`
    : (nav.goal_name ? `<div class="cn-dest">🏁 ${esc(nav.goal_name)}</div>` : "");
  const turn = nav.turn_info > 0 ? turnBlockHtml(nav) : "";
  return `
    <div class="cn-tbt">${esc(tbt)}</div>
    <div class="cn-body">
      ${turn}
      <div class="cn-info">
        ${eta}${dest}
        ${roadRowHtml(nav)}
        ${speedRowHtml(nav, speedKph)}
        ${cameraRowHtml(nav, speedKph, isMetric)}
        ${trafficRowHtml(nav)}
      </div>
    </div>`;
}

export function updateCarrotNav(st) {
  injectStyle();
  const el = document.getElementById("hud-carrot-nav");
  if (!el) return;
  const nav = st?.sp_hud?.carrot_nav;
  if (!st?.started || !hasNavContent(nav)) {
    el.hidden = true;
    lastNavSig = "";
    return;
  }
  const isMetric = st.is_metric !== false;
  const speedKph = Number(st?.sp_hud?.cluster_speed) || 0;
  el.hidden = false;
  el.classList.toggle("cn-side-l", Number(nav.panel_side) !== 1);
  el.classList.toggle("cn-side-r", Number(nav.panel_side) === 1);
  el.style.opacity = String(Math.max(0.1, Math.min(1, (Number(nav.panel_opacity) || 100) / 100)));
  const sig = JSON.stringify(nav) + "|" + (isMetric ? "m" : "i") + "|" + speedKph;
  if (sig === lastNavSig) return;
  lastNavSig = sig;
  el.innerHTML = renderPanel(nav, isMetric, speedKph);
}

export function updateAmapBars(st) {
  injectStyle();
  const lines = st?.sp_hud?.amap_lines;
  const show = !!st?.started && !!lines?.valid;
  for (const side of ["l", "r"]) {
    const el = document.getElementById(side === "l" ? "hud-amap-bar-l" : "hud-amap-bar-r");
    if (!el) continue;
    el.hidden = !show;
    if (show) {
      const blocked = side === "l" ? lines.left_blocked : lines.right_blocked;
      el.classList.toggle("is-blocked", !!blocked);
    }
  }
}
