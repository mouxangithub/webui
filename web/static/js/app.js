import { apiGet } from "./api.js";
import { loadPanelList, renderPanel, setGlobalState, setSubpanelNavigator } from "./panels.js";
import { bindStreamButton, startRoadStream, stopRoadStream, updateOnroadHud } from "./onroad.js";
import { updateHomeScreen } from "./home.js";
import { updateSidebarMetrics, updateSidebarMode } from "./sidebar.js";
import { initDevPanel } from "./dev.js";
import { initModelCanvas, showModelOverlay, drawModelOverlay } from "./model_canvas.js";
import { loadI18n, translatePanelTitle } from "./i18n.js";

const $ = (sel) => document.querySelector(sel);

const app = $("#app");
const settingsSidebar = $("#settings-sidebar");
const metricsSidebar = $("#metrics-sidebar");
const nav = $("#nav");
const panelContent = $("#panel-content");
const panelTitle = $("#panel-title");

let panels = [];
let currentPanel = "device";
let lastStarted = false;
let devPc = false;
let designTokens = null;
let onroadSidebarVisible = false;

function assetUrl(rel) {
  if (!rel) return "";
  return `/api/opui/assets/${rel.replace(/^\//, "")}`;
}

function applyDesignTokens(tokens) {
  if (!tokens) return;
  designTokens = tokens;
  const root = document.documentElement;
  const d = tokens.design || {};
  const c = tokens.colors || {};
  if (d.width) root.style.setProperty("--opui-w", String(d.width));
  if (d.height) root.style.setProperty("--opui-h", String(d.height));
  if (d.sidebar_width) root.style.setProperty("--sidebar-w", `${d.sidebar_width}px`);
  if (d.onroad_sidebar_width) root.style.setProperty("--onroad-sidebar-w", `${d.onroad_sidebar_width}px`);
  if (d.border_size) root.style.setProperty("--border-w", `${d.border_size}px`);
  if (c.engaged) root.style.setProperty("--engaged", c.engaged);
  if (c.disengaged) root.style.setProperty("--disengaged", c.disengaged);
  if (c.on_bg) root.style.setProperty("--sp-on-bg", c.on_bg);
  if (c.button_primary) root.style.setProperty("--sp-primary", c.button_primary);

  const fonts = tokens.fonts || {};
  const style = document.getElementById("opui-fonts") || document.createElement("style");
  style.id = "opui-fonts";
  const faces = Object.entries(fonts)
    .filter(([name]) => !name.toLowerCase().includes("op"))
    .map(([name, path]) => `
    @font-face {
      font-family: "Inter";
      font-weight: ${name.includes("Bold") ? 700 : name.includes("Semi") ? 600 : name.includes("Medium") ? 500 : 400};
      src: url("${assetUrl(path)}") format("${path.endsWith(".otf") ? "opentype" : "truetype"}");
    }`).join("\n");
  style.textContent = faces;
  if (!style.parentNode) document.head.appendChild(style);

  applySidebarAssets();
  fitOpuiScale();
}

function fitOpuiScale() {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const w = parseFloat(cs.getPropertyValue("--opui-w")) || 2160;
  const h = parseFloat(cs.getPropertyValue("--opui-h")) || 1080;
  const pad = 24;
  const scale = Math.min(
    (window.innerWidth - pad) / w,
    (window.innerHeight - pad) / h,
    1,
  );
  root.style.setProperty("--opui-scale", String(scale));
}

function applySidebarAssets() {
  const settingsBtn = $("#btn-sidebar-settings");
  const bottomBtn = $("#btn-sidebar-bottom");
  const settingsImg = assetUrl("selfdrive/assets/images/button_settings.png");
  const homeImg = assetUrl("selfdrive/assets/images/button_home.png");
  const flagImg = assetUrl("selfdrive/assets/images/button_flag.png");
  if (settingsBtn) settingsBtn.style.backgroundImage = `url("${settingsImg}")`;
  if (bottomBtn) {
    bottomBtn.style.setProperty("--sidebar-home-img", `url("${homeImg}")`);
    bottomBtn.style.setProperty("--sidebar-flag-img", `url("${flagImg}")`);
  }
}

function setScreen(name) {
  app.dataset.screen = name;
  $("#screen-home").hidden = name !== "home";
  $("#screen-settings").hidden = name !== "settings";
  $("#screen-onroad").hidden = name !== "onroad";
  settingsSidebar.hidden = name !== "settings";

  if (name === "home") {
    onroadSidebarVisible = false;
    metricsSidebar.hidden = false;
    app.classList.remove("opui--onroad-sidebar-hidden");
  } else if (name === "onroad") {
    metricsSidebar.hidden = !onroadSidebarVisible;
    app.classList.toggle("opui--onroad-sidebar-hidden", !onroadSidebarVisible);
  } else {
    metricsSidebar.hidden = true;
    app.classList.remove("opui--onroad-sidebar-hidden");
  }

  showModelOverlay(name === "onroad");
}

function toggleOnroadSidebar() {
  if (app.dataset.screen !== "onroad") return;
  onroadSidebarVisible = !onroadSidebarVisible;
  metricsSidebar.hidden = !onroadSidebarVisible;
  app.classList.toggle("opui--onroad-sidebar-hidden", !onroadSidebarVisible);
}

function openSettings(panelId = "device") {
  currentPanel = panelId;
  setScreen("settings");
  renderNav();
  loadCurrentPanel();
}

function renderNav() {
  nav.innerHTML = "";
  for (const p of panels) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.toggle("active", p.id === currentPanel);
    btn.dataset.panel = p.id;

    if (p.icon) {
      const img = document.createElement("img");
      img.className = "opui-nav-icon";
      img.alt = "";
      img.src = assetUrl(p.icon);
      img.onerror = () => { img.remove(); };
      btn.appendChild(img);
    }
    const span = document.createElement("span");
    span.textContent = translatePanelTitle(p.title);
    btn.appendChild(span);

    btn.addEventListener("click", () => {
      currentPanel = p.id;
      renderNav();
      loadCurrentPanel();
    });
    nav.appendChild(btn);
  }
}

async function loadCurrentPanel() {
  await renderPanel(currentPanel, panelContent, panelTitle);
}

async function bootstrap() {
  try {
    const meta = await apiGet("/api/opui/bootstrap");
    devPc = !!meta.dev_pc;
    applyDesignTokens(meta);
    if (devPc) {
      document.getElementById("camera-wrap")?.classList.add("is-dev-pc");
    }
  } catch (_) { /* dev offline */ }

  panels = await loadPanelList();
  if (!panels.length) {
    console.warn("panels API empty, using fallback list");
    panels = [
      { id: "device", title: "Device" },
      { id: "toggles", title: "Toggles" },
    ];
  }
  await loadI18n(true);
  currentPanel = panels[0]?.id || "device";
  renderNav();
}

async function pollHome() {
  if (app.dataset.screen !== "home") return;
  try {
    const home = await apiGet("/api/opui/home");
    updateHomeScreen(home);
  } catch (_) { /* ignore */ }
}

async function pollModelOverlay() {
  if (app.dataset.screen !== "onroad") return;
  try {
    const wrap = document.getElementById("camera-wrap");
    const w = wrap?.clientWidth || 1600;
    const h = wrap?.clientHeight || 900;
    const frame = await apiGet(`/api/opui/model/overlay?w=${w}&h=${h}`);
    drawModelOverlay(frame);
  } catch (_) { /* ignore */ }
}

async function pollState() {
  try {
    const st = await apiGet("/api/opui/state");
    setGlobalState(st);
    updateSidebarMetrics(st);
    updateSidebarMode(!!st.started);

    if (!st.ok) return;

    if (st.started) {
      if (!lastStarted && !devPc) {
        startRoadStream().catch(() => {});
      }
      if (!lastStarted) {
        onroadSidebarVisible = false;
      }
      if (app.dataset.screen === "home") {
        setScreen("onroad");
      }
      updateOnroadHud(st);
    } else {
      if (lastStarted) {
        stopRoadStream().catch(() => {});
      }
      if (app.dataset.screen === "onroad") {
        setScreen("home");
        pollHome();
      }
    }
    lastStarted = !!st.started;
  } catch (_) {
    /* connection lost */
  }
}

setSubpanelNavigator((panelId) => {
  currentPanel = panelId;
  renderNav();
  loadCurrentPanel();
});

window.addEventListener("opui:open-settings", (ev) => {
  openSettings(ev.detail?.panel || "device");
});

$("#btn-close-settings").addEventListener("click", () => {
  setScreen(lastStarted ? "onroad" : "home");
  if (!lastStarted) pollHome();
});

$("#btn-sidebar-settings").addEventListener("click", () => openSettings("device"));

$("#btn-sidebar-bottom").addEventListener("click", () => {
  if (lastStarted) {
    /* cereal bookmarkButton — future WS */
  }
});

document.getElementById("camera-wrap")?.addEventListener("click", (ev) => {
  if (ev.target.closest(".opui-camera-fallback, .opui-exp-btn, #hud")) return;
  toggleOnroadSidebar();
});

$("#home-exp-banner")?.addEventListener("click", () => openSettings("toggles"));

bindStreamButton();
initModelCanvas();

bootstrap().then(async () => {
  initDevPanel();
  fitOpuiScale();
  window.addEventListener("resize", fitOpuiScale);
  await loadI18n(true);
  setScreen("home");
  pollHome();
  pollState();
  setInterval(pollState, 400);
  setInterval(pollHome, 5000);
  setInterval(async () => {
    if (await loadI18n()) {
      renderNav();
      if (app.dataset.screen === "home") pollHome();
      if (app.dataset.screen === "settings") loadCurrentPanel();
    }
  }, 3000);
  setInterval(pollModelOverlay, 100);
  setInterval(() => {
    if (app.dataset.screen === "settings") loadCurrentPanel();
  }, 2000);
});
