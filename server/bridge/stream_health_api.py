"""WebRTC / livestream health snapshot for WebUI diagnostics."""

from __future__ import annotations

from typing import Any


def snapshot_stream_health() -> dict[str, Any]:
  """Read-only livestream metrics — does not affect driving stack."""
  out: dict[str, Any] = {
    "ok": True,
    "livestreaming": False,
    "encoder_bitrate": None,
    "active_camera": None,
    "webrtcd_port": 5001,
    "thermal": "ok",
    "cpu_temp": None,
    "memory_usage_percent": None,
  }
  try:
    from openpilot.common.params import Params
    p = Params()
    out["livestreaming"] = p.get_bool("IsLiveStreaming")
    br = p.get("LivestreamEncoderBitrate")
    if br:
      out["encoder_bitrate"] = int(br)
    out["active_camera"] = p.get("LivestreamActiveCamera") or None
    out["encoder_lagging"] = p.get_bool("LivestreamEncoderLagging")
  except Exception as exc:
    out["ok"] = False
    out["error"] = str(exc)
    return out

  try:
    from webui.server.bridge.state_hub import get_state
    st = get_state()
    dev = st.get("device") or {}
    out["thermal"] = dev.get("thermal", "ok")
    out["cpu_temp"] = dev.get("cpu_temp")
    out["memory_usage_percent"] = dev.get("memory_usage_percent")
  except Exception:
    pass

  try:
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.3)
    out["webrtcd_listening"] = s.connect_ex(("127.0.0.1", 5001)) == 0
    s.close()
  except Exception:
    out["webrtcd_listening"] = False

  return out
