"""Route registration."""

from __future__ import annotations

import json

from aiohttp import web

from webui.server.deps import WEB_DIR, json_response, openpilot_root, read_version
from webui.server.bridge.params_api import batch_get, get_param, panel_schema, panel_values, put_param
from webui.server.bridge.state_api import snapshot_ui_state
from webui.server.bridge.system_api import run_action, software_status
from webui.server.bridge.network_api import wifi_connect, wifi_forget, wifi_scan, wifi_status
from webui.server.bridge.webrtc_api import webrtc_offer, webrtc_schema
from webui.server.bridge.trips_api import trips_stats
from webui.server.bridge.models_api import models_status


async def api_bootstrap(_request: web.Request) -> web.Response:
  return json_response({
    "ok": True,
    "name": "op-webui",
    "version": read_version(),
    "openpilot_root": str(openpilot_root()),
    "design": {"width": 2160, "height": 1080, "variant": "BIG"},
    "webrtc": {"port": 5001},
  })


async def api_state(_request: web.Request) -> web.Response:
  return json_response(snapshot_ui_state())


async def api_panels_schema(_request: web.Request) -> web.Response:
  return json_response(panel_schema())


async def api_panel_get(request: web.Request) -> web.Response:
  panel_id = request.match_info.get("panel_id", "")
  return json_response(panel_values(panel_id))


async def api_param_get(request: web.Request) -> web.Response:
  key = request.match_info.get("key", "")
  return json_response(get_param(key))


async def api_param_put(request: web.Request) -> web.Response:
  key = request.match_info.get("key", "")
  try:
    body = await request.json()
    value = str(body.get("value", ""))
    needs_cycle = bool(body.get("needs_cycle", False))
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(put_param(key, value, needs_cycle=needs_cycle))


async def api_params_batch(request: web.Request) -> web.Response:
  try:
    body = await request.json()
    keys = body.get("keys", [])
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(batch_get(keys))


async def api_action(request: web.Request) -> web.Response:
  action = request.match_info.get("action", "")
  payload = {}
  if request.can_read_body:
    try:
      payload = await request.json()
    except json.JSONDecodeError:
      payload = {}
  return json_response(run_action(action, payload))


async def api_software(_request: web.Request) -> web.Response:
  return json_response(software_status())


async def api_wifi_status(_request: web.Request) -> web.Response:
  return json_response(wifi_status())


async def api_wifi_scan(_request: web.Request) -> web.Response:
  return json_response(wifi_scan())


async def api_wifi_connect(request: web.Request) -> web.Response:
  try:
    body = await request.json()
    ssid = str(body.get("ssid", ""))
    password = str(body.get("password", ""))
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(wifi_connect(ssid, password))


async def api_wifi_forget(request: web.Request) -> web.Response:
  try:
    body = await request.json()
    ssid = str(body.get("ssid", ""))
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(wifi_forget(ssid))


async def api_webrtc_schema(_request: web.Request) -> web.Response:
  return json_response(webrtc_schema())


async def api_webrtc_offer(request: web.Request) -> web.Response:
  try:
    body = await request.json()
    sdp = str(body.get("sdp", ""))
    camera = str(body.get("init_camera", "roadCameraState"))
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(webrtc_offer(sdp, camera))


async def api_trips(_request: web.Request) -> web.Response:
  return json_response(trips_stats())


async def api_models(_request: web.Request) -> web.Response:
  return json_response(models_status())


def register_routes(app: web.Application) -> None:
  app.router.add_get("/api/opui/bootstrap", api_bootstrap)
  app.router.add_get("/api/opui/state", api_state)
  app.router.add_get("/api/opui/panels", api_panels_schema)
  app.router.add_get("/api/opui/panels/{panel_id}", api_panel_get)
  app.router.add_get("/api/opui/params/{key}", api_param_get)
  app.router.add_put("/api/opui/params/{key}", api_param_put)
  app.router.add_post("/api/opui/params/batch", api_params_batch)
  app.router.add_post("/api/opui/action/{action}", api_action)
  app.router.add_get("/api/opui/software", api_software)
  app.router.add_get("/api/opui/wifi/status", api_wifi_status)
  app.router.add_get("/api/opui/wifi/scan", api_wifi_scan)
  app.router.add_post("/api/opui/wifi/connect", api_wifi_connect)
  app.router.add_post("/api/opui/wifi/forget", api_wifi_forget)
  app.router.add_get("/api/opui/trips", api_trips)
  app.router.add_get("/api/opui/models", api_models)
  app.router.add_post("/api/opui/webrtc/offer", api_webrtc_offer)

  # Legacy alias
  async def api_toggles_legacy(_request: web.Request) -> web.Response:
    return json_response(panel_values("toggles"))

  app.router.add_get("/api/opui/params/toggles", api_toggles_legacy)

  app.router.add_static("/static/", path=str(WEB_DIR), name="static")

  async def index(_request: web.Request) -> web.FileResponse:
    return web.FileResponse(WEB_DIR / "index.html")

  app.router.add_get("/", index)
