"""Offroad home screen data (Prime, Setup, header)."""

from __future__ import annotations

import os
from typing import Any


def snapshot_home() -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return _mock_home()

  try:
    from openpilot.common.params import Params

    p = Params()
    dongle = p.get("DongleId") or ""
    paired = bool(dongle) and dongle not in ("", "UnregisteredDevice", "ffffffffffffffff")
    version = p.get("UpdaterCurrentDescription") or p.get("GitBranch") or ""
    update_available = p.get_bool("UpdateAvailable")
    experimental = p.get_bool("ExperimentalMode")

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
      "dongle_id": dongle,
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def _mock_home() -> dict[str, Any]:
  return {
    "ok": True,
    "dev_pc": True,
    "paired": True,
    "prime": True,
    "experimental_mode": True,
    "version_text": "sunnypilot dev-preview / master-c3",
    "update_available": False,
    "dongle_id": "dev-preview-0000",
  }
