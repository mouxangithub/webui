"""sunnylink panel status + backup progress."""

from __future__ import annotations

import os
from typing import Any


def _consent_version() -> str:
  try:
    from openpilot.common.version import sunnylink_consent_version
    return sunnylink_consent_version
  except Exception:
    return "1.0"


def _consent_declined() -> str:
  try:
    from openpilot.common.version import sunnylink_consent_declined
    return sunnylink_consent_declined
  except Exception:
    return "-1"


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
      "required_consent_version": "1.0",
      "consent_declined_value": "-1",
    }
  try:
    import openpilot.cereal.messaging as messaging
    from openpilot.common.params import Params
    from webui.server.bridge.webui_bg_services import sunnylink_tier_from_params

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

    sl_info = sunnylink_tier_from_params()
    dongle_id = p.get("SunnylinkDongleId") or ""

    return {
      "ok": True,
      "enabled": p.get_bool("SunnylinkEnabled"),
      "dongle_id": dongle_id,
      "paired": sl_info["is_paired"] or bool(dongle_id),
      "is_sponsor": sl_info["is_sponsor"],
      "is_paired": sl_info["is_paired"],
      "tier": sl_info["tier"],
      "tier_color": sl_info["tier_color"],
      "description": sl_info["description"],
      "backup": backup,
      "consent_version": p.get("CompletedSunnylinkConsentVersion") or "",
      "required_consent_version": _consent_version(),
      "consent_declined_value": _consent_declined(),
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def _qr_data_url(text: str) -> str:
  import base64
  import io

  import qrcode

  qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=8, border=4)
  qr.add_data(text)
  qr.make(fit=True)
  img = qr.make_image(fill_color="black", back_color="white")
  buf = io.BytesIO()
  img.save(buf, format="PNG")
  b64 = base64.b64encode(buf.getvalue()).decode("ascii")
  return f"data:image/png;base64,{b64}"


def sunnylink_pair_url(mode: str = "pair") -> dict[str, Any]:
  sponsor = mode == "sponsor"
  try:
    if sponsor:
      url = "https://github.com/sponsors/sunnyhaibin"
      return {"ok": True, "mode": "sponsor", "url": url, "qr_data_url": _qr_data_url(url)}

    import base64
    from openpilot.common.params import Params
    from openpilot.sunnypilot.sunnylink.api import SunnylinkApi, UNREGISTERED_SUNNYLINK_DONGLE_ID, API_HOST

    sl_dongle = Params().get("SunnylinkDongleId") or UNREGISTERED_SUNNYLINK_DONGLE_ID
    if sl_dongle == UNREGISTERED_SUNNYLINK_DONGLE_ID:
      return {"ok": False, "error": "sunnylink dongle id not registered"}
    token = SunnylinkApi(sl_dongle).get_token()
    payload = base64.b64encode(f"1|{sl_dongle}|{token}".encode()).decode()
    url = f"{API_HOST}/sso?state={payload}"
    return {"ok": True, "mode": "pair", "url": url, "qr_data_url": _qr_data_url(url)}
  except Exception as exc:
    if os.environ.get("WEBUI_DEV_PC") == "1":
      url = "https://github.com/sponsors/sunnyhaibin" if sponsor else "https://connect.sunnypilot.ai/?dongle=sl-dev-preview"
      return {
        "ok": True,
        "mode": "sponsor" if sponsor else "pair",
        "url": url,
        "qr_data_url": _qr_data_url(url),
        "dev_pc": True,
      }
    return {"ok": False, "error": str(exc)}
