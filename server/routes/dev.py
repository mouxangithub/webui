"""Dev-only routes for PC preview simulation."""

from __future__ import annotations

import os

from aiohttp import web

from webui.server.deps import json_response


def _dev_enabled() -> bool:
  return os.environ.get("WEBUI_DEV_PC") == "1"


async def api_dev_simulation_get(_request: web.Request) -> web.Response:
  if not _dev_enabled():
    return json_response({"ok": False, "error": "not in dev mode"}, status=404)
  from webui.dev.mock_runtime import SIM
  return json_response({"ok": True, "simulation": dict(SIM)})


async def api_dev_simulation_post(request: web.Request) -> web.Response:
  if not _dev_enabled():
    return json_response({"ok": False, "error": "not in dev mode"}, status=404)
  from webui.dev.mock_runtime import SIM
  try:
    body = await request.json()
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  for k, v in body.items():
    if k in SIM:
      SIM[k] = v
  # Auto-sync engaged with ui_status when started
  if SIM.get("started") and SIM.get("ui_status") == "engaged":
    SIM["engaged"] = True
  elif SIM.get("ui_status") == "disengaged":
    SIM["engaged"] = False
  return json_response({"ok": True, "simulation": dict(SIM)})


async def api_dev_presets(request: web.Request) -> web.Response:
  if not _dev_enabled():
    return json_response({"ok": False, "error": "not in dev mode"}, status=404)
  from webui.dev.mock_runtime import SIM
  preset = request.match_info.get("preset", "")
  presets = {
    "home": {"started": False, "engaged": False, "ui_status": "disengaged", "alert_text1": "", "alert_text2": ""},
    "onroad_engaged": {"started": True, "engaged": True, "ui_status": "engaged", "speed_kmh": 88, "alert_text1": "", "alert_text2": ""},
    "onroad_disengaged": {"started": True, "engaged": False, "ui_status": "disengaged", "speed_kmh": 45, "alert_text1": "", "alert_text2": ""},
    "override": {"started": True, "engaged": True, "ui_status": "override", "speed_kmh": 100, "alert_text1": "", "alert_text2": ""},
    "lat_only": {"started": True, "engaged": True, "ui_status": "lat_only", "speed_kmh": 60, "alert_text1": "", "alert_text2": ""},
    "alert_critical": {
      "started": True, "engaged": False, "ui_status": "disengaged", "speed_kmh": 0,
      "alert_text1": "Brake!", "alert_text2": "Take control immediately", "alert_status": "critical",
    },
  }
  if preset not in presets:
    return json_response({"ok": False, "error": f"unknown preset: {preset}"}, status=400)
  SIM.update(presets[preset])
  return json_response({"ok": True, "preset": preset, "simulation": dict(SIM)})


def register_dev_routes(app: web.Application) -> None:
  if not _dev_enabled():
    return
  app.router.add_get("/api/opui/dev/simulation", api_dev_simulation_get)
  app.router.add_post("/api/opui/dev/simulation", api_dev_simulation_post)
  app.router.add_post("/api/opui/dev/preset/{preset}", api_dev_presets)
