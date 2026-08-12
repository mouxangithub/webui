"""Project modelV2 lane/path overlay for web canvas (uses device ModelRenderer when available)."""

from __future__ import annotations

import os
from typing import Any


def _empty(w: int, h: int) -> dict[str, Any]:
  return {"ok": True, "width": w, "height": h, "lanes": [], "edges": [], "path": [], "leads": [], "experimental": False}


def snapshot_model_overlay(width: int = 1600, height: int = 900) -> dict[str, Any]:
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return _mock_overlay(width, height)

  try:
    import pyray as rl
    import numpy as np
    from openpilot.selfdrive.ui.ui_state import ui_state
    from openpilot.selfdrive.ui.onroad.augmented_road_view import AugmentedRoadView, ROAD_CAM

    ui_state.update()
    if not ui_state.started:
      return _empty(width, height)

    sm = ui_state.sm
    if not sm.valid.get("modelV2") or sm.recv_frame["modelV2"] < ui_state.started_frame:
      return _empty(width, height)

    arv = AugmentedRoadView(ROAD_CAM)
    rect = rl.Rectangle(0, 0, float(width), float(height))
    arv._content_rect = rect
    arv._update_calibration()
    arv._calc_frame_matrix(rect)

    mr = arv.model_renderer
    mr._rect = rect
    mr._clip_region = rl.Rectangle(-500, -500, width + 1000, height + 1000)

    model = sm["modelV2"]
    mr._update_raw_points(model)
    path_x = mr._path.raw_points[:, 0]
    if path_x.size == 0:
      return _empty(width, height)

    lead = sm["radarState"].leadOne if sm.valid.get("radarState") else None
    mr._update_model(lead, path_x)

    def flat_poly(pts: np.ndarray) -> list[list[float]]:
      if pts is None or pts.size == 0:
        return []
      arr = pts.reshape(-1, 2) if pts.ndim > 1 else pts
      return [[float(x), float(y)] for x, y in arr]

    lanes = []
    for i, ll in enumerate(mr._lane_lines):
      lanes.append({
        "prob": float(mr._lane_line_probs[i]),
        "polygon": flat_poly(ll.projected_points),
      })

    edges = []
    for i, re in enumerate(mr._road_edges):
      edges.append({
        "std": float(mr._road_edge_stds[i]),
        "polygon": flat_poly(re.projected_points),
      })

    leads = []
    for lv in mr._lead_vehicles:
      if lv.glow and lv.chevron:
        leads.append({
          "glow": [[float(x), float(y)] for x, y in lv.glow],
          "chevron": [[float(x), float(y)] for x, y in lv.chevron],
          "alpha": lv.fill_alpha,
        })

    return {
      "ok": True,
      "width": width,
      "height": height,
      "lanes": lanes,
      "edges": edges,
      "path": flat_poly(mr._path.projected_points),
      "leads": leads,
      "experimental": bool(sm["selfdriveState"].experimentalMode),
      "rainbow": bool(getattr(ui_state, "rainbow_path", False)),
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc), **_empty(width, height)}


def _mock_overlay(w: int, h: int) -> dict[str, Any]:
  """Perspective lane curves for PC preview."""
  cx = w * 0.5
  lanes = []
  for offset, prob in [(-0.12, 0.85), (-0.04, 0.9), (0.04, 0.9), (0.12, 0.85)]:
    pts = []
    for t in range(0, 101, 5):
      y = h * (1 - t / 100)
      x = cx + offset * w * (1 - t / 100) * 0.8
      pts.extend([x, y, x + 20, y])
    lanes.append({"prob": prob, "polygon": []})
    # center lines only for mock
    center = [[cx + offset * w * (1 - t / 100) * 0.8, h * (1 - t / 100)] for t in range(0, 101, 4)]
    lanes[-1]["center"] = center

  path = [[cx, h * 0.95], [cx, h * 0.55], [cx, h * 0.25]]
  return {
    "ok": True,
    "width": w,
    "height": h,
    "lanes": lanes,
    "edges": [],
    "path": path,
    "leads": [],
    "experimental": True,
    "rainbow": True,
    "dev_pc": True,
  }
