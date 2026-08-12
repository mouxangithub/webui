"""Route registration."""

from __future__ import annotations

import asyncio
import json

from aiohttp import web

from webui.server.deps import WEB_DIR, json_response, openpilot_root, read_version
from webui.server.bridge.params_api import batch_get, get_param, panel_schema, panel_values, put_param
from webui.server.bridge.state_api import snapshot_ui_state
from webui.server.bridge.system_api import run_action, software_status
from webui.server.bridge.network_api import (
  network_advanced_status,
  wifi_connect,
  wifi_connect_hidden,
  wifi_forget,
  wifi_scan,
  wifi_set_metered,
  wifi_set_tethering,
  wifi_set_tethering_password,
  wifi_status,
)
from webui.server.bridge.webrtc_api import webrtc_notify, webrtc_offer, webrtc_schema
from webui.server.bridge.trips_api import trips_stats
from webui.server.bridge.models_api import models_select, models_status
from webui.server.bridge.design_tokens import tokens_payload
from webui.server.bridge.assets_api import resolve_asset
from webui.server.bridge.model_overlay import snapshot_model_overlay
from webui.server.bridge.ssh_api import ssh_fetch_keys, ssh_remove_keys, ssh_status
from webui.server.bridge.osm_api import osm_download_progress, osm_fetch_regions, osm_map_size_mb, osm_select_region
from webui.server.bridge.vehicle_api import vehicle_platforms, vehicle_select, vehicle_brand_widgets
from webui.server.bridge.sunnylink_api import sunnylink_pair_url, sunnylink_status
from webui.server.bridge.firehose_api import firehose_status
from webui.server.bridge.device_api import device_extras, regulatory_html, set_language
from webui.server.bridge.steering_api import torque_versions
from webui.server.bridge.home_api import snapshot_home
from webui.server.bridge.i18n_api import snapshot_i18n
from webui.server.bridge.developer_api import developer_error_log
from webui.server.bridge.osm_api import osm_delete_maps
from webui.server.bridge.ws_handler import ws_opui_handler


async def api_bootstrap(_request: web.Request) -> web.Response:
  from webui.server.bridge.ws_rpc import bootstrap_payload
  return json_response(bootstrap_payload())


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


async def api_wifi_scan(request: web.Request) -> web.Response:
  trigger = request.rel_url.query.get("trigger", "").lower() in ("1", "true", "yes")
  return json_response(wifi_scan(trigger=trigger))


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


async def api_network_advanced(_request: web.Request) -> web.Response:
  return json_response(network_advanced_status())


async def api_wifi_tethering(request: web.Request) -> web.Response:
  try:
    body = await request.json()
    active = bool(body.get("active", False))
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(wifi_set_tethering(active))


async def api_wifi_tethering_password(request: web.Request) -> web.Response:
  try:
    body = await request.json()
    password = str(body.get("password", ""))
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(wifi_set_tethering_password(password))


async def api_wifi_metered(request: web.Request) -> web.Response:
  try:
    body = await request.json()
    metered = int(body.get("metered", 0))
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(wifi_set_metered(metered))


async def api_wifi_connect_hidden(request: web.Request) -> web.Response:
  try:
    body = await request.json()
    ssid = str(body.get("ssid", ""))
    password = str(body.get("password", ""))
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(wifi_connect_hidden(ssid, password))


async def api_webrtc_schema(_request: web.Request) -> web.Response:
  loop = asyncio.get_running_loop()
  result = await loop.run_in_executor(None, webrtc_schema)
  return json_response(result)


async def api_webrtc_offer(request: web.Request) -> web.Response:
  try:
    body = await request.json()
    sdp = str(body.get("sdp", ""))
    camera = str(body.get("init_camera", "road"))
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  loop = asyncio.get_running_loop()
  result = await loop.run_in_executor(None, webrtc_offer, sdp, camera)
  return json_response(result)


async def api_webrtc_notify(request: web.Request) -> web.Response:
  try:
    body = await request.json()
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  loop = asyncio.get_running_loop()
  result = await loop.run_in_executor(None, webrtc_notify, body)
  return json_response(result)


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


async def api_osm_regions(request: web.Request) -> web.Response:
  region_type = request.query.get("type", "Country")
  return json_response(osm_fetch_regions(region_type))


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


async def api_vehicle_brand_widgets(_request: web.Request) -> web.Response:
  return json_response(vehicle_brand_widgets())


async def api_developer_error_log(_request: web.Request) -> web.Response:
  return json_response(developer_error_log())


async def api_osm_delete(_request: web.Request) -> web.Response:
  return json_response(osm_delete_maps())


async def api_sunnylink_status(_request: web.Request) -> web.Response:
  return json_response(sunnylink_status())


async def api_sunnylink_pair(request: web.Request) -> web.Response:
  mode = request.rel_url.query.get("mode", "pair")
  return json_response(sunnylink_pair_url(mode))


async def api_firehose(_request: web.Request) -> web.Response:
  return json_response(firehose_status())


async def api_device_extras(_request: web.Request) -> web.Response:
  return json_response(device_extras())


async def api_torque_versions(_request: web.Request) -> web.Response:
  return json_response(torque_versions())


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
  app.router.add_get("/api/opui/network/advanced", api_network_advanced)
  app.router.add_post("/api/opui/wifi/tethering", api_wifi_tethering)
  app.router.add_post("/api/opui/wifi/tethering/password", api_wifi_tethering_password)
  app.router.add_post("/api/opui/wifi/metered", api_wifi_metered)
  app.router.add_post("/api/opui/wifi/connect/hidden", api_wifi_connect_hidden)
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
  app.router.add_post("/api/opui/osm/delete", api_osm_delete)
  app.router.add_get("/api/opui/vehicle/platforms", api_vehicle_platforms)
  app.router.add_get("/api/opui/vehicle/brand-widgets", api_vehicle_brand_widgets)
  app.router.add_post("/api/opui/vehicle/select", api_vehicle_select)
  app.router.add_get("/api/opui/sunnylink/status", api_sunnylink_status)
  app.router.add_get("/api/opui/sunnylink/pair", api_sunnylink_pair)
  app.router.add_get("/api/opui/firehose", api_firehose)
  app.router.add_get("/api/opui/device/extras", api_device_extras)
  app.router.add_get("/api/opui/steering/torque-versions", api_torque_versions)
  app.router.add_get("/api/opui/device/regulatory", api_device_regulatory)
  app.router.add_get("/api/opui/developer/error-log", api_developer_error_log)
  app.router.add_post("/api/opui/device/language", api_set_language)
  app.router.add_get("/api/opui/webrtc/schema", api_webrtc_schema)
  app.router.add_post("/api/opui/webrtc/offer", api_webrtc_offer)
  app.router.add_post("/api/opui/webrtc/notify", api_webrtc_notify)
  app.router.add_get("/ws/opui", ws_opui_handler)

  # Legacy alias
  async def api_toggles_legacy(_request: web.Request) -> web.Response:
    return json_response(panel_values("toggles"))

  app.router.add_get("/api/opui/params/toggles", api_toggles_legacy)

  app.router.add_static("/static/", path=str(WEB_DIR), name="static")

  async def index(_request: web.Request) -> web.FileResponse:
    return web.FileResponse(WEB_DIR / "index.html")

  app.router.add_get("/", index)
