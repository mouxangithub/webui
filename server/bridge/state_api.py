"""Lightweight UI state from cereal (mirrors ui_state.py)."""

from __future__ import annotations

import time
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


PING_TIMEOUT_NS = 80_000_000_000


def _sunnylink_metric() -> dict[str, str]:
  try:
    from openpilot.common.params import Params
    from openpilot.sunnypilot.sunnylink.api import UNREGISTERED_SUNNYLINK_DONGLE_ID
    p = Params()
  except Exception:
    return {"status": "DISABLED", "tone": "disabled"}

  if not p.get_bool("SunnylinkEnabled"):
    return {"status": "DISABLED", "tone": "disabled"}

  last_ping = int(p.get("LastSunnylinkPingTime") or 0)
  dongle_id = p.get("SunnylinkDongleId")
  is_temp_fault = p.get_bool("SunnylinkTempFault")
  is_registering = not is_temp_fault and dongle_id in (None, "", UNREGISTERED_SUNNYLINK_DONGLE_ID)

  if last_ping:
    if time.monotonic_ns() - last_ping < PING_TIMEOUT_NS:
      return {"status": "ONLINE", "tone": "good"}
    return {"status": "ERROR", "tone": "danger"}
  if is_temp_fault:
    return {"status": "FAULT", "tone": "warn"}
  if is_registering:
    return {"status": "REGIST...", "tone": "progress"}
  return {"status": "OFFLINE", "tone": "danger"}


def _panda_state(sm) -> tuple[bool, bool]:
  """Return (panda_unknown, panda_online) matching native sidebar."""
  if not sm.valid["pandaStates"] or not sm["pandaStates"]:
    return True, False
  try:
    from openpilot.cereal import log
    panda_type = sm["pandaStates"][0].pandaType
    unknown = panda_type == log.PandaState.PandaType.unknown
    return unknown, not unknown
  except Exception:
    return True, False


def _athena_connection_status(ds) -> str:
  if not hasattr(ds, "lastAthenaPingTime"):
    return "OFFLINE"
  last_ping = int(ds.lastAthenaPingTime or 0)
  if last_ping == 0:
    return "OFFLINE"
  if time.monotonic_ns() - last_ping < 80_000_000_000:
    return "ONLINE"
  return "ERROR"


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
  v_ego_cluster = float(getattr(cs, "vEgoCluster", 0.0) or 0.0)
  if v_ego_cluster != 0.0:
    speed_ms = v_ego_cluster

  speed = speed_ms * 3.6 if is_metric else speed_ms * 2.23694
  unit = "km/h" if is_metric else "mph"

  set_speed = 255
  try:
    v_cruise_cluster = float(getattr(cs, "vCruiseCluster", 0.0) or 0.0)
    cruise_raw = 0.0
    if hasattr(ctrl, "deprecated") and float(getattr(ctrl.deprecated, "vCruise", 0) or 0) > 0:
      cruise_raw = float(ctrl.deprecated.vCruise)
    elif hasattr(cs, "cruiseState") and float(getattr(cs.cruiseState, "speed", 0) or 0) > 0:
      cruise_raw = float(cs.cruiseState.speed)
    if v_cruise_cluster > 0:
      cruise_raw = v_cruise_cluster
    if 0 < cruise_raw < 255:
      set_speed = cruise_raw * (3.6 if is_metric else 2.23694)
  except Exception:
    pass

  mads = False
  try:
    from openpilot.common.params import Params
    mads = Params().get_bool("Mads")
  except Exception:
    pass

  ui_status = _derive_ui_status(ss, cs, mads)

  panda_unknown, panda_online = _panda_state(sm)

  net_raw = ds.networkType.raw if hasattr(ds, "networkType") else 0
  net_type = NETWORK_TYPES.get(int(net_raw), "--")
  thermal = str(ds.thermalStatus).split(".")[-1].lower() if hasattr(ds, "thermalStatus") else "ok"
  sunnylink = _sunnylink_metric()

  experimental = bool(ss.experimentalMode) if hasattr(ss, "experimentalMode") else False
  personality = str(ss.personality).split(".")[-1].lower() if hasattr(ss, "personality") else ""

  experimental_confirmed = False
  recording_audio = False
  developer_ui = 0
  torque_bar = False
  try:
    from openpilot.common.params import Params
    experimental_confirmed = Params().get_bool("ExperimentalModeConfirmed")
  except Exception:
    pass
  try:
    from openpilot.selfdrive.ui.ui_state import ui_state
    recording_audio = bool(getattr(ui_state, "recording_audio", False))
    developer_ui = int(ui_state.developer_ui or 0)
    torque_bar = bool(getattr(ui_state, "torque_bar", False))
  except Exception:
    pass

  has_longitudinal = False
  alpha_long_available = False
  torque_control_allowed = True
  lateral_jerk_torque = False
  cp_loaded = False
  standstill = bool(getattr(cs, "standstill", False))
  standstill_timer_enabled = False
  try:
    from openpilot.common.params import Params
    standstill_timer_enabled = Params().get_bool("StandstillTimer")
  except Exception:
    pass
  try:
    from openpilot.selfdrive.ui.ui_state import ui_state
    has_longitudinal = bool(ui_state.has_longitudinal_control)
    if ui_state.CP is not None:
      cp_loaded = True
      alpha_long_available = bool(getattr(ui_state.CP, "alphaLongitudinalAvailable", False))
      try:
        from opendbc.car.structs import car
        torque_control_allowed = ui_state.CP.steerControlType != car.CarParams.SteerControlType.angle
      except Exception:
        torque_control_allowed = True
    lateral_jerk_torque = bool(ui_state.params.get_bool("LateralJerkTorqueController"))
  except Exception:
    pass

  sp_hud: dict[str, Any] = {}
  long_override = False
  try:
    if sm.valid.get("carControl"):
      long_override = bool(sm["carControl"].cruiseControl.override)
  except Exception:
    pass
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
        "long_override": long_override,
        "cluster_speed": round(
          float(getattr(getattr(cs, "cruiseState", None), "speedCluster", 0) or 0)
          * (3.6 if is_metric else 2.23694),
        ) if hasattr(cs, "cruiseState") else None,
      }
    if sm.valid.get("longitudinalPlanSP"):
      lp_sp = sm["longitudinalPlanSP"]
      assist = getattr(lp_sp, "speedLimit", None)
      sp_hud["speed_limit_assist_active"] = bool(getattr(getattr(assist, "assist", None), "active", False))
      scc = getattr(lp_sp, "smartCruiseControl", None)
      if scc is not None:
        vision = getattr(scc, "vision", None)
        map_ = getattr(scc, "map", None)
        sp_hud["scc_vision_enabled"] = bool(getattr(vision, "enabled", False))
        sp_hud["scc_vision_active"] = bool(getattr(vision, "active", False))
        sp_hud["scc_map_enabled"] = bool(getattr(map_, "enabled", False))
        sp_hud["scc_map_active"] = bool(getattr(map_, "active", False))
      e2e = getattr(lp_sp, "e2eAlerts", None)
      if e2e is not None:
        sp_hud["e2e_green_light"] = bool(getattr(e2e, "greenLightAlert", False))
        sp_hud["e2e_lead_depart"] = bool(getattr(e2e, "leadDepartAlert", False))
    try:
      from openpilot.selfdrive.ui.ui_state import ui_state
      if getattr(ui_state, "CP_SP", None) is not None:
        sp_hud["pcm_cruise_speed"] = bool(ui_state.CP_SP.pcmCruiseSpeed)
    except Exception:
      pass
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
  alert_heights = {"none": 0, "small": 271, "mid": 420, "full": 1080}
  alert_height = alert_heights.get(alert_size, 271 if ss.alertText1 else 0)

  dev_ui = None
  circular_alert_allowed = False
  try:
    from openpilot.selfdrive.ui.ui_state import ui_state
    from webui.server.bridge.dev_ui_api import snapshot_dev_ui
    dev_ui = snapshot_dev_ui(sm, is_metric)
    circular_alert_allowed = (
      alert_size in ("none", "")
      and sm.valid.get("driverStateV2")
      and sm.recv_frame.get("driverStateV2", 0) >= ui_state.started_frame
    )
  except Exception:
    pass

  torque_utilization = 0.0
  if torque_bar:
    try:
      torque_utilization = _torque_utilization(sm, ctrl, cs)
    except Exception:
      torque_utilization = 0.0

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
    "experimental_mode_confirmed": experimental_confirmed,
    "engageable": bool(getattr(ss, "engageable", False) or engaged),
    "personality": personality,
    "personality_index": _personality_index(personality),
    "has_longitudinal_control": has_longitudinal,
    "alpha_longitudinal_available": alpha_long_available,
    "cp_loaded": cp_loaded,
    "torque_control_allowed": torque_control_allowed,
    "lateral_jerk_torque": lateral_jerk_torque,
    "standstill": standstill,
    "standstill_timer_enabled": standstill_timer_enabled,
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
      "athena_status": _athena_connection_status(ds),
      "panda_unknown": panda_unknown,
      "panda_online": panda_online,
      "sunnylink": sunnylink,
    },
    "controls": {
      "lat_active": bool(ctrl.latActive) if hasattr(ctrl, "latActive") else None,
      "long_active": bool(ctrl.longActive) if hasattr(ctrl, "longActive") else None,
    },
    "sp_hud": sp_hud,
    "dm_arc": dm_arc,
    "developer_ui": developer_ui,
    "dev_ui": dev_ui,
    "recording_audio": recording_audio,
    "torque_bar": torque_bar,
    "torque_utilization": torque_utilization,
    "circular_alert_allowed": circular_alert_allowed,
  }


def _clamp(v: float, lo: float, hi: float) -> float:
  return max(lo, min(hi, v))


def _torque_utilization(sm: Any, ctrl: Any, cs: Any) -> float:
  try:
    lat_which = ctrl.lateralControlState.which()
    if lat_which in ("angleState", "curvatureState"):
      v_ego = float(cs.vEgo)
      actual_la = float(ctrl.curvature) * v_ego ** 2
      desired_la = float(ctrl.desiredCurvature) * v_ego ** 2
      accel_diff = desired_la - actual_la
      roll = 0.0
      if sm.valid.get("liveParameters"):
        roll = float(sm["liveParameters"].roll)
      roll_comp = roll * 9.81 * _clamp((v_ego - 5.0) / 10.0, 0.0, 1.0)
      lateral_acceleration = actual_la - roll_comp
      max_la = 3.0
      try:
        from openpilot.selfdrive.ui.ui_state import ui_state
        if ui_state.CP is not None:
          max_la = float(ui_state.CP.maxLateralAccel or max_la)
      except Exception:
        pass
      if not bool(sm["carControl"].latActive):
        return 0.0
      return _clamp((lateral_acceleration + accel_diff) / max_la, -1.0, 1.0)
    if sm.valid.get("carOutput"):
      return float(-sm["carOutput"].actuatorsOutput.torque)
  except Exception:
    pass
  return 0.0


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
