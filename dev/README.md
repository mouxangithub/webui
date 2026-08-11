# PC 本地预览

在 Windows / macOS / Linux 上快速启动 Web UI，**无需 AGNOS 编译、cereal 或 NetworkManager**。

## 启动

在 **openpilot 根目录**执行：

```bash
py -3 webui/dev/run_pc.py
# 或
py -3 webui/dev/run_pc.py --port 5080 --host 127.0.0.1
```

浏览器打开：**http://127.0.0.1:5080/**

右下角会出现 **Dev 模拟面板**，可一键切换：

| 预设 | 效果 |
|------|------|
| 离路 Home | `started=false` |
| 行驶·已激活 | 绿框 + 车速 HUD |
| 行驶·未激活 | 蓝框 |
| Override | 灰框 |
| 仅横向 MADS | 青框 |
| 严重告警 | 底部红色告警条 |

也可手动调车速、勾选「已上路 / 已激活」、Experimental 等。

## 与车机对比

| 项 | PC 预览 (`run_pc.py`) | 车机 AGNOS |
|----|----------------------|------------|
| Params | 内存 Mock，可读写 | 真实 `/data/params` |
| 行车状态 | Dev 面板模拟 | 实时 cereal |
| 前路相机 | 无 WebRTC（占位） | `webrtcd` 真流 |
| Wi-Fi | 假网络列表 | NetworkManager |
| 模型/OSM 树形 UI | 参数级，无完整对话框 | raylib 完整控件 |
| 车道线/模型叠加 | 未实现 | VisionIPC + OpenGL |

## 依赖

```bash
pip install aiohttp
```

## 车机正式运行

```bash
cd /data/openpilot
PYTHONPATH=. python3 -m webui.webuid --port 5080
```

或由 `launch_chffrplus.sh` 自动拉起。

## 是否 1:1？

**不是。** 当前 Web UI 约覆盖车机 BIG UI 的 **功能面（设置项 + 状态机）约 70–80%**，**像素/动效/相机/模型叠加** 仍明显弱于 raylib 原生 UI。PC 预览用于**布局与交互开发**，不能替代车机验收。

完整差距清单见 [docs/GAP_VS_DEVICE.md](../docs/GAP_VS_DEVICE.md)。
