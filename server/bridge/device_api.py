"""Device panel extras: calibration summary, languages, regulatory HTML."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

LANGUAGES = [
  ("main", "English"),
  ("zh", "中文"),
  ("de", "Deutsch"),
  ("es", "Español"),
  ("fr", "Français"),
  ("ja", "日本語"),
  ("ko", "한국어"),
  ("pt", "Português"),
  ("th", "ไทย"),
  ("tr", "Türkçe"),
]


def _fcc_path() -> Path | None:
  candidates = [
    Path(__file__).resolve().parents[3] / "openpilot" / "selfdrive" / "assets" / "offroad" / "fcc.html",
    Path(__file__).resolve().parents[4] / "openpilot" / "selfdrive" / "assets" / "offroad" / "fcc.html",
  ]
  for c in candidates:
    if c.is_file():
      return c
  return None


def regulatory_html() -> dict[str, Any]:
  path = _fcc_path()
  if not path:
    return {"ok": False, "error": "fcc.html not found"}
  try:
    return {"ok": True, "html": path.read_text(encoding="utf-8", errors="replace")}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def device_extras() -> dict[str, Any]:
  try:
    from openpilot.common.params import Params
    p = Params()
    lang = str(p.get("LanguageSetting") or "main")
    offroad_mode = p.get_bool("OffroadMode")
  except Exception:
    lang = "main"
    offroad_mode = False

  if os.environ.get("WEBUI_DEV_PC") == "1":
    return {
      "ok": True,
      "calibration": {
        "valid": True,
        "pitch": 0.02,
        "yaw": -0.01,
        "roll": 0.0,
        "desc_html": (
          "<p>Device calibration is valid.</p>"
          "<p>pitch 0.02 yaw -0.01</p>"
        ),
      },
      "languages": [{"id": k, "label": v} for k, v in LANGUAGES],
      "current_language": lang,
      "driver_camera_available": True,
      "offroad_mode": offroad_mode,
      "dev_pc": True,
    }
  try:
    import openpilot.cereal.messaging as messaging
    from openpilot.common.params import Params

    p = Params()
    sm = messaging.SubMaster(["liveCalibration"], poll="liveCalibration")
    sm.update(300)
    cal = {
      "valid": False,
      "pitch": 0,
      "yaw": 0,
      "roll": 0,
      "desc_html": "<p>Calibration unknown</p>",
    }
    if sm.valid.get("liveCalibration"):
      lc = sm["liveCalibration"]
      pitch = round(float(getattr(lc, "rpyCalib", [0, 0, 0])[0]), 3)
      yaw = round(float(getattr(lc, "rpyCalib", [0, 0, 0])[1]), 3)
      roll = round(float(getattr(lc, "rpyCalib", [0, 0, 0])[2]), 3)
      cal = {
        "valid": bool(getattr(lc, "calStatus", 0)),
        "pitch": pitch,
        "yaw": yaw,
        "roll": roll,
        "desc_html": (
          f"<p>pitch {pitch}° yaw {yaw}° roll {roll}°</p>"
          "<p>Reset if device was moved or windshield replaced.</p>"
        ),
      }
    lang = str(p.get("LanguageSetting") or "main")
    return {
      "ok": True,
      "calibration": cal,
      "languages": [{"id": k, "label": v} for k, v in LANGUAGES],
      "current_language": lang,
      "driver_camera_available": True,
      "offroad_mode": p.get_bool("OffroadMode"),
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def set_language(lang_id: str) -> dict[str, Any]:
  try:
    from openpilot.common.params import Params
    Params().put("LanguageSetting", lang_id, block=True)
    return {"ok": True, "language": lang_id}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
