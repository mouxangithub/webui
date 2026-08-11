import { apiGet } from "./api.js";
import { loadPanelList, renderPanel, setGlobalState } from "./panels.js";
import { bindStreamButton, startRoadStream, stopRoadStream, updateOnroadHud } from "./onroad.js";
import { initDevPanel } from "./dev.js";

const $ = (sel) => document.querySelector(sel);

const app = $("#app");
const settingsSidebar = $("#settings-sidebar");
const onroadSidebar = $("#onroad-sidebar");
const nav = $("#nav");
const panelContent = $("#panel-content");
const panelTitle = $("#panel-title");
const homeSub = $("#home-sub");

let panels = [];
let currentPanel = "device";
let lastStarted = false;
let devPc = false;

function setScreen(name) {
  app.dataset.screen = name;
  $("#screen-home").hidden = name !== "home";
  $("#screen-settings").hidden = name !== "settings";
  $("#screen-onroad").hidden = name !== "onroad";
  settingsSidebar.hidden = name !== "settings";
  onroadSidebar.hidden = name !== "onroad";
}

function renderNav() {
  nav.innerHTML = "";
  for (const p of panels) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = p.title;
    btn.classList.toggle("active", p.id === currentPanel);
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
    $("#home-title").textContent = "openpilot";
    const suffix = meta.dev_pc ? " · PC 预览" : "";
    if (meta.version) homeSub.textContent = `Web UI ${meta.version}${suffix}`;
  } catch (_) { /* dev offline */ }

  panels = await loadPanelList();
  if (!panels.length) {
    panels = [
      { id: "device", title: "Device" },
      { id: "toggles", title: "Toggles" },
    ];
  }
  currentPanel = panels[0]?.id || "device";
}

async function pollState() {
  try {
    const st = await apiGet("/api/opui/state");
    setGlobalState(st);

    if (!st.ok) {
      homeSub.textContent = st.error || "状态不可用";
      return;
    }

    if (st.started) {
      if (!lastStarted && !devPc) {
        startRoadStream().catch(() => {});
      }
      setScreen("onroad");
      updateOnroadHud(st);
    } else {
      if (lastStarted) {
        stopRoadStream().catch(() => {});
      }
      if (app.dataset.screen === "onroad") {
        setScreen("home");
      }
      homeSub.textContent = st.engaged ? "已激活（离路）" : "离路";
    }
    lastStarted = !!st.started;
  } catch (_) {
    homeSub.textContent = "无法连接设备";
  }
}

$("#btn-settings").addEventListener("click", () => {
  setScreen("settings");
  renderNav();
  loadCurrentPanel();
});

$("#btn-close-settings").addEventListener("click", () => setScreen("home"));

$("#btn-onroad-settings").addEventListener("click", () => {
  setScreen("settings");
  renderNav();
  loadCurrentPanel();
});

$("#btn-bookmark").addEventListener("click", () => {
  /* cereal bookmarkButton — future WS */
});

bindStreamButton();
bootstrap().then(() => {
  initDevPanel();
  pollState();
  setInterval(pollState, 400);
  setInterval(() => {
    if (app.dataset.screen === "settings") loadCurrentPanel();
  }, 5000);
});
