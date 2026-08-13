import { apiGet, apiPost } from "./api.js";
import {
  loadPanelList, renderPanel, setGlobalState, setHomeState, setSubpanelNavigator,
  applyPanelSync, syncDrivingPersonality, notifyPanelWatch, applyPanelCustom,
} from "./panels.js";
import { startRoadStream, stopRoadStream, updateOnroadHud, bindExperimentalButton, bindDriverCameraDialog, prewarmWebrtc, isCameraPlaying, isRoadStreaming, updateStreamDeviceState, onDocumentVisibilityChange, isOverlayAllowed, getOverlayFpsHint } from "./onroad.js";
import { updateHomeScreen, showHomeLoading, refreshHomeScreen, bindHomeHeader } from "./home.js";
import { updateSidebarMetrics, updateSidebarMode, updateSidebarRecording } from "./sidebar.js";
import { bindDmArcClick } from "./hud_sp.js";
import { initDevPanel } from "./dev.js";
import { initModelCanvas, showModelOverlay, drawModelOverlay, setModelOverlayEnabled } from "./model_canvas.js";
import { loadI18n, translatePanelTitle, syncStaticUiStrings, tr } from "./i18n.js";
import { initWebUiUpdate, refreshWebUiUpdateI18n } from "./webui_update.js";
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
let lastUiState = null;
let devPc = false;
let onroadSidebarVisible = false;
let cameraPreview = false;
let panelIconMap = {};

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
  if (d.border_roundness != null) root.style.setProperty("--border-roundness", String(d.border_roundness));
  if (c.engaged) root.style.setProperty("--engaged", c.engaged);
  if (c.disengaged) root.style.setProperty("--disengaged", c.disengaged);
  if (c.override) root.style.setProperty("--override", c.override);
  if (c.lat_only) root.style.setProperty("--lat-only", c.lat_only);
  if (c.long_only) root.style.setProperty("--long-only", c.long_only);
  if (c.alert_normal) root.style.setProperty("--alert-normal", c.alert_normal);
  if (c.alert_user) root.style.setProperty("--alert-user", c.alert_user);
  if (c.alert_critical) root.style.setProperty("--alert-critical", c.alert_critical);
  if (c.hud_engaged) root.style.setProperty("--hud-engaged", c.hud_engaged);
  if (c.hud_disengaged) root.style.setProperty("--hud-disengaged", c.hud_disengaged);
  if (c.on_bg) root.style.setProperty("--sp-on-bg", c.on_bg);
  if (c.button_primary) root.style.setProperty("--sp-primary", c.button_primary);

  const fonts = tokens.fonts || {};
  panelIconMap = tokens.panel_icons || {};
  const style = document.getElementById("opui-fonts") || document.createElement("style");
  style.id = "opui-fonts";
  const faces = Object.entries(fonts)
    .filter(([name]) => !name.toLowerCase().includes("op"))
    .map(([name, path]) => {
      const family = name === "audiowide" ? "Audiowide" : "Inter";
      const weight = name.includes("Bold") ? 700 : name.includes("Semi") ? 600 : name.includes("Medium") ? 500 : 400;
      return `
    @font-face {
      font-family: "${family}";
      font-weight: ${family === "Audiowide" ? 400 : weight};
      src: url("${assetUrl(path)}") format("${path.endsWith(".otf") ? "opentype" : "truetype"}");
    }`;
    }).join("\n");
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
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const portrait = vh > vw;
  root.classList.toggle("opui-portrait-host", portrait);
  const scale = portrait
    ? Math.min((vh - pad) / w, (vw - pad) / h, 1)
    : Math.min((vw - pad) / w, (vh - pad) / h, 1);
  root.style.setProperty("--opui-scale", String(scale));
}

function applySidebarAssets() {
  const settingsBtn = $("#btn-sidebar-settings");
  const bottomBtn = $("#btn-sidebar-bottom");
  const settingsImg = assetUrl("selfdrive/assets/images/button_settings.png");
  const homeImg = assetUrl("selfdrive/assets/images/button_home.png");
  const flagImg = assetUrl("selfdrive/assets/images/button_flag.png");
  if (settingsBtn) {
    settingsBtn.style.backgroundImage = `url("${settingsImg}")`;
    settingsBtn.style.backgroundSize = "100% 100%";
  }
  if (bottomBtn) {
    bottomBtn.style.setProperty("--sidebar-home-img", `url("${homeImg}")`);
    bottomBtn.style.setProperty("--sidebar-flag-img", `url("${flagImg}")`);
    bottomBtn.style.backgroundSize = "100% 100%";
  }
  const micBtn = document.getElementById("sidebar-mic");
  if (micBtn) {
    micBtn.style.backgroundImage = `url("${assetUrl("icons/microphone.png")}")`;
  }
}

function syncModelOverlayWatch() {
  if (app.dataset.screen !== "onroad") {
    opuiWs.unwatchModelOverlay();
    stopModelOverlayPoll();
    return;
  }
  if (!isCameraPlaying() || !isOverlayAllowed()) {
    opuiWs.unwatchModelOverlay();
    stopModelOverlayPoll();
    setModelOverlayEnabled(false);
    return;
  }
  setModelOverlayEnabled(true);
  const wrap = document.getElementById("camera-wrap");
  const w = wrap?.clientWidth || 1600;
  const h = wrap?.clientHeight || 900;
  const fps = getOverlayFpsHint();
  if (opuiWs.connected) {
    opuiWs.watchModelOverlay(w, h, fps);
    stopModelOverlayPoll();
    return;
  }
  startModelOverlayPoll(w, h);
}

let modelOverlayPollTimer = null;

function stopModelOverlayPoll() {
  if (modelOverlayPollTimer) {
    clearInterval(modelOverlayPollTimer);
    modelOverlayPollTimer = null;
  }
}

function startModelOverlayPoll(w, h) {
  stopModelOverlayPoll();
  if (opuiWs.connected) return;
  const poll = async () => {
    if (app.dataset.screen !== "onroad" || !isCameraPlaying() || !isOverlayAllowed()) return;
    const wrap = document.getElementById("camera-wrap");
    const width = wrap?.clientWidth || w;
    const height = wrap?.clientHeight || h;
    try {
      const data = await apiGet(`/api/opui/model/overlay?w=${width}&h=${height}`);
      if (data?.ok) drawModelOverlay(data);
    } catch (_) { /* WS may already deliver frames */ }
  };
  modelOverlayPollTimer = setInterval(poll, Math.max(200, Math.round(1000 / getOverlayFpsHint())));
  poll();
}

function updateCameraPreviewUi() {
  const bottomBtn = document.getElementById("btn-sidebar-bottom");
  if (!bottomBtn) return;
  const showExit = cameraPreview && !lastStarted;
  bottomBtn.disabled = false;
  bottomBtn.classList.toggle("opui-sidebar-btn--home", showExit);
  bottomBtn.classList.toggle("opui-sidebar-btn--flag", !showExit);
}

function setScreen(name) {
  const prevScreen = app.dataset.screen;
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
    stopModelOverlayPoll();
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
    if (!devPc) {
      startRoadStream().catch(() => {});
    }
  } else {
    metricsSidebar.hidden = true;
    app.classList.remove("opui--onroad-sidebar-hidden");
    notifyPanelWatch(currentPanel);
    opuiWs.unwatchModelOverlay();
    stopModelOverlayPoll();
  }

  showModelOverlay(name === "onroad");
  updateCameraPreviewUi();

  if (prevScreen === "onroad" && name !== "onroad" && !lastStarted) {
    stopRoadStream().catch(() => {});
  }
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

function iconCandidates(rel) {
  if (!rel) return [];
  const paths = [rel];
  if (rel.startsWith("sunnypilot/")) {
    paths.push(rel.replace("sunnypilot/", "openpilot/sunnypilot/"));
    paths.push(rel.replace("sunnypilot/", ""));
  }
  return [...new Set(paths)];
}

function setIconWithFallback(img, rel) {
  const candidates = iconCandidates(rel);
  let idx = 0;
  const tryNext = () => {
    if (idx >= candidates.length) {
      img.remove();
      return;
    }
    img.src = assetUrl(candidates[idx]);
    idx += 1;
  };
  img.onerror = tryNext;
  tryNext();
}

function renderNav() {
  nav.innerHTML = "";
  for (const p of panels) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.toggle("active", p.id === currentPanel);
    btn.dataset.panel = p.id;

    const iconPath = p.icon || panelIconMap[p.id] || "";
    if (iconPath) {
      const img = document.createElement("img");
      img.className = "opui-nav-icon";
      img.alt = "";
      setIconWithFallback(img, iconPath);
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
  if (panelContent) {
    panelContent.innerHTML = `<p class="opui-muted" style="padding:48px;text-align:center">${tr("Loading...")}</p>`;
  }
  await renderPanel(currentPanel, panelContent, panelTitle);
}

function showBootstrapBanner(message, tone = "warn") {
  const el = document.getElementById("bootstrap-banner");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.dataset.tone = tone;
  el.textContent = message;
}

async function bootstrap() {
  opuiWs.connect();
  showHomeLoading();
  setScreen("home");

  const httpPromise = apiGet("/api/opui/bootstrap").catch(() => null);
  const wsHelloPromise = opuiWs.waitHello(2500);
  const [httpMeta] = await Promise.all([httpPromise, wsHelloPromise]);

  let bootstrapData = opuiWs.bootstrap || httpMeta;
  if (bootstrapData) {
    devPc = !!bootstrapData.dev_pc;
    window.__OPUI_DEV_PC = devPc;
    applyDesignTokens(bootstrapData);
    const home = bootstrapData.home;
    if (home?.ok) {
      updateHomeScreen(home);
      setHomeState(home);
    } else if (home?.error) {
      showBootstrapBanner(`${tr("Home data failed to load")}: ${home.error}`);
      refreshHomeScreen();
    }
    const st = bootstrapData.state;
    if (st?.ok) handleState(st);
    if (devPc) {
      document.getElementById("camera-wrap")?.classList.add("is-dev-pc");
      showBootstrapBanner(tr("PC preview — some data is mocked and may differ from the device"), "info");
    } else if (st?.ok === false) {
      showBootstrapBanner(`${tr("Driving state unavailable")}: ${st.error || tr("Unknown error")}`, "warn");
    }
  } else {
    try {
      const fallback = await apiGet("/api/opui/bootstrap");
      bootstrapData = fallback;
      devPc = !!fallback.dev_pc;
      window.__OPUI_DEV_PC = devPc;
      applyDesignTokens(fallback);
      if (fallback.home?.ok) {
        updateHomeScreen(fallback.home);
        setHomeState(fallback.home);
      } else {
        showBootstrapBanner(`${tr("WebSocket and HTTP bootstrap failed")}: ${fallback.home?.error || tr("No response")}`);
        refreshHomeScreen();
      }
      if (fallback.state?.ok) handleState(fallback.state);
    } catch (_) {
      showBootstrapBanner(tr("WebUI not ready — run py -3 webui/dev/run_pc.py for local preview"));
      refreshHomeScreen();
    }
  }

  if (!bootstrapData) {
    showBootstrapBanner(tr("WebSocket disconnected — confirm the webui service is running"));
  }

  const panelListPromise = bootstrapData?.panels_schema?.ok
    ? Promise.resolve(bootstrapData.panels_schema.panels)
    : loadPanelList();

  const [panelResult] = await Promise.all([
    panelListPromise,
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
  lastUiState = st;
  setGlobalState(st);
  updateSidebarMetrics(st);
  updateSidebarMode(!!st.started);
  updateSidebarRecording(st);

  if (!st.ok) return;

  updateStreamDeviceState(st);

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
    if (app.dataset.screen === "onroad" && !cameraPreview) {
      setScreen("home");
    }
    if (cameraPreview && app.dataset.screen === "onroad") {
      updateOnroadHud(st);
    }
  }
  lastStarted = !!st.started;
  if (st.started) cameraPreview = false;
  updateCameraPreviewUi();
}

function setupWebSocket() {
  opuiWs.on("state", (msg) => {
    if (msg?.data) handleState(msg.data);
  });
  opuiWs.on("home", (msg) => {
    if (msg?.data) {
      updateHomeScreen(msg.data);
      setHomeState(msg.data);
    }
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
    if (app.dataset.screen === "onroad" && msg?.data && isOverlayAllowed()) drawModelOverlay(msg.data);
  });
  opuiWs.on("i18n", async (msg) => {
    if (msg?.data?.ok) {
      const { applyI18nPayload } = await import("./i18n.js");
      if (applyI18nPayload(msg.data, true)) {
        renderNav();
        refreshWebUiUpdateI18n();
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

window.addEventListener("opui:camera-ready", (ev) => {
  if (!ev.detail?.ready) return;
  if (app.dataset.screen === "onroad") {
    syncModelOverlayWatch();
    if (lastUiState?.ok) updateOnroadHud(lastUiState);
  }
});

window.addEventListener("opui:overlay-policy", () => {
  syncModelOverlayWatch();
});

window.addEventListener("opui:stream-quality-applied", () => {
  syncModelOverlayWatch();
});

document.addEventListener("visibilitychange", () => {
  const onroad = app.dataset.screen === "onroad";
  if (onroad && (lastStarted || cameraPreview)) {
    onDocumentVisibilityChange(isRoadStreaming()).catch(() => {});
  }
  syncModelOverlayWatch();
});

window.addEventListener("opui:open-settings", (ev) => {
  openSettings(ev.detail?.panel || "device");
});

window.addEventListener("opui:language-changed", () => {
  syncStaticUiStrings();
  refreshWebUiUpdateI18n();
  renderNav();
  if (lastUiState?.ok) updateSidebarMetrics(lastUiState);
});

window.addEventListener("opui:refresh-panel", () => {
  if (app.dataset.screen === "settings") loadCurrentPanel();
});

window.addEventListener("opui:dev-state", (ev) => {
  if (ev.detail) handleState(ev.detail);
});

$("#btn-close-settings").addEventListener("click", () => {
  setScreen(lastStarted ? "onroad" : "home");
});

$("#btn-sidebar-settings").addEventListener("click", () => openSettings("device"));

$("#btn-sidebar-bottom").addEventListener("click", async () => {
  if (cameraPreview && !lastStarted) {
    cameraPreview = false;
    await stopRoadStream();
    setScreen("home");
    return;
  }
  if (lastStarted) {
    await apiPost("/api/opui/action/bookmark");
  }
});

document.getElementById("btn-home-camera-preview")?.addEventListener("click", () => {
  cameraPreview = true;
  setScreen("onroad");
});

document.getElementById("sidebar-mic")?.addEventListener("click", () => {
  openSettings("toggles");
});

document.getElementById("camera-wrap")?.addEventListener("click", (ev) => {
  if (ev.target.closest(".opui-camera-fallback, .opui-exp-btn, #hud, #dm-arc-wrap")) return;
  toggleOnroadSidebar();
});

$("#home-exp-banner")?.addEventListener("click", () => openSettings("toggles"));

bindExperimentalButton();
bindDriverCameraDialog();
bindDmArcClick();
bindHomeHeader();
initModelCanvas();
applySidebarAssets();
setupWebSocket();

bootstrap().then(() => {
  initDevPanel();
  initWebUiUpdate();
  refreshWebUiUpdateI18n();
  fitOpuiScale();
  prewarmWebrtc();
  const refit = () => {
    fitOpuiScale();
    syncModelOverlayWatch();
  };
  window.addEventListener("resize", refit);
  window.addEventListener("orientationchange", refit);
});
