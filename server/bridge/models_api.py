"""Model manager tree + download status."""

from __future__ import annotations

import json
import os
from typing import Any


def _cache_size_mb() -> float:
  try:
    from openpilot.sunnypilot.models.runners.constants import CUSTOM_MODEL_PATH
    import os
    if not os.path.exists(CUSTOM_MODEL_PATH):
      return 0.0
    total = sum(os.path.getsize(os.path.join(CUSTOM_MODEL_PATH, f)) for f in os.listdir(CUSTOM_MODEL_PATH))
    return total / (1024 ** 2)
  except Exception:
    return 0.0


def models_status() -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return _mock_models()

  try:
    import openpilot.cereal.messaging as messaging
    from openpilot.common.params import Params

    p = Params()
    sm = messaging.SubMaster(["modelManagerSP"], poll="modelManagerSP")
    sm.update(500)

    tree: list[dict[str, Any]] = [{"name": "Default", "ref": "Default", "bundles": [{"ref": "Default", "name": "Default (Default)", "index": -1, "generation": ""}]}]
    active_ref = "Default"
    active_name = "Default"
    active_generation = ""
    download: dict[str, Any] = {}
    download_index = p.get("ModelManager_DownloadIndex")
    favs_raw = p.get("ModelManager_Favs") or ""
    favorites = {f for f in str(favs_raw).split(";") if f}

    if sm.valid["modelManagerSP"]:
      mm = sm["modelManagerSP"]
      folders: dict[str, list] = {}
      fav_bundles: list[dict[str, Any]] = []
      for bundle in mm.availableBundles:
        folder = ""
        generation = ""
        for ov in bundle.overrides:
          if ov.key == "folder":
            folder = ov.value
          if ov.key == "generation":
            generation = ov.value
        entry = {
          "ref": bundle.ref,
          "name": bundle.displayName,
          "internal": bundle.internalName,
          "index": bundle.index,
          "generation": generation,
        }
        folders.setdefault(folder, []).append(entry)
        if bundle.ref in favorites:
          fav_bundles.append(entry)
      tree = [{"name": k or "Models", "ref": k, "bundles": v} for k, v in sorted(folders.items(), key=lambda x: x[0])]
      if fav_bundles:
        tree.insert(0, {"name": "Favorites", "ref": "Favorites", "bundles": fav_bundles})
      if mm.activeBundle:
        active_ref = mm.activeBundle.ref
        active_name = mm.activeBundle.internalName or mm.activeBundle.displayName
        for ov in mm.activeBundle.overrides:
          if ov.key == "generation":
            active_generation = ov.value
      if mm.selectedBundle:
        download = {
          "status": str(mm.selectedBundle.status),
          "name": mm.selectedBundle.displayName,
          "models": [{"type": str(m.type), "progress": getattr(m, "progress", 0)} for m in mm.selectedBundle.models],
        }

    return {
      "ok": True,
      "active_ref": active_ref,
      "active_name": active_name,
      "active_generation": active_generation,
      "tree": tree,
      "download": download,
      "download_index": download_index,
      "last_sync": p.get("ModelManager_LastSyncTime") or "",
      "cache_clear_pending": p.get_bool("ModelManager_ClearCache"),
      "cache_size_mb": _cache_size_mb(),
      "custom_model_active": p.get("ModelManager_ActiveBundle") is not None,
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def models_select(ref: str, index: int | None = None) -> dict[str, Any]:
  try:
    from openpilot.common.params import Params
    p = Params()
    prev_gen = ""
    try:
      import openpilot.cereal.messaging as messaging
      sm = messaging.SubMaster(["modelManagerSP"], poll="modelManagerSP")
      if sm.update(500) and sm.valid.get("modelManagerSP") and sm["modelManagerSP"].activeBundle:
        for ov in sm["modelManagerSP"].activeBundle.overrides:
          if ov.key == "generation":
            prev_gen = ov.value
    except Exception:
      pass
    new_gen = ""
    needs_reset_cal = False
    if ref == "Default":
      p.remove("ModelManager_ActiveBundle")
      needs_reset_cal = True
    elif index is not None:
      p.put("ModelManager_DownloadIndex", index, block=True)
      try:
        import openpilot.cereal.messaging as messaging
        sm = messaging.SubMaster(["modelManagerSP"], poll="modelManagerSP")
        if sm.update(500) and sm.valid.get("modelManagerSP"):
          for bundle in sm["modelManagerSP"].availableBundles:
            if bundle.index == index:
              for ov in bundle.overrides:
                if ov.key == "generation":
                  new_gen = ov.value
              break
          if new_gen and prev_gen and new_gen != prev_gen:
            needs_reset_cal = True
      except Exception:
        pass
    return {"ok": True, "ref": ref, "needs_reset_cal": needs_reset_cal}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def _mock_models() -> dict[str, Any]:
  return {
    "ok": True,
    "active_ref": "Default",
    "active_name": "Default (Default)",
    "tree": [
      {"name": "", "bundles": [{"ref": "Default", "name": "Default (Default)", "index": -1}]},
      {"name": "Favorites", "bundles": [{"ref": "mock-1", "name": "supercombo-test", "index": 1}]},
      {"name": "Release", "bundles": [{"ref": "mock-2", "name": "release-main", "index": 2}]},
    ],
    "download": {
      "status": "downloading",
      "name": "mock-bundle",
      "models": [
        {"type": "supercombo", "progress": 0.42},
        {"type": "vision", "progress": 0.65},
        {"type": "policy", "progress": 0.1},
        {"type": "offPolicy", "progress": 0},
        {"type": "onPolicy", "progress": 0},
      ],
    },
    "cache_size_mb": 12.5,
    "dev_pc": True,
  }
