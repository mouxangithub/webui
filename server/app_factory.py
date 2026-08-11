"""aiohttp application factory."""

from __future__ import annotations

from aiohttp import web

from webui.server.routes import register_routes


def create_app() -> web.Application:
  app = web.Application()
  register_routes(app)
  return app
