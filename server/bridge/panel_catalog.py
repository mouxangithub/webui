"""Declarative settings panels mirroring sunnypilot BIG UI (15 panels)."""

from __future__ import annotations

from typing import Any

# Carrot tuning params that stay registered (params_keys.h + carrot/config.py +
# carrot_tuning_api.py) but are deliberately NOT rendered as UI widgets, because no
# code in this tree reads them. Hiding them keeps the settings page honest; keeping
# them registered keeps profile/backup/restore working and lets a future port
# re-expose them without a migration.
#
# Grouped by why they are inert:
#   - the subsystem they configure was never ported (lateral control, ONNX lane
#     lines, cluster HUD, path renderer, YouTube/sound, radar tracks)
#   - the behaviour is already owned by a sunnypilot module with its own params
#     (torque override, lagd, camera offset, longitudinal MPC tuning, lane change)
#   - CarrotPilot has no equivalent at all
CARROT_TUNING_UNAVAILABLE: frozenset[str] = frozenset({
  # Cluster Map / Cluster HUD: exposed as the first step of porting CarrotPilot's
  # external-cluster subsystem. ClusterNaviMap* is already read by carrot_navi's
  # ClusterNaviMapParamReader; ClusterHud* drive the not-yet-ported renderer but are
  # deliberately un-hidden so the settings surface is complete and the values persist.
  "CruiseMaxVals6",
  "CruiseMaxVals5",
  "CruiseMaxVals4",
  "CruiseMaxVals3",
  "CruiseMaxVals2",
  "CruiseMaxVals1",
  "CruiseMaxVals0",
  "AlwaysLateral",
  "AutoTurnInNotRoadEdge",
  "BsdDelayTime",
  "CameraYawTrimDeg",
  "CarrotYouTubeLive",
  "CarrotYouTubeQuality",
  "CarrotYouTubeTimestamp",
  "ContinuousLaneChange",
  "CustomSR",
  "HotspotOnBoot",
  "LaneChangeDelay",
  "LaneChangeNeedTorque",
  "LaneLineCheck",
  "LatMpcAccelCost",
  "LatMpcInputOffset",
  "LatMpcJerkCost",
  "LatMpcMotionCost",
  "LatMpcPathCost",
  "LatMpcSteeringRateCost",
  "LatSmoothSec",
  "LateralTorqueAccelFactor",
  "LateralTorqueCustom",
  "LateralTorqueFriction",
  "LateralTorqueKd",
  "LateralTorqueKf",
  "LateralTorqueKiV",
  "LateralTorqueKpV",
  "LeadAccelResponseTF1",
  "LeadAccelResponseTF2",
  "LeadAccelResponseTF3",
  "LeadAccelResponseTF4",
  "LongActuatorDelay",
  "LongTuningKf",
  "LongTuningKiV",
  "LongTuningKpV",
  "MapboxStyle",
  "MuteDoor",
  "MuteSeatbelt",
  "NewLaneWidthDiff",
  "OnnxBsdIntervalMs",
  "OnnxBsdSmoothingMs",
  "OnnxBsdThreshold",
  "OnnxLaneIntervalMs",
  "OnnxLaneThreshold",
  "PathOffset",
  "RecordRoadCam",
  "ShareData",
  "ShowCameraWithCluster",
  "ShowCustomBrightness",
  "ShowDateTime",
  "ShowDebugUI",
  "ShowDeviceState",
  "ShowLaneInfo",
  "ShowModelView",
  "ShowPathColor",
  "ShowPathColorCruiseOff",
  "ShowPathColorLane",
  "ShowPathEnd",
  "ShowPathMode",
  "ShowPathModeLane",
  "ShowPlotMode",
  "ShowRadarInfo",
  "ShowRouteInfo",
  "ShowTpms",
  "SideRadarMinDist",
  "SoftwareMenu",
  "SoundLanguageSetting",
  "SteerActuatorDelay",
  "SteerRatioRate",
  "StockBlinkerCtrl",
  "UseLaneLineCurveSpeed",
  "UseWideCamera",
 })


# Widget types: bool, int, choice, readonly, action, section, html, subpanel_ref

PANELS: list[dict[str, Any]] = [
  {
    "id": "device",
    "title": "Device",
    "custom": "device",
    "widgets": [
      {"type": "readonly", "param": "DongleId", "label": "Dongle ID"},
      {"type": "separator"},
      {"type": "readonly", "param": "HardwareSerial", "label": "Serial"},
      {"type": "separator"},
      {"type": "action", "action": "pair_device", "label": "Pair Device", "button": "PAIR",
       "desc": "Pair your device with comma connect (connect.comma.ai) and claim your comma prime offer.",
       "hide_when_paired": True},
      {"type": "separator"},
      {"type": "action", "action": "reset_calibration", "label": "Reset Calibration", "button": "RESET",
       "desc": "sunnypilot requires the device to be mounted within 4° left or right and within 5° up or 9° down.",
       "dynamic_desc": "calibration",
       "confirm": "Are you sure you want to reset calibration?"},
      {"type": "separator"},
      {"type": "custom", "custom": "device_language"},
      {"type": "separator"},
      {"type": "custom", "custom": "chestnut_status"},
      {"type": "multiple_button", "param": "DeviceBootMode", "label": "Wake Up Behavior",
       "buttons": ["Default", "Offroad"], "layout": "inline",
       "desc": "Controls state of the device after boot/sleep.\n\nDefault: Device will boot/wake-up normally & will be ready to engage.\nOffroad: Device will be in Always Offroad mode after boot/wake-up."},
      {"type": "separator"},
      {"type": "option", "param": "MaxTimeOffroad", "label": "Max Time Offroad",
       "desc": "Device will automatically shutdown after set time once the engine is turned off.\n(30h is the default)",
       "min": 0, "max": 11, "step": 1, "layout": "inline",
       "value_map": {"0": 0, "1": 5, "2": 10, "3": 15, "4": 30, "5": 60, "6": 120, "7": 180, "8": 300, "9": 600, "10": 1440, "11": 1800}},
      {"type": "dual_button",
       "left": {"label": "Quiet Mode", "param": "QuietMode", "toggle": True},
       "right": {"label": "Driver Camera Preview", "action": "driver_view", "offroad_only": True,
                 "desc": "Enable driver camera preview in Web UI while offroad. Turn off before driving."}},
      {"type": "dual_button",
       "left": {"label": "", "hidden": True},
       "right": {"label": "Onroad Preview", "action": "onroad_preview", "offroad_only": True}},
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
    "id": "bluetooth",
    "title": "Bluetooth",
    "custom": "bluetooth",
    "icon": "icons/bluetooth.svg",
    "widgets": [],
  },
  {
    "id": "sunnylink",
    "title": "sunnylink",
    "custom": "sunnylink",
    "widgets": [],
  },
  {
    "id": "toggles",
    "title": "Toggles",
    "widgets": [
      {"type": "bool", "param": "OpenpilotEnabledToggle", "label": "Enable sunnypilot", "needs_cycle": True,
       "icon": "selfdrive/assets/icons/chffr_wheel.png",
       "desc": "Use the sunnypilot system for adaptive cruise control and lane keep driver assistance. Your attention is required at all times to use this feature."},
      {"type": "bool", "param": "ExperimentalMode", "label": "Experimental Mode", "confirm_experimental": True,
       "capability": "longitudinal",
       "icon": "selfdrive/assets/icons/experimental_white.png",
       "icon_active": "selfdrive/assets/icons/experimental.png"},
      {"type": "bool", "param": "DisengageOnAccelerator", "label": "Disengage on Accelerator Pedal",
       "icon": "selfdrive/assets/icons/disengage_on_accelerator.png",
       "desc": "When enabled, pressing the accelerator pedal will disengage sunnypilot."},
      {"type": "multiple_button", "param": "LongitudinalPersonality", "label": "Driving Personality",
       "layout": "stacked", "capability": "longitudinal",
       "icon": "selfdrive/assets/icons/speed_limit.png",
       "buttons": ["Aggressive", "Standard", "Relaxed"],
       "desc": "Standard is recommended. In aggressive mode, sunnypilot will follow lead cars closer and be more aggressive with the gas and brake. In relaxed mode sunnypilot will stay further away from lead cars. On supported cars, you can cycle through these personalities with your steering wheel distance button."},
      {"type": "bool", "param": "IsLdwEnabled", "label": "Enable Lane Departure Warnings",
       "icon": "selfdrive/assets/icons/warning.png",
       "desc": "Receive alerts to steer back into the lane when your vehicle drifts over a detected lane line without a turn signal activated while driving over 31 mph (50 km/h)."},
      {"type": "bool", "param": "DisableDM", "label": "Disable Driver Monitoring", "needs_cycle": True,
       "icon": "selfdrive/assets/icons/monitoring.png",
       "desc": "Disable driver monitoring (no cabin camera required). Similar to LITE mode."},
      {"type": "bool", "param": "AlwaysOnDM", "label": "Always-On Driver Monitoring",
       "icon": "selfdrive/assets/icons/monitoring.png",
       "hide_if": {"param": "DisableDM", "eq": "1"},
       "desc": "The driver monitoring system can be toggled on/off, but long-term activation is recommended"},
      {"type": "multiple_button", "param": "DistractionDetectionLevel", "label": "Distraction Detection Level",
       "layout": "stacked",
       "icon": "selfdrive/assets/icons/monitoring.png",
       "buttons": ["Strict", "Moderate", "Lenient"],
       "visible_if": {"param": "AlwaysOnDM", "eq": "1"},
       "hide_if": {"param": "DisableDM", "eq": "1"},
       "desc": "Set how sensitive the driver distraction detection should be. Strict: Very sensitive, warns on minor distractions. Moderate: Balanced between sensitivity and false positives. Lenient: Only alerts on clear distractions."},
      {"type": "bool", "param": "RecordFront", "label": "Record and Upload Driver Camera", "needs_cycle": True,
       "icon": "selfdrive/assets/icons/monitoring.png",
       "hide_if": {"param": "DisableDM", "eq": "1"},
       "desc": "Upload data from the driver facing camera and help improve the driver monitoring algorithm."},
      {"type": "bool", "param": "RecordAudio", "label": "Record and Upload Microphone Audio", "needs_cycle": True,
       "icon": "selfdrive/assets/icons/microphone.png",
       "desc": "Record and store microphone audio while driving. The audio will be included in the dashcam video in comma connect."},
      {"type": "bool", "param": "SpDevBeep", "label": "Beeper Feedback", "lite_only": True, "needs_cycle": True,
       "icon": "selfdrive/assets/icons/warning.png",
       "desc": "Use the GPIO beeper for engage/disengage sounds on Lite hardware without a speaker."},
      {"type": "bool", "param": "IsMetric", "label": "Use Metric System",
       "icon": "selfdrive/assets/icons/metric.png",
       "desc": "Display speed in km/h instead of mph."},
    ],
  },
  {
    "id": "software",
    "title": "Software",
    "custom": "software",
    "widgets": [
      {"type": "action", "action": "uninstall", "label": "Uninstall", "button": "UNINSTALL",
       "confirm": "Are you sure you want to uninstall?", "offroad_only": True},
      {"type": "custom", "custom": "webui_update"},
      {"type": "bool", "param": "DisableUpdates", "label": "Disable Updates",
       "visible_if": {"param": "ShowAdvancedControls", "eq": "1"}, "offroad_only": True},
    ],
  },
  {
    "id": "models",
    "title": "Models",
    "custom": "models",
    "widgets": [
      {"type": "action", "action": "models_sync", "label": "Refresh Model List", "button": "REFRESH"},
      {"type": "action", "action": "models_clear_cache", "label": "Clear Model Cache", "button": "CLEAR",
       "confirm": "This will delete ALL downloaded models from the cache except the currently active model. Are you sure?",
       "confirm_button": "Clear Cache"},
      {"type": "bool", "param": "LaneTurnDesire", "label": "Use Lane Turn Desires",
       "desc": "If you're driving at 20 mph (32 km/h) or below and have your blinker on, the car will plan a turn in that direction at the nearest drivable path. This prevents situations (like at red lights) where the car might plan the wrong turn direction."},
      {"type": "option", "param": "LaneTurnValue", "label": "Adjust Lane Turn Speed",
       "min": 500, "max": 2000, "step": 100, "label_format": "lane_turn_speed",
       "desc": "Set the maximum speed for lane turn desires. Default is 19 mph.",
       "visible_if": {"param": "LaneTurnDesire", "eq": "1"},
       "advanced_if": {"param": "ShowAdvancedControls", "eq": "1"}},
      {"type": "bool", "param": "LagdToggle", "label": "Live Learning Steer Delay",
       "desc": "Enable this for the car to learn and adapt its steering response time. Disable to use a fixed steering response time. Keeping this on provides the stock openpilot experience."},
      {"type": "option", "param": "LagdToggleDelay", "label": "Adjust Software Delay",
       "min": 5, "max": 50, "step": 1, "label_format": "lagd_delay",
       "desc": "Adjust the software delay when Live Learning Steer Delay is toggled off. The default software delay value is 0.2",
       "visible_if": {"param": "LagdToggle", "eq": "0"},
       "advanced_if": {"param": "ShowAdvancedControls", "eq": "1"}},
      {"type": "option", "param": "CameraOffset", "label": "Adjust Camera Offset",
       "min": -35, "max": 35, "step": 1, "label_format": "camera_offset",
       "desc": "Virtually shift camera's perspective to move model's center to Left(+ values) or Right (- values)",
       "visible_if": {"state": "custom_model_active"}},
    ],
  },
  {
    "id": "steering",
    "title": "Steering",
    "widgets": [
      {"type": "bool", "param": "Mads", "label": "Modular Assistive Driving System (MADS)", "offroad_only": True,
       "desc": "Enable the beloved MADS feature. Disable toggle to revert back to stock sunnypilot engagement/disengagement."},
      {"type": "subpanel", "target": "steering__mads", "label": "Customize MADS", "button": "CUSTOMIZE",
       "requires": {"param": "Mads", "eq": "1"}, "offroad_only": True},
      {"type": "separator"},
      {"type": "subpanel", "target": "steering__lane_change", "label": "Customize Lane Change", "button": "CUSTOMIZE"},
      {"type": "separator"},
      {"type": "bool", "param": "BlinkerPauseLateralControl", "label": "Pause Lateral Control with Blinker",
       "desc": "Pause lateral control with blinker when traveling below the desired speed selected."},
      {"type": "option", "param": "BlinkerMinLateralControlSpeed", "label": "Minimum Speed to Pause Lateral Control",
       "min": 0, "max": 255, "step": 5, "label_format": "blinker_min_speed", "layout": "stacked",
       "visible_if": {"param": "BlinkerPauseLateralControl", "eq": "1"}},
      {"type": "option", "param": "BlinkerLateralReengageDelay", "label": "Post-Blinker Delay",
       "min": 0, "max": 10, "step": 1, "label_format": "blinker_delay", "layout": "stacked",
       "desc": "Delay before lateral control resumes after the turn signal ends.",
       "visible_if": {"param": "BlinkerPauseLateralControl", "eq": "1"}},
      {"type": "separator"},
      {"type": "bool", "param": "EnforceTorqueControl", "label": "Enforce Torque Lateral Control",
       "offroad_only": True, "capability": "torque_allowed",
       "desc": "Enable this to enforce sunnypilot to steer with Torque lateral control."},
      {"type": "subpanel", "target": "steering__torque", "label": "Customize Torque Params", "button": "CUSTOMIZE",
       "requires": {"param": "EnforceTorqueControl", "eq": "1"}},
      {"type": "separator"},
      {"type": "bool", "param": "NeuralNetworkLateralControl", "label": "Neural Network Lateral Control (NNLC)",
       "offroad_only": True, "capability": "torque_allowed"},
    ],
  },
  {
    "id": "cruise",
    "title": "Cruise",
    "widgets": [
      {"type": "bool", "param": "IntelligentCruiseButtonManagement", "label": "Intelligent Cruise Button Management (ICBM) (Alpha)",
       "offroad_only": True, "dynamic_desc": "icbm",
       "desc": "When enabled, sunnypilot will attempt to manage the built-in cruise control buttons by emulating button presses for limited longitudinal control."},
      {"type": "bool", "param": "DynamicExperimentalControl", "label": "Enable Dynamic Experimental Control",
       "desc": "Let the model decide when to use sunnypilot ACC or sunnypilot End to End Longitudinal.",
       "capability": "longitudinal"},
      {"type": "bool", "param": "SmartCruiseControlVision", "label": "Smart Cruise Control - Vision",
       "desc": "Use vision path predictions to estimate the appropriate speed to drive through turns ahead.",
       "capability": "scc"},
      {"type": "bool", "param": "SmartCruiseControlMap", "label": "Smart Cruise Control - Map",
       "desc": "Use map data to estimate the appropriate speed to drive through turns ahead.",
       "capability": "scc"},
      {"type": "bool", "param": "CustomAccIncrementsEnabled", "label": "Custom ACC Speed Increments",
       "offroad_only": True, "dynamic_desc": "custom_acc",
       "desc": "Enable custom Short & Long press increments for cruise speed increase/decrease.",
       "capability": "custom_acc"},
      {"type": "int", "param": "CustomAccShortPressIncrement", "label": "Short Press Increment", "min": 1, "max": 10, "step": 1,
       "visible_if": {"param": "CustomAccIncrementsEnabled", "eq": "1"}, "capability": "custom_acc"},
      {"type": "option", "param": "CustomAccLongPressIncrement", "label": "Long Press Increment",
       "min": 1, "max": 3, "step": 1, "label_format": "acc_long_press",
       "value_map": {"1": 1, "2": 5, "3": 10},
       "visible_if": {"param": "CustomAccIncrementsEnabled", "eq": "1"}, "capability": "custom_acc"},
      {"type": "subpanel", "target": "cruise__sla", "label": "Speed Limit", "button": "CUSTOMIZE"},
      {"type": "subpanel", "target": "cruise__longitudinal_mpc_tuning", "label": "Longitudinal MPC Tuning", "button": "CUSTOMIZE",
       "capability": "longitudinal"},
    ],
  },
  {
    "id": "navigation",
    "title": "Navigation",
    "widgets": [{"type": "bool", "param": "AmapMapDataEnabled", "label": "Enable Amap Map Data", "offroad_only": True,
       "desc": "Use Amap (Gaode) online map data for speed limits and road names in China."},
      {"type": "bool", "param": "OsmMapDataEnabled", "label": "Enable OSM Map Data", "offroad_only": True,
       "desc": "Use offline OSM map data for speed limits and road names. Turn off to ignore the offline map entirely, which matters when navigation or Amap is the source you trust - the offline data can be years out of date."},{"type": "bool", "param": "CarrotAmapBlindSpotEnabled", "label": "Enable Amap Blind Spot Data", "offroad_only": True,
       "desc": "Parse blind-spot / LiDAR / extBlinker fields from the 7706 UDP stream."},{"type": "bool", "param": "CarrotEnabled", "label": "Enable Carrot Navigation", "offroad_only": True,
       "desc": "Use Carrot navigation data for map-based features."},{"type": "bool", "param": "CarrotNaviV2Enabled", "label": "Enable Carrot Navi v2 (7714)", "offroad_only": True,
       "visible_if": {"param": "CarrotEnabled", "eq": "1"},
       "desc": "Use the 7714 WebSocket v2 rich navigation stream (traffic, lanes, crossroad images)."},{"type": "custom", "custom": "amap_api_key", "label": "Amap API Key", "offroad_only": True,
       "desc": "API key for Amap services. Tap EDIT to enter or update the key."},{"type": "bool", "param": "AmapCurveSpeedEnabled", "label": "Amap Curve Speed", "offroad_only": True,
       "visible_if": {"param": "AmapMapDataEnabled", "eq": "1"},
       "desc": "Derive a curve speed from the Amap route shape. Advisory only; it never overrides the road speed limit."},{"type": "bool", "param": "AmapTrafficLightHintEnabled", "label": "Amap Traffic Light Hint", "offroad_only": True,
       "visible_if": {"param": "AmapMapDataEnabled", "eq": "1"},
       "desc": "Show how many traffic lights are on the route ahead. Display only; it never controls the car."},{"type": "separator"},{"type": "int", "param": "CarrotPanelOpacity", "label": "Carrot Nav Panel Opacity",
       "min": 10, "max": 100, "step": 5, "offroad_only": True,
       "desc": "Opacity of the onroad Carrot navigation panel, in percent. Default 100."},{"type": "select", "param": "CarrotPanelSide", "label": "Carrot Nav Panel Side",
       "options": [{"label": "Left", "value": 0}, {"label": "Right", "value": 1}],
       "default": 1, "offroad_only": True,
       "desc": "Position of the onroad Carrot navigation panel. Default: Right (next to speed display)."},{"type": "custom", "custom": "navigation_provider", "label": "Map Provider",
       "desc": "Current map data source used for speed limits and road names. Amap requires an API key to be set above."},{"type": "custom", "custom": "carrot_navi_debug", "label": "Carrot Navi Debug",
       "desc": "View the last navigation event summary handled by CarrotManager."},{"type": "separator"},{"type": "bool", "param": "CarrotAtcBlinkerEnabled", "label": "Carrot ATC Turn Signal",
       "visible_if": {"param": "CarrotEnabled", "eq": "1"},
       "desc": "Let the Carrot app's turn instruction act as a turn signal. This reaches the car's real turn signal, so it is off by default."},{"type": "bool", "param": "CarrotNavCruiseSpeedEnabled", "label": "Navigation Cruise Speed", "default": True,
       "visible_if": {"param": "CarrotEnabled", "eq": "1"},
       "desc": "Use navigation desired speed to limit cruise set speed."},{"type": "int", "param": "HapticFeedbackWhenSpeedCamera", "label": "Haptic Feedback (Speed Camera)", "default": 0,
       "visible_if": {"param": "CarrotEnabled", "eq": "1"},
       "desc": "Steering-wheel nudge when carrot decelerates for a speed camera. 0=off, 1/2 = lane-warning styles."}],
  },
  {
    "id": "carrot",
    "title": "Carrot",
    "widgets": [
      {"type": "bool", "param": "CarrotWebEnabled", "label": "Carrot Web Panel", "offroad_only": True,
       "desc": "Serve the carrot tuning page (/nav_params) and four-corner radar visualisation (/radar) on port 8088."},
      {"type": "separator"},
      {"type": "subpanel", "target": "navigation__carrot_tuning__start", "label": "Start / Engage",
       "desc": "How openpilot engages cruise and which steering wheel buttons control it.", "button": "CUSTOMIZE"},
      {"type": "separator"},
      {"type": "subpanel", "target": "navigation__carrot_tuning__cruise", "label": "Cruise & Following",
       "desc": "Following distance, longitudinal gains, acceleration limits and cruise behavior.", "button": "CUSTOMIZE"},
      {"type": "separator"},
      {"type": "subpanel", "target": "navigation__carrot_tuning__navi", "label": "Navigation",
       "desc": "Navigation-based speed control, speed cameras, road limits and speed bumps.", "button": "CUSTOMIZE"},
      {"type": "separator"},
      {"type": "subpanel", "target": "navigation__carrot_tuning__speed", "label": "Turns & Curves",
       "desc": "Automatic turn, fork / merge and curve speed control.", "button": "CUSTOMIZE"},
      {"type": "separator"},
      {"type": "subpanel", "target": "navigation__carrot_tuning__tuning", "label": "Lateral Tuning",
       "desc": "Steering geometry, MPC costs, torque tuning, lane change and blind spot.", "button": "CUSTOMIZE"},
      {"type": "separator"},
      {"type": "subpanel", "target": "navigation__carrot_tuning__display", "label": "Display & Sound",
       "desc": "Cluster HUD, on-screen overlays, sound, YouTube and map style.", "button": "CUSTOMIZE"},
      {"type": "separator"},
      {"type": "subpanel", "target": "navigation__carrot_tuning__vehicle", "label": "Vehicle",
       "desc": "Vehicle-specific overrides and convenience options.", "button": "CUSTOMIZE"},
      {"type": "separator"},
      {"type": "subpanel", "target": "navigation__carrot_tuning__developer", "label": "Developer",
       "desc": "Debug and diagnostic toggles. Use with caution.", "button": "CUSTOMIZE"},
      {"type": "separator"},
      {"type": "subpanel", "target": "carrot__egpu", "label": "eGPU",
       "desc": "eGPU status and configuration.", "button": "EGPU"},
      {"type": "separator"},
      {"type": "action", "label": "Reset Carrot Tuning",
       "desc": "Restore every Carrot tuning parameter on this page to its compiled-in default.",
       "action": "carrot_tuning_reset", "confirm": "Reset all Carrot tuning parameters to defaults?", "button": "RESET"},
    ],
  },
  {
    "id": "visuals",
    "title": "Visuals",
    "widgets": [
      {"type": "bool", "param": "BlindSpot", "label": "Show Blind Spot Warnings",
       "desc": "Enabling this will display warnings when a vehicle is detected in your blind spot as long as your car has BSM supported."},
      {"type": "bool", "param": "TorqueBar", "label": "Steering Arc",
       "desc": "Display steering arc on the driving screen when lateral control is enabled."},
      {"type": "bool", "param": "RainbowMode", "label": "Enable Tesla Rainbow Mode",
       "desc": "A beautiful rainbow effect on the path the model wants to take. It does not affect driving in any way."},
      {"type": "bool", "param": "StandstillTimer", "label": "Enable Standstill Timer",
       "desc": "Show a timer on the HUD when the car is at a standstill."},
      {"type": "bool", "param": "RoadNameToggle", "label": "Display Road Name",
       "desc": "Displays the name of the road the car is traveling on. The OpenStreetMap database of the location must be downloaded from the OSM panel to fetch the road name."},
      {"type": "bool", "param": "GreenLightAlert", "label": "Green Traffic Light Alert (Beta)",
       "desc": "A chime and on-screen alert will play when the traffic light you are waiting for turns green and you have no vehicle in front of you. Note: This chime is only designed as a notification. It is the driver's responsibility to observe their environment and make decisions accordingly."},
      {"type": "bool", "param": "LeadDepartAlert", "label": "Lead Departure Alert (Beta)",
       "desc": "A chime and on-screen alert will play when you are stopped, and the vehicle in front of you start moving. Note: This chime is only designed as a notification. It is the driver's responsibility to observe their environment and make decisions accordingly."},
      {"type": "bool", "param": "TrueVEgoUI", "label": "Speedometer: Always Display True Speed",
       "desc": "For applicable vehicles, always display the true vehicle current speed from wheel speed sensors."},
      {"type": "bool", "param": "HideVEgoUI", "label": "Speedometer: Hide from Onroad Screen",
       "desc": "When enabled, the speedometer on the onroad screen is not displayed."},
      {"type": "bool", "param": "ShowTurnSignals", "label": "Display Turn Signals",
       "desc": "When enabled, visual turn indicators are drawn on the HUD."},
      {"type": "bool", "param": "RocketFuel", "label": "Real-time Acceleration Bar",
       "desc": "Show an indicator on the left side of the screen to display real-time vehicle acceleration and deceleration. This displays what the car is currently doing, not what the planner is requesting."},
      {"type": "multiple_button", "param": "ChevronInfo", "label": "Display Metrics Below Chevron",
       "dynamic_desc": "chevron", "capability": "longitudinal",
       "buttons": ["Off", "Distance", "Speed", "Time", "All"]},
      {"type": "multiple_button", "param": "DevUIInfo", "label": "Developer UI",
       "desc": "Display real-time parameters and metrics from various sources.",
       "buttons": ["Off", "Bottom", "Right", "Right & Bottom"]},
    ],
  },
  {
    "id": "display",
    "title": "Display",
    "widgets": [
      {"type": "option", "param": "Brightness", "label": "Screen Brightness",
       "min": 0, "max": 100, "step": 5, "label_format": "offroad_brightness", "layout": "inline",
       "desc": "Screen brightness when offroad (not driving). 0 uses the device default (50%)."},
      {"type": "option", "param": "OnroadScreenOffBrightness", "label": "Onroad Brightness",
       "min": 0, "max": 22, "step": 1, "label_format": "onroad_brightness", "layout": "inline"},
      {"type": "option", "param": "OnroadScreenOffTimer", "label": "Onroad Brightness Delay",
       "min": 0, "max": 9, "step": 1, "label_format": "onroad_brightness_timer",
       "value_map": {"0": 0, "1": 3, "2": 5, "3": 10, "4": 15, "5": 30,
                     "6": 60, "7": 180, "8": 300, "9": 600},
       "layout": "inline"},
      {"type": "option", "param": "InteractivityTimeout", "label": "Interactivity Timeout",
       "min": 0, "max": 120, "step": 10, "label_format": "interactivity_timeout",
       "desc": "Apply a custom timeout for settings UI. This is the time after which settings UI closes automatically if user is not interacting with the screen.",
       "layout": "inline"},
      {"type": "bool", "param": "HideFirehosePrompt", "label": "Hide Firehose Prompt",
       "desc": "Hide the Firehose prompt on the home screen. The prompt will not be rendered when this is enabled."},
      {"type": "bool", "param": "ScreenSaverEnabled", "label": "Screen Saver",
       "desc": "Show a screen saver when the device is offroad and idle, instead of turning the screen off."},
      {"type": "option", "param": "ScreenSaverTimeout", "label": "Screen Saver Duration",
       "min": 60, "max": 600, "step": 60, "label_format": "screensaver_timeout",
       "desc": "How long the screen saver runs before the screen turns off.",
       "visible_if": {"param": "ScreenSaverEnabled", "eq": "1"}},
      {"type": "separator"},
      {"type": "custom", "custom": "stream_headless_mode", "desc_i18n": "webui_headless_mode_desc"},
      {"type": "custom", "custom": "stream_preview_quality", "desc_i18n": "webui_preview_quality_desc"},
      {"type": "custom", "custom": "stream_webcodecs"},
      {"type": "custom", "custom": "stream_diagnostics"},
    ],
  },
  {
    "id": "storage",
    "title": "Storage",
    "custom": "storage",
    "widgets": [],
  },
  {
    "id": "osm",
    "title": "OSM",
    "custom": "osm",
    "widgets": [],
  },
  {
    "id": "trips",
    "title": "Trips",
    "custom": "trips",
    "widgets": [],
  },
  {
    "id": "vehicle",
    "title": "Vehicle",
    "custom": "vehicle",
    "widgets": [],
  },
  {
    "id": "firehose",
    "title": "Data",
    "custom": "firehose",
    "widgets": [],
  },
  {
    "id": "imu_calibration",
    "title": "IMU Calibration",
    "custom": "imu_calibration",
    "widgets": [
      {"type": "bool", "param": "ImuCalibrationEnabled", "label": "Use IMU Calibration",
       "desc_i18n": "UseIMUCalibrationDescription",
       "needs_cycle": True},
      {"type": "action", "action": "imu_calibration_start", "label": "Start IMU Calibration", "button": "START",
       "desc_i18n": "StartIMUCalibrationDescription",
       "visible_if": {"param": "ImuCalibrationEnabled", "eq": "1"}},
      {"type": "action", "action": "imu_calibration_reset", "label": "Reset IMU Calibration", "button": "RESET",
       "desc_i18n": "ResetIMUCalibrationDescription",
       "confirm": "Are you sure you want to clear the IMU calibration and switch back to stock calibration?",
       "visible_if": {"param": "ImuCalibrationEnabled", "eq": "1"}},
    ],
  },
  {
    "id": "developer",
    "title": "Developer",
    "widgets": [
      {"type": "bool", "param": "AdbEnabled", "label": "Enable ADB", "offroad_only": True,
       "desc": "ADB (Android Debug Bridge) allows connecting to your device over USB or over the network. See https://docs.comma.ai/how-to/connect-to-comma for more info."},
      {"type": "bool", "param": "SshEnabled", "label": "Enable SSH"},
      {"type": "custom", "custom": "ssh_keys", "label": "SSH Keys"},
      {"type": "bool", "param": "JoystickDebugMode", "label": "Joystick Debug Mode",
       "offroad_only": True, "capability": "not_release"},
      {"type": "bool", "param": "LongitudinalManeuverMode", "label": "Longitudinal Maneuver Mode",
       "offroad_only": True, "capability": "longitudinal_not_release"},
      {"type": "bool", "param": "LateralManeuverMode", "label": "Lateral Maneuver Mode",
       "offroad_only": True, "capability": "not_release"},
      {"type": "bool", "param": "AlphaLongitudinalEnabled", "label": "sunnypilot Longitudinal Control (Alpha)",
       "needs_cycle": True, "offroad_only": True, "capability": "alpha_longitudinal",
       "desc": "WARNING: sunnypilot longitudinal control is in alpha for this car and may disable Automatic Emergency Braking (AEB). On this car, sunnypilot defaults to the car's built-in ACC instead of sunnypilot's longitudinal control. Enable this to switch to sunnypilot longitudinal control. Enabling Experimental mode is recommended when enabling sunnypilot longitudinal control alpha. Changing this setting will restart sunnypilot if the car is powered on."},
      {"type": "bool", "param": "ShowDebugInfo", "label": "UI Debug Mode", "capability": "not_release"},
      {"type": "bool", "param": "ShowAdvancedControls", "label": "Show Advanced Controls",
       "desc": "Toggle visibility of advanced sunnypilot controls. This only changes the visibility of the toggles; it does not change the actual enabled/disabled state."},
      {"type": "bool", "param": "EnableGithubRunner", "label": "GitHub Runner Service",
       "desc": "Enables or disables the GitHub runner service.",
       "visible_if": {"param": "ShowAdvancedControls", "eq": "1"}, "capability": "not_release"},
      {"type": "bool", "param": "EnableCopyparty", "label": "copyparty Service",
       "desc": "copyparty is a very capable file server, you can use it to download your routes, view your logs and even make some edits on some files from your browser. Requires you to connect to your comma locally via its IP address.",
       "visible_if": {"param": "ShowAdvancedControls", "eq": "1"}},
      {"type": "bool", "param": "QuickBootToggle", "label": "Quickboot Mode",
       "visible_if": {"param": "ShowAdvancedControls", "eq": "1"}, "capability": "not_release_or_tested"},
      {"type": "action", "action": "developer_error_log", "label": "Error Log", "button": "VIEW",
       "capability": "not_release"},
    ],
  },
]

SUBPANELS: dict[str, dict[str, Any]] = {
  "navigation__carrot_tuning": {
    "id": "navigation__carrot_tuning",
    "title": "Carrot Tuning",
    "parent": "navigation",
    "widgets": [
      {
        "type": "subpanel",
        "target": "navigation__carrot_tuning__start",
        "label": "Start / Engage",
        "desc": "How openpilot engages cruise and which steering wheel buttons control it.",
        "button": "CUSTOMIZE"
      },
      {
        "type": "separator"
      },
      {
        "type": "subpanel",
        "target": "navigation__carrot_tuning__cruise",
        "label": "Cruise & Following",
        "desc": "Following distance, longitudinal gains, acceleration limits and cruise behavior.",
        "button": "CUSTOMIZE"
      },
      {
        "type": "separator"
      },
      {
        "type": "subpanel",
        "target": "navigation__carrot_tuning__navi",
        "label": "Navigation",
        "desc": "Navigation-based speed control, speed cameras, road limits and speed bumps.",
        "button": "CUSTOMIZE"
      },
      {
        "type": "separator"
      },
      {
        "type": "subpanel",
        "target": "navigation__carrot_tuning__speed",
        "label": "Turns & Curves",
        "desc": "Automatic turn, fork / merge and curve speed control.",
        "button": "CUSTOMIZE"
      },
      {
        "type": "separator"
      },
      {
        "type": "subpanel",
        "target": "navigation__carrot_tuning__tuning",
        "label": "Lateral Tuning",
        "desc": "Steering geometry, MPC costs, torque tuning, lane change and blind spot.",
        "button": "CUSTOMIZE"
      },
      {
        "type": "separator"
      },
      {
        "type": "subpanel",
        "target": "navigation__carrot_tuning__display",
        "label": "Display & Sound",
        "desc": "Cluster HUD, on-screen overlays, sound, YouTube and map style.",
        "button": "CUSTOMIZE"
      },
      {
        "type": "separator"
      },
      {
        "type": "subpanel",
        "target": "navigation__carrot_tuning__vehicle",
        "label": "Vehicle",
        "desc": "Vehicle-specific overrides and convenience options.",
        "button": "CUSTOMIZE"
      },
      {
        "type": "separator"
      },
      {
        "type": "subpanel",
        "target": "navigation__carrot_tuning__developer",
        "label": "Developer",
        "desc": "Debug and diagnostic toggles. Use with caution.",
        "button": "CUSTOMIZE"
      },
      {
        "type": "separator"
      },
      {
        "type": "action",
        "label": "Reset Carrot Tuning",
        "desc": "Restore every Carrot tuning parameter on this page to its compiled-in default.",
        "action": "carrot_tuning_reset",
        "confirm": "Reset all Carrot tuning parameters to defaults?",
        "button": "RESET"
      },
    ],
  },

  "navigation__carrot_tuning__start": {
    "id": "navigation__carrot_tuning__start",
    "title": "Start / Engage",
    "parent": "carrot",
    "widgets": [{
        "type": "section",
        "label": "Auto Start / Cruise"
      },{
        "type": "int",
        "param": "CruiseEcoControl",
        "label": "Eco Cruise Control",
        "desc": "Adjust the Cruise Eco Control setting.",
        "min": 0,
        "max": 3,
        "step": 1,
      },{
        "type": "separator"
      },        {"type": "section", "label": "Auto Gas"},    {"type": "int", "param": "AutoGasSyncSpeed", "label": "Auto Gas Sync Speed",
     "desc": "Speed at which cruise set speed is re-synchronized. Tesla BYD only.",
    "min": 0, "max": 200, "step": 5}],
  },

  "navigation__carrot_tuning__cruise": {
    "id": "navigation__carrot_tuning__cruise",
    "title": "Cruise & Following",
    "parent": "carrot",
    "widgets": [
      {
        "type": "section",
        "label": "Following Distance"
      },
            {
        "type": "int",
        "param": "CruiseGapLevels",
        "label": "Cruise Gap Levels",
        "desc": "How many follow-gap levels the distance button cycles (2-4). A value below the vehicle's maximum shortens the cycle; leave at 4 for the full range.",
        "min": 2,
        "max": 4,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "CruiseSpeedUnit",
        "label": "Cruise Speed Unit",
        "desc": "Speed step unit for the cruise buttons.",
        "min": 1,
        "max": 20,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "CruiseSpeedUnitBasic",
        "label": "Cruise Speed Unit (Basic)",
        "desc": "Basic increment applied on a short press.",
        "min": 1,
        "max": 20,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "CruiseSpeed1",
        "label": "Cruise Speed 1",
        "desc": "First preset cruise speed.",
        "min": 0,
        "max": 200,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "CruiseSpeed2",
        "label": "Cruise Speed 2",
        "desc": "Second preset cruise speed.",
        "min": 0,
        "max": 200,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "CruiseSpeed3",
        "label": "Cruise Speed 3",
        "desc": "Third preset cruise speed.",
        "min": 0,
        "max": 200,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "CruiseSpeed4",
        "label": "Cruise Speed 4",
        "desc": "Fourth preset cruise speed.",
        "min": 0,
        "max": 200,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "CruiseSpeed5",
        "label": "Cruise Speed 5",
        "desc": "Fifth preset cruise speed.",
        "min": 0,
        "max": 200,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "CruiseButtonMode",
        "label": "Cruise Button Mode",
        "desc": "How the cruise buttons behave (long-press behaviour and steps).",
        "min": 0,
        "max": 3,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "CruiseButtonLongDelay",
        "label": "Cruise Button Long Delay",
        "desc": "Frames before a press counts as long.",
        "min": 10,
        "max": 100,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "CancelButtonMode",
        "label": "Cancel Button Mode",
        "desc": "What the cancel button does while engaged.",
        "min": 0,
        "max": 3,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "LfaButtonMode",
        "label": "LFA Button Mode",
        "desc": "What the LFA button does.",
        "min": 0,
        "max": 2,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "CruiseOnDist",
        "label": "Cruise On Distance",
        "desc": "Distance (percent of a base) at which auto-cruise engages.",
        "min": 0,
        "max": 200,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "ApplyModelSpeed",
        "label": "Apply Model Speed",
        "desc": "Blend the model's desired speed into the cruise target (percent).",
        "min": 0,
        "max": 100,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "AutoEngage",
        "label": "Auto Engage",
        "desc": "Automatically engage lateral control when cruise engages.",
        "min": 0,
        "max": 2,
        "step": 1,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
{
        "type": "int",
        "param": "TFollowGap1",
        "label": "Follow Time Gap 1",
        "desc": "Adjust the T Follow Gap1 setting.",
        "min": 50,
        "max": 300,
        "step": 5,
      },
      {
        "type": "int",
        "param": "TFollowGap2",
        "label": "Follow Time Gap 2",
        "desc": "Adjust the T Follow Gap2 setting.",
        "min": 50,
        "max": 300,
        "step": 5,
      },
      {
        "type": "int",
        "param": "TFollowGap3",
        "label": "Follow Time Gap 3",
        "desc": "Adjust the T Follow Gap3 setting.",
        "min": 50,
        "max": 300,
        "step": 5,
      },
      {
        "type": "int",
        "param": "TFollowGap4",
        "label": "Follow Time Gap 4",
        "desc": "Adjust the T Follow Gap4 setting.",
        "min": 50,
        "max": 300,
        "step": 5,
      },
      
      {
        "type": "int",
        "param": "DynamicTFollowLC",
        "label": "Dynamic Follow Time on Lane Change",
        "desc": "Adjust the Dynamic T Follow L C setting.",
        "min": 0,
        "max": 200,
        "step": 5,
      },
      {
        "type": "separator"
      },
      {
        "type": "section",
        "label": "Longitudinal Gains"
      },
      {
        "type": "int",
        "param": "LeadAccelResponse",
        "label": "Lead Acceleration Response",
        "desc": "Adjust the Lead Accel Response setting.",
        "min": -100,
        "max": 100,
        "step": 5,
      },
      
      {
        "type": "int",
        "param": "TFollowDecelBoost",
        "label": "Follow Deceleration Boost",
        "desc": "Adjust the T Follow Decel Boost setting.",
        "min": 0,
        "max": 200,
        "step": 5,
      },
      {
        "type": "separator"
      },
      
      
      
      
      
      
      
      
      ],
  },

  "navigation__carrot_tuning__navi": {
    "id": "navigation__carrot_tuning__navi",
    "title": "Navigation",
    "parent": "carrot",
    "widgets": [
      {
        "type": "section",
        "label": "Navigation Speed Control"
      },
      {
        "type": "int",
        "param": "AutoNaviSpeedCtrlMode",
        "label": "Navigation Speed Ctrl Mode",
        "desc": "Adjust the Auto Navi Speed Ctrl Mode setting.",
        "min": 0,
        "max": 3,
        "step": 1,
      },
      {
        "type": "int",
        "param": "AutoNaviSpeedDecelRate",
        "label": "Navigation Speed Decel Rate",
        "desc": "Adjust the Auto Navi Speed Decel Rate setting.",
        "min": 0,
        "max": 500,
        "step": 10,
      },
      {
        "type": "int",
        "param": "AutoNaviSpeedSafetyFactor",
        "label": "Navigation Speed Safety Factor",
        "desc": "Adjust the Auto Navi Speed Safety Factor setting.",
        "min": 50,
        "max": 150,
        "step": 5,
      },
      {
        "type": "int",
        "param": "AutoNaviSpeedCtrlEnd",
        "label": "Navigation Speed Ctrl End Distance",
        "desc": "Adjust the Auto Navi Speed Ctrl End setting.",
        "min": 0,
        "max": 30,
        "step": 1,
      },
      {
        "type": "separator"
      },
      {
        "type": "section",
        "label": "Stop / Speed Camera"
      },
      
      {
        "type": "bool",
        "param": "SameSpiCamFilter",
        "label": "Same Direction Speed Cam Filter",
        "desc": "Adjust the Same Spi Cam Filter setting.",
        "default": True
      },
      {
        "type": "int",
        "param": "TrafficStopDistanceAdjust",
        "label": "Traffic Stop Distance Adjust",
        "desc": "Adjust the Traffic Stop Distance Adjust setting.",
        "min": -500,
        "max": 500,
        "step": 10,
      },
      {
        "type": "int",
        "param": "TrafficLightDetectMode",
        "label": "Traffic Light Detect Mode",
        "desc": "Adjust the Traffic Light Detect Mode setting.",
        "min": 0,
        "max": 2,
        "step": 1,
      },
      {
        "type": "separator"
      },
      {
        "type": "section",
        "label": "Road Speed Limits"
      },      {"type": "int", "param": "SpeedFromPCM", "label": "Speed Source PCM",
       "desc": "BYD only: with 1 the car reports its own ACC set speed over CAN.",
      "min": 0, "max": 2, "step": 1},
      {
        "type": "int",
        "param": "AutoRoadSpeedLimitOffset",
        "label": "Road Speed Limit Offset",
        "desc": "Adjust the Auto Road Speed Limit Offset setting.",
        "min": -20,
        "max": 20,
        "step": 1,
      },
      {
        "type": "int",
        "param": "RoadType",
        "label": "Road Type",
        "desc": "Adjust the Road Type setting.",
        "min": 0,
        "max": 2,
        "step": 1,
      },
      {
        "type": "separator"
      },
      {
        "type": "section",
        "label": "Vehicle CAN Speed Arbitration"
      },      {"type": "int", "param": "VehicleSpeedCameraDistanceTime", "label": "Speed Camera Alert Time",
       "desc": "Synthesises a camera distance when the car sends only an enforcement speed. 0.1 s units; 60 = 6.0 s.",
      "min": 10, "max": 200, "step": 1},
      {
        "type": "multiple_button",
        "param": "VehicleNaviCanControl",
        "label": "Vehicle Navi CAN Control",
        "desc": "Adjust the Vehicle Navi Can Control setting.",
        "buttons": ["Off", "Camera/Bump Always", "Camera Always/Bump Route", "Camera/Bump Route"],
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "bool",
        "param": "VehicleNaviSchoolZoneControl",
        "label": "School Zone CAN Control",
        "desc": "Adjust the Vehicle Navi School Zone Control setting.",
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        },
        "default": False
      },
      {
        "type": "multiple_button",
        "param": "VehicleSpeedCameraControlMode",
        "label": "Speed Camera Control Mode",
        "desc": "Adjust the Vehicle Speed Camera Control Mode setting.",
        "buttons": ["Off", "Always Apply", "Gas Floor", "Gas Pause"],
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "separator"
      },
      {
        "type": "section",
        "label": "Speed Bumps"
      },
      {
        "type": "int",
        "param": "AutoNaviRearCameraHoldDistance",
        "label": "Rear Speed Camera Hold",
        "desc": "How far past a rear speed camera the limit is held, in centimetres. The phone app drops the limit at the camera, so this prevents speeding back up while still passing it. 100 = 1.00 m.",
        "min": 0,
        "max": 300,
        "step": 10,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "AutoNaviSpeedBumpEndDistance",
        "label": "Speed Bump End Distance",
        "desc": "Adjust the Auto Navi Speed Bump End Distance setting.",
        "min": 0,
        "max": 500,
        "step": 10,
        "visible_if": {
          "param": "CarrotEnabled",
          "eq": "1"
        }
      },
      {
        "type": "int",
        "param": "AutoNaviCountDownMode",
        "label": "Countdown Mode",
        "desc": "Adjust the Auto Navi Count Down Mode setting.",
        "min": 0,
        "max": 2,
        "step": 1,
      },
      {
        "type": "int",
        "param": "AutoNaviSpeedBumpSpeed",
        "label": "Speed Bump Target Speed",
        "desc": "Adjust the Auto Navi Speed Bump Speed setting.",
        "min": 0,
        "max": 100,
        "step": 1,
      },
      {
        "type": "int",
        "param": "AutoNaviSpeedBumpTime",
        "label": "Speed Bump Hold Time",
        "desc": "Adjust the Auto Navi Speed Bump Time setting.",
        "min": 0,
        "max": 20,
        "step": 1,
      }],
  },

  "navigation__carrot_tuning__speed": {
    "id": "navigation__carrot_tuning__speed",
    "title": "Turns & Curves",
    "parent": "carrot",
    "widgets": [
      {
        "type": "section",
        "label": "ATC Turn Control"
      },
      {
        "type": "int",
        "param": "AutoTurnControl",
        "label": "Auto Turn Control",
        "desc": "Adjust the Auto Turn Control setting.",
        "min": 0,
        "max": 3,
        "step": 1,
      },
      {
        "type": "int",
        "param": "AutoTurnControlSpeedTurn",
        "label": "Auto Turn Speed Threshold",
        "desc": "Adjust the Auto Turn Control Speed Turn setting.",
        "min": 0,
        "max": 200,
        "step": 5,
      },
      {
        "type": "int",
        "param": "AutoTurnControlTurnEnd",
        "label": "Auto Turn End Distance",
        "desc": "Adjust the Auto Turn Control Turn End setting.",
        "min": 0,
        "max": 500,
        "step": 10,
      },
      {
        "type": "bool",
        "param": "AutoTurnMapChange",
        "label": "Auto Turn on Navi Lane Change",
        "desc": "Adjust the Auto Turn Map Change setting.",
      },
      {
        "type": "int",
        "param": "AutoTurnDistOffset",
        "label": "Auto Turn Distance Offset",
        "desc": "Adjust the Auto Turn Dist Offset setting.",
        "min": -200,
        "max": 200,
        "step": 10,
      },
      {
        "type": "separator"
      },
      {
        "type": "section",
        "label": "Fork Control"
      },
      {
        "type": "int",
        "param": "AutoForkDistOffset",
        "label": "Fork Merge Distance Offset",
        "desc": "Adjust the Auto Fork Dist Offset setting.",
        "min": -200,
        "max": 200,
        "step": 10,
      },
      {
        "type": "int",
        "param": "AutoForkDistOffsetH",
        "label": "Fork Merge Distance Offset (Highway)",
        "desc": "Adjust the Auto Fork Dist Offset H setting.",
        "min": -200,
        "max": 200,
        "step": 10,
      },
      {
        "type": "int",
        "param": "AutoDoForkBlinkerDist",
        "label": "Fork Blinker Trigger Distance",
        "desc": "Adjust the Auto Do Fork Blinker Dist setting.",
        "min": 0,
        "max": 500,
        "step": 10,
      },
      {
        "type": "int",
        "param": "AutoDoForkBlinkerDistH",
        "label": "Fork Blinker Trigger Distance (Highway)",
        "desc": "Adjust the Auto Do Fork Blinker Dist H setting.",
        "min": 0,
        "max": 500,
        "step": 10,
      },
      {
        "type": "int",
        "param": "AutoDoForkNavDist",
        "label": "Fork Navi Trigger Distance",
        "desc": "Adjust the Auto Do Fork Nav Dist setting.",
        "min": 0,
        "max": 500,
        "step": 10,
      },
      {
        "type": "int",
        "param": "AutoDoForkNavDistH",
        "label": "Fork Navi Trigger Distance (Highway)",
        "desc": "Adjust the Auto Do Fork Nav Dist H setting.",
        "min": 0,
        "max": 500,
        "step": 10,
      },
      {
        "type": "int",
        "param": "AutoDoForkDecalDist",
        "label": "Fork Decel Trigger Distance",
        "desc": "Adjust the Auto Do Fork Decal Dist setting.",
        "min": 0,
        "max": 500,
        "step": 10,
      },
      {
        "type": "int",
        "param": "AutoDoForkDecalDistH",
        "label": "Fork Decel Trigger Distance (Highway)",
        "desc": "Adjust the Auto Do Fork Decal Dist H setting.",
        "min": 0,
        "max": 500,
        "step": 10,
      },
      {
        "type": "int",
        "param": "AutoForkDecalRate",
        "label": "Fork Decel Rate",
        "desc": "Adjust the Auto Fork Decal Rate setting.",
        "min": 0,
        "max": 300,
        "step": 10,
      },
      {
        "type": "int",
        "param": "AutoForkDecalRateH",
        "label": "Fork Decel Rate (Highway)",
        "desc": "Adjust the Auto Fork Decal Rate H setting.",
        "min": 0,
        "max": 300,
        "step": 10,
      },
      {
        "type": "int",
        "param": "AutoForkSpeedMin",
        "label": "Fork Minimum Speed",
        "desc": "Adjust the Auto Fork Speed Min setting.",
        "min": 0,
        "max": 200,
        "step": 5,
      },
      {
        "type": "int",
        "param": "AutoForkSpeedMinH",
        "label": "Fork Minimum Speed (Highway)",
        "desc": "Adjust the Auto Fork Speed Min H setting.",
        "min": 0,
        "max": 200,
        "step": 5,
      },
      {
        "type": "int",
        "param": "AutoKeepForkSpeed",
        "label": "Fork Keep Speed",
        "desc": "Adjust the Auto Keep Fork Speed setting.",
        "min": 0,
        "max": 200,
        "step": 5,
      },
      {
        "type": "int",
        "param": "AutoKeepForkSpeedH",
        "label": "Fork Keep Speed (Highway)",
        "desc": "Adjust the Auto Keep Fork Speed H setting.",
        "min": 0,
        "max": 200,
        "step": 5,
      },
      {
        "type": "separator"
      },
      {
        "type": "section",
        "label": "Turn Speed"
      },
      {
        "type": "int",
        "param": "MapTurnSpeedFactor",
        "label": "Map Turn Speed Factor",
        "desc": "Adjust the Map Turn Speed Factor setting.",
        "min": 50,
        "max": 150,
        "step": 5,
      },
      {
        "type": "int",
        "param": "TurnSpeedControlMode",
        "label": "Turn Speed Control Mode",
        "desc": "Adjust the Turn Speed Control Mode setting.",
        "min": 0,
        "max": 3,
        "step": 1,
      },
      {
        "type": "separator"
      },
      {
        "type": "section",
        "label": "Curve Speed"
      },
      {
        "type": "int",
        "param": "AutoCurveSpeedFactor",
        "label": "Curve Speed Factor",
        "desc": "How much lateral acceleration to allow below 80 km/h, in percent. Higher takes curves faster. 100 is neutral. Used by Smart Cruise Control (Vision).",
        "min": 50,
        "max": 200,
        "step": 5,
      },
      {
        "type": "int",
        "param": "AutoCurveSpeedFactorH",
        "label": "Curve Speed Factor (Highway)",
        "desc": "How much lateral acceleration to allow at or above 80 km/h, in percent. Higher takes curves faster. 100 is neutral. Used by Smart Cruise Control (Vision).",
        "min": 50,
        "max": 200,
        "step": 5,
      },
      {
        "type": "int",
        "param": "AutoCurveSpeedAggressivenessH",
        "label": "Highway Curve Aggressiveness",
        "desc": "How early to react to curves on the highway. Lower reacts to gentler curves. Used by Smart Cruise Control (Vision).",
        "min": 0,
        "max": 200,
        "step": 5,
      },
      {
        "type": "int",
        "param": "AutoCurveSpeedAggressiveness",
        "label": "Normal Road Curve Aggressiveness",
        "desc": "How early to react to curves on normal roads. Lower reacts to gentler curves. Used by Smart Cruise Control (Vision).",
        "min": 0,
        "max": 200,
        "step": 5
      },
      {
        "type": "int",
        "param": "AutoCurveSpeedLowerLimit",
        "label": "Curve Speed Lower Limit",
        "desc": "Adjust the Auto Curve Speed Lower Limit setting.",
        "min": 0,
        "max": 100,
        "step": 5,
      },
      {
        "type": "separator"
      },
      {
        "type": "section",
        "label": "Road Limit Raising"
      },
      {
        "type": "bool",
        "param": "AutoUpRoadLimit",
        "label": "Auto Up Road Limit",
        "desc": "Adjust the Auto Up Road Limit setting.",
        "default": False
      },
      {
        "type": "int",
        "param": "AutoUpRoadLimit40KMH",
        "label": "Auto Up 40 km/h Road Limit",
        "desc": "Adjust the Auto Up Road Limit40 K M H setting.",
        "min": 0,
        "max": 60,
        "step": 5
      },
      {
        "type": "bool",
        "param": "AutoUpHighwayRoadLimit",
        "label": "Auto Up Highway Limit",
        "desc": "Adjust the Auto Up Highway Road Limit setting.",
        "default": False
      },
      {
        "type": "int",
        "param": "AutoUpHighwayRoadLimit40KMH",
        "label": "Auto Up 40 km/h Highway Limit",
        "desc": "Adjust the Auto Up Highway Road Limit40 K M H setting.",
        "min": 0,
        "max": 60,
        "step": 5
      }],
  },

  "navigation__carrot_tuning__tuning": {
    "id": "navigation__carrot_tuning__tuning",
    "title": "Lateral Tuning",
    "parent": "carrot",
    "widgets": [{
        "type": "separator"
      },{
        "type": "section",
        "label": "Blind Spot"
      },{
        "type": "bool",
        "param": "DisableBlindSpot",
        "label": "Disable Blind Spot",
        "desc": "Adjust the Disable Blind Spot setting.",
        "default": False
      },{
        "type": "int",
        "param": "DynamicBlindRange",
        "label": "Dynamic Blind Spot Range",
        "desc": "Adjust the Dynamic Blind Range setting.",
        "min": 0,
        "max": 200,
        "step": 5,
      },{
        "type": "int",
        "param": "DynamicBlindDistance",
        "label": "Dynamic Blind Spot Distance",
        "desc": "Adjust the Dynamic Blind Distance setting.",
        "min": 0,
        "max": 200,
        "step": 5,
      },{
        "type": "int",
        "param": "SideBsdDelayTime",
        "label": "Side Blind Spot Delay",
        "desc": "Adjust the Side Bsd Delay Time setting.",
        "min": 0,
        "max": 50,
        "step": 1,
      },{
        "type": "int",
        "param": "SideRelDistTime",
        "label": "Side Relative Distance Time",
        "desc": "Adjust the Side Rel Dist Time setting.",
        "min": 0,
        "max": 50,
        "step": 1,
      },{
        "type": "int",
        "param": "SidevRelDistTime",
        "label": "Side vRel Distance Time",
        "desc": "Adjust the Sidev Rel Dist Time setting.",
        "min": 0,
        "max": 50,
        "step": 1,
      }],
  },

  "navigation__carrot_tuning__display": {
    "id": "navigation__carrot_tuning__display",
    "title": "Display & Sound",
    "parent": "carrot",
    "widgets": [{
        "type": "section",
        "label": "Steering Suspend"
      },{
        "type": "int",
        "param": "LatSuspendAngleDeg",
        "label": "Lateral Suspend Angle",
        "desc": "Steering angle at which lateral control pauses while you steer. 300 effectively disables it. CarrotPilot declares 0.1-degree units for this parameter, but its code - like this port - compares the raw value against the steering angle, so the number reads as degrees here.",
        "min": 45,
        "max": 300,
        "step": 1,
      },{
        "type": "separator"
      },{
        "type": "section",
        "label": "Cluster Map"
      },{
        "type": "int", "param": "ClusterNaviMapTheme", "label": "Cluster Navigation Map Theme",
        "desc": "0 = Auto, 1 = Dark, 2 = Light.", "min": 0, "max": 2, "step": 1
      },{
        "type": "int", "param": "ClusterNaviMapType", "label": "Cluster Navigation Map Type",
        "desc": "Map style used on the external cluster.", "min": 0, "max": 10, "step": 1
      },{
        "type": "int", "param": "ClusterNaviMapFps", "label": "Cluster Navigation Map FPS",
        "desc": "Refresh rate of the external cluster map, in frames per second.", "min": 1, "max": 60, "step": 1
      },{
        "type": "bool", "param": "CarrotNaviHudMapProfile", "label": "Cluster Map Profile",
        "desc": "Enable the cluster map HUD profile overlay.", "default": 0
      },{
        "type": "separator"
      },{
        "type": "section",
        "label": "Cluster HUD (external display required)"
      },{
        "type": "bool", "param": "ClusterHud", "label": "Cluster HUD",
        "desc": "Master switch for the external cluster HUD renderer.", "default": 0
      },{
        "type": "int", "param": "ClusterHudBrightness", "label": "Cluster HUD Brightness",
        "desc": "External cluster brightness, 0-100 percent.", "min": 0, "max": 100, "step": 1
      },{
        "type": "int", "param": "ClusterHudCameraViewMode", "label": "Cluster HUD Camera View Mode",
        "desc": "0 = Default, 1 = Ego Bottom, 2 = Road Camera, 3 = Wide Camera, 4 = Auto Camera.", "min": 0, "max": 4, "step": 1
      },{
        "type": "int", "param": "ClusterHudCoreMode", "label": "Cluster HUD Core Mode",
        "desc": "Core rendering mode of the external cluster.", "min": 0, "max": 10, "step": 1
      },{
        "type": "bool", "param": "ClusterHudDebug", "label": "Cluster HUD Debug",
        "desc": "Show debug overlays on the external cluster.", "default": 0
      },{
        "type": "int", "param": "ClusterHudEncoder", "label": "Cluster HUD Encoder",
        "desc": "0 = Auto, 1 = JPEG, 2 = Hardware H.264, 3 = Software H.264.", "min": 0, "max": 3, "step": 1
      },{
        "type": "int", "param": "ClusterHudLiveFps", "label": "Cluster HUD Live FPS",
        "desc": "Live render target FPS for the external cluster.", "min": 1, "max": 60, "step": 1
      },{
        "type": "bool", "param": "ClusterHudMirror", "label": "Cluster HUD Mirror",
        "desc": "Mirror the external cluster display horizontally.", "default": 0
      },{
        "type": "int", "param": "ClusterHudOrientation", "label": "Cluster HUD Orientation",
        "desc": "Display orientation of the external cluster.", "min": 0, "max": 3, "step": 1
      },{
        "type": "int", "param": "ClusterHudPanelLayout", "label": "Cluster HUD Panel Layout",
        "desc": "0 = Driving Left, 1 = Driving Right.", "min": 0, "max": 1, "step": 1
      },{
        "type": "int", "param": "ClusterHudPriority", "label": "Cluster HUD Priority",
        "desc": "Scheduling priority of the cluster process.", "min": 0, "max": 100, "step": 1
      },{
        "type": "bool", "param": "ClusterHudRadarDisplay", "label": "Cluster HUD Radar Display",
        "desc": "Draw radar tracks on the external cluster.", "default": 0
      },{
        "type": "int", "param": "ClusterHudRadarInfo", "label": "Cluster HUD Radar Info",
        "desc": "0 = None, 1 = Vehicle Speed, 2 = Speed + Distance, 3 = All Speeds, 4 = All Speeds + Distance.", "min": 0, "max": 4, "step": 1
      },{
        "type": "bool", "param": "ClusterHudRadarSourceColor", "label": "Cluster HUD Radar Source Color",
        "desc": "Color radar tracks by their detection source.", "default": 0
      },{
        "type": "int", "param": "ClusterHudScreenMode", "label": "Cluster HUD Screen Mode",
        "desc": "0 = Default, 1 = Debug, 2 = Debug System, 3 = Debug Graph, 4 = Debug Graph Right, 5 = Trip Report, 6 = Navi.", "min": 0, "max": 6, "step": 1
      },{
        "type": "int", "param": "ClusterHudTheme", "label": "Cluster HUD Theme",
        "desc": "0 = Auto, 1 = Dark, 2 = Light.", "min": 0, "max": 2, "step": 1
      }],
  },



  "navigation__carrot_tuning__vehicle": {
    "id": "navigation__carrot_tuning__vehicle",
    "title": "Vehicle",
    "parent": "carrot",
    "widgets": [{
        "type": "section",
        "label": "Radar / Tracks"
      },    {"type": "bool", "param": "EnableRadarTracks", "label": "Enable Radar Tracks",
    "desc": "BYD only: feed corner-radar tracks into the radar interface.", "default": 0},
      {"type": "int", "param": "SoundVolumeAdjust", "label": "Alert Volume",
       "desc": "Scale every alert sound, in percent. 100 keeps the current loudness.",
       "min": 5, "max": 200, "step": 5},
      {"type": "int", "param": "SoundVolumeAdjustEngage", "label": "Engage Chime Volume",
       "desc": "Scale the engage / disengage / reverse chimes, in percent.",
       "min": 5, "max": 200, "step": 5},{
        "type": "int",
        "param": "EnableSpeedTF",
        "label": "Speed-dependent Follow Time",
        "desc": "Shrink the follow distance as speed rises. 0 disables it, 1 scales linearly, and -1/-2/-3 select speed breakpoint profiles at 30/60/90, 40/80/120 and 50/100/150 km/h. The code reads all four modes; the control used to be a toggle, which could only write 0 or 1 and made the profiles unreachable.",
        "min": -3,
        "max": 1,
        "step": 1
      },{
        "type": "separator"
      },{
        "type": "section",
        "label": "Driving Mode"
      },{
        "type": "int",
        "param": "MyDrivingMode",
        "label": "My Driving Mode",
        "desc": "Adjust the My Driving Mode setting.",
        "min": 1,
        "max": 4,
        "step": 1,
      },{
        "type": "int",
        "param": "MyDrivingModeAuto",
        "label": "My Driving Mode Auto",
        "desc": "Adjust the My Driving Mode Auto setting.",
        "min": 0,
        "max": 2,
        "step": 1
      }],
  },

  "navigation__carrot_tuning__developer": {
    "id": "navigation__carrot_tuning__developer",
    "title": "Developer",
    "parent": "carrot",
    "widgets": [{
        "type": "section",
        "label": "Hardware / Tests"
      },{
        "type": "bool",
        "param": "ShowDebugLog",
        "label": "Show Debug Log",
        "desc": "Adjust the Show Debug Log setting.",
        "default": False
      },{
        "type": "separator"
      },{
        "type": "section",
        "label": "Navigation Control (advanced)"
      },{
        "type": "bool",
        "param": "CarrotTrafficCongestionEnabled",
        "label": "Traffic Congestion Slowdown",
        "desc": "Fold the phone app traffic congestion report into map-based cruise control. Only ever lowers the target speed. Needs Smart Cruise Control - Map to be on as well.",
        "default": False
      },{
        "type": "bool",
        "param": "CarrotNavLaneGuideBlockEnabled",
        "label": "Lane Guide Blocking",
        "desc": "Let the phone app guided-lane arrows block lane changes toward non-guided lanes. Only ever adds blocking.",
        "default": False
      },{
        "type": "bool",
        "param": "BydBsdType2",
        "label": "BYD BSD Type 2",
        "desc": "Use the second blind-spot detection variant on BYD platforms.",
        "default": False
      },{
        "type": "bool",
        "param": "BydLatUseSiglin",
        "label": "BYD Lateral Signal Lines",
        "desc": "Use signal-line based lateral state on BYD platforms.",
        "default": False
      },{
        "type": "bool",
        "param": "BydLowSpdLong",
        "label": "BYD Low Speed Longitudinal",
        "desc": "Allow longitudinal control at low speed on BYD platforms.",
        "default": False
      },{
        "type": "bool",
        "param": "BydModifiedStockLong",
        "label": "BYD Modified Stock Longitudinal",
        "desc": "Run the modified stock longitudinal path on BYD platforms.",
        "default": False
      },{
        "type": "bool",
        "param": "BydMpcTsr",
        "label": "BYD MPC TSR",
        "desc": "Feed traffic-sign recognition into the BYD MPC.",
        "default": False
      },{
        "type": "bool",
        "param": "EnableExtRadar",
        "label": "External Radar",
        "desc": "Use an external radar unit instead of the stock one.",
        "default": False
      },{
        "type": "bool",
        "param": "UseRedPanda",
        "label": "Use Red Panda",
        "desc": "Select the BYD safety configuration for red panda hardware.",
        "default": False
      },{
        "type": "int",
        "param": "SpeedCorrect30",
        "label": "Speed Correct @ 30 km/h",
        "desc": "Dash-speed correction at 30 km/h, in tenths of km/h (10 = +1.0 km/h). Interpolated in between.",
        "min": -50,
        "max": 50,
        "step": 1,
        "default": 0
      },{
        "type": "int",
        "param": "SpeedCorrect60",
        "label": "Speed Correct @ 60 km/h",
        "desc": "Dash-speed correction at 60 km/h, in tenths of km/h (10 = +1.0 km/h). Interpolated in between.",
        "min": -50,
        "max": 50,
        "step": 1,
        "default": 0
      },{
        "type": "int",
        "param": "SpeedCorrect90",
        "label": "Speed Correct @ 90 km/h",
        "desc": "Dash-speed correction at 90 km/h, in tenths of km/h (10 = +1.0 km/h). Interpolated in between.",
        "min": -50,
        "max": 50,
        "step": 1,
        "default": 0
      },{
        "type": "int",
        "param": "SpeedCorrect120",
        "label": "Speed Correct @ 120 km/h",
        "desc": "Dash-speed correction at 120 km/h, in tenths of km/h (10 = +1.0 km/h). Interpolated in between.",
        "min": -50,
        "max": 50,
        "step": 1,
        "default": 0
      }],
  },

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
       "min": -1, "max": 5, "step": 1, "label_format": "lane_change_timer", "layout": "stacked",
       "desc": "Set a timer to delay the auto lane change operation when the blinker is used. "
               "No nudge on the steering wheel is required to auto lane change if a timer is set. Default is Nudge. "
               "Please use caution when using this feature. Only use the blinker when traffic and road conditions permit."},
      {"type": "separator"},
      {"type": "bool", "param": "AutoLaneChangeBsmDelay", "label": "Auto Lane Change: Delay with Blind Spot",
       "desc": "Toggle to enable a delay timer for seamless lane changes when blind spot monitoring (BSM) "
               "detects a obstructing vehicle, ensuring safe maneuvering."},
      {"type": "separator"},
      {"type": "bool", "param": "RoadEdgeLaneChangeEnabled", "label": "Block Lane Change: Road Edge Detection",
       "desc": "Blocks the lane change if the model sees a road edge on your signaled side."},
    ],
  },
  "steering__torque": {
    "id": "steering__torque",
    "title": "Customize Torque Params",
    "parent": "steering",
    "widgets": [
      {"type": "bool", "param": "LateralJerkTorqueController", "label": "Lateral Jerk Torque Controller", "offroad_only": True,
       "desc": "Looks ahead at planned steering to reduce sudden corrections, so the wheel moves more smoothly through turns. Works with Self-Tune and custom tuning. Thanks to @twilsonco for the implementation."},
      {"type": "action", "action": "torque_tune_version", "label": "Torque Control Tune Version", "button": "SELECT",
       "desc": "Select the version of Torque Control Tune to use."},
      {"type": "bool", "param": "LiveTorqueParamsToggle", "label": "Self-Tune", "offroad_only": True,
       "desc": "Enables self-tune for Torque lateral control for platforms that do not use Torque lateral control by default."},
      {"type": "bool", "param": "LiveTorqueParamsRelaxedToggle", "label": "Less Restrict Settings for Self-Tune (Beta)",
       "desc": "Less strict settings when using Self-Tune. This allows torqued to be more forgiving when learning values.",
       "visible_if": {"param": "LiveTorqueParamsToggle", "eq": "1"}, "offroad_only": True},
      {"type": "bool", "param": "CustomTorqueParams", "label": "Enable Custom Tuning", "offroad_only": True,
       "desc": "Enables custom tuning for Torque lateral control. Modifying Lateral Acceleration Factor and Friction below will override the offline values indicated in the YAML files within \"opendbc/car/torque_data\". The values will also be used live when \"Manual Real-Time Tuning\" toggle is enabled."},
      {"type": "bool", "param": "TorqueParamsOverrideEnabled", "label": "Manual Real-Time Tuning",
       "desc": "Enforces the torque lateral controller to use the fixed values instead of the learned values from Self-Tune. Enabling this toggle overrides Self-Tune values.",
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
      {"type": "custom", "custom": "speed_limit_sources", "label": "Speed Limit Sources",
       "desc": "Real-time values from the car (TSR), map provider (OSM/Amap), and Carrot navigation. The merged value is what the Speed Limit widget currently displays."},
      {"type": "custom", "custom": "longitudinal_source", "label": "Longitudinal Source",
       "desc": "Which longitudinal plan source is currently winning the arbitration: cruise, sccVision, sccMap, speedLimitAssist, or carrot."},
      {"type": "custom", "custom": "traffic_light_fusion", "label": "Traffic Light Fusion",
       "desc": "Fused traffic-light state from Carrot/Amap navigation and vision stop-line detection."},
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
    "custom": "network_advanced",
    "widgets": [
      {"type": "bool", "param": "GsmRoaming", "label": "Enable Roaming"},
      {"type": "bool", "param": "GsmMetered", "label": "Cellular Metered",
       "desc": "Prevent large data uploads when on a metered cellular connection"},
    ],
  },
  # eGPU status subpanel — mirrors sidebarSP eGPU icon state
  "carrot__egpu": {
    "id": "carrot__egpu",
    "title": "eGPU",
    "parent": "carrot",
    "custom": "egpu",
    "widgets": [],
  },
  "cruise__longitudinal_mpc_tuning": {
    "id": "cruise__longitudinal_mpc_tuning",
    "title": "Longitudinal MPC Tuning",
    "parent": "cruise",
    "custom": "longitudinal_mpc_tuning",
    "widgets": [],
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
  from webui.server.bridge.headless_util import is_headless_mode
  from webui.server.bridge.lite_util import is_lite_hw, should_hide_widget

  headless = is_headless_mode()
  lite = is_lite_hw()
  headless_hide_params = {
    "Brightness", "OnroadScreenOffBrightness", "OnroadScreenOffTimer",
    "InteractivityTimeout", "ScreenSaverEnabled", "ScreenSaverTimeout",
  }

  def _filter_widgets(widgets: list[dict]) -> list[dict]:
    out = []
    for w in widgets:
      if should_hide_widget(w):
        continue
      if headless and w.get("param") in headless_hide_params:
        continue
      if w.get("type") == "separator" and out and out[-1].get("type") == "separator":
        continue
      out.append(w)
    return out

  panels_out = []
  for p in PANELS:
    entry = {**p, "icon": PANEL_ICONS.get(p["id"], "")}
    widgets = _filter_widgets(list(entry.get("widgets") or []))
    if headless and p.get("id") == "display":
      entry["headless_note"] = "Built-in display settings are hidden on headless devices."
      widgets.insert(0, {
        "type": "html",
        "i18n_key": "No built-in screen — brightness and screen saver do not apply. Camera stream settings below are used by Web UI.",
      })
      widgets.insert(1, {"type": "separator"})
    entry["widgets"] = widgets
    panels_out.append(entry)
  return {
    "ok": True,
    "panels": panels_out,
    "subpanels": list(SUBPANELS.keys()),
    "headless": headless,
    "lite": lite,
    **tokens_payload(),
  }


def _collect_widget_keys(widgets: list[dict], keys: list[str], _seen: set[str] | None = None) -> None:
  seen = _seen if _seen is not None else set()
  for w in widgets:
    for dep_key in ("visible_if", "advanced_if"):
      dep = w.get(dep_key)
      if isinstance(dep, dict) and dep.get("param"):
        keys.append(dep["param"])
    if w.get("type") == "dual_button":
      for side in ("left", "right"):
        sk = (w.get(side) or {}).get("param")
        if sk:
          keys.append(sk)
      continue
    if w.get("type") == "tab" and "widgets" in w:
      _collect_widget_keys(w["widgets"], keys, seen)
      continue
    # A subpanel owns its own widgets, so its params belong to the parent's
    # coverage too - otherwise moving widgets into a subpanel would silently
    # drop them from panel_param_keys(). `seen` guards against a cycle.
    if w.get("type") == "subpanel" and w.get("target"):
      target = w["target"]
      if target not in seen:
        seen.add(target)
        sub = get_panel(target)
        if sub:
          _collect_widget_keys(sub.get("widgets", []), keys, seen)
      continue
    key = w.get("param")
    if key:
      keys.append(key)


def panel_param_keys(panel_id: str) -> list[str]:
  panel = get_panel(panel_id)
  if not panel:
    return []
  keys: list[str] = []
  _collect_widget_keys(panel.get("widgets", []), keys)
  return sorted(set(keys))
