"""System actions: reboot, updater, sunnylink, calibration."""

from __future__ import annotations

import subprocess
import os
from typing import Any


def _params():
  from openpilot.common.params import Params
  return Params()


def run_action(action: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
  payload = payload or {}
  try:
    p = _params()

    if action == "reboot":
      p.put_bool("DoReboot", True, block=True)
      return {"ok": True, "action": action}

    if action == "shutdown":
      p.put_bool("DoShutdown", True, block=True)
      return {"ok": True, "action": action}

    if action == "uninstall":
      p.put_bool("DoUninstall", True, block=True)
      return {"ok": True, "action": action}

    if action == "reset_calibration":
      for key in ("CalibrationParams", "LiveTorqueParameters", "LiveParametersV2", "LiveDelay"):
        try:
          p.remove(key)
        except Exception:
          pass
      p.put_bool("OnroadCycleRequested", True, block=True)
      return {"ok": True, "action": action}

    if action == "reset_all_params":
      try:
        from openpilot.common.hardware import HARDWARE
        p.clear_all()
        HARDWARE.reboot()
      except Exception:
        p.clear_all()
      return {"ok": True, "action": action}

    if action == "pair_device":
      return {"ok": True, "action": action, "url": "https://connect.comma.ai/"}

    if action == "updater_check":
      subprocess.run("pkill -SIGUSR1 -f openpilot.system.updated.updated", shell=True, check=False)
      return {"ok": True, "action": action}

    if action == "updater_download":
      subprocess.run("pkill -SIGHUP -f openpilot.system.updated.updated", shell=True, check=False)
      return {"ok": True, "action": action}

    if action == "updater_install":
      p.put_bool("DoReboot", True, block=True)
      return {"ok": True, "action": action}

    if action == "sunnylink_backup":
      p.put_bool("BackupManager_CreateBackup", True, block=True)
      return {"ok": True, "action": action}

    if action == "sunnylink_restore":
      p.put("BackupManager_RestoreVersion", "latest", block=True)
      return {"ok": True, "action": action}

    if action == "models_sync":
      p.put("ModelManager_LastSyncTime", 0, block=True)
      return {"ok": True, "action": action}

    if action == "models_clear_cache":
      p.put_bool("ModelManager_ClearCache", True, block=True)
      return {"ok": True, "action": action}

    if action == "osm_check_updates":
      p.put_bool("OsmDbUpdatesCheck", True, block=True)
      return {"ok": True, "action": action}

    if action == "osm_delete_maps":
      p.put_bool("OsmDbDelete", True, block=True)
      return {"ok": True, "action": action}

    if action == "network_set_apn":
      apn = str(payload.get("apn", "")).strip()
      if apn:
        p.put("GsmApn", apn, block=True)
      else:
        p.remove("GsmApn")
      return {"ok": True, "action": action, "apn": apn}

    if action == "models_cancel_download":
      p.remove("ModelManager_DownloadIndex")
      return {"ok": True, "action": action}

    if action == "developer_delete_error_log":
      from webui.server.bridge.developer_api import developer_delete_error_log
      return developer_delete_error_log()

    if action == "webrtc_enable":
      p.put_bool("IsLiveStreaming", True, block=True)
      return {"ok": True, "action": action}

    if action == "webrtc_disable":
      p.put_bool("IsLiveStreaming", False, block=True)
      return {"ok": True, "action": action}

    if action == "driver_view_enable":
      p.put_bool("IsDriverViewEnabled", True, block=True)
      return {"ok": True, "action": action}

    if action == "driver_view_disable":
      p.put_bool("IsDriverViewEnabled", False, block=True)
      return {"ok": True, "action": action}

    if action == "bookmark":
      try:
        import openpilot.cereal.messaging as messaging
        pm = messaging.PubMaster(["bookmarkButton"])
        msg = messaging.new_message("bookmarkButton")
        msg.valid = True
        pm.send("bookmarkButton", msg)
        return {"ok": True, "action": action}
      except Exception as exc:
        if os.environ.get("WEBUI_DEV_PC") == "1":
          return {"ok": True, "action": action, "dev_pc": True}
        return {"ok": False, "error": str(exc)}

    if action == "dismiss_offroad_alert":
      key = str(payload.get("key", "")).strip()
      if not key:
        return {"ok": False, "error": "key required"}
      try:
        p.remove(key)
      except Exception:
        pass
      return {"ok": True, "action": action, "key": key}

    if action == "set_branch":
      branch = str(payload.get("branch", "")).strip()
      if not branch:
        return {"ok": False, "error": "branch required"}
      p.put("UpdaterTargetBranch", branch, block=True)
      return {"ok": True, "action": action, "branch": branch}

    return {"ok": False, "error": f"unknown action: {action}"}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def software_status() -> dict[str, Any]:
  try:
    p = _params()

    def _text(key: str) -> str:
      raw = p.get(key)
      if isinstance(raw, bytes):
        return raw.decode("utf-8", errors="replace")
      return raw or ""

    is_onroad = False
    is_offroad = True
    try:
      from openpilot.selfdrive.ui.ui_state import ui_state
      is_onroad = ui_state.is_onroad()
      is_offroad = ui_state.is_offroad()
    except Exception:
      pass

    updater_state = p.get("UpdaterState") or "idle"
    fetch_available = p.get_bool("UpdaterFetchAvailable")
    update_available = p.get_bool("UpdateAvailable")
    failed_count = int(p.get("UpdateFailedCount") or 0)

    download_label = "CHECK"
    download_value = ""
    download_enabled = is_offroad and updater_state == "idle"

    state_labels = {
      "checking...": "checking...",
      "downloading...": "downloading...",
      "finalizing update...": "finalizing update...",
    }
    if updater_state != "idle":
      download_value = state_labels.get(updater_state, updater_state)
      download_enabled = False
    elif failed_count > 0:
      download_value = "failed to check for update"
      download_label = "CHECK"
    elif fetch_available:
      download_value = "update available"
      download_label = "DOWNLOAD"
    else:
      last_update = p.get("LastUpdateTime")
      if last_update is not None and hasattr(last_update, "isoformat"):
        last_update = last_update.isoformat()
      download_value = "up to date, last checked never" if not last_update else f"up to date, last checked {last_update}"
      download_label = "CHECK"

    last_update_raw = p.get("LastUpdateTime")
    if last_update_raw is not None and hasattr(last_update_raw, "isoformat"):
      last_update_raw = last_update_raw.isoformat()

    return {
      "ok": True,
      "current": p.get("UpdaterCurrentDescription") or "",
      "current_release_notes": _text("UpdaterCurrentReleaseNotes"),
      "updater_state": updater_state,
      "fetch_available": fetch_available,
      "update_available": update_available,
      "new_description": p.get("UpdaterNewDescription") or "",
      "new_release_notes": _text("UpdaterNewReleaseNotes"),
      "target_branch": p.get("UpdaterTargetBranch") or "",
      "git_branch": p.get("GitBranch") or "",
      "branches": [b for b in (p.get("UpdaterAvailableBranches") or "").split(",") if b],
      "failed_count": failed_count,
      "last_update_time": last_update_raw or "",
      "disable_updates": p.get_bool("DisableUpdates"),
      "is_onroad": is_onroad,
      "is_offroad": is_offroad,
      "download_label": download_label,
      "download_value": download_value,
      "download_enabled": download_enabled,
      "install_visible": is_offroad and update_available,
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
