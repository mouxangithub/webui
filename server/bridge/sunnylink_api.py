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
    is_sponsor = False
    is_paired = False
    try:
      from openpilot.selfdrive.ui.ui_state import ui_state
      sl = getattr(ui_state, "sunnylink_state", None)
      if sl:
        tier_obj = sl.get_sponsor_tier() if hasattr(sl, "get_sponsor_tier") else None
        tier = (getattr(tier_obj, "name", "") or "").capitalize()
        is_sponsor = bool(getattr(sl, "is_sponsor", False) or tier)
        is_paired = bool(sl.is_paired() if hasattr(sl, "is_paired") else False)
        tier_color = "#FFD500" if is_sponsor else "#808080"
        desc = "Paired" if is_paired else "Not paired"
    except Exception:
      pass

    return {
      "ok": True,
      "enabled": p.get_bool("SunnylinkEnabled"),
      "dongle_id": p.get("SunnylinkDongleId") or "",
      "paired": is_paired or bool(p.get("SunnylinkDongleId")),
      "is_sponsor": is_sponsor,
      "is_paired": is_paired,
      "tier": tier,
      "tier_color": tier_color,
      "description": desc,
      "backup": backup,
      "consent_version": p.get("CompletedSunnylinkConsentVersion") or "",
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def sunnylink_pair_url(mode: str = "pair") -> dict[str, Any]:
  sponsor = mode == "sponsor"
  try:
    if sponsor:
      return {"ok": True, "mode": "sponsor", "url": "https://github.com/sponsors/sunnyhaibin"}

    import base64
    from openpilot.common.params import Params
    from openpilot.sunnypilot.sunnylink.api import SunnylinkApi, UNREGISTERED_SUNNYLINK_DONGLE_ID, API_HOST

    sl_dongle = Params().get("SunnylinkDongleId") or UNREGISTERED_SUNNYLINK_DONGLE_ID
    if sl_dongle == UNREGISTERED_SUNNYLINK_DONGLE_ID:
      return {"ok": False, "error": "sunnylink dongle id not registered"}
    token = SunnylinkApi(sl_dongle).get_token()
    payload = base64.b64encode(f"1|{sl_dongle}|{token}".encode()).decode()
    return {"ok": True, "mode": "pair", "url": f"{API_HOST}/sso?state={payload}"}
  except Exception as exc:
    if os.environ.get("WEBUI_DEV_PC") == "1":
      return {
        "ok": True,
        "mode": "sponsor" if sponsor else "pair",
        "url": "https://github.com/sponsors/sunnyhaibin" if sponsor else "https://connect.sunnypilot.ai/?dongle=sl-dev-preview",
        "dev_pc": True,
      }
    return {"ok": False, "error": str(exc)}
