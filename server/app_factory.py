"""aiohttp application factory."""

from __future__ import annotations

from aiohttp import web

from webui.server.routes import register_routes
from webui.server.routes.dev import register_dev_routes


def create_app() -> web.Application:
  app = web.Application()
  register_routes(app)
  register_dev_routes(app)
  return app
