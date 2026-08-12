/** Circular E2E + standstill alerts (circular_alerts.py). */

const E2E_HOLD_TICKS = 60;
const GREEN_IMG = "/api/opui/assets/sunnypilot/selfdrive/assets/images/green_light.png";
const DEPART_IMG = "/api/opui/assets/sunnypilot/selfdrive/assets/images/lead_depart.png";

let e2eTicks = 0;
let e2eKind = "";
let lastGreen = false;
let lastDepart = false;

export function updateCircularAlert(st) {
  const wrap = document.getElementById("hud-circular-alert");
  if (!wrap) return;

  if (!st?.started || !st.circular_alert_allowed) {
    wrap.hidden = true;
    e2eTicks = 0;
    e2eKind = "";
    lastGreen = false;
    lastDepart = false;
    return;
  }

  const sp = st.sp_hud || {};
  const green = !!sp.e2e_green_light;
  const depart = !!sp.e2e_lead_depart;

  if (green && !lastGreen) {
    e2eTicks = E2E_HOLD_TICKS;
    e2eKind = "green";
  } else if (depart && !lastDepart) {
    e2eTicks = E2E_HOLD_TICKS;
    e2eKind = "depart";
  }
  lastGreen = green;
  lastDepart = depart;
  if (e2eTicks > 0) e2eTicks -= 1;

  const showE2e = e2eTicks > 0;
  const showStandstill = !showE2e && st.standstill_timer_enabled && st.standstill;

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
      text.textContent = e2eKind === "depart" ? "LEAD VEHICLE\nDEPARTING" : "GREEN\nLIGHT";
    }
    if (stopped) stopped.hidden = true;
    if (timer) timer.hidden = true;
  } else {
    if (img) img.hidden = true;
    if (text) text.hidden = true;
    if (stopped) stopped.hidden = false;
    if (timer) {
      const seconds = Number(sp.standstill_timer);
      if (Number.isFinite(seconds) && seconds >= 0) {
        const minute = Math.floor(seconds / 60);
        const second = Math.floor(seconds % 60);
        timer.textContent = `${minute}:${String(second).padStart(2, "0")}`;
      } else {
        timer.textContent = "0:00";
      }
      timer.hidden = false;
    }
  }
}

export function clearCircularAlert() {
  const wrap = document.getElementById("hud-circular-alert");
  if (wrap) wrap.hidden = true;
  e2eTicks = 0;
  e2eKind = "";
}
