import { apiGet, apiPut } from "./api.js";
import { tr } from "./i18n.js";
import { updateSpHud } from "./hud_sp.js";
import { updateDevUi } from "./hud_dev.js";
import { updateCircularAlert } from "./hud_circular.js";
import { updateTorqueBar } from "./hud_torque.js";
import {
  startRoadStream as startRoadWebrtc,
  stopRoadStream as stopRoadWebrtc,
  updateRoadCameraForState,
  openDriverCamera,
  closeDriverCamera,
  prewarmWebrtc,
  isRoadStreaming,
} from "./webrtc_stream.js?v=45";

const EXP_WHEEL_ICON = "/api/opui/assets/icons/chffr_wheel.png";
const EXP_MODE_ICON = "/api/opui/assets/icons/experimental.png";

/** ~3s hold at ~20Hz state push (matches hud_renderer SP icbm_active_counter). */
let icbmHoldTicks = 0;
const ICBM_HOLD_TICKS = 60;

let expHeldMode = null;
let expHoldUntil = 0;
let lastOnroadState = null;

export async function startRoadStream() {
  const video = document.getElementById("road-video");
  const wrap = document.getElementById("camera-wrap");
  const fb = document.getElementById("camera-fallback");
  try {
    if (fb) fb.hidden = false;
    await startRoadWebrtc(video, wrap);
    if (lastOnroadState) updateRoadCameraForState(lastOnroadState);
  } catch (err) {
    console.error("WebRTC:", err);
    if (fb) {
      const p = document.getElementById("camera-status-text") || fb.querySelector("p");
      if (p) p.textContent = `${tr("Camera unavailable")}: ${err.message}`;
      fb.hidden = false;
    }
    throw err;
  }
}

export async function stopRoadStream() {
  const video = document.getElementById("road-video");
  const wrap = document.getElementById("camera-wrap");
  await stopRoadWebrtc(video, wrap);
}

function applyCruiseStyle(st) {
  const cruise = document.getElementById("hud-set-speed");
  const cruiseMax = document.querySelector(".opui-hud-cruise-max");
  if (!cruise) return;

  const status = st.ui_status || "disengaged";
  const sp = st.sp_hud || {};
  const assistActive = !!sp.speed_limit_assist_active;
  const hasSet = st.set_speed != null && st.started;
  const pcmCruise = sp.pcm_cruise_speed !== false;
  const cluster = sp.cluster_speed;
  const clusterMismatch = hasSet && cluster != null
    && Math.round(st.set_speed) !== Math.round(cluster);

  if (!pcmCruise && clusterMismatch && st.car_control_enabled) {
    icbmHoldTicks = ICBM_HOLD_TICKS;
  } else if (icbmHoldTicks > 0) {
    icbmHoldTicks -= 1;
  }

  cruise.className = "opui-hud-cruise";
  if (hasSet) cruise.classList.add("is-set");
  if (assistActive) {
    cruise.classList.add("opui-hud-cruise--sla");
    if (sp.long_override) cruise.classList.add("is-override");
  } else if (hasSet) {
    cruise.classList.add(`opui-hud-cruise--${status}`);
  }

  if (cruiseMax) {
    const showIcbm = icbmHoldTicks > 0;
    cruiseMax.classList.toggle("is-icbm", showIcbm);
    cruiseMax.textContent = showIcbm ? String(Math.round(cluster)) : "MAX";
  }
}

function applyExperimentalButton(st) {
  const expBtn = document.getElementById("btn-experimental");
  const expIcon = document.getElementById("exp-icon");
  if (!expBtn || !expIcon) return;

  const show = !!st.started;
  expBtn.hidden = !show;

  const canToggle = !!st.experimental_mode_confirmed && !!st.has_longitudinal_control;
  const engageable = !!st.engageable || !!st.engaged;
  expBtn.classList.toggle("is-engageable", engageable);
  expBtn.classList.toggle("is-disabled", !canToggle);
  expBtn.disabled = !canToggle;

  const now = performance.now();
  let mode = !!st.experimental_mode;
  if (expHoldUntil > now && expHeldMode !== null) {
    mode = expHeldMode;
  } else if (expHoldUntil) {
    expHeldMode = null;
    expHoldUntil = 0;
  }
  expIcon.src = mode ? EXP_MODE_ICON : EXP_WHEEL_ICON;
  expBtn.classList.toggle("is-pressed", !engageable || expBtn.matches(":active"));
}

export function updateOnroadHud(st) {
  if (!st?.ok) return;
  lastOnroadState = st;
  updateRoadCameraForState(st);

  const hud = document.getElementById("hud");
  const speedEl = document.getElementById("hud-speed");
  const unitEl = document.getElementById("hud-unit");
  const setSpeedWrap = document.getElementById("hud-set-speed");
  const setSpeedVal = document.getElementById("set-speed-val");
  const alertBar = document.getElementById("alert-bar");
  const alertT1 = document.getElementById("alert-text1");
  const alertT2 = document.getElementById("alert-text2");
  const border = document.getElementById("border");
  const cameraWrap = document.getElementById("camera-wrap");
  const app = document.getElementById("app");

  if (app) app.dataset.metric = st.is_metric === false ? "0" : "1";
  if (hud) hud.classList.toggle("is-engaged", st.ui_status === "engaged");
  cameraWrap?.classList.toggle("is-onroad", !!st.started);

  const hideSpeed = !!st.hide_v_ego_ui;
  if (speedEl) {
    if (hideSpeed || st.speed == null) {
      speedEl.textContent = "";
      speedEl.hidden = true;
    } else {
      speedEl.hidden = false;
      speedEl.textContent = String(st.speed);
    }
  }
  if (unitEl) {
    if (hideSpeed) {
      unitEl.hidden = true;
    } else {
      unitEl.hidden = false;
      unitEl.textContent = st.unit || (st.is_metric === false ? "mph" : "km/h");
    }
  }

  const cruiseAvailable = st.is_cruise_available !== false;
  if (st.started && setSpeedWrap && setSpeedVal && cruiseAvailable) {
    setSpeedWrap.hidden = false;
    setSpeedVal.textContent = st.is_cruise_set && st.set_speed != null
      ? String(st.set_speed) : "–";
  } else if (setSpeedWrap) {
    setSpeedWrap.hidden = true;
  }

  applyCruiseStyle(st);
  applyExperimentalButton(st);

  if (border) {
    const inner = border.querySelector(".opui-border__inner");
    if (inner) {
      inner.className = `opui-border__inner opui-border--${st.ui_status || "disengaged"}`;
    }
  }

  if (alertBar && alertT1) {
    const t1 = st.alert?.text1 || "";
    const t2 = st.alert?.text2 || "";
    const size = (st.alert?.size || "").toLowerCase();
    if (t1 && st.started && size !== "none") {
      alertBar.hidden = false;
      alertT1.textContent = t1;
      if (alertT2) {
        alertT2.textContent = t2;
        alertT2.hidden = !t2 || size === "small";
      }
      alertBar.classList.remove("opui-alert--small", "opui-alert--mid", "opui-alert--full");
      if (size === "full") alertBar.classList.add("opui-alert--full");
      else if (size === "small") alertBar.classList.add("opui-alert--small");
      else alertBar.classList.add("opui-alert--mid");
      const heightPx = Number(st.alert?.height_px);
      if (heightPx > 0) {
        alertBar.style.minHeight = `${heightPx}px`;
      } else {
        alertBar.style.minHeight = "";
      }
      if (size === "full") {
        const t1Len = (t1 || "").length;
        alertBar.style.setProperty("--alert-title-size", t1Len > 15 ? "132px" : "177px");
        alertBar.style.setProperty("--alert-title-top", t1Len > 15 ? "200px" : "140px");
      } else {
        alertBar.style.removeProperty("--alert-title-size");
        alertBar.style.removeProperty("--alert-title-top");
      }
      alertBar.style.background = "";
      const status = (st.alert?.status || "normal").toLowerCase();
      if (status.includes("critical")) alertBar.dataset.status = "critical";
      else if (status.includes("user")) alertBar.dataset.status = "user";
      else alertBar.dataset.status = "normal";
    } else {
      alertBar.hidden = true;
      alertBar.classList.remove("opui-alert--small", "opui-alert--mid", "opui-alert--full");
      delete alertBar.dataset.status;
    }
    const devMode = Number(st.developer_ui) || 0;
    const isFull = size === "full";
    if (!isFull && devMode) {
      alertBar.style.right = (devMode === 1 || devMode === 3)
        ? "calc(var(--border-w) + var(--alert-margin) + 230px)" : "";
      alertBar.style.bottom = (devMode === 2 || devMode === 3)
        ? "calc(var(--border-w) + var(--alert-margin) + 40px)" : "";
    } else {
      alertBar.style.right = "";
      alertBar.style.bottom = "";
    }
  }

  updateSpHud(st);
  updateDevUi(st);
  updateCircularAlert(st);
  updateTorqueBar(st);
  updateDriverCameraOverlay(st);
}

function updateDriverCameraOverlay(st) {
  const dlg = document.getElementById("driver-camera-dialog");
  if (!dlg?.open) return;

  const loading = document.getElementById("driver-cam-loading");
  const video = document.getElementById("driver-video");
  const face = document.getElementById("driver-face-box");
  if (!loading || !video || !face) return;

  const hasFrame = video.readyState >= 2 && !video.paused;
  loading.hidden = hasFrame;
  loading.textContent = tr("camera starting");

  const df = st?.driver_face;
  if (!hasFrame || !df?.visible || !df.box) {
    face.hidden = true;
    return;
  }

  const vw = video.videoWidth || df.source_size?.w || 1928;
  const vh = video.videoHeight || df.source_size?.h || 1208;
  const rect = video.getBoundingClientRect();
  const scaleX = rect.width / vw;
  const scaleY = rect.height / vh;
  const box = df.box;
  const size = (box.size || 220) * Math.min(scaleX, scaleY);
  const left = (box.x || 0) * scaleX;
  const top = (box.y || 0) * scaleY;

  face.hidden = false;
  face.style.width = `${size}px`;
  face.style.height = `${size}px`;
  face.style.left = `${left}px`;
  face.style.top = `${top}px`;
  face.style.opacity = String(df.alpha ?? 0.7);
}

export function bindExperimentalButton() {
  document.getElementById("btn-experimental")?.addEventListener("click", async () => {
    const boot = await apiGet("/api/opui/bootstrap").catch(() => ({}));
    const st = boot?.state || lastOnroadState || {};
    if (!st.experimental_mode_confirmed || !st.has_longitudinal_control) return;
    const cur = !!st.experimental_mode;
    const next = !cur;
    await apiPut("/api/opui/params/ExperimentalMode", { value: next ? "1" : "0" });
    expHeldMode = next;
    expHoldUntil = performance.now() + 2000;
    applyExperimentalButton({ ...st, experimental_mode: next });
    updateRoadCameraForState({ ...st, experimental_mode: next });
  });
}

export function bindDriverCameraDialog() {
  const dlg = document.getElementById("driver-camera-dialog");
  if (!dlg) return;

  const video = document.getElementById("driver-video");
  const loading = document.getElementById("driver-cam-loading");
  const onVideoFrame = () => {
    if (loading) loading.hidden = true;
    if (lastOnroadState) updateDriverCameraOverlay(lastOnroadState);
  };
  video?.addEventListener("loadeddata", onVideoFrame);
  video?.addEventListener("playing", onVideoFrame);

  window.addEventListener("opui:open-driver-camera", async () => {
    try {
      if (loading) {
        loading.hidden = false;
        loading.textContent = tr("camera starting");
      }
      if (!dlg.open) dlg.showModal();
      await openDriverCamera(lastOnroadState);
    } catch (err) {
      console.warn("Driver camera:", err);
      if (loading) loading.textContent = String(err.message || err);
    }
  });

  const onClose = () => closeDriverCamera().catch(() => {});
  document.getElementById("driver-cam-close")?.addEventListener("click", () => dlg.close());
  dlg.addEventListener("close", onClose);
  dlg.addEventListener("click", (ev) => {
    if (ev.target === dlg) dlg.close();
  });
}

export { prewarmWebrtc, isRoadStreaming };
