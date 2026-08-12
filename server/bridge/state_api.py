"""Lightweight UI state from cereal (mirrors ui_state.py)."""

from __future__ import annotations

from typing import Any

UI_STATUS = ("disengaged", "engaged", "override", "lat_only", "long_only")

NETWORK_TYPES = {
  0: "--",
  1: "Wi-Fi",
  2: "ETH",
  3: "2G",
  4: "3G",
  5: "LTE",
  6: "5G",
}


def _cpu_temp_c(ds) -> int | None:
  if not hasattr(ds, "cpuTempC"):
    return None
  temp = ds.cpuTempC
  try:
    if hasattr(temp, "__len__") and not isinstance(temp, (str, bytes)):
      temp = temp[0] if len(temp) else None
  except TypeError:
    pass
  if temp is None:
    return None
  try:
    return round(float(temp))
  except (TypeError, ValueError):
    return None


def _network_strength(ds) -> int:
  if not hasattr(ds, "networkStrength"):
    return 0
  raw = ds.networkStrength.raw if hasattr(ds.networkStrength, "raw") else int(ds.networkStrength)
  raw = int(raw)
  return max(0, min(5, raw + 1)) if raw > 0 else 0


def _derive_ui_status(ss, cs, mads_enabled: bool) -> str:
  if getattr(ss, "state", None) is not None:
    state_name = str(ss.state).lower()
    if "override" in state_name:
      return "override"
  if not ss.active:
    return "disengaged"
  if mads_enabled:
    try:
      from openpilot.selfdrive.ui.sunnypilot.ui_state import MadsSteeringModeOnBrake
      lat_active = cs.latActive if hasattr(cs, "latActive") else True
      long_active = cs.cruiseState.enabled if hasattr(cs, "cruiseState") else True
      if lat_active and not long_active:
        return "lat_only"
      if long_active and not lat_active:
        return "long_only"
    except Exception:
      pass
  return "engaged"


def build_state_from_sm(sm) -> dict[str, Any]:
  ds = sm["deviceState"]
  ss = sm["selfdriveState"]
  cs = sm["carState"]
  ctrl = sm["controlsState"]

  started = bool(ds.started)
  engaged = bool(ss.active)
  is_metric = False
  try:
    from openpilot.common.params import Params
    is_metric = Params().get_bool("IsMetric")
  except Exception:
    pass

  speed_ms = float(cs.vEgo) if cs.vEgo == cs.vEgo else 0.0
  speed = speed_ms * 3.6 if is_metric else speed_ms * 2.23694
  unit = "km/h" if is_metric else "mph"

  set_speed = 255
  if hasattr(cs, "cruiseState") and cs.cruiseState.speed > 0:
    set_speed = cs.cruiseState.speed * (3.6 if is_metric else 2.23694)

  mads = False
  try:
    from openpilot.common.params import Params
    mads = Params().get_bool("Mads")
  except Exception:
    pass

  ui_status = _derive_ui_status(ss, cs, mads)

  panda_online = True
  if sm.valid["pandaStates"] and sm["pandaStates"]:
    panda_online = any(getattr(p, "pandaType", 0) != 0 for p in sm["pandaStates"])

  net_raw = ds.networkType.raw if hasattr(ds, "networkType") else 0
  net_type = NETWORK_TYPES.get(int(net_raw), "--")
  thermal = str(ds.thermalStatus).split(".")[-1].lower() if hasattr(ds, "thermalStatus") else "green"

  sunnylink_ping = ""
  sunnylink_status = ""
  try:
    from openpilot.common.params import Params
    p = Params()
    sunnylink_ping = p.get("LastSunnylinkPingTime") or ""
    if p.get_bool("SunnylinkEnabled"):
      sunnylink_status = "ONLINE" if sunnylink_ping else "OFFLINE"
  except Exception:
    pass

  experimental = bool(ss.experimentalMode) if hasattr(ss, "experimentalMode") else False
  personality = str(ss.personality).split(".")[-1].lower() if hasattr(ss, "personality") else ""

  has_longitudinal = False
  alpha_long_available = False
  try:
    from openpilot.selfdrive.ui.ui_state import ui_state
    has_longitudinal = bool(ui_state.has_longitudinal_control)
    if ui_state.CP is not None:
      alpha_long_available = bool(getattr(ui_state.CP, "alphaLongitudinalAvailable", False))
  except Exception:
    pass

  sp_hud: dict[str, Any] = {}
  try:
    if sm.valid.get("selfdriveStateSP"):
      ssp = sm["selfdriveStateSP"]
      sp_hud = {
        "speed_limit": getattr(ssp, "speedLimit", None),
        "speed_limit_assist": str(getattr(ssp, "speedLimitAssist", "")).split(".")[-1],
        "road_name": getattr(ssp, "roadName", "") or "",
        "standstill_timer": getattr(ssp, "standstillTimer", None),
        "blindspot_left": bool(getattr(ssp, "blindspotLeft", False)),
        "blindspot_right": bool(getattr(ssp, "blindspotRight", False)),
        "turn_signal_left": bool(getattr(ssp, "turnSignalLeft", False)),
        "turn_signal_right": bool(getattr(ssp, "turnSignalRight", False)),
        "rocket_fuel": getattr(ssp, "rocketFuel", None),
      }
  except Exception:
    pass

  dm_arc = None
  try:
    from openpilot.common.params import Params
    always_dm = Params().get_bool("AlwaysOnDM")
    alert_size = str(ss.alertSize).split(".")[-1].lower() if ss.alertSize else "none"
    if always_dm and alert_size in ("none", "") and sm.valid.get("driverStateV2"):
      dsv2 = sm["driverStateV2"]
      dms = sm["driverMonitoringState"] if sm.valid.get("driverMonitoringState") else None
      pose = getattr(dsv2, "faceOrientation", [0, 0, 0])
      dm_arc = {
        "visible": True,
        "prob": float(getattr(dms, "awareProb", 0) or 0) if dms else 0.0,
        "pose": [float(pose[0]), float(pose[1]), float(pose[2])] if len(pose) >= 3 else [0, 0, 0],
        "engaged": engaged,
        "rhd": bool(getattr(cs, "vegoCluster", 0)) if hasattr(cs, "vegoCluster") else False,
      }
  except Exception:
    pass

  alert_size = str(ss.alertSize).split(".")[-1].lower() if ss.alertSize else "none"
  alert_heights = {"none": 0, "small": 184, "mid": 271, "full": 1080}
  alert_height = alert_heights.get(alert_size, 271 if ss.alertText1 else 0)

  return {
    "ok": True,
    "started": started,
    "engaged": engaged,
    "ui_status": ui_status,
    "is_metric": is_metric,
    "is_offroad": not started,
    "speed": round(speed),
    "speed_raw": speed_ms,
    "unit": unit,
    "set_speed": round(set_speed) if set_speed != 255 else None,
    "experimental_mode": experimental,
    "personality": personality,
    "personality_index": _personality_index(personality),
    "has_longitudinal_control": has_longitudinal,
    "alpha_longitudinal_available": alpha_long_available,
    "alert": {
      "text1": ss.alertText1 or "",
      "text2": ss.alertText2 or "",
      "size": alert_size,
      "status": str(ss.alertStatus).split(".")[-1] if ss.alertStatus else "",
      "height_px": alert_height,
    },
    "device": {
      "network_type": net_type,
      "network_strength": _network_strength(ds),
      "network_metered": bool(ds.networkMetered) if hasattr(ds, "networkMetered") else False,
      "thermal": thermal,
      "cpu_temp": _cpu_temp_c(ds),
      "memory_usage_percent": int(ds.memoryUsagePercent) if hasattr(ds, "memoryUsagePercent") else None,
      "free_space_percent": int(ds.freeSpacePercent) if hasattr(ds, "freeSpacePercent") else None,
      "athena_status": str(ds.athenaStatus).split(".")[-1] if hasattr(ds, "athenaStatus") else "",
      "panda_online": panda_online,
      "sunnylink_ping": sunnylink_ping,
      "sunnylink_status": sunnylink_status,
    },
    "controls": {
      "lat_active": bool(ctrl.latActive) if hasattr(ctrl, "latActive") else None,
      "long_active": bool(ctrl.longActive) if hasattr(ctrl, "longActive") else None,
    },
    "sp_hud": sp_hud,
    "dm_arc": dm_arc,
  }


def _personality_index(name: str) -> int | None:
  mapping = {"aggressive": 0, "standard": 1, "relaxed": 2}
  return mapping.get((name or "").lower())


def snapshot_ui_state() -> dict[str, Any]:
  import os
  if os.environ.get("WEBUI_DEV_PC") == "1":
    from webui.dev.mock_runtime import snapshot_dev_ui_state
    return snapshot_dev_ui_state()

  try:
    from webui.server.bridge.state_hub import get_state
    return get_state()
  except Exception:
    pass

  try:
    import openpilot.cereal.messaging as messaging

    services = [
      "deviceState", "selfdriveState", "carState", "controlsState",
      "pandaStates", "managerState", "driverMonitoringState", "driverStateV2",
      "longitudinalPlanSP",
    ]
    try:
      services.append("selfdriveStateSP")
    except Exception:
      pass

    sm = messaging.SubMaster(services, poll="deviceState")
    sm.update(300)
    return build_state_from_sm(sm)
  except Exception as exc:
    return {
      "ok": False,
      "error": str(exc),
      "started": False,
      "engaged": False,
      "ui_status": "disengaged",
    }
