"""Shared aiohttp runner for webuid / run_pc."""

from __future__ import annotations

import ssl
from pathlib import Path

from aiohttp import web

from webui.server.tls_util import build_ssl_context, ensure_tls_files


def run_web_app(
  app: web.Application,
  *,
  host: str,
  port: int,
  tls: bool = False,
  tls_cert: str | None = None,
  tls_key: str | None = None,
  tls_dir: str | None = None,
) -> None:
  ssl_context: ssl.SSLContext | None = None
  if tls:
    if tls_cert and tls_key:
      ssl_context = build_ssl_context(Path(tls_cert), Path(tls_key))
    else:
      cert, key = ensure_tls_files(Path(tls_dir) if tls_dir else None)
      ssl_context = build_ssl_context(cert, key)
  web.run_app(app, host=host, port=port, ssl_context=ssl_context)
