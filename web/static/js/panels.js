import { apiGet, apiPost, apiPut, toast } from "./api.js";
import { tr } from "./i18n.js";
import { opuiWs } from "./ws.js";
import {
  showConfirm, showKeyboard, showTree, showHtml, showMultiOption,
  createSpToggle, createProgressRow, createDualButton, bindRowExpand,
} from "./components.js";

function t(s) {
  return tr(s);
}

function formatTimeAgo(ts) {
  if (ts == null || ts === "") return t("never");
  const sec = typeof ts === "number" ? ts : parseFloat(String(ts));
  if (!sec || Number.isNaN(sec)) return t("never");
  const date = new Date(sec * 1000);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return t("now");
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return (m === 1 ? t("{} minute ago") : t("{} minutes ago")).replace("{}", String(m));
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return (h === 1 ? t("{} hour ago") : t("{} hours ago")).replace("{}", String(h));
  }
  if (diff < 604800) {
    const d = Math.floor(diff / 86400);
    return (d === 1 ? t("{} day ago") : t("{} days ago")).replace("{}", String(d));
  }
  const lang = document.documentElement.lang || "en";
  return date.toLocaleDateString(lang.startsWith("zh") ? "zh-CN" : "en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatLastChecked(ts) {
  return t("Last checked {}").replace("{}", formatTimeAgo(ts));
}

function platformDisplayText(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value.name || value.platform || value.bundle || "";
  }
  return String(value);
}

function paramIsOn(val) {
  const v = String(val ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

function resolveWidgetType(w) {
  const known = new Set([
    "section", "separator", "html", "action", "subpanel", "custom", "dual_button", "option",
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
  if (w.hide_when_paired && homeState.paired) return false;
  if (w.advanced_if) {
    const adv = panelData.values?.[w.advanced_if.param];
    if (String(adv) !== String(w.advanced_if.eq)) return false;
  }
  if (!w.visible_if) return true;
  const dep = panelData.values?.[w.visible_if.param];
  if (w.visible_if.ne != null) return String(dep) !== String(w.visible_if.ne);
  return String(dep) === String(w.visible_if.eq);
}

function resolveOptionIndex(w, rawVal) {
  const valueMap = w.value_map || {};
  const keys = Object.keys(valueMap);
  if (!keys.length) {
    const idx = parseInt(rawVal, 10);
    return Number.isNaN(idx) ? (w.min ?? 0) : idx;
  }
  const stored = parseInt(rawVal, 10);
  if (!Number.isNaN(stored)) {
    const hit = keys.find((k) => Number(valueMap[k]) === stored);
    if (hit != null) return parseInt(hit, 10);
  }
  const idx = parseInt(rawVal, 10);
  return Number.isNaN(idx) ? (w.min ?? 0) : idx;
}

function optionParamValue(w, idx) {
  const mapped = w.value_map?.[String(idx)];
  return mapped != null ? mapped : idx;
}

function formatOptionLabel(w, rawVal, panelData = panelDataRef) {
  const valueMap = w.value_map || {};
  const hasValueMap = Object.keys(valueMap).length > 0;
  const idx = hasValueMap ? resolveOptionIndex(w, rawVal) : parseInt(rawVal, 10);
  const val = Number.isNaN(idx) ? rawVal : idx;
  const fmt = w.label_format;

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
  if (fmt === "blinker_min_speed") {
    return `${val} ${globalState.is_metric ? t("km/h") : t("mph")}`;
  }
  if (fmt === "blinker_delay") return `${val} ${t("s")}`;
  if (fmt === "speed_limit_offset") {
    const offsetType = panelDataRef?.values?.SpeedLimitOffsetType ?? "0";
    if (String(offsetType) === "2") return `${val}%`;
    if (String(offsetType) === "1") return `${val} ${globalState.is_metric ? "km/h" : "mph"}`;
    return String(val);
  }
  if (fmt === "acc_long_press") {
    const mapped = valueMap[String(val)];
    return mapped != null ? String(mapped) : String(val);
  }
  if (hasValueMap) return formatMaxTimeLabel(val, valueMap);
  return String(val);
}

let panelDataRef = null;
let lastPanelVisibilityHash = "";

const PERSONALITY_INDEX = { aggressive: 0, standard: 1, relaxed: 2 };

let globalState = { started: false, engaged: false, is_offroad: true };
let homeState = { paired: false };
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
  updateCruiseCapabilities(st);
  updateVisualsCapabilities(st);
  updateSteeringCapabilities(st);
  updateSubpanelStates();
}

export function setHomeState(home) {
  if (!home) return;
  const paired = !!home.paired;
  if (homeState.paired === paired) return;
  homeState = { paired };
  requestPanelRefresh();
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
    const expIcon = expRow?.querySelector(".opui-sp-row-icon");
    if (expIcon) {
      expIcon.src = `/api/opui/assets/selfdrive/assets/icons/${expInput?.checked ? "experimental.png" : "experimental_white.png"}`;
    }
    if (disable && expInput.checked) {
      expInput.checked = false;
      expRow?.querySelector(".opui-sp-toggle")?.classList.remove("on");
    }
    if (expDesc) {
      const e2e = t(
        "sunnypilot defaults to driving in chill mode. Experimental mode enables alpha-level features that aren't ready for chill mode. "
        + "Experimental features are listed below: End-to-End Longitudinal Control — Let the driving model control the gas and brakes. "
        + "New Driving Visualization — The driving visualization will transition to the road-facing wide-angle camera at low speeds.",
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

function setPanelRowDesc(row, text) {
  if (!row || !text) return;
  let descEl = row.querySelector(".opui-sp-row-desc:not(.opui-sp-row-desc--hint):not(.opui-sp-row-desc--experimental)");
  if (!descEl) {
    descEl = document.createElement("div");
    descEl.className = "opui-sp-row-desc opui-sp-row-desc--expandable";
    descEl.hidden = true;
    row.querySelector(".opui-sp-row-text")?.appendChild(descEl);
    row.querySelector(".opui-sp-row-text")?.classList.add("opui-sp-row-text--expandable");
  }
  descEl.innerHTML = escapeHtml(t(text)).replace(/\n/g, "<br>");
}

function setToggleRowState(param, { disabled, desc }) {
  const row = document.querySelector(`[data-param="${CSS.escape(param)}"]`);
  if (!row) return;
  const input = row.querySelector("input[type=checkbox]");
  const label = row.querySelector(".opui-sp-toggle");
  if (disabled != null) {
    if (input) input.disabled = !!disabled;
    label?.classList.toggle("disabled", !!disabled);
  }
  if (desc) setPanelRowDesc(row, desc);
}

function updateCruiseCapabilities(st) {
  if (!st) return;
  const offroad = globalState.is_offroad;
  const hasLong = st.has_longitudinal_control !== false;
  const hasIcbm = !!st.has_icbm;
  const pcm = !!st.pcm_cruise;
  const sccOk = hasLong || hasIcbm;
  const customAccOk = offroad && ((hasLong && !pcm) || hasIcbm);

  let icbmDesc = "When enabled, sunnypilot will attempt to manage the built-in cruise control buttons by emulating button presses for limited longitudinal control.";
  let icbmDisabled = !offroad;
  if (!offroad) {
    icbmDesc = "Start the vehicle to check vehicle compatibility.";
  } else if (!hasIcbm) {
    icbmDisabled = true;
    if (hasLong) {
      icbmDesc = "Disable the sunnypilot Longitudinal Control (alpha) toggle to allow Intelligent Cruise Button Management.";
    } else {
      icbmDesc = "sunnypilot Longitudinal Control is the default longitudinal control for this platform.";
    }
  }
  setToggleRowState("IntelligentCruiseButtonManagement", { disabled: icbmDisabled, desc: icbmDesc });

  setToggleRowState("DynamicExperimentalControl", { disabled: !hasLong });
  setToggleRowState("SmartCruiseControlVision", { disabled: !sccOk });
  setToggleRowState("SmartCruiseControlMap", { disabled: !sccOk });

  let customDesc = "Enable custom Short & Long press increments for cruise speed increase/decrease.";
  let customDisabled = !customAccOk;
  if (!offroad) {
    customDesc = "Start the vehicle to check vehicle compatibility.";
    customDisabled = true;
  } else if (!customAccOk) {
    customDisabled = true;
    if (pcm) customDesc = "This feature is not supported on this platform due to vehicle limitations.";
    else customDesc = "This feature can only be used with sunnypilot longitudinal control enabled.";
  }
  setToggleRowState("CustomAccIncrementsEnabled", { disabled: customDisabled, desc: customDesc });

  document.querySelectorAll('[data-capability="custom_acc"]').forEach((row) => {
    const input = row.querySelector("input, button");
    const disabled = !customAccOk || !paramIsOn(panelDataRef?.values?.CustomAccIncrementsEnabled);
    if (input) input.disabled = disabled;
    row.classList.toggle("opui-sp-row--disabled", disabled);
  });
}

function updateVisualsCapabilities(st) {
  if (!st) return;
  const hasLong = st.has_longitudinal_control !== false;
  const chevronRow = document.querySelector('[data-param="ChevronInfo"]');
  if (chevronRow) {
    const desc = hasLong
      ? "Display useful metrics below the chevron that tracks the lead car only applicable to cars with sunnypilot longitudinal control."
      : "This feature requires sunnypilot longitudinal control to be available.";
    setPanelRowDesc(chevronRow, desc);
    chevronRow.querySelectorAll("button").forEach((b) => { b.disabled = !hasLong; });
  }
}

function updateSteeringCapabilities(st) {
  if (!st) return;
  const offroad = globalState.is_offroad;
  const torqueAllowed = st.torque_control_allowed !== false;
  const jerk = !!st.lateral_jerk_torque;

  const setToggleDisabled = (param, disabled) => {
    const row = document.querySelector(`[data-param="${CSS.escape(param)}"]`);
    if (!row) return;
    const input = row.querySelector("input[type=checkbox]");
    const label = row.querySelector(".opui-sp-toggle");
    if (input) input.disabled = disabled;
    label?.classList.toggle("disabled", disabled);
  };

  setToggleDisabled("Mads", !offroad);
  setToggleDisabled("EnforceTorqueControl", !offroad || !torqueAllowed);
  setToggleDisabled("NeuralNetworkLateralControl", !offroad || !torqueAllowed || jerk);

  const torqueOn = paramIsOn(panelDataRef?.values?.EnforceTorqueControl);
  const nnlcOn = paramIsOn(panelDataRef?.values?.NeuralNetworkLateralControl);
  setToggleDisabled("EnforceTorqueControl", !offroad || !torqueAllowed || nnlcOn);
  setToggleDisabled("NeuralNetworkLateralControl", !offroad || !torqueAllowed || jerk || torqueOn);

  updateSubpanelStates();
}

function updateSubpanelStates() {
  document.querySelectorAll(".opui-simple-btn").forEach((btn) => {
    let disabled = btn.dataset.offroadOnly === "1" && !globalState.is_offroad;
    const req = btn.dataset.requiresParam;
    const eq = btn.dataset.requiresEq;
    if (req && panelDataRef?.values) {
      disabled = disabled || String(panelDataRef.values[req]) !== String(eq);
    }
    btn.disabled = disabled;
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

  const curNotes = document.getElementById("software-current-notes");
  if (curNotes) {
    const html = sw.current_release_notes || "";
    if (html.trim().startsWith("<")) {
      curNotes.innerHTML = html;
      curNotes.classList.add("opui-html-block", "opui-release-notes");
    } else {
      curNotes.textContent = html;
      curNotes.classList.remove("opui-html-block");
    }
    curNotes.hidden = !html;
  }

  if (installNotes) {
    const html = sw.new_release_notes || "";
    if (html.trim().startsWith("<")) {
      installNotes.innerHTML = html;
      installNotes.classList.add("opui-html-block", "opui-release-notes");
    } else {
      installNotes.textContent = html;
      installNotes.classList.remove("opui-html-block");
    }
    installNotes.hidden = !html;
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
  if (panelId === "osm") {
    applyOsmCustom(data);
  }
  if (panelId === "vehicle") {
    applyVehicleCustom(data);
  }
}

function applyVehicleCustom(data) {
  if (!data?.ok) return;
  const vp = data.platforms;
  if (!vp?.ok) return;
  const titleEl = document.getElementById("vehicle-platform-title");
  const btn = document.getElementById("vehicle-platform-btn");
  if (!titleEl || !btn) return;
  const status = vp.status || (vp.manual ? "manual" : "unknown");
  const display = platformDisplayText(vp.display) || platformDisplayText(vp.active) || t("No vehicle selected");
  titleEl.textContent = display;
  titleEl.className = `opui-sp-row-title opui-vehicle-title--${status === "auto" ? "auto" : status === "manual" ? "manual" : "unknown"}`;
  btn.textContent = vp.manual ? t("REMOVE") : t("SELECT");
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
  const widgets = (data.widgets || [])
    .filter((w) => widgetVisible(w, data))
    .map((w) => w.param || w.type || w.custom || w.action || "")
    .join("|");
  return `${widgets}|paired:${homeState.paired ? 1 : 0}`;
}

export function applyPanelSync(data) {
  if (!data?.ok) return;
  panelDataRef = data;
  const hash = panelVisibilityHash(data);
  if (hash !== lastPanelVisibilityHash) {
    lastPanelVisibilityHash = hash;
    if (data.custom) {
      const container = document.getElementById("panel-content");
      if (container) {
        if (data.custom === "software" || data.custom === "models" || data.custom === "osm") {
          container.querySelectorAll("[data-panel-widget]").forEach((el) => el.remove());
          appendPanelWidgets(container, data);
          if (data.custom === "osm") {
            ensureOsmCustomBlock(container, data);
            updateOsmLabels(document.getElementById("osm-custom-root"), data);
            const ver = document.getElementById("osm-mapd-version");
            if (ver) ver.textContent = data.values?.MapdVersion || t("Loading...");
          }
        } else {
          window.dispatchEvent(new CustomEvent("opui:refresh-panel"));
        }
      }
    } else {
      const container = document.getElementById("panel-content");
      if (container) renderGenericPanel(container, data);
    }
    updateEngagedWidgets();
    updateToggleCapabilities(globalState);
    updateCruiseCapabilities(globalState);
    updateVisualsCapabilities(globalState);
    updateSteeringCapabilities(globalState);
    updateDisplayDependencies(data);
    if (data.custom === "osm") {
      updateOsmLabels(document.getElementById("osm-custom-root"), data);
      const ver = document.getElementById("osm-mapd-version");
      if (ver) ver.textContent = data.values?.MapdVersion || t("Loading...");
    }
    return;
  }
  const root = document.getElementById("panel-content");
  if (!root) return;
  for (const w of data.widgets || []) {
    if (!widgetVisible(w, data)) continue;
    if (w.type === "dual_button") {
      updateDualButtonRow(root, w);
      continue;
    }
    if (!w.param) continue;
    updateWidgetValue(root, w, data);
  }
  updateEngagedWidgets();
  updateToggleCapabilities(globalState);
  updateCruiseCapabilities(globalState);
  updateVisualsCapabilities(globalState);
  updateSteeringCapabilities(globalState);
  updateDisplayDependencies(data);
  if (data.custom === "osm") {
    updateOsmLabels(document.getElementById("osm-custom-root"), data);
    const ver = document.getElementById("osm-mapd-version");
    if (ver) ver.textContent = data.values?.MapdVersion || t("Loading...");
  }
}

let currentPanelRef = "";
let panelRenderGen = 0;

function beginPanelRender() {
  return ++panelRenderGen;
}

function panelRenderStale(gen) {
  return gen !== panelRenderGen;
}

export function setCurrentPanelId(id) {
  currentPanelRef = id || "";
}

function updateWidgetValue(root, w, panelData = panelDataRef) {
  const el = root.querySelector(`[data-param="${CSS.escape(w.param)}"]`);
  if (!el) return;
  const kind = el.dataset.widget || resolveWidgetType(w);
  if (kind === "bool") {
    const checked = paramIsOn(w.value);
    const input = el.querySelector("input[type=checkbox]");
    const label = el.querySelector(".opui-sp-toggle");
    if (input) {
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
    const min = w.min ?? 0;
    const max = w.max ?? 100;
    let val = kind === "option" ? resolveOptionIndex(w, w.value) : parseInt(w.value, 10);
    if (Number.isNaN(val)) val = min;
    const span = el.querySelector(".opui-option-value, .opui-int-control span");
    if (span) {
      span.textContent = kind === "option" ? formatOptionLabel(w, w.value, panelData) : String(val);
    }
    const minus = el.querySelector(".opui-option-bar button:first-child, .opui-int-control button:first-child");
    const plus = el.querySelector(".opui-option-bar button:last-child, .opui-int-control button:last-child");
    if (minus) minus.disabled = val <= min;
    if (plus) plus.disabled = val >= max;
  }
}

function updateDualButtonRow(root, w) {
  const left = w.left || {};
  const right = w.right || {};
  const row = root.querySelector(`[data-dual="${CSS.escape(`${left.label || ""}|${right.label || ""}`)}"]`);
  if (!row) return;
  for (const side of ["left", "right"]) {
    const cfg = w[side];
    if (!cfg?.toggle || !cfg.param) continue;
    const btn = row.querySelector(`[data-side="${side}"]`);
    if (!btn) continue;
    btn.classList.toggle("primary", paramIsOn(cfg.value));
  }
}

function updateDisplayDependencies(data) {
  if (data?.panel !== "display") return;
  const brightness = parseInt(data.values?.OnroadScreenOffBrightness ?? "0", 10);
  const timerRow = document.querySelector('[data-param="OnroadScreenOffTimer"]');
  const disabled = brightness === 0 || brightness === 1;
  timerRow?.querySelectorAll(".opui-option-bar button").forEach((btn) => {
    btn.disabled = disabled;
  });
  timerRow?.classList.toggle("disabled", disabled);
}

function widgetUsesStacked(w) {
  return w.layout === "stacked";
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
  currentPanelRef = panelId;
  notifyPanelWatch(panelId);
  if (container && !container.querySelector(".opui-panel-loading")) {
    container.innerHTML = '<p class="opui-muted opui-panel-loading" style="padding:48px;text-align:center">加载中…</p>';
  }
  const data = await apiGet(`/api/opui/panels/${encodeURIComponent(panelId)}`);
  if (!data.ok) {
    container.innerHTML = `<p class="opui-muted" style="padding:48px">加载失败: ${data.error}</p>`;
    return;
  }
  if (titleEl) {
    const header = titleEl.closest(".opui-panel-header");
    if (data.parent && options.showBack !== false) {
      header?.classList.add("opui-panel-header--subpanel");
      titleEl.innerHTML = `<button type="button" class="opui-back" data-parent="${escapeAttr(data.parent)}">‹</button> ${escapeHtml(t(data.title))}`;
      titleEl.querySelector(".opui-back")?.addEventListener("click", () => {
        if (onNavigateSubpanel) onNavigateSubpanel(data.parent);
      });
    } else {
      header?.classList.remove("opui-panel-header--subpanel");
      titleEl.textContent = "";
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
  if (data.custom === "network_advanced") {
    await renderNetworkAdvancedPanel(container, data);
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
  updateDisplayDependencies(data);
  lastPanelVisibilityHash = panelVisibilityHash(data);
}

async function renderDevicePanel(container, data, titleEl, options = {}) {
  const ex = await apiGet("/api/opui/device/extras");
  deviceExtrasCache = ex.ok ? ex : null;
  let widgets = prunePanelWidgets([...(data.widgets || [])], data);
  const aoWidget = widgets.find((w) => w.custom === "always_offroad");
  if (aoWidget) {
    widgets = widgets.filter((w) => w.custom !== "always_offroad");
    const alwaysOffroad = !!deviceExtrasCache?.offroad_mode;
    const powerIdx = widgets.findIndex((w) => w.type === "dual_button" && w.left?.action === "reboot");
    if (powerIdx >= 0) {
      widgets.splice(powerIdx, 0, { type: "separator", gap: 10 }, { type: "separator" });
    }
    const powerIdx2 = widgets.findIndex((w) => w.type === "dual_button" && w.left?.action === "reboot");
    if (globalState.is_offroad && !alwaysOffroad && powerIdx2 >= 0) {
      widgets.splice(powerIdx2, 0, aoWidget);
    } else {
      widgets.unshift(aoWidget);
    }
  }
  renderGenericPanel(container, { ...data, widgets });
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
    if (res.ok) {
      deviceExtrasCache = { ...(deviceExtrasCache || {}), offroad_mode: !active };
      toast(label);
      requestPanelRefresh();
    } else toast(res.error || "Failed");
  });
  return row;
}

function prunePanelWidgets(widgets, panelData) {
  const kept = [];
  for (const w of widgets || []) {
    if (w.type === "separator") {
      if (!kept.length) continue;
      if (kept[kept.length - 1].type === "separator") continue;
      kept.push(w);
      continue;
    }
    if (w.offroad_only && !globalState.is_offroad) continue;
    if (!widgetVisible(w, panelData)) continue;
    kept.push(w);
  }
  while (kept.length && kept[kept.length - 1].type === "separator") kept.pop();
  return kept;
}

function appendPanelWidgets(container, data) {
  panelDataRef = data;
  lastPanelVisibilityHash = panelVisibilityHash(data);
  for (const w of prunePanelWidgets(data.widgets, data)) {
    const el = renderWidget(w, data);
    if (el) {
      el.dataset.panelWidget = "1";
      container.appendChild(el);
    }
  }
}

function prependSubpanelNav(container, data) {
  if (!data?.parent) return;
  const nav = document.createElement("div");
  nav.className = "opui-subpanel-nav";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "opui-nav-back";
  btn.textContent = t("Back");
  btn.addEventListener("click", () => {
    if (onNavigateSubpanel) onNavigateSubpanel(data.parent);
  });
  nav.appendChild(btn);
  container.appendChild(nav);
}

function renderGenericPanel(container, data) {
  container.innerHTML = "";
  prependSubpanelNav(container, data);
  appendPanelWidgets(container, data);
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

  if (kind === "separator") {
    const sep = document.createElement("div");
    sep.className = "opui-sp-separator" + (w.gap ? ` opui-sp-separator--gap-${w.gap}` : "");
    sep.setAttribute("aria-hidden", "true");
    return sep;
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
  const stacked = widgetUsesStacked(w);
  const row = createSpToggle({
    ...w,
    label: stacked ? "" : t(w.label),
    desc: w.desc ? t(w.desc) : "",
    confirm_experimental: w.confirm_experimental,
    stacked,
  }, {}, globalState, paramHandlers);
  row.dataset.param = w.param;
  row.dataset.widget = "bool";
  if (w.dynamic_desc) row.dataset.dynamicDesc = w.dynamic_desc;
  if (w.capability) row.dataset.capability = w.capability;
  if (w.needs_cycle) row.dataset.needsCycle = "1";
  if (w.offroad_only) row.dataset.offroadOnly = "1";
  if (stacked) {
    row.classList.add("opui-sp-row--stacked", "opui-sp-row--toggle-below");
    const title = document.createElement("div");
    title.className = "opui-sp-row-title";
    title.textContent = t(w.label);
    row.querySelector(".opui-sp-row-text")?.prepend(title);
  }
  return row;
}

function renderMultipleButtonRow(w, panelData) {
  const inline = w.layout === "inline";
  const stacked = w.layout === "stacked" || !inline;
  const row = document.createElement("div");
  row.className = "opui-sp-row"
    + (inline ? " opui-sp-row--control-inline" : " opui-sp-row--stacked");
  row.dataset.param = w.param;
  row.dataset.widget = "multiple_button";
  const buttons = (w.buttons || []).map((b) => t(b));
  let idx = parseInt(w.value, 10);
  if (Number.isNaN(idx)) idx = 0;

  const text = document.createElement("div");
  text.className = "opui-sp-row-text";
  text.innerHTML = `<div class="opui-sp-row-title">${escapeHtml(t(w.label))}</div>`;

  const group = document.createElement("div");
  group.className = "opui-multi-btn-group";
  if (inline) group.classList.add("opui-multi-btn-group--inline");
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
  if (inline) {
    row.append(text, group);
  } else {
    row.appendChild(text);
    row.appendChild(group);
  }
  bindRowExpand(row, { ...w, desc: w.desc ? t(w.desc) : "" });
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
    ${w.show_desc && w.desc ? `<div class="opui-sp-row-desc">${escapeHtml(t(w.desc)).replace(/\n/g, "<br>")}</div>` : ""}`;
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
  if (w.capability) row.dataset.capability = w.capability;
  row.dataset.param = w.param;
  let val = parseInt(w.value, 10);
  if (Number.isNaN(val)) val = w.min || 0;
  const min = w.min ?? 0;
  const max = w.max ?? 100;
  const step = w.step ?? 1;
  const valueMap = w.value_map || {};
  const hasMap = Object.keys(valueMap).length > 0;
  const displayVal = hasMap ? (valueMap[String(val)] ?? val) : val;

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
  span.textContent = String(displayVal);
  const plus = document.createElement("button");
  plus.type = "button";
  plus.textContent = "+";

  const save = async (v) => {
    v = Math.max(min, Math.min(max, v));
    const store = hasMap ? (valueMap[String(v)] ?? v) : v;
    span.textContent = String(hasMap ? (valueMap[String(v)] ?? v) : v);
    const res = await putParam(w.param, String(store));
    if (!res.ok) toast(res.error || "保存失败");
  };

  minus.addEventListener("click", () => { val = Math.max(min, val - step); save(val); });
  plus.addEventListener("click", () => { val = Math.min(max, val + step); save(val); });

  ctrl.append(minus, span, plus);
  row.appendChild(ctrl);
  return row;
}

function renderSubpanelRow(w) {
  const wrap = document.createElement("div");
  wrap.className = "opui-subpanel-wrap";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "opui-simple-btn";
  btn.textContent = t(w.label || w.button);
  if (w.target) btn.dataset.subpanel = w.target;
  if (w.offroad_only) btn.dataset.offroadOnly = "1";
  if (w.requires?.param) {
    btn.dataset.requiresParam = w.requires.param;
    btn.dataset.requiresEq = String(w.requires.eq ?? "1");
  }
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    if (onNavigateSubpanel && w.target) onNavigateSubpanel(w.target);
  });
  wrap.appendChild(btn);
  return wrap;
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

function dualButtonClass(side) {
  if (side.action === "shutdown" || side.action === "reset_all_params") return "danger";
  return "";
}

function renderOptionRow(w, panelData) {
  const inline = w.layout === "inline";
  const row = document.createElement("div");
  row.className = "opui-sp-row" + (inline ? " opui-sp-row--control-inline" : " opui-sp-row--stacked opui-sp-row--control-below");
  row.dataset.param = w.param;
  row.dataset.widget = "option";
  let idx = resolveOptionIndex(w, w.value);
  const min = w.min ?? 0;
  const max = w.max ?? 11;
  const step = w.step ?? 1;

  const text = document.createElement("div");
  text.className = "opui-sp-row-text";
  text.innerHTML = `<div class="opui-sp-row-title">${escapeHtml(t(w.label))}</div>`;
  row.appendChild(text);

  const bar = document.createElement("div");
  bar.className = "opui-option-bar";
  const minus = document.createElement("button");
  minus.type = "button";
  minus.textContent = "−";
  const span = document.createElement("span");
  span.className = "opui-option-value";
  span.textContent = formatOptionLabel(w, w.value, panelData);
  const plus = document.createElement("button");
  plus.type = "button";
  plus.textContent = "+";

  const save = async (v) => {
    idx = Math.max(min, Math.min(max, v));
    const paramVal = optionParamValue(w, idx);
    span.textContent = formatOptionLabel(w, paramVal, panelData);
    minus.disabled = idx <= min;
    plus.disabled = idx >= max;
    const res = await putParam(w.param, String(paramVal));
    if (!res.ok) toast(res.error || t("Save failed"));
    else {
      w.value = String(paramVal);
      if (panelData?.values) panelData.values[w.param] = String(paramVal);
      if (w.param === "OnroadScreenOffBrightness") updateDisplayDependencies(panelData);
    }
  };
  minus.disabled = idx <= min;
  plus.disabled = idx >= max;
  minus.addEventListener("click", () => save(idx - step));
  plus.addEventListener("click", () => save(idx + step));
  bar.append(minus, span, plus);
  row.appendChild(bar);
  bindRowExpand(row, { ...w, desc: w.desc ? t(w.desc) : "" });
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
    window.dispatchEvent(new CustomEvent("opui:open-driver-camera"));
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
  row.dataset.dual = `${left.label || ""}|${right.label || ""}`;
  if (left.action === "reboot") row.dataset.powerRow = "1";
  const lBtn = document.createElement("button");
  lBtn.type = "button";
  lBtn.className = "opui-dual-btn";
  lBtn.dataset.side = "left";
  lBtn.textContent = t(left.label);
  const rBtn = document.createElement("button");
  rBtn.type = "button";
  rBtn.className = `opui-dual-btn ${dualButtonClass(right)}`.trim();
  rBtn.dataset.side = "right";
  rBtn.textContent = t(right.label);

  if (left.toggle) {
    lBtn.classList.toggle("primary", paramIsOn(left.value));
  }
  if (right.toggle) {
    rBtn.classList.toggle("primary", paramIsOn(right.value));
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
      const on = !paramIsOn(left.value);
      const res = await putParam(left.param, on ? "1" : "0");
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
      const on = !paramIsOn(right.value);
      const res = await putParam(right.param, on ? "1" : "0");
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
    </div>
    <div class="opui-row-actions">
      <button type="button" class="opui-btn opui-btn--action" ${disabled ? "disabled" : ""}>${escapeHtml(t(w.button || "GO"))}</button>
    </div>`;
  if (desc) bindRowExpand(row, { desc });
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
      const tv = await apiGet("/api/opui/steering/torque-versions");
      if (!tv.ok) {
        toast(tv.error || "Failed");
        return;
      }
      const folders = [{
        name: "",
        bundles: (tv.options || []).map((o) => ({ name: o.label, ref: o.label })),
      }];
      const ref = await showTree({
        title: t("Torque Control Tune Version"),
        folders,
        selectedRef: tv.current_label || "Default",
        searchable: true,
      });
      if (!ref) return;
      const pick = (tv.options || []).find((o) => o.label === ref);
      if (!pick || pick.version == null) {
        await apiPut("/api/opui/params/TorqueControlTune", { value: "" });
      } else {
        await apiPut("/api/opui/params/TorqueControlTune", { value: String(pick.version) });
      }
      toast(t("Torque tune updated"));
      requestPanelRefresh();
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
  const gen = beginPanelRender();
  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "opui-wifi-header";
  const scanBtn = document.createElement("button");
  scanBtn.type = "button";
  scanBtn.className = "opui-wifi-scan-btn";
  scanBtn.textContent = t("Scan");
  const advBtn = document.createElement("button");
  advBtn.type = "button";
  advBtn.className = "opui-wifi-adv-btn";
  advBtn.textContent = t("Advanced");
  advBtn.addEventListener("click", () => {
    if (onNavigateSubpanel) onNavigateSubpanel("network__advanced");
  });
  header.append(scanBtn, advBtn);
  container.appendChild(header);

  const list = document.createElement("div");
  list.className = "opui-wifi-list";
  container.appendChild(list);

  const asset = (rel) => `/api/opui/assets/${rel.replace(/^\//, "")}`;
  const strengthIcon = (strength) => {
    const level = Math.max(0, Math.min(3, Math.round((strength || 0) / 33)));
    const names = [
      "selfdrive/assets/icons/wifi_strength_low.png",
      "selfdrive/assets/icons/wifi_strength_medium.png",
      "selfdrive/assets/icons/wifi_strength_high.png",
      "selfdrive/assets/icons/wifi_strength_full.png",
    ];
    return asset(names[level]);
  };

  const fetchScan = (trigger = false) => apiGet(`/api/opui/wifi/scan${trigger ? "?trigger=1" : ""}`);

  const paintList = (scan) => {
    if (panelRenderStale(gen)) return;
    list.innerHTML = "";
    if (!scan.ok) {
      list.innerHTML = `<p class="opui-wifi-status">${escapeHtml(t("Wi-Fi unavailable"))}: ${escapeHtml(scan.error || "")}</p>`;
      return;
    }
    const networks = scan.networks || [];
    if (!networks.length) {
      list.innerHTML = `<p class="opui-wifi-status">${escapeHtml(t("No networks found"))}</p>`;
      return;
    }
    for (const n of networks) {
      const item = document.createElement("div");
      item.className = "opui-wifi-item" + (n.connected ? " connected" : "");
      const ssidBtn = document.createElement("button");
      ssidBtn.type = "button";
      ssidBtn.className = "opui-wifi-ssid";
      ssidBtn.textContent = n.ssid;
      const meta = document.createElement("div");
      meta.className = "opui-wifi-meta";
      if (n.saved) {
        const forget = document.createElement("button");
        forget.type = "button";
        forget.className = "opui-wifi-forget";
        forget.textContent = t("Forget");
        forget.addEventListener("click", async (e) => {
          e.stopPropagation();
          const msg = t('Forget Wi-Fi Network "{}"?').replace("{}", n.ssid);
          if (!(await showConfirm({ message: msg, confirmText: t("Forget"), cancelText: t("Cancel") }))) return;
          const res = await apiPost("/api/opui/wifi/forget", { ssid: n.ssid });
          if (res.ok) toast(t("Forgot") + ` ${n.ssid}`);
          else toast(res.error || t("Failed"));
          await runScan(false);
        });
        meta.appendChild(forget);
      }
      if (n.connected) {
        const mark = document.createElement("img");
        mark.className = "opui-wifi-icon";
        mark.src = asset("selfdrive/assets/icons/checkmark.png");
        mark.alt = "";
        meta.appendChild(mark);
      } else if (n.security > 0) {
        const lock = document.createElement("img");
        lock.className = "opui-wifi-icon";
        lock.src = asset("selfdrive/assets/icons/lock_closed.png");
        lock.alt = "";
        meta.appendChild(lock);
      }
      const signal = document.createElement("img");
      signal.className = "opui-wifi-icon opui-wifi-signal";
      signal.src = strengthIcon(n.strength);
      signal.alt = "";
      meta.appendChild(signal);
      item.append(ssidBtn, meta);
      ssidBtn.addEventListener("click", async () => {
        if (n.connected) return;
        let password = "";
        if (n.security > 0) {
          password = await showKeyboard({
            title: `${t("Enter password")} (${n.ssid})`,
            password: true,
            minLen: 8,
            maxLen: 64,
          }) || "";
          if (!password) return;
        }
        const res = await apiPost("/api/opui/wifi/connect", { ssid: n.ssid, password });
        if (res.ok) toast(`${t("Connecting")} ${n.ssid}`);
        else toast(res.error || t("Connect failed"));
      });
      list.appendChild(item);
    }
  };

  const runScan = async (trigger = false) => {
    if (trigger) {
      list.innerHTML = `<p class="opui-wifi-status">${escapeHtml(t("Scanning Wi-Fi networks..."))}</p>`;
    }
    let scan = await fetchScan(trigger);
    if (panelRenderStale(gen)) return;
    if (trigger) {
      for (let i = 0; i < 12; i++) {
        if ((scan.networks || []).length) break;
        await new Promise((r) => setTimeout(r, 500));
        scan = await fetchScan(false);
        if (panelRenderStale(gen)) return;
      }
    }
    paintList(scan);
  };

  scanBtn.addEventListener("click", async () => {
    scanBtn.disabled = true;
    scanBtn.textContent = t("Scanning...");
    await runScan(true);
    if (panelRenderStale(gen)) return;
    scanBtn.disabled = false;
    scanBtn.textContent = t("Scan");
  });

  await runScan(true);
}

async function renderNetworkAdvancedPanel(container, data) {
  const gen = beginPanelRender();
  container.innerHTML = "";
  const adv = await apiGet("/api/opui/network/advanced");
  if (panelRenderStale(gen)) return;

  const tetherChecked = !!(adv.ok && adv.tethering);
  const tetherRow = document.createElement("div");
  tetherRow.className = "opui-sp-row";
  tetherRow.innerHTML = `
    <label class="opui-sp-toggle${tetherChecked ? " on" : ""}">
      <input type="checkbox" ${tetherChecked ? "checked" : ""} />
      <span class="opui-sp-toggle-track"><span class="opui-sp-toggle-thumb"></span></span>
    </label>
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Enable Tethering"))}</div>
    </div>`;
  tetherRow.querySelector("input")?.addEventListener("change", async (ev) => {
    const input = ev.target;
    const label = tetherRow.querySelector(".opui-sp-toggle");
    const active = !!input.checked;
    label?.classList.toggle("on", active);
    const res = await apiPost("/api/opui/wifi/tethering", { active });
    if (!res.ok) {
      toast(res.error || t("Failed"));
      input.checked = !active;
      label?.classList.toggle("on", input.checked);
    }
  });
  container.appendChild(tetherRow);

  const passRow = document.createElement("div");
  passRow.className = "opui-sp-row";
  passRow.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Tethering Password"))}</div>
    </div>
    <button type="button" class="opui-btn">${escapeHtml(t("EDIT"))}</button>`;
  passRow.querySelector("button")?.addEventListener("click", async () => {
    const password = await showKeyboard({
      title: t("Tethering Password"),
      password: true,
      minLen: 8,
      maxLen: 64,
    });
    if (password == null) return;
    const res = await apiPost("/api/opui/wifi/tethering/password", { password });
    if (res.ok) toast(t("Saved"));
    else toast(res.error || t("Failed"));
  });
  container.appendChild(passRow);

  const ipRow = document.createElement("div");
  ipRow.className = "opui-sp-row";
  ipRow.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("IP Address"))}</div>
    </div>
    <div class="opui-row-value">${escapeHtml(adv.ok ? (adv.ipv4 || "—") : "—")}</div>`;
  container.appendChild(ipRow);

  for (const w of data.widgets || []) {
    const el = renderWidget(w, data);
    if (el) container.appendChild(el);
  }

  const apnRow = document.createElement("div");
  apnRow.className = "opui-sp-row";
  apnRow.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("APN Setting"))}</div>
    </div>
    <button type="button" class="opui-btn">${escapeHtml(t("EDIT"))}</button>`;
  apnRow.querySelector("button")?.addEventListener("click", async () => {
    const apn = await showKeyboard({
      title: `${t("Enter APN")} — ${t("leave blank for automatic configuration")}`,
      minLen: 0,
      maxLen: 64,
    });
    if (apn == null) return;
    const res = await apiPost("/api/opui/action/network_set_apn", { apn });
    if (res.ok) toast(t("Saved"));
    else toast(res.error || t("Failed"));
  });
  const roamingRow = container.querySelector('[data-param="GsmRoaming"]');
  if (roamingRow) roamingRow.insertAdjacentElement("afterend", apnRow);
  else container.appendChild(apnRow);

  const meteredRow = document.createElement("div");
  meteredRow.className = "opui-sp-row opui-sp-row--stacked opui-sp-row--segmented";
  meteredRow.dataset.param = "WifiMeteredUi";
  meteredRow.dataset.widget = "multiple_button";
  const meteredLabels = [t("default"), t("metered"), t("unmetered")];
  let meteredIdx = adv.ok ? (adv.wifi_metered || 0) : 0;
  const meteredText = document.createElement("div");
  meteredText.className = "opui-sp-row-text";
  meteredText.innerHTML = `
    <div class="opui-sp-row-title">${escapeHtml(t("Wi-Fi Network Metered"))}</div>
    <div class="opui-sp-row-desc">${escapeHtml(t("Prevent large data uploads when on a metered Wi-Fi connection"))}</div>`;
  const meteredGroup = document.createElement("div");
  meteredGroup.className = "opui-multi-btn-group";
  const meteredEnabled = adv.ok && adv.wifi_metered_enabled;
  meteredLabels.forEach((label, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.classList.toggle("selected", i === meteredIdx);
    btn.disabled = !meteredEnabled;
    btn.addEventListener("click", async () => {
      const res = await apiPost("/api/opui/wifi/metered", { metered: i });
      if (!res.ok) {
        toast(res.error || t("Failed"));
        return;
      }
      meteredIdx = i;
      meteredGroup.querySelectorAll("button").forEach((b, j) => b.classList.toggle("selected", j === i));
    });
    meteredGroup.appendChild(btn);
  });
  meteredRow.append(meteredText, meteredGroup);
  container.appendChild(meteredRow);

  const hiddenRow = document.createElement("div");
  hiddenRow.className = "opui-sp-row";
  hiddenRow.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Hidden Network"))}</div>
    </div>
    <button type="button" class="opui-btn">${escapeHtml(t("CONNECT"))}</button>`;
  hiddenRow.querySelector("button")?.addEventListener("click", async () => {
    const ssid = await showKeyboard({ title: t("Hidden Network"), minLen: 1, maxLen: 64 });
    if (!ssid) return;
    let password = await showKeyboard({
      title: `${t("Enter password")} (${ssid})`,
      password: true,
      minLen: 0,
      maxLen: 64,
    });
    if (password == null) return;
    const res = await apiPost("/api/opui/wifi/connect/hidden", { ssid, password });
    if (res.ok) toast(`${t("Connecting")} ${ssid}`);
    else toast(res.error || t("Connect failed"));
  });
  container.appendChild(hiddenRow);
}

async function renderTripsPanel(container, data) {
  const gen = beginPanelRender();
  container.innerHTML = "";
  const trips = await apiGet("/api/opui/trips");
  if (panelRenderStale(gen)) return;
  if (!trips.ok) {
    container.innerHTML = `<p class="opui-muted" style="padding:48px">${escapeHtml(trips.error || "")}</p>`;
    return;
  }
  const s = trips.stats || {};
  const metric = globalState.is_metric;
  for (const [title, key] of [[t("ALL TIME"), "all"], [t("PAST WEEK"), "week"]]) {
    const block = s[key] || {};
    const card = document.createElement("div");
    card.className = "opui-trips-card";
    const dist = block.distance ?? 0;
    const distStr = metric ? Math.round(dist * 1.60934) : Math.round(dist);
    const unit = metric ? t("KM") : t("Miles");
    card.innerHTML = `
      <div class="opui-trips-title">${escapeHtml(title)}</div>
      <div class="opui-trips-cols">
        <div class="opui-trips-col">
          <img class="opui-trips-icon" src="/api/opui/assets/icons_mici/wheel.png" alt="" />
          <div class="opui-trips-num">${block.routes || 0}</div><div class="opui-trips-unit">${escapeHtml(t("Drives"))}</div>
        </div>
        <div class="opui-trips-col">
          <img class="opui-trips-icon" src="/api/opui/assets/icons_mici/road.png" alt="" />
          <div class="opui-trips-num">${distStr}</div><div class="opui-trips-unit">${escapeHtml(unit)}</div>
        </div>
        <div class="opui-trips-col">
          <img class="opui-trips-icon" src="/api/opui/assets/sunnypilot/selfdrive/assets/icons/clock.png" alt="" />
          <div class="opui-trips-num">${Math.round((block.minutes || 0) / 60)}</div><div class="opui-trips-unit">${escapeHtml(t("Hours"))}</div>
        </div>
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
  const gen = beginPanelRender();
  container.innerHTML = "";
  const m = await apiGet("/api/opui/models");
  if (panelRenderStale(gen)) return;
  if (!m.ok) {
    container.innerHTML = `<p class="opui-muted" style="padding:48px">${escapeHtml(m.error || t("Failed"))}</p>`;
    return;
  }

  const pickRow = document.createElement("div");
  pickRow.className = "opui-sp-row";
  const modelName = m.active_name || formatBundleDisplay(data.values?.ModelManager_ActiveBundle) || "—";
  pickRow.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Current Model"))}</div>
      <div class="opui-sp-row-desc">${escapeHtml(modelName)}</div>
    </div>
    <button type="button" class="opui-btn">${escapeHtml(t("SELECT"))}</button>`;
  pickRow.querySelector("button")?.addEventListener("click", async () => {
    const ref = await showTree({
      title: t("Select a Model"),
      folders: m.tree || [],
      selectedRef: m.active_ref,
      searchable: true,
    });
    if (!ref) return;
    const bundle = (m.tree || []).flatMap((f) => f.bundles || []).find((b) => b.ref === ref);
    const res = await apiPost("/api/opui/models/select", { ref, index: bundle?.index });
    if (res.ok) {
      toast(t("Model selected"));
      await renderModelsPanel(container, data);
    } else toast(res.error || t("Failed"));
  });
  container.appendChild(pickRow);

  if (m.download?.name) {
    const types = {
      supercombo: t("Driving Model"),
      vision: t("Vision Model"),
      policy: t("Policy Model"),
      offPolicy: t("Off-Policy Model"),
      onPolicy: t("On-Policy Model"),
    };
    const parts = m.download.models?.length ? m.download.models : Object.keys(types).map((type) => ({ type, progress: 0 }));
    for (const part of parts) {
      const label = types[part.type] || part.type;
      container.appendChild(createProgressRow(`${label} — ${m.download.name}`, part.progress || 0));
    }
    const cancel = document.createElement("div");
    cancel.className = "opui-sp-row";
    cancel.innerHTML = `<div class="opui-sp-row-text"><div class="opui-sp-row-title">${escapeHtml(t("Cancel Download"))}</div></div>
      <button type="button" class="opui-btn danger">${escapeHtml(t("Cancel"))}</button>`;
    cancel.querySelector("button")?.addEventListener("click", async () => {
      await apiPost("/api/opui/action/models_cancel_download");
      toast(t("Download cancelled"));
      await renderModelsPanel(container, data);
    });
    container.appendChild(cancel);
  }

  appendPanelWidgets(container, data);

  const clearRow = container.querySelector('[data-action="models_clear_cache"]');
  if (clearRow && m.cache_size_mb != null) {
    const text = clearRow.querySelector(".opui-sp-row-text");
    if (text && !text.querySelector(".opui-sp-row-desc")) {
      const d = document.createElement("div");
      d.className = "opui-sp-row-desc";
      d.textContent = `${Number(m.cache_size_mb).toFixed(2)} ${t("MB")}`;
      text.appendChild(d);
    }
  }
}

function ensureOsmCustomBlock(container, data) {
  let block = container.querySelector("#osm-custom-root");
  if (block) return block;
  block = document.createElement("div");
  block.id = "osm-custom-root";
  block.className = "opui-osm-tree";
  block.innerHTML = `
    <div class="opui-sp-row" id="osm-size-row">
      <div class="opui-sp-row-text">
        <div class="opui-sp-row-title">${escapeHtml(t("Downloaded Maps"))}</div>
        <div class="opui-sp-row-desc" id="osm-size-text">${escapeHtml(t("Calculating…"))}</div>
      </div>
      <button type="button" class="opui-btn opui-btn--action danger" id="osm-delete-btn">${escapeHtml(t("DELETE"))}</button>
    </div>
    <div id="osm-progress-slot"></div>
    <div class="opui-sp-row" id="osm-update-row">
      <div class="opui-sp-row-text">
        <div class="opui-sp-row-title">${escapeHtml(t("Database Update"))}</div>
        <div class="opui-sp-row-desc" id="osm-update-text"></div>
      </div>
      <button type="button" class="opui-btn opui-btn--action" id="osm-check-btn">${escapeHtml(t("CHECK"))}</button>
    </div>
    <div class="opui-sp-row" id="osm-country-row">
      <div class="opui-sp-row-text">
        <div class="opui-sp-row-title">${escapeHtml(t("Country"))}</div>
        <div class="opui-sp-row-desc" id="osm-country-text"></div>
      </div>
      <button type="button" class="opui-btn opui-btn--action" id="osm-country-btn">${escapeHtml(t("SELECT"))}</button>
    </div>
    <div class="opui-sp-row" id="osm-state-row" hidden>
      <div class="opui-sp-row-text">
        <div class="opui-sp-row-title">${escapeHtml(t("State"))}</div>
        <div class="opui-sp-row-desc" id="osm-state-text"></div>
      </div>
      <button type="button" class="opui-btn opui-btn--action" id="osm-state-btn">${escapeHtml(t("SELECT"))}</button>
    </div>`;
  container.appendChild(block);

  block.querySelector("#osm-delete-btn")?.addEventListener("click", async () => {
    if (!(await showConfirm({
      message: t("This will delete ALL downloaded maps\n\nAre you sure you want to delete all maps?"),
      confirmText: t("Yes, delete all maps"),
    }))) return;
    const res = await apiPost("/api/opui/osm/delete");
    if (res.ok) toast(t("Delete requested"));
    else toast(res.error || t("Failed"));
  });

  block.querySelector("#osm-check-btn")?.addEventListener("click", async () => {
    if (!(await showConfirm({
      message: t("This will start the download process and it might take a while to complete."),
      confirmText: t("Start Download"),
    }))) return;
    const res = await apiPost("/api/opui/action/osm_check_updates");
    if (res.ok) toast(t("CHECK"));
    else toast(res.error || t("Failed"));
  });

  block.querySelector("#osm-country-btn")?.addEventListener("click", () => pickOsmRegion("Country"));
  block.querySelector("#osm-state-btn")?.addEventListener("click", () => pickOsmRegion("State"));
  updateOsmLabels(block, data);
  return block;
}

function updateOsmLabels(block, data) {
  if (!block) return;
  const values = data?.values || panelDataRef?.values || {};
  const countryText = block.querySelector("#osm-country-text");
  const stateText = block.querySelector("#osm-state-text");
  const updateText = block.querySelector("#osm-update-text");
  const stateRow = block.querySelector("#osm-state-row");
  const updateRow = block.querySelector("#osm-update-row");
  if (countryText) countryText.textContent = values.OsmLocationTitle || "";
  if (stateText) stateText.textContent = values.OsmStateTitle || "";
  if (updateText) updateText.textContent = formatLastChecked(values.OsmDownloadedDate);
  if (stateRow) stateRow.hidden = String(values.OsmLocationName || "") !== "US";
  if (updateRow) updateRow.hidden = !values.OsmLocationName;
}

function applyOsmCustom(data) {
  const block = document.getElementById("osm-custom-root");
  if (!block || !data?.ok) return;
  updateOsmCustomDom(block, data);
  updateOsmLabels(block, panelDataRef);
}

function updateOsmCustomDom(block, data) {
  const size = data.size || {};
  const prog = data.progress || {};
  const sizeEl = block.querySelector("#osm-size-text");
  if (sizeEl) {
    if (size.pending) sizeEl.textContent = t("Calculating…");
    else if (size.ok) sizeEl.textContent = `${Number(size.size_mb || 0).toFixed(2)} ${t("MB")}`;
  }

  const slot = block.querySelector("#osm-progress-slot");
  if (slot) {
    slot.innerHTML = "";
    if (prog.ok && prog.active) {
      slot.appendChild(createProgressRow(t("Downloading Map"), prog.progress || 0));
    }
  }

  const stateBtn = block.querySelector("#osm-state-btn");
  if (stateBtn) {
    const loc = panelDataRef?.values?.OsmLocationName || "";
    const stateRow = block.querySelector("#osm-state-row");
    if (stateRow) stateRow.hidden = String(loc) !== "US";
  }
}

async function pickOsmRegion(regionType) {
  const btn = document.getElementById(regionType === "Country" ? "osm-country-btn" : "osm-state-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = t("FETCHING...");
  }
  const regions = await apiGet(`/api/opui/osm/regions?type=${encodeURIComponent(regionType)}`);
  if (btn) {
    btn.disabled = false;
    btn.textContent = t("SELECT");
  }
  if (!regions.ok) {
    toast(regions.error || "Failed");
    return;
  }

  if (regionType === "Country") {
    const folders = (regions.countries || []).map((c) => ({
      name: c.title,
      bundles: [{ ref: c.name, name: c.title }],
    }));
    const ref = await showTree({ title: t("Country"), folders, searchable: true });
    if (!ref) return;
    const c = regions.countries.find((x) => x.name === ref);
    if (!c) return;
    await apiPost("/api/opui/osm/select", { country: c.name, country_title: c.title });
    toast(c.title);
    if (c.name === "US") {
      const stateRow = document.getElementById("osm-state-row");
      if (stateRow) stateRow.hidden = false;
      await pickOsmRegion("State");
    }
    window.dispatchEvent(new CustomEvent("opui:refresh-panel"));
    return;
  }

  const countryTitle = panelDataRef?.values?.OsmLocationTitle || "US";
  const folders = [{
    name: countryTitle,
    bundles: (regions.states || []).map((s) => ({ ref: s.name, name: s.title })),
  }];
  const ref = await showTree({ title: t("State"), folders, searchable: true });
  if (!ref) return;
  const country = panelDataRef?.values?.OsmLocationName || "US";
  const st = regions.states.find((s) => s.name === ref);
  await apiPost("/api/opui/osm/select", {
    country,
    country_title: countryTitle,
    state: ref,
    state_title: st?.title || ref,
  });
  toast(st?.title || ref);
  window.dispatchEvent(new CustomEvent("opui:refresh-panel"));
}

async function renderOsmPanel(container, data) {
  const gen = beginPanelRender();
  container.innerHTML = "";
  const versionRow = document.createElement("div");
  versionRow.className = "opui-sp-row";
  versionRow.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Mapd Version"))}</div>
    </div>
    <div class="opui-row-value" id="osm-mapd-version">${escapeHtml(data.values?.MapdVersion || t("Loading..."))}</div>`;
  container.appendChild(versionRow);

  const block = ensureOsmCustomBlock(container, data);
  if (panelRenderStale(gen)) return;
  try {
    const [size, prog] = await Promise.all([
      apiGet("/api/opui/osm/size"),
      apiGet("/api/opui/osm/progress"),
    ]);
    if (panelRenderStale(gen)) return;
    updateOsmCustomDom(block, { ok: true, size, progress: prog });
  } catch (_) {
    /* WS custom data will fill in */
  }
}

async function renderVehiclePanel(container, data) {
  const gen = beginPanelRender();
  container.innerHTML = "";
  const vp = await apiGet("/api/opui/vehicle/platforms");
  if (panelRenderStale(gen)) return;
  if (!vp.ok) return;

  const status = vp.status || (vp.manual ? "manual" : "unknown");
  const display = platformDisplayText(vp.display) || platformDisplayText(vp.active) || "";
  const titleText = display || t("No vehicle selected");
  const statusClass = status === "auto" ? "auto" : status === "manual" ? "manual" : "unknown";
  const actionLabel = vp.manual ? t("REMOVE") : t("SELECT");

  const pickRow = document.createElement("div");
  pickRow.className = "opui-sp-row";
  pickRow.innerHTML = `
    <div class="opui-sp-row-text">
      <div id="vehicle-platform-title" class="opui-sp-row-title opui-vehicle-title--${statusClass}">${escapeHtml(titleText)}</div>
    </div>
    <button type="button" id="vehicle-platform-btn" class="opui-btn">${escapeHtml(actionLabel)}</button>`;
  pickRow.querySelector("button")?.addEventListener("click", async () => {
    const latest = await apiGet("/api/opui/vehicle/platforms");
    const hasManual = !!latest.manual;
    if (hasManual) {
      await apiPost("/api/opui/vehicle/select", { bundle: "" });
      toast(t("Vehicle"));
      await renderVehiclePanel(container, data);
      return;
    }
    const folders = (latest.tree || []).map((b) => ({
      name: b.name,
      bundles: (b.platforms || []).map((p) => ({ ref: p.bundle, name: p.label })),
    }));
    const ref = await showTree({ title: t("Select a vehicle"), folders, searchable: true });
    if (!ref) return;
    const offroadMsg = globalState.is_offroad
      ? t("This setting will take effect immediately.")
      : t("This setting will take effect once the device enters offroad state.");
    if (!(await showConfirm({ message: offroadMsg, confirmText: t("Confirm") }))) return;
    const res = await apiPost("/api/opui/vehicle/select", { bundle: ref });
    if (res.ok) {
      toast(platformDisplayText(res.display) || ref);
      await renderVehiclePanel(container, data);
    } else {
      toast(res.error || t("Failed"));
    }
  });
  container.appendChild(pickRow);

  const legend = document.createElement("div");
  legend.className = "opui-vehicle-legend";
  legend.innerHTML = `
    <p>${escapeHtml(t("Select vehicle to force fingerprint manually."))}</p>
    <p>${escapeHtml(t("Colors represent vehicle fingerprint status:"))}</p>
    <p><span class="dot green"></span> ${escapeHtml(t("Fingerprinted automatically"))}</p>
    <p><span class="dot blue"></span> ${escapeHtml(t("Manually selected fingerprint"))}</p>
    <p><span class="dot yellow"></span> ${escapeHtml(t("Not fingerprinted or manually selected"))}</p>`;
  container.appendChild(legend);

  const bw = await apiGet("/api/opui/vehicle/brand-widgets");
  if (panelRenderStale(gen)) return;
  if (bw.ok && bw.widgets?.length) {
    const brandData = { values: { ...data.values, ...bw.values } };
    for (const w of bw.widgets) {
      const el = renderWidget(w, brandData);
      if (el) container.appendChild(el);
    }
  }
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
      current: Math.max(0, idx),
    });
    if (pick == null) return;
    const lang = langs[pick];
    if (!lang) return;
    const res = await apiPost("/api/opui/device/language", { language: lang.id });
    if (res.ok) {
      toast(`${t("Language")}: ${lang.label}`);
      deviceExtrasCache = { ...ex, current_language: lang.id };
      const { loadI18n } = await import("./i18n.js");
      await loadI18n(true);
      requestPanelRefresh();
      window.dispatchEvent(new CustomEvent("opui:language-changed"));
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
    row.querySelector("button")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("opui:open-driver-camera"));
    });
  }
  return row;
}

async function renderSunnylinkPanel(container, data) {
  const gen = beginPanelRender();
  container.innerHTML = "";
  const sl = await apiGet("/api/opui/sunnylink/status");
  if (panelRenderStale(gen)) return;
  const values = data.values || {};

  const hdr = document.createElement("div");
  hdr.className = "opui-sunnylink-header";
  hdr.innerHTML = `
    <div class="opui-sunnylink-title">${escapeHtml(t("🚀 sunnylink 🚀"))}</div>
    <div class="opui-sunnylink-desc opui-sunnylink-desc--green">${escapeHtml(t("For secure backup, restore, and remote configuration"))}</div>
    <div class="opui-sunnylink-desc opui-sunnylink-desc--orange">${escapeHtml(t("Sponsorship isn't required for basic backup/restore"))}<br>${escapeHtml(t("Click the Sponsor button for more details"))}</div>
    ${sl.ok && sl.dongle_id ? `<div class="opui-sunnylink-id">${escapeHtml(t("Device ID"))}: ${escapeHtml(sl.dongle_id)}</div>` : ""}`;
  container.appendChild(hdr);

  const widgets = [
    {
      type: "bool", param: "SunnylinkEnabled", label: "Enable sunnylink",
      value: values.SunnylinkEnabled, desc: "This is the master switch, it will allow you to cutoff any sunnylink requests should you want to do that.",
    },
    {
      type: "bool", param: "EnableSunnylinkUploader", label: "Enable sunnylink uploader (infrastructure test)",
      value: values.EnableSunnylinkUploader,
      desc: "Enable sunnylink uploader to allow sunnypilot to upload your driving data to sunnypilot servers. (Only for highest tiers, and does NOT bring ANY benefit to you yet. We are just testing data volume.)",
    },
  ];
  for (const w of widgets) {
    const el = renderWidget({ ...w, type: "bool" }, data);
    if (el) container.appendChild(el);
  }

  const sponsorRow = document.createElement("div");
  sponsorRow.className = "opui-sp-row";
  sponsorRow.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-label">${escapeHtml(t("Sponsor Status"))}</div>
      <div class="opui-sp-row-desc">${escapeHtml(t("Become a sponsor of sunnypilot to get early access to sunnylink features when they become available."))}</div>
    </div>
    <button type="button" class="opui-btn">${escapeHtml(sl.is_sponsor ? (sl.tier || t("SPONSOR")) : t("SPONSOR"))}</button>`;
  sponsorRow.querySelector("button")?.addEventListener("click", async () => {
    const res = await apiGet("/api/opui/sunnylink/pair?mode=sponsor");
    if (res.ok && res.url) window.open(res.url, "_blank", "noopener");
    else toast(res.error || t("Failed"));
  });
  container.appendChild(sponsorRow);

  const pairRow = document.createElement("div");
  pairRow.className = "opui-sp-row";
  pairRow.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-label">${escapeHtml(t("Pair GitHub Account"))}</div>
      <div class="opui-sp-row-desc">${escapeHtml(t("Pair your GitHub account to grant your device sponsor benefits, including API access on sunnylink."))}</div>
    </div>
    <button type="button" class="opui-btn">${escapeHtml(sl.is_paired ? t("Paired") : t("Not Paired"))}</button>`;
  pairRow.querySelector("button")?.addEventListener("click", async () => {
    const res = await apiGet("/api/opui/sunnylink/pair?mode=pair");
    if (res.ok && res.url) window.open(res.url, "_blank", "noopener");
    else toast(res.error || t("Failed"));
  });
  container.appendChild(pairRow);

  if (!sl.ok) return;

  if (sl.backup?.status && sl.backup.status !== "idle") {
    container.appendChild(createProgressRow(`${t("Backup")} ${sl.backup.status}`, sl.backup.progress || 0));
  }

  const dual = createDualButton(
    { label: t("Backup Settings") },
    { label: t("Restore Settings") },
    async () => {
      if (!(await showConfirm({
        message: t("Are you sure you want to backup your current sunnypilot settings?"),
        confirmText: t("Backup"),
        cancelText: t("Cancel"),
      }))) return;
      const res = await apiPost("/api/opui/action/sunnylink_backup");
      if (res.ok) toast(t("Backup started"));
      else toast(res.error || t("Failed"));
    },
    async () => {
      if (!(await showConfirm({
        message: t("Are you sure you want to restore the last backed up sunnypilot settings?"),
        confirmText: t("Restore"),
        cancelText: t("Cancel"),
      }))) return;
      const res = await apiPost("/api/opui/action/sunnylink_restore");
      if (res.ok) toast(t("Restore started"));
      else toast(res.error || t("Failed"));
    },
  );
  container.appendChild(dual);
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
  const gen = beginPanelRender();
  const sw = await apiGet("/api/opui/software");
  if (panelRenderStale(gen)) return;
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
      <div class="opui-release-notes" id="software-current-notes" hidden></div>
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
    const label = btn?.textContent?.trim();
    const action = label === t("DOWNLOAD") ? "updater_download" : "updater_check";
    if (btn) btn.disabled = true;
    const res = await apiPost(`/api/opui/action/${action}`);
    if (!res.ok) toast(res.error || t("Failed"));
    else if (btn) btn.disabled = false;
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
      <div class="opui-release-notes" id="software-install-notes" hidden></div>
    </div>
    <button type="button" class="opui-btn" id="software-install-btn">${escapeHtml(t("INSTALL"))}</button>`;
  install.querySelector("#software-install-btn")?.addEventListener("click", async () => {
    const res = await apiPost("/api/opui/action/updater_install");
    if (res.ok) toast(t("Install Update"));
    else toast(res.error || t("Failed"));
  });
  container.appendChild(install);

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
      const pick = await showMultiOption({
        title: t("Target Branch"),
        options: sw.branches,
        selected: idx,
        current: idx,
      });
      if (pick == null) return;
      const b = sw.branches[pick];
      const res = await apiPost("/api/opui/action/set_branch", { branch: b });
      if (res.ok) {
        toast(`${t("Target Branch")}: ${b}`);
        requestPanelRefresh();
      }
    });
    container.appendChild(branchRow);
  }

  appendPanelWidgets(container, data);

  applySoftwareCustom(sw);
}

function formatBundleDisplay(raw) {
  if (raw == null || raw === "") return "—";
  if (typeof raw === "object") {
    return raw.displayName || raw.internalName || raw.ref || "—";
  }
  const s = String(raw);
  const display = s.match(/displayName['"]:\s*['"]([^'"]+)['"]/);
  if (display) return display[1];
  const internal = s.match(/internalName['"]:\s*['"]([^'"]+)['"]/);
  if (internal) return internal[1];
  return formatValue(s);
}

function formatValue(v) {
  if (v == null || v === "") return "—";
  const s = String(v);
  if (s.length > 200) return s.slice(0, 200) + "…";
  return s;
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
