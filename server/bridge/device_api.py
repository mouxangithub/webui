"""Device panel extras: calibration summary, languages, regulatory HTML."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

# Fallback when languages.json is unavailable (codes match openpilot GUI).
LANGUAGES = [
  ("en", "English"),
  ("zh-CHS", "中文（简体）"),
  ("de", "Deutsch"),
  ("es", "Español"),
  ("fr", "Français"),
  ("ja", "日本語"),
  ("ko", "한국어"),
  ("pt-BR", "Português"),
  ("th", "ไทย"),
  ("tr", "Türkçe"),
]


def _languages_json_path() -> Path | None:
  candidates = [
    Path(__file__).resolve().parents[3] / "openpilot" / "selfdrive" / "ui" / "translations" / "languages.json",
    Path(__file__).resolve().parents[4] / "openpilot" / "selfdrive" / "ui" / "translations" / "languages.json",
  ]
  for c in candidates:
    if c.is_file():
      return c
  return None


def _language_options() -> list[dict[str, str]]:
  path = _languages_json_path()
  if path:
    try:
      data = json.loads(path.read_text(encoding="utf-8"))
      return [{"id": code, "label": name} for name, code in data.items()]
    except Exception:
      pass
  return [{"id": k, "label": v} for k, v in LANGUAGES]


def _normalize_lang_id(lang: str) -> str:
  lang = (lang or "en").strip().removeprefix("main_")
  aliases = {
    "main": "en",
    "zh": "zh-CHS",
    "pt": "pt-BR",
  }
  return aliases.get(lang, lang)


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
    import re
    raw = path.read_text(encoding="utf-8", errors="replace")
    match = re.search(r"<body[^>]*>(.*)</body>", raw, re.I | re.S)
    html = match.group(1).strip() if match else raw
    return {"ok": True, "html": html}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def device_extras() -> dict[str, Any]:
  try:
    from openpilot.common.params import Params
    p = Params()
    lang = _normalize_lang_id(str(p.get("LanguageSetting") or "en"))
    offroad_mode = p.get_bool("OffroadMode")
  except Exception:
    lang = "en"
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
      "languages": _language_options(),
      "current_language": _normalize_lang_id(lang),
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
    lang = _normalize_lang_id(str(p.get("LanguageSetting") or "en"))
    return {
      "ok": True,
      "calibration": cal,
      "languages": _language_options(),
      "current_language": lang,
      "driver_camera_available": True,
      "offroad_mode": p.get_bool("OffroadMode"),
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def set_language(lang_id: str) -> dict[str, Any]:
  lang_id = _normalize_lang_id(lang_id)
  valid = {opt["id"] for opt in _language_options()}
  if lang_id not in valid:
    return {"ok": False, "error": f"unsupported language: {lang_id}"}
  try:
    from openpilot.common.params import Params
    Params().put("LanguageSetting", lang_id, block=True)
    return {"ok": True, "language": lang_id}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
