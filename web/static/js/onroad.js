import { apiGet, apiPost, apiPut } from "./api.js";
import { updateSpHud } from "./hud_sp.js";
import { updateDevUi } from "./hud_dev.js";
import { updateCircularAlert } from "./hud_circular.js";
import { updateTorqueBar } from "./hud_torque.js";

let pc = null;
let streaming = false;

const EXP_WHEEL_ICON = "/api/opui/assets/icons/chffr_wheel.png";
const EXP_MODE_ICON = "/api/opui/assets/icons/experimental.png";

/** ~3s hold at ~20Hz state push (matches hud_renderer SP icbm_active_counter). */
let icbmHoldTicks = 0;
const ICBM_HOLD_TICKS = 60;

let expHeldMode = null;
let expHoldUntil = 0;

export async function startRoadStream() {
  const video = document.getElementById("road-video");
  const wrap = document.getElementById("camera-wrap");
  if (!video || streaming) return;

  const boot = await apiGet("/api/opui/bootstrap").catch(() => ({}));
  if (boot.dev_pc) {
    wrap?.classList.add("is-dev-pc");
    return;
  }

  await apiPost("/api/opui/action/webrtc_enable");
  for (let i = 0; i < 20; i++) {
    const schema = await apiGet("/api/opui/webrtc/schema");
    if (schema.ok) break;
    await sleep(500);
  }

  try {
    pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.ontrack = (ev) => {
      if (ev.streams?.[0]) {
        video.srcObject = ev.streams[0];
        wrap?.classList.add("streaming");
        streaming = true;
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIceComplete(pc);

    const resp = await apiPost("/api/opui/webrtc/offer", {
      sdp: pc.localDescription.sdp,
      init_camera: "roadCameraState",
    });

    if (!resp.ok || !resp.sdp) {
      throw new Error(resp.error || "no SDP answer");
    }

    await pc.setRemoteDescription({ type: "answer", sdp: resp.sdp });
  } catch (err) {
    console.warn("WebRTC:", err);
    const fb = document.getElementById("camera-fallback");
    if (fb) {
      const p = fb.querySelector("p");
      if (p) p.textContent = `相机不可用: ${err.message}`;
    }
  }
}

export async function stopRoadStream() {
  if (pc) {
    pc.close();
    pc = null;
  }
  streaming = false;
  const video = document.getElementById("road-video");
  if (video) video.srcObject = null;
  document.getElementById("camera-wrap")?.classList.remove("streaming", "is-onroad");
  await apiPost("/api/opui/action/webrtc_disable");
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

  if (!pcmCruise && clusterMismatch && (st.engaged || status === "engaged")) {
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

  if (speedEl) speedEl.textContent = String(st.speed ?? 0);
  if (unitEl) {
    unitEl.textContent = st.is_metric === false ? "mph" : "Km/h";
  }

  if (st.started && setSpeedWrap && setSpeedVal) {
    setSpeedWrap.hidden = false;
    setSpeedVal.textContent = st.set_speed != null ? String(st.set_speed) : "–";
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
      alertBar.style.minHeight = "";
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
  }

  updateSpHud(st);
  updateDevUi(st);
  updateCircularAlert(st);
  updateTorqueBar(st);
}

function waitIceComplete(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
    setTimeout(resolve, 3000);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function bindStreamButton() {
  document.getElementById("btn-start-stream")?.addEventListener("click", () => startRoadStream());
}

export function bindExperimentalButton() {
  document.getElementById("btn-experimental")?.addEventListener("click", async () => {
    const boot = await apiGet("/api/opui/bootstrap").catch(() => ({}));
    const st = boot?.state || {};
    if (!st.experimental_mode_confirmed || !st.has_longitudinal_control) return;
    const cur = !!st.experimental_mode;
    const next = !cur;
    await apiPut("/api/opui/params/ExperimentalMode", { value: next ? "1" : "0" });
    expHeldMode = next;
    expHoldUntil = performance.now() + 2000;
    applyExperimentalButton({ ...st, experimental_mode: next });
  });
}
