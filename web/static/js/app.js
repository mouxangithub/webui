/**
 * op Web UI shell — mirrors BIG layout state machine: home | settings | onroad
 */

const PANELS = [
  { id: "device", label: "Device" },
  { id: "network", label: "Network" },
  { id: "toggles", label: "Toggles" },
  { id: "software", label: "Software" },
  { id: "firehose", label: "Firehose" },
  { id: "developer", label: "Developer" },
];

const $ = (sel) => document.querySelector(sel);

const app = $("#app");
const sidebar = $("#sidebar");
const nav = $("#nav");
const panelContent = $("#panel-content");
const stateLine = $("#state-line");
const hudSpeed = $("#hud-speed");
const alertBar = $("#alert-bar");
const border = $("#border");

let currentPanel = "toggles";

function setScreen(name) {
  app.dataset.screen = name;
  $("#screen-home").hidden = name !== "home";
  $("#screen-settings").hidden = name !== "settings";
  $("#screen-onroad").hidden = name !== "onroad";
  sidebar.hidden = name !== "settings";
}

function renderNav() {
  nav.innerHTML = "";
  for (const p of PANELS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = p.label;
    btn.classList.toggle("active", p.id === currentPanel);
    btn.addEventListener("click", () => {
      currentPanel = p.id;
      renderNav();
      loadPanel();
    });
    nav.appendChild(btn);
  }
}

async function loadPanel() {
  if (currentPanel !== "toggles") {
    panelContent.innerHTML = `<p class="opui-muted">${currentPanel} 面板开发中</p>`;
    return;
  }
  const res = await fetch("/api/opui/params/toggles").then((r) => r.json());
  if (!res.ok) {
    panelContent.innerHTML = `<p class="opui-muted">Params 不可用: ${res.error || "?"}</p>`;
    return;
  }
  panelContent.innerHTML = res.params
    .map(
      (p) => `
    <label class="opui-toggle-row">
      <span>${p.key}</span>
      <input type="checkbox" data-key="${p.key}" ${p.value === "1" ? "checked" : ""} />
    </label>`
    )
    .join("");
  panelContent.querySelectorAll("input[type=checkbox]").forEach((el) => {
    el.addEventListener("change", async () => {
      const key = el.dataset.key;
      const value = el.checked ? "1" : "0";
      await fetch(`/api/opui/params/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
    });
  });
}

function updateBorder(engaged, override) {
  border.className = "opui-border";
  if (override) border.classList.add("opui-border--override");
  else if (engaged) border.classList.add("opui-border--engaged");
  else border.classList.add("opui-border--disengaged");
}

async function pollState() {
  try {
    const st = await fetch("/api/opui/state").then((r) => r.json());
    if (!st.ok) {
      stateLine.textContent = st.error || "状态不可用";
      return;
    }
    const speed = Math.round((st.speed || 0) * 3.6);
    hudSpeed.textContent = String(speed);
    stateLine.textContent = st.started
      ? (st.engaged ? "行驶中 · 已激活" : "行驶中 · 未激活")
      : "离路";
    updateBorder(st.engaged, false);
    if (st.started) {
      setScreen("onroad");
      if (st.alert?.text1) {
        alertBar.hidden = false;
        alertBar.textContent = [st.alert.text1, st.alert.text2].filter(Boolean).join(" — ");
        if (st.alert.status?.includes("critical")) alertBar.style.background = "var(--alert-critical)";
        else if (st.alert.size?.includes("mid")) alertBar.style.background = "var(--alert-user)";
        else alertBar.style.background = "var(--alert-normal)";
      } else {
        alertBar.hidden = true;
      }
    } else if (app.dataset.screen === "onroad") {
      setScreen("home");
    }
  } catch (_) {
    stateLine.textContent = "无法连接设备状态 API";
  }
}

async function bootstrap() {
  try {
    const meta = await fetch("/api/opui/bootstrap").then((r) => r.json());
    $("#version-label").textContent = `op Web UI ${meta.version || ""}`;
  } catch (_) {
    /* offline dev */
  }
}

$("#btn-settings").addEventListener("click", () => {
  setScreen("settings");
  renderNav();
  loadPanel();
});

$("#btn-close-settings").addEventListener("click", () => setScreen("home"));

bootstrap();
pollState();
setInterval(pollState, 500);
