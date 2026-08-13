# WebUI ↔ 原生 BIG GUI 对齐清单

> 画布：**2160×1080**（`openpilot/system/ui` BIG UI）  
> 对照源码：`openpilot/selfdrive/ui/onroad/*`、`sunnypilot/onroad/*`、`layouts/sidebar.py`、`layouts/home.py`  
> Web 实现：`webui/web/static/*`、`webui/server/bridge/*`

**图例**：✅ 已对齐 · 🟡 近似/部分 · ❌ 未实现

最后更新：2026-08-13（v56：设置分段左对齐、子面板按钮宽度、行车 Dev UI 底栏）

---

## v56 新增对齐项

| 区域 | 项 | 状态 |
|------|-----|------|
| 设置 | `multiple_button` stacked（驾驶风格等）标题与分段按钮左对齐（`--segmented` + `align-items: flex-start`） | ✅ |
| 设置 | `simple_button` 宽度 800px 左对齐（对齐 `SIMPLE_BUTTON_WIDTH`） | ✅ |
| 设置 | 子面板去掉重复全宽「返回」条，仅保留顶栏 `‹` + 标题 | ✅ |
| 行车 | Dev UI 底栏 `bottom: 2×border`、z-index 高于边框，扭矩条随底栏上移 61px | ✅ |

**部署**：强刷 `?v=56`。

---

## v54 新增对齐项

| 区域 | 项 | 状态 |
|------|-----|------|
| 告警 | full 尺寸标题 top 200/270、副标题 bottom 361/420（对齐 `alert_renderer.py`） | ✅ |
| 模型 | 实验模式 `path_gradient` 后端序列化 + canvas 渐变绘制 | ✅ |
| 模型 | 非实验 `path_blend` 淡化（对齐 `_blend_filter`） | ✅ |
| i18n | 侧栏 Settings/Recording title、相机加载、确认对话框英文 key | ✅ |
| i18n | bootstrap 横幅英文 key + `tr()` | ✅ |

**部署**：`cd /data/openpilot/webui && git pull`，强刷 `?v=54`。

---

## v53 新增对齐项

| 区域 | 项 | 状态 |
|------|-----|------|
| 模型 | 标定单例、`path_polygon` 彩虹路径、HTTP 轮询兜底 | ✅ |
| 模型 | overlay 叠在 `#camera-wrap` 视频层上 | ✅ |
| 行车 | 车道线白色半透明（对齐原生） | ✅ |

**待上车验证**：车道线/彩虹路径实车显示。

---

## v51 新增对齐项

| 区域 | 项 | 状态 |
|------|-----|------|
| 视口 | 竖屏检测 `vh>vw` → `#opui-viewport` 旋转 90° + 按有效横屏尺寸缩放 | ✅ |
| Vehicle | `vehicle_brand_catalog.py` + `GET /api/opui/vehicle/brand-widgets`（Tesla/Toyota/Hyundai/Subaru） | ✅ |
| Cruise/SLA | `state_api.sla_available`；Assist 按钮门控（Tesla release / Rivian） | ✅ |
| Device | Reboot/Power Off engaged 拦截 + 确认对话框；Reset Calibration 确认 | ✅ |
| Software | Disable Updates 切换后 Reboot 确认流 | ✅ |
| Developer | Alpha Longitudinal rich 确认（AEB 警告文案） | ✅ |
| SunnyLink | 启用前 Consent 两步流程 + `CompletedSunnylinkConsentVersion` | ✅ |
| Models | 选模型仅 offroad 可用 | ✅ |

**部署**：`cd /data/openpilot/webui && git pull`，强刷 `?v=54`。

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

## v48 新增对齐项

| 区域 | 项 | 状态 |
|------|-----|------|
| 告警 | 合成告警（Unavailable / Unresponsive / TAKE CONTROL） | ✅ `state_api._resolve_alert` + `tr()` |
| DM | 人脸轮廓 spline（33 keypoints） | ✅ `face_outline` + SVG polyline |
| DM | 姿态弧 h/v + RHD + dev-bottom 偏移 | ✅ |
| 模型 | Chevron 指标（距离/速度/TTC/全部） | ✅ `model_overlay` + `model_canvas` |
| 模型 | `allowThrottle` 路径淡化 | ✅ |
| 限速 | MUTCD 英制牌（SPEED/LIMIT 标签） | ✅ |
| 限速 | last/offset/超速红/无效灰/preActive 箭头/ahead | ✅ v47+ |
| 转向 | 转向灯/BSM 同位 + 参数门控 | ✅ v47 |
| Dev UI | BOTTOM=1 / RIGHT=2 / BOTH=3 枚举 | ✅ v48 修正告警/DM/扭矩偏移 |
| 扭矩 | 底栏 Dev UI 时 `bottom: 60px` | ✅ `hud_torque.js` |

---

## 关键缺口（仍为 🟡 或 ❌）

| 区域 | 项 | 状态 |
|------|-----|------|
| 告警 | full 尺寸动态高度 | ✅ v54 |
| Home | Prime 勾选纹理 | ✅ 色值对齐 `prime.py`（✓ #465bea / subscribed #86ff4e） |
| 侧栏 | Wi-Fi 分级纹理 | ✅ 圆点（与 `sidebar.py` 一致） |
| Steering | Torque 版本树 JSON | ✅ `/api/opui/steering/torque-versions` |
| 模型 | shader 级精度 | 🟡 canvas 近似 |
| 模型 | 车道线/彩虹路径实车 | 🟡 v53 已修，待上车验证 |
| i18n | 侧栏/dev 面板 | 🟡 dev 预设保留中文；静态 UI 已 i18n |

---

## 验证方式

```bash
# PC
py -3 webui/dev/run_pc.py --port 5080

# J3
python3.12 -m webui.webuid
```

1. 强刷 `?v=54`
2. Dev：严重告警 / onroad_engaged / long_only / alert_full / standstill_timer
3. 设置：软件下载状态中文「已是最新，最后检查：X分钟前」、巡航 SCC 中文标签、MADS 刹车踏板说明、变道 Road Edge 开关
4. Toggles 无左侧图标（SP 布局：开关左、标题右）
5. Home 顶栏 `sunnypilot` Audiowide + 版本号
6. 行车 WebRTC + 实验模式宽角切换 + DM 驾驶员画面
7. ChevronInfo 开启时前车指标淡入；英制下限速牌 MUTCD 样式

---

## v52 新增对齐项

| 区域 | 项 | 状态 |
|------|-----|------|
| Models | 选模型后 `needs_reset_cal` → Reset Calibration 确认 | ✅ |
| Models | Cancel Download 仅 `download_index` 存在时显示 | ✅ |
| Models | Clear cache 完整确认文案 + Clear Cache 按钮 | ✅ |
| Models | CameraOffset `custom_model_active` 门控 | ✅ |
| Models | offroad 时 Current Model 描述文案 | ✅ |
| Vehicle | Hyundai `multiple_button` Off/Dynamic/Predictive + 动态描述 | ✅ |
| SunnyLink | `required_consent_version` / `consent_declined_value` API | ✅ |
| Software | DisableUpdates 去重 confirm（仅 onBeforeChange 重启流） | ✅ |
| Device | Reset Calibration 确认文案 | ✅ |
| OSM | 删除中 `DELETING...`、Update 行 `done/total (%)` | ✅ |
| Network | Wi-Fi 连接中态 + 轮询至 connected | ✅ |
| Developer | Release/分支门控、互斥副作用 | ✅ |
| Steering | MADS limited param 同步、Torque 子面板门控 | ✅ |
| i18n | panels/app 加载与 SSH 硬编码中文清扫 | 🟡 侧栏/dev 面板仍有中文 |
| 竖屏 | `fitOpuiScale()` 旋转 90° 放大（v51） | ✅ |

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-13 | v54：全屏告警 200/270 + 361/420、path_gradient/path_blend、侧栏/弹窗 i18n、bootstrap tr() |
| 2026-08-13 | v53：行车模型叠加修复 — 标定单例、path_polygon 彩虹路径、HTTP 轮询兜底、overlay 叠在视频上 |
| 2026-08-13 | v50：设置全面对齐 — 软件 i18n/Release Notes 折叠、巡航/MADS/变道标签与控件、模型名 fallback、子面板全宽返回 |
| 2026-08-13 | v49：SunnyLink 面板行序/赞助商/恢复按钮 primary |
| 2026-08-13 | v48：合成告警、DM 人脸轮廓、Chevron 指标、MUTCD、Dev UI 枚举修正 |
| 2026-08-13 | v47：转向灯/BSM/路名数据源、限速牌细化、DevUI 转向配色 |
| 2026-08-12 | P2/P3 收尾：Cruise/Visuals/Toggles/Trips/字体/Home 品牌、彩虹路径、Dev UI 告警偏移、WebRTC 全链路（v38） |
