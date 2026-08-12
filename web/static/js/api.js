/** HTTP helpers — routes through WebSocket RPC when connected. */

import { opuiWs } from "./ws.js";

const ASSET_RE = /^\/api\/opui\/assets\//;
const HTTP_FIRST_RE = /^\/api\/opui\/(panels|dev|i18n|device|bootstrap)/;
const HTTP_TIMEOUT_MS = 8000;
const WEBRTC_TIMEOUT_MS = 45000;

function isWebrtcPath(path) {
  return /^\/api\/opui\/webrtc\//.test(path) || /^\/api\/opui\/action\/webrtc_/.test(path);
}

function useHttp(path) {
  if (isWebrtcPath(path)) return true;
  if (ASSET_RE.test(path)) return true;
  if (/^\/api\/opui\/bootstrap/.test(path)) return true;
  if (window.__OPUI_DEV_PC && HTTP_FIRST_RE.test(path)) return true;
  return false;
}

async function fetchJson(path, init = {}) {
  const ctrl = new AbortController();
  const timeoutMs = isWebrtcPath(path) ? WEBRTC_TIMEOUT_MS : HTTP_TIMEOUT_MS;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(path, { ...init, signal: ctrl.signal });
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function apiGet(path) {
  if (!useHttp(path) && opuiWs.connected) {
    try {
      return await opuiWs.rpc("GET", path);
    } catch (_) { /* fallback */ }
  }
  return fetchJson(path);
}

export async function apiPut(path, body) {
  if (!useHttp(path) && opuiWs.connected) {
    try {
      return await opuiWs.rpc("PUT", path, body);
    } catch (_) { /* fallback */ }
  }
  return fetchJson(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function apiPost(path, body = {}) {
  if (!useHttp(path) && opuiWs.connected) {
    try {
      return await opuiWs.rpc("POST", path, body);
    } catch (_) { /* fallback */ }
  }
  return fetchJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function toast(msg, ms = 3000) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, ms);
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    const dlg = document.getElementById("confirm-dialog");
    const msg = document.getElementById("confirm-msg");
    const ok = document.getElementById("confirm-ok");
    const cancel = document.getElementById("confirm-cancel");
    if (!dlg || !msg) {
      resolve(window.confirm(message));
      return;
    }
    msg.textContent = message;
    dlg.showModal();
    const done = (v) => {
      dlg.close();
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      resolve(v);
    };
    const onOk = () => done(true);
    const onCancel = () => done(false);
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
  });
}
