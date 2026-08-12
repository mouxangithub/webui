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

    tree: list[dict[str, Any]] = [{"name": "Default", "ref": "Default", "bundles": [{"ref": "Default", "name": "Default (Default)", "index": -1}]}]
    active_ref = "Default"
    active_name = "Default"
    download: dict[str, Any] = {}

    if sm.valid["modelManagerSP"]:
      mm = sm["modelManagerSP"]
      folders: dict[str, list] = {}
      for bundle in mm.availableBundles:
        folder = ""
        for ov in bundle.overrides:
          if ov.key == "folder":
            folder = ov.value
        folders.setdefault(folder, []).append({
          "ref": bundle.ref,
          "name": bundle.displayName,
          "internal": bundle.internalName,
          "index": bundle.index,
        })
      tree = [{"name": k or "Models", "ref": k, "bundles": v} for k, v in sorted(folders.items(), key=lambda x: x[0])]
      if mm.activeBundle:
        active_ref = mm.activeBundle.ref
        active_name = mm.activeBundle.internalName or mm.activeBundle.displayName
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
      "tree": tree,
      "download": download,
      "last_sync": p.get("ModelManager_LastSyncTime") or "",
      "cache_clear_pending": p.get_bool("ModelManager_ClearCache"),
      "cache_size_mb": _cache_size_mb(),
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def models_select(ref: str, index: int | None = None) -> dict[str, Any]:
  try:
    from openpilot.common.params import Params
    p = Params()
    if ref == "Default":
      p.remove("ModelManager_ActiveBundle")
    elif index is not None:
      p.put("ModelManager_DownloadIndex", index, block=True)
    return {"ok": True, "ref": ref}
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
