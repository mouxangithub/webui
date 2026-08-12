/** WebRTC livestream client — proxies SDP via webui, media to webrtcd on device. */

import { apiGet, apiPost } from "./api.js";

export const CAM = {
  ROAD: "road",
  WIDE: "wideRoad",
  DRIVER: "driver",
};

const WIDE_MAX_MS = 10.0;
const ROAD_MIN_MS = 15.0;

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

let roadPc = null;
let roadStreaming = false;
let roadCamera = CAM.ROAD;
let driverViewActive = false;
let driverViewResumeCamera = CAM.ROAD;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

async function waitWebrtcdReady() {
  for (let i = 0; i < 30; i++) {
    const schema = await apiGet("/api/opui/webrtc/schema");
    if (schema.ok) return true;
    await sleep(500);
  }
  return false;
}

export async function notifyWebrtc(payload) {
  return apiPost("/api/opui/webrtc/notify", payload);
}

export async function switchCamera(camera) {
  if (!roadStreaming) return { ok: false, error: "not streaming" };
  const res = await notifyWebrtc({
    type: "livestreamCameraSwitch",
    data: { camera },
  });
  if (res.ok) roadCamera = camera;
  return res;
}

function pickRoadCamera(st) {
  if (!st?.experimental_mode) return CAM.ROAD;
  const v = Number(st.speed_raw);
  if (!Number.isFinite(v)) return roadCamera || CAM.ROAD;
  if (v < WIDE_MAX_MS) return CAM.WIDE;
  if (v > ROAD_MIN_MS) return CAM.ROAD;
  return roadCamera || CAM.ROAD;
}

export function updateRoadCameraForState(st) {
  if (!roadStreaming || driverViewActive || !st?.started) return;
  const target = pickRoadCamera(st);
  if (target !== roadCamera) {
    switchCamera(target).catch(() => {});
  }
}

async function createStream(videoEl, initCamera) {
  const pc = new RTCPeerConnection(ICE);
  pc.addTransceiver("video", { direction: "recvonly" });
  pc.ontrack = (ev) => {
    if (ev.streams?.[0] && videoEl) {
      videoEl.srcObject = ev.streams[0];
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitIceComplete(pc);

  const resp = await apiPost("/api/opui/webrtc/offer", {
    sdp: pc.localDescription.sdp,
    init_camera: initCamera,
  });
  if (!resp.ok || !resp.sdp) {
    pc.close();
    throw new Error(resp.error || "no SDP answer");
  }
  await pc.setRemoteDescription({ type: "answer", sdp: resp.sdp });
  return pc;
}

export function isRoadStreaming() {
  return roadStreaming;
}

export async function startRoadStream(videoEl, wrapEl) {
  if (!videoEl || roadStreaming) return;

  const boot = await apiGet("/api/opui/bootstrap").catch(() => ({}));
  if (boot.dev_pc) {
    wrapEl?.classList.add("is-dev-pc");
    return;
  }

  await apiPost("/api/opui/action/webrtc_enable");
  if (!(await waitWebrtcdReady())) {
    throw new Error("webrtcd not ready");
  }

  roadCamera = CAM.ROAD;
  roadPc = await createStream(videoEl, roadCamera);
  roadStreaming = true;
  wrapEl?.classList.add("streaming");
}

export async function stopRoadStream(videoEl, wrapEl) {
  if (driverViewActive) {
    await stopDriverView();
  }
  if (roadPc) {
    roadPc.close();
    roadPc = null;
  }
  roadStreaming = false;
  roadCamera = CAM.ROAD;
  if (videoEl) videoEl.srcObject = null;
  wrapEl?.classList.remove("streaming", "is-onroad");
  await apiPost("/api/opui/action/webrtc_disable");
}

export async function startDriverView(driverVideoEl, st) {
  const boot = await apiGet("/api/opui/bootstrap").catch(() => ({}));
  if (boot.dev_pc) return;

  await apiPost("/api/opui/action/driver_view_enable");

  if (roadStreaming) {
    driverViewActive = true;
    driverViewResumeCamera = pickRoadCamera(st || {});
    await switchCamera(CAM.DRIVER);
    if (driverVideoEl && roadPc) {
      driverVideoEl.srcObject = document.getElementById("road-video")?.srcObject || null;
    }
    return;
  }

  await apiPost("/api/opui/action/webrtc_enable");
  if (!(await waitWebrtcdReady())) {
    throw new Error("webrtcd not ready");
  }
  driverViewActive = true;
  roadPc = await createStream(driverVideoEl, CAM.DRIVER);
  roadStreaming = true;
  roadCamera = CAM.DRIVER;
}

export async function stopDriverView() {
  if (!driverViewActive) return;

  const driverVideo = document.getElementById("driver-video");
  if (driverVideo) driverVideo.srcObject = null;

  const onroad = document.getElementById("camera-wrap")?.classList.contains("is-onroad");
  if (onroad && roadStreaming) {
    await switchCamera(driverViewResumeCamera || CAM.ROAD);
    driverViewActive = false;
    await apiPost("/api/opui/action/driver_view_disable");
    return;
  }

  if (roadPc) {
    roadPc.close();
    roadPc = null;
  }
  roadStreaming = false;
  roadCamera = CAM.ROAD;
  driverViewActive = false;
  await apiPost("/api/opui/action/webrtc_disable");
  await apiPost("/api/opui/action/driver_view_disable");
}

export async function openDriverCamera(st) {
  const video = document.getElementById("driver-video");
  if (!video) return;
  await startDriverView(video, st);
  const roadVideo = document.getElementById("road-video");
  if (roadVideo?.srcObject && !video.srcObject) {
    video.srcObject = roadVideo.srcObject;
  }
}

export async function closeDriverCamera() {
  const dlg = document.getElementById("driver-camera-dialog");
  if (dlg?.open) dlg.close();
  await stopDriverView();
}
