"""System actions: reboot, updater, sunnylink, calibration."""

from __future__ import annotations

import subprocess
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
    return {
      "ok": True,
      "current": p.get("UpdaterCurrentDescription") or "",
      "updater_state": p.get("UpdaterState") or "idle",
      "fetch_available": p.get_bool("UpdaterFetchAvailable"),
      "update_available": p.get_bool("UpdateAvailable"),
      "new_description": p.get("UpdaterNewDescription") or "",
      "target_branch": p.get("UpdaterTargetBranch") or "",
      "git_branch": p.get("GitBranch") or "",
      "branches": [b for b in (p.get("UpdaterAvailableBranches") or "").split(",") if b],
      "failed_count": int(p.get("UpdateFailedCount") or 0),
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
