#!/usr/bin/env python3
"""Openpilot Web UI service — parallel to ai.aid, separate port."""

from __future__ import annotations

import argparse

from aiohttp import web

from webui.server.app_factory import create_app
from webui.server.deps import DEFAULT_HOST, DEFAULT_PORT


def main() -> None:
  parser = argparse.ArgumentParser(description="Openpilot Web UI service")
  parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Listen port")
  parser.add_argument("--host", type=str, default=DEFAULT_HOST, help="Listen host")
  args = parser.parse_args()

  app = create_app()
  web.run_app(app, host=args.host, port=args.port)


if __name__ == "__main__":
  main()
