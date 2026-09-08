/**
 * Carrot navigation HUD (glass card redesign).
 *
 * One compact semi-transparent "glass" card fed by state.sp_hud.carrot_nav:
 *   - head row: turn mini-icon (+ATC tint) | TBT main text + ETA/destination | dist + countdown
 *   - badge row: road/SDI, desired speed, speed camera, traffic light, curve advisory
 *
 * Duplicates are intentionally dropped: the speed limit circle and road-name
 * chip already live in the top HUD next to the cluster speed, so the card no
 * longer renders its own LIMIT box / big road row — this keeps the card slim
 * (560px) and far from the speed area. Opaque blue panel styling is gone;
 * panel_opacity (CarrotPanelOpacity param) still scales the whole card.
 *
 * Also keeps the left/right AmapLaneIndicators edge bars (state.sp_hud.amap_lines).
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
  1: { c: "#ff5a5a", t: () => tr("Red light") },
  2: { c: "#4ade80", t: () => tr("Green light") },
  3: { c: "#34d399", t: () => tr("Left-turn green") },
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
  position: absolute; bottom: 120px; width: 560px;
  padding: 12px 16px 12px 14px; box-sizing: border-box;
  background: rgba(10, 16, 24, 0.55);
  -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.30);
  color: #fff; font-family: Inter, sans-serif;
  z-index: 5; transition: opacity 0.15s linear;
}
.opui-hud-carrot.cn-side-l { left: 12px; }
.opui-hud-carrot.cn-side-r { right: 12px; }

/* head row: turn mini-icon | headline | meta */
.cn-head { display: flex; align-items: center; gap: 14px; min-height: 60px; }
.cn-turn-mini {
  position: relative; flex: 0 0 60px; width: 60px; height: 60px;
  border-radius: 14px; background: rgba(22, 200, 122, 0.28);
  display: flex; align-items: center; justify-content: center;
  box-sizing: border-box; overflow: hidden;
}
.cn-turn-mini.cn-atc { background: rgba(22, 200, 122, 0.85); }
.cn-turn-mini.cn-atc-prepare { background: rgba(22, 200, 122, 0.35); }
.cn-turn-icon { width: 46px; height: 46px; object-fit: contain; }
.cn-turn-fallback { font-size: 17px; font-weight: 700; text-align: center; line-height: 1.15; padding: 0 4px; }
.cn-headline { flex: 1 1 auto; min-width: 0; }
.cn-tbt { font-size: 29px; font-weight: 700; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cn-sub { font-size: 20px; font-weight: 500; color: rgba(255, 255, 255, 0.72); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cn-turnmeta { flex: 0 0 auto; text-align: right; }
.cn-tdist { font-size: 29px; font-weight: 700; line-height: 1.1; }
.cn-tcd { font-size: 19px; font-weight: 700; color: #ffdc64; margin-top: 3px; min-height: 22px; }

/* badge row */
.cn-badges { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.cn-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 19px; font-weight: 700; line-height: 1;
  padding: 6px 12px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.13); color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
}
.cn-badge .cn-cate { font-size: 17px; padding: 2px 7px; border-radius: 7px; background: rgba(255, 255, 255, 0.18); }
.cn-badge .cn-cate.cn-cate-1 { background: rgba(22, 160, 74, 0.85); }
.cn-badge .cn-cate.cn-cate-2 { background: rgba(217, 145, 10, 0.85); }
.cn-badge.cn-badge--sdi { background: rgba(22, 160, 74, 0.8); color: #fff; }
.cn-badge.cn-badge--apply { background: rgba(255, 180, 50, 0.88); color: #101418; }
.cn-badge.cn-badge--cam { background: rgba(239, 68, 68, 0.82); color: #fff; }
.cn-badge.cn-badge--cam.is-ok { background: rgba(239, 68, 68, 0.35); }
.cn-badge.cn-badge--vturn { background: rgba(255, 200, 50, 0.18); color: #ffc832; border: 1px solid rgba(255, 200, 50, 0.45); }
.cn-badge.cn-tlight { background: rgba(255, 255, 255, 0.10); }
.cn-badge.cn-tlight i { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }

/* amap lane edge bars (unchanged behavior) */
.opui-amapbar {
  position: absolute; top: 55%; transform: translateY(-50%);
  width: 8px; height: 120px; border-radius: 4px;
  background: #66ff99; opacity: 1; transition: opacity 0.15s linear, background 0.15s linear;
  z-index: 5;
}
.opui-amapbar--l { left: 12px; }
.opui-amapbar--r { right: 12px; }
.opui-amapbar.is-blocked { background: #ff6633; }

/* road-lite mode: the synthesized canvas already draws TBT / traffic light /
   curve advisory — hide the DOM nav card and edge bars for a clean scene.
   (road_lite.js toggles road-lite-on on both #camera-wrap and #hud; #hud is
   the parent of the nav card, the wrap is only its sibling.) */
#hud.road-lite-on #hud-carrot-nav,
#hud.road-lite-on .opui-amapbar { display: none !important; }
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
    ? `${tr("ETA")} ${Math.floor(minutes / 60)}h${Math.round(minutes % 60)}m · ${hh}:${mm}`
    : `${tr("ETA")} ${Math.round(minutes)}min · ${hh}:${mm}`;
}

function hasNavContent(nav) {
  return !!(nav
    && ((nav.go_pos_dist > 0 && nav.go_pos_time > 0)
      || nav.goal_name || nav.turn_info > 0
      || (nav.spd_limit > 0 && nav.spd_dist > 0)
      || nav.traffic_state > 0 || nav.road_name || nav.sdi_descr || nav.tbt_main_text));
}

function turnMiniHtml(nav) {
  const t = nav.turn_info;
  const atc = nav.atc_type ? (nav.atc_type.includes("prepare")
    ? "cn-atc cn-atc-prepare" : "cn-atc") : "";
  let inner;
  if (TURN_ICONS[t]) {
    inner = `<img class="cn-turn-icon" src="${TURN_ICONS[t]}" alt="" onerror="this.outerHTML='<div class=&quot;cn-turn-fallback&quot;>${esc(TURN_FALLBACK(t))}</div>'">`;
  } else {
    inner = `<div class="cn-turn-fallback">${esc(TURN_FALLBACK(t))}</div>`;
  }
  return `<div class="cn-turn-mini ${atc}">${inner}</div>`;
}

function badgesHtml(nav, speedKph) {
  const badges = [];
  if (nav.sdi_descr) {
    badges.push(`<span class="cn-badge cn-badge--sdi">${esc(nav.sdi_descr)}</span>`);
  } else if (nav.road_name) {
    const cate = ROAD_CATE[nav.road_cate]
      ? `<b class="cn-cate cn-cate-${nav.road_cate}">${ROAD_CATE[nav.road_cate]()}</b>` : "";
    badges.push(`<span class="cn-badge">${cate}${esc(nav.road_name)}</span>`);
  }
  if (nav.desired_speed > 0 && nav.desired_source) {
    const src = esc(nav.desired_source).slice(0, 10);
    badges.push(`<span class="cn-badge cn-badge--apply">${src} ${nav.desired_speed}</span>`);
  }
  if (nav.spd_limit > 0 && nav.spd_dist > 0) {
    const over = Math.round(speedKph) > nav.spd_limit;
    const type = CAMERA_TYPES[nav.spd_type] ? CAMERA_TYPES[nav.spd_type]() : tr("Camera");
    badges.push(`<span class="cn-badge cn-badge--cam${over ? "" : " is-ok"}">◉ ${nav.spd_limit} · ${esc(fmtDist(nav.spd_dist, true))}${nav.spd_countdown > 0 ? ` ${nav.spd_countdown}s` : ""}<i style="font-style:normal;font-weight:500;opacity:.8">${esc(type)}</i></span>`);
  }
  if (nav.traffic_state > 0) {
    const info = TRAFFIC[nav.traffic_state] || { c: "#ffd644", t: () => tr("Traffic light") };
    const cd = nav.traffic_countdown > 0 ? nav.traffic_countdown : nav.left_sec;
    badges.push(`<span class="cn-badge cn-tlight"><i style="background:${info.c}"></i><span style="color:${info.c}">${info.t()}</span>${cd > 0 ? `${cd}s` : ""}</span>`);
  }
  if (nav.v_turn_speed > 0 && nav.v_turn_speed < 120) {
    badges.push(`<span class="cn-badge cn-badge--vturn">${tr("Curve")} ${nav.v_turn_speed}km/h</span>`);
  }
  return badges.length ? `<div class="cn-badges">${badges.join("")}</div>` : "";
}

function renderPanel(nav, isMetric, speedKph) {
  const tbt = nav.tbt_main_text
    ? nav.tbt_main_text + (nav.near_dir_name ? " → " + nav.near_dir_name : "")
    : "";
  const turn = nav.turn_info > 0 ? turnMiniHtml(nav) : "";
  const hasEta = nav.go_pos_dist > 0 && nav.go_pos_time > 0;
  let sub = "";
  if (hasEta) {
    sub = `${esc(etaString(nav.go_pos_time))} · ${esc(fmtDist(nav.go_pos_dist, isMetric))}${nav.goal_name ? " 🏁 " + esc(nav.goal_name) : ""}`;
  } else if (nav.goal_name) {
    sub = `🏁 ${esc(nav.goal_name)}`;
  }
  const dist = nav.dist_to_turn > 0 ? `<div class="cn-tdist">${esc(fmtDist(nav.dist_to_turn, isMetric))}</div>` : "";
  const cd = nav.turn_countdown > 0 ? `<div class="cn-tcd">${nav.turn_countdown}s</div>` : "<div class=\"cn-tcd\"></div>";
  const badges = badgesHtml(nav, speedKph);
  return `
    <div class="cn-head">
      ${turn}
      <div class="cn-headline">
        <div class="cn-tbt">${esc(tbt)}</div>
        ${sub ? `<div class="cn-sub">${sub}</div>` : ""}
      </div>
      ${dist || cd ? `<div class="cn-turnmeta">${dist}${cd}</div>` : ""}
    </div>
    ${badges}`;
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
