"""aiohttp application factory."""

from __future__ import annotations

from aiohttp import web

from webui.server.routes import register_routes
from webui.server.routes.dev import register_dev_routes


def create_app() -> web.Application:
  app = web.Application()
  register_routes(app)
  register_dev_routes(app)

  import os
  if os.environ.get("WEBUI_DEV_PC") == "1":
    @web.middleware
    async def no_cache_static(request, handler):
      resp = await handler(request)
      if request.path.startswith("/static/") or request.path == "/":
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
      return resp
    app.middlewares.insert(0, no_cache_static)

  return app
