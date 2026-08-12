/** WebRTC livestream client — proxies SDP via webui, media to webrtcd on device. */



import { apiGet, apiPost } from "./api.js";

import { tr } from "./i18n.js";



export const CAM = {

  ROAD: "road",

  WIDE: "wideRoad",

  DRIVER: "driver",

};



/** Matches openpilot onroad wide/road hysteresis (m/s). */

const WIDE_MAX_MS = 10.0;

const ROAD_MIN_MS = 15.0;



const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };



let roadPc = null;

let roadStreaming = false;

let roadCamera = CAM.ROAD;

let driverViewActive = false;

let driverViewResumeCamera = CAM.ROAD;

let prewarmPromise = null;

let roadVideoBound = false;



function setCameraStatus(msg) {

  const fb = document.getElementById("camera-fallback");

  const text = document.getElementById("camera-status-text");

  if (!fb || !text) return;

  if (msg) {

    text.textContent = msg;

    fb.hidden = false;

  } else {

    fb.hidden = true;

  }

}



function bindRoadVideoPlayback(video, wrap) {

  if (!video || !wrap || roadVideoBound) return;

  roadVideoBound = true;

  const onPlaying = () => {

    wrap.classList.add("is-playing");

    setCameraStatus("");

  };

  const onWaiting = () => {

    if (roadStreaming && !driverViewActive) {

      wrap.classList.remove("is-playing");

      setCameraStatus(tr("Buffering camera…"));

    }

  };

  video.addEventListener("playing", onPlaying);

  video.addEventListener("waiting", onWaiting);

  video.addEventListener("emptied", () => wrap.classList.remove("is-playing"));

}



function setDriverLoading(msg) {

  const loading = document.getElementById("driver-cam-loading");

  if (!loading) return;

  loading.hidden = false;

  loading.textContent = msg || tr("camera starting");

}



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

    setTimeout(resolve, 2000);

  });

}



async function wakeWebrtcd() {

  await apiPost("/api/opui/action/webrtc_enable");

  await sleep(4000);

}



async function waitWebrtcdReady() {

  for (let i = 0; i < 40; i++) {

    const schema = await apiGet("/api/opui/webrtc/schema");

    if (schema.ok) return true;

    await sleep(500);

  }

  return false;

}



async function ensureWebrtcd() {

  if (await waitWebrtcdReady()) return;

  setCameraStatus(tr("Waking webrtcd…"));

  await wakeWebrtcd();

  if (await waitWebrtcdReady()) return;

  setCameraStatus(tr("Restarting webrtcd…"));

  await apiPost("/api/opui/action/webrtc_disable");

  await sleep(1000);

  await wakeWebrtcd();

  if (!(await waitWebrtcdReady())) {

    throw new Error("webrtcd not ready");

  }

}



/** Background warm-up after page load — avoids ~30s first SDP on user click. */

export function prewarmWebrtc() {

  if (prewarmPromise || roadStreaming) return prewarmPromise;

  prewarmPromise = (async () => {

    const boot = await apiGet("/api/opui/bootstrap").catch(() => ({}));

    if (boot.dev_pc) return;

    try {

      await ensureWebrtcd();

    } catch {

      prewarmPromise = null;

    }

  })();

  return prewarmPromise;

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

  if (!roadStreaming || driverViewActive) return;

  if (!st?.started) return;

  const target = pickRoadCamera(st);

  if (target !== roadCamera) {

    switchCamera(target).catch(() => {});

  }

}



async function createStream(videoEl, initCamera) {

  if (roadPc) {

    roadPc.close();

    roadPc = null;

  }

  roadStreaming = false;



  const pc = new RTCPeerConnection(ICE);

  pc.addTransceiver("video", { direction: "recvonly" });

  pc.ontrack = (ev) => {

    if (ev.streams?.[0] && videoEl) {

      videoEl.srcObject = ev.streams[0];

      videoEl.play().catch(() => {});

    }

  };

  pc.oniceconnectionstatechange = () => {

    const state = pc.iceConnectionState;

    if (state === "failed" || state === "disconnected") {

      setCameraStatus(tr("WebRTC connection failed ({})").replace("{}", state));

    }

  };



  const offer = await pc.createOffer();

  await pc.setLocalDescription(offer);

  await waitIceComplete(pc);



  const resp = await apiPost("/api/opui/webrtc/offer", {

    sdp: pc.localDescription.sdp,

    init_camera: initCamera,

  });

  if ((!resp.ok || !resp.sdp) && String(resp.error || "").includes("not running")) {

    await ensureWebrtcd();

    const retry = await apiPost("/api/opui/webrtc/offer", {

      sdp: pc.localDescription.sdp,

      init_camera: initCamera,

    });

    if (!retry.ok || !retry.sdp) {

      pc.close();

      throw new Error(retry.error || retry.message || "no SDP answer");

    }

    await pc.setRemoteDescription({ type: "answer", sdp: retry.sdp });

    return pc;

  }

  if (!resp.ok || !resp.sdp) {

    pc.close();

    throw new Error(resp.error || resp.message || "no SDP answer");

  }

  await pc.setRemoteDescription({ type: "answer", sdp: resp.sdp });

  return pc;

}



export function isRoadStreaming() {

  return roadStreaming;

}



export async function startRoadStream(videoEl, wrapEl) {

  const video = videoEl || document.getElementById("road-video");

  const wrap = wrapEl || document.getElementById("camera-wrap");

  if (!video) {

    throw new Error("road-video element missing");

  }

  bindRoadVideoPlayback(video, wrap);



  if (roadStreaming) {

    wrap?.classList.add("streaming");

    try { await video.play(); } catch { /* ignore */ }

    return;

  }



  const boot = await apiGet("/api/opui/bootstrap").catch(() => ({}));

  if (boot.dev_pc) {

    wrap?.classList.add("is-dev-pc");

    return;

  }



  setCameraStatus(tr("Starting camera service…"));

  await prewarmWebrtc();

  await ensureWebrtcd();

  setCameraStatus(tr("WebRTC negotiating (first time ~30s)…"));

  roadCamera = CAM.ROAD;

  roadPc = await createStream(video, roadCamera);

  roadStreaming = true;

  wrap?.classList.add("streaming");

  try { await video.play(); } catch { /* ignore */ }

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

  prewarmPromise = null;

  const video = videoEl || document.getElementById("road-video");

  const wrap = wrapEl || document.getElementById("camera-wrap");

  if (video) video.srcObject = null;

  wrap?.classList.remove("streaming", "is-onroad", "is-playing");

  setCameraStatus("");

  await apiPost("/api/opui/action/webrtc_disable");

}



async function switchToDriverCamera(driverVideoEl, st) {

  const roadVideo = document.getElementById("road-video");

  await apiPost("/api/opui/action/driver_view_enable");

  driverViewActive = true;

  driverViewResumeCamera = pickRoadCamera(st || {});

  setDriverLoading(tr("Switching to driver camera…"));

  await switchCamera(CAM.DRIVER);

  if (driverVideoEl && roadVideo?.srcObject) {

    driverVideoEl.srcObject = roadVideo.srcObject;

    await driverVideoEl.play().catch(() => {});

  }

}



export async function startDriverView(driverVideoEl, st) {

  const boot = await apiGet("/api/opui/bootstrap").catch(() => ({}));

  if (boot.dev_pc) return;



  if (roadStreaming && roadPc) {

    await switchToDriverCamera(driverVideoEl, st);

    return;

  }



  setDriverLoading(tr("Starting camera service…"));

  await prewarmWebrtc();

  await ensureWebrtcd();



  const roadVideo = document.getElementById("road-video");

  const wrap = document.getElementById("camera-wrap");

  if (st?.started && roadVideo && wrap) {

    setDriverLoading(tr("WebRTC negotiating…"));

    await startRoadStream(roadVideo, wrap);

    if (roadStreaming) {

      await switchToDriverCamera(driverVideoEl, st);

      return;

    }

  }



  setDriverLoading(tr("WebRTC negotiating (first time ~30s)…"));

  driverViewActive = true;

  roadPc = await createStream(driverVideoEl, CAM.DRIVER);

  roadStreaming = true;

  roadCamera = CAM.DRIVER;

  await apiPost("/api/opui/action/driver_view_enable");

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

  const loading = document.getElementById("driver-cam-loading");

  if (!video) return;

  setDriverLoading(tr("camera starting"));

  const onPlaying = () => {

    if (loading) loading.hidden = true;

    video.removeEventListener("playing", onPlaying);

    video.removeEventListener("loadeddata", onPlaying);

  };

  video.addEventListener("playing", onPlaying);

  video.addEventListener("loadeddata", onPlaying);

  await startDriverView(video, st);

  const roadVideo = document.getElementById("road-video");

  if (roadVideo?.srcObject && !video.srcObject) {

    video.srcObject = roadVideo.srcObject;

    await video.play().catch(() => {});

  }

  if (loading && video.readyState >= 2) loading.hidden = true;

}



export async function closeDriverCamera() {

  const dlg = document.getElementById("driver-camera-dialog");

  if (dlg?.open) dlg.close();

  await stopDriverView();

}

