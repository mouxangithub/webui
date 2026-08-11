"""Route registration."""

from __future__ import annotations

from aiohttp import web

from webui.server.deps import WEB_DIR, json_response, openpilot_root, read_version
from webui.server.bridge.params_api import get_param, list_toggle_params, put_param
from webui.server.bridge.state_api import snapshot_ui_state


async def api_bootstrap(_request: web.Request) -> web.Response:
  return json_response({
    "ok": True,
    "name": "op-webui",
    "version": read_version(),
    "openpilot_root": str(openpilot_root()),
    "design": {"width": 2160, "height": 1080, "variant": "BIG"},
    "webrtc": {"port": 5001, "hint": "Set IsLiveStreaming and use webrtcd for road camera"},
  })


async def api_state(_request: web.Request) -> web.Response:
  return json_response(snapshot_ui_state())


async def api_params_list(_request: web.Request) -> web.Response:
  return json_response(list_toggle_params())


async def api_param_get(request: web.Request) -> web.Response:
  key = request.match_info.get("key", "")
  return json_response(get_param(key))


async def api_param_put(request: web.Request) -> web.Response:
  key = request.match_info.get("key", "")
  try:
    body = await request.json()
    value = str(body.get("value", ""))
  except Exception:
    return json_response({"ok": False, "error": "invalid json"}, status=400)
  return json_response(put_param(key, value))


def register_routes(app: web.Application) -> None:
  app.router.add_get("/api/opui/bootstrap", api_bootstrap)
  app.router.add_get("/api/opui/state", api_state)
  app.router.add_get("/api/opui/params/toggles", api_params_list)
  app.router.add_get("/api/opui/params/{key}", api_param_get)
  app.router.add_put("/api/opui/params/{key}", api_param_put)

  app.router.add_static("/static/", path=str(WEB_DIR), name="static")

  async def index(_request: web.Request) -> web.FileResponse:
    return web.FileResponse(WEB_DIR / "index.html")

  app.router.add_get("/", index)
