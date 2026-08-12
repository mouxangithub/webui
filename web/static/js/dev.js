import { apiGet, apiPost } from "./api.js";
import { opuiWs } from "./ws.js";

function dispatchDevState(st) {
  if (!st?.ok) return;
  window.dispatchEvent(new CustomEvent("opui:dev-state", { detail: st }));
}

function applySimLocally(patch) {
  const base = opuiWs.lastState?.data || opuiWs.bootstrap?.state;
  if (!base?.ok) return null;
  const next = { ...base, ...patch };
  if (patch.started === false) {
    next.started = false;
    next.engaged = false;
    next.ui_status = "disengaged";
    next.is_offroad = true;
  } else if (patch.started === true) {
    next.is_offroad = false;
  }
  if ("engaged" in patch) {
    next.engaged = !!patch.engaged;
    next.ui_status = patch.ui_status || (patch.engaged ? "engaged" : "disengaged");
  }
  if (patch.experimental_mode !== undefined) {
    next.experimental_mode = !!patch.experimental_mode;
  }
  if (patch.recording_audio !== undefined) {
    next.recording_audio = !!patch.recording_audio;
  }
  if (patch.speed_kmh != null) {
    next.speed_kmh = patch.speed_kmh;
  }
  next.ok = true;
  dispatchDevState(next);
  return next;
}

export async function initDevPanel() {
  const meta = await apiGet("/api/opui/bootstrap");
  if (!meta.dev_pc) return;

  const panel = document.getElementById("dev-panel");
  if (!panel) return;
  panel.hidden = false;

  const started = document.getElementById("dev-started");
  const engaged = document.getElementById("dev-engaged");
  const experimental = document.getElementById("dev-experimental");
  const recording = document.getElementById("dev-recording");
  const speed = document.getElementById("dev-speed");
  const speedVal = document.getElementById("dev-speed-val");
  let speedTimer = null;

  function syncFormFromSim(s) {
    if (!s) return;
    if (started) started.checked = !!s.started;
    if (engaged) engaged.checked = !!s.engaged;
    if (experimental) experimental.checked = !!s.experimental_mode;
    if (recording) recording.checked = !!s.recording_audio;
    if (speed) speed.value = String(s.speed_kmh ?? 72);
    if (speedVal) speedVal.textContent = String(s.speed_kmh ?? 72);
  }

  async function syncFromServer() {
    const r = await apiGet("/api/opui/dev/simulation");
    if (!r.ok) return;
    syncFormFromSim(r.simulation);
    if (r.state) dispatchDevState(r.state);
  }

  async function pushPatch(patch, { optimistic = true } = {}) {
    if (optimistic) {
      applySimLocally(patch);
      if (started && patch.started === false && engaged) engaged.checked = false;
      if (engaged && patch.engaged === false) engaged.checked = false;
      if (engaged && patch.engaged === true) engaged.checked = true;
    }
    const r = await apiPost("/api/opui/dev/simulation", patch);
    if (r.ok) {
      syncFormFromSim(r.simulation);
      if (r.state) dispatchDevState(r.state);
    }
    return r;
  }

  panel.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const r = await apiPost(`/api/opui/dev/preset/${btn.dataset.preset}`);
      if (r.ok) {
        syncFormFromSim(r.simulation);
        if (r.state) dispatchDevState(r.state);
      }
    });
  });

  started?.addEventListener("change", () => {
    const patch = { started: started.checked };
    if (!started.checked) patch.engaged = false;
    pushPatch(patch);
  });
  engaged?.addEventListener("change", () => {
    pushPatch({
      engaged: engaged.checked,
      ui_status: engaged.checked ? "engaged" : "disengaged",
    });
  });
  experimental?.addEventListener("change", () => {
    pushPatch({ experimental_mode: experimental.checked });
  });
  recording?.addEventListener("change", () => {
    pushPatch({ recording_audio: recording.checked });
  });
  speed?.addEventListener("input", () => {
    const val = parseInt(speed.value, 10);
    if (speedVal) speedVal.textContent = String(val);
    applySimLocally({ speed_kmh: val });
    clearTimeout(speedTimer);
    speedTimer = setTimeout(() => pushPatch({ speed_kmh: val }, { optimistic: false }), 120);
  });

  await syncFromServer();
}
