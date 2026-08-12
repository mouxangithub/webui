/** Offroad home layout — Prime card, experimental banner, Firehose setup. */

import { tr } from "./i18n.js";

function assetUrl(rel) {
  return `/api/opui/assets/${rel.replace(/^\//, "")}`;
}

const PRIME_FEATURES = [
  "Remote access",
  "24/7 LTE connectivity",
  "1 year of drive storage",
  "Remote snapshots",
];

const HOME_SKELETON = `
  <div class="opui-home-skeleton">
    <div class="opui-home-skeleton-bar"></div>
    <div class="opui-home-skeleton-bar opui-home-skeleton-bar--short"></div>
  </div>`;

export function showHomeLoading() {
  const prime = document.getElementById("home-prime");
  const setup = document.getElementById("home-setup");
  if (prime && !prime.dataset.loaded) prime.innerHTML = HOME_SKELETON;
  if (setup && !setup.dataset.loaded) setup.innerHTML = HOME_SKELETON;
}

export function updateHomeScreen(home) {
  if (!home?.ok) return;

  const versionEl = document.getElementById("home-version");
  if (versionEl) versionEl.textContent = home.version_text || "";

  const expBanner = document.getElementById("home-exp-banner");
  if (expBanner) {
    expBanner.hidden = !home.experimental_mode;
    const icon = expBanner.querySelector(".opui-home-exp-icon");
    if (icon) {
      icon.src = assetUrl(home.experimental_mode
        ? "selfdrive/assets/icons/experimental_grey.png"
        : "selfdrive/assets/icons/couch.png");
    }
    const label = expBanner.querySelector(".opui-home-exp-label");
    if (label) {
      label.textContent = home.experimental_mode
        ? tr("EXPERIMENTAL MODE ON")
        : tr("CHILL MODE ON");
    }
  }

  renderPrimeCard(home);
  renderSetupCard(home);
}

export async function refreshHomeScreen() {
  showHomeLoading();
  try {
    const { apiGet } = await import("./api.js");
    const home = await apiGet("/api/opui/home");
    updateHomeScreen(home);
  } catch (_) { /* keep skeleton */ }
}

function renderPrimeCard(home) {
  const el = document.getElementById("home-prime");
  if (!el) return;
  el.dataset.loaded = "1";

  if (home.prime) {
    el.innerHTML = `
      <div class="opui-prime opui-prime--subscribed">
        <div class="opui-prime-check">${escapeHtml(tr("✓ SUBSCRIBED"))}</div>
        <div class="opui-prime-brand">${escapeHtml(tr("comma prime"))}</div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="opui-prime opui-prime--upsell">
      <h3 class="opui-prime-title">${escapeHtml(tr("Upgrade Now"))}</h3>
      <p class="opui-prime-desc">${escapeHtml(tr("Become a comma prime member at connect.comma.ai"))}</p>
      <div class="opui-prime-features-title">${escapeHtml(tr("PRIME FEATURES:"))}</div>
      <ul class="opui-prime-features">
        ${PRIME_FEATURES.map((f) => `<li><span class="opui-prime-tick">✓</span>${escapeHtml(tr(f))}</li>`).join("")}
      </ul>
    </div>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderSetupCard(home) {
  const el = document.getElementById("home-setup");
  if (!el) return;
  el.dataset.loaded = "1";

  if (!home.paired) {
    el.innerHTML = `
      <div class="opui-setup-card">
        <h3 class="opui-setup-title">${escapeHtml(tr("Finish Setup"))}</h3>
        <p class="opui-setup-desc">${escapeHtml(tr("Pair your device with comma connect (connect.comma.ai) and claim your comma prime offer."))}</p>
        <button type="button" class="opui-btn opui-btn--primary opui-setup-btn" id="btn-pair-device">${escapeHtml(tr("Pair device"))}</button>
      </div>`;
    document.getElementById("btn-pair-device")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("opui:open-settings", { detail: { panel: "device" } }));
    }, { once: true });
    return;
  }

  el.innerHTML = `
    <div class="opui-setup-card opui-setup-card--firehose">
      <h3 class="opui-setup-title">
        <img class="opui-setup-firehose-icon" src="${assetUrl("sunnypilot/selfdrive/assets/offroad/icon_firehose.png")}" alt="" />
        ${escapeHtml(tr("🔥 Firehose Mode 🔥"))}
      </h3>
      <p class="opui-setup-desc">${escapeHtml(tr("Maximize your training data uploads to improve openpilot's driving models."))}</p>
      <button type="button" class="opui-btn opui-btn--primary opui-setup-btn" id="btn-open-firehose">${escapeHtml(tr("Open"))}</button>
    </div>`;
  document.getElementById("btn-open-firehose")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("opui:open-settings", { detail: { panel: "firehose" } }));
  }, { once: true });
}
