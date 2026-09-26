"""Bluetooth setup HTTP API for webui.

Stationary-only Bluetooth setup. HTTP can configure mappings and device management,
but never fire vehicle commands (those go through the daemon's evdev reader).

Requires:
  - jeepney (D-Bus async, for BlueZ integration)
  - sudo access (for systemctl bluetooth, chgrp/chmod on evdev nodes)

Endpoints exposed via routes/__init__.py:
  GET  /api/opui/bluetooth           → status snapshot
  POST /api/opui/bluetooth/scan     → start discovery
  POST /api/opui/bluetooth/pair     → begin pairing
  POST /api/opui/bluetooth/cancel    → cancel ongoing pairing
  POST /api/opui/bluetooth/answer   → respond to pairing prompt
  POST /api/opui/bluetooth/connect  → connect to device
  POST /api/opui/bluetooth/disconnect → disconnect device
  POST /api/opui/bluetooth/forget  → remove device
  POST /api/opui/bluetooth/config   → save full config
  POST /api/opui/bluetooth/device-config → save per-device config
  POST /api/opui/bluetooth/learn    → enter/exit learning mode
  POST /api/opui/bluetooth/radio   → enable/disable BT radio
"""

from __future__ import annotations

import asyncio
import time
from urllib.parse import urlsplit

from aiohttp import web

from openpilot.sunnypilot.carrot.bluetooth import (
  ACTIONS,
  CONFIG_PATH,
  DEFAULT_MAPPING,
  RUNTIME,
  AddressValidator,
  AtomicJSON,
  config,
  read_json,
  validate_config,
)
from openpilot.sunnypilot.carrot.bluetooth.bluez import Bluez


# ---------------------------------------------------------------------------
# Module-level Bluez client (one per app lifetime)
# ---------------------------------------------------------------------------
_bluez_client: Bluez | None = None
_bluez_lock: asyncio.Lock | None = None


def _get_client() -> tuple[Bluez, asyncio.Lock]:
  global _bluez_client, _bluez_lock
  if _bluez_client is None:
    _bluez_client = Bluez()
    _bluez_lock = asyncio.Lock()
  return _bluez_client, _bluez_lock


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _radio_enabled() -> bool:
  """Check if the Bluetooth radio is enabled via /data/bluetooth/ENABLED."""
  process = await asyncio.create_subprocess_exec(
    'sudo', '-n', 'test', '-f', '/data/bluetooth/ENABLED',
    stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
  )
  try:
    return await asyncio.wait_for(process.wait(), 3) == 0
  except TimeoutError:
    process.kill()
    await process.wait()
    return False


def _runtime_status() -> dict:
  """Read and annotate daemon runtime status from /dev/shm/carrot-bluetooth/status.json."""
  state = read_json(RUNTIME / 'status.json', {})
  if not isinstance(state, dict):
    state = {}
  stamp = state.get('time', 0)
  state['alive'] = (
    isinstance(stamp, (float, int))
    and 0 <= time.monotonic() - stamp < 2
    and not state.get('stopped')
  )
  state['stationary'] = bool(state['alive'] and state.get('stationary'))
  return state


def _guard_stationary(request: web.Request) -> None:
  """Raise HTTP 409 if the vehicle is not stationary or cruise is engaged."""
  origin = request.headers.get('Origin')
  if origin and urlsplit(origin).netloc != request.host \
     or request.headers.get('Sec-Fetch-Site') == 'cross-site':
    raise web.HTTPForbidden(text='same-origin requests only')
  if request.content_type != 'application/json':
    raise web.HTTPUnsupportedMediaType(text='application/json required')
  if not _runtime_status()['stationary']:
    raise web.HTTPConflict(text='setup requires fresh stationary and disengaged state')


def _cancel_pending(mac: str) -> None:
  """Record that all commands from mac are cancelled (graceful disconnect)."""
  cancelled = read_json(RUNTIME / 'cancelled.json', {})
  if not isinstance(cancelled, dict):
    cancelled = {}
  cancelled[mac] = time.monotonic()
  AtomicJSON(RUNTIME / 'cancelled.json', cancelled)


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------

async def api_bluetooth_status(request: web.Request) -> web.Response:
  """GET /api/opui/bluetooth — full status snapshot."""
  result: dict = {
    'runtime': _runtime_status(),
    'config': config(),
    'actions': ACTIONS,
    'defaults': DEFAULT_MAPPING,
    'radioEnabled': await _radio_enabled(),
  }
  client, _ = _get_client()
  try:
    result.update(await client.snapshot())
    result['available'] = True
  except Exception as exc:
    error_str = str(exc)
    # DBus service unavailable — provide a clean user-facing message
    if "ServiceUnknown" in error_str or "org.bluez" in error_str:
      error_str = "Bluetooth adapter not found. BlueZ is not installed or the DBus bluetooth service is not running on this device."
    result.update(available=False, error=error_str, devices=[], adapters=[])
  return web.json_response(result)


async def api_bluetooth_mutate(request: web.Request) -> web.Response:
  """POST /api/opui/bluetooth/{operation} — all state-changing operations."""
  _guard_stationary(request)

  if request.content_length is not None and request.content_length > 32768:
    raise web.HTTPRequestEntityTooLarge(max_size=32768, actual_size=request.content_length)
  raw = await request.content.read(32769)
  if len(raw) > 32768:
    raise web.HTTPRequestEntityTooLarge(max_size=32768, actual_size=len(raw))

  import json
  try:
    body = json.loads(raw)
    if not isinstance(body, dict):
      raise ValueError('object required')
  except json.JSONDecodeError as exc:
    raise web.HTTPBadRequest(text=str(exc)) from exc

  operation = request.match_info.get('operation', '')
  client, lock = _get_client()

  async with lock:
    _guard_stationary(request)

    try:
      if operation == 'scan':
        await client.scan()

      elif operation == 'pair':
        await client.start_pair(AddressValidator.validate(body.get('address', '')))

      elif operation == 'cancel':
        await client.cancel_pair()

      elif operation == 'answer':
        client.respond(body.get('id'), body.get('value'))

      elif operation in ('connect', 'disconnect', 'forget'):
        mac = AddressValidator.validate(body.get('address', ''))
        await client.device_action(mac, operation)
        if operation != 'connect':
          _cancel_pending(mac)
        if operation == 'forget':
          settings = config()
          settings['devices'].pop(mac, None)
          AtomicJSON(CONFIG_PATH, settings)

      elif operation in ('config', 'device-config'):
        previous = config()
        if operation == 'device-config':
          mac = AddressValidator.validate(body.get('address', ''))
          settings = config()
          settings['devices'][mac] = body.get('device')
          settings = validate_config(settings)
        else:
          settings = validate_config(body)
        # Ensure all configured devices are actually paired before saving.
        paired = {
          d['address'] for d in (await client.snapshot())['devices'] if d['paired']
        }
        if any(mac not in paired for mac in settings['devices']):
          raise ValueError('pair devices before configuring input')
        AtomicJSON(CONFIG_PATH, settings)
        for mac, old in previous['devices'].items():
          if settings['devices'].get(mac) != old:
            _cancel_pending(mac)

      elif operation == 'learn':
        mac = AddressValidator.validate(body.get('address', ''))
        if mac not in config()['devices']:
          raise ValueError('save the input profile first')
        if type(body.get('enabled')) is not bool:
          raise ValueError('enabled must be boolean')
        AtomicJSON(
          RUNTIME / 'learn.json',
          {'address': mac, 'until': time.monotonic() + 120} if body['enabled'] else {},
        )
        _cancel_pending(mac)

      elif operation == 'radio':
        if type(body.get('enabled')) is not bool:
          raise ValueError('enabled must be boolean')
        await client.close()
        commands = (
          [['sudo', '-n', 'mkdir', '-p', '/data/bluetooth'],
           ['sudo', '-n', 'touch', '/data/bluetooth/ENABLED'],
           ['sudo', '-n', 'systemctl', 'start', 'carrot-bluetooth-radio']]
          if body['enabled']
          else [['sudo', '-n', 'rm', '-f', '/data/bluetooth/ENABLED'],
                 ['sudo', '-n', 'systemctl', 'stop', 'carrot-bluetooth-radio'],
                 ['sudo', '-n', 'systemctl', 'stop', 'bluetooth']]
        )
        for command in commands:
          proc = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
          )
          try:
            _, error = await asyncio.wait_for(proc.communicate(), 20)
          except TimeoutError:
            proc.kill()
            await proc.wait()
            raise ValueError('radio operation timed out') from None
          if proc.returncode:
            raise ValueError(error.decode(errors='replace')[:500])

      else:
        raise web.HTTPNotFound()

    except (ValueError, TypeError, KeyError) as exc:
      raise web.HTTPBadRequest(text=str(exc)) from exc
    except web.HTTPException:
      raise
    except Exception as exc:
      raise web.HTTPBadGateway(text=str(exc)) from exc

  return web.json_response({'ok': True})
