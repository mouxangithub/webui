/** WebSocket client for live UI state + panel param sync. */

const WS_PATH = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/opui`;

class OpuiSocket {
  constructor() {
    this._ws = null;
    this._connected = false;
    this._handlers = new Map();
    this._pending = new Map();
    this._req = 0;
    this._reconnectMs = 500;
    this._watchPanel = null;
    this._shouldRun = false;
  }

  get connected() {
    return this._connected;
  }

  on(type, fn) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(fn);
    return () => this._handlers.get(type)?.delete(fn);
  }

  _emit(type, payload) {
    for (const fn of this._handlers.get(type) || []) {
      try { fn(payload); } catch (_) { /* ignore */ }
    }
  }

  connect() {
    this._shouldRun = true;
    if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const ws = new WebSocket(WS_PATH);
    this._ws = ws;
    ws.onopen = () => {
      this._connected = true;
      this._reconnectMs = 500;
      this._send({ type: "subscribe", channels: ["state", "home"] });
      if (this._watchPanel) {
        this._send({ type: "watch_panel", panel: this._watchPanel });
      }
      this._emit("open", null);
    };
    ws.onclose = () => {
      this._connected = false;
      this._emit("close", null);
      if (!this._shouldRun) return;
      setTimeout(() => this.connect(), this._reconnectMs);
      this._reconnectMs = Math.min(this._reconnectMs * 1.5, 5000);
    };
    ws.onerror = () => { /* onclose handles reconnect */ };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (_) { return; }
      const { type } = msg;
      if (type === "put_param_result" && msg.id != null) {
        const pending = this._pending.get(msg.id);
        if (pending) {
          this._pending.delete(msg.id);
          pending.resolve(msg);
        }
      }
      this._emit(type, msg);
    };
  }

  disconnect() {
    this._shouldRun = false;
    this._ws?.close();
    this._ws = null;
    this._connected = false;
  }

  _send(obj) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return false;
    this._ws.send(JSON.stringify(obj));
    return true;
  }

  watchPanel(panelId) {
    this._watchPanel = panelId || null;
    if (panelId) {
      this._send({ type: "watch_panel", panel: panelId });
    }
  }

  putParam(key, value, needsCycle = false) {
    if (this._connected) {
      const id = `r${++this._req}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this._pending.delete(id);
          reject(new Error("timeout"));
        }, 8000);
        this._pending.set(id, {
          resolve: (msg) => {
            clearTimeout(timer);
            resolve(msg);
          },
        });
        if (!this._send({ type: "put_param", id, key, value: String(value), needs_cycle: !!needsCycle })) {
          clearTimeout(timer);
          this._pending.delete(id);
          reject(new Error("not connected"));
        }
      });
    }
    return null;
  }
}

export const opuiWs = new OpuiSocket();
