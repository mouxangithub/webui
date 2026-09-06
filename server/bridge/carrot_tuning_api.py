"""Bridge to Carrot tuning parameters.

Carrot's tuning surface (ATC/fork offsets, curve speed, blind spot, lane
change, navi speed, sound — mirrors ``_DEFAULT_NAV_PARAMS`` in
``openpilot/sunnypilot/carrot/config.py``) is registered in
``common/params_keys.h``, so values live in the cross-process Params store.
Carrot's ``UnifiedParams`` prefers the system Params store and falls back to
``nav_params.json`` for pre-registration values, so writes made here take
effect in the carrot daemon within its ~10 Hz ``update_params()`` refresh.

The defaults table below must stay in sync with ``_DEFAULT_NAV_PARAMS``;
it exists so the webui can display/reset correct values without importing
openpilot (which is unavailable on PC dev, where MockParams is used).
"""

from __future__ import annotations

from typing import Any

# key -> (kind, default). kind: "bool" | "int" | "float" | "str"
CARROT_TUNING_DEFAULTS: dict[str, tuple[str, Any]] = {
  # ATC / fork
  "AutoTurnDistOffset": ("int", 0),
  "AutoForkDistOffset": ("int", 30),
  "AutoDoForkBlinkerDist": ("int", 15),
  "AutoDoForkNavDist": ("int", 15),
  "AutoForkDistOffsetH": ("int", 1000),
  "AutoDoForkDecalDistH": ("int", 50),
  "AutoDoForkDecalDist": ("int", 20),
  "AutoDoForkBlinkerDistH": ("int", 30),
  "AutoDoForkNavDistH": ("int", 50),
  "AutoUpRoadLimit": ("int", 0),
  "AutoUpRoadLimit40KMH": ("int", 15),
  "AutoUpHighwayRoadLimit": ("int", 0),
  "AutoUpHighwayRoadLimit40KMH": ("int", 15),
  "RoadType": ("int", -1),
  "AutoForkDecalRateH": ("int", 80),
  "AutoForkSpeedMinH": ("int", 60),
  "AutoKeepForkSpeedH": ("int", 5),
  "AutoForkDecalRate": ("int", 80),
  "AutoForkSpeedMin": ("int", 45),
  "AutoKeepForkSpeed": ("int", 5),
  "ShowDebugLog": ("bool", 0),
  "AutoCurveSpeedFactorH": ("int", 100),
  "AutoCurveSpeedAggressivenessH": ("int", 100),
  "SameSpiCamFilter": ("bool", 1),
  "StockBlinkerCtrl": ("bool", 0),
  "ExtBlinkerCtrlTest": ("bool", 0),
  "BlinkerMode": ("int", 1),
  "LaneStabTime": ("int", 50),
  # Blind spot (BSD)
  "DynamicBlindRange": ("int", 0),
  "DynamicBlindDistance": ("int", 0),
  "DisableBlindSpot": ("bool", 0),
  "BsdDelayTime": ("int", 20),
  "SideBsdDelayTime": ("int", 20),
  "SideRelDistTime": ("int", 10),
  "SidevRelDistTime": ("int", 10),
  "SideRadarMinDist": ("int", 0),
  # Lane change / blinker
  "AutoTurnInNotRoadEdge": ("bool", 1),
  "ContinuousLaneChange": ("bool", 1),
  "ContinuousLaneChangeCnt": ("int", 4),
  "ContinuousLaneChangeInterval": ("int", 2),
  "AutoTurnLeft": ("bool", 1),
  "AutoEnTurnNewLaneTimeH": ("int", 0),
  "AutoEnTurnNewLaneTime": ("int", 0),
  "NewLaneWidthDiff": ("int", 8),
  # Navi speed / sound
  "StopDistanceCarrot": ("int", 550),
  "AutoNaviSpeedCtrlMode": ("int", 0),
  "AutoNaviSpeedDecelRate": ("int", 150),
  "AutoNaviSpeedSafetyFactor": ("int", 100),
  "SoundVolumeAdjust": ("int", 100),
  "SoundVolumeAdjustEngage": ("int", 100),
  # Diagnostic sink (not exposed in the panel)
  "CarrotException": ("str", ""),
}

_PARAM_TYPE_NAMES = {"bool": "BOOL", "int": "INT", "float": "FLOAT", "str": "STRING"}


def _params() -> Any:
  from webui.server.bridge.params_api import _params as _op_params
  return _op_params()


def is_carrot_key(key: str) -> bool:
  return bool(key) and key in CARROT_TUNING_DEFAULTS


def carrot_keys() -> list[str]:
  return sorted(CARROT_TUNING_DEFAULTS.keys())


def _param_type_name(key: str) -> str:
  return _PARAM_TYPE_NAMES[CARROT_TUNING_DEFAULTS[key][0]]


def _serialize(key: str, value: Any) -> str:
  kind = CARROT_TUNING_DEFAULTS[key][0]
  if kind == "bool":
    return "1" if value else "0"
  return "" if value is None else str(value)


def carrot_value_str(key: str) -> str | None:
  """Read one tuning key; falls back to the compiled-in default when unset."""
  if not is_carrot_key(key):
    return None
  try:
    p = _params()
    try:
      value = p.get(key, return_default=True)
    except TypeError:
      value = p.get(key)
    if value is None:
      value = CARROT_TUNING_DEFAULTS[key][1]
  except Exception:
    value = CARROT_TUNING_DEFAULTS[key][1]
  return _serialize(key, value)


def carrot_get(key: str) -> dict[str, Any]:
  if not is_carrot_key(key):
    return {"ok": False, "error": f"unknown carrot tuning param: {key}"}
  return {
    "ok": True,
    "key": key,
    "value": carrot_value_str(key),
    "type": _param_type_name(key),
    "locked": False,
  }


def carrot_put(key: str, value: str) -> dict[str, Any]:
  if not is_carrot_key(key):
    return {"ok": False, "error": f"unknown carrot tuning param: {key}"}
  kind = CARROT_TUNING_DEFAULTS[key][0]
  try:
    if kind == "bool":
      coerced = value in ("1", "true", "True", True, 1)
    elif kind == "float":
      coerced = float(value)
    elif kind == "int":
      coerced = int(float(value)) if value not in (None, "") else CARROT_TUNING_DEFAULTS[key][1]
    else:
      coerced = str(value)
  except (TypeError, ValueError):
    return {"ok": False, "error": f"invalid value for {key}: {value!r}"}
  try:
    p = _params()
    if kind == "bool":
      p.put_bool(key, bool(coerced), block=True)
    else:
      # Params stores values as strings; int/float round-trip via put().
      p.put(key, str(coerced), block=True)
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
  return {"ok": True, "key": key, "value": carrot_value_str(key)}


def carrot_reset(key: str) -> dict[str, Any]:
  """Restore one tuning key to its compiled-in default (remove + default read)."""
  if not is_carrot_key(key):
    return {"ok": False, "error": f"unknown carrot tuning param: {key}"}
  try:
    _params().remove(key)
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
  return {"ok": True, "key": key, "value": carrot_value_str(key)}


def carrot_reset_all() -> dict[str, Any]:
  """Restore every tuning key to its compiled-in default."""
  count = 0
  errors: list[str] = []
  try:
    p = _params()
  except Exception as exc:
    return {"ok": False, "action": "carrot_tuning_reset", "count": 0, "errors": [str(exc)]}
  for key in CARROT_TUNING_DEFAULTS:
    try:
      p.remove(key)
      count += 1
    except Exception as exc:
      errors.append(f"{key}: {exc}")
  return {"ok": not errors, "action": "carrot_tuning_reset", "count": count, "errors": errors}
