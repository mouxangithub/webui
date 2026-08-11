"""Declarative settings panels mirroring sunnypilot BIG UI (15 panels)."""

from __future__ import annotations

from typing import Any

# Widget types: bool, int, choice, readonly, action, section, html, subpanel_ref

PANELS: list[dict[str, Any]] = [
  {
    "id": "device",
    "title": "Device",
    "custom": "device",
    "widgets": [
      {"type": "readonly", "param": "DongleId", "label": "Dongle ID"},
      {"type": "readonly", "param": "HardwareSerial", "label": "Serial"},
      {"type": "action", "action": "pair_device", "label": "Pair Device", "button": "PAIR",
       "desc": "Pair your device with comma connect (connect.comma.ai) and claim your comma prime offer."},
      {"type": "action", "action": "reset_calibration", "label": "Reset Calibration", "button": "RESET",
       "desc": "sunnypilot requires the device to be mounted within 4° left or right and within 5° up or 9° down.",
       "offroad_only": True, "dynamic_desc": "calibration"},
      {"type": "custom", "custom": "device_language"},
      {"type": "choice", "param": "DeviceBootMode", "label": "Wake Up Behavior",
       "options": ["Default", "Offroad"],
       "desc": "Controls state of the device after boot/sleep.\n\nDefault: Device will boot/wake-up normally & will be ready to engage.\nOffroad: Device will be in Always Offroad mode after boot/wake-up."},
      {"type": "option", "param": "MaxTimeOffroad", "label": "Max Time Offroad",
       "desc": "Device will automatically shutdown after set time once the engine is turned off.\n(30h is the default)",
       "min": 0, "max": 11, "step": 1,
       "value_map": {"0": 0, "1": 5, "2": 10, "3": 15, "4": 30, "5": 60, "6": 120, "7": 180, "8": 300, "9": 600, "10": 1440, "11": 1800}},
      {"type": "dual_button",
       "left": {"label": "Quiet Mode", "param": "QuietMode", "toggle": True},
       "right": {"label": "Driver Camera Preview", "custom": "driver_camera", "offroad_only": True}},
      {"type": "dual_button",
       "left": {"label": "Regulatory", "action": "open_regulatory", "offroad_only": True},
       "right": {"label": "Training Guide", "action": "open_training", "offroad_only": True}},
      {"type": "dual_button",
       "left": {"label": "Onroad Uploads", "param": "OnroadUploads", "toggle": True},
       "right": {"label": "Reset Settings", "action": "reset_all_params", "offroad_only": True, "confirm_twice": True}},
      {"type": "custom", "custom": "always_offroad"},
      {"type": "dual_button",
       "left": {"label": "Reboot", "action": "reboot"},
       "right": {"label": "Power Off", "action": "shutdown", "offroad_only": True}},
    ],
  },
  {
    "id": "network",
    "title": "Network",
    "custom": "network",
    "widgets": [
      {"type": "bool", "param": "GsmRoaming", "label": "Enable Roaming"},
      {"type": "readonly", "param": "GsmApn", "label": "APN"},
      {"type": "choice", "param": "GsmMetered", "label": "Cellular Metered",
       "options": ["Unknown", "Yes", "No"]},
    ],
  },
  {
    "id": "sunnylink",
    "title": "sunnylink",
    "custom": "sunnylink",
    "widgets": [
      {"type": "bool", "param": "SunnylinkEnabled", "label": "Enable sunnylink"},
      {"type": "readonly", "param": "SunnylinkDongleId", "label": "sunnylink Dongle ID"},
      {"type": "bool", "param": "EnableSunnylinkUploader", "label": "Enable Uploader"},
      {"type": "readonly", "param": "LastSunnylinkPingTime", "label": "Last Ping"},
      {"type": "action", "action": "sunnylink_backup", "label": "Create Backup", "button": "BACKUP"},
      {"type": "action", "action": "sunnylink_restore", "label": "Restore Latest", "button": "RESTORE",
       "confirm": "Restore latest backup?"},
    ],
  },
  {
    "id": "toggles",
    "title": "Toggles",
    "widgets": [
      {"type": "bool", "param": "OpenpilotEnabledToggle", "label": "Enable sunnypilot", "needs_cycle": True},
      {"type": "bool", "param": "ExperimentalMode", "label": "Experimental Mode", "confirm_experimental": True},
      {"type": "bool", "param": "DisengageOnAccelerator", "label": "Disengage on Accelerator Pedal"},
      {"type": "choice", "param": "LongitudinalPersonality", "label": "Driving Personality",
       "options": ["Aggressive", "Standard", "Relaxed"]},
      {"type": "bool", "param": "IsLdwEnabled", "label": "Enable Lane Departure Warnings"},
      {"type": "bool", "param": "AlwaysOnDM", "label": "Always-On Driver Monitoring"},
      {"type": "choice", "param": "DistractionDetectionLevel", "label": "Distraction Detection Level",
       "options": ["Strict", "Moderate", "Lenient"], "visible_if": {"param": "AlwaysOnDM", "eq": "1"}},
      {"type": "bool", "param": "RecordFront", "label": "Record Driver Camera", "needs_cycle": True},
      {"type": "bool", "param": "RecordAudio", "label": "Record Microphone Audio", "needs_cycle": True},
      {"type": "bool", "param": "IsMetric", "label": "Use Metric System"},
    ],
  },
  {
    "id": "software",
    "title": "Software",
    "custom": "software",
    "widgets": [
      {"type": "readonly", "param": "UpdaterCurrentDescription", "label": "Current Version"},
      {"type": "readonly", "param": "GitBranch", "label": "Git Branch"},
      {"type": "readonly", "param": "UpdaterTargetBranch", "label": "Target Branch"},
      {"type": "bool", "param": "DisableUpdates", "label": "Disable Updates"},
      {"type": "action", "action": "updater_check", "label": "Check for Update", "button": "CHECK", "offroad_only": True},
      {"type": "action", "action": "updater_download", "label": "Download Update", "button": "DOWNLOAD", "offroad_only": True},
      {"type": "action", "action": "updater_install", "label": "Install Update", "button": "INSTALL", "offroad_only": True},
      {"type": "action", "action": "uninstall", "label": "Uninstall", "button": "UNINSTALL",
       "confirm": "Are you sure you want to uninstall?", "offroad_only": True},
    ],
  },
  {
    "id": "models",
    "title": "Models",
    "custom": "models",
    "widgets": [
      {"type": "readonly", "param": "ModelManager_ActiveBundle", "label": "Active Bundle"},
      {"type": "readonly", "param": "ModelManager_LastSyncTime", "label": "Last Sync"},
      {"type": "action", "action": "models_sync", "label": "Sync Models", "button": "SYNC"},
      {"type": "action", "action": "models_clear_cache", "label": "Clear Cache", "button": "CLEAR",
       "confirm": "Clear model cache?"},
      {"type": "bool", "param": "LagdToggle", "label": "Lagd Toggle"},
      {"type": "int", "param": "LagdToggleDelay", "label": "Lagd Delay", "min": 0, "max": 500, "step": 10},
      {"type": "int", "param": "CameraOffset", "label": "Camera Offset", "min": -50, "max": 50, "step": 1},
      {"type": "bool", "param": "LaneTurnDesire", "label": "Lane Turn Desire"},
      {"type": "int", "param": "LaneTurnValue", "label": "Lane Turn Value", "min": 0, "max": 100, "step": 1},
    ],
  },
  {
    "id": "steering",
    "title": "Steering",
    "widgets": [
      {"type": "bool", "param": "Mads", "label": "Modular Assistive Driving System (MADS)"},
      {"type": "subpanel", "target": "steering__mads", "label": "Customize MADS", "button": "CUSTOMIZE"},
      {"type": "subpanel", "target": "steering__lane_change", "label": "Customize Lane Change", "button": "CUSTOMIZE"},
      {"type": "bool", "param": "BlinkerPauseLateralControl", "label": "Pause Lateral Control with Blinker"},
      {"type": "int", "param": "BlinkerMinLateralControlSpeed", "label": "Minimum Speed to Pause", "min": 0, "max": 255, "step": 5},
      {"type": "int", "param": "BlinkerLateralReengageDelay", "label": "Post-Blinker Delay", "min": 0, "max": 10, "step": 1},
      {"type": "bool", "param": "EnforceTorqueControl", "label": "Enforce Torque Lateral Control"},
      {"type": "subpanel", "target": "steering__torque", "label": "Customize Torque Params", "button": "CUSTOMIZE"},
      {"type": "bool", "param": "NeuralNetworkLateralControl", "label": "Neural Network Lateral Control (NNLC)"},
    ],
  },
  {
    "id": "cruise",
    "title": "Cruise",
    "widgets": [
      {"type": "bool", "param": "IntelligentCruiseButtonManagement", "label": "ICBM (Alpha)"},
      {"type": "bool", "param": "DynamicExperimentalControl", "label": "Dynamic Experimental Control"},
      {"type": "bool", "param": "SmartCruiseControlVision", "label": "SCC Vision"},
      {"type": "bool", "param": "SmartCruiseControlMap", "label": "SCC Map"},
      {"type": "bool", "param": "CustomAccIncrementsEnabled", "label": "Custom ACC Increments"},
      {"type": "int", "param": "CustomAccShortPressIncrement", "label": "Short Press Increment", "min": 1, "max": 10, "step": 1},
      {"type": "int", "param": "CustomAccLongPressIncrement", "label": "Long Press Increment", "min": 1, "max": 3, "step": 1},
      {"type": "subpanel", "target": "cruise__sla", "label": "Speed Limit", "button": "CUSTOMIZE"},
    ],
  },
  {
    "id": "visuals",
    "title": "Visuals",
    "widgets": [
      {"type": "bool", "param": "BlindSpot", "label": "Blind Spot Warnings"},
      {"type": "bool", "param": "TorqueBar", "label": "Steering Arc"},
      {"type": "bool", "param": "RainbowMode", "label": "Tesla Rainbow Mode"},
      {"type": "bool", "param": "StandstillTimer", "label": "Standstill Timer"},
      {"type": "bool", "param": "RoadNameToggle", "label": "Display Road Name"},
      {"type": "bool", "param": "GreenLightAlert", "label": "Green Light Alert"},
      {"type": "bool", "param": "LeadDepartAlert", "label": "Lead Departure Alert"},
      {"type": "bool", "param": "TrueVEgoUI", "label": "True Speed Display"},
      {"type": "bool", "param": "HideVEgoUI", "label": "Hide Speedometer"},
      {"type": "bool", "param": "ShowTurnSignals", "label": "Display Turn Signals"},
      {"type": "bool", "param": "RocketFuel", "label": "Acceleration Bar"},
      {"type": "choice", "param": "ChevronInfo", "label": "Chevron Metrics",
       "options": ["Off", "Distance", "Speed", "Time", "All"]},
      {"type": "choice", "param": "DevUIInfo", "label": "Developer UI",
       "options": ["Off", "Bottom", "Right", "Right & Bottom"]},
    ],
  },
  {
    "id": "display",
    "title": "Display",
    "widgets": [
      {"type": "int", "param": "OnroadScreenOffBrightness", "label": "Onroad Brightness", "min": 0, "max": 22, "step": 1},
      {"type": "int", "param": "OnroadScreenOffTimer", "label": "Onroad Brightness Delay", "min": 0, "max": 15, "step": 1},
      {"type": "int", "param": "InteractivityTimeout", "label": "Interactivity Timeout", "min": 0, "max": 120, "step": 10},
      {"type": "bool", "param": "ScreenSaverEnabled", "label": "Screen Saver"},
      {"type": "int", "param": "ScreenSaverTimeout", "label": "Screen Saver Duration", "min": 60, "max": 600, "step": 60},
    ],
  },
  {
    "id": "osm",
    "title": "OSM",
    "custom": "osm",
    "widgets": [
      {"type": "readonly", "param": "MapdVersion", "label": "Mapd Version"},
      {"type": "readonly", "param": "OsmLocationTitle", "label": "Location"},
      {"type": "readonly", "param": "OsmDownloadedDate", "label": "Downloaded"},
      {"type": "bool", "param": "OsmLocal", "label": "Use Local OSM DB"},
      {"type": "action", "action": "osm_check_updates", "label": "Check Map Updates", "button": "CHECK"},
    ],
  },
  {
    "id": "trips",
    "title": "Trips",
    "custom": "trips",
    "widgets": [
      {"type": "readonly", "param": "LocalDriveStats", "label": "Drive Statistics"},
    ],
  },
  {
    "id": "vehicle",
    "title": "Vehicle",
    "custom": "vehicle",
    "widgets": [
      {"type": "bool", "param": "ToyotaEnforceStockLongitudinal", "label": "Toyota Stock Longitudinal"},
      {"type": "bool", "param": "ToyotaStopAndGoHack", "label": "Toyota Stop and Go Hack"},
      {"type": "bool", "param": "TeslaCoopSteering", "label": "Tesla Coop Steering"},
      {"type": "bool", "param": "TeslaMadsScreenButton", "label": "Tesla MADS Screen Button"},
      {"type": "bool", "param": "HyundaiLongitudinalTuning", "label": "Hyundai Longitudinal Tuning"},
      {"type": "bool", "param": "SubaruStopAndGo", "label": "Subaru Stop and Go"},
      {"type": "bool", "param": "SubaruStopAndGoManualParkingBrake", "label": "Subaru SNG Manual PB"},
    ],
  },
  {
    "id": "firehose",
    "title": "Firehose",
    "custom": "firehose",
    "widgets": [],
  },
  {
    "id": "developer",
    "title": "Developer",
    "widgets": [
      {"type": "bool", "param": "AdbEnabled", "label": "Enable ADB", "offroad_only": True},
      {"type": "bool", "param": "SshEnabled", "label": "Enable SSH"},
      {"type": "bool", "param": "JoystickDebugMode", "label": "Joystick Debug Mode", "offroad_only": True},
      {"type": "bool", "param": "LongitudinalManeuverMode", "label": "Longitudinal Maneuver Mode"},
      {"type": "bool", "param": "LateralManeuverMode", "label": "Lateral Maneuver Mode"},
      {"type": "bool", "param": "AlphaLongitudinalEnabled", "label": "sunnypilot Longitudinal (Alpha)", "needs_cycle": True},
      {"type": "bool", "param": "ShowDebugInfo", "label": "UI Debug Mode"},
      {"type": "bool", "param": "ShowAdvancedControls", "label": "Show Advanced Controls"},
      {"type": "bool", "param": "EnableGithubRunner", "label": "Enable GitHub Runner"},
      {"type": "bool", "param": "EnableCopyparty", "label": "Enable Copyparty"},
      {"type": "bool", "param": "QuickBootToggle", "label": "Quick Boot"},
      {"type": "custom", "custom": "ssh_keys", "label": "SSH Keys"},
    ],
  },
]

SUBPANELS: dict[str, dict[str, Any]] = {
  "steering__mads": {
    "id": "steering__mads",
    "title": "Customize MADS",
    "parent": "steering",
    "widgets": [
      {"type": "bool", "param": "MadsMainCruiseAllowed", "label": "Toggle with Main Cruise"},
      {"type": "bool", "param": "MadsUnifiedEngagementMode", "label": "Unified Engagement Mode (UEM)"},
      {"type": "choice", "param": "MadsSteeringMode", "label": "Steering Mode on Brake Pedal",
       "options": ["Remain Active", "Pause", "Disengage"]},
    ],
  },
  "steering__lane_change": {
    "id": "steering__lane_change",
    "title": "Customize Lane Change",
    "parent": "steering",
    "widgets": [
      {"type": "int", "param": "AutoLaneChangeTimer", "label": "Auto Lane Change Timer", "min": 0, "max": 30, "step": 1},
      {"type": "int", "param": "AutoLaneChangeBsmDelay", "label": "BSM Delay", "min": 0, "max": 10, "step": 1},
    ],
  },
  "steering__torque": {
    "id": "steering__torque",
    "title": "Customize Torque Params",
    "parent": "steering",
    "widgets": [
      {"type": "bool", "param": "LiveTorqueParamsToggle", "label": "Live Torque Params"},
      {"type": "bool", "param": "CustomTorqueParams", "label": "Custom Torque Params"},
      {"type": "bool", "param": "LateralJerkTorqueController", "label": "Lateral Jerk Torque Controller"},
    ],
  },
  "cruise__sla": {
    "id": "cruise__sla",
    "title": "Speed Limit",
    "parent": "cruise",
    "widgets": [
      {"type": "choice", "param": "SpeedLimitMode", "label": "Speed Limit Mode",
       "options": ["Off", "Warning", "Active"]},
      {"type": "choice", "param": "SpeedLimitOffsetType", "label": "Offset Type",
       "options": ["Fixed", "Percentage"]},
      {"type": "int", "param": "SpeedLimitValueOffset", "label": "Value Offset", "min": -30, "max": 30, "step": 1},
      {"type": "choice", "param": "SpeedLimitPolicy", "label": "Policy",
       "options": ["Car", "Map", "Hybrid"]},
    ],
  },
}


def panel_ids() -> list[str]:
  return [p["id"] for p in PANELS]


def get_panel(panel_id: str) -> dict[str, Any] | None:
  if panel_id in SUBPANELS:
    return SUBPANELS[panel_id]
  for p in PANELS:
    if p["id"] == panel_id:
      return p
  return None


def panel_schema() -> dict[str, Any]:
  from webui.server.bridge.design_tokens import PANEL_ICONS, tokens_payload
  panels_out = []
  for p in PANELS:
        entry = {**p, "icon": PANEL_ICONS.get(p["id"], "")}
        panels_out.append(entry)
  return {"ok": True, "panels": panels_out, "subpanels": list(SUBPANELS.keys()), **tokens_payload()}
