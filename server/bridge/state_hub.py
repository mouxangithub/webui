"""Persistent cereal reader + cached UI state for HTTP and WebSocket."""

from __future__ import annotations

import json
import os
import threading
import time
from typing import Any

from webui.server.bridge.home_api import snapshot_home
from webui.server.bridge.state_api import build_state_from_sm

_lock = threading.Lock()
_state: dict[str, Any] | None = None
_home: dict[str, Any] | None = None
_state_seq = 0
_home_seq = 0
_running = False
_thread: threading.Thread | None = None


def start_state_hub() -> None:
  global _running, _thread
  if _running:
    return
  try:
    _set_home(snapshot_home())
  except Exception:
    pass
  _running = True
  _thread = threading.Thread(target=_run_loop, name="webui-state-hub", daemon=True)
  _thread.start()


def stop_state_hub() -> None:
  global _running
  _running = False


def get_state() -> dict[str, Any]:
  with _lock:
    if _state is not None:
      return dict(_state)
  return _cold_state_snapshot()


def get_home() -> dict[str, Any]:
  with _lock:
    if _home is not None:
      return dict(_home)
  return snapshot_home()


def state_seq() -> int:
  with _lock:
    return _state_seq


def home_seq() -> int:
  with _lock:
    return _home_seq


def refresh_dev_state() -> None:
  """PC dev only — push mock state immediately after simulation changes."""
  if os.environ.get("WEBUI_DEV_PC") != "1":
    return
  from webui.dev.mock_runtime import snapshot_dev_ui_state
  _set_state(snapshot_dev_ui_state())


def _set_state(st: dict[str, Any]) -> None:
  global _state, _state_seq
  with _lock:
    _state = st
    _state_seq += 1


def _set_home(home: dict[str, Any]) -> None:
  global _home, _home_seq
  with _lock:
    _home = home
    _home_seq += 1


def _cold_state_snapshot() -> dict[str, Any]:
  import os
  if os.environ.get("WEBUI_DEV_PC") == "1":
    from webui.dev.mock_runtime import snapshot_dev_ui_state
    return snapshot_dev_ui_state()
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


def _run_loop() -> None:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    _dev_loop()
    return
  _device_loop()


def _dev_loop() -> None:
  from webui.dev.mock_runtime import snapshot_dev_ui_state

  home_ticks = 0
  while _running:
    _set_state(snapshot_dev_ui_state())
    home_ticks += 1
    if home_ticks >= 25:
      _set_home(snapshot_home())
      home_ticks = 0
    time.sleep(0.1)


def _device_loop() -> None:
  import openpilot.cereal.messaging as messaging

  services = [
    "deviceState", "selfdriveState", "carState", "controlsState", "carControl",
    "pandaStates", "managerState", "driverMonitoringState", "driverStateV2",
    "longitudinalPlanSP", "liveMapDataSP",
  ]
  try:
    services.append("selfdriveStateSP")
  except Exception:
    pass

  sm = messaging.SubMaster(services, poll="deviceState")
  home_ticks = 0
  while _running:
    try:
      sm.update(100)
      _set_state(build_state_from_sm(sm))
    except Exception as exc:
      _set_state({
        "ok": False,
        "error": str(exc),
        "started": False,
        "engaged": False,
        "ui_status": "disengaged",
      })
    home_ticks += 1
    if home_ticks >= 25:
      try:
        _set_home(snapshot_home())
      except Exception:
        pass
      home_ticks = 0
    time.sleep(0.1)
