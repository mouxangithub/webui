"""Per-brand vehicle settings widgets (mirrors SP BrandSettingsFactory)."""

from __future__ import annotations

from typing import Any

BRAND_WIDGETS: dict[str, list[dict[str, Any]]] = {
  "toyota": [
    {"type": "bool", "param": "ToyotaEnforceStockLongitudinal", "label": "Enforce Factory Longitudinal Control",
     "desc": "sunnypilot will not take over control of gas and brakes. Factory Toyota longitudinal control will be used.",
     "confirm_enable_rich": True, "needs_cycle": True},
    {"type": "bool", "param": "ToyotaStopAndGoHack", "label": "Stop and Go Hack (Alpha)",
     "desc": "sunnypilot will allow some Toyota/Lexus cars to auto resume during stop and go traffic.",
     "confirm_enable_rich": True, "needs_cycle": True},
  ],
  "tesla": [
    {"type": "bool", "param": "TeslaCoopSteering", "label": "Cooperative Steering (Beta)", "offroad_only": True},
    {"type": "multiple_button", "param": "TeslaMadsScreenButton", "label": "MADS Screen Activation",
     "buttons": ["Off", "3-Finger", "4-Finger", "5-Finger"], "offroad_only": True},
  ],
  "hyundai": [
    {"type": "bool", "param": "HyundaiLongitudinalTuning", "label": "Hyundai Longitudinal Tuning"},
  ],
  "subaru": [
    {"type": "bool", "param": "SubaruStopAndGo", "label": "Stop and Go (Beta)", "needs_cycle": True},
    {"type": "bool", "param": "SubaruStopAndGoManualParkingBrake", "label": "Stop and Go Manual Parking Brake",
     "visible_if": {"param": "SubaruStopAndGo", "eq": "1"}, "needs_cycle": True},
  ],
  "honda": [
    {"type": "bool", "param": "HondaEnableBsmPolling", "label": "Enable BSM Polling"},
  ],
  "ford": [
    {"type": "bool", "param": "FordLaneChangeCanfd", "label": "Lane Change CAN-FD"},
  ],
  "gm": [
    {"type": "bool", "param": "GmStopAndGo", "label": "GM Stop and Go"},
  ],
  "chrysler": [
    {"type": "bool", "param": "ChryslerStopAndGo", "label": "Chrysler Stop and Go"},
  ],
  "nissan": [
    {"type": "bool", "param": "NissanStopAndGo", "label": "Nissan Stop and Go"},
  ],
  "mazda": [
    {"type": "bool", "param": "MazdaStopAndGo", "label": "Mazda Stop and Go"},
  ],
  "volkswagen": [
    {"type": "bool", "param": "VolkswagenStockLong", "label": "VW Stock Longitudinal"},
  ],
  "rivian": [],
  "psa": [],
  "body": [],
}


def widgets_for_brand(brand: str) -> list[dict[str, Any]]:
  return [dict(w) for w in BRAND_WIDGETS.get((brand or "").lower(), [])]
