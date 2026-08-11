# op Web UI（openpilot 设备界面 Web 镜像）

与 `ai/` **并行**的独立子仓库：在浏览器中复刻 openpilot raylib UI（设置、相机、行车 HUD），**不依赖** op助手。

| 项目 | 说明 |
|------|------|
| 安装位置 | `<openpilot>/webui`（车机默认 `/data/openpilot/webui`） |
| Web 入口 | `http://<设备IP>:5080` |
| 进程入口 | `python3 -m webui.webuid` |
| 与 ai 关系 | 独立进程、独立端口（ai 为 `:5090`） |

## 架构

```
webuid.py                 # 进程入口（对标 ai/aid.py）
server/                   # aiohttp 传输层
  app_factory.py
  routes/                 # REST / WebSocket
  bridge/                 # openpilot 桥接（Params、cereal、WebRTC）
web/static/               # 前端（2160×1080 设计令牌 + 响应缩放）
install/
  install.sh              # 克隆到 openpilot/webui
  integrate_openpilot.py    # 写入 launch_chffrplus.sh 自启动
docs/
  ARCHITECTURE.md
```

## 快速开始

**车机安装：**

```bash
curl -fsSL https://raw.githubusercontent.com/mouxangithub/webui/main/install/install.sh | bash
```

**PC 开发：**

```bash
export OPENPILOT_ROOT=/path/to/openpilot
cd "$OPENPILOT_ROOT" && PYTHONPATH="$OPENPILOT_ROOT" python3 -m webui.webuid --port 5080
# 浏览器 http://127.0.0.1:5080
```

**已内置于 openpilot 主仓时：** `launch_chffrplus.sh` 会在 manager 启动前拉起 `webuid`（若存在 `webui/webuid.py`）。

## 路线图

- [x] 子仓库骨架 + launch 集成
- [x] Params 读写 API + Toggles 面板（MVP）
- [x] 离路首页 / 侧栏设置布局（BIG 2160×1080 壳）
- [x] 行车 HUD / 告警边框（SubMaster 轮询）
- [ ] WebRTC 前路相机（`webrtcd:5001`）
- [ ] 完整设置面板（Device / Network / Software 等）
- [ ] Sunnypilot 扩展设置面板

详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。
