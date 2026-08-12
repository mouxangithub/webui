"""OSM region tree + map status for settings panel."""

from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any

_SIZE_CACHE: dict[str, Any] = {"ts": 0.0, "size_mb": 0.0, "computing": False}
_SIZE_TTL = 20.0
_REGIONS_CACHE: dict[str, dict[str, Any]] = {}


def _shm_params():
  from openpilot.common.params import Params
  if os.name != "posix" or not Path("/dev/shm/params").exists():
    return Params()
  return Params("/dev/shm/params")


def _mock_regions(region_type: str = "Country") -> dict[str, Any]:
  if region_type == "State":
    return {
      "ok": True,
      "region_type": "State",
      "states": [
        {"name": "All", "title": "All states (~6.0 GB)"},
        {"name": "CA", "title": "California"},
        {"name": "TX", "title": "Texas"},
      ],
      "dev_pc": True,
    }
  return {
    "ok": True,
    "region_type": "Country",
    "countries": [
      {"name": "US", "title": "United States"},
      {"name": "CA", "title": "Canada"},
      {"name": "DE", "title": "Germany"},
    ],
    "dev_pc": True,
  }


def _calculate_map_size_bytes() -> int:
  try:
    from openpilot.common.hardware.hw import Paths
    root = Path(Paths.mapd_root()) / "offline"
    if not root.exists():
      return 0
    total = 0
    stack = [root]
    while stack:
      path = stack.pop()
      try:
        with os.scandir(path) as it:
          for entry in it:
            try:
              if entry.is_file(follow_symlinks=False):
                total += entry.stat(follow_symlinks=False).st_size
              elif entry.is_dir(follow_symlinks=False):
                stack.append(entry.path)
            except OSError:
              continue
      except OSError:
        continue
    return total
  except Exception:
    return 0


def _refresh_size_cache_async() -> None:
  if _SIZE_CACHE.get("computing"):
    return
  _SIZE_CACHE["computing"] = True

  def run() -> None:
    try:
      total = _calculate_map_size_bytes()
      _SIZE_CACHE["size_mb"] = round(total / (1024 ** 2), 2)
      _SIZE_CACHE["ts"] = time.monotonic()
    finally:
      _SIZE_CACHE["computing"] = False

  threading.Thread(target=run, daemon=True).start()


def osm_regions() -> dict[str, Any]:
  """Lightweight placeholder — real regions load on demand."""
  return {"ok": True, "lazy": True}


def osm_fetch_regions(region_type: str = "Country") -> dict[str, Any]:
  key = region_type or "Country"
  if key in _REGIONS_CACHE:
    return _REGIONS_CACHE[key]
  if os.environ.get("WEBUI_DEV_PC") == "1":
    data = _mock_regions(key)
    _REGIONS_CACHE[key] = data
    return data
  try:
    import requests
    base_url = "https://raw.githubusercontent.com/pfeiferj/openpilot-mapd/main/"
    file_name = "nation_bounding_boxes.json" if key == "Country" else "us_states_bounding_boxes.json"
    raw = requests.get(base_url + file_name, timeout=10).json()
    if key == "Country":
      countries = sorted(
        [{"name": k, "title": v.get("full_name", k)} for k, v in raw.items()],
        key=lambda c: c["title"],
      )
      data = {"ok": True, "region_type": "Country", "countries": countries}
    else:
      states = sorted(
        [{"name": k, "title": v.get("full_name", k)} for k, v in raw.items()],
        key=lambda s: s["title"],
      )
      states.insert(0, {"name": "All", "title": "All states (~6.0 GB)"})
      data = {"ok": True, "region_type": "State", "states": states}
    _REGIONS_CACHE[key] = data
    return data
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


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
    return {"ok": True, "progress": 0, "active": False, "downloading": False, "done": 0, "total": 0, "dev_pc": True}
  try:
    p = _shm_params()
    downloading = bool(p.get("OSMDownloadLocations"))
    pending = bool(p.get_bool("OsmDbUpdatesCheck"))
    progress_raw = p.get("OSMDownloadProgress")
    total = done = 0
    if progress_raw:
      try:
        obj = json.loads(progress_raw) if isinstance(progress_raw, str) else progress_raw
        if isinstance(obj, dict):
          total = int(obj.get("total_files") or 0)
          done = int(obj.get("downloaded_files") or 0)
      except Exception:
        pass
    pct = max(0.0, min(100.0, (done / total) * 100.0)) if total > 0 else 0.0
    active = downloading or pending
    return {
      "ok": True,
      "progress": pct,
      "active": active,
      "downloading": downloading,
      "done": done,
      "total": total,
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def osm_map_size_mb(*, refresh: bool = False) -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return {"ok": True, "size_mb": 128.5, "pending": False, "dev_pc": True}
  now = time.monotonic()
  age = now - float(_SIZE_CACHE.get("ts") or 0)
  if refresh or age > _SIZE_TTL:
    _refresh_size_cache_async()
  pending = bool(_SIZE_CACHE.get("computing")) or age > _SIZE_TTL
  return {"ok": True, "size_mb": float(_SIZE_CACHE.get("size_mb") or 0), "pending": pending}


def osm_panel_custom() -> dict[str, Any]:
  prog = osm_download_progress()
  size = osm_map_size_mb(refresh=bool(prog.get("downloading")))
  return {"ok": True, "size": size, "progress": prog}


def osm_delete_maps() -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return {"ok": True, "dev_pc": True}
  try:
    from openpilot.common.params import Params
    Params().put_bool("OsmDbDelete", True, block=True)
    _SIZE_CACHE["ts"] = 0.0
    _refresh_size_cache_async()
    return {"ok": True}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
