/** HTTP helpers — routes through WebSocket RPC when connected. */

import { opuiWs } from "./ws.js";

const ASSET_RE = /^\/api\/opui\/assets\//;

function useHttp(path) {
  return ASSET_RE.test(path);
}

export async function apiGet(path) {
  if (!useHttp(path) && opuiWs.connected) {
    try {
      return await opuiWs.rpc("GET", path);
    } catch (_) { /* fallback */ }
  }
  const r = await fetch(path);
  return r.json();
}

export async function apiPut(path, body) {
  if (!useHttp(path) && opuiWs.connected) {
    try {
      return await opuiWs.rpc("PUT", path, body);
    } catch (_) { /* fallback */ }
  }
  const r = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

export async function apiPost(path, body = {}) {
  if (!useHttp(path) && opuiWs.connected) {
    try {
      return await opuiWs.rpc("POST", path, body);
    } catch (_) { /* fallback */ }
  }
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
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
