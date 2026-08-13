/** sunnypilot onroad HUD extensions (speed limit, road name, blinkers, DM arc, rocket fuel, SCC). */

import { tr } from "./i18n.js";

const TURN_IMG = "/api/opui/assets/icons_mici/onroad/turn_signal_left.png";
const BSM_IMG = "/api/opui/assets/icons_mici/onroad/blind_spot_left.png";
const DM_FACE_IMG = "/api/opui/assets/icons/driver_face.png";
const ARROW_UP = "/api/opui/assets/sunnypilot/selfdrive/assets/img_plus_arrow_up.png";
const ARROW_DOWN = "/api/opui/assets/sunnypilot/selfdrive/assets/img_minus_arrow_down.png";
const ARC_LEN = 133;

let vcAccel = 0;

export function updateSpHud(st) {
  const hud = document.getElementById("hud");
  if (!hud) return;

  if (!st?.started) {
    clearSpHud();
    vcAccel = 0;
    return;
  }

  const sp = st.sp_hud || {};
  const alertSize = (st.alert?.size || "none").toLowerCase();
  const hideDm = alertSize && alertSize !== "none";

  updateSpeedLimit(sp, st);
  updateSccTags(sp);
  updateRocketFuel(st);
  updateTurnSignals(st, sp);

  const roadName = st.road_name_toggle ? sp.road_name : "";
  setText("hud-road-name", roadName);
  drawDmArc(st.dm_arc, hideDm, Number(st.developer_ui) || 0);
}

function updateTurnSignals(st, sp) {
  const allowTurn = !!st.turn_signals;
  const allowBsm = !!st.blindspot;
  if (!allowTurn && !allowBsm) {
    hideEl("hud-blinker-l");
    hideEl("hud-blinker-r");
    hideEl("hud-bsl");
    hideEl("hud-bsr");
    return;
  }

  hideEl("hud-bsl");
  hideEl("hud-bsr");
  updateTurnSide("hud-blinker-l", allowBsm && sp.blindspot_left, allowTurn && sp.turn_signal_left);
  updateTurnSide("hud-blinker-r", allowBsm && sp.blindspot_right, allowTurn && sp.turn_signal_right, true);
}

function updateTurnSide(id, bsm, blinker, flip = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!bsm && !blinker) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.classList.toggle("is-bsm", bsm);
  el.classList.toggle("is-blink", !bsm && blinker);
  const img = bsm ? BSM_IMG : TURN_IMG;
  el.style.backgroundImage = `url("${img}")`;
  el.style.transform = flip ? "scaleX(-1)" : "";
}

function updateSpeedLimit(sp, st) {
  const slaWrap = document.getElementById("hud-speed-limit-wrap");
  if (!slaWrap) return;

  if (Number(st.speed_limit_mode) === 0) {
    slaWrap.hidden = true;
    return;
  }

  slaWrap.hidden = false;
  slaWrap.classList.toggle("opui-hud-sla--mutcd", st.is_metric === false);

  const mutcdLabels = slaWrap.querySelector(".opui-hud-sla-mutcd-labels");
  if (mutcdLabels) {
    const showMutcd = st.is_metric === false;
    mutcdLabels.hidden = !showMutcd;
    if (showMutcd) {
      const speedLbl = mutcdLabels.querySelector(".opui-hud-sla-mutcd-speed");
      const limitLbl = mutcdLabels.querySelector(".opui-hud-sla-mutcd-limit");
      if (speedLbl) speedLbl.textContent = tr("SPEED");
      if (limitLbl) limitLbl.textContent = tr("LIMIT");
    }
  }

  const hasLimit = !!(sp.speed_limit_valid || sp.speed_limit_last_valid);
  const limitVal = hasLimit
    ? Math.round(sp.speed_limit_last ?? sp.speed_limit_resolver ?? 0)
    : null;
  const limitText = limitVal != null ? String(limitVal) : "---";

  const el = document.getElementById("hud-speed-limit");
  if (el) el.textContent = limitText;

  const warningMode = Number(st.speed_limit_mode) >= 2;
  const isOverspeed = hasLimit
    && Math.round(sp.speed_limit_final_last ?? limitVal ?? 0) < Math.round(st.speed ?? 0);
  slaWrap.classList.toggle("is-overspeed", warningMode && isOverspeed);
  slaWrap.classList.toggle("is-invalid", hasLimit && !sp.speed_limit_valid);

  const offset = Number(sp.speed_limit_offset) || 0;
  let offsetEl = document.getElementById("hud-speed-limit-offset");
  if (!offsetEl && slaWrap) {
    offsetEl = document.createElement("span");
    offsetEl.id = "hud-speed-limit-offset";
    offsetEl.className = "opui-hud-sla-offset";
    slaWrap.appendChild(offsetEl);
  }
  if (offsetEl) {
    if (offset !== 0 && hasLimit) {
      const sign = offset > 0 ? "" : "-";
      offsetEl.textContent = `${sign}${Math.round(Math.abs(offset))}`;
      offsetEl.hidden = false;
    } else {
      offsetEl.hidden = true;
    }
  }

  const assistState = sp.speed_limit_assist_state || sp.speed_limit_assist || "";
  const preActive = assistState === "preActive" || sp.speed_limit_assist === "preActive";
  const assist = preActive || sp.speed_limit_assist_active;
  slaWrap.classList.toggle("opui-hud-sla--assist", assist);
  slaWrap.classList.toggle("opui-hud-sla--preactive", preActive);

  let arrowEl = document.getElementById("hud-speed-limit-arrow");
  if (!arrowEl && slaWrap.parentElement) {
    arrowEl = document.createElement("img");
    arrowEl.id = "hud-speed-limit-arrow";
    arrowEl.className = "opui-hud-sla-arrow";
    arrowEl.alt = "";
    slaWrap.parentElement.appendChild(arrowEl);
  }
  if (arrowEl) {
    if (preActive && sp.pre_active_arrow) {
      arrowEl.hidden = false;
      arrowEl.src = sp.pre_active_arrow === "down" ? ARROW_DOWN : ARROW_UP;
    } else {
      arrowEl.hidden = true;
    }
  }

  let ahead = document.getElementById("hud-speed-limit-ahead");
  if (!ahead && slaWrap.parentElement) {
    ahead = document.createElement("div");
    ahead.id = "hud-speed-limit-ahead";
    ahead.className = "opui-hud-sla-ahead";
    ahead.hidden = true;
    slaWrap.parentElement.appendChild(ahead);
  }
  if (ahead) {
    const sourceIsMap = sp.speed_limit_source === "map";
    const currentLimit = sp.speed_limit_resolver ?? limitVal;
    const showAhead = sourceIsMap
      && sp.speed_limit_ahead_valid
      && sp.speed_limit_ahead != null
      && currentLimit != null
      && Math.round(sp.speed_limit_ahead) !== Math.round(currentLimit);
    if (showAhead) {
      ahead.hidden = false;
      const dist = formatAheadDist(sp.speed_limit_ahead_dist, st.is_metric !== false);
      ahead.innerHTML = `<span class="opui-hud-sla-ahead__label">${tr("AHEAD")}</span>`
        + `<span class="opui-hud-sla-ahead__val">${Math.round(sp.speed_limit_ahead)}</span>`
        + `<span class="opui-hud-sla-ahead__dist">${dist}</span>`;
    } else {
      ahead.hidden = true;
    }
  }
}

function formatAheadDist(d, metric) {
  const dist = Number(d) || 0;
  if (metric) {
    if (dist < 50) return tr("Near");
    if (dist >= 1000) return `${(dist / 1000).toFixed(1)} ${tr("km")}`;
    const rounded = dist < 200 ? Math.round(dist / 10) * 10 : Math.round(dist / 100) * 100;
    return `${rounded} ${tr("m")}`;
  }
  const dFt = dist * 3.28084;
  if (dFt < 100) return tr("Near");
  if (dFt >= 900) return `${(dist * 0.000621371).toFixed(1)} ${tr("mi")}`;
  const rounded = dFt < 200 ? Math.round(dFt / 10) * 10 : Math.round(dFt / 100) * 100;
  return `${rounded} ${tr("ft")}`;
}

function updateRocketFuel(st) {
  const rocket = document.getElementById("hud-rocket");
  if (!rocket) return;

  if (!st.rocket_fuel_enabled) {
    rocket.hidden = true;
    return;
  }

  const aEgo = Number(st.a_ego) || 0;
  vcAccel += (aEgo - vcAccel) / 5;

  let hha = 0;
  let isBrake = false;
  if (vcAccel > 0) {
    hha = Math.max(0, 0.85 - 0.1 / vcAccel);
  } else if (vcAccel < 0) {
    hha = Math.max(0, 0.85 + 0.1 / vcAccel);
    isBrake = true;
  }

  if (hha <= 0) {
    rocket.hidden = true;
    return;
  }

  rocket.hidden = false;
  const barPct = (hha / 2) * 100;
  rocket.style.setProperty("--rocket-up", isBrake ? "0%" : `${barPct}%`);
  rocket.style.setProperty("--rocket-down", isBrake ? `${barPct}%` : "0%");
}

function clearSpHud() {
  ["hud-speed-limit-wrap", "hud-blinker-l", "hud-blinker-r", "hud-bsl", "hud-bsr",
    "hud-rocket", "hud-road-name", "hud-scc-v", "hud-scc-m", "dm-arc-wrap"].forEach((id) => {
    hideEl(id);
  });
  hideEl("hud-speed-limit-ahead");
  hideEl("hud-speed-limit-arrow");
}

function hideEl(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}

function updateSccTags(sp) {
  const vision = document.getElementById("hud-scc-v");
  const map = document.getElementById("hud-scc-m");
  const override = !!sp.long_override;

  if (vision) {
    vision.hidden = !sp.scc_vision_enabled;
    vision.classList.toggle("is-override", override);
    vision.classList.toggle("is-dim", !sp.scc_vision_active && sp.scc_vision_enabled);
  }
  if (map) {
    map.hidden = !sp.scc_map_enabled;
    map.classList.toggle("is-override", override);
    map.classList.toggle("is-dim", !sp.scc_map_active && sp.scc_map_enabled);
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!text) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = text;
}

function drawDmArc(dm, hideDm, devUi) {
  const wrap = document.getElementById("dm-arc-wrap");
  const svg = document.getElementById("dm-arc");
  if (!wrap || !svg) return;
  if (!dm?.visible || hideDm) {
    wrap.hidden = true;
    wrap.classList.remove("is-clickable");
    return;
  }
  wrap.hidden = false;
  wrap.classList.add("is-clickable");
  wrap.classList.toggle("opui-dm-wrap--rhd", !!dm.rhd);
  wrap.classList.toggle("opui-dm-wrap--dev-bottom", devUi === 1 || devUi === 3);
  wrap.classList.toggle("is-dm-active", !!dm.active);

  const faceLine = svg.querySelector(".dm-arc-face");
  const faceImg = wrap.querySelector(".opui-dm-face");
  const outline = dm.face_outline || [];
  if (faceLine) {
    if (outline.length >= 2) {
      faceLine.setAttribute("points", outline.map((p) => `${p[0]},${p[1]}`).join(" "));
      faceLine.hidden = false;
      faceLine.setAttribute("stroke-opacity", dm.active ? "0.65" : "0.2");
      if (faceImg) faceImg.hidden = true;
    } else {
      faceLine.setAttribute("points", "");
      faceLine.hidden = true;
      if (faceImg) faceImg.hidden = false;
    }
  }

  const hArc = svg.querySelector(".dm-arc-h");
  const vArc = svg.querySelector(".dm-arc-v");
  const len = 300;
  const engagedColor = dm.engaged ? "#1af242" : "#8b8b8b";
  const hx = dm.pose_h ?? 0;
  const vy = dm.pose_v ?? 0;
  const hFrac = Math.min(1, hx);
  const vFrac = Math.min(1, vy);
  if (hArc) {
    hArc.setAttribute("stroke", engagedColor);
    hArc.setAttribute("stroke-dasharray", `${len * hFrac} ${len}`);
    hArc.setAttribute("stroke-opacity", dm.active ? "0.4" : "0.15");
  }
  if (vArc) {
    vArc.setAttribute("stroke", engagedColor);
    vArc.setAttribute("stroke-dasharray", `${len * vFrac} ${len}`);
    vArc.setAttribute("stroke-opacity", dm.active ? "0.4" : "0.15");
  }
}

let dmArcBound = false;

export function bindDmArcClick() {
  if (dmArcBound) return;
  const wrap = document.getElementById("dm-arc-wrap");
  if (!wrap) return;
  dmArcBound = true;
  wrap.addEventListener("click", (ev) => {
    if (wrap.hidden) return;
    ev.stopPropagation();
    window.dispatchEvent(new CustomEvent("opui:open-driver-camera"));
  });
}
