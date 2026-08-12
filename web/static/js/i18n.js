let strings = {};
let language = "main";
let lastLang = "";

export function tr(text) {
  if (!text) return "";
  return strings[text] || text;
}

export function getLanguage() {
  return language;
}

export function applyI18nPayload(data, force = false) {
  if (!data?.ok) return false;
  if (!force && data.language === lastLang && Object.keys(strings).length) {
    return false;
  }
  language = data.language || "main";
  lastLang = language;
  strings = data.strings || {};
  document.documentElement.lang = language.startsWith("zh") ? "zh-CN" : "en";
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
