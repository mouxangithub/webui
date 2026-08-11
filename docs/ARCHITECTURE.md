# op Web UI 架构

与 `ai/` 并行的独立子仓库，职责边界清晰：

| 仓库 | 端口 | 用途 |
|------|------|------|
| `ai/` | 5090 | op助手、TSK SecOC、RAG 等 |
| `webui/` | 5080 | 行车 raylib UI 的 Web 镜像 |

## 进程与启动

```
launch_chffrplus.sh
  ├── start_webui()     → python3 -m webui.webuid (:5080)
  ├── start_op_assistant() → python3 -m ai.aid (:5090)
  └── ./manager.py
```

两者互不 import，仅共享 openpilot 运行时（`Params`、`cereal`、可选 `webrtcd`）。

## 后端分层

```
webuid.py
  └── server/app_factory.py
        └── routes/          REST + 静态文件
        └── bridge/
              params_api.py  # openpilot.common.params
              state_api.py   # SubMaster 快照
```

## 前端

- 设计基准：openpilot `selfdrive/ui`，`BIG=1` → 2160×1080
- `web/static/js/`：`app.js`（状态机）、`panels.js`（15 面板）、`onroad.js`（HUD/WebRTC）
- 状态机：`home` | `settings` | `onroad`

## 相机（规划中）

设备侧 `camerad` → VisionIPC；浏览器侧计划经 `webrtcd:5001`（需 `IsLiveStreaming`）。

## 依赖

- Python 3.10+（车机常用 3.12）
- `aiohttp`（AGNOS venv 通常已带）
- 运行时需 `PYTHONPATH=<openpilot_root>` 以加载 `openpilot.*`
