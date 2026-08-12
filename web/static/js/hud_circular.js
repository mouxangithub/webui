/** Circular E2E + standstill alerts (circular_alerts.py). */

import { tr } from "./i18n.js";

const E2E_HOLD_TICKS = 60;
const GREEN_IMG = "/api/opui/assets/sunnypilot/selfdrive/assets/images/green_light.png";
const DEPART_IMG = "/api/opui/assets/sunnypilot/selfdrive/assets/images/lead_depart.png";

let e2eTicks = 0;
let e2eKind = "";
let standstillElapsed = 0;
let lastStandstill = false;

export function updateCircularAlert(st) {
  const wrap = document.getElementById("hud-circular-alert");
  if (!wrap) return;

  if (!st?.started || !st.circular_alert_allowed) {
    wrap.hidden = true;
    e2eTicks = 0;
    e2eKind = "";
    standstillElapsed = 0;
    lastStandstill = false;
    return;
  }

  const sp = st.sp_hud || {};
  const green = !!sp.e2e_green_light;
  const depart = !!sp.e2e_lead_depart;

  if (green || depart) {
    e2eTicks = E2E_HOLD_TICKS;
    e2eKind = depart ? "depart" : "green";
  } else if (e2eTicks > 0) {
    e2eTicks -= 1;
  }

  const standstill = !!st.standstill;
  if (!standstill) {
    standstillElapsed = 0;
  } else if (st.standstill_timer_enabled && e2eTicks <= 0) {
    standstillElapsed += 0.05;
  }
  lastStandstill = standstill;

  const showE2e = e2eTicks > 0;
  const showStandstill = !showE2e && st.standstill_timer_enabled && standstill;

  if (!showE2e && !showStandstill) {
    wrap.hidden = true;
    return;
  }

  const devMode = Number(st.developer_ui) || 0;
  const devAdj = devMode === 2 || devMode === 3 ? 180 : 100;
  wrap.style.setProperty("--dev-ui-adj", `${devAdj}px`);
  wrap.hidden = false;
  wrap.classList.toggle("is-e2e", showE2e);
  wrap.classList.toggle("is-standstill", showStandstill);
  wrap.classList.toggle("is-pulse", showE2e && (Math.floor(performance.now() / 400) % 2 === 0));

  const img = document.getElementById("hud-circular-img");
  const text = document.getElementById("hud-circular-text");
  const stopped = document.getElementById("hud-circular-stopped");
  const timer = document.getElementById("hud-circular-timer");

  if (showE2e) {
    if (img) {
      img.hidden = false;
      img.src = e2eKind === "depart" ? DEPART_IMG : GREEN_IMG;
    }
    if (text) {
      text.hidden = false;
      text.textContent = e2eKind === "depart"
        ? tr("LEAD VEHICLE\nDEPARTING")
        : tr("GREEN\nLIGHT");
    }
    if (stopped) stopped.hidden = true;
    if (timer) timer.hidden = true;
  } else {
    if (img) img.hidden = true;
    if (text) text.hidden = true;
    if (stopped) {
      stopped.hidden = false;
      stopped.textContent = tr("STOPPED");
    }
    if (timer) {
      const minute = Math.floor(standstillElapsed / 60);
      const second = Math.floor(standstillElapsed % 60);
      timer.textContent = `${minute}:${String(second).padStart(2, "0")}`;
      timer.hidden = false;
    }
  }
}

export function clearCircularAlert() {
  const wrap = document.getElementById("hud-circular-alert");
  if (wrap) wrap.hidden = true;
  e2eTicks = 0;
  e2eKind = "";
  standstillElapsed = 0;
}
