#!/usr/bin/env python3
"""Integrate op Web UI into openpilot: launch_chffrplus.sh autostart."""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

LAUNCH_MARKER = "start_webui"

START_WEBUI_FN = r'''  start_webui() {
    local root="$DIR"
    if [ ! -f "$root/webui/webuid.py" ]; then
      return 0
    fi
    local web_py=python3.12
    command -v "$web_py" >/dev/null 2>&1 || web_py=python3
    local venv_site="/usr/local/venv/lib/python3.12/site-packages"
    local py_path="$root"
    [ -d "$venv_site" ] && py_path="$root:$venv_site"
    if pgrep -f "[p]ython.* -m webui\.webuid" >/dev/null 2>&1; then
      return 0
    fi
    echo "[webui] starting :5080 ($(date))" >> /tmp/webui.log
    (cd "$root" && PYTHONPATH="$py_path" "$web_py" -m webui.webuid >> /tmp/webui.log 2>&1 &)
  }
'''

START_WEBUI_CALL = r'''  # op Web UI：与 ai 并行，浏览器 :5080
  start_webui
  (
    while true; do
      sleep 45
      start_webui
    done
  ) &
'''


def find_launch_script(root: Path) -> Path | None:
  for name in ("launch_chffrplus.sh", "launch_openpilot.sh"):
    path = root / name
    if path.is_file():
      return path
  return None


def patch_launch_script(path: Path, *, dry_run: bool = False) -> dict[str, Any]:
  content = path.read_text(encoding="utf-8")
  if LAUNCH_MARKER in content:
    return {"ok": True, "path": str(path), "changed": False, "note": "start_webui already present"}

  backup = path.with_suffix(path.suffix + f".bak.{datetime.now().strftime('%Y%m%d%H%M%S')}")
  fn_block = START_WEBUI_FN.rstrip() + "\n"
  call_block = START_WEBUI_CALL.rstrip() + "\n"

  new_content = content
  anchor = "  start_op_assistant()"
  if anchor in content and fn_block.strip() not in content:
    new_content = content.replace(anchor, fn_block + "\n" + anchor, 1)

  call_anchor = "  start_op_assistant\n"
  watchdog = "  (\n    while true; do\n      sleep 45\n      start_op_assistant\n    done\n  ) &"
  if watchdog in new_content and call_block.strip() not in new_content:
    new_content = new_content.replace(watchdog, call_block + "\n" + watchdog, 1)
  elif call_anchor in new_content and call_block.strip() not in new_content:
    new_content = new_content.replace(call_anchor, call_block + call_anchor, 1)
  else:
    manager_cd = None
    if "cd openpilot/system/manager" in new_content:
      manager_cd = "cd openpilot/system/manager"
    elif re.search(r"cd\s+system/manager", new_content):
      manager_cd = "cd system/manager"
    if manager_cd:
      if fn_block.strip() not in new_content:
        new_content = new_content.replace(f"  {manager_cd}", fn_block + f"\n  {manager_cd}", 1)
      if "./manager.py" in new_content and call_block.strip() not in new_content:
        new_content = new_content.replace("  ./manager.py", call_block + "\n  ./manager.py", 1)
    else:
      idx = new_content.rfind("\n}")
      if idx < 0:
        return {"ok": False, "path": str(path), "error": "Unrecognized launch script layout"}
      new_content = new_content[:idx] + "\n" + fn_block + "\n" + call_block + new_content[idx:]

  if new_content == content:
    return {"ok": False, "path": str(path), "error": "Failed to patch launch script"}

  if dry_run:
    return {"ok": True, "path": str(path), "changed": True, "dry_run": True}

  shutil.copy2(path, backup)
  path.write_text(new_content, encoding="utf-8")
  return {"ok": True, "path": str(path), "backup": str(backup), "changed": True}


def main() -> int:
  parser = argparse.ArgumentParser(description="Integrate webui into openpilot launch script")
  parser.add_argument("--root", type=Path, default=None, help="openpilot root directory")
  parser.add_argument("--dry-run", action="store_true")
  args = parser.parse_args()

  root = args.root
  if root is None:
    root = Path(__file__).resolve().parents[2]
  root = root.expanduser().resolve()

  launch = find_launch_script(root)
  if launch is None:
    print(f"[webui] no launch script under {root}", file=sys.stderr)
    return 1

  result = patch_launch_script(launch, dry_run=args.dry_run)
  print(result)
  return 0 if result.get("ok") else 1


if __name__ == "__main__":
  raise SystemExit(main())
