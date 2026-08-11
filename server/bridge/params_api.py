"""Read/write openpilot Params for settings panels."""

from __future__ import annotations

from typing import Any

from openpilot.common.params import Params, UnknownKeyName

from webui.server.bridge.panel_catalog import PANELS, get_panel


def _params() -> Params:
  return Params()


def _param_type_name(p: Params, key: str) -> str | None:
  try:
    t = p.get_type(key)
    if t is None:
      return None
    return str(t).split(".")[-1].upper()
  except UnknownKeyName:
    return None


def _serialize_value(val: Any) -> str:
  if val is None:
    return ""
  if isinstance(val, bytes):
    try:
      return val.decode("utf-8", errors="replace")
    except Exception:
      return val.hex()
  return str(val)


def get_param(key: str) -> dict[str, Any]:
  try:
    p = _params()
    ptype = _param_type_name(p, key)
    if ptype is None:
      return {"ok": False, "error": f"unknown param: {key}"}
    val = p.get(key)
    locked = False
    try:
      locked = p.get_bool(key + "Lock")
    except UnknownKeyName:
      pass
    return {
      "ok": True,
      "key": key,
      "value": _serialize_value(val),
      "type": ptype,
      "locked": locked,
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def put_param(key: str, value: str, *, needs_cycle: bool = False) -> dict[str, Any]:
  try:
    p = _params()
    ptype = _param_type_name(p, key)
    if ptype is None:
      return {"ok": False, "error": f"unknown param: {key}"}

    try:
      if p.get_bool(key + "Lock"):
        return {"ok": False, "error": f"param locked: {key}"}
    except UnknownKeyName:
      pass

    if ptype == "BOOL":
      p.put_bool(key, value in ("1", "true", "True", True), block=True)
    else:
      p.put(key, value, block=True)

    if needs_cycle:
      p.put_bool("OnroadCycleRequested", True, block=True)

    return {"ok": True, "key": key, "value": _serialize_value(p.get(key))}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def list_toggle_params() -> dict[str, Any]:
  panel = get_panel("toggles")
  if not panel:
    return {"ok": False, "error": "toggles panel missing", "params": []}
  return panel_values("toggles")


def panel_schema() -> dict[str, Any]:
  return {"ok": True, "panels": PANELS}


def panel_values(panel_id: str) -> dict[str, Any]:
  panel = get_panel(panel_id)
  if not panel:
    return {"ok": False, "error": f"unknown panel: {panel_id}"}

  p = _params()
  values: dict[str, Any] = {}
  widgets_out: list[dict[str, Any]] = []

  for w in panel.get("widgets", []):
    wtype = w.get("type")
    if wtype in ("section", "html", "action"):
      widgets_out.append({**w, "available": True})
      continue

    key = w.get("param")
    if not key:
      widgets_out.append({**w, "available": False})
      continue

    ptype = _param_type_name(p, key)
    if ptype is None:
      widgets_out.append({**w, "available": False, "missing": True})
      continue

    raw = p.get(key)
    val = _serialize_value(raw)
    values[key] = val
    locked = False
    try:
      locked = p.get_bool(key + "Lock")
    except UnknownKeyName:
      pass
    widgets_out.append({
      **w,
      "available": True,
      "value": val,
      "type": ptype,
      "locked": locked,
    })

  return {
    "ok": True,
    "panel": panel_id,
    "title": panel.get("title", panel_id),
    "custom": panel.get("custom"),
    "values": values,
    "widgets": widgets_out,
  }


def batch_get(keys: list[str]) -> dict[str, Any]:
  out: dict[str, Any] = {}
  for key in keys:
    r = get_param(key)
    if r.get("ok"):
      out[key] = r
  return {"ok": True, "params": out}
