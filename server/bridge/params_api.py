"""Read/write openpilot Params for settings panels."""

from __future__ import annotations

import os
from typing import Any

from openpilot.common.params import ParamKeyType, Params, UnknownKeyName

from webui.server.bridge.panel_catalog import PANELS, get_panel, panel_schema

_PARAM_TYPE_NAMES: dict[ParamKeyType, str] = {
  ParamKeyType.STRING: "STRING",
  ParamKeyType.BOOL: "BOOL",
  ParamKeyType.INT: "INT",
  ParamKeyType.FLOAT: "FLOAT",
  ParamKeyType.TIME: "TIME",
  ParamKeyType.JSON: "JSON",
  ParamKeyType.BYTES: "BYTES",
}


def _params() -> Params:
  return Params()


def _param_type(p: Params, key: str) -> ParamKeyType | None:
  try:
    return p.get_type(key)
  except UnknownKeyName:
    return None


def _param_type_name(p: Params, key: str) -> str | None:
  t = _param_type(p, key)
  if t is None:
    return None
  name = getattr(t, "name", None)
  if name:
    return name
  return _PARAM_TYPE_NAMES.get(t)


def _serialize_value(val: Any) -> str:
  if val is None:
    return ""
  if isinstance(val, bytes):
    try:
      return val.decode("utf-8", errors="replace")
    except Exception:
      return val.hex()
  if isinstance(val, bool):
    return "1" if val else "0"
  return str(val)


def _read_param_value(p: Params, key: str, ptype: str | None) -> str:
  if ptype == "BOOL":
    try:
      return "1" if p.get_bool(key) else "0"
    except Exception:
      return "0"
  return _serialize_value(p.get(key))


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
      "value": _read_param_value(p, key, ptype),
      "type": ptype,
      "locked": locked,
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def _coerce_write_value(ptype_enum: ParamKeyType, value: str) -> Any:
  if ptype_enum == ParamKeyType.BOOL:
    return value in ("1", "true", "True", True)
  if ptype_enum == ParamKeyType.INT:
    return int(value)
  if ptype_enum == ParamKeyType.FLOAT:
    return float(value)
  if ptype_enum == ParamKeyType.JSON:
    import json
    return json.loads(value) if isinstance(value, str) else value
  return value


def put_param(key: str, value: str, *, needs_cycle: bool = False) -> dict[str, Any]:
  try:
    p = _params()
    ptype_enum = _param_type(p, key)
    ptype = _param_type_name(p, key)
    if ptype_enum is None or ptype is None:
      return {"ok": False, "error": f"unknown param: {key}"}

    try:
      if p.get_bool(key + "Lock"):
        return {"ok": False, "error": f"param locked: {key}"}
    except UnknownKeyName:
      pass

    if ptype_enum == ParamKeyType.BOOL:
      p.put_bool(key, _coerce_write_value(ptype_enum, value), block=True)
    else:
      p.put(key, _coerce_write_value(ptype_enum, value), block=True)

    if needs_cycle:
      p.put_bool("OnroadCycleRequested", True, block=True)

    return {"ok": True, "key": key, "value": _read_param_value(p, key, ptype)}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def list_toggle_params() -> dict[str, Any]:
  panel = get_panel("toggles")
  if not panel:
    return {"ok": False, "error": "toggles panel missing", "params": []}
  return panel_values("toggles")


def panel_values(panel_id: str) -> dict[str, Any]:
  panel = get_panel(panel_id)
  if not panel:
    return {"ok": False, "error": f"unknown panel: {panel_id}"}

  p = _params()
  values: dict[str, Any] = {}
  widgets_out: list[dict[str, Any]] = []

  def _ensure_param(key: str) -> None:
    if not key or key in values:
      return
    ptype = _param_type_name(p, key)
    if ptype is not None:
      values[key] = _read_param_value(p, key, ptype)

  for w in panel.get("widgets", []):
    if os.getenv("LITE") is not None and w.get("param") == "RecordAudio":
      continue
    for dep_key in ("visible_if", "advanced_if"):
      dep = w.get(dep_key)
      if isinstance(dep, dict) and dep.get("param"):
        _ensure_param(dep["param"])
    wtype = w.get("type")
    if wtype in ("section", "separator", "html", "action", "subpanel"):
      widgets_out.append({**w, "available": True})
      continue
    if wtype == "custom":
      widgets_out.append({**w, "available": True})
      continue
    if wtype == "dual_button":
      entry = {**w, "available": True}
      for side in ("left", "right"):
        side_w = dict(w.get(side) or {})
        sk = side_w.get("param")
        if sk:
          ptype = _param_type_name(p, sk)
          if ptype is not None:
            val = _read_param_value(p, sk, ptype)
            values[sk] = val
            side_w["value"] = val
            side_w["param_type"] = ptype
        entry[side] = side_w
      widgets_out.append(entry)
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
    val = _read_param_value(p, key, ptype)
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
      "param_type": ptype,
      "locked": locked,
    })

  return {
    "ok": True,
    "panel": panel_id,
    "title": panel.get("title", panel_id),
    "parent": panel.get("parent"),
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
