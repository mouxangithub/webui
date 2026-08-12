# WebUI ↔ 原生 BIG GUI 对齐清单

> 画布：**2160×1080**（`openpilot/system/ui` BIG UI）  
> 对照源码：`openpilot/selfdrive/ui/onroad/*`、`sunnypilot/onroad/*`、`layouts/sidebar.py`、`layouts/home.py`  
> Web 实现：`webui/web/static/*`、`webui/server/bridge/*`

**图例**：✅ 已对齐 · 🟡 近似/部分 · ❌ 未实现

最后更新：2026-08-13（v45：设定速度/E2E/停车计时器数据对齐）

---

## 10. 修复优先级（执行顺序）

### P0 — 行车视觉核心
1. ✅ 告警布局/字号/圆角
2. ✅ 边框圆角公式
3. ✅ `model_canvas.js` 车道/路径 + 实验彩虹路径动画
4. ✅ HUD 渐变、限速位置、路名、ICBM 保持

### P1 — 交互与状态
5. ✅ Developer UI / 圆形 E2E 告警 / TorqueBar
6. ✅ Exp 按钮门禁与 hold 动画
7. ✅ 书签 + 麦克风侧栏
8. ✅ DM 弧点击 → driver cam

### P2 — 离路/设置
9. ✅ Home UPDATE/ALERTS 流
10. ✅ Sunnylink Sponsor/Pair
11. ✅ Cruise/Visuals 文案与 value_map、门控
12. ✅ Toggle 图标、Trips 图标、Audiowide 字体

### P3 — 抛光
13. 🟡 网络纹理图标（仍用圆点）、Prime 勾选资产
14. 🟡 i18n（侧栏标签仍部分中文硬编码）
15. ✅ Dev 预设：`long_only`、`alert_full`、`standstill_timer`

### 视频流（WebRTC）
- ✅ 行车 livestream（`process_config` + `webrtc_stream.js`）
- ✅ 进入 onroad 自动拉流（无手动按钮）
- ✅ 居中加载提示 + 旋转指示
- ✅ 实验模式 wideRoad/road 车速滞回切换
- ✅ 驾驶员监控（notify 切 `driver` + 快路径复用 road 流）
- ✅ 页面加载 `prewarmWebrtc()`

---

## 关键缺口（仍为 🟡 或 ❌）

| 区域 | 项 | 状态 |
|------|-----|------|
| 告警 | Dev UI 偏移（mid/small） | ✅ `onroad.js` |
| 告警 | full 尺寸动态高度 | 🟡 |
| Home | Prime 勾选纹理 | ✅ 色值对齐 `prime.py` |
| 侧栏 | Wi-Fi 分级纹理 | ✅ 圆点（与 `sidebar.py` 一致） |
| Steering | Torque 版本树 JSON | ✅ `/api/opui/steering/torque-versions` |
| 模型 | shader 级精度 | 🟡 canvas 近似 |

---

## 验证方式

```bash
# PC
py -3 webui/dev/run_pc.py --port 5080

# J3
python3.12 -m webui.webuid
```

1. 强刷 `?v=44`
2. Dev：严重告警 / onroad_engaged / long_only / alert_full / standstill_timer
3. 设置：Cruise ICBM 描述、Custom ACC value_map、Visuals Chevron 门控
4. Toggles 行内图标、Trips 统计图标
5. Home 顶栏 `sunnypilot` Audiowide + 版本号
6. 行车 WebRTC + 实验模式宽角切换 + DM 驾驶员画面

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-12 | P2/P3 收尾：Cruise/Visuals/Toggles/Trips/字体/Home 品牌、彩虹路径、Dev UI 告警偏移、WebRTC 全链路（v38） |
