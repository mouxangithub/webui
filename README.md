# op Web UI（openpilot 设备界面 Web 镜像）

与 `ai/` **并行**的独立子仓库：在浏览器中复刻 sunnypilot BIG UI（15 个设置面板 + 行车 HUD + WebRTC 相机）。

| 项目 | 说明 |
|------|------|
| 安装位置 | `<openpilot>/webui` |
| Web 入口 | `http://<设备IP>:5080` |
| 进程入口 | `python3 -m webui.webuid` |
| 与 ai | 独立进程、独立端口（ai `:5090`） |

## 功能（v0.2）

### 设置面板（15 个，对齐 sunnypilot BIG UI）

Device · Network · sunnylink · Toggles · Software · Models · Steering · Cruise · Visuals · Display · OSM · Trips · Vehicle · Firehose · Developer

- Params 读写（bool / int / choice / readonly）
- 系统动作：重启、关机、卸载、标定重置、updater、sunnylink 备份
- Wi-Fi 扫描与连接（NetworkManager / WifiManager）
- Software 分支切换与更新状态

### 行车界面（Onroad）

- 状态机：HOME / SETTINGS / ONROAD
- 边框四色：disengaged / engaged / override / lat_only / long_only
- HUD：车速、巡航设定、Experimental 指示
- 侧栏指标：网络、温度、CONNECT、VEHICLE、SUNNYLINK
- 告警条（normal / user / critical）
- WebRTC 前路相机（`webrtcd:5001`，自动拉起 `IsLiveStreaming`）

## PC 本地预览（类似 `ai/dev/run_pc.py`）

无需车机，开发机上预览布局与状态机：

```bash
py -3 webui/dev/run_pc.py --port 5080
# 浏览器 http://127.0.0.1:5080
```

右下角 **Dev 模拟面板** 可切换离路/行驶/边框色/告警。详见 [dev/README.md](dev/README.md)。

**是否 1:1 还原车机 UI？** **否** — 完整差距见 [docs/GAP_VS_DEVICE.md](docs/GAP_VS_DEVICE.md)。

## 快速开始（车机）

```bash
curl -fsSL https://raw.githubusercontent.com/mouxangithub/webui/main/install/install.sh | bash
```

车机 / 完整 openpilot 环境：

```bash
export OPENPILOT_ROOT=/path/to/openpilot
cd "$OPENPILOT_ROOT" && PYTHONPATH="$OPENPILOT_ROOT" python3 -m webui.webuid --port 5080
```

## API 概览

| 端点 | 说明 |
|------|------|
| `GET /api/opui/panels` | 面板 schema |
| `GET /api/opui/panels/{id}` | 面板当前值 |
| `PUT /api/opui/params/{key}` | 写 Param |
| `GET /api/opui/state` | 行车/UI 状态 |
| `POST /api/opui/action/{name}` | 系统动作 |
| `GET /api/opui/wifi/scan` | Wi-Fi 列表 |
| `POST /api/opui/webrtc/offer` | WebRTC SDP |

详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 已知限制

- 模型选择树形对话框、OSM 区域下载地图、驾驶员相机预览：需后续迭代
- 行车模型路径叠加层（lane lines）需 WebGL 或 canvas 渲染管线
- PC 上无 NetworkManager 时 Wi-Fi 面板显示不可用
