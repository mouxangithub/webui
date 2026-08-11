"""WiFi / network bridge via WifiManager."""

from __future__ import annotations

import threading
from typing import Any

_wifi: Any = None
_wifi_lock = threading.Lock()


def _manager():
  global _wifi
  with _wifi_lock:
    if _wifi is None:
      from openpilot.system.ui.lib.wifi_manager import WifiManager
      _wifi = WifiManager()
      _wifi.set_active(True)
    return _wifi


def wifi_status() -> dict[str, Any]:
  try:
    wm = _manager()
    wm.set_active(True)
    wm.process_callbacks()
    ssid = wm.connected_ssid
    return {
      "ok": True,
      "connected": ssid,
      "ipv4": wm.ipv4_address if hasattr(wm, "ipv4_address") else "",
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc), "networks": []}


def wifi_scan() -> dict[str, Any]:
  try:
    wm = _manager()
    wm.set_active(True)
    wm.process_callbacks()
    networks = []
    connected = wm.connected_ssid
    for n in wm.networks:
      networks.append({
        "ssid": n.ssid,
        "strength": n.strength,
        "security": int(n.security_type),
        "connected": connected == n.ssid,
      })
    networks.sort(key=lambda x: -x["strength"])
    return {"ok": True, "networks": networks}
  except Exception as exc:
    return {"ok": False, "error": str(exc), "networks": []}


def wifi_connect(ssid: str, password: str = "") -> dict[str, Any]:
  try:
    wm = _manager()
    wm.set_active(True)
    wm.connect_to_network(ssid, password, hidden=False)
    return {"ok": True, "ssid": ssid}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def wifi_forget(ssid: str) -> dict[str, Any]:
  try:
    wm = _manager()
    wm.forget_connection(ssid, block=True)
    return {"ok": True, "ssid": ssid}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
