"""Shared server dependencies and paths."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from aiohttp import web

DEFAULT_PORT = 5080
DEFAULT_HOST = "0.0.0.0"

_PKG_ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = _PKG_ROOT / "web" / "static"


def openpilot_root() -> Path:
  env = (os.environ.get("OPENPILOT_ROOT") or os.environ.get("OP_ROOT") or "").strip()
  if env:
    return Path(env).expanduser().resolve()
  return _PKG_ROOT.parent.resolve()


def json_response(data: Any, *, status: int = 200) -> web.Response:
  return web.Response(
    text=json.dumps(data, ensure_ascii=False),
    content_type="application/json",
    status=status,
  )


def read_version() -> str:
  try:
    return (_PKG_ROOT / "VERSION").read_text(encoding="utf-8").strip()
  except OSError:
    return "0.0.0"
