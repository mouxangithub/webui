"""Read/write openpilot Params for settings panels."""

from __future__ import annotations

from typing import Any


def _params():
  from openpilot.common.params import Params
  return Params()


def get_param(key: str) -> dict[str, Any]:
  try:
    p = _params()
    if p.get_type(key) is None:
      return {"ok": False, "error": f"unknown param: {key}"}
    val = p.get(key)
    return {"ok": True, "key": key, "value": val}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def put_param(key: str, value: str) -> dict[str, Any]:
  try:
    p = _params()
    if p.get_type(key) is None:
      return {"ok": False, "error": f"unknown param: {key}"}
    p.put(key, value, block=True)
    return {"ok": True, "key": key, "value": value}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def list_toggle_params() -> dict[str, Any]:
  """Subset used by stock Toggles panel (expand over time)."""
  keys = [
    "OpenpilotEnabledToggle",
    "ExperimentalMode",
    "DisengageOnAccelerator",
    "IsLdwEnabled",
    "AlwaysOnDM",
    "RecordFront",
    "IsMetric",
    "RecordAudio",
    "SpDevBeep",
  ]
  out: list[dict[str, Any]] = []
  try:
    p = _params()
    for key in keys:
      if p.get_type(key) is None:
        continue
      out.append({"key": key, "value": p.get(key), "type": str(p.get_type(key))})
    return {"ok": True, "params": out}
  except Exception as exc:
    return {"ok": False, "error": str(exc), "params": []}
