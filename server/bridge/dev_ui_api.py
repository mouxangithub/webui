"""Developer UI snapshot for web HUD (mirrors developer_ui/elements.py)."""

from __future__ import annotations

from typing import Any

from openpilot.common.constants import CV


def _color_hex(r: int, g: int, b: int) -> str:
  return f"#{r:02x}{g:02x}{b:02x}"


def _lead_dist_color(d_rel: float) -> str:
  if d_rel < 5:
    return "#ff0000"
  if d_rel < 15:
    return "#ffbc00"
  return "#ffffff"


def _lead_speed_color(v_rel: float) -> str:
  if v_rel < -4.4704:
    return "#ff0000"
  if v_rel < 0:
    return "#ffbc00"
  return "#ffffff"


def _lat_color(lat_active: bool, steer_override: bool) -> str:
  if not lat_active:
    return "#ffffff"
  return "#919b95" if steer_override else "#00ff00"


def snapshot_dev_ui(sm: Any, is_metric: bool) -> dict[str, Any] | None:
  try:
    from openpilot.selfdrive.ui.ui_state import ui_state
    mode = int(ui_state.developer_ui or 0)
  except Exception:
    return None

  if mode == 0:
    return None

  try:
    if sm.recv_frame["carState"] < getattr(ui_state, "started_frame", 0):
      return None
  except Exception:
    pass

  cs = sm["carState"]
  ctrl = sm["controlsState"]
  cc = sm["carControl"]
  conv = CV.MS_TO_KPH if is_metric else CV.MS_TO_MPH
  speed_unit = "km/h" if is_metric else "mph"

  lead = sm["radarState"].leadOne if sm.valid.get("radarState") else None
  lead_present = bool(lead and lead.present)
  lead_d = float(lead.dRel) if lead_present else 0.0
  lead_v = float(lead.vRel) if lead_present else 0.0

  lat_active = bool(cc.latActive)
  steer_override = bool(cs.steeringPressed)
  roll = float(sm["liveParameters"].roll) if sm.valid.get("liveParameters") else 0.0
  v_ego = float(cs.vEgo)
  curvature = float(ctrl.curvature)
  actual_la = (curvature * v_ego ** 2) - (roll * 9.81)

  right: list[dict[str, str]] = [
    {
      "label": "REL DIST",
      "value": f"{lead_d:.0f}" if lead_present else "-",
      "unit": "m",
      "color": _lead_dist_color(lead_d) if lead_present else "#ffffff",
    },
    {
      "label": "REL SPEED",
      "value": f"{lead_v * conv:.0f}" if lead_present else "-",
      "unit": speed_unit,
      "color": _lead_speed_color(lead_v) if lead_present else "#ffffff",
    },
    {
      "label": "REAL STEER",
      "value": f"{float(cs.steeringAngleDeg):.1f}°",
      "unit": "",
      "color": "#ffffff",
    },
    {
      "label": "ACTUAL L.A.",
      "value": f"{actual_la:.2f}",
      "unit": "m/s²",
      "color": _lat_color(lat_active, steer_override),
    },
  ]

  lat_which = ""
  try:
    lat_which = ctrl.lateralControlState.which()
  except Exception:
    pass

  if lat_which == "torqueState":
    desired_curv = float(ctrl.desiredCurvature)
    desired_la = (desired_curv * v_ego ** 2) - (roll * 9.81)
    right.insert(3, {
      "label": "DESIRED L.A.",
      "value": f"{desired_la:.2f}" if lat_active else "-",
      "unit": "m/s²",
      "color": _lat_color(lat_active, steer_override),
    })

  bottom: list[dict[str, str]] = [
    {
      "label": "A_EGO",
      "value": f"{float(cs.aEgo):.1f}",
      "unit": "m/s²",
      "color": "#ffffff",
    },
    {
      "label": "LEAD SPEED",
      "value": f"{lead_v * conv:.0f}" if lead_present else "-",
      "unit": speed_unit,
      "color": _lead_speed_color(lead_v) if lead_present else "#ffffff",
    },
  ]

  return {"mode": mode, "bottom": bottom, "right": right}
