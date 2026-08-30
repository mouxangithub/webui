"""Model manager tree + download status, mirroring sunnypilot's on-device Models layout."""

from __future__ import annotations

import os
import re
import time
from typing import Any

# Mirror sunnypilot/models/helpers.py — kept in sync so webui picks the same key the
# device manager writes.
_SOURCE_KEYS: dict[str, str] = {
  "qcom": "ModelManager_ActiveBundle",
  "usbgpu": "ModelManager_ActiveBundleUSBGPU",
}

_MODEL_TYPES = {
  "supercombo": "Driving Model",
  "vision": "Vision Model",
  "policy": "Policy Model",
  "offPolicy": "Off-Policy Model",
  "onPolicy": "On-Policy Model",
  "navigation": "Navigation Model",
}


def _cache_size_mb() -> float:
  try:
    from openpilot.sunnypilot.models.runners.constants import CUSTOM_MODEL_PATH
    if not os.path.exists(CUSTOM_MODEL_PATH):
      return 0.0
    total = sum(os.path.getsize(os.path.join(CUSTOM_MODEL_PATH, f)) for f in os.listdir(CUSTOM_MODEL_PATH))
    return total / (1024 ** 2)
  except Exception:
    return 0.0


def _default_model_label(source: str) -> str:
  try:
    if source == "usbgpu":
      from openpilot.sunnypilot.models.model_name import DEFAULT_BIG_MODEL
      return f"{DEFAULT_BIG_MODEL} (Default)"
    from openpilot.sunnypilot.models.model_name import DEFAULT_MODEL
    return f"{DEFAULT_MODEL} (Default)"
  except Exception:
    return "Default (Default)"


def _usbgpu_present() -> bool:
  try:
    from openpilot.selfdrive.modeld.helpers import usbgpu_present
    return bool(usbgpu_present())
  except Exception:
    return False


def _device_state() -> dict[str, Any] | None:
  """Read the live usbgpu status from deviceState + Params."""
  try:
    import openpilot.cereal.messaging as messaging
    sm = messaging.SubMaster(["deviceState"], poll="deviceState")
    deadline = time.monotonic() + 0.6
    while time.monotonic() < deadline:
      sm.update(120)
      if sm.valid.get("deviceState"):
        ds = sm["deviceState"]
        try:
          from openpilot.common.params import Params
          p = Params()
        except Exception:
          p = None
        return {
          "started": bool(getattr(ds, "started", False)),
          "chestnutPresent": bool(getattr(ds, "chestnutPresent", False)),
          "usbgpuActive": p.get_bool("UsbGpuActive") if p else None,
          "usbgpuLoading": p.get_bool("UsbGpuLoading") if p else False,
        }
  except Exception:
    pass
  return None


def _active_source(state: dict[str, Any] | None) -> str:
  """Mirror sunnypilot get_active_source — defaults to qcom on any read failure."""
  usbgpu = bool(state and state.get("chestnutPresent")) or _usbgpu_present()
  if not usbgpu:
    return "qcom"
  if not state:
    return "usbgpu"
  usbgpu_active = state.get("usbgpuActive")
  usbgpu_loading = state.get("usbgpuLoading")
  started = state.get("started")
  big_active = usbgpu_active is True or usbgpu_loading or (not started)
  return "usbgpu" if big_active else "qcom"


def _read_live_model_manager(timeout_ms: int = 2500) -> Any | None:
  try:
    import openpilot.cereal.messaging as messaging
    sm = messaging.SubMaster(["modelManagerSP"], poll="modelManagerSP")
    deadline = time.monotonic() + timeout_ms / 1000.0
    while time.monotonic() < deadline:
      sm.update(200)
      if sm.valid.get("modelManagerSP"):
        return sm["modelManagerSP"]
  except Exception:
    pass
  return None


def _cached_bundles(params: Any, source: str) -> list[Any]:
  """Read cached bundles for a source. Matches sunnypilot's get_cached_bundles."""
  try:
    from openpilot.sunnypilot.models.fetcher import ModelFetcher, ModelParser
    if source not in ModelFetcher.MODEL_SOURCES:
      return []
    _, suffix = ModelFetcher.MODEL_SOURCES[source]
    raw = params.get(f"ModelManager_ModelsCache{suffix}")
    if not raw:
      return []
    try:
      return ModelParser.parse_models(raw)
    except Exception:
      return []
  except Exception:
    return []


def _selected_bundle(params: Any, source: str) -> Any | None:
  try:
    from openpilot.sunnypilot.models.helpers import get_selected_bundle
    return get_selected_bundle(params, source)
  except Exception:
    return None


def _bundles_for_source(params: Any, source: str, mm: Any | None) -> list[Any]:
  """Mirror sunnypilot bundles_for_source: live for the active source, cache otherwise."""
  if mm is not None:
    try:
      available = list(mm.availableBundles) if mm.availableBundles is not None else []
    except Exception:
      available = []
    if available:
      return available
  return _cached_bundles(params, source)


def _bundle_entry(bundle: Any, favorites: set[str]) -> tuple[dict[str, Any], str]:
  folder = ""
  generation = ""
  try:
    for ov in bundle.overrides or []:
      if ov.key == "folder":
        folder = ov.value
      if ov.key == "generation":
        generation = ov.value
  except Exception:
    pass
  return {
    "ref": getattr(bundle, "ref", "") or "",
    "name": getattr(bundle, "displayName", "") or "",
    "internal": getattr(bundle, "internalName", "") or "",
    "index": getattr(bundle, "index", -1),
    "generation": generation,
    "fav": getattr(bundle, "ref", "") in favorites,
  }, folder


def _folder_display_name(folder: str, folder_bundles: list[dict[str, Any]]) -> str:
  if not folder:
    return "Models"
  if not folder_bundles:
    return folder
  m = re.search(r"\(([^)]*)\)[^(]*$", folder_bundles[0]["name"])
  if m:
    return f"{folder} - (Updated: {m.group(1)})"
  return folder


def _build_source_tree(bundles: list[Any], favorites: set[str], source: str) -> list[dict[str, Any]]:
  """Mirror sunnypilot's _open_source_dialog tree: Default root + folders + favorites."""
  tree: list[dict[str, Any]] = [
    {
      "name": "",
      "ref": "",
      "bundles": [{"ref": "Default", "name": _default_model_label(source), "index": -1, "generation": ""}],
    }
  ]
  folders: dict[str, list[dict[str, Any]]] = {}
  fav_bundles: list[dict[str, Any]] = []

  for bundle in bundles:
    entry, folder = _bundle_entry(bundle, favorites)
    folders.setdefault(folder, []).append(entry)
    if entry["ref"] and entry["ref"] in favorites:
      fav_bundles.append(entry)

  for folder, folder_bundles in sorted(
    folders.items(),
    key=lambda item: max((bundle["index"] for bundle in item[1]), default=-1),
    reverse=True,
  ):
    folder_bundles.sort(key=lambda bundle: bundle["index"], reverse=True)
    tree.append({
      "name": _folder_display_name(folder, folder_bundles),
      "ref": folder,
      "bundles": folder_bundles,
    })

  if fav_bundles:
    tree.insert(1, {"name": "Favorites", "ref": "Favorites", "bundles": fav_bundles})
  return tree


def _bundle_download(mm: Any | None) -> dict[str, Any]:
  if mm is None:
    return {}
  selected = getattr(mm, "selectedBundle", None)
  if selected is None or not getattr(selected, "models", None):
    return {}
  try:
    models = []
    verifying = False
    for m in selected.models:
      try:
        art = getattr(m, "artifact", None)
        dp = getattr(art, "downloadProgress", None) if art else None
        progress = float(getattr(dp, "progress", 0) or 0)
        status = getattr(dp, "status", "")
        if status:
          try:
            from openpilot.cereal import custom
            verifying = verifying or (getattr(status, "raw", status) == custom.ModelManagerSP.DownloadStatus.verifying)
          except Exception:
            pass
      except Exception:
        progress = float(getattr(m, "progress", 0) or 0)
      models.append({"type": str(getattr(m, "type", "")), "progress": progress})
    return {
      "status": str(getattr(selected, "status", "")),
      "name": getattr(selected, "displayName", "") or "",
      "internal": getattr(selected, "internalName", "") or "",
      "ref": getattr(selected, "ref", "") or "",
      "models": models,
      "verifying": verifying,
    }
  except Exception:
    return {}


def _big_model_state(state: dict[str, Any] | None) -> str | None:
  """Mirror sunnypilot big_model_state: 'failed' | 'loading' | None."""
  if not state:
    return None
  usbgpu_present_hw = bool(state.get("chestnutPresent"))
  started = bool(state.get("started"))
  if not usbgpu_present_hw:
    return None
  if started and state.get("usbgpuActive") is False:
    return "failed"
  if state.get("usbgpuLoading"):
    return "loading"
  return None


def _queued_name(current_ref: str, p: Any) -> str | None:
  """Name of the queued model when DownloadRef differs from the active download."""
  try:
    ref = p.get("ModelManager_DownloadRef")
    if not ref or ref == current_ref:
      return None
    resolved = _resolve_ref(ref, p)
    if resolved is None:
      return None
    bundle, _source = resolved
    return getattr(bundle, "internalName", "") or getattr(bundle, "displayName", "") or None
  except Exception:
    return None


def _models_status_impl() -> dict[str, Any]:
  from openpilot.common.params import Params
  p = Params()
  state = _device_state()
  active = _active_source(state)
  mm = _read_live_model_manager()

  favs_raw = p.get("ModelManager_Favs") or ""
  favorites = {f for f in str(favs_raw).split(";") if f}
  usbgpu_enabled = bool(state and state.get("chestnutPresent")) or _usbgpu_present()

  slots: dict[str, dict[str, Any]] = {}
  for source in ("qcom", "usbgpu"):
    bundles = _bundles_for_source(p, source, mm if source == active else None)
    selected = _selected_bundle(p, source)
    entry, _ = _bundle_entry(selected, favorites) if selected is not None else ({}, "")
    slots[source] = {
      "bundles": bundles,
      "tree": _build_source_tree(bundles, favorites, source),
      "selected": entry,
      "active_ref": getattr(selected, "ref", "") or "Default",
      "default_label": _default_model_label(source),
    }

  big_state = _big_model_state(state)

  # Carry: the slot actually driving — matches sunnypilot carrying_model().
  carry_source = active
  carry_slot = slots[active]
  carry_display = carry_slot["selected"].get("name") or carry_slot["default_label"]
  carry_internal = carry_slot["selected"].get("internal") or carry_slot["default_label"]

  download = _bundle_download(mm)
  return {
    "ok": True,
    "active_source": active,
    "usbgpu_enabled": usbgpu_enabled,
    "big_state": big_state,
    "carry_source": carry_source,
    "carry_display": carry_display,
    "carry_internal": carry_internal,
    "slots": slots,
    "download": download,
    "queued_name": _queued_name(download.get("ref", ""), p),
    "last_sync": p.get("ModelManager_LastSyncTime") or "",
    "cache_clear_pending": p.get_bool("ModelManager_ClearCache"),
    "cache_size_mb": _cache_size_mb(),
    "model_manager_online": mm is not None,
    "started": bool(state and state.get("started")),
  }


def models_status() -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return _mock_models()
  try:
    return _models_status_impl()
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def _generation(bundle: Any) -> str:
  try:
    for ov in bundle.overrides or []:
      if ov.key == "generation":
        return ov.value or ""
  except Exception:
    pass
  return ""


def _resolve_ref(ref: str, p: Any) -> tuple[Any, str] | None:
  """Find bundle + source for a ref across cached/live bundles."""
  try:
    from openpilot.sunnypilot.models.helpers import resolve_bundle_by_ref
    mm = _read_live_model_manager()
    source_bundles: dict[str, list[Any]] = {}
    for src in ("qcom", "usbgpu"):
      source_bundles[src] = _bundles_for_source(p, src, mm if src == _active_source(_device_state()) else None)
    return resolve_bundle_by_ref(ref, source_bundles)
  except Exception:
    return None


def models_select(ref: str, index: int | None = None, source: str = "qcom") -> dict[str, Any]:
  """Mirror sunnypilot _on_model_selected: Default resets the slot; otherwise queue DownloadRef."""
  try:
    from openpilot.common.params import Params
    p = Params()
    if source not in _SOURCE_KEYS:
      return {"ok": False, "error": f"unknown model source: {source}"}

    key = _SOURCE_KEYS[source]
    active = _selected_bundle(p, source)
    prev_gen = _generation(active) if active is not None else ""

    needs_reset_cal = False
    if ref == "Default":
      p.remove(key)
      needs_reset_cal = True
    else:
      resolved = _resolve_ref(ref, p)
      if resolved is None:
        return {"ok": False, "error": f"model not found: {ref}"}
      bundle, _resolved_source = resolved
      new_gen = _generation(bundle)
      if new_gen and prev_gen and new_gen != prev_gen:
        needs_reset_cal = True
      p.put("ModelManager_DownloadRef", ref, block=True)
    return {"ok": True, "ref": ref, "source": source, "needs_reset_cal": needs_reset_cal}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def models_toggle_favorite(ref: str) -> dict[str, Any]:
  ref = (ref or "").strip()
  if not ref or ref == "Default":
    return {"ok": False, "error": "invalid model ref"}
  try:
    from openpilot.common.params import Params
    p = Params()
    favs_raw = p.get("ModelManager_Favs") or ""
    favorites = [f for f in str(favs_raw).split(";") if f]
    if ref in favorites:
      favorites = [f for f in favorites if f != ref]
    else:
      favorites.append(ref)
    p.put("ModelManager_Favs", ";".join(favorites), block=True)
    return {"ok": True, "ref": ref, "favorites": favorites}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def _mock_models() -> dict[str, Any]:
  qcom_tree = [
    {"name": "", "bundles": [{"ref": "Default", "name": "Stock (Default)", "index": -1, "generation": ""}]},
    {"name": "Favorites", "bundles": [{"ref": "mock-1", "name": "supercombo-test", "index": 1, "fav": True}]},
    {"name": "Release", "bundles": [{"ref": "mock-2", "name": "release-main", "index": 2}]},
  ]
  big_tree = [
    {"name": "", "bundles": [{"ref": "Default", "name": "Big Stock (Default)", "index": -1, "generation": ""}]},
    {"name": "Big Test", "bundles": [{"ref": "mock-big-1", "name": "tinygrad-test", "index": 5, "fav": True}]},
  ]
  return {
    "ok": True,
    "active_source": "qcom",
    "usbgpu_enabled": False,
    "big_state": None,
    "carry_source": "qcom",
    "carry_display": "Stock (Default)",
    "carry_internal": "Stock (Default)",
    "slots": {
      "qcom": {
        "tree": qcom_tree,
        "selected": {},
        "active_ref": "Default",
        "default_label": "Stock (Default)",
      },
      "usbgpu": {
        "tree": big_tree,
        "selected": {},
        "active_ref": "Default",
        "default_label": "Big Stock (Default)",
      },
    },
    "download": {
      "status": "downloading",
      "name": "mock-bundle",
      "ref": "mock-1",
      "models": [
        {"type": "supercombo", "progress": 0.42},
        {"type": "vision", "progress": 0.65},
        {"type": "policy", "progress": 0.1},
        {"type": "offPolicy", "progress": 0},
        {"type": "onPolicy", "progress": 0},
      ],
    },
    "last_sync": "",
    "cache_clear_pending": False,
    "cache_size_mb": 12.5,
    "model_manager_online": True,
    "started": False,
    "dev_pc": True,
  }