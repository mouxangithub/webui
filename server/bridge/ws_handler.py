"""WebSocket hub — push UI state, home, and panel param sync."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from aiohttp import web

from webui.server.bridge.params_api import panel_values, put_param
from webui.server.bridge.state_hub import get_home, get_state, home_seq, state_seq

log = logging.getLogger("webui.ws")

_connections: set[web.WebSocketResponse] = set()
_meta: dict[web.WebSocketResponse, dict[str, Any]] = {}
_panel_hash: dict[str, str] = {}
_broadcast_task: asyncio.Task | None = None

STATE_INTERVAL = 0.2
PANEL_INTERVAL = 0.4
HOME_INTERVAL = 5.0


def _values_hash(values: dict[str, Any]) -> str:
  return json.dumps(values, sort_keys=True, default=str)


async def ws_opui_handler(request: web.Request) -> web.WebSocketResponse:
  ws = web.WebSocketResponse(heartbeat=30)
  await ws.prepare(request)
  _connections.add(ws)
  _meta[ws] = {
    "state": False,
    "home": False,
    "watch_panel": None,
    "last_state_seq": -1,
    "last_home_seq": -1,
    "last_panel_hash": "",
  }
  try:
    await ws.send_json({"type": "hello", "ok": True, "proto": 1})
    st = get_state()
    await ws.send_json({"type": "state", "seq": state_seq(), "data": st})
    _meta[ws]["last_state_seq"] = state_seq()
    _meta[ws]["state"] = True

    async for msg in ws:
      if msg.type == web.WSMsgType.TEXT:
        try:
          payload = json.loads(msg.data)
        except json.JSONDecodeError:
          await ws.send_json({"type": "error", "error": "invalid json"})
          continue
        await _handle_client(ws, payload)
      elif msg.type in (web.WSMsgType.CLOSE, web.WSMsgType.ERROR):
        break
  finally:
    _connections.discard(ws)
    _meta.pop(ws, None)
  return ws


async def _handle_client(ws: web.WebSocketResponse, msg: dict[str, Any]) -> None:
  mtype = msg.get("type")
  if mtype == "subscribe":
    channels = set(msg.get("channels") or [])
    meta = _meta.get(ws)
    if not meta:
      return
    meta["state"] = "state" in channels
    meta["home"] = "home" in channels
    if meta["state"]:
      st = get_state()
      await ws.send_json({"type": "state", "seq": state_seq(), "data": st})
      meta["last_state_seq"] = state_seq()
    if meta["home"]:
      home = get_home()
      await ws.send_json({"type": "home", "seq": home_seq(), "data": home})
      meta["last_home_seq"] = home_seq()
    return

  if mtype == "watch_panel":
    panel_id = str(msg.get("panel") or "")
    meta = _meta.get(ws)
    if not meta:
      return
    meta["watch_panel"] = panel_id or None
    meta["last_panel_hash"] = ""
    if panel_id:
      data = panel_values(panel_id)
      h = _values_hash(data.get("values", {}))
      meta["last_panel_hash"] = h
      _panel_hash[panel_id] = h
      await ws.send_json({"type": "panel", "panel": panel_id, "data": data})
    return

  if mtype == "put_param":
    req_id = msg.get("id")
    key = str(msg.get("key") or "")
    value = str(msg.get("value", ""))
    needs_cycle = bool(msg.get("needs_cycle", False))
    result = put_param(key, value, needs_cycle=needs_cycle)
    await ws.send_json({"type": "put_param_result", "id": req_id, **result})
    if result.get("ok"):
      await _broadcast_panel_updates_for_key(key)
    return

  if mtype == "ping":
    await ws.send_json({"type": "pong"})
    return

  await ws.send_json({"type": "error", "error": f"unknown type: {mtype}"})


async def _broadcast_panel_updates_for_key(_key: str) -> None:
  dead: list[web.WebSocketResponse] = []
  for ws, meta in list(_meta.items()):
    panel_id = meta.get("watch_panel")
    if not panel_id:
      continue
    try:
      data = panel_values(panel_id)
      h = _values_hash(data.get("values", {}))
      if h == meta.get("last_panel_hash"):
        continue
      meta["last_panel_hash"] = h
      _panel_hash[panel_id] = h
      await ws.send_json({"type": "panel", "panel": panel_id, "data": data})
    except Exception:
      dead.append(ws)
  for ws in dead:
    _connections.discard(ws)
    _meta.pop(ws, None)


async def ws_broadcast_loop() -> None:
  last_state_push = 0.0
  last_panel_push = 0.0
  last_home_push = 0.0
  while True:
    try:
      await asyncio.sleep(0.05)
      if not _connections:
        continue
      now = asyncio.get_event_loop().time()

      if now - last_state_push >= STATE_INTERVAL:
        last_state_push = now
        seq = state_seq()
        dead: list[web.WebSocketResponse] = []
        for ws, meta in list(_meta.items()):
          if not meta.get("state") or meta.get("last_state_seq") == seq:
            continue
          try:
            await ws.send_json({"type": "state", "seq": seq, "data": get_state()})
            meta["last_state_seq"] = seq
          except Exception:
            dead.append(ws)
        for ws in dead:
          _connections.discard(ws)
          _meta.pop(ws, None)

      if now - last_panel_push >= PANEL_INTERVAL:
        last_panel_push = now
        watched = {m.get("watch_panel") for m in _meta.values() if m.get("watch_panel")}
        for panel_id in watched:
          data = panel_values(panel_id)
          h = _values_hash(data.get("values", {}))
          if _panel_hash.get(panel_id) == h:
            continue
          _panel_hash[panel_id] = h
          dead = []
          for ws, meta in list(_meta.items()):
            if meta.get("watch_panel") != panel_id:
              continue
            try:
              await ws.send_json({"type": "panel", "panel": panel_id, "data": data})
              meta["last_panel_hash"] = h
            except Exception:
              dead.append(ws)
          for ws in dead:
            _connections.discard(ws)
            _meta.pop(ws, None)

      if now - last_home_push >= HOME_INTERVAL:
        last_home_push = now
        seq = home_seq()
        dead = []
        for ws, meta in list(_meta.items()):
          if not meta.get("home") or meta.get("last_home_seq") == seq:
            continue
          try:
            await ws.send_json({"type": "home", "seq": seq, "data": get_home()})
            meta["last_home_seq"] = seq
          except Exception:
            dead.append(ws)
        for ws in dead:
          _connections.discard(ws)
          _meta.pop(ws, None)
    except asyncio.CancelledError:
      raise
    except Exception as exc:
      log.warning("ws broadcast error: %s", exc)


def start_ws_broadcast(app: web.Application) -> None:
  global _broadcast_task
  if _broadcast_task is not None and not _broadcast_task.done():
    return

  async def _runner(_app: web.Application) -> None:
    global _broadcast_task
    _broadcast_task = asyncio.create_task(ws_broadcast_loop())

  async def _cleanup(_app: web.Application) -> None:
    global _broadcast_task
    if _broadcast_task:
      _broadcast_task.cancel()
      try:
        await _broadcast_task
      except asyncio.CancelledError:
        pass
      _broadcast_task = None

  app.on_startup.append(_runner)
  app.on_cleanup.append(_cleanup)
