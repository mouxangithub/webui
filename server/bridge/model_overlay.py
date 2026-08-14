"""Project modelV2 lane/path overlay for web canvas (numpy ModelProjector; no pyray/EGL)."""

from __future__ import annotations

import os
from typing import Any

_projector: Any = None
_overlay_sm = None

_OVERLAY_SERVICES = [
  "modelV2",
  "liveCalibration",
  "radarState",
  "deviceState",
  "roadCameraState",
  "selfdriveState",
  "longitudinalPlan",
  "carParams",
  "carState",
]


def _empty(w: int, h: int) -> dict[str, Any]:
  return {
    "ok": True,
    "width": w,
    "height": h,
    "lanes": [],
    "edges": [],
    "path": [],
    "path_polygon": [],
    "leads": [],
    "experimental": False,
    "rainbow": False,
    "allow_throttle": True,
    "path_blend": 1.0,
    "path_gradient": [],
    "chevron_alpha": 0.0,
  }


def _get_projector(width: int, height: int):
  global _projector
  from openpilot.selfdrive.ui.onroad.model_projection import ModelProjector

  if _projector is None:
    _projector = ModelProjector(width, height)
  else:
    _projector.set_viewport(width, height)
  return _projector


def _get_overlay_sm():
  global _overlay_sm
  if _overlay_sm is None:
    import openpilot.cereal.messaging as messaging
    _overlay_sm = messaging.SubMaster(_OVERLAY_SERVICES, poll="modelV2")
  return _overlay_sm


def _longitudinal_control(sm) -> bool:
  if sm.valid.get("carParams"):
    return bool(sm["carParams"].openpilotLongitudinalControl)
  try:
    from openpilot.cereal import messaging
    from opendbc.car.structs import car
    from openpilot.common.params import Params

    if car_params := Params().get("CarParams"):
      cp = messaging.log_from_bytes(car_params, car.CarParams)
      return cp.openpilotLongitudinalControl
  except Exception:
    pass
  return False


def _camera_offset() -> float:
  try:
    from openpilot.common.params import Params
    p = Params()
    if p.get("ModelManager_ActiveBundle"):
      return float(p.get("CameraOffset", return_default=True))
  except Exception:
    pass
  return 0.0


def _lead_metrics(lead_data, v_ego: float) -> list[str]:
  try:
    from openpilot.common.constants import CV
    from openpilot.common.params import Params
    from openpilot.selfdrive.ui.sunnypilot.onroad.chevron_metrics import ChevronOptions

    p = Params()
    opt = int(p.get("ChevronInfo") or 0)
    if opt == ChevronOptions.OFF:
      return []

    is_metric = p.get_bool("IsMetric")
    d_rel, v_rel = lead_data.dRel, lead_data.vRel
    lines: list[str] = []

    if opt in (ChevronOptions.DISTANCE_ONLY, ChevronOptions.ALL):
      val = max(0.0, d_rel)
      unit = "m" if is_metric else "ft"
      if not is_metric:
        val *= 3.28084
      lines.append(f"{val:.0f} {unit}")

    if opt in (ChevronOptions.SPEED_ONLY, ChevronOptions.ALL):
      multiplier = CV.MS_TO_KPH if is_metric else CV.MS_TO_MPH
      val = max(0.0, (v_rel + v_ego) * multiplier)
      unit = "km/h" if is_metric else "mph"
      lines.append(f"{val:.0f} {unit}")

    if opt in (ChevronOptions.TTC_ONLY, ChevronOptions.ALL):
      val = (d_rel / v_ego) if (d_rel > 0 and v_ego > 0) else 0.0
      lines.append(f"{val:.1f} s" if (0 < val < 200) else "---")

    return lines
  except Exception:
    return []


def snapshot_model_overlay(width: int = 1600, height: int = 900) -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return _mock_overlay(width, height)

  try:
    from webui.server.bridge.state_hub import get_state
    thermal = str(get_state().get("device", {}).get("thermal", "ok")).lower()
    if thermal in ("critical", "danger"):
      return {"ok": True, "skipped": "thermal", "width": width, "height": height, "lanes": [], "path": [], "leads": []}
  except Exception:
    pass

  try:
    sm = _get_overlay_sm()
    sm.update(100)

    started = False
    if sm.valid.get("deviceState"):
      started = bool(sm["deviceState"].started)
    if not started:
      return _empty(width, height)

    if not sm.valid.get("modelV2"):
      return _empty(width, height)

    projector = _get_projector(width, height)
    if not projector.update_transform(sm):
      return _empty(width, height)

    long_ctrl = _longitudinal_control(sm)
    projector.set_longitudinal_control(long_ctrl)
    projector.set_camera_offset(_camera_offset())

    allow_throttle = True
    try:
      if sm.valid.get("longitudinalPlan"):
        allow_throttle = bool(sm["longitudinalPlan"].allowThrottle or not long_ctrl)
    except Exception:
      pass

    rainbow = False
    try:
      from openpilot.common.params import Params
      rainbow = Params().get_bool("RainbowMode")
    except Exception:
      pass

    experimental_mode = bool(sm["selfdriveState"].experimentalMode) if sm.valid.get("selfdriveState") else False

    overlay = projector.build_overlay(
      sm,
      experimental_mode=experimental_mode,
      allow_throttle=allow_throttle,
      rainbow=rainbow,
      lead_metrics_fn=_lead_metrics,
    )
    if overlay.get("empty"):
      return _empty(width, height)

    return {
      "ok": True,
      "width": width,
      "height": height,
      "lanes": overlay["lanes"],
      "edges": overlay["edges"],
      "path": overlay["path"],
      "path_polygon": overlay["path_polygon"],
      "leads": overlay["leads"],
      "experimental": overlay["experimental"],
      "rainbow": overlay["rainbow"],
      "allow_throttle": overlay["allow_throttle"],
      "path_blend": overlay["path_blend"],
      "path_gradient": overlay["path_gradient"],
      "chevron_alpha": overlay["chevron_alpha"],
    }
  except Exception as exc:
    out = _empty(width, height)
    out["ok"] = False
    out["error"] = str(exc)
    return out


def _mock_lane_polygon(cx: float, w: float, h: float, offset: float, half_width: float) -> list[list[float]]:
  """Perspective lane strip for PC preview."""
  top_y = h * 0.28
  bot_y = h * 0.96
  top_scale = 0.35
  bot_scale = 1.0
  top_cx = cx + offset * w * top_scale
  bot_cx = cx + offset * w * bot_scale
  tw = half_width * w * top_scale
  bw = half_width * w * bot_scale
  return [
    [bot_cx - bw, bot_y], [bot_cx + bw, bot_y],
    [top_cx + tw, top_y], [top_cx - tw, top_y],
  ]


def _mock_overlay(w: int, h: int) -> dict[str, Any]:
  """Perspective lane curves for PC preview."""
  cx = w * 0.5
  lanes = []
  for offset, prob, hw in [(-0.14, 0.85, 0.045), (-0.05, 0.9, 0.04), (0.05, 0.9, 0.04), (0.14, 0.85, 0.045)]:
    poly = _mock_lane_polygon(cx, w, h, offset, hw)
    lanes.append({
      "prob": prob,
      "polygon": poly,
      "center": [[(poly[0][0] + poly[1][0]) * 0.25 + (poly[2][0] + poly[3][0]) * 0.25, y]
                 for y in [h * 0.96, h * 0.72, h * 0.48, h * 0.28]],
    })

  path_poly = _mock_lane_polygon(cx, w, h, 0.0, 0.055)
  path = [
    [(path_poly[0][0] + path_poly[1][0]) / 2, path_poly[0][1]],
    [(path_poly[2][0] + path_poly[3][0]) / 2, (path_poly[0][1] + path_poly[2][1]) / 2],
    [(path_poly[2][0] + path_poly[3][0]) / 2, path_poly[2][1]],
  ]
  lead_cx = cx + w * 0.02
  lead_y = h * 0.44
  lead_s = w * 0.038
  mock_lead = {
    "glow": [
      [lead_cx - lead_s * 1.6, lead_y + lead_s],
      [lead_cx, lead_y - lead_s * 1.2],
      [lead_cx + lead_s * 1.6, lead_y + lead_s],
    ],
    "chevron": [
      [lead_cx - lead_s, lead_y + lead_s * 0.55],
      [lead_cx, lead_y - lead_s * 0.75],
      [lead_cx + lead_s, lead_y + lead_s * 0.55],
    ],
    "alpha": 210,
    "d_rel": 28.5,
    "metrics": ["28m", "-2.1"],
  }
  return {
    "ok": True,
    "width": w,
    "height": h,
    "lanes": lanes,
    "edges": [],
    "path": path,
    "path_polygon": path_poly,
    "leads": [mock_lead],
    "experimental": True,
    "rainbow": False,
    "allow_throttle": True,
    "path_blend": 1.0,
    "path_gradient": [
      {"pos": 0.0, "rgba": [13, 248, 122, 102]},
      {"pos": 0.5, "rgba": [114, 255, 92, 89]},
      {"pos": 1.0, "rgba": [114, 255, 92, 0]},
    ],
    "chevron_alpha": 0.0,
    "dev_pc": True,
  }
