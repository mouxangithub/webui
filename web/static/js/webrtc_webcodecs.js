/** Optional WebCodecs decode path for lower-latency WebRTC preview (Chrome / Edge). */

const WEBCODECS_PREF_KEY = "opui-webcodecs";

let activeCleanup = null;

export function getWebCodecsPreference() {
  const v = localStorage.getItem(WEBCODECS_PREF_KEY) || "auto";
  return ["auto", "on", "off"].includes(v) ? v : "auto";
}

export function setWebCodecsPreference(mode) {
  if (!["auto", "on", "off"].includes(mode)) return;
  localStorage.setItem(WEBCODECS_PREF_KEY, mode);
}

export function webCodecsCapable() {
  return typeof VideoDecoder !== "undefined"
    && typeof MediaStreamTrackGenerator !== "undefined"
    && typeof RTCRtpReceiver !== "undefined";
}

function shouldTryWebCodecs() {
  const pref = getWebCodecsPreference();
  if (pref === "off") return false;
  if (pref === "on") return webCodecsCapable();
  return webCodecsCapable();
}

function tuneReceiverLatency(receiver) {
  if (!receiver) return;
  try {
    if (typeof receiver.jitterBufferTarget !== "undefined") receiver.jitterBufferTarget = 0;
  } catch { /* ignore */ }
  try {
    if (typeof receiver.playoutDelayHint !== "undefined") receiver.playoutDelayHint = 0;
  } catch { /* ignore */ }
}

async function pumpEncodedFrames(readable, decoder) {
  const reader = readable.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      try {
        const chunk = new EncodedVideoChunk({
          type: value.type === "key" ? "key" : "delta",
          timestamp: value.timestamp,
          data: value.data,
        });
        if (decoder.state === "configured") decoder.decode(chunk);
      } finally {
        if (typeof value.close === "function") value.close();
      }
    }
  } catch {
    /* stream ended */
  } finally {
    reader.releaseLock();
  }
}

export async function tryAttachWebCodecsDecode(receiver, videoEl) {
  stopWebCodecsDecode();
  if (!shouldTryWebCodecs() || !receiver?.createEncodedStreams || !videoEl) return false;

  let decoder;
  let generator;
  let writer;
  let aborted = false;

  const cleanup = () => {
    aborted = true;
    try { decoder?.close(); } catch { /* ignore */ }
    try { writer?.close(); } catch { /* ignore */ }
    try { generator?.stop(); } catch { /* ignore */ }
    activeCleanup = null;
  };

  try {
    const { readable } = receiver.createEncodedStreams();
    generator = new MediaStreamTrackGenerator({ kind: "video" });
    writer = generator.writable.getWriter();

    decoder = new VideoDecoder({
      output(frame) {
        if (aborted) {
          frame.close();
          return;
        }
        writer.write(frame).catch(() => {}).finally(() => frame.close());
      },
      error() {
        cleanup();
      },
    });

    decoder.configure({
      codec: "avc1.42E01E",
      optimizeForLatency: true,
      hardwareAcceleration: "prefer-hardware",
    });

    pumpEncodedFrames(readable, decoder).catch(() => {});
    videoEl.srcObject = new MediaStream([generator]);
    videoEl.playsInline = true;
    videoEl.muted = true;
    tuneReceiverLatency(receiver);
    await videoEl.play().catch(() => {});

    activeCleanup = cleanup;
    return true;
  } catch (err) {
    console.warn("WebCodecs preview path unavailable:", err);
    cleanup();
    return false;
  }
}

export function stopWebCodecsDecode() {
  if (activeCleanup) activeCleanup();
}

export function tuneVideoReceiver(receiver) {
  tuneReceiverLatency(receiver);
}
