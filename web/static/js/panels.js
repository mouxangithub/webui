import { apiGet, apiPost, apiPut, toast } from "./api.js";
import { tr } from "./i18n.js";
import { opuiWs } from "./ws.js";
import {
  showConfirm, showKeyboard, showTree, showHtml, showMultiOption,
  createSpToggle, createProgressRow, createDualButton,
} from "./components.js";

function t(s) {
  return tr(s);
}

function resolveWidgetType(w) {
  const known = new Set([
    "section", "html", "action", "subpanel", "custom", "dual_button", "option",
    "readonly", "bool", "choice", "int", "multiple_button",
  ]);
  if (known.has(w.type)) return w.type;
  const pt = String(w.param_type || w.type || "").toUpperCase();
  if (w.buttons?.length) return "multiple_button";
  if (w.options?.length) return "choice";
  if (pt.includes("BOOL")) return "bool";
  if (pt.includes("INT") || pt.includes("FLOAT")) return w.label_format ? "option" : "int";
  if (pt.includes("STRING")) return w.options?.length ? "choice" : "readonly";
  return w.type;
}

function widgetVisible(w, panelData) {
  if (w.advanced_if) {
    const adv = panelData.values?.[w.advanced_if.param];
    if (String(adv) !== String(w.advanced_if.eq)) return false;
  }
  if (!w.visible_if) return true;
  const dep = panelData.values?.[w.visible_if.param];
  if (w.visible_if.ne != null) return String(dep) !== String(w.visible_if.ne);
  return String(dep) === String(w.visible_if.eq);
}

function formatOptionLabel(w, rawVal) {
  const idx = parseInt(rawVal, 10);
  const val = Number.isNaN(idx) ? rawVal : idx;
  const fmt = w.label_format;
  const valueMap = w.value_map || {};

  if (fmt === "lane_change_timer") {
    const map = { [-1]: t("Off"), 0: t("Nudge"), 1: t("Nudgeless"), 2: `0.5 ${t("s")}`, 3: `1 ${t("s")}`, 4: `2 ${t("s")}`, 5: `3 ${t("s")}` };
    return map[val] ?? String(val);
  }
  if (fmt === "onroad_brightness") {
    if (val === 0) return t("Auto (Default)");
    if (val === 1) return t("Auto (Dark)");
    if (val === 2) return t("Screen Off");
    return `${(val - 2) * 5} %`;
  }
  if (fmt === "onroad_brightness_timer") {
    const minutes = valueMap[String(val)];
    if (minutes == null) return String(val);
    return minutes < 60 ? `${minutes} ${t("s")}` : `${Math.floor(minutes / 60)} ${t("m")}`;
  }
  if (fmt === "interactivity_timeout") {
    if (!val) return t("Default");
    return val < 60 ? `${val} ${t("s")}` : `${Math.floor(val / 60)} ${t("m")}`;
  }
  if (fmt === "screensaver_timeout") return `${Math.floor(val / 60)} m`;
  if (fmt === "lagd_delay") return `${(val / 100).toFixed(2)}s`;
  if (fmt === "camera_offset") return `${(val / 100).toFixed(2)} m`;
  if (fmt === "lane_turn_speed") return `${Math.round(val / 100)}`;
  if (fmt === "torque_lat_accel") return `${(val / 100).toFixed(2)} m/s²`;
  if (fmt === "torque_friction") return `${(val / 100).toFixed(2)}`;
  if (fmt === "speed_limit_offset") {
    const offsetType = panelDataRef?.values?.SpeedLimitOffsetType ?? "0";
    if (String(offsetType) === "2") return `${val}%`;
    if (String(offsetType) === "1") return `${val} ${globalState.is_metric ? "km/h" : "mph"}`;
    return String(val);
  }
  if (Object.keys(valueMap).length) return formatMaxTimeLabel(val, valueMap);
  return String(val);
}

let panelDataRef = null;
let lastPanelVisibilityHash = "";

const PERSONALITY_INDEX = { aggressive: 0, standard: 1, relaxed: 2 };

let globalState = { started: false, engaged: false, is_offroad: true };
let onNavigateSubpanel = null;
let deviceExtrasCache = null;

async function putParam(key, value, needsCycle = false) {
  try {
    if (opuiWs.connected) {
      const res = await opuiWs.putParam(key, value, needsCycle);
      return res || { ok: false, error: "ws failed" };
    }
  } catch (_) { /* fall through */ }
  return apiPut(`/api/opui/params/${encodeURIComponent(key)}`, {
    value, needs_cycle: !!needsCycle,
  });
}

const paramHandlers = {
  toast,
  putParam,
};

export function setGlobalState(st) {
  globalState = st || globalState;
  updateEngagedWidgets();
  updateToggleCapabilities(st);
}

function updateToggleCapabilities(st) {
  if (!st) return;
  const hasLong = st.has_longitudinal_control !== false;
  const expRow = document.querySelector('[data-param="ExperimentalMode"]');
  const expInput = expRow?.querySelector("input[type=checkbox]");
  const expDesc = expRow?.querySelector(".opui-sp-row-desc");
  const longRow = document.querySelector('[data-param="LongitudinalPersonality"]');
  const accelEn = document.querySelector('[data-param="AccelPersonalityEnabled"]');
  const accelProf = document.querySelector('[data-param="AccelPersonality"]');

  if (expInput) {
    const disable = !hasLong;
    expInput.disabled = disable || (globalState.engaged && expRow?.dataset.needsCycle === "1");
    expRow?.querySelector(".opui-sp-toggle")?.classList.toggle("disabled", disable);
    if (disable && expInput.checked) {
      expInput.checked = false;
      expRow?.querySelector(".opui-sp-toggle")?.classList.remove("on");
    }
    if (expDesc) {
      const e2e = t(
        "sunnypilot defaults to driving in chill mode. Experimental mode enables alpha-level features that aren't ready for chill mode.",
      );
      if (!hasLong) {
        let unavailable = t(
          "Experimental mode is currently unavailable on this car since the car's stock ACC is used for longitudinal control.",
        );
        if (st.alpha_longitudinal_available) {
          unavailable += ` ${t("Enable the sunnypilot longitudinal control (alpha) toggle to allow Experimental mode.")}`;
        } else {
          unavailable += ` ${t("sunnypilot longitudinal control may come in a future update.")}`;
        }
        expDesc.innerHTML = `<b>${escapeHtml(unavailable)}</b><br><br>${escapeHtml(e2e)}`;
      } else {
        expDesc.textContent = e2e;
      }
    }
  }
  longRow?.querySelectorAll("button").forEach((b) => { b.disabled = !hasLong; });
  accelEn?.querySelector("input")?.toggleAttribute("disabled", !hasLong);

  const accelOn = panelDataRef?.values?.AccelPersonalityEnabled === "1";
  accelProf?.querySelectorAll("button").forEach((b) => {
    b.disabled = !hasLong || !accelOn;
  });
}

function applySoftwareCustom(sw) {
  if (!sw?.ok) return;
  const warn = document.getElementById("software-onroad-warn");
  if (warn) warn.hidden = !sw.is_onroad;

  const dlVal = document.getElementById("software-download-value");
  const dlBtn = document.getElementById("software-download-btn");
  if (dlVal) dlVal.textContent = t(sw.download_value || sw.updater_state || "--");
  if (dlBtn) {
    dlBtn.textContent = t(sw.download_label || "CHECK");
    dlBtn.disabled = sw.download_enabled === false;
    dlBtn.hidden = !sw.is_offroad;
  }

  const installRow = document.getElementById("software-install-row");
  const installVal = document.getElementById("software-install-value");
  const installNotes = document.getElementById("software-install-notes");
  if (installRow) installRow.hidden = !sw.install_visible;
  if (installVal) installVal.textContent = sw.new_description || "";
  if (installNotes) {
    installNotes.textContent = sw.new_release_notes || "";
    installNotes.hidden = !sw.new_release_notes;
  }

  const curNotes = document.getElementById("software-current-notes");
  if (curNotes) {
    curNotes.textContent = sw.current_release_notes || "";
    curNotes.hidden = !sw.current_release_notes;
  }
}

export function applyPanelCustom(panelId, data) {
  if (!data?.ok) return;
  if (panelId === "software") {
    applySoftwareCustom(data);
  }
  if (panelId === "firehose") {
    const el = document.getElementById("firehose-status-text");
    if (el) {
      el.textContent = data.active ? "Active" : "Inactive";
    }
  }
}

function updateEngagedWidgets() {
  const root = document.getElementById("panel-content");
  if (!root) return;
  root.querySelectorAll("[data-needs-cycle='1']").forEach((row) => {
    const input = row.querySelector("input[type=checkbox]");
    const label = row.querySelector(".opui-sp-toggle");
    const disabled = globalState.engaged;
    if (input) input.disabled = disabled;
    label?.classList.toggle("disabled", disabled);
  });
  root.querySelectorAll("[data-offroad-only='1']").forEach((row) => {
    const input = row.querySelector("input[type=checkbox], button");
    const disabled = !globalState.is_offroad;
    if (input) input.disabled = disabled;
  });
}

function panelVisibilityHash(data) {
  return (data.widgets || [])
    .filter((w) => widgetVisible(w, data))
    .map((w) => w.param || w.type || w.custom || "")
    .join("|");
}

export function applyPanelSync(data) {
  if (!data?.ok) return;
  const hash = panelVisibilityHash(data);
  if (hash !== lastPanelVisibilityHash) {
    const container = document.getElementById("panel-content");
    if (container) renderGenericPanel(container, data);
    return;
  }
  panelDataRef = data;
  const root = document.getElementById("panel-content");
  if (!root) return;
  for (const w of data.widgets || []) {
    if (!w.param || !widgetVisible(w, data)) continue;
    updateWidgetValue(root, w);
  }
  updateEngagedWidgets();
  updateToggleCapabilities(globalState);
}

function updateWidgetValue(root, w) {
  const el = root.querySelector(`[data-param="${CSS.escape(w.param)}"]`);
  if (!el) return;
  const kind = el.dataset.widget || resolveWidgetType(w);
  if (kind === "bool") {
    const checked = w.value === "1" || w.value === "true";
    const input = el.querySelector("input[type=checkbox]");
    const label = el.querySelector(".opui-sp-toggle");
    if (input && input.checked !== checked) {
      input.checked = checked;
      label?.classList.toggle("on", checked);
    }
    return;
  }
  if (kind === "multiple_button" || kind === "choice") {
    let idx = parseInt(w.value, 10);
    if (Number.isNaN(idx)) idx = 0;
    el.querySelectorAll(".opui-multi-btn-group button, .opui-choice-group button").forEach((btn, i) => {
      btn.classList.toggle("selected", i === idx);
    });
    return;
  }
  if (kind === "readonly") {
    const valEl = el.querySelector(".opui-row-value");
    if (valEl) valEl.textContent = formatValue(w.value) || t("N/A");
    return;
  }
  if (kind === "int" || kind === "option") {
    const span = el.querySelector(".opui-int-control span, .opui-option-value");
    if (span) span.textContent = kind === "option" ? formatOptionLabel(w, w.value) : String(w.value);
  }
}

export function syncDrivingPersonality(personality, personalityIndex) {
  let idx = personalityIndex;
  if (idx == null && personality) {
    idx = PERSONALITY_INDEX[String(personality).toLowerCase()];
  }
  if (idx == null) return;
  const el = document.querySelector('[data-param="LongitudinalPersonality"]');
  if (!el) return;
  el.querySelectorAll(".opui-multi-btn-group button").forEach((btn, i) => {
    btn.classList.toggle("selected", i === idx);
  });
}

export function notifyPanelWatch(panelId) {
  opuiWs.watchPanel(panelId || null);
}

export function setSubpanelNavigator(fn) {
  onNavigateSubpanel = fn;
}

export async function loadPanelList() {
  const data = await apiGet("/api/opui/panels");
  if (!data.ok) return [];
  const p = data.panels;
  if (Array.isArray(p)) return p;
  console.warn("panels API returned non-array; restart webui server after panel_icons fix");
  return [];
}

export async function renderPanel(panelId, container, titleEl, options = {}) {
  notifyPanelWatch(panelId);
  const data = await apiGet(`/api/opui/panels/${encodeURIComponent(panelId)}`);
  if (!data.ok) {
    container.innerHTML = `<p class="opui-muted" style="padding:48px">加载失败: ${data.error}</p>`;
    return;
  }
  if (titleEl) {
    if (data.parent && options.showBack !== false) {
      titleEl.innerHTML = `<button type="button" class="opui-back" data-parent="${escapeAttr(data.parent)}">‹</button> ${escapeHtml(t(data.title))}`;
      titleEl.querySelector(".opui-back")?.addEventListener("click", () => {
        if (onNavigateSubpanel) onNavigateSubpanel(data.parent);
      });
    } else {
      titleEl.textContent = t(data.title);
    }
  }

  if (data.custom === "device") {
    await renderDevicePanel(container, data, titleEl, options);
    return;
  }
  if (data.custom === "network") {
    await renderNetworkPanel(container, data);
    return;
  }
  if (data.custom === "software") {
    await renderSoftwarePanel(container, data);
    return;
  }
  if (data.custom === "trips") {
    await renderTripsPanel(container, data);
    return;
  }
  if (data.custom === "models") {
    await renderModelsPanel(container, data);
    return;
  }
  if (data.custom === "firehose") {
    await renderFirehosePanel(container);
    return;
  }
  if (data.custom === "sunnylink") {
    await renderSunnylinkPanel(container, data);
    return;
  }
  if (data.custom === "osm") {
    await renderOsmPanel(container, data);
    return;
  }
  if (data.custom === "vehicle") {
    await renderVehiclePanel(container, data);
    return;
  }

  renderGenericPanel(container, data);
  lastPanelVisibilityHash = panelVisibilityHash(data);
}

async function renderDevicePanel(container, data, titleEl, options = {}) {
  const ex = await apiGet("/api/opui/device/extras");
  deviceExtrasCache = ex.ok ? ex : null;
  renderGenericPanel(container, data);
}

function renderAlwaysOffroadRow(active) {
  const row = document.createElement("div");
  row.className = "opui-dual-row opui-dual-row--single";
  const label = active ? t("Exit Always Offroad") : t("Enable Always Offroad");
  row.innerHTML = `<button type="button" class="opui-dual-btn ${active ? "primary" : "danger"}">${escapeHtml(label)}</button>`;
  row.querySelector("button")?.addEventListener("click", async () => {
    if (globalState.engaged) {
      toast(t("Disengage to Enter Always Offroad Mode"));
      return;
    }
    const msg = active
      ? t("Are you sure you want to exit Always Offroad mode?")
      : t("Are you sure you want to enter Always Offroad mode?");
    if (!(await showConfirm({ message: msg, confirmText: t("Confirm") }))) return;
    const res = await apiPut("/api/opui/params/OffroadMode", { value: active ? "0" : "1" });
    if (res.ok) toast(label);
    else toast(res.error || "Failed");
  });
  return row;
}

function renderGenericPanel(container, data) {
  panelDataRef = data;
  lastPanelVisibilityHash = panelVisibilityHash(data);
  container.innerHTML = "";
  for (const w of data.widgets || []) {
    const el = renderWidget(w, data);
    if (el) container.appendChild(el);
  }
}

function renderWidget(w, panelData) {
  const kind = resolveWidgetType(w);
  const offroad = globalState.is_offroad;
  if (w.offroad_only && !offroad) return null;

  if (!widgetVisible(w, panelData)) return null;

  if (kind === "section") {
    const row = document.createElement("div");
    row.className = "opui-row opui-row--section";
    row.textContent = t(w.label);
    return row;
  }

  if (kind === "html") {
    const block = document.createElement("div");
    block.className = "opui-html-block";
    block.innerHTML = w.html || "";
    return block;
  }

  if (kind === "dual_button") {
    return renderDualButtonRow(w);
  }

  if (kind === "option") {
    return renderOptionRow(w, panelData);
  }

  if (kind === "multiple_button") {
    return renderMultipleButtonRow(w, panelData);
  }

  if (kind === "action") {
    return renderActionRow(w);
  }

  if (kind === "subpanel") {
    return renderSubpanelRow(w);
  }

  if (kind === "custom") {
    if (w.custom === "ssh_keys") return renderSshKeysBlock();
    if (w.custom === "device_language") return renderLanguageRow();
    if (w.custom === "driver_camera") return renderDriverCameraRow();
    if (w.custom === "always_offroad") {
      const active = !!deviceExtrasCache?.offroad_mode;
      if (!globalState.is_offroad && !active) return null;
      return renderAlwaysOffroadRow(active);
    }
    if (w.custom === "device_calibration") return null;
    return null;
  }

  if (!w.available && w.missing) return null;

  if (kind === "readonly") {
    return renderReadonlyRow(w);
  }

  if (kind === "bool") {
    return renderBoolRow(w);
  }

  if (kind === "choice") {
    return renderChoiceRow(w);
  }

  if (kind === "int") {
    return renderIntRow(w);
  }

  return null;
}

function renderReadonlyRow(w) {
  const row = document.createElement("div");
  row.className = "opui-sp-row";
  row.dataset.param = w.param;
  row.dataset.widget = "readonly";
  const val = formatValue(w.value) || t("N/A");
  row.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t(w.label))}</div>
    </div>
    <div class="opui-row-value">${escapeHtml(val)}</div>`;
  return row;
}

function renderBoolRow(w) {
  const row = createSpToggle({ ...w, label: t(w.label), desc: w.desc ? t(w.desc) : "" }, {}, globalState, paramHandlers);
  row.dataset.param = w.param;
  row.dataset.widget = "bool";
  if (w.needs_cycle) row.dataset.needsCycle = "1";
  if (w.offroad_only) row.dataset.offroadOnly = "1";
  return row;
}

function renderMultipleButtonRow(w, panelData) {
  const row = document.createElement("div");
  row.className = "opui-sp-row opui-sp-row--stacked";
  row.dataset.param = w.param;
  row.dataset.widget = "multiple_button";
  const buttons = (w.buttons || []).map((b) => t(b));
  let idx = parseInt(w.value, 10);
  if (Number.isNaN(idx)) idx = 0;

  const text = document.createElement("div");
  text.className = "opui-sp-row-text";
  text.innerHTML = `
    <div class="opui-sp-row-title">${escapeHtml(t(w.label))}</div>
    ${w.desc ? `<div class="opui-sp-row-desc">${escapeHtml(t(w.desc)).replace(/\n/g, "<br>")}</div>` : ""}`;
  row.appendChild(text);

  const group = document.createElement("div");
  group.className = "opui-multi-btn-group";
  buttons.forEach((label, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.classList.toggle("selected", i === idx);
    const disabled = (w.offroad_only && !globalState.is_offroad) || w.locked;
    if (disabled) btn.disabled = true;
    btn.addEventListener("click", async () => {
      const res = await putParam(w.param, String(i), !!w.needs_cycle);
      if (!res.ok) {
        toast(res.error || t("Save failed"));
        return;
      }
      w.value = String(i);
      if (panelData.values) panelData.values[w.param] = String(i);
      group.querySelectorAll("button").forEach((b, j) => b.classList.toggle("selected", j === i));
    });
    group.appendChild(btn);
  });
  row.appendChild(group);
  return row;
}

function requestPanelRefresh() {
  window.dispatchEvent(new CustomEvent("opui:refresh-panel"));
}

function renderChoiceRow(w) {
  const row = document.createElement("div");
  row.className = "opui-sp-row opui-sp-row--stacked";
  row.dataset.param = w.param;
  row.dataset.widget = "choice";
  const opts = (w.options || []).map((o) => t(o));
  let idx = parseInt(w.value, 10);
  if (Number.isNaN(idx)) idx = 0;

  const text = document.createElement("div");
  text.className = "opui-sp-row-text";
  text.innerHTML = `
    <div class="opui-sp-row-title">${escapeHtml(t(w.label))}</div>
    ${w.desc ? `<div class="opui-sp-row-desc">${escapeHtml(t(w.desc)).replace(/\n/g, "<br>")}</div>` : ""}`;
  row.appendChild(text);

  const group = document.createElement("div");
  group.className = "opui-choice-group";
  opts.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = opt;
    btn.classList.toggle("selected", i === idx);
    btn.addEventListener("click", async () => {
      group.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      const res = await putParam(w.param, String(i));
      if (!res.ok) toast(res.error || t("Save failed"));
    });
    group.appendChild(btn);
  });
  row.appendChild(group);
  return row;
}

function renderIntRow(w) {
  const row = document.createElement("div");
  row.className = "opui-sp-row";
  let val = parseInt(w.value, 10);
  if (Number.isNaN(val)) val = w.min || 0;
  const min = w.min ?? 0;
  const max = w.max ?? 100;
  const step = w.step ?? 1;

  row.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t(w.label))}</div>
    </div>`;
  const ctrl = document.createElement("div");
  ctrl.className = "opui-int-control";
  const minus = document.createElement("button");
  minus.type = "button";
  minus.textContent = "−";
  const span = document.createElement("span");
  span.textContent = String(val);
  const plus = document.createElement("button");
  plus.type = "button";
  plus.textContent = "+";

  const save = async (v) => {
    v = Math.max(min, Math.min(max, v));
    span.textContent = String(v);
    const res = await putParam(w.param, String(v));
    if (!res.ok) toast(res.error || "保存失败");
  };

  minus.addEventListener("click", () => { val = Math.max(min, val - step); save(val); });
  plus.addEventListener("click", () => { val = Math.min(max, val + step); save(val); });

  ctrl.append(minus, span, plus);
  row.appendChild(ctrl);
  return row;
}

function renderSubpanelRow(w) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "opui-simple-btn";
  btn.textContent = t(w.label);
  btn.addEventListener("click", () => {
    if (onNavigateSubpanel && w.target) onNavigateSubpanel(w.target);
  });
  return btn;
}

function formatMaxTimeLabel(index, valueMap) {
  const minutes = valueMap?.[String(index)];
  if (minutes === 0) return t("Always On");
  if (minutes == null) return String(index);
  if (minutes < 60) return `${minutes}${t("m")}`;
  const hours = Math.floor(minutes / 60);
  const label = `${hours}${t("h")}`;
  return minutes === 1800 ? `${label}${t(" (Default)")}` : label;
}

function renderOptionRow(w, panelData) {
  const row = document.createElement("div");
  row.className = "opui-sp-row opui-sp-row--stacked";
  const valueMap = w.value_map || {};
  let idx = parseInt(w.value, 10);
  if (Number.isNaN(idx)) idx = w.min || 0;
  const min = w.min ?? 0;
  const max = w.max ?? 11;
  const step = w.step ?? 1;

  const text = document.createElement("div");
  text.className = "opui-sp-row-text";
  text.innerHTML = `
    <div class="opui-sp-row-title">${escapeHtml(t(w.label))}</div>
    ${w.desc ? `<div class="opui-sp-row-desc">${escapeHtml(t(w.desc)).replace(/\n/g, "<br>")}</div>` : ""}`;
  row.appendChild(text);

  const ctrl = document.createElement("div");
  ctrl.className = "opui-int-control";
  const minus = document.createElement("button");
  minus.type = "button";
  minus.textContent = "−";
  const span = document.createElement("span");
  span.textContent = formatOptionLabel(w, idx);
  const plus = document.createElement("button");
  plus.type = "button";
  plus.textContent = "+";

  const save = async (v) => {
    idx = Math.max(min, Math.min(max, v));
    span.textContent = formatOptionLabel(w, idx);
    const res = await putParam(w.param, String(idx));
    if (!res.ok) toast(res.error || t("Save failed"));
    else {
      w.value = String(idx);
      if (panelData?.values) panelData.values[w.param] = String(idx);
    }
  };
  minus.addEventListener("click", () => save(idx - step));
  plus.addEventListener("click", () => save(idx + step));
  ctrl.append(minus, span, plus);
  row.appendChild(ctrl);
  return row;
}

async function showTrainingGuide() {
  const pages = [
    `<h2>${t("Training Guide")}</h2><p>${t("Review the rules, features, and limitations of sunnypilot")}</p>`,
    `<h3>${t("Driver Monitoring")}</h3><p>${t("Keep your hands on the wheel and eyes on the road at all times.")}</p>`,
    `<h3>${t("Takeover")}</h3><p>${t("Be ready to take over at any time. sunnypilot is not a substitute for an attentive driver.")}</p>`,
  ];
  for (let i = 0; i < pages.length; i++) {
    const cont = i < pages.length - 1;
    const ok = await showConfirm({
      rich: true,
      message: pages[i] + (cont ? `<br><br><i>${i + 1} / ${pages.length}</i>` : ""),
      confirmText: cont ? t("Next") : t("Done"),
      cancelText: t("Close"),
      single: !cont,
    });
    if (!ok && cont) break;
  }
}

async function runDualSideAction(side) {
  if (side.custom === "driver_camera") {
    const dlg = document.getElementById("driver-camera-dialog");
    dlg?.showModal();
    document.getElementById("driver-cam-close")?.addEventListener("click", () => dlg?.close(), { once: true });
    return;
  }
  if (side.action === "open_regulatory") {
    const reg = await apiGet("/api/opui/device/regulatory");
    await showHtml({
      title: t("Regulatory"),
      html: reg.ok ? reg.html : `<p>${t("Regulatory information unavailable")}</p>`,
    });
    return;
  }
  if (side.action === "open_training") {
    await showTrainingGuide();
    return;
  }
  if (side.action === "reset_all_params") {
    if (!(await showConfirm({
      message: t("Are you sure you want to reset all sunnypilot settings to default? Once the settings are reset, there is no going back."),
      confirmText: t("Reset"),
    }))) return;
    if (!(await showConfirm({
      message: t("The reset cannot be undone. You have been warned."),
      confirmText: t("Confirm"),
    }))) return;
    const res = await apiPost("/api/opui/action/reset_all_params");
    if (res.ok) toast(t("Reset Settings"));
    else toast(res.error || "Failed");
    return;
  }
  if (side.action) {
    if (side.confirm && !(await showConfirm({ message: t(side.confirm), confirmText: t("Yes") }))) return;
    const res = await apiPost(`/api/opui/action/${encodeURIComponent(side.action)}`);
    if (res.ok) toast(t(side.label));
    else toast(res.error || "Failed");
  }
}

function renderDualButtonRow(w) {
  const left = w.left || {};
  const right = w.right || {};
  const offroad = globalState.is_offroad;

  const row = document.createElement("div");
  row.className = "opui-dual-row";
  const lBtn = document.createElement("button");
  lBtn.type = "button";
  lBtn.className = "opui-dual-btn";
  lBtn.textContent = t(left.label);
  const rBtn = document.createElement("button");
  rBtn.type = "button";
  rBtn.className = "opui-dual-btn";
  rBtn.textContent = t(right.label);

  if (left.toggle) {
    const on = left.value === "1" || left.value === "true";
    lBtn.classList.toggle("primary", on);
  }
  if (right.toggle) {
    const on = right.value === "1" || right.value === "true";
    rBtn.classList.toggle("primary", on);
  }
  if (left.offroad_only && !offroad) lBtn.disabled = true;
  if (right.offroad_only && !offroad) rBtn.disabled = true;
  if (right.hide_when_onroad && !offroad) {
    rBtn.remove();
  } else if (left.hide_when_onroad && !offroad) {
    lBtn.remove();
  }

  lBtn.addEventListener("click", async () => {
    if (left.toggle && left.param) {
      const on = !(left.value === "1" || left.value === "true");
      const res = await apiPut(`/api/opui/params/${encodeURIComponent(left.param)}`, { value: on ? "1" : "0" });
      if (res.ok) {
        lBtn.classList.toggle("primary", on);
        left.value = on ? "1" : "0";
      } else toast(res.error || "Failed");
      return;
    }
    await runDualSideAction(left);
  });
  rBtn.addEventListener("click", async () => {
    if (right.toggle && right.param) {
      const on = !(right.value === "1" || right.value === "true");
      const res = await apiPut(`/api/opui/params/${encodeURIComponent(right.param)}`, { value: on ? "1" : "0" });
      if (res.ok) {
        rBtn.classList.toggle("primary", on);
        right.value = on ? "1" : "0";
      } else toast(res.error || "Failed");
      return;
    }
    await runDualSideAction(right);
  });

  row.append(lBtn, rBtn);
  return row;
}

function renderSshKeysBlock() {
  const block = document.createElement("div");
  block.className = "opui-ssh-block";
  block.innerHTML = `
    <div class="opui-row opui-row--section">GitHub SSH Keys</div>
    <div class="opui-row">
      <input type="text" class="opui-input" id="ssh-username" placeholder="GitHub username" />
      <button type="button" class="opui-btn" id="ssh-fetch">FETCH</button>
      <button type="button" class="opui-btn" id="ssh-remove">REMOVE</button>
    </div>
    <pre class="opui-ssh-keys" id="ssh-keys-preview">加载中…</pre>`;

  const refresh = async () => {
    const st = await apiGet("/api/opui/ssh/status");
    const pre = block.querySelector("#ssh-keys-preview");
    const input = block.querySelector("#ssh-username");
    if (!st.ok) {
      if (pre) pre.textContent = st.error || "SSH 不可用";
      return;
    }
    if (input && st.username) input.value = st.username;
    if (pre) pre.textContent = st.keys || "(no keys)";
  };

  block.querySelector("#ssh-fetch")?.addEventListener("click", async () => {
    const username = block.querySelector("#ssh-username")?.value || "";
    const res = await apiPost("/api/opui/ssh/fetch", { username });
    if (res.ok) toast("SSH keys 已更新");
    else toast(res.error || "获取失败");
    refresh();
  });
  block.querySelector("#ssh-remove")?.addEventListener("click", async () => {
    const res = await apiPost("/api/opui/ssh/remove");
    if (res.ok) toast("SSH keys 已删除");
    refresh();
  });
  refresh();
  return block;
}

function renderActionRow(w) {
  const row = document.createElement("div");
  row.className = "opui-sp-row";
  if (w.action) row.dataset.action = w.action;
  const disabled = (w.offroad_only && !globalState.is_offroad) || (globalState.engaged && w.action === "reset_calibration");
  let desc = w.desc ? t(w.desc) : "";
  if (w.dynamic_desc === "calibration" && deviceExtrasCache?.calibration?.desc_html) {
    desc = deviceExtrasCache.calibration.desc_html.replace(/<[^>]+>/g, " ").trim();
  }
  row.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t(w.label))}</div>
      ${desc ? `<div class="opui-sp-row-desc">${escapeHtml(desc)}</div>` : ""}
    </div>
    <div class="opui-row-actions">
      <button type="button" class="opui-btn" ${disabled ? "disabled" : ""}>${escapeHtml(t(w.button || "GO"))}</button>
    </div>`;
  const btn = row.querySelector("button");
  if (disabled) {
    btn.disabled = true;
    return row;
  }
  btn.addEventListener("click", async () => {
    if (w.action === "reset_calibration" && globalState.engaged) {
      toast(t("Disengage to Reset Calibration"));
      return;
    }
    if (w.confirm && !(await showConfirm({ message: t(w.confirm), confirmText: t("Yes") }))) return;
    if (w.action === "pair_device") {
      window.open("https://connect.comma.ai/", "_blank");
      return;
    }
    if (w.action === "developer_error_log") {
      const log = await apiGet("/api/opui/developer/error-log");
      if (!log.ok) {
        toast(log.error || "Failed");
        return;
      }
      await showHtml({ title: t("Error Log"), html: log.html || "" });
      if (log.exists && (await showConfirm({ message: t("Would you like to delete this log?"), confirmText: t("Yes") }))) {
        await apiPost("/api/opui/action/developer_delete_error_log");
        toast(t("Log deleted"));
      }
      return;
    }
    if (w.action === "torque_tune_version") {
      const versions = ["Default", "v1", "v2", "v3"];
      const pick = await showMultiOption({ title: t("Torque Control Tune Version"), options: versions, selected: 0 });
      if (pick == null) return;
      const val = pick === 0 ? "" : String(pick);
      if (val) await apiPut("/api/opui/params/TorqueControlTune", { value: val });
      else await apiPut("/api/opui/params/TorqueControlTune", { value: "" });
      toast(t("Torque tune updated"));
      return;
    }
    if (w.action === "network_set_apn") {
      const apn = await showKeyboard({ title: t("APN"), value: "", maxLen: 64 });
      if (apn == null) return;
      const res = await apiPost("/api/opui/action/network_set_apn", { apn });
      if (res.ok) toast(t("APN saved"));
      else toast(res.error || "Failed");
      return;
    }
    const res = await apiPost(`/api/opui/action/${encodeURIComponent(w.action)}`);
    if (res.ok) toast(t(w.label));
    else toast(res.error || "Failed");
  });
  return row;
}

async function renderNetworkPanel(container, data) {
  renderGenericPanel(container, data);
  const toolbar = document.createElement("div");
  toolbar.className = "opui-row";
  toolbar.innerHTML = `<button type="button" class="opui-btn" id="wifi-scan">SCAN</button>`;
  container.appendChild(toolbar);

  const list = document.createElement("div");
  list.className = "opui-wifi-list";
  container.appendChild(list);

  const paint = async () => {
    list.innerHTML = `<p class="opui-muted" style="padding:24px">Scanning…</p>`;
    const scan = await apiGet("/api/opui/wifi/scan");
    list.innerHTML = "";
    if (!scan.ok) {
      list.innerHTML = `<p class="opui-muted" style="padding:24px">Wi-Fi unavailable: ${scan.error}</p>`;
      return;
    }
    for (const n of scan.networks || []) {
      const item = document.createElement("div");
      item.className = "opui-wifi-item" + (n.connected ? " connected" : "");
      item.innerHTML = `
        <span>${escapeHtml(n.ssid)}</span>
        <span>${n.strength}%</span>
        <button type="button" class="opui-btn opui-btn--small">${n.connected ? "FORGET" : "CONNECT"}</button>`;
      const btn = item.querySelector("button");
      btn?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (n.connected) {
          if (!(await showConfirm({ message: `Forget ${n.ssid}?`, confirmText: "Forget" }))) return;
          const res = await apiPost("/api/opui/wifi/forget", { ssid: n.ssid });
          if (res.ok) toast(`Forgot ${n.ssid}`);
          paint();
          return;
        }
        let password = "";
        if (n.security > 0) {
          password = await showKeyboard({
            title: `Password (${n.ssid})`,
            password: true,
            minLen: 8,
            maxLen: 64,
          }) || "";
          if (!password) return;
        }
        const res = await apiPost("/api/opui/wifi/connect", { ssid: n.ssid, password });
        if (res.ok) toast(`Connecting ${n.ssid}`);
        else toast(res.error || "Connect failed");
      });
      list.appendChild(item);
    }
  };
  toolbar.querySelector("#wifi-scan")?.addEventListener("click", paint);
  paint();
}

async function renderTripsPanel(container, data) {
  container.innerHTML = "";
  const trips = await apiGet("/api/opui/trips");
  if (!trips.ok) {
    container.innerHTML = `<p class="opui-muted" style="padding:48px">${escapeHtml(trips.error || "")}</p>`;
    return;
  }
  const s = trips.stats || {};
  const metric = globalState.is_metric;
  for (const [title, key] of [["All Time", "all"], ["This Week", "week"]]) {
    const block = s[key] || {};
    const card = document.createElement("div");
    card.className = "opui-trips-card";
    const dist = block.distance ?? 0;
    const distStr = metric ? Math.round(dist * 1.60934) : Math.round(dist);
    const unit = metric ? "KM" : "Miles";
    card.innerHTML = `
      <div class="opui-trips-title">${title}</div>
      <div class="opui-trips-cols">
        <div class="opui-trips-col"><div class="opui-trips-num">${block.routes || 0}</div><div class="opui-trips-unit">Drives</div></div>
        <div class="opui-trips-col"><div class="opui-trips-num">${distStr}</div><div class="opui-trips-unit">${unit}</div></div>
        <div class="opui-trips-col"><div class="opui-trips-num">${Math.round((block.minutes || 0) / 60)}</div><div class="opui-trips-unit">Hours</div></div>
      </div>`;
    container.appendChild(card);
  }
}

function formatStat(v) {
  if (v == null) return "—";
  if (typeof v === "number") return v.toFixed?.(1) ?? v;
  return String(v);
}

async function renderModelsPanel(container, data) {
  renderGenericPanel(container, data);
  const m = await apiGet("/api/opui/models");
  if (!m.ok) return;

  const pickRow = document.createElement("div");
  pickRow.className = "opui-sp-row";
  pickRow.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">Current Model</div>
      <div class="opui-sp-row-desc">${escapeHtml(m.active_name || m.active_ref || "—")}</div>
    </div>
    <button type="button" class="opui-btn">SELECT</button>`;
  pickRow.querySelector("button")?.addEventListener("click", async () => {
    const ref = await showTree({
      title: "Select Model",
      folders: m.tree || [],
      selectedRef: m.active_ref,
      searchable: true,
    });
    if (!ref) return;
    const bundle = (m.tree || []).flatMap((f) => f.bundles || []).find((b) => b.ref === ref);
    const res = await apiPost("/api/opui/models/select", { ref, index: bundle?.index });
    if (res.ok) {
      toast("Model selected");
      await renderModelsPanel(container, data);
    } else toast(res.error || "Failed");
  });
  container.appendChild(pickRow);

  if (m.download?.name) {
    const types = ["Driving Model", "Vision Model", "Policy Model", "Off-Policy Model", "On-Policy Model"];
    const parts = m.download.models?.length ? m.download.models : types.map((type) => ({ type, progress: 0 }));
    for (const part of parts) {
      container.appendChild(createProgressRow(`${part.type} — ${m.download.name}`, part.progress || 0));
    }
    const cancel = document.createElement("div");
    cancel.className = "opui-sp-row";
    cancel.innerHTML = `<div class="opui-sp-row-text"><div class="opui-sp-row-title">${t("Cancel Download")}</div></div>
      <button type="button" class="opui-btn danger">${t("Cancel")}</button>`;
    cancel.querySelector("button")?.addEventListener("click", async () => {
      await apiPost("/api/opui/action/models_cancel_download");
      toast(t("Download cancelled"));
    });
    container.appendChild(cancel);
  }
}

async function renderOsmPanel(container, data) {
  renderGenericPanel(container, data);
  const [regions, size, prog] = await Promise.all([
    apiGet("/api/opui/osm/regions"),
    apiGet("/api/opui/osm/size"),
    apiGet("/api/opui/osm/progress"),
  ]);

  const block = document.createElement("div");
  block.className = "opui-osm-tree";
  if (size.ok) {
    const sz = document.createElement("div");
    sz.className = "opui-sp-row";
    sz.innerHTML = `<div class="opui-sp-row-text"><div class="opui-sp-row-title">Downloaded Maps</div>
      <div class="opui-sp-row-desc">${size.size_mb} MB</div></div>
      <button type="button" class="opui-btn danger">DELETE</button>`;
    sz.querySelector("button")?.addEventListener("click", async () => {
      if (!(await showConfirm({ message: t("Delete ALL downloaded maps?"), confirmText: t("Delete") }))) return;
      const res = await apiPost("/api/opui/osm/delete");
      if (res.ok) toast(t("Delete requested"));
      else toast(res.error || "Failed");
    });
    block.appendChild(sz);
  }
  if (prog.ok && prog.active) {
    block.appendChild(createProgressRow("Downloading Map", prog.progress || 0));
  }

  const countryBtn = document.createElement("button");
  countryBtn.type = "button";
  countryBtn.className = "opui-simple-btn";
  countryBtn.textContent = "SELECT Country";
  countryBtn.addEventListener("click", async () => {
    const folders = (regions.countries || []).map((c) => ({
      name: c.title,
      bundles: [{ ref: c.name, name: c.title }],
    }));
    const ref = await showTree({ title: t("Country"), folders, searchable: true });
    if (!ref) return;
    const c = regions.countries.find((x) => x.name === ref);
    if (!c) return;
    if (c.states?.length) {
      const stateFolders = [{
        name: c.title,
        bundles: c.states.map((s) => ({ ref: `${c.name}/${s.name}`, name: s.title })),
      }];
      const stateRef = await showTree({ title: t("State"), folders: stateFolders, searchable: true });
      if (!stateRef) return;
      const [country, state] = stateRef.split("/");
      const st = c.states.find((s) => s.name === state);
      await apiPost("/api/opui/osm/select", {
        country, country_title: c.title, state, state_title: st?.title || state,
      });
      toast(`${c.title} — ${st?.title || state}`);
      return;
    }
    await apiPost("/api/opui/osm/select", { country: c.name, country_title: c.title });
    toast(`${t("Country")}: ${c.title}`);
  });
  block.appendChild(countryBtn);
  container.appendChild(block);
}

async function renderVehiclePanel(container, data) {
  renderGenericPanel(container, data);
  const vp = await apiGet("/api/opui/vehicle/platforms");
  if (!vp.ok) return;

  const pickRow = document.createElement("div");
  pickRow.className = "opui-sp-row";
  pickRow.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${t("Vehicle Platform")}</div>
      <div class="opui-sp-row-desc">${escapeHtml(vp.active || t("Not selected"))}</div>
    </div>
    <button type="button" class="opui-btn">${vp.active ? t("REMOVE") : t("SELECT")}</button>`;
  pickRow.querySelector("button")?.addEventListener("click", async () => {
    if (vp.active) {
      if (!(await showConfirm({ message: t("Remove manual platform fingerprint?"), confirmText: t("Remove") }))) return;
      await apiPost("/api/opui/vehicle/select", { bundle: "" });
      toast(t("Platform removed"));
      await renderVehiclePanel(container, data);
      return;
    }
    const folders = (vp.tree || []).map((b) => ({
      name: b.name,
      bundles: (b.platforms || []).map((p) => ({ ref: p.bundle, name: p.label })),
    }));
    const ref = await showTree({ title: t("Select Vehicle"), folders, searchable: true });
    if (!ref) return;
    if (!(await showConfirm({ message: t("Force this vehicle fingerprint?"), confirmText: t("Select") }))) return;
    const res = await apiPost("/api/opui/vehicle/select", { bundle: ref });
    if (res.ok) {
      toast(t("Platform selected"));
      await renderVehiclePanel(container, data);
    }
  });
  container.appendChild(pickRow);

  const bw = await apiGet("/api/opui/vehicle/brand-widgets");
  if (bw.ok && bw.widgets?.length) {
    const hdr = document.createElement("div");
    hdr.className = "opui-row opui-row--section";
    hdr.textContent = `${t("Brand Settings")} (${bw.brand || ""})`;
    container.appendChild(hdr);
    const brandData = { values: { ...data.values, ...bw.values } };
    for (const w of bw.widgets) {
      const el = renderWidget(w, brandData);
      if (el) container.appendChild(el);
    }
  }

  const legend = document.createElement("div");
  legend.className = "opui-vehicle-legend";
  legend.innerHTML = `
    <p><span class="dot green"></span> ${t("Fingerprinted automatically")}</p>
    <p><span class="dot blue"></span> ${t("Manually selected")}</p>
    <p><span class="dot yellow"></span> ${t("Not fingerprinted")}</p>`;
  container.appendChild(legend);
}

function renderLanguageRow() {
  const row = document.createElement("div");
  row.className = "opui-sp-row";
  const current = deviceExtrasCache?.languages?.find((l) => l.id === deviceExtrasCache?.current_language);
  row.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Change Language"))}</div>
      ${current ? `<div class="opui-sp-row-desc">${escapeHtml(current.label)}</div>` : ""}
    </div>
    <button type="button" class="opui-btn">${escapeHtml(t("CHANGE"))}</button>`;
  row.querySelector("button")?.addEventListener("click", async () => {
    const ex = deviceExtrasCache || await apiGet("/api/opui/device/extras");
    if (!ex.ok) return;
    const langs = ex.languages || [];
    const idx = langs.findIndex((l) => l.id === ex.current_language);
    const pick = await showMultiOption({
      title: t("Select a language"),
      options: langs.map((l) => l.label),
      selected: Math.max(0, idx),
    });
    if (pick == null) return;
    const lang = langs[pick];
    if (!lang) return;
    const res = await apiPost("/api/opui/device/language", { language: lang.id });
    if (res.ok) {
      toast(`${t("Language")}: ${lang.label}`);
      deviceExtrasCache = { ...ex, current_language: lang.id };
    }
  });
  return row;
}

function renderDriverCameraRow() {
  const row = document.createElement("div");
  row.className = "opui-sp-row";
  const disabled = !globalState.is_offroad;
  row.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Driver Camera"))}</div>
      <div class="opui-sp-row-desc">${escapeHtml(t("Preview the driver facing camera to ensure that driver monitoring has good visibility. (vehicle must be off)"))}</div>
    </div>
    <button type="button" class="opui-btn" ${disabled ? "disabled" : ""}>${escapeHtml(t("PREVIEW"))}</button>`;
  if (!disabled) {
    row.querySelector("button")?.addEventListener("click", async () => {
      const dlg = document.getElementById("driver-camera-dialog");
      dlg?.showModal();
      document.getElementById("driver-cam-close")?.addEventListener("click", () => dlg?.close(), { once: true });
    });
  }
  return row;
}

async function renderSunnylinkPanel(container, data) {
  renderGenericPanel(container, data);
  const sl = await apiGet("/api/opui/sunnylink/status");
  if (!sl.ok) return;
  const hdr = document.createElement("div");
  hdr.className = "opui-sunnylink-header";
  hdr.innerHTML = `<h2>sunnylink</h2><p style="color:${sl.tier_color}">${escapeHtml(sl.description || "")}</p>`;
  container.prepend(hdr);

  if (sl.backup?.status && sl.backup.status !== "idle") {
    container.appendChild(createProgressRow(`${t("Backup")} ${sl.backup.status}`, sl.backup.progress || 0));
  }

  const dual = createDualButton(
    { label: t("Create Backup") },
    { label: t("Restore Latest") },
    async () => {
      const res = await apiPost("/api/opui/action/sunnylink_backup");
      if (res.ok) toast(t("Backup started"));
      else toast(res.error || "Failed");
    },
    async () => {
      if (!(await showConfirm({ message: t("Restore latest backup?"), confirmText: t("Restore") }))) return;
      const res = await apiPost("/api/opui/action/sunnylink_restore");
      if (res.ok) toast(t("Restore started"));
      else toast(res.error || "Failed");
    },
  );
  container.appendChild(dual);

  const pair = document.createElement("div");
  pair.className = "opui-sp-row";
  pair.innerHTML = `<div class="opui-sp-row-text"><div class="opui-sp-row-title">${t("Pair GitHub")}</div></div>
    <button type="button" class="opui-btn">${t("PAIR")}</button>`;
  pair.querySelector("button")?.addEventListener("click", async () => {
    const r = await apiGet("/api/opui/sunnylink/pair");
    if (r.ok && r.url) window.open(r.url, "_blank");
  });
  container.appendChild(pair);
}

async function renderFirehosePanel(container) {
  const fh = await apiGet("/api/opui/firehose");
  if (!fh.ok) {
    container.innerHTML = `<p class="opui-muted" style="padding:48px">${escapeHtml(fh.error || "")}</p>`;
    return;
  }
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "opui-firehose-wrap";

  const title = document.createElement("h2");
  title.className = "opui-firehose-h";
  title.textContent = t("Firehose Mode");
  wrap.appendChild(title);

  const desc = document.createElement("p");
  desc.className = "opui-firehose-desc";
  desc.textContent = t(
    "sunnypilot learns to drive by watching humans, like you, drive.\n\n"
    + "Firehose Mode allows you to maximize your training data uploads to improve "
    + "openpilot's driving models. More data means bigger models, which means better Experimental Mode."
  );
  wrap.appendChild(desc);

  wrap.appendChild(document.createElement("hr"));

  const statusColor = fh.active ? "#2ecc71" : "#e74c3c";
  const status = document.createElement("p");
  status.id = "firehose-status-text";
  status.className = "opui-firehose-status";
  status.style.color = statusColor;
  status.textContent = fh.active ? t("ACTIVE") : t("INACTIVE");
  wrap.appendChild(status);

  if (fh.segments > 0) {
    const seg = document.createElement("p");
    seg.className = "opui-firehose-segments";
    seg.textContent = `${fh.segments} ${t("segments in training dataset")}`;
    wrap.appendChild(seg);
  }

  const net = document.createElement("div");
  net.className = "opui-sp-row";
  net.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Network"))}</div>
      <div class="opui-sp-row-desc">${escapeHtml(fh.network_type || "--")}${fh.metered ? ` (${t("metered")})` : ""}</div>
    </div>`;
  wrap.appendChild(net);

  wrap.appendChild(document.createElement("hr"));

  const instructions = document.createElement("div");
  instructions.className = "opui-firehose-instructions";
  instructions.innerHTML = `
    <p>${escapeHtml(t("For maximum effectiveness, bring your device inside and connect to a good USB-C adapter and Wi-Fi weekly."))}</p>
    <p>${escapeHtml(t("Firehose Mode can also work while you're driving if connected to a hotspot or unlimited SIM card."))}</p>
    <h3>${escapeHtml(t("Frequently Asked Questions"))}</h3>
    <p><strong>${escapeHtml(t("Does it matter how or where I drive?"))}</strong> ${escapeHtml(t("Nope, just drive as you normally would."))}</p>
    <p><strong>${escapeHtml(t("Do all of my segments get pulled in Firehose Mode?"))}</strong> ${escapeHtml(t("No, we selectively pull a subset of your segments."))}</p>
    <p><strong>${escapeHtml(t("What's a good USB-C adapter?"))}</strong> ${escapeHtml(t("Any fast phone or laptop charger should be fine."))}</p>
    <p><strong>${escapeHtml(t("Does it matter which software I run?"))}</strong> ${escapeHtml(t("Yes, only upstream openpilot (and particular forks) are able to be used for training."))}</p>`;
  wrap.appendChild(instructions);

  container.appendChild(wrap);
}

async function renderSoftwarePanel(container, data) {
  const sw = await apiGet("/api/opui/software");
  container.innerHTML = "";
  if (!sw.ok) {
    container.innerHTML = `<p class="opui-muted" style="padding:48px">${escapeHtml(sw.error || t("Failed"))}</p>`;
    return;
  }

  if (sw.is_onroad) {
    const warn = document.createElement("div");
    warn.id = "software-onroad-warn";
    warn.className = "opui-row opui-row--warn";
    warn.textContent = t("Updates are only downloaded while the car is off.");
    container.appendChild(warn);
  }

  const version = document.createElement("div");
  version.className = "opui-sp-row opui-sp-row--stacked";
  version.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Current Version"))}</div>
      <div class="opui-sp-row-desc" id="software-current-desc">${escapeHtml(sw.current || t("N/A"))}</div>
      <pre class="opui-release-notes" id="software-current-notes" hidden></pre>
    </div>`;
  container.appendChild(version);

  const download = document.createElement("div");
  download.className = "opui-sp-row";
  download.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Download"))}</div>
      <div class="opui-sp-row-desc" id="software-download-value"></div>
    </div>
    <button type="button" class="opui-btn" id="software-download-btn">${escapeHtml(t("CHECK"))}</button>`;
  download.querySelector("#software-download-btn")?.addEventListener("click", async () => {
    const btn = download.querySelector("#software-download-btn");
    const label = btn?.textContent?.trim().toUpperCase();
    const action = label === "DOWNLOAD" ? "updater_download" : "updater_check";
    if (btn) btn.disabled = true;
    const res = await apiPost(`/api/opui/action/${action}`);
    if (!res.ok) toast(res.error || t("Failed"));
  });
  container.appendChild(download);

  const install = document.createElement("div");
  install.id = "software-install-row";
  install.className = "opui-sp-row opui-sp-row--stacked";
  install.hidden = true;
  install.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Install Update"))}</div>
      <div class="opui-sp-row-desc" id="software-install-value"></div>
      <pre class="opui-release-notes" id="software-install-notes" hidden></pre>
    </div>
    <button type="button" class="opui-btn" id="software-install-btn">${escapeHtml(t("INSTALL"))}</button>`;
  install.querySelector("#software-install-btn")?.addEventListener("click", async () => {
    const res = await apiPost("/api/opui/action/updater_install");
    if (res.ok) toast(t("Install Update"));
    else toast(res.error || t("Failed"));
  });
  container.appendChild(install);

  const filtered = {
    ...data,
    widgets: (data.widgets || []).filter((w) => !["updater_check", "updater_download", "updater_install"].includes(w.action)
      && w.param !== "UpdaterCurrentDescription"),
  };
  const genericHost = document.createElement("div");
  container.appendChild(genericHost);
  renderGenericPanel(genericHost, filtered);

  if (sw.branches?.length) {
    const branchRow = document.createElement("div");
    branchRow.className = "opui-sp-row";
    branchRow.innerHTML = `
      <div class="opui-sp-row-text">
        <div class="opui-sp-row-title">${escapeHtml(t("Target Branch"))}</div>
        <div class="opui-sp-row-desc">${escapeHtml(sw.target_branch || t("N/A"))}</div>
      </div>
      <button type="button" class="opui-btn">${escapeHtml(t("SELECT"))}</button>`;
    branchRow.querySelector("button")?.addEventListener("click", async () => {
      const idx = Math.max(0, sw.branches.indexOf(sw.target_branch));
      const pick = await showMultiOption({ title: t("Target Branch"), options: sw.branches, selected: idx });
      if (pick == null) return;
      const b = sw.branches[pick];
      const res = await apiPost("/api/opui/action/set_branch", { branch: b });
      if (res.ok) toast(`${t("Target Branch")}: ${b}`);
    });
    container.appendChild(branchRow);
  }

  applySoftwareCustom(sw);
}

function formatValue(v) {
  if (v == null || v === "") return "—";
  if (v.length > 200) return v.slice(0, 200) + "…";
  return v;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
