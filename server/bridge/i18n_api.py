"""i18n — same .po translations as openpilot GUI (multilang)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

# LanguageSetting param value → .po file suffix (app_{suffix}.po)
PO_LANG: dict[str, str] = {
  "main": "en",
  "en": "en",
  "zh": "zh-CHS",
  "zh-CHS": "zh-CHS",
  "zh-CHT": "zh-CHT",
  "de": "de",
  "es": "es",
  "fr": "fr",
  "ja": "ja",
  "ko": "ko",
  "pt": "pt-BR",
  "th": "th",
  "tr": "tr",
  "uk": "uk",
}


def _translations_dir() -> Path | None:
  candidates = [
    Path(__file__).resolve().parents[3] / "openpilot" / "selfdrive" / "ui" / "translations",
    Path(__file__).resolve().parents[4] / "openpilot" / "selfdrive" / "ui" / "translations",
  ]
  for c in candidates:
    if c.is_dir():
      return c
  return None


def _parse_quoted(s: str) -> str:
  s = s.strip()
  if not (s.startswith('"') and s.endswith('"')):
    return s
  s = s[1:-1]
  return (
    s.replace("\\n", "\n")
    .replace("\\t", "\t")
    .replace('\\"', '"')
    .replace("\\\\", "\\")
  )


def _parse_po_file(path: Path) -> dict[str, str]:
  """Minimal msgid/msgstr parser (PC dev fallback without openpilot.system)."""
  text = path.read_text(encoding="utf-8")
  translations: dict[str, str] = {}
  msgid = ""
  msgstr = ""
  state: str | None = None

  for raw in text.splitlines():
    line = raw.strip()
    if not line or line.startswith("#"):
      continue
    if line.startswith("msgid "):
      if state == "msgstr" and msgid:
        translations[msgid] = msgstr
      msgid = _parse_quoted(line[6:].strip())
      msgstr = ""
      state = "msgid"
      continue
    if line.startswith("msgstr "):
      msgstr = _parse_quoted(line[7:].strip())
      state = "msgstr"
      continue
    if line.startswith('"') and state == "msgid":
      msgid += _parse_quoted(line)
    elif line.startswith('"') and state == "msgstr":
      msgstr += _parse_quoted(line)

  if state == "msgstr" and msgid:
    translations[msgid] = msgstr
  return translations


def _load_strings(lang_setting: str) -> dict[str, str]:
  po_code = PO_LANG.get(lang_setting, PO_LANG.get(lang_setting.removeprefix("main_"), "en"))
  tdir = _translations_dir()
  if not tdir:
    return {}
  po_path = tdir / f"app_{po_code}.po"
  if not po_path.is_file():
    return {}

  try:
    from openpilot.system.ui.lib.multilang import load_translations
    translations, _plurals = load_translations(po_path)
    return translations
  except Exception:
    return _parse_po_file(po_path)


def _current_language() -> str:
  try:
    from openpilot.common.params import Params
    return str(Params().get("LanguageSetting") or "main")
  except Exception:
    return "main"


def snapshot_i18n() -> dict[str, Any]:
  lang = _current_language()
  strings = _load_strings(lang)
  return {
    "ok": True,
    "language": lang,
    "po_code": PO_LANG.get(lang, "en"),
    "strings": strings,
    "sync_note": "Shares Params LanguageSetting with on-device GUI; changes apply to both after param write.",
  }
