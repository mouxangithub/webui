import { apiGet, apiPost } from "./api.js";

export async function initDevPanel() {
  const meta = await apiGet("/api/opui/bootstrap");
  if (!meta.dev_pc) return;

  const panel = document.getElementById("dev-panel");
  if (!panel) return;
  panel.hidden = false;

  const started = document.getElementById("dev-started");
  const engaged = document.getElementById("dev-engaged");
  const experimental = document.getElementById("dev-experimental");
  const speed = document.getElementById("dev-speed");
  const speedVal = document.getElementById("dev-speed-val");

  async function syncFromServer() {
    const r = await apiGet("/api/opui/dev/simulation");
    if (!r.ok) return;
    const s = r.simulation;
    if (started) started.checked = !!s.started;
    if (engaged) engaged.checked = !!s.engaged;
    if (experimental) experimental.checked = !!s.experimental_mode;
    if (speed) speed.value = String(s.speed_kmh ?? 72);
    if (speedVal) speedVal.textContent = String(s.speed_kmh ?? 72);
  }

  async function pushPatch(patch) {
    await apiPost("/api/opui/dev/simulation", patch);
  }

  panel.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await apiPost(`/api/opui/dev/preset/${btn.dataset.preset}`);
      await syncFromServer();
    });
  });

  started?.addEventListener("change", () => pushPatch({ started: started.checked }));
  engaged?.addEventListener("change", () => pushPatch({ engaged: engaged.checked, ui_status: engaged.checked ? "engaged" : "disengaged" }));
  experimental?.addEventListener("change", () => pushPatch({ experimental_mode: experimental.checked }));
  speed?.addEventListener("input", () => {
    if (speedVal) speedVal.textContent = speed.value;
    pushPatch({ speed_kmh: parseInt(speed.value, 10) });
  });

  await syncFromServer();
}
