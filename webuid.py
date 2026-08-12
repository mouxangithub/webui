"""
Web UI server — same entry as launch_chffrplus.sh (`python -m webui.webuid`).

On PC without compiled openpilot Params, auto-installs dev mocks (same as run_pc.py).
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path


def _openpilot_root() -> Path:
  here = Path(__file__).resolve().parent
  root = here.parent
  if (root / "openpilot").is_dir():
    return root
  if (root.parent / "openpilot").is_dir():
    return root.parent
  return root


def ensure_runtime() -> bool:
  """Return True when PC dev mocks are active."""
  if os.environ.get("WEBUI_DEV_PC") == "1":
    return True
  try:
    from openpilot.common.params_pyx import Params  # noqa: F401
    return False
  except Exception:
    pass
  root = str(_openpilot_root())
  if root not in sys.path:
    sys.path.insert(0, root)
  from webui.dev.mock_runtime import install_openpilot_mocks

  install_openpilot_mocks(root)
  logging.getLogger("webuid").info("PC dev mocks enabled (Params/cereal unavailable)")
  return True


def main() -> None:
  parser = argparse.ArgumentParser(description="openpilot Web UI server")
  parser.add_argument("--port", type=int, default=int(os.environ.get("WEBUI_PORT", "5080")))
  parser.add_argument("--host", type=str, default=os.environ.get("WEBUI_HOST", "0.0.0.0"))
  args = parser.parse_args()

  dev_pc = ensure_runtime()

  from aiohttp import web
  from webui.server.app_factory import create_app

  app = create_app()
  print()
  print(f"  op Web UI: http://127.0.0.1:{args.port}/")
  if dev_pc:
    print("  模式: PC 预览 (Mock Params + 模拟状态)")
    print("  提示: 右下角 Dev 面板可切换离路/行驶；与车机差异见 webui/dev/README.md")
  print()
  web.run_app(app, host=args.host, port=args.port)


if __name__ == "__main__":
  main()
