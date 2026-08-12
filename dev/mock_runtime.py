"""
PC dev mocks — in-memory Params + simulated cereal state for local UI preview.

Installed by webui/dev/run_pc.py before any webui server imports.
"""

from __future__ import annotations

import os
import types
from dataclasses import dataclass, field
from typing import Any

# Mutable simulation (toggled via /api/opui/dev/simulation)
SIM: dict[str, Any] = {
  "started": False,
  "engaged": False,
  "ui_status": "disengaged",
  "speed_kmh": 72,
  "set_speed_kmh": 80,
  "is_metric": True,
  "experimental_mode": True,
  "alert_text1": "",
  "alert_text2": "",
  "alert_status": "normal",
  "network_type": "Wi-Fi",
  "network_strength": 5,
  "thermal": "green",
  "cpu_temp": 58,
  "athena_status": "CONNECTED",
  "panda_online": True,
  "road_name": "Dev Preview Rd",
  "speed_limit": 60,
  "blindspot_left": False,
  "blindspot_right": False,
  "turn_signal_left": False,
  "turn_signal_right": False,
  "rocket_fuel": 0.35,
  "dm_prob": 0.82,
  "dm_pose": [0.05, -0.12, 0.02],
  "alert_size": "none",
}


def _seed_params() -> dict[str, bytes | str]:
  """Default param values for panel preview."""
  bool_on = {
    "OpenpilotEnabledToggle", "IsLdwEnabled", "AlwaysOnDM", "IsMetric",
    "Mads", "BlindSpot", "SunnylinkEnabled", "DisengageOnAccelerator",
    "RecordFront", "RecordAudio",
  }
  data: dict[str, bytes | str] = {}
  for k in bool_on:
    data[k] = b"1"
  data.update({
    "DongleId": b"dev-preview-0000",
    "HardwareSerial": b"PC-DEV-0001",
    "LongitudinalPersonality": b"1",
    "DistractionDetectionLevel": b"1",
    "UpdaterCurrentDescription": b"sunnypilot dev-preview",
    "ExperimentalMode": b"1",
    "GitBranch": b"master-c3",
    "UpdaterTargetBranch": b"master-c3",
    "UpdaterState": b"idle",
    "UpdaterAvailableBranches": b"master-c3,devel,nightly",
    "ModelManager_ActiveBundle": b'{"name":"default"}',
    "MapdVersion": b"0.0.0-dev",
    "ApiCache_FirehoseStats": b'{"status":"idle"}',
    "LocalDriveStats": b'{"all":{"distance":1234.5,"routes":42,"minutes":890}}',
    "LastSunnylinkPingTime": b"2026-08-11T12:00:00Z",
    "LanguageSetting": b"zh-CHS",
    "MaxTimeOffroad": b"10",
    "DeviceBootMode": b"0",
    "QuietMode": b"0",
    "OnroadUploads": b"1",
    "OffroadMode": b"0",
  })
  return data


class MockParams:
  _store: dict[str, bytes | str] = {}

  def __init__(self) -> None:
    if not MockParams._store:
      MockParams._store = _seed_params()

  def check_key(self, key: str) -> bool:
    return True

  def get_type(self, key: str):
    if key not in MockParams._store and not key.endswith("Lock"):
      if os.environ.get("WEBUI_DEV_PC") == "1":
        return types.SimpleNamespace(name="STRING")
      return None
    val = MockParams._store.get(key, b"0")
    if isinstance(val, bytes):
      val = val.decode(errors="replace")
    if val in ("0", "1") and key not in (
      "LongitudinalPersonality", "DistractionDetectionLevel", "ChevronInfo",
      "DevUIInfo", "SpeedLimitMode", "MadsSteeringMode",
    ):
      return types.SimpleNamespace(name="BOOL")
    try:
      int(val)
      return types.SimpleNamespace(name="INT")
    except (TypeError, ValueError):
      return types.SimpleNamespace(name="STRING")

  def get(self, key: str, block: bool = False, default=None, return_default: bool = False):
    if key not in MockParams._store:
      if return_default:
        return 0 if "Level" in key or "Personality" in key else default
      return default
    val = MockParams._store[key]
    if isinstance(val, bytes):
      try:
        return val.decode()
      except Exception:
        return val
    return val

  def get_bool(self, key: str, block: bool = False) -> bool:
    raw = self.get(key, block=block)
    if raw is None:
      return False
    if isinstance(raw, bytes):
      raw = raw.decode(errors="replace")
    return str(raw).strip().lower() in ("1", "true", "yes", "on")

  def put(self, key: str, val, block: bool = False) -> None:
    MockParams._store[key] = val if isinstance(val, (bytes, bytearray)) else str(val).encode()

  def put_bool(self, key: str, val: bool, block: bool = False) -> None:
    self.put(key, b"1" if val else b"0", block=block)

  def remove(self, key: str) -> None:
    MockParams._store.pop(key, None)

  def clear_all(self) -> None:
    MockParams._store = _seed_params()


def snapshot_dev_ui_state() -> dict[str, Any]:
  s = SIM
  unit = "km/h" if s["is_metric"] else "mph"
  speed = s["speed_kmh"] if s["is_metric"] else round(s["speed_kmh"] * 0.621371)
  set_speed = s["set_speed_kmh"] if s["is_metric"] else round(s["set_speed_kmh"] * 0.621371)

  alert = {"text1": s["alert_text1"], "text2": s["alert_text2"], "size": s.get("alert_size", "mid"), "status": s["alert_status"]}
  sizes = {"none": 0, "small": 184, "mid": 271, "full": 1080}
  alert["height_px"] = sizes.get(alert["size"], 0) if s["alert_text1"] else 0

  return {
    "ok": True,
    "dev_pc": True,
    "started": s["started"],
    "engaged": s["engaged"],
    "ui_status": s["ui_status"] if s["started"] else "disengaged",
    "is_metric": s["is_metric"],
    "is_offroad": not s["started"],
    "speed": speed,
    "speed_raw": speed / 3.6,
    "unit": unit,
    "set_speed": set_speed if s["started"] else None,
    "experimental_mode": s["experimental_mode"],
    "alert": alert,
    "device": {
      "network_type": s["network_type"],
      "network_strength": s.get("network_strength", 5),
      "thermal": s["thermal"],
      "cpu_temp": s["cpu_temp"],
      "athena_status": s["athena_status"],
      "panda_online": s["panda_online"],
      "sunnylink_ping": "dev-preview",
      "sunnylink_status": "ONLINE",
    },
    "controls": {"lat_active": True, "long_active": s["engaged"]},
    "personality": "standard",
    "personality_index": 1,
    "has_longitudinal_control": True,
    "alpha_longitudinal_available": False,
    "standstill": s.get("standstill", False),
    "standstill_timer_enabled": s.get("standstill_timer_enabled", False),
    "sp_hud": {
      "speed_limit": s.get("speed_limit"),
      "speed_limit_assist": s.get("speed_limit_assist", ""),
      "road_name": s.get("road_name", ""),
      "blindspot_left": s.get("blindspot_left", False),
      "blindspot_right": s.get("blindspot_right", False),
      "turn_signal_left": s.get("turn_signal_left", False),
      "turn_signal_right": s.get("turn_signal_right", False),
      "rocket_fuel": s.get("rocket_fuel"),
    },
    "dm_arc": {
      "visible": True,
      "prob": s.get("dm_prob", 0.8),
      "pose": s.get("dm_pose", [0, 0, 0]),
      "engaged": s["engaged"],
      "rhd": False,
    } if s["started"] else None,
  }


def mock_wifi_networks() -> list[dict[str, Any]]:
  return [
    {"ssid": "Home-5G", "strength": 92, "security": 2, "connected": True, "saved": True},
    {"ssid": "Office", "strength": 67, "security": 2, "connected": False, "saved": True},
    {"ssid": "Guest", "strength": 45, "security": 0, "connected": False, "saved": False},
  ]


def install_openpilot_mocks(root: str) -> None:
  """Call once before importing webui.server.*"""
  import logging
  import sys

  log = logging.getLogger("webuid")
  logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

  class _CloudLog:
    def info(self, msg: str, *a, **k) -> None:
      log.info(msg)

    def warning(self, msg: str, *a, **k) -> None:
      log.warning(msg)

    def error(self, msg: str, *a, **k) -> None:
      log.error(msg)

  op = types.ModuleType("openpilot")
  common = types.ModuleType("openpilot.common")
  params_mod = types.ModuleType("openpilot.common.params")

  class UnknownKeyName(Exception):
    pass

  params_mod.Params = MockParams
  params_mod.UnknownKeyName = UnknownKeyName
  swaglog_mod = types.ModuleType("openpilot.common.swaglog")
  swaglog_mod.cloudlog = _CloudLog()

  sys.modules["openpilot"] = op
  sys.modules["openpilot.common"] = common
  sys.modules["openpilot.common.params"] = params_mod
  sys.modules["openpilot.common.swaglog"] = swaglog_mod
  op.common = common
  common.params = params_mod
  common.swaglog = swaglog_mod

  if root not in sys.path:
    sys.path.insert(0, root)

  os.environ["WEBUI_DEV_PC"] = "1"
  os.environ.setdefault("OPENPILOT_ROOT", root)
