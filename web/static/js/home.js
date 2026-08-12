/** Offroad home layout — Prime card, experimental banner, Firehose setup. */

const PRIME_FEATURES = [
  "远程访问",
  "24/7 LTE 连接",
  "1 年驾驶数据存储",
  "远程快照",
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
        <div class="opui-prime-check">✓ 已订阅</div>
        <div class="opui-prime-brand">comma prime</div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="opui-prime opui-prime--upsell">
      <h3 class="opui-prime-title">立即升级</h3>
      <p class="opui-prime-desc">在 connect.comma.ai 成为 comma prime 会员</p>
      <div class="opui-prime-features-title">PRIME 功能：</div>
      <ul class="opui-prime-features">
        ${PRIME_FEATURES.map((f) => `<li><span class="opui-prime-tick">✓</span>${f}</li>`).join("")}
      </ul>
    </div>`;
}

function renderSetupCard(home) {
  const el = document.getElementById("home-setup");
  if (!el) return;
  el.dataset.loaded = "1";

  if (!home.paired) {
    el.innerHTML = `
      <div class="opui-setup-card">
        <h3 class="opui-setup-title">完成设置</h3>
        <p class="opui-setup-desc">将设备与 comma connect (connect.comma.ai) 配对并领取 comma prime 优惠。</p>
        <button type="button" class="opui-btn opui-btn--primary opui-setup-btn" id="btn-pair-device">配对设备</button>
      </div>`;
    document.getElementById("btn-pair-device")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("opui:open-settings", { detail: { panel: "device" } }));
    }, { once: true });
    return;
  }

  el.innerHTML = `
    <div class="opui-setup-card opui-setup-card--firehose">
      <h3 class="opui-setup-title">🔥 Firehose 模式 🔥</h3>
      <p class="opui-setup-desc">最大化上传训练数据，以改进 openpilot 的驾驶模型。</p>
      <button type="button" class="opui-btn opui-btn--primary opui-setup-btn" id="btn-open-firehose">打开</button>
    </div>`;
  document.getElementById("btn-open-firehose")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("opui:open-settings", { detail: { panel: "firehose" } }));
  }, { once: true });
}
