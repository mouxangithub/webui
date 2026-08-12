/** sunnypilot onroad HUD extensions (speed limit, road name, blinkers, DM arc, rocket fuel). */

let standstillElapsed = 0;
let lastStandstillTs = 0;

export function updateSpHud(st) {
  const hud = document.getElementById("hud");
  if (!hud || !st?.started) return;

  const sp = st.sp_hud || {};
  const slaWrap = document.getElementById("hud-speed-limit-wrap");
  setText("hud-speed-limit", sp.speed_limit != null ? String(Math.round(sp.speed_limit)) : "");
  if (slaWrap) {
    slaWrap.classList.toggle("opui-hud-sla--assist", sp.speed_limit_assist === "preActive");
  }

  updateStandstillTimer(st);

  const blinkL = document.getElementById("hud-blinker-l");
  const blinkR = document.getElementById("hud-blinker-r");
  if (blinkL) blinkL.hidden = !sp.turn_signal_left;
  if (blinkR) blinkR.hidden = !sp.turn_signal_right;

  const bsl = document.getElementById("hud-bsl");
  const bsr = document.getElementById("hud-bsr");
  if (bsl) bsl.hidden = !sp.blindspot_left;
  if (bsr) bsr.hidden = !sp.blindspot_right;

  const rocket = document.getElementById("hud-rocket");
  if (rocket && sp.rocket_fuel != null) {
    rocket.hidden = false;
    rocket.style.setProperty("--rocket-pct", `${Math.round(sp.rocket_fuel * 100)}%`);
  } else if (rocket) {
    rocket.hidden = true;
  }

  setText("hud-road-name", sp.road_name);
  drawDmArc(st.dm_arc);
}

function updateStandstillTimer(st) {
  const wrap = document.getElementById("hud-standstill");
  const timerEl = document.getElementById("hud-standstill-timer");
  if (!wrap || !timerEl) return;

  const enabled = st.standstill_timer_enabled && st.standstill;
  if (!enabled) {
    wrap.hidden = true;
    standstillElapsed = 0;
    lastStandstillTs = 0;
    return;
  }

  const now = performance.now();
  if (lastStandstillTs > 0) {
    standstillElapsed += (now - lastStandstillTs) / 1000;
  }
  lastStandstillTs = now;

  const minute = Math.floor(standstillElapsed / 60);
  const second = Math.floor(standstillElapsed - minute * 60);
  timerEl.textContent = `${minute}:${String(second).padStart(2, "0")}`;
  wrap.hidden = false;
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

function drawDmArc(dm) {
  const svg = document.getElementById("dm-arc");
  if (!svg) return;
  if (!dm?.visible) {
    svg.hidden = true;
    return;
  }
  svg.hidden = false;
  svg.classList.toggle("opui-dm-arc--rhd", !!dm.rhd);
  const prob = Math.max(0, Math.min(1, dm.prob ?? 0));
  const fill = svg.querySelector(".dm-arc-fill");
  const hArc = svg.querySelector(".dm-arc-h");
  const vArc = svg.querySelector(".dm-arc-v");
  const len = 220;
  if (fill) {
    fill.setAttribute("stroke", dm.engaged ? "#1AF242" : "#919b95");
    fill.setAttribute("stroke-dasharray", `${len * prob} ${len}`);
  }
  const pose = dm.pose || [0, 0, 0];
  const hx = Math.abs(pose[1] || 0);
  const vy = Math.abs(pose[0] || 0);
  if (hArc) hArc.setAttribute("stroke-dasharray", `${len * hx} ${len}`);
  if (vArc) vArc.setAttribute("stroke-dasharray", `${len * vy} ${len}`);
}
