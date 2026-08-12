let strings = {};
let language = "en";
let lastLang = "";

export function tr(text) {
  if (!text) return "";
  return strings[text] || text;
}

export function getLanguage() {
  return language;
}

const STATIC_UI_KEYS = {
  "modal-confirm-cancel": "Cancel",
  "modal-confirm-ok": "Confirm",
  "keyboard-cancel": "Cancel",
  "tree-cancel": "Cancel",
  "tree-select": "Select",
  "multi-cancel": "Cancel",
  "multi-select": "Select",
  "html-ok": "OK",
  "driver-cam-close": "Close",
  "confirm-cancel": "Cancel",
  "confirm-ok": "Confirm",
};

export function syncStaticUiStrings() {
  for (const [id, key] of Object.entries(STATIC_UI_KEYS)) {
    const el = document.getElementById(id);
    if (el) el.textContent = tr(key);
  }
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
