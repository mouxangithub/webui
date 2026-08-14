"""Project modelV2 lane/path overlay for web canvas (uses device ModelRenderer when available)."""

from __future__ import annotations

import os
from typing import Any

_overlay_arv = None


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


def _get_augmented_road_view():
  global _overlay_arv
  if _overlay_arv is not None:
    return _overlay_arv
  import pyray as rl
  from msgq.visionipc import VisionStreamType
  from openpilot.selfdrive.ui.onroad.augmented_road_view import AugmentedRoadView, ROAD_CAM

  _overlay_arv = AugmentedRoadView(ROAD_CAM)
  return _overlay_arv


def _apply_calibration(arv) -> None:
  """Apply live calibration whenever valid (not only on sm.updated)."""
  from openpilot.cereal import log
  from openpilot.selfdrive.ui.ui_state import ui_state
  from openpilot.common.transformations.camera import DEVICE_CAMERAS, view_frame_from_device_frame
  from openpilot.common.transformations.orientation import rot_from_euler

  sm = ui_state.sm
  if not arv.device_camera and sm.seen.get("roadCameraState") and sm.seen.get("deviceState"):
    try:
      arv.device_camera = DEVICE_CAMERAS[(str(sm["deviceState"].deviceType), str(sm["roadCameraState"].sensor))]
    except Exception:
      pass

  if not sm.valid.get("liveCalibration"):
    return

  calib = sm["liveCalibration"]
  if len(calib.rpyCalib) != 3 or calib.calStatus != log.LiveCalibrationData.Status.calibrated:
    return

  device_from_calib = rot_from_euler(calib.rpyCalib)
  arv.view_from_calib = view_frame_from_device_frame @ device_from_calib

  if hasattr(calib, "wideFromDeviceEuler") and len(calib.wideFromDeviceEuler) == 3:
    wide_from_device = rot_from_euler(calib.wideFromDeviceEuler)
    arv.view_from_wide_calib = view_frame_from_device_frame @ wide_from_device @ device_from_calib


def _flat_poly(pts) -> list[list[float]]:
  import numpy as np

  if pts is None:
    return []
  arr = np.asarray(pts)
  if arr.size == 0:
    return []
  if arr.ndim == 1:
    arr = arr.reshape(-1, 2)
  return [[float(x), float(y)] for x, y in arr]


def _project_path_center(mr, max_idx: int) -> list[list[float]]:
  points = mr._path.raw_points
  if points is None or len(points) == 0:
    return []
  out: list[list[float]] = []
  end = min(max_idx + 1, len(points))
  for i in range(end):
    p = points[i]
    if p[0] < 0:
      continue
    screen = mr._map_to_screen(float(p[0]), float(p[1]), float(p[2]) + mr._path_offset_z)
    if screen:
      out.append([screen[0], screen[1]])
  return out


def _lead_metrics(lead_data, v_ego: float) -> list[str]:
  try:
    from openpilot.selfdrive.ui.sunnypilot.onroad.chevron_metrics import ChevronMetrics, ChevronOptions
    from openpilot.selfdrive.ui.ui_state import ui_state

    opt = int(ui_state.chevron_metrics or 0)
    if opt == ChevronOptions.OFF:
      return []
    return ChevronMetrics._build_text_lines(lead_data.dRel, lead_data.vRel, v_ego)
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
    import pyray as rl
    import numpy as np
    from openpilot.selfdrive.ui.ui_state import ui_state

    ui_state.update()
    try:
      ui_state.update_params()
    except Exception:
      pass

    started = ui_state.started
    if not started:
      try:
        sm0 = ui_state.sm
        if sm0.valid.get("deviceState"):
          started = bool(sm0["deviceState"].started)
      except Exception:
        pass
    if not started:
      return _empty(width, height)

    sm = ui_state.sm
    if not sm.valid.get("modelV2"):
      return _empty(width, height)

    arv = _get_augmented_road_view()
    rect = rl.Rectangle(0, 0, float(width), float(height))
    arv._content_rect = rect
    _apply_calibration(arv)
    arv._calc_frame_matrix(rect)

    mr = arv.model_renderer
    mr._rect = rect
    mr._clip_region = rl.Rectangle(-500, -500, width + 1000, height + 1000)
    mr._transform_dirty = True

    model = sm["modelV2"]
    mr._update_raw_points(model)
    path_x = mr._path.raw_points[:, 0]
    if path_x.size == 0:
      return _empty(width, height)

    radar_state = sm["radarState"] if sm.valid.get("radarState") else None
    lead = radar_state.leadOne if radar_state else None
    mr._update_model(lead, path_x)

    render_leads = mr._longitudinal_control and radar_state is not None
    if render_leads:
      mr._update_leads(radar_state, path_x)

    max_distance = float(np.clip(path_x[-1], 10.0, 100.0))
    max_idx = mr._get_path_length_idx(mr._lane_lines[0].raw_points[:, 0], max_distance)

    lanes = []
    for i, ll in enumerate(mr._lane_lines):
      lanes.append({
        "prob": float(mr._lane_line_probs[i]),
        "polygon": _flat_poly(ll.projected_points),
      })

    edges = []
    for i, re in enumerate(mr._road_edges):
      edges.append({
        "std": float(mr._road_edge_stds[i]),
        "polygon": _flat_poly(re.projected_points),
      })

    leads = []
    chevron_alpha = 0.0
    v_ego = float(sm["carState"].vEgo) if sm.valid.get("carState") else 0.0
    if render_leads and radar_state:
      try:
        mr.chevron_metrics.update_alpha(bool(radar_state.leadOne.present) or bool(radar_state.leadTwo.present))
        chevron_alpha = float(mr.chevron_metrics._lead_status_alpha)
      except Exception:
        pass

      lead_pairs = [
        (radar_state.leadOne, mr._lead_vehicles[0]),
        (radar_state.leadTwo, mr._lead_vehicles[1]),
      ]
      for lead_data, lv in lead_pairs:
        if not lead_data or not lead_data.present or not lv.glow or not lv.chevron:
          continue
        leads.append({
          "glow": [[float(x), float(y)] for x, y in lv.glow],
          "chevron": [[float(x), float(y)] for x, y in lv.chevron],
          "alpha": lv.fill_alpha,
          "d_rel": float(lead_data.dRel),
          "metrics": _lead_metrics(lead_data, v_ego),
        })

    allow_throttle = True
    try:
      if sm.valid.get("longitudinalPlan"):
        allow_throttle = bool(sm["longitudinalPlan"].allowThrottle or not mr._longitudinal_control)
    except Exception:
      pass

    rainbow = bool(getattr(ui_state, "rainbow_path", False))
    try:
      from openpilot.common.params import Params
      rainbow = rainbow or Params().get_bool("RainbowMode")
    except Exception:
      pass

    mr._experimental_mode = bool(sm["selfdriveState"].experimentalMode) if sm.valid.get("selfdriveState") else False

    path_gradient: list[dict[str, Any]] = []
    path_blend = 1.0
    if mr._experimental_mode:
      mr._update_experimental_gradient()
      exp_grad = getattr(mr, "_exp_gradient", None)
      if exp_grad and getattr(exp_grad, "colors", None):
        for stop, color in zip(exp_grad.stops, exp_grad.colors):
          path_gradient.append({
            "pos": float(stop),
            "rgba": [int(color.r), int(color.g), int(color.b), int(color.a)],
          })
    else:
      try:
        mr._blend_filter.update(int(allow_throttle))
        path_blend = round(float(mr._blend_filter.x) * 100) / 100
      except Exception:
        pass

    return {
      "ok": True,
      "width": width,
      "height": height,
      "lanes": lanes,
      "edges": edges,
      "path": _project_path_center(mr, max_idx),
      "path_polygon": _flat_poly(mr._path.projected_points),
      "leads": leads,
      "experimental": mr._experimental_mode,
      "rainbow": rainbow,
      "allow_throttle": allow_throttle,
      "path_blend": path_blend,
      "path_gradient": path_gradient,
      "chevron_alpha": chevron_alpha,
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
