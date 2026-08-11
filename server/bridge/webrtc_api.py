"""WebRTC stream proxy to webrtcd."""

from __future__ import annotations

from typing import Any

WEBRTCD_PORT = 5001


def webrtc_schema() -> dict[str, Any]:
  try:
    import requests
    resp = requests.get(f"http://127.0.0.1:{WEBRTCD_PORT}/schema", timeout=2)
    if resp.ok:
      return {"ok": True, "schema": resp.json(), "port": WEBRTCD_PORT}
    return {"ok": False, "error": f"schema http {resp.status_code}"}
  except Exception as exc:
    return {"ok": False, "error": str(exc), "port": WEBRTCD_PORT}


def webrtc_offer(sdp: str, init_camera: str = "roadCameraState") -> dict[str, Any]:
  try:
    from openpilot.system.webrtc.helpers import StreamRequestBody, post_stream_request
    body = StreamRequestBody(
      sdp=sdp,
      init_camera=init_camera,
      enabled=True,
      bridge_services_in=[],
      bridge_services_out=[],
    )
    result = post_stream_request(body)
    return {"ok": True, **result}
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
