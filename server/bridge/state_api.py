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


def snapshot_ui_state() -> dict[str, Any]:
  import os
  if os.environ.get("WEBUI_DEV_PC") == "1":
    from webui.dev.mock_runtime import snapshot_dev_ui_state
    return snapshot_dev_ui_state()

  try:
    import openpilot.cereal.messaging as messaging

    services = [
      "deviceState", "selfdriveState", "carState", "controlsState",
      "pandaStates", "managerState",
    ]
    try:
      services.append("selfdriveStateSP")
    except Exception:
      pass

    sm = messaging.SubMaster(services, poll="deviceState")
    sm.update(300)

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

    net_type = NETWORK_TYPES.get(int(ds.networkType), "--")
    thermal = str(ds.thermalStatus).split(".")[-1].lower() if hasattr(ds, "thermalStatus") else "green"

    sunnylink_ping = ""
    try:
      from openpilot.common.params import Params
      sunnylink_ping = Params().get("LastSunnylinkPingTime") or ""
    except Exception:
      pass

    experimental = bool(ss.experimentalMode) if hasattr(ss, "experimentalMode") else False

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
      "alert": {
        "text1": ss.alertText1 or "",
        "text2": ss.alertText2 or "",
        "size": str(ss.alertSize).split(".")[-1] if ss.alertSize else "",
        "status": str(ss.alertStatus).split(".")[-1] if ss.alertStatus else "",
      },
      "device": {
        "network_type": net_type,
        "network_metered": bool(ds.networkMetered) if hasattr(ds, "networkMetered") else False,
        "thermal": thermal,
        "cpu_temp": round(float(ds.cpuTempC)) if hasattr(ds, "cpuTempC") else None,
        "memory_usage_percent": int(ds.memoryUsagePercent) if hasattr(ds, "memoryUsagePercent") else None,
        "free_space_percent": int(ds.freeSpacePercent) if hasattr(ds, "freeSpacePercent") else None,
        "athena_status": str(ds.athenaStatus).split(".")[-1] if hasattr(ds, "athenaStatus") else "",
        "panda_online": panda_online,
        "sunnylink_ping": sunnylink_ping,
      },
      "controls": {
        "lat_active": bool(ctrl.latActive) if hasattr(ctrl, "latActive") else None,
        "long_active": bool(ctrl.longActive) if hasattr(ctrl, "longActive") else None,
      },
      "personality": str(ss.personality).split(".")[-1] if hasattr(ss, "personality") else "",
    }
  except Exception as exc:
    return {
      "ok": False,
      "error": str(exc),
      "started": False,
      "engaged": False,
      "ui_status": "disengaged",
    }
