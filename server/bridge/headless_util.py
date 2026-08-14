"""Headless (no builtin panel) detection for WebUI and device APIs."""

from __future__ import annotations

import os


def is_headless_mode() -> bool:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    try:
      from webui.dev.mock_runtime import SIM
      return bool(SIM.get("headless"))
    except Exception:
      return False
  try:
    from openpilot.common.hardware import TICI, HARDWARE
    if not TICI:
      return False
    return not HARDWARE.has_builtin_display()
  except Exception:
    return False
