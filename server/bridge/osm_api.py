"""OSM region tree + map status for settings panel."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any


def _mock_regions() -> dict[str, Any]:
  return {
    "ok": True,
    "countries": [
      {"name": "US", "title": "United States", "states": [
        {"name": "CA", "title": "California"},
        {"name": "TX", "title": "Texas"},
        {"name": "NY", "title": "New York"},
      ]},
      {"name": "CA", "title": "Canada", "states": []},
      {"name": "DE", "title": "Germany", "states": []},
    ],
    "dev_pc": True,
  }


def osm_regions() -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return _mock_regions()
  try:
    from openpilot.selfdrive.ui.sunnypilot.layouts.settings.osm import OSMLayout
    # Static fallback tree — full tree loaded on device via TreeOptionDialog
    return {
      "ok": True,
      "countries": [
        {"name": "US", "title": "United States", "states": []},
      ],
      "note": "Use device UI for full region catalog",
    }
  except Exception:
    return _mock_regions()


def osm_select_region(country: str, country_title: str, state: str = "", state_title: str = "") -> dict[str, Any]:
  try:
    from openpilot.common.params import Params
    p = Params()
    p.put("OsmLocationName", country, block=True)
    p.put("OsmLocationTitle", country_title, block=True)
    if state:
      p.put("OsmStateName", state, block=True)
      p.put("OsmStateTitle", state_title, block=True)
    else:
      p.remove("OsmStateName")
      p.remove("OsmStateTitle")
    return {"ok": True}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def osm_download_progress() -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return {"ok": True, "progress": 0, "active": False, "dev_pc": True}
  try:
    from openpilot.common.params import Params
    p = Params()
    raw = p.get("OSMDownloadProgress") or "0"
    try:
      progress = float(raw)
    except (TypeError, ValueError):
      progress = 0.0
    active = bool(p.get("OSMDownloadLocations"))
    return {"ok": True, "progress": progress, "active": active}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def osm_map_size_mb() -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return {"ok": True, "size_mb": 128.5, "dev_pc": True}
  try:
    from openpilot.common.hardware.hw import Paths
    root = Path(Paths.mapd_root()) / "offline"
    total = sum(f.stat().st_size for f in root.rglob("*") if f.is_file()) if root.exists() else 0
    return {"ok": True, "size_mb": round(total / (1024 ** 2), 2)}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def osm_delete_maps() -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return {"ok": True, "dev_pc": True}
  try:
    from openpilot.common.params import Params
    Params().put_bool("OsmDbDelete", True, block=True)
    return {"ok": True}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
