"""Trips / drive stats."""

from __future__ import annotations

from typing import Any


def trips_stats() -> dict[str, Any]:
  try:
    from openpilot.common.params import Params
    from openpilot.selfdrive.ui.sunnypilot.lib.drive_stats import refresh_local_drive_stats

    p = Params()
    key = "LocalDriveStats"
    stats = p.get(key) or {}
    if not stats:
      stats = refresh_local_drive_stats(p, key)
    return {"ok": True, "stats": stats}
  except Exception as exc:
    return {"ok": False, "error": str(exc), "stats": {}}
