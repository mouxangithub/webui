/** Offroad onboarding — terms, sunnylink consent, training. */

import { tr } from "./i18n.js";
import { apiGet, apiPut } from "./api.js";
import { showConfirm } from "./components.js";

const TRAINING_STEPS = 18;

let bound = false;

function syncOnboardingI18n() {
  const welcome = document.getElementById("onboarding-welcome-title");
  const termsDesc = document.getElementById("onboarding-terms-desc");
  const declineText = document.getElementById("onboarding-decline-text");
  const sunnyTitle = document.getElementById("onboarding-sunnylink-title");
  const sunnyDesc = document.getElementById("onboarding-sunnylink-desc");
  if (welcome) welcome.textContent = tr("Welcome to sunnypilot");
  if (termsDesc) {
    termsDesc.textContent = tr(
      "You must accept the Terms of Service to use sunnypilot. Read the latest terms at https://sunnypilot.ai/terms before continuing.",
    );
  }
  if (declineText) {
    declineText.textContent = tr("You must accept the Terms of Service in order to use sunnypilot.");
  }
  if (sunnyTitle) sunnyTitle.textContent = tr("sunnylink");
  if (sunnyDesc) {
    sunnyDesc.textContent = tr(
      "sunnylink enables secured remote access to your comma device. You may accept to enable sunnylink or decline to continue without it.",
    );
  }
  const map = [
    ["onboarding-decline-btn", "Decline"],
    ["onboarding-accept", "Agree"],
    ["onboarding-sunnylink-decline", "Decline"],
    ["onboarding-sunnylink-accept", "Agree"],
    ["onboarding-training-skip", "Skip"],
    ["onboarding-training-next", "Next"],
    ["onboarding-decline-back", "Back"],
    ["onboarding-uninstall", "Decline, uninstall sunnypilot"],
  ];
  for (const [id, key] of map) {
    const el = document.getElementById(id);
    if (el) el.textContent = tr(key);
  }
}

export async function fetchOnboardingStatus() {
  try {
    const data = await apiGet("/api/opui/onboarding");
    if (data?.ok) return data;
  } catch (_) { /* fall through */ }
  return {
    ok: true,
    completed: true,
    terms_accepted: true,
    sunnylink_consent_done: true,
    training_completed: true,
  };
}

export async function initOnboarding() {
  if (bound) return;
  bound = true;

  const dlg = document.getElementById("onboarding-dialog");
  if (!dlg) return;

  const status = await fetchOnboardingStatus();
  if (status.completed) return;

  syncOnboardingI18n();
  let phase = status.phase || "terms";
  if (phase === "done") return;
  showOnboardingStep(phase);
  if (!dlg.open) dlg.showModal();
}

function showOnboardingStep(phase) {
  const terms = document.getElementById("onboarding-terms");
  const sunnylink = document.getElementById("onboarding-sunnylink");
  const training = document.getElementById("onboarding-training");
  const decline = document.getElementById("onboarding-decline");
  if (!terms || !training || !decline) return;

  terms.hidden = phase !== "terms";
  if (sunnylink) sunnylink.hidden = phase !== "sunnylink";
  training.hidden = phase !== "training";
  decline.hidden = phase !== "decline";

  if (phase === "training") {
    bindTrainingNav();
  }
}

async function finishTraining() {
  await apiPut("/api/opui/onboarding/complete", { phase: "training" });
  document.getElementById("onboarding-dialog")?.close();
  const enable = await showConfirm({
    message: tr("Upload driver camera data to improve driver monitoring? You can change this later in Toggles."),
    confirmText: tr("Enable"),
    cancelText: tr("Not now"),
  });
  if (enable) {
    await apiPut("/api/opui/params/RecordFront", { value: "1", needs_cycle: true });
  }
}

function bindTrainingNav() {
  const img = document.getElementById("onboarding-training-img");
  const bar = document.getElementById("onboarding-training-progress");
  const stepEl = document.getElementById("onboarding-training-step");
  if (!img || img.dataset.bound) return;
  img.dataset.bound = "1";

  let step = 0;
  const sync = () => {
    const n = step + 1;
    img.src = `/api/opui/assets/selfdrive/assets/training/step${n}.png`;
    if (bar) bar.style.width = `${Math.round((step / (TRAINING_STEPS - 1)) * 100)}%`;
    if (stepEl) stepEl.textContent = `${n} / ${TRAINING_STEPS}`;
  };
  sync();

  document.getElementById("onboarding-training-next")?.addEventListener("click", async () => {
    if (step < TRAINING_STEPS - 1) {
      step += 1;
      sync();
      return;
    }
    await finishTraining();
  });

  document.getElementById("onboarding-training-skip")?.addEventListener("click", async () => {
    await finishTraining();
  });
}

async function afterOnboardingStep(res) {
  if (res?.completed) {
    document.getElementById("onboarding-dialog")?.close();
    return;
  }
  showOnboardingStep(res?.phase || "training");
}

export function bindOnboardingDialog() {
  window.addEventListener("opui:language-changed", syncOnboardingI18n);

  document.getElementById("onboarding-accept")?.addEventListener("click", async () => {
    const res = await apiPut("/api/opui/onboarding/accept_terms", {});
    await afterOnboardingStep(res);
  });

  document.getElementById("onboarding-sunnylink-accept")?.addEventListener("click", async () => {
    const res = await apiPut("/api/opui/onboarding/sunnylink", { accept: true });
    await afterOnboardingStep(res);
  });

  document.getElementById("onboarding-sunnylink-decline")?.addEventListener("click", async () => {
    const res = await apiPut("/api/opui/onboarding/sunnylink", { accept: false });
    await afterOnboardingStep(res);
  });

  document.getElementById("onboarding-decline-btn")?.addEventListener("click", () => {
    showOnboardingStep("decline");
  });

  document.getElementById("onboarding-decline-back")?.addEventListener("click", () => {
    showOnboardingStep("terms");
  });

  document.getElementById("onboarding-uninstall")?.addEventListener("click", async () => {
    await apiPut("/api/opui/params/DoUninstall", { value: "1" });
  });
}
