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
       "right": {"label": "Power Off", "action": "shutdown", "offroad_only": True, "hide_when_onroad": True}},
    ],
  },
  {
    "id": "network",
    "title": "Network",
    "custom": "network",
    "widgets": [
      {"type": "subpanel", "target": "network__advanced", "label": "Advanced Network", "button": "ADVANCED"},
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
    ],
  },
  {
    "id": "toggles",
    "title": "Toggles",
    "widgets": [
      {"type": "bool", "param": "OpenpilotEnabledToggle", "label": "Enable sunnypilot", "needs_cycle": True},
      {"type": "bool", "param": "ExperimentalMode", "label": "Experimental Mode", "confirm_experimental": True},
      {"type": "bool", "param": "DisengageOnAccelerator", "label": "Disengage on Accelerator Pedal"},
      {"type": "multiple_button", "param": "LongitudinalPersonality", "label": "Driving Personality",
       "buttons": ["Aggressive", "Standard", "Relaxed"]},
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
      {"type": "bool", "param": "LagdToggle", "label": "Live Learning Steer Delay"},
      {"type": "option", "param": "LagdToggleDelay", "label": "Adjust Software Delay",
       "min": 5, "max": 50, "step": 1, "label_format": "lagd_delay",
       "visible_if": {"param": "LagdToggle", "eq": "0"},
       "advanced_if": {"param": "ShowAdvancedControls", "eq": "1"}},
      {"type": "option", "param": "CameraOffset", "label": "Adjust Camera Offset",
       "min": -35, "max": 35, "step": 1, "label_format": "camera_offset"},
      {"type": "bool", "param": "LaneTurnDesire", "label": "Use Lane Turn Desires"},
      {"type": "option", "param": "LaneTurnValue", "label": "Adjust Lane Turn Speed",
       "min": 500, "max": 2000, "step": 100, "label_format": "lane_turn_speed",
       "visible_if": {"param": "LaneTurnDesire", "eq": "1"},
       "advanced_if": {"param": "ShowAdvancedControls", "eq": "1"}},
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
      {"type": "multiple_button", "param": "ChevronInfo", "label": "Chevron Metrics",
       "buttons": ["Off", "Distance", "Speed", "Time", "All"]},
      {"type": "multiple_button", "param": "DevUIInfo", "label": "Developer UI",
       "buttons": ["Off", "Bottom", "Right", "Right & Bottom"]},
    ],
  },
  {
    "id": "display",
    "title": "Display",
    "widgets": [
      {"type": "option", "param": "OnroadScreenOffBrightness", "label": "Onroad Brightness",
       "min": 0, "max": 22, "step": 1, "label_format": "onroad_brightness"},
      {"type": "option", "param": "OnroadScreenOffTimer", "label": "Onroad Brightness Delay",
       "min": 0, "max": 15, "step": 1, "label_format": "onroad_brightness_timer",
       "value_map": {"0": 3, "1": 5, "2": 7, "3": 10, "4": 15, "5": 30,
                     "6": 60, "7": 120, "8": 180, "9": 240, "10": 300, "11": 360,
                     "12": 420, "13": 480, "14": 540, "15": 600}},
      {"type": "option", "param": "InteractivityTimeout", "label": "Interactivity Timeout",
       "min": 0, "max": 120, "step": 10, "label_format": "interactivity_timeout",
       "desc": "Apply a custom timeout for settings UI."},
      {"type": "bool", "param": "ScreenSaverEnabled", "label": "Screen Saver",
       "desc": "Show a screen saver when the device is offroad and idle."},
      {"type": "option", "param": "ScreenSaverTimeout", "label": "Screen Saver Duration",
       "min": 60, "max": 600, "step": 60, "label_format": "screensaver_timeout",
       "visible_if": {"param": "ScreenSaverEnabled", "eq": "1"}},
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
    "widgets": [],
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
      {"type": "bool", "param": "ShowAdvancedControls", "label": "Show Advanced Controls",
       "desc": "Toggle visibility of advanced sunnypilot controls."},
      {"type": "bool", "param": "EnableGithubRunner", "label": "GitHub Runner Service",
       "visible_if": {"param": "ShowAdvancedControls", "eq": "1"}},
      {"type": "bool", "param": "EnableCopyparty", "label": "copyparty Service",
       "visible_if": {"param": "ShowAdvancedControls", "eq": "1"}},
      {"type": "bool", "param": "QuickBootToggle", "label": "Quickboot Mode",
       "visible_if": {"param": "ShowAdvancedControls", "eq": "1"}},
      {"type": "action", "action": "developer_error_log", "label": "Error Log", "button": "VIEW",
       "visible_if": {"param": "ShowAdvancedControls", "eq": "1"}},
      {"type": "bool", "param": "AdbEnabled", "label": "Enable ADB", "offroad_only": True},
      {"type": "bool", "param": "SshEnabled", "label": "Enable SSH"},
      {"type": "bool", "param": "JoystickDebugMode", "label": "Joystick Debug Mode", "offroad_only": True},
      {"type": "bool", "param": "LongitudinalManeuverMode", "label": "Longitudinal Maneuver Mode",
       "visible_if": {"param": "ShowAdvancedControls", "eq": "1"}},
      {"type": "bool", "param": "LateralManeuverMode", "label": "Lateral Maneuver Mode",
       "visible_if": {"param": "ShowAdvancedControls", "eq": "1"}},
      {"type": "bool", "param": "AlphaLongitudinalEnabled", "label": "sunnypilot Longitudinal (Alpha)",
       "needs_cycle": True, "visible_if": {"param": "ShowAdvancedControls", "eq": "1"}},
      {"type": "bool", "param": "ShowDebugInfo", "label": "UI Debug Mode"},
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
      {"type": "multiple_button", "param": "MadsSteeringMode", "label": "Steering Mode on Brake Pedal",
       "buttons": ["Remain Active", "Pause", "Disengage"]},
    ],
  },
  "steering__lane_change": {
    "id": "steering__lane_change",
    "title": "Customize Lane Change",
    "parent": "steering",
    "widgets": [
      {"type": "option", "param": "AutoLaneChangeTimer", "label": "Auto Lane Change by Blinker",
       "min": -1, "max": 5, "step": 1, "label_format": "lane_change_timer",
       "desc": "Set a timer to delay the auto lane change operation when the blinker is used."},
      {"type": "bool", "param": "AutoLaneChangeBsmDelay", "label": "Auto Lane Change: Delay with Blind Spot",
       "desc": "Enable a delay timer for seamless lane changes when BSM detects an obstructing vehicle."},
    ],
  },
  "steering__torque": {
    "id": "steering__torque",
    "title": "Customize Torque Params",
    "parent": "steering",
    "widgets": [
      {"type": "bool", "param": "LateralJerkTorqueController", "label": "Lateral Jerk Torque Controller", "offroad_only": True},
      {"type": "action", "action": "torque_tune_version", "label": "Torque Control Tune Version", "button": "SELECT"},
      {"type": "bool", "param": "LiveTorqueParamsToggle", "label": "Self-Tune", "offroad_only": True},
      {"type": "bool", "param": "LiveTorqueParamsRelaxedToggle", "label": "Less Restrict Settings for Self-Tune (Beta)",
       "visible_if": {"param": "LiveTorqueParamsToggle", "eq": "1"}, "offroad_only": True},
      {"type": "bool", "param": "CustomTorqueParams", "label": "Enable Custom Tuning", "offroad_only": True},
      {"type": "bool", "param": "TorqueParamsOverrideEnabled", "label": "Manual Real-Time Tuning",
       "visible_if": {"param": "CustomTorqueParams", "eq": "1"}, "offroad_only": True},
      {"type": "option", "param": "TorqueParamsOverrideLatAccelFactor", "label": "Lateral Acceleration Factor",
       "min": 1, "max": 500, "step": 1, "label_format": "torque_lat_accel",
       "visible_if": {"param": "CustomTorqueParams", "eq": "1"}},
      {"type": "option", "param": "TorqueParamsOverrideFriction", "label": "Friction",
       "min": 1, "max": 100, "step": 1, "label_format": "torque_friction",
       "visible_if": {"param": "CustomTorqueParams", "eq": "1"}},
    ],
  },
  "cruise__sla": {
    "id": "cruise__sla",
    "title": "Speed Limit",
    "parent": "cruise",
    "widgets": [
      {"type": "multiple_button", "param": "SpeedLimitMode", "label": "Speed Limit",
       "buttons": ["Off", "Info", "Warning", "Assist"]},
      {"type": "subpanel", "target": "cruise__sla__policy", "label": "Customize Source", "button": "CUSTOMIZE"},
      {"type": "multiple_button", "param": "SpeedLimitOffsetType", "label": "Speed Limit Offset",
       "buttons": ["None", "Fixed", "%"]},
      {"type": "option", "param": "SpeedLimitValueOffset", "label": "Offset Value",
       "min": -30, "max": 30, "step": 1, "label_format": "speed_limit_offset",
       "visible_if": {"param": "SpeedLimitOffsetType", "ne": "0"}},
    ],
  },
  "cruise__sla__policy": {
    "id": "cruise__sla__policy",
    "title": "Speed Limit Source",
    "parent": "cruise__sla",
    "widgets": [
      {"type": "multiple_button", "param": "SpeedLimitPolicy", "label": "Speed Limit Source",
       "buttons": ["Car Only", "Map Only", "Car First", "Map First", "Combined"]},
    ],
  },
  "network__advanced": {
    "id": "network__advanced",
    "title": "Advanced Network",
    "parent": "network",
    "widgets": [
      {"type": "bool", "param": "GsmRoaming", "label": "Enable Roaming"},
      {"type": "action", "action": "network_set_apn", "label": "APN", "button": "SET"},
      {"type": "choice", "param": "GsmMetered", "label": "Cellular Metered",
       "options": ["Unknown", "Yes", "No"]},
      {"type": "bool", "param": "WifiMetered", "label": "Wi-Fi Metered"},
      {"type": "bool", "param": "WifiHotspotEnabled", "label": "Wi-Fi Hotspot"},
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
