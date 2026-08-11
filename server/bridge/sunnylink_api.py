"""sunnylink panel status + backup progress."""

from __future__ import annotations

import os
from typing import Any


def sunnylink_status() -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return {
      "ok": True,
      "enabled": True,
      "dongle_id": "sl-dev-preview",
      "paired": True,
      "is_sponsor": True,
      "tier": "gold",
      "tier_color": "#FFD500",
      "description": "sunnylink connected — uploads enabled",
      "backup": {"status": "idle", "progress": 0},
      "dev_pc": True,
    }
  try:
    import openpilot.cereal.messaging as messaging
    from openpilot.common.params import Params

    p = Params()
    backup = {"status": "idle", "progress": 0}
    sm = messaging.SubMaster(["backupManagerSP"], poll="backupManagerSP")
    sm.update(200)
    if sm.valid.get("backupManagerSP"):
      bm = sm["backupManagerSP"]
      backup = {
        "status": str(getattr(bm, "status", "idle")),
        "progress": float(getattr(bm, "progress", 0) or 0),
        "version": getattr(bm, "version", "") or "",
      }

    tier = ""
    tier_color = "#808080"
    desc = ""
    try:
      from openpilot.selfdrive.ui.ui_state import ui_state
      sl = getattr(ui_state, "sunnylink_state", None)
      if sl:
        tier = getattr(sl, "tier", "") or ""
        tier_color = "#FFD500" if getattr(sl, "is_sponsor", False) else "#808080"
        desc = "Paired" if getattr(sl, "is_paired", False) else "Not paired"
    except Exception:
      pass

    return {
      "ok": True,
      "enabled": p.get_bool("SunnylinkEnabled"),
      "dongle_id": p.get("SunnylinkDongleId") or "",
      "paired": bool(p.get("SunnylinkDongleId")),
      "tier": tier,
      "tier_color": tier_color,
      "description": desc,
      "backup": backup,
      "consent_version": p.get("CompletedSunnylinkConsentVersion") or "",
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def sunnylink_pair_url() -> dict[str, Any]:
  try:
    from openpilot.common.params import Params
    dongle = Params().get("DongleId") or ""
    return {"ok": True, "url": f"https://connect.sunnypilot.ai/?dongle={dongle}"}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
