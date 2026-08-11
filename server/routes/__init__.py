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
from webui.server.bridge.models_api import models_select, models_status
from webui.server.bridge.design_tokens import tokens_payload
from webui.server.bridge.assets_api import resolve_asset
from webui.server.bridge.model_overlay import snapshot_model_overlay
from webui.server.bridge.ssh_api import ssh_fetch_keys, ssh_remove_keys, ssh_status
from webui.server.bridge.osm_api import osm_download_progress, osm_map_size_mb, osm_regions, osm_select_region
from webui.server.bridge.vehicle_api import vehicle_platforms, vehicle_select
from webui.server.bridge.sunnylink_api import sunnylink_pair_url, sunnylink_status
from webui.server.bridge.firehose_api import firehose_status
from webui.server.bridge.device_api import device_extras, regulatory_html, set_language
from webui.server.bridge.home_api import snapshot_home
from webui.server.bridge.i18n_api import snapshot_i18n


async def api_bootstrap(_request: web.Request) -> web.Response:
  import os
  return json_response({
    "ok": True,
    "name": "op-webui",
    "version": read_version(),
    "openpilot_root": str(openpilot_root()),
    "dev_pc": os.environ.get("WEBUI_DEV_PC") == "1",
    "design": {"width": 2160, "height": 1080, "variant": "BIG"},
    "webrtc": {"port": 5001},
    **tokens_payload(),
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


async def api_models_select(request: web.Request) -> web.Response:
  try:
    body = await request.json()
    ref = str(body.get("ref", ""))
    index = body.get("index")
    if index is not None:
      index = int(index)
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(models_select(ref, index))


async def api_tokens(_request: web.Request) -> web.Response:
  return json_response({"ok": True, **tokens_payload()})


async def api_asset(request: web.Request) -> web.Response:
  rel = request.match_info.get("path", "")
  path = resolve_asset(rel)
  if not path:
    return web.Response(status=404, text="not found")
  return web.FileResponse(path)


async def api_model_overlay(request: web.Request) -> web.Response:
  try:
    w = int(request.query.get("w", "1600"))
    h = int(request.query.get("h", "900"))
  except ValueError:
    w, h = 1600, 900
  return json_response(snapshot_model_overlay(w, h))


async def api_ssh_status(_request: web.Request) -> web.Response:
  return json_response(ssh_status())


async def api_ssh_fetch(request: web.Request) -> web.Response:
  try:
    body = await request.json()
    username = str(body.get("username", ""))
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(ssh_fetch_keys(username))


async def api_ssh_remove(_request: web.Request) -> web.Response:
  return json_response(ssh_remove_keys())


async def api_osm_regions(_request: web.Request) -> web.Response:
  return json_response(osm_regions())


async def api_osm_select(request: web.Request) -> web.Response:
  try:
    body = await request.json()
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(osm_select_region(
    str(body.get("country", "")),
    str(body.get("country_title", "")),
    str(body.get("state", "")),
    str(body.get("state_title", "")),
  ))


async def api_osm_size(_request: web.Request) -> web.Response:
  return json_response(osm_map_size_mb())


async def api_osm_progress(_request: web.Request) -> web.Response:
  return json_response(osm_download_progress())


async def api_vehicle_platforms(_request: web.Request) -> web.Response:
  return json_response(vehicle_platforms())


async def api_vehicle_select(request: web.Request) -> web.Response:
  try:
    body = await request.json()
    bundle = str(body.get("bundle", ""))
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(vehicle_select(bundle))


async def api_sunnylink_status(_request: web.Request) -> web.Response:
  return json_response(sunnylink_status())


async def api_sunnylink_pair(_request: web.Request) -> web.Response:
  return json_response(sunnylink_pair_url())


async def api_firehose(_request: web.Request) -> web.Response:
  return json_response(firehose_status())


async def api_device_extras(_request: web.Request) -> web.Response:
  return json_response(device_extras())


async def api_device_regulatory(_request: web.Request) -> web.Response:
  return json_response(regulatory_html())


async def api_home(_request: web.Request) -> web.Response:
  return json_response(snapshot_home())


async def api_i18n(_request: web.Request) -> web.Response:
  return json_response(snapshot_i18n())


async def api_set_language(request: web.Request) -> web.Response:
  try:
    body = await request.json()
    lang = str(body.get("language", "main"))
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(set_language(lang))


def register_routes(app: web.Application) -> None:
  app.router.add_get("/api/opui/bootstrap", api_bootstrap)
  app.router.add_get("/api/opui/state", api_state)
  app.router.add_get("/api/opui/home", api_home)
  app.router.add_get("/api/opui/i18n", api_i18n)
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
  app.router.add_post("/api/opui/models/select", api_models_select)
  app.router.add_get("/api/opui/tokens", api_tokens)
  app.router.add_get("/api/opui/assets/{path:.*}", api_asset)
  app.router.add_get("/api/opui/model/overlay", api_model_overlay)
  app.router.add_get("/api/opui/ssh/status", api_ssh_status)
  app.router.add_post("/api/opui/ssh/fetch", api_ssh_fetch)
  app.router.add_post("/api/opui/ssh/remove", api_ssh_remove)
  app.router.add_get("/api/opui/osm/regions", api_osm_regions)
  app.router.add_post("/api/opui/osm/select", api_osm_select)
  app.router.add_get("/api/opui/osm/size", api_osm_size)
  app.router.add_get("/api/opui/osm/progress", api_osm_progress)
  app.router.add_get("/api/opui/vehicle/platforms", api_vehicle_platforms)
  app.router.add_post("/api/opui/vehicle/select", api_vehicle_select)
  app.router.add_get("/api/opui/sunnylink/status", api_sunnylink_status)
  app.router.add_get("/api/opui/sunnylink/pair", api_sunnylink_pair)
  app.router.add_get("/api/opui/firehose", api_firehose)
  app.router.add_get("/api/opui/device/extras", api_device_extras)
  app.router.add_get("/api/opui/device/regulatory", api_device_regulatory)
  app.router.add_post("/api/opui/device/language", api_set_language)
  app.router.add_post("/api/opui/webrtc/offer", api_webrtc_offer)

  # Legacy alias
  async def api_toggles_legacy(_request: web.Request) -> web.Response:
    return json_response(panel_values("toggles"))

  app.router.add_get("/api/opui/params/toggles", api_toggles_legacy)

  app.router.add_static("/static/", path=str(WEB_DIR), name="static")

  async def index(_request: web.Request) -> web.FileResponse:
    return web.FileResponse(WEB_DIR / "index.html")

  app.router.add_get("/", index)
