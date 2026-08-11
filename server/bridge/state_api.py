"""Lightweight UI state from cereal (started, alerts, speed)."""

from __future__ import annotations

from typing import Any


def snapshot_ui_state() -> dict[str, Any]:
  try:
    import openpilot.cereal.messaging as messaging
    from openpilot.cereal import log

    sm = messaging.SubMaster(
      ["deviceState", "selfdriveState", "carState"],
      poll="deviceState",
    )
    sm.update(200)
    started = sm["deviceState"].started
    ss = sm["selfdriveState"]
    cs = sm["carState"]
    return {
      "ok": True,
      "started": started,
      "engaged": ss.active,
      "alert": {
        "text1": ss.alertText1,
        "text2": ss.alertText2,
        "size": str(ss.alertSize),
        "status": str(ss.alertStatus),
      },
      "speed": float(cs.vEgo) if cs.vEgo == cs.vEgo else 0.0,
      "experimental_mode": ss.experimentalMode,
      "state": str(ss.state),
    }
  except Exception as exc:
    return {
      "ok": False,
      "error": str(exc),
      "started": False,
      "engaged": False,
    }
