/** sunnypilot onroad HUD extensions (speed limit, road name, blinkers, DM arc, rocket fuel, SCC). */

const BSM_IMG = "/api/opui/assets/icons_mici/onroad/blind_spot_left.png";

export function updateSpHud(st) {
  const hud = document.getElementById("hud");
  if (!hud) return;

  if (!st?.started) {
    clearSpHud();
    return;
  }

  const sp = st.sp_hud || {};
  const alertSize = (st.alert?.size || "none").toLowerCase();
  const hideDm = alertSize && alertSize !== "none";

  updateSpeedLimit(sp);
  updateSccTags(sp);

  const blinkL = document.getElementById("hud-blinker-l");
  const blinkR = document.getElementById("hud-blinker-r");
  if (blinkL) blinkL.hidden = !sp.turn_signal_left;
  if (blinkR) blinkR.hidden = !sp.turn_signal_right;

  const bsl = document.getElementById("hud-bsl");
  const bsr = document.getElementById("hud-bsr");
  if (bsl) {
    bsl.hidden = !sp.blindspot_left;
    bsl.style.backgroundImage = sp.blindspot_left ? `url("${BSM_IMG}")` : "";
  }
  if (bsr) {
    bsr.hidden = !sp.blindspot_right;
    bsr.style.backgroundImage = sp.blindspot_right ? `url("${BSM_IMG}")` : "";
    bsr.style.transform = sp.blindspot_right ? "scaleX(-1)" : "";
  }

  const rocket = document.getElementById("hud-rocket");
  if (rocket && sp.rocket_fuel != null) {
    rocket.hidden = false;
    const pct = Math.round(sp.rocket_fuel * 100);
    rocket.style.setProperty("--rocket-pct", `${Math.abs(pct)}%`);
    rocket.classList.toggle("is-negative", pct < 0);
  } else if (rocket) {
    rocket.hidden = true;
  }

  const roadName = st.road_name_toggle ? sp.road_name : "";
  setText("hud-road-name", roadName);
  drawDmArc(st.dm_arc, hideDm, Number(st.developer_ui) || 0);
}

function updateSpeedLimit(sp) {
  const slaWrap = document.getElementById("hud-speed-limit-wrap");
  const limit = sp.speed_limit_resolver ?? sp.speed_limit;
  setText("hud-speed-limit", limit != null ? String(Math.round(limit)) : "");
  if (!slaWrap) return;

  const assistState = sp.speed_limit_assist_state || sp.speed_limit_assist || "";
  const preActive = assistState === "preActive" || sp.speed_limit_assist === "preActive";
  const assist = preActive || sp.speed_limit_assist_active;
  slaWrap.classList.toggle("opui-hud-sla--assist", assist);
  slaWrap.classList.toggle("opui-hud-sla--preactive", preActive);

  let ahead = document.getElementById("hud-speed-limit-ahead");
  if (!ahead && slaWrap.parentElement) {
    ahead = document.createElement("div");
    ahead.id = "hud-speed-limit-ahead";
    ahead.className = "opui-hud-sla-ahead";
    ahead.hidden = true;
    slaWrap.parentElement.appendChild(ahead);
  }
  if (ahead) {
    const showAhead = sp.speed_limit_ahead != null
      && limit != null
      && Math.round(sp.speed_limit_ahead) !== Math.round(limit);
    if (showAhead) {
      ahead.hidden = false;
      ahead.innerHTML = `<span class="opui-hud-sla-ahead__label">AHEAD</span>`
        + `<span class="opui-hud-sla-ahead__val">${Math.round(sp.speed_limit_ahead)}</span>`;
    } else {
      ahead.hidden = true;
    }
  }
}

function clearSpHud() {
  ["hud-speed-limit-wrap", "hud-blinker-l", "hud-blinker-r", "hud-bsl", "hud-bsr",
    "hud-rocket", "hud-road-name", "hud-scc-v", "hud-scc-m", "dm-arc-wrap"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
  document.getElementById("hud-speed-limit-ahead")?.setAttribute("hidden", "");
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
  const wrap = document.getElementById("hud-speed-limit-wrap");
  if (id === "hud-speed-limit" && wrap) {
    if (!text) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    if (el) el.textContent = text;
    return;
  }
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
  wrap.classList.toggle("opui-dm-wrap--dev-bottom", devUi === 2 || devUi === 3);

  const prob = Math.max(0, Math.min(1, dm.prob ?? 0));
  const fill = svg.querySelector(".dm-arc-fill");
  const hArc = svg.querySelector(".dm-arc-h");
  const vArc = svg.querySelector(".dm-arc-v");
  const len = 300;
  if (fill) {
    fill.setAttribute("stroke", dm.engaged ? "#1AF242" : "#8b8b8b");
    fill.setAttribute("stroke-dasharray", `${len * prob} ${len}`);
  }
  const pose = dm.pose || [0, 0, 0];
  const hx = Math.abs(pose[1] || 0);
  const vy = Math.abs(pose[0] || 0);
  if (hArc) hArc.setAttribute("stroke-dasharray", `${len * hx} ${len}`);
  if (vArc) vArc.setAttribute("stroke-dasharray", `${len * vy} ${len}`);
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
