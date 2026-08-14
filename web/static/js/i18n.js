let strings = {};
let language = "en";
let lastLang = "";

export function tr(text) {
  if (!text) return "";
  return strings[text] || text;
}

/** Plural helper — keys like "{} ALERT" / "{} ALERTS" with `{}` placeholder. */
export function trn(singular, plural, count) {
  const n = Number(count) || 0;
  const template = tr(n === 1 ? singular : plural);
  return template.includes("{}") ? template.replace("{}", String(n)) : template;
}

export function getLanguage() {
  return language;
}

const STATIC_UI_KEYS = {
  "modal-confirm-cancel": "Cancel",
  "modal-confirm-ok": "Confirm",
  "keyboard-cancel": "Cancel",
  "keyboard-confirm": "Confirm",
  "tree-cancel": "Cancel",
  "tree-select": "Select",
  "multi-cancel": "Cancel",
  "multi-select": "Select",
  "html-ok": "OK",
  "driver-cam-title": "Driver Camera Preview",
  "driver-cam-loading-text": "camera starting",
  "confirm-cancel": "Cancel",
  "confirm-ok": "Confirm",
  "webui-update-later": "Close",
  "webui-update-check": "Check again",
  "webui-update-apply": "Update now",
  "camera-status-text": "Loading camera...",
  "btn-home-camera-preview-label": "Driving preview",
  "sunnylink": "sunnylink",
  "Decline": "Decline",
  "Agree": "Agree",
  "Driver camera preview enabled": "Driver camera preview enabled",
  "Driver camera preview disabled": "Driver camera preview disabled",
  "Driver camera preview": "Driver camera preview",
  "Offroad only. Enables camerad for driver-facing preview in WebUI. Blocks onroad while enabled.": "Offroad only. Enables camerad for driver-facing preview in WebUI. Blocks onroad while enabled.",
  "Bookmark route": "Bookmark route",
  "Route bookmarked": "Route bookmarked",
  "Home": "Home",
  "Starting live stream service (~4s)…": "Starting live stream service (~4s)…",
  "Starting live stream service ({s}s)…": "Starting live stream service ({s}s)…",
  "Cannot start driving": "Cannot start driving",
  "Manager failed to start": "Manager failed to start",
  "No built-in display — use this Web UI as your primary interface. USB: https://10.255.128.121:5080/ or your device IP.": "No built-in display — use this Web UI as your primary interface. USB: https://10.255.128.121:5080/ or your device IP.",
  "Only available while offroad": "Only available while offroad",
  "Upload driver camera data to improve driver monitoring? You can change this later in Toggles.": "Upload driver camera data to improve driver monitoring? You can change this later in Toggles.",
  "Enable": "Enable",
  "Not now": "Not now",
  "Headless (no display)": "Headless (no display)",
};

const STATIC_UI_TITLES = {
  "btn-sidebar-settings": "Settings",
  "sidebar-mic": "Recording",
  "btn-sidebar-bottom": "Home",
};

const STATIC_ARIA_LABELS = {
  "driver-cam-close": "Close",
  "btn-close-settings": "Close",
};

export function syncDriverCamUi() {
  const title = document.getElementById("driver-cam-title");
  if (title) title.textContent = tr("Driver Camera Preview");
  const close = document.getElementById("driver-cam-close");
  if (close) close.setAttribute("aria-label", tr("Close"));
}

export function syncStaticUiStrings() {
  for (const [id, key] of Object.entries(STATIC_UI_KEYS)) {
    const el = document.getElementById(id);
    if (el) el.textContent = tr(key);
  }
  for (const [id, key] of Object.entries(STATIC_UI_TITLES)) {
    const el = document.getElementById(id);
    if (el) el.title = tr(key);
  }
  for (const [id, key] of Object.entries(STATIC_ARIA_LABELS)) {
    const el = document.getElementById(id);
    if (el) el.setAttribute("aria-label", tr(key));
  }
  syncDriverCamUi();
  const treeSearch = document.getElementById("tree-search");
  if (treeSearch) treeSearch.placeholder = tr("Search");
}

export function applyI18nPayload(data, force = false) {
  if (!data?.ok) return false;
  if (!force && data.language === lastLang && Object.keys(strings).length) {
    return false;
  }
  language = data.language || "en";
  lastLang = language;
  strings = data.strings || {};
  const po = data.po_code || language;
  document.documentElement.lang = String(po).startsWith("zh") ? "zh-CN" : (po === "en" ? "en" : po);
  syncStaticUiStrings();
  return true;
}

export async function loadI18n(force = false) {
  try {
    const { apiGet } = await import("./api.js");
    const data = await apiGet("/api/opui/i18n");
    if (!data.ok) return false;
    return applyI18nPayload(data, force);
  } catch {
    return false;
  }
}

export function translatePanelTitle(title) {
  return tr(title);
}
