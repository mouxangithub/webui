"""Contract tests: ensure the PC dev mock produces the same top-level state
keys as the real state_api.build_state_from_sm()."""

from __future__ import annotations

import ast
import os
import unittest

os.environ.setdefault("WEBUI_DEV_PC", "1")

from webui.dev.mock_runtime import snapshot_dev_ui_state  # noqa: E402


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))


def _keys_from_return_dict(func_path: str) -> set[str]:
  """Parse the source and collect the keys of the dict literal returned by
  ``build_state_from_sm`` at the top of the module. Falls back to the set of
  keys found in any top-level dict return."""
  with open(func_path, "r", encoding="utf-8") as f:
    source = f.read()
  tree = ast.parse(source)

  for node in ast.walk(tree):
    if not isinstance(node, ast.FunctionDef):
      continue
    if node.name != "build_state_from_sm":
      continue
    for stmt in node.body:
      if isinstance(stmt, ast.Return) and isinstance(stmt.value, ast.Dict):
        keys = set()
        for k in stmt.value.keys:
          if isinstance(k, ast.Constant) and isinstance(k.value, str):
            keys.add(k.value)
          elif isinstance(k, ast.Str):  # py < 3.8 compatibility
            keys.add(k.s)
        return keys
  raise RuntimeError("Could not find build_state_from_sm return dict")


class StateContractTests(unittest.TestCase):
  def test_pc_mock_covers_real_state_keys(self) -> None:
    """Every key returned by the real state_api must also exist in the PC
    preview mock. Extra keys in the mock are allowed (e.g. dev_pc markers)."""
    real_keys = _keys_from_return_dict(os.path.join(ROOT, "webui", "server", "bridge", "state_api.py"))
    mock_state = snapshot_dev_ui_state()
    mock_keys = set(mock_state.keys())

    missing = real_keys - mock_keys
    if missing:
      self.fail(f"PC mock is missing top-level state keys: {sorted(missing)}")


if __name__ == "__main__":
  unittest.main()
