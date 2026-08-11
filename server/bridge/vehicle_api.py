"""Vehicle platform tree (car_list.json)."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from webui.server.deps import openpilot_root


def _car_list_path() -> Path | None:
  root = openpilot_root()
  candidates = [
    root / "openpilot" / "sunnypilot" / "selfdrive" / "car" / "car_list.json",
    root / "sunnypilot" / "selfdrive" / "car" / "car_list.json",
  ]
  for p in candidates:
    if p.is_file():
      return p
  return None


def vehicle_platforms() -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return {
      "ok": True,
      "tree": [
        {"name": "Toyota", "platforms": [
          {"bundle": "TOYOTA_COROLLA_TSS2_2019", "label": "Toyota Corolla TSS2 2019"},
          {"bundle": "TOYOTA_RAV4_TSS2_2021", "label": "Toyota RAV4 TSS2 2021"},
        ]},
        {"name": "Hyundai", "platforms": [
          {"bundle": "HYUNDAI_SONATA_DN8", "label": "Hyundai Sonata DN8"},
        ]},
      ],
      "active": "",
      "dev_pc": True,
    }

  try:
    from openpilot.common.params import Params
    active = Params().get("CarPlatformBundle") or ""
    path = _car_list_path()
    if not path:
      return {"ok": False, "error": "car_list.json not found"}
    data = json.loads(path.read_text(encoding="utf-8"))
    tree = []
    for brand, platforms in data.items():
      items = []
      for key, label in platforms.items():
        items.append({"bundle": key, "label": str(label)})
      tree.append({"name": brand, "platforms": items})
    return {"ok": True, "tree": tree, "active": active}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def vehicle_select(bundle: str) -> dict[str, Any]:
  try:
    from openpilot.common.params import Params
    p = Params()
    if not bundle:
      p.remove("CarPlatformBundle")
    else:
      p.put("CarPlatformBundle", bundle, block=True)
    return {"ok": True, "bundle": bundle}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def _detect_brand() -> str:
  import os
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return "toyota"
  try:
    from openpilot.common.params import Params
    p = Params()
    bundle = p.get("CarPlatformBundle")
    if bundle:
      try:
        import json
        data = json.loads(bundle) if isinstance(bundle, str) else bundle
        if isinstance(data, dict) and data.get("brand"):
          return str(data["brand"]).lower()
      except Exception:
        pass
    try:
      from openpilot.selfdrive.ui.ui_state import ui_state
      if ui_state.CP is not None:
        return str(ui_state.CP.brand).lower()
    except Exception:
      pass
  except Exception:
    pass
  return ""


def vehicle_brand_widgets() -> dict[str, Any]:
  from webui.server.bridge.vehicle_brand_catalog import widgets_for_brand
  from webui.server.bridge.params_api import _param_type_name, _serialize_value

  brand = _detect_brand()
  widgets = widgets_for_brand(brand)
  if not brand:
    return {"ok": True, "brand": "", "widgets": [], "values": {}}

  try:
    from openpilot.common.params import Params
    p = Params()
    values: dict[str, str] = {}
    out: list[dict[str, Any]] = []
    for w in widgets:
      key = w.get("param")
      if not key:
        out.append({**w, "available": True})
        continue
      ptype = _param_type_name(p, key)
      if ptype is None:
        out.append({**w, "available": False, "missing": True})
        continue
      val = _serialize_value(p.get(key))
      values[key] = val
      locked = False
      try:
        locked = p.get_bool(key + "Lock")
      except Exception:
        pass
      out.append({**w, "available": True, "value": val, "param_type": ptype, "locked": locked})
    return {"ok": True, "brand": brand, "widgets": out, "values": values}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
