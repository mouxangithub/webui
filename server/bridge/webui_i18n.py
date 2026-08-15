"""WebUI-only i18n strings (merged into snapshot_i18n on top of openpilot .po)."""

from __future__ import annotations

# English keys are msgids used in tr() — values are translations per po file suffix.
_WEBUI_STRINGS: dict[str, dict[str, str]] = {
  "en": {
    "Web UI": "Web UI",
    "Web UI update available": "Web UI update available",
    "Web UI is up to date": "Web UI is up to date",
    "New commits on {branch}": "New commits on {branch}",
    "No new commit messages.": "No new commit messages.",
    "Changes": "Changes",
    "Current": "Current",
    "Available": "Available",
    "This updates only the Web UI files, not openpilot firmware.": (
      "This updates only the Web UI files, not openpilot firmware."
    ),
    "Check again": "Check again",
    "Update now": "Update now",
    "Later": "Later",
    "Updating...": "Updating...",
    "Checking...": "Checking...",
    "Update status unavailable": "Update status unavailable",
    "Update available: {local} → {remote}": "Update available: {local} → {remote}",
    "Up to date ({commit})": "Up to date ({commit})",
    "Home data failed to load": "Home data failed to load",
    "PC preview — some data is mocked and may differ from the device": (
      "PC preview — some data is mocked and may differ from the device"
    ),
    "Driving state unavailable": "Driving state unavailable",
    "Unknown error": "Unknown error",
    "WebSocket and HTTP bootstrap failed": "WebSocket and HTTP bootstrap failed",
    "No response": "No response",
    "WebUI not ready — run py -3 webui/dev/run_pc.py for local preview": (
      "WebUI not ready — run py -3 webui/dev/run_pc.py for local preview"
    ),
    "WebSocket disconnected — confirm the webui service is running": (
      "WebSocket disconnected — confirm the webui service is running"
    ),
    "AGNOS Update": "AGNOS Update",
    "Operating system update required (~1GB download).": "Operating system update required (~1GB download).",
    "AGNOS update started": "AGNOS update started",
    "Rebooting...": "Rebooting...",
    "Installing AGNOS update...": "Installing AGNOS update...",
    "Preparing AGNOS update...": "Preparing AGNOS update...",
    "Rebooting to apply AGNOS update...": "Rebooting to apply AGNOS update...",
    "AGNOS update complete — rebooting...": "AGNOS update complete — rebooting...",
    "Do not power off the device.": "Do not power off the device.",
    "This may take several minutes. Do not power off the device.": "This may take several minutes. Do not power off the device.",
    "Waiting for device to restart...": "Waiting for device to restart...",
    "Device restarting... ({s}s)": "Device restarting... ({s}s)",
    "Reconnecting to device...": "Reconnecting to device...",
    "Update complete — device is back online": "Update complete — device is back online",
    "Connection timed out": "Connection timed out",
    "The device did not come back online in time. It may still be updating — wait a minute and refresh the page.": (
      "The device did not come back online in time. It may still be updating — wait a minute and refresh the page."
    ),
    "Update failed": "Update failed",
    "AGNOS update failed": "AGNOS update failed",
    "Installing Update": "Installing Update",
    "Applying update — device will reboot shortly...": "Applying update — device will reboot shortly...",
    "Rebooting": "Rebooting",
    "Rebooting device...": "Rebooting device...",
    "Device is back online": "Device is back online",
    "Reboot failed": "Reboot failed",
    "AGNOS update pending": "AGNOS update pending",
    "Software · AGNOS": "Software · AGNOS",
    "Camera unavailable": "Camera unavailable",
    "SSH keys updated": "SSH keys updated",
    "SSH keys removed": "SSH keys removed",
    "Loading camera...": "Loading camera...",
    "PC Dev simulation": "PC Dev simulation",
    "Override": "Override",
    "On road": "On road",
    "Engaged": "Engaged",
    "Experimental": "Experimental",
    "Recording microphone": "Recording microphone",
    "Speed": "Speed",
    "Not selected": "Not selected",
    "Select a country first": "Select a country first",
    "Calculating...": "Calculating...",
    "Starting camera service…": "Starting camera service…",
    "Waking webrtcd…": "Waking webrtcd…",
    "Starting live stream service (~4s)…": "Starting live stream service (~4s)…",
    "Starting live stream service ({s}s)…": "Starting live stream service ({s}s)…",
    "Bookmark route": "Bookmark route",
    "Route bookmarked": "Route bookmarked",
    "Home": "Home",
    "Cannot start driving": "Cannot start driving",
    "Manager failed to start": "Manager failed to start",
    "No built-in display — use this Web UI as your primary interface. USB: https://10.255.128.121:5080/ or your device IP.": (
      "No built-in display — use this Web UI as your primary interface. USB: https://10.255.128.121:5080/ or your device IP."
    ),
    "Only available while offroad": "Only available while offroad",
    "Upload driver camera data to improve driver monitoring? You can change this later in Toggles.": (
      "Upload driver camera data to improve driver monitoring? You can change this later in Toggles."
    ),
    "Enable": "Enable",
    "Not now": "Not now",
    "Headless (no display)": "Headless (no display)",
    "Connect vehicle ignition to start driving": "Connect vehicle ignition to start driving",
    "Wait a moment after toggling offroad mode": "Wait a moment after toggling offroad mode",
    "Device temperature too high — wait for cooldown": "Device temperature too high — wait for cooldown",
    "Disable Always Offroad mode in Device settings": "Disable Always Offroad mode in Device settings",
    "Accept the Terms of Service (complete onboarding or Device settings)": (
      "Accept the Terms of Service (complete onboarding or Device settings)"
    ),
    "Accept the sunnypilot Terms of Service": "Accept the sunnypilot Terms of Service",
    "Complete the training guide (Device → Training Guide)": "Complete the training guide (Device → Training Guide)",
    "Disable driver camera preview before driving": "Disable driver camera preview before driving",
    "Device too hot to start — wait for cooldown": "Device too hot to start — wait for cooldown",
    "Device is still booting — wait a moment": "Device is still booting — wait a moment",
    "Free up storage (less than 2% space remaining)": "Free up storage (less than 2% space remaining)",
    "Connect to the internet to finish software update checks": "Connect to the internet to finish software update checks",
    "Acknowledge excessive actuation alert on the home screen": "Acknowledge excessive actuation alert on the home screen",
    "Uninstall in progress": "Uninstall in progress",
    "Restarting webrtcd…": "Restarting webrtcd…",
    "WebRTC negotiating (first time ~30s)…": "WebRTC negotiating (first time ~30s)…",
    "WebRTC negotiating…": "WebRTC negotiating…",
    "Buffering camera…": "Buffering camera…",
    "Switching to driver camera…": "Switching to driver camera…",
    "WebRTC connection failed ({})": "WebRTC connection failed ({})",
    "camera starting": "camera starting",
    "Driver monitoring": "Driver monitoring",
    "Close": "Close",
    "Enter your GitHub username": "Enter your GitHub username",
    "Preview quality": "Preview quality",
    "Auto": "Auto",
    "Smooth": "Smooth",
    "Standard": "Standard",
    "HD": "HD",
    "Preview quality updated": "Preview quality updated",
    "Weak network — preview switched to smooth mode": "Weak network — preview switched to smooth mode",
    "Device warm — preview switched to smooth mode": "Device warm — preview switched to smooth mode",
    "Livestream diagnostics": "Livestream diagnostics",
    "Livestream": "Livestream",
    "webrtcd": "webrtcd",
    "Bitrate": "Bitrate",
    "Camera": "Camera",
    "Thermal": "Thermal",
    "CPU temp": "CPU temp",
    "Memory": "Memory",
    "On": "On",
    "Off": "Off",
    "Turn on": "Turn on",
    "SD": "SD",
    "webui_headless_mode_desc": (
      "Headless mode uses Web UI as the primary interface. Auto detects the built-in screen. "
      "Turn on forces headless and skips detection at startup. Off requires a built-in display."
    ),
    "webui_preview_quality_desc": (
      "Camera preview quality for Web UI livestream. Off disables camera preview and lane overlay "
      "but keeps speed and HUD. Auto lowers bitrate on weak network or when the device is warm. "
      "Does not affect driving recordings."
    ),
    "webui_hardware_decode_desc": "Use WebCodecs for lower preview latency when supported.",
    "Headless mode": "Headless mode",
    "Headless mode updated": "Headless mode updated",
    "Headless mode update failed": "Headless mode update failed",
    "No built-in display — headless cannot be turned off": (
      "No built-in display — headless cannot be turned off"
    ),
    "No built-in display — use this Web UI as your primary interface.": (
      "No built-in display — use this Web UI as your primary interface."
    ),
    "Headless mode uses Web UI as the primary interface. Auto detects the built-in screen. On forces headless and skips detection at startup. Off requires a built-in display.": (
      "Headless mode uses Web UI as the primary interface. Auto detects the built-in screen. On forces headless and skips detection at startup. Off requires a built-in display."
    ),
    "Camera preview quality for Web UI livestream. Off disables camera preview and lane overlay but keeps speed and HUD. Auto lowers bitrate on weak network or when the device is warm. Does not affect driving recordings.": (
      "Camera preview quality for Web UI livestream. Off disables camera preview and lane overlay but keeps speed and HUD. Auto lowers bitrate on weak network or when the device is warm. Does not affect driving recordings."
    ),
    "No built-in screen — brightness and screen saver do not apply. Camera stream settings below are used by Web UI.": (
      "No built-in screen — brightness and screen saver do not apply. Camera stream settings below are used by Web UI."
    ),
    "Camera preview quality for Web UI livestream. Auto lowers bitrate on weak network or when the device is warm. Does not affect driving recordings.": (
      "Camera preview quality for Web UI livestream. Auto lowers bitrate on weak network or when the device is warm. Does not affect driving recordings."
    ),
    "Encoder busy — preview switched to smooth mode": "Encoder busy — preview switched to smooth mode",
    "Hardware decode": "Hardware decode",
    "Use WebCodecs for lower preview latency when supported.": "Use WebCodecs for lower preview latency when supported.",
    "WebCodecs is not available in this browser.": "WebCodecs is not available in this browser.",
    "WebCodecs requires HTTPS or localhost. On the device use https://<IP>:5080/ (trust the certificate once).": (
      "WebCodecs requires HTTPS or localhost. On the device use https://<IP>:5080/ (trust the certificate once)."
    ),
    "Hardware decode setting updated": "Hardware decode setting updated",
    "Encoder lag": "Encoder lag",
    "Yes": "Yes",
    "No": "No",
    "Model list is still loading. Tap Refresh Model List and try again.": (
      "Model list is still loading. Tap Refresh Model List and try again."
    ),
    "Decode path": "Decode path",
    "WebCodecs (browser HW)": "WebCodecs (browser HW)",
    "Video element (browser HW)": "Video element (browser HW)",
    "ACC.": "ACC.",
    "L.S.": "L.S.",
    "FRIC.": "FRIC.",
    "L.A.F.": "L.A.F.",
    "E.T.": "E.T.",
    "B.D.": "B.D.",
    "ALT.": "ALT.",
    "REL DIST": "REL DIST",
    "REL SPEED": "REL SPEED",
    "REAL STEER": "REAL STEER",
    "DESIRED STEER": "DESIRED STEER",
    "DESIRED L.A.": "DESIRED L.A.",
    "ACTUAL L.A.": "ACTUAL L.A.",
    "m/s^2": "m/s²",
    "N·dm": "N·dm",
    "MAX": "MAX",
    "AHEAD": "AHEAD",
    "SPEED": "SPEED",
    "LIMIT": "LIMIT",
    "OFF": "OFF",
    "N": "N",
    "NE": "NE",
    "E": "E",
    "SE": "SE",
    "S": "S",
    "SW": "SW",
    "W": "W",
    "NW": "NW",
    "Offroad": "Offroad",
    "On road · Engaged": "On road · Engaged",
    "On road · Disengaged": "On road · Disengaged",
    "Lateral only": "Lateral only",
    "Critical alert": "Critical alert",
    "E2E green": "E2E green",
    "Standstill timer": "Standstill timer",
    "Longitudinal only": "Longitudinal only",
    "Full-screen alert": "Full-screen alert",
    "Home · Update": "Home · Update",
    "Home · Alerts": "Home · Alerts",
    "Driving preview": "Driving preview",
    "Open link": "Open link",
    "Scan QR code": "Scan QR code",
    "Sponsor sunnylink": "Sponsor sunnylink",
    "Wi-Fi": "Wi-Fi",
    "GREEN\nLIGHT": "GREEN\nLIGHT",
    "LEAD VEHICLE\nDEPARTING": "LEAD VEHICLE\nDEPARTING",
    "STOPPED": "STOPPED",
    "Using offline region list (partial)": "Using offline region list (partial)",
    "Using offline region list": "Using offline region list",
    "Confidence · low": "Confidence · low",
    "Confidence · high": "Confidence · high",
    "On road · overlay": "On road · overlay",
    "Using cached region list": "Using cached region list",
    "UPDATE": "UPDATE",
    "{} ALERT": "{} ALERT",
    "{} ALERTS": "{} ALERTS",
    "Welcome to sunnypilot": "Welcome to sunnypilot",
    "You must accept the Terms of Service to use sunnypilot. Read the latest terms at https://sunnypilot.ai/terms before continuing.": (
      "You must accept the Terms of Service to use sunnypilot. Read the latest terms at https://sunnypilot.ai/terms before continuing."
    ),
    "You must accept the Terms of Service in order to use sunnypilot.": (
      "You must accept the Terms of Service in order to use sunnypilot."
    ),
    "Decline": "Decline",
    "Agree": "Agree",
    "Skip": "Skip",
    "Next": "Next",
    "Back": "Back",
    "Decline, uninstall sunnypilot": "Decline, uninstall sunnypilot",
    "No built-in display — use this Web UI as your primary interface.": (
      "No built-in display — use this Web UI as your primary interface."
    ),
    "Web Stream": "Web Stream",
    "No built-in screen — brightness and screen saver do not apply. Camera stream settings below are used by Web UI.": (
      "No built-in screen — brightness and screen saver do not apply. Camera stream settings below are used by Web UI."
    ),
    "Driver Camera Preview enabled": "Driver Camera Preview enabled",
    "Driver Camera Preview disabled": "Driver Camera Preview disabled",
    "Offroad only. Enables camerad for driver-facing preview in WebUI. Blocks onroad while enabled.": (
      "Offroad only. Enables camerad for driver-facing preview in WebUI. Blocks onroad while enabled."
    ),
    "Enable driver camera preview in Web UI while offroad. Turn off before driving.": (
      "Enable driver camera preview in Web UI while offroad. Turn off before driving."
    ),
  },
  "zh-CHS": {
    "Web UI": "Web UI",
    "Web UI update available": "有 Web UI 更新",
    "Web UI is up to date": "Web UI 已是最新版本",
    "New commits on {branch}": "{branch} 分支有新提交",
    "No new commit messages.": "暂无提交说明。",
    "Changes": "变更内容",
    "Current": "当前",
    "Available": "可用",
    "This updates only the Web UI files, not openpilot firmware.": (
      "仅更新 Web UI 文件，不会更新 openpilot 固件。"
    ),
    "Check again": "再次检查",
    "Update now": "立即更新",
    "Later": "稍后",
    "Updating...": "正在更新...",
    "Checking...": "正在检查...",
    "Update status unavailable": "无法获取更新状态",
    "Update available: {local} → {remote}": "有可用更新：{local} → {remote}",
    "Up to date ({commit})": "已是最新（{commit}）",
    "Home data failed to load": "首页数据加载失败",
    "PC preview — some data is mocked and may differ from the device": (
      "PC 预览 — 部分数据为模拟，可能与设备不同"
    ),
    "Driving state unavailable": "无法获取行车状态",
    "Unknown error": "未知错误",
    "WebSocket and HTTP bootstrap failed": "WebSocket 与 HTTP 引导均失败",
    "No response": "无响应",
    "WebUI not ready — run py -3 webui/dev/run_pc.py for local preview": (
      "WebUI 未就绪 — 请运行 py -3 webui/dev/run_pc.py 进行本地预览"
    ),
    "WebSocket disconnected — confirm the webui service is running": (
      "WebSocket 已断开 — 请确认 webui 服务正在运行"
    ),
    "AGNOS Update": "AGNOS 系统更新",
    "Operating system update required (~1GB download).": "需要更新操作系统（约 1GB 下载）。",
    "AGNOS update started": "AGNOS 更新已开始",
    "Rebooting...": "正在重启…",
    "Installing AGNOS update...": "正在安装 AGNOS 更新…",
    "Preparing AGNOS update...": "正在准备 AGNOS 更新…",
    "Rebooting to apply AGNOS update...": "正在重启以应用 AGNOS 更新…",
    "AGNOS update complete — rebooting...": "AGNOS 更新完成，正在重启…",
    "Do not power off the device.": "请勿断电或关机。",
    "This may take several minutes. Do not power off the device.": "可能需要数分钟，请勿断电或关机。",
    "Waiting for device to restart...": "等待设备重启…",
    "Device restarting... ({s}s)": "设备正在重启…（{s} 秒）",
    "Reconnecting to device...": "正在重新连接设备…",
    "Update complete — device is back online": "更新完成，设备已重新上线",
    "Connection timed out": "连接超时",
    "The device did not come back online in time. It may still be updating — wait a minute and refresh the page.": (
      "设备未能及时重新上线，可能仍在更新中 — 请稍等片刻后刷新页面。"
    ),
    "Update failed": "更新失败",
    "AGNOS update failed": "AGNOS 更新失败",
    "Installing Update": "正在安装更新",
    "Applying update — device will reboot shortly...": "正在应用更新，设备即将重启…",
    "Rebooting": "正在重启",
    "Rebooting device...": "正在重启设备…",
    "Device is back online": "设备已重新上线",
    "Reboot failed": "重启失败",
    "AGNOS update pending": "AGNOS 待更新",
    "Software · AGNOS": "软件 · AGNOS",
    "Camera unavailable": "相机不可用",
    "SSH keys updated": "SSH 密钥已更新",
    "SSH keys removed": "SSH 密钥已移除",
    "Loading camera...": "正在加载相机...",
    "PC Dev simulation": "PC Dev 模拟",
    "Override": "接管",
    "On road": "已上路",
    "Engaged": "已激活",
    "Experimental": "实验模式",
    "Recording microphone": "录音麦克风",
    "Speed": "车速",
    "Not selected": "未选择",
    "Select a country first": "请先选择国家",
    "Calculating...": "正在计算...",
    "Starting camera service…": "正在启动相机服务…",
    "Waking webrtcd…": "正在唤醒 webrtcd…",
    "Starting live stream service (~4s)…": "正在启动直播服务（约 4 秒）…",
    "Starting live stream service ({s}s)…": "正在启动直播服务（{s} 秒）…",
    "Bookmark route": "收藏路线",
    "Route bookmarked": "路线已收藏",
    "Home": "主页",
    "Cannot start driving": "无法开始驾驶",
    "Manager failed to start": "管理器启动失败",
    "No built-in display — use this Web UI as your primary interface. USB: https://10.255.128.121:5080/ or your device IP.": (
      "无内置屏幕 — 请将此 Web UI 作为主界面。USB 连接：https://10.255.128.121:5080/ 或使用设备 IP。"
    ),
    "Only available while offroad": "仅在离路时可用",
    "Upload driver camera data to improve driver monitoring? You can change this later in Toggles.": (
      "上传驾驶员相机数据以改进驾驶员监控？稍后可于开关中更改。"
    ),
    "Enable": "启用",
    "Not now": "暂不",
    "Headless (no display)": "无屏模式",
    "Connect vehicle ignition to start driving": "请连接车辆点火以开始驾驶",
    "Wait a moment after toggling offroad mode": "切换离路模式后请稍候",
    "Device temperature too high — wait for cooldown": "设备温度过高 — 请等待冷却",
    "Disable Always Offroad mode in Device settings": "请在设备设置中关闭「始终离路」模式",
    "Accept the Terms of Service (complete onboarding or Device settings)": (
      "请接受服务条款（完成引导或在设备设置中操作）"
    ),
    "Accept the sunnypilot Terms of Service": "请接受 sunnypilot 服务条款",
    "Complete the training guide (Device → Training Guide)": "请完成训练指南（设备 → 训练指南）",
    "Disable driver camera preview before driving": "驾驶前请关闭驾驶员相机预览",
    "Device too hot to start — wait for cooldown": "设备过热无法启动 — 请等待冷却",
    "Device is still booting — wait a moment": "设备仍在启动 — 请稍候",
    "Free up storage (less than 2% space remaining)": "请释放存储空间（剩余不足 2%）",
    "Connect to the internet to finish software update checks": "请连接互联网以完成软件更新检查",
    "Acknowledge excessive actuation alert on the home screen": "请在主页确认过度执行告警",
    "Uninstall in progress": "正在卸载",
    "Restarting webrtcd…": "正在重启 webrtcd…",
    "WebRTC negotiating (first time ~30s)…": "WebRTC 握手中（首次约 30 秒）…",
    "WebRTC negotiating…": "WebRTC 握手中…",
    "Buffering camera…": "相机缓冲中…",
    "Switching to driver camera…": "正在切换到驾驶员相机…",
    "WebRTC connection failed ({})": "WebRTC 连接失败（{}）",
    "camera starting": "相机启动中",
    "Driver monitoring": "驾驶员监控",
    "Close": "关闭",
    "Enter your GitHub username": "输入您的 GitHub 用户名",
    "Preview quality": "预览画质",
    "Auto": "自动",
    "Smooth": "流畅",
    "Standard": "标准",
    "HD": "高清",
    "Preview quality updated": "预览画质已更新",
    "Weak network — preview switched to smooth mode": "网络较弱，已切换为流畅预览",
    "Device warm — preview switched to smooth mode": "设备温度较高，已切换为流畅预览",
    "Livestream diagnostics": "直播诊断",
    "Livestream": "直播",
    "webrtcd": "webrtcd",
    "Bitrate": "码率",
    "Camera": "相机",
    "Thermal": "温度",
    "CPU temp": "CPU 温度",
    "Memory": "内存",
    "On": "开启",
    "Off": "关",
    "Turn on": "开启",
    "SD": "标清",
    "webui_headless_mode_desc": (
      "无屏模式将 Web UI 作为主界面。自动会检测内置屏幕；开启强制无屏并在启动时跳过检测；关闭需要内置屏幕。"
    ),
    "webui_preview_quality_desc": (
      "Web UI 相机预览画质。关闭时不显示相机预览和车道线，仍保留时速和 HUD。"
      "自动模式在弱网或设备发热时降低码率，不影响行车录像。"
    ),
    "webui_hardware_decode_desc": "浏览器支持时使用 WebCodecs 降低预览延迟。",
    "Headless mode": "无屏模式",
    "Headless mode updated": "无屏模式已更新",
    "Headless mode update failed": "无屏模式更新失败",
    "No built-in display — headless cannot be turned off": "无内置屏幕 — 无法关闭无屏模式",
    "No built-in display — use this Web UI as your primary interface.": (
      "无内置屏幕 — 请将此 Web UI 作为主界面。"
    ),
    "Headless mode uses Web UI as the primary interface. Auto detects the built-in screen. On forces headless and skips detection at startup. Off requires a built-in display.": (
      "无屏模式将 Web UI 作为主界面。自动会检测内置屏幕；开强制无屏并在启动时跳过检测；关需要内置屏幕。"
    ),
    "Camera preview quality for Web UI livestream. Off disables camera preview and lane overlay but keeps speed and HUD. Auto lowers bitrate on weak network or when the device is warm. Does not affect driving recordings.": (
      "Web UI 相机预览画质。关闭时不显示相机预览和车道线，仍保留时速和 HUD。自动模式在弱网或设备发热时降低码率，不影响行车录像。"
    ),
    "No built-in screen — brightness and screen saver do not apply. Camera stream settings below are used by Web UI.": (
      "无内置屏幕 — 亮度与屏保设置不适用。下方为 Web UI 使用的相机流设置。"
    ),
    "Camera preview quality for Web UI livestream. Auto lowers bitrate on weak network or when the device is warm. Does not affect driving recordings.": (
      "Web UI 相机预览画质。自动模式会在弱网或设备发热时降低码率，不影响行车录像。"
    ),
    "Encoder busy — preview switched to smooth mode": "编码器繁忙，已切换为流畅预览",
    "Hardware decode": "硬件解码",
    "Use WebCodecs for lower preview latency when supported.": "浏览器支持时使用 WebCodecs 降低预览延迟。",
    "WebCodecs is not available in this browser.": "此浏览器不支持 WebCodecs。",
    "WebCodecs requires HTTPS or localhost. On the device use https://<IP>:5080/ (trust the certificate once).": (
      "WebCodecs 需要 HTTPS 或 localhost。车机请用 https://<IP>:5080/ 访问（首次需在浏览器信任自签证书）。"
    ),
    "Hardware decode setting updated": "硬件解码设置已更新",
    "Encoder lag": "编码延迟",
    "Yes": "是",
    "No": "否",
    "Model list is still loading. Tap Refresh Model List and try again.": (
      "模型列表尚未就绪，请先点击「刷新模型列表」后再试。"
    ),
    "Decode path": "解码路径",
    "WebCodecs (browser HW)": "WebCodecs（浏览器硬解）",
    "Video element (browser HW)": "Video 元素（浏览器硬解）",
    "ACC.": "加速度",
    "L.S.": "前车速度",
    "FRIC.": "摩擦系数",
    "L.A.F.": "横向因子",
    "E.T.": "转向扭矩",
    "B.D.": "方位角",
    "ALT.": "海拔",
    "REL DIST": "相对距离",
    "REL SPEED": "相对速度",
    "REAL STEER": "实际转向",
    "DESIRED STEER": "目标转向",
    "DESIRED L.A.": "目标横向加速度",
    "ACTUAL L.A.": "实际横向加速度",
    "m/s^2": "m/s²",
    "N·dm": "N·dm",
    "MAX": "最大",
    "AHEAD": "前方",
    "SPEED": "SPEED",
    "LIMIT": "LIMIT",
    "OFF": "关",
    "N": "北",
    "NE": "东北",
    "E": "东",
    "SE": "东南",
    "S": "南",
    "SW": "西南",
    "W": "西",
    "NW": "西北",
    "Offroad": "离路",
    "On road · Engaged": "行驶·激活",
    "On road · Disengaged": "行驶·未激活",
    "Lateral only": "仅横向",
    "Critical alert": "严重告警",
    "E2E green": "E2E 绿灯",
    "Standstill timer": "静止计时",
    "Longitudinal only": "仅纵向",
    "Full-screen alert": "全屏告警",
    "Home · Update": "Home·更新",
    "Home · Alerts": "Home·告警",
    "Driving preview": "行车画面预览",
    "Open link": "打开链接",
    "Scan QR code": "扫描二维码",
    "Sponsor sunnylink": "赞助 sunnylink",
    "Wi-Fi": "Wi-Fi",
    "GREEN\nLIGHT": "绿灯",
    "LEAD VEHICLE\nDEPARTING": "前车\n驶离",
    "STOPPED": "已停车",
    "Using offline region list (partial)": "使用离线区域列表（精简版）",
    "Using offline region list": "使用离线区域列表（完整）",
    "Using cached region list": "使用缓存的区域列表",
    "Confidence · low": "置信度 · 低",
    "Confidence · high": "置信度 · 高",
    "On road · overlay": "行车 · 模型叠加",
    "UPDATE": "更新",
    "{} ALERT": "{} 条告警",
    "{} ALERTS": "{} 条告警",
    "Welcome to sunnypilot": "欢迎使用 sunnypilot",
    "You must accept the Terms of Service to use sunnypilot. Read the latest terms at https://sunnypilot.ai/terms before continuing.": (
      "使用 sunnypilot 前须接受服务条款。继续前请阅读 https://sunnypilot.ai/terms"
    ),
    "You must accept the Terms of Service in order to use sunnypilot.": (
      "须接受服务条款才能使用 sunnypilot。"
    ),
    "Decline": "拒绝",
    "Agree": "同意",
    "Skip": "跳过",
    "Next": "下一步",
    "Back": "返回",
    "Decline, uninstall sunnypilot": "拒绝并卸载 sunnypilot",
    "No built-in display — use this Web UI as your primary interface.": (
      "无内置屏幕 — 请将此 Web UI 作为主界面。"
    ),
    "Web Stream": "Web 直播",
    "No built-in screen — brightness and screen saver do not apply. Camera stream settings below are used by Web UI.": (
      "无内置屏幕 — 亮度与屏保设置不适用。下方相机流设置供 Web UI 使用。"
    ),
    "Driver Camera Preview enabled": "驾驶员摄像头预览已开启",
    "Driver Camera Preview disabled": "驾驶员摄像头预览已关闭",
    "Offroad only. Enables camerad for driver-facing preview in WebUI. Blocks onroad while enabled.": (
      "仅离路时可用。启用 camerad 以在 WebUI 中预览驾驶员摄像头。开启后将阻止上路。"
    ),
    "Enable driver camera preview in Web UI while offroad. Turn off before driving.": (
      "离路时在 Web UI 中预览驾驶员摄像头，上路前请关闭。"
    ),
  },
  "zh-CHT": {
    "Web UI": "Web UI",
    "Web UI update available": "有 Web UI 更新",
    "Web UI is up to date": "Web UI 已是最新版本",
    "New commits on {branch}": "{branch} 分支有新提交",
    "No new commit messages.": "暫無提交說明。",
    "Changes": "變更內容",
    "Current": "目前",
    "Available": "可用",
    "This updates only the Web UI files, not openpilot firmware.": (
      "僅更新 Web UI 檔案，不會更新 openpilot 韌體。"
    ),
    "Check again": "再次檢查",
    "Update now": "立即更新",
    "Later": "稍後",
    "Updating...": "正在更新...",
    "Checking...": "正在檢查...",
    "Update status unavailable": "無法取得更新狀態",
    "Update available: {local} → {remote}": "有可用更新：{local} → {remote}",
    "Up to date ({commit})": "已是最新（{commit}）",
    "Home data failed to load": "首頁資料載入失敗",
    "PC preview — some data is mocked and may differ from the device": (
      "PC 預覽 — 部分資料為模擬，可能與裝置不同"
    ),
    "Driving state unavailable": "無法取得行車狀態",
    "Unknown error": "未知錯誤",
    "WebSocket and HTTP bootstrap failed": "WebSocket 與 HTTP 引導均失敗",
    "No response": "無回應",
    "WebUI not ready — run py -3 webui/dev/run_pc.py for local preview": (
      "WebUI 未就緒 — 請執行 py -3 webui/dev/run_pc.py 進行本機預覽"
    ),
    "WebSocket disconnected — confirm the webui service is running": (
      "WebSocket 已斷線 — 請確認 webui 服務正在執行"
    ),
    "Camera unavailable": "相機不可用",
    "SSH keys updated": "SSH 金鑰已更新",
    "SSH keys removed": "SSH 金鑰已移除",
    "Loading camera...": "正在載入相機...",
    "PC Dev simulation": "PC Dev 模擬",
    "Override": "接管",
    "On road": "已上路",
    "Engaged": "已啟用",
    "Experimental": "實驗模式",
    "Recording microphone": "錄音麥克風",
    "Speed": "車速",
    "Not selected": "未選擇",
    "Select a country first": "請先選擇國家",
    "Calculating...": "正在計算...",
    "Starting camera service…": "正在啟動相機服務…",
    "Waking webrtcd…": "正在喚醒 webrtcd…",
    "Starting live stream service (~4s)…": "正在啟動直播服務（約 4 秒）…",
    "Starting live stream service ({s}s)…": "正在啟動直播服務（{s} 秒）…",
    "Bookmark route": "收藏路線",
    "Route bookmarked": "路線已收藏",
    "Home": "主頁",
    "Cannot start driving": "無法開始駕駛",
    "Manager failed to start": "管理器啟動失敗",
    "No built-in display — use this Web UI as your primary interface. USB: https://10.255.128.121:5080/ or your device IP.": (
      "無內建螢幕 — 請將此 Web UI 作為主介面。USB 連線：https://10.255.128.121:5080/ 或使用裝置 IP。"
    ),
    "Only available while offroad": "僅在離路時可用",
    "Upload driver camera data to improve driver monitoring? You can change this later in Toggles.": (
      "上傳駕駛員相機資料以改進駕駛員監控？稍後可於開關中變更。"
    ),
    "Enable": "啟用",
    "Not now": "暫不",
    "Headless (no display)": "無螢幕模式",
    "Connect vehicle ignition to start driving": "請連接車輛點火以開始駕駛",
    "Wait a moment after toggling offroad mode": "切換離路模式後請稍候",
    "Device temperature too high — wait for cooldown": "裝置溫度過高 — 請等待冷卻",
    "Disable Always Offroad mode in Device settings": "請在裝置設定中關閉「始終離路」模式",
    "Accept the Terms of Service (complete onboarding or Device settings)": (
      "請接受服務條款（完成引導或在裝置設定中操作）"
    ),
    "Accept the sunnypilot Terms of Service": "請接受 sunnypilot 服務條款",
    "Complete the training guide (Device → Training Guide)": "請完成訓練指南（裝置 → 訓練指南）",
    "Disable driver camera preview before driving": "駕駛前請關閉駕駛員相機預覽",
    "Device too hot to start — wait for cooldown": "裝置過熱無法啟動 — 請等待冷卻",
    "Device is still booting — wait a moment": "裝置仍在啟動 — 請稍候",
    "Free up storage (less than 2% space remaining)": "請釋放儲存空間（剩餘不足 2%）",
    "Connect to the internet to finish software update checks": "請連接網際網路以完成軟體更新檢查",
    "Acknowledge excessive actuation alert on the home screen": "請在主頁確認過度執行告警",
    "Uninstall in progress": "正在解除安裝",
    "Restarting webrtcd…": "正在重啟 webrtcd…",
    "WebRTC negotiating (first time ~30s)…": "WebRTC 握手中（首次約 30 秒）…",
    "WebRTC negotiating…": "WebRTC 握手中…",
    "Buffering camera…": "相機緩衝中…",
    "Switching to driver camera…": "正在切換到駕駛員相機…",
    "WebRTC connection failed ({})": "WebRTC 連線失敗（{}）",
    "camera starting": "相機啟動中",
    "Driver monitoring": "駕駛員監控",
    "Close": "關閉",
    "Enter your GitHub username": "輸入您的 GitHub 使用者名稱",
    "Preview quality": "預覽畫質",
    "Auto": "自動",
    "Smooth": "流暢",
    "Standard": "標準",
    "HD": "高清",
    "Preview quality updated": "預覽畫質已更新",
    "Weak network — preview switched to smooth mode": "網路較弱，已切換為流暢預覽",
    "Device warm — preview switched to smooth mode": "裝置溫度較高，已切換為流暢預覽",
    "Livestream diagnostics": "直播診斷",
    "Livestream": "直播",
    "webrtcd": "webrtcd",
    "Bitrate": "碼率",
    "Camera": "相機",
    "Thermal": "溫度",
    "CPU temp": "CPU 溫度",
    "Memory": "記憶體",
    "On": "開啟",
    "Off": "關",
    "Turn on": "開啟",
    "SD": "標清",
    "webui_headless_mode_desc": (
      "無螢幕模式將 Web UI 作為主介面。自動會偵測內建螢幕；開啟強制無螢幕並在啟動時跳過偵測；關閉需要內建螢幕。"
    ),
    "webui_preview_quality_desc": (
      "Web UI 相機預覽畫質。關閉時不顯示相機預覽和車道線，仍保留時速和 HUD。"
      "自動模式在弱網或裝置發熱時降低碼率，不影響行車錄影。"
    ),
    "webui_hardware_decode_desc": "瀏覽器支援時使用 WebCodecs 降低預覽延遲。",
    "Headless mode": "無螢幕模式",
    "Headless mode updated": "無螢幕模式已更新",
    "Headless mode update failed": "無螢幕模式更新失敗",
    "No built-in display — headless cannot be turned off": "無內建螢幕 — 無法關閉無螢幕模式",
    "No built-in display — use this Web UI as your primary interface.": (
      "無內建螢幕 — 請將此 Web UI 作為主介面。"
    ),
    "Headless mode uses Web UI as the primary interface. Auto detects the built-in screen. On forces headless and skips detection at startup. Off requires a built-in display.": (
      "無螢幕模式將 Web UI 作為主介面。自動會偵測內建螢幕；開強制無螢幕並在啟動時跳過偵測；關需要內建螢幕。"
    ),
    "Camera preview quality for Web UI livestream. Off disables camera preview and lane overlay but keeps speed and HUD. Auto lowers bitrate on weak network or when the device is warm. Does not affect driving recordings.": (
      "Web UI 相機預覽畫質。關閉時不顯示相機預覽和車道線，仍保留時速和 HUD。自動模式在弱網或裝置發熱時降低碼率，不影響行車錄影。"
    ),
    "No built-in screen — brightness and screen saver do not apply. Camera stream settings below are used by Web UI.": (
      "無內建螢幕 — 亮度與螢幕保護設定不適用。下方為 Web UI 使用的相機串流設定。"
    ),
    "Camera preview quality for Web UI livestream. Auto lowers bitrate on weak network or when the device is warm. Does not affect driving recordings.": (
      "Web UI 相機預覽畫質。自動模式會在弱網或裝置發熱時降低碼率，不影響行車錄影。"
    ),
    "Encoder busy — preview switched to smooth mode": "編碼器繁忙，已切換為流暢預覽",
    "Hardware decode": "硬體解碼",
    "Use WebCodecs for lower preview latency when supported.": "瀏覽器支援時使用 WebCodecs 降低預覽延遲。",
    "WebCodecs is not available in this browser.": "此瀏覽器不支援 WebCodecs。",
    "WebCodecs requires HTTPS or localhost. On the device use https://<IP>:5080/ (trust the certificate once).": (
      "WebCodecs 需要 HTTPS 或 localhost。車機請用 https://<IP>:5080/ 存取（首次需在瀏覽器信任自簽憑證）。"
    ),
    "Hardware decode setting updated": "硬體解碼設定已更新",
    "Encoder lag": "編碼延遲",
    "Yes": "是",
    "No": "否",
    "Model list is still loading. Tap Refresh Model List and try again.": (
      "模型列表尚未就緒，請先點擊「重新整理模型列表」後再試。"
    ),
    "Decode path": "解碼路徑",
    "WebCodecs (browser HW)": "WebCodecs（瀏覽器硬解）",
    "Video element (browser HW)": "Video 元素（瀏覽器硬解）",
    "ACC.": "加速度",
    "L.S.": "前車速度",
    "FRIC.": "摩擦係數",
    "L.A.F.": "橫向因子",
    "E.T.": "轉向扭矩",
    "B.D.": "方位角",
    "ALT.": "海拔",
    "REL DIST": "相對距離",
    "REL SPEED": "相對速度",
    "REAL STEER": "實際轉向",
    "DESIRED STEER": "目標轉向",
    "DESIRED L.A.": "目標橫向加速度",
    "ACTUAL L.A.": "實際橫向加速度",
    "m/s^2": "m/s²",
    "N·dm": "N·dm",
    "MAX": "最大",
    "AHEAD": "前方",
    "SPEED": "SPEED",
    "LIMIT": "LIMIT",
    "OFF": "關",
    "N": "北",
    "NE": "東北",
    "E": "東",
    "SE": "東南",
    "S": "南",
    "SW": "西南",
    "W": "西",
    "NW": "西北",
    "No built-in display — use this Web UI as your primary interface.": (
      "無內建螢幕 — 請將此 Web UI 作為主介面。"
    ),
    "Web Stream": "Web 直播",
    "No built-in screen — brightness and screen saver do not apply. Camera stream settings below are used by Web UI.": (
      "無內建螢幕 — 亮度與螢幕保護設定不適用。下方相機串流設定供 Web UI 使用。"
    ),
    "Driver Camera Preview enabled": "駕駛員攝影機預覽已開啟",
    "Driver Camera Preview disabled": "駕駛員攝影機預覽已關閉",
    "Offroad only. Enables camerad for driver-facing preview in WebUI. Blocks onroad while enabled.": (
      "僅離路時可用。啟用 camerad 以在 WebUI 中預覽駕駛員攝影機。開啟後將阻止上路。"
    ),
    "Enable driver camera preview in Web UI while offroad. Turn off before driving.": (
      "離路時在 Web UI 中預覽駕駛員攝影機，上路前請關閉。"
    ),
  },
}


def webui_extra_strings(po_code: str, po_strings: dict[str, str] | None = None) -> dict[str, str]:
  """Return WebUI strings missing from the shared .po catalog (English fallback)."""
  po_strings = po_strings or {}
  en = _WEBUI_STRINGS.get("en", {})
  manual = _WEBUI_STRINGS.get(po_code, {})
  out: dict[str, str] = {}
  for key, en_val in en.items():
    po_val = (po_strings.get(key) or "").strip()
    manual_val = (manual.get(key) or "").strip()
    if po_val and po_val != en_val:
      continue
    if manual_val and manual_val != en_val:
      out[key] = manual_val
    else:
      out[key] = en_val
  return out
