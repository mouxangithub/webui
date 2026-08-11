import { apiGet, apiPost } from "./api.js";

let pc = null;
let streaming = false;

export async function startRoadStream() {
  const video = document.getElementById("road-video");
  const wrap = document.getElementById("camera-wrap");
  if (!video || streaming) return;

  await apiPost("/api/opui/action/webrtc_enable");

  // Wait for webrtcd
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
  document.getElementById("camera-wrap")?.classList.remove("streaming");
  await apiPost("/api/opui/action/webrtc_disable");
}

export function updateOnroadHud(st) {
  if (!st?.ok) return;

  const speedEl = document.getElementById("hud-speed");
  const unitEl = document.getElementById("hud-unit");
  const setSpeedWrap = document.getElementById("hud-set-speed");
  const setSpeedVal = document.getElementById("set-speed-val");
  const setSpeedUnit = document.getElementById("set-speed-unit");
  const expBtn = document.getElementById("btn-experimental");
  const alertBar = document.getElementById("alert-bar");
  const alertT1 = document.getElementById("alert-text1");
  const alertT2 = document.getElementById("alert-text2");
  const border = document.getElementById("border");

  if (speedEl) speedEl.textContent = String(st.speed ?? 0);
  if (unitEl) unitEl.textContent = st.unit || "km/h";
  if (setSpeedUnit) setSpeedUnit.textContent = st.unit || "km/h";

  if (st.set_speed != null && setSpeedWrap && setSpeedVal) {
    setSpeedWrap.hidden = false;
    setSpeedVal.textContent = String(st.set_speed);
  } else if (setSpeedWrap) {
    setSpeedWrap.hidden = true;
  }

  if (expBtn) {
    expBtn.hidden = !st.experimental_mode;
    expBtn.classList.toggle("active", st.experimental_mode);
  }

  if (border) {
    border.className = "opui-border";
    const status = st.ui_status || "disengaged";
    border.classList.add(`opui-border--${status}`);
  }

  if (alertBar && alertT1) {
    const t1 = st.alert?.text1 || "";
    const t2 = st.alert?.text2 || "";
    if (t1 && st.started) {
      alertBar.hidden = false;
      alertT1.textContent = t1;
      if (alertT2) alertT2.textContent = t2;
      const status = (st.alert?.status || "").toLowerCase();
      if (status.includes("critical")) alertBar.style.background = "var(--alert-critical)";
      else if (status.includes("user")) alertBar.style.background = "var(--alert-user)";
      else alertBar.style.background = "var(--alert-normal)";
    } else {
      alertBar.hidden = true;
    }
  }

  updateMetrics(st);
}

function updateMetrics(st) {
  const metrics = document.getElementById("metrics");
  if (!metrics) return;

  const d = st.device || {};
  const items = [
    { label: "NET", value: d.network_type || "--", warn: false },
    { label: "TEMP", value: d.cpu_temp != null ? `${d.cpu_temp}°C` : d.thermal || "--", warn: d.thermal === "yellow", danger: d.thermal === "red" },
    { label: "CONNECT", value: d.athena_status || "OFFLINE", warn: !d.athena_status?.includes("CONNECTED") },
    { label: "VEHICLE", value: d.panda_online ? "ONLINE" : "OFFLINE", danger: !d.panda_online },
  ];

  if (d.sunnylink_ping) {
    items.push({ label: "SUNNYLINK", value: d.sunnylink_ping.slice(0, 16) });
  }

  metrics.innerHTML = items.map((m) => `
    <div class="opui-metric${m.danger ? " opui-metric--danger" : m.warn ? " opui-metric--warn" : ""}">
      <div class="opui-metric-label">${m.label}</div>
      <div class="opui-metric-value">${m.value}</div>
    </div>`).join("");
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
