import { apiGet } from "./api.js";
import {
  loadPanelList, renderPanel, setGlobalState, setSubpanelNavigator,
  applyPanelSync, syncDrivingPersonality, notifyPanelWatch, applyPanelCustom,
} from "./panels.js";
import { bindStreamButton, startRoadStream, stopRoadStream, updateOnroadHud } from "./onroad.js";
import { updateHomeScreen, showHomeLoading, refreshHomeScreen } from "./home.js";
import { updateSidebarMetrics, updateSidebarMode } from "./sidebar.js";
import { initDevPanel } from "./dev.js";
import { initModelCanvas, showModelOverlay, drawModelOverlay } from "./model_canvas.js";
import { loadI18n, translatePanelTitle, syncStaticUiStrings } from "./i18n.js";
import { opuiWs } from "./ws.js";

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
let onroadSidebarVisible = false;

function assetUrl(rel) {
  if (!rel) return "";
  return `/api/opui/assets/${rel.replace(/^\//, "")}`;
}

function applyDesignTokens(tokens) {
  if (!tokens) return;
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

function syncModelOverlayWatch() {
  if (app.dataset.screen !== "onroad" || !opuiWs.connected) {
    opuiWs.unwatchModelOverlay();
    return;
  }
  const wrap = document.getElementById("camera-wrap");
  const w = wrap?.clientWidth || 1600;
  const h = wrap?.clientHeight || 900;
  opuiWs.watchModelOverlay(w, h);
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
    notifyPanelWatch(null);
    opuiWs.unwatchModelOverlay();
    if (opuiWs.lastHome?.data) {
      updateHomeScreen(opuiWs.lastHome.data);
    } else if (opuiWs.bootstrap?.home) {
      updateHomeScreen(opuiWs.bootstrap.home);
    } else {
      refreshHomeScreen();
    }
  } else if (name === "onroad") {
    metricsSidebar.hidden = !onroadSidebarVisible;
    app.classList.toggle("opui--onroad-sidebar-hidden", !onroadSidebarVisible);
    notifyPanelWatch(null);
    syncModelOverlayWatch();
  } else {
    metricsSidebar.hidden = true;
    app.classList.remove("opui--onroad-sidebar-hidden");
    notifyPanelWatch(currentPanel);
    opuiWs.unwatchModelOverlay();
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
  opuiWs.connect();
  showHomeLoading();
  setScreen("home");

  await opuiWs.waitHello(8000);

  const meta = opuiWs.bootstrap;
  if (meta) {
    devPc = !!meta.dev_pc;
    applyDesignTokens(meta);
    if (meta.home) updateHomeScreen(meta.home);
    if (devPc) {
      document.getElementById("camera-wrap")?.classList.add("is-dev-pc");
    }
  } else {
    try {
      const fallback = await apiGet("/api/opui/bootstrap");
      devPc = !!fallback.dev_pc;
      applyDesignTokens(fallback);
      if (fallback.home) updateHomeScreen(fallback.home);
      else refreshHomeScreen();
    } catch (_) {
      refreshHomeScreen();
    }
  }

  const [panelResult] = await Promise.all([
    loadPanelList(),
    loadI18n(true),
  ]);
  panels = panelResult;
  syncStaticUiStrings();
  if (!panels.length) {
    panels = [
      { id: "device", title: "Device" },
      { id: "toggles", title: "Toggles" },
    ];
  }
  currentPanel = panels[0]?.id || "device";
  renderNav();
}

function handleState(st) {
  setGlobalState(st);
  updateSidebarMetrics(st);
  updateSidebarMode(!!st.started);

  if (!st.ok) return;

  if (st.started && (st.personality || st.personality_index != null)) {
    syncDrivingPersonality(st.personality, st.personality_index);
  }

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
    }
  }
  lastStarted = !!st.started;
}

function setupWebSocket() {
  opuiWs.on("state", (msg) => {
    if (msg?.data) handleState(msg.data);
  });
  opuiWs.on("home", (msg) => {
    if (msg?.data) updateHomeScreen(msg.data);
  });
  opuiWs.on("panel", (msg) => {
    if (app.dataset.screen !== "settings") return;
    if (msg.panel !== currentPanel) return;
    applyPanelSync(msg.data);
  });
  opuiWs.on("panel_custom", (msg) => {
    if (app.dataset.screen !== "settings") return;
    if (msg.panel !== currentPanel) return;
    applyPanelCustom(msg.panel, msg.data);
  });
  opuiWs.on("model_overlay", (msg) => {
    if (app.dataset.screen === "onroad" && msg?.data) drawModelOverlay(msg.data);
  });
  opuiWs.on("i18n", async (msg) => {
    if (msg?.data?.ok) {
      const { applyI18nPayload } = await import("./i18n.js");
      if (applyI18nPayload(msg.data, true)) {
        renderNav();
        if (app.dataset.screen === "settings") loadCurrentPanel();
      }
    }
  });
  opuiWs.on("open", () => {
    if (app.dataset.screen === "settings") notifyPanelWatch(currentPanel);
    syncModelOverlayWatch();
  });
}

setSubpanelNavigator((panelId) => {
  currentPanel = panelId;
  renderNav();
  loadCurrentPanel();
});

window.addEventListener("opui:open-settings", (ev) => {
  openSettings(ev.detail?.panel || "device");
});

window.addEventListener("opui:language-changed", () => {
  renderNav();
});

window.addEventListener("opui:refresh-panel", () => {
  if (app.dataset.screen === "settings") loadCurrentPanel();
});

$("#btn-close-settings").addEventListener("click", () => {
  setScreen(lastStarted ? "onroad" : "home");
});

$("#btn-sidebar-settings").addEventListener("click", () => openSettings("device"));

$("#btn-sidebar-bottom").addEventListener("click", () => {
  if (lastStarted) {
    /* cereal bookmarkButton */
  }
});

document.getElementById("camera-wrap")?.addEventListener("click", (ev) => {
  if (ev.target.closest(".opui-camera-fallback, .opui-exp-btn, #hud")) return;
  toggleOnroadSidebar();
});

$("#home-exp-banner")?.addEventListener("click", () => openSettings("toggles"));

bindStreamButton();
initModelCanvas();
setupWebSocket();

bootstrap().then(() => {
  initDevPanel();
  fitOpuiScale();
  window.addEventListener("resize", () => {
    fitOpuiScale();
    syncModelOverlayWatch();
  });
});
