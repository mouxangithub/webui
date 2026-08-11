"""Model manager snapshot from cereal."""

from __future__ import annotations

from typing import Any


def models_status() -> dict[str, Any]:
  try:
    import openpilot.cereal.messaging as messaging
    from openpilot.common.params import Params

    p = Params()
    out: dict[str, Any] = {
      "active_bundle": p.get("ModelManager_ActiveBundle") or "",
      "last_sync": p.get("ModelManager_LastSyncTime") or "",
    }

    try:
      sm = messaging.SubMaster(["modelManagerSP"], poll="modelManagerSP")
      sm.update(500)
      if sm.valid["modelManagerSP"]:
        mm = sm["modelManagerSP"]
        out["download_progress"] = getattr(mm, "downloadProgress", None)
        out["active"] = getattr(mm, "activeBundle", None)
    except Exception:
      pass

    return {"ok": True, **out}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
