"""Offroad home screen data (Prime, Setup, header)."""

from __future__ import annotations

import os
from typing import Any


def _format_offroad_alerts() -> list[dict[str, Any]]:
  try:
    from openpilot.common.params import Params
    from openpilot.selfdrive.selfdrived.alertmanager import OFFROAD_ALERTS
    from openpilot.selfdrive.ui.widgets.offroad_alerts import _format_offroad_alert

    p = Params()
    alerts: list[dict[str, Any]] = []
    for key, config in sorted(OFFROAD_ALERTS.items(), key=lambda x: x[1].get("severity", 0), reverse=True):
      alert_json = p.get(key)
      if not alert_json:
        continue
      text = _format_offroad_alert(key, alert_json)
      if not text:
        continue
      alerts.append({
        "key": key,
        "text": text,
        "severity": int(config.get("severity", 0)),
      })
    return alerts
  except Exception:
    return []


def snapshot_home() -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return _mock_home()

  try:
    from openpilot.common.params import Params
    from webui.server.bridge.system_api import software_status

    p = Params()
    dongle = p.get("DongleId") or ""
    paired = bool(dongle) and dongle not in ("", "UnregisteredDevice", "ffffffffffffffff")
    version = p.get("UpdaterCurrentDescription") or p.get("GitBranch") or ""
    update_available = p.get_bool("UpdateAvailable")
    fetch_available = p.get_bool("UpdaterFetchAvailable")
    experimental = p.get_bool("ExperimentalMode")
    offroad_alerts = _format_offroad_alerts()

    sw = software_status()
    new_description = ""
    release_notes = ""
    if sw.get("ok"):
      new_description = sw.get("new_description") or ""
      release_notes = sw.get("new_release_notes") or ""

    prime = False
    try:
      from openpilot.selfdrive.ui.ui_state import ui_state
      prime = ui_state.prime_state.is_prime()
      paired = ui_state.prime_state.is_paired()
    except Exception:
      prime = paired and bool(p.get("PrimeType"))

    return {
      "ok": True,
      "paired": paired,
      "prime": prime,
      "experimental_mode": experimental,
      "version_text": version,
      "update_available": update_available,
      "fetch_available": fetch_available,
      "update_visible": bool(update_available or fetch_available),
      "new_description": new_description,
      "new_release_notes": release_notes,
      "alert_count": len(offroad_alerts),
      "offroad_alerts": offroad_alerts,
      "dongle_id": dongle,
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def _mock_home() -> dict[str, Any]:
  from webui.dev.mock_runtime import SIM

  paired = bool(SIM.get("paired", False))
  alerts = SIM.get("offroad_alerts") or []
  return {
    "ok": True,
    "dev_pc": True,
    "paired": paired,
    "prime": paired,
    "experimental_mode": True,
    "version_text": "sunnypilot dev-preview / master-c3",
    "update_available": bool(SIM.get("update_available", False)),
    "fetch_available": bool(SIM.get("fetch_available", False)),
    "update_visible": bool(SIM.get("update_available") or SIM.get("fetch_available")),
    "new_description": SIM.get("new_description", "sunnypilot dev-preview build"),
    "new_release_notes": SIM.get("new_release_notes", "<p>Dev preview release notes.</p>"),
    "alert_count": len(alerts),
    "offroad_alerts": alerts,
    "dongle_id": "dev-preview-0000",
  }
