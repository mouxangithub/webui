# WebUI ↔ 原生 BIG GUI 对齐清单

> 画布：**2160×1080**（`openpilot/system/ui` BIG UI）  
> 对照源码：`openpilot/selfdrive/ui/onroad/*`、`sunnypilot/onroad/*`、`layouts/sidebar.py`、`layouts/home.py`  
> Web 实现：`webui/web/static/*`、`webui/server/bridge/*`

**图例**：✅ 已对齐 · 🟡 近似/部分 · ❌ 未实现 · 🔧 进行中

最后更新：2026-08-12

---

## 1. Onroad 画布与边框

| 项 | 原生常量 | WebUI | 状态 |
|----|----------|-------|------|
| 逻辑分辨率 | 2160×1080 | `--opui-w/h` | ✅ |
| 内容区内边距 | `UI_BORDER_SIZE=30` | `--border-w: 30px` | ✅ |
| 外黑框 | `draw_rectangle_lines_ex`，直角 | `.opui-border__outer` 直角 | ✅ |
| 内状态彩框 | `roundness=0.12` → `min(w,h)×0.06` | `--border-r` + container query | ✅ |
| 状态色 | disengaged `#122839` / engaged `#167f40` / override `#89928D` / lat `#00C8C8` / long `#961CA8` | CSS 变量 + `opui-border--*` | ✅ |
| 侧栏与边框关系 | onroad 全宽，边框仅包主画面 | `#border` 在 `#screen-onroad` 内 | ✅ |
| 底部 engaged fade | `onroad_fade.png` 纹理 | `.opui-hud-bottom-fade` 渐变 | 🟡 |

---

## 2. 告警（Alert）

| 项 | 原生 (`alert_renderer.py`) | WebUI | 状态 |
|----|---------------------------|-------|------|
| 边距 | `ALERT_MARGIN=40` | `--alert-margin: 40px` | ✅ |
| 内边距 | `ALERT_PADDING=60` | `--alert-padding: 60px` | ✅ |
| 圆角 | `ALERT_BORDER_RADIUS=30` 四角 | `border-radius: 30px` | ✅ |
| 高度 small/mid | 271 / 420（含 margin 算法） | min-height 191 / 340 | ✅ |
| 字号 mid | t1 **88** bold + t2 **66** regular 白 | 已对齐 | ✅ |
| 颜色 | normal `#151515F1` / user `#DA6F25F1` / critical `#C92231F1` | `data-status` | ✅ |
| full 尺寸 | 铺满 content，大标题 132/177 | `.opui-alert--full` | 🟡 |
| SP 动态高度 | `wrap_text` 计算 | 固定 min-height | 🟡 |
| Dev UI 偏移 | 右栏 -230px 宽，底栏 -40px 高 | 未实现 | ❌ |

---

## 3. HUD 核心（`hud_renderer.py`）

| 元素 | 原生位置/样式 | WebUI | 状态 |
|------|---------------|-------|------|
| 顶栏渐变 | 高 300，`alpha 114→0` | `rgba(0,0,0,0.447)` | ✅ |
| MAX 框 | content `left:60 top:45` 200×204 | `.opui-hud-cruise` | ✅ |
| MAX 标签 | y+27，font 40 semi | padding-top 20 + 40px | 🟡 |
| 设定速度 | y+77，font 90 bold | 90px | ✅ |
| 当前速度 | 屏绝对 y≈180，font **176** bold | `top:92` + 176px | 🟡 |
| 单位 | y≈290，font 66 | 66px | ✅ |
| Experimental | 右上 192×192，图标 144 | `.opui-exp-btn` | ✅ |
| Exp 门禁 | `ExperimentalModeConfirmed` + 纵向控制 | 仅 Param 切换 | ❌ |
| Exp 2s hold 动画 | `_hold_duration` | 无 | ❌ |
| ICBM | 簇速显示 + **3s 保持** | `icbmHoldTicks` + `pcm_cruise_speed` | ✅ |
| SLA 激活色 | assist 时绿/override 灰 | `--sla` 类 | ✅ |
| SLA 非 assist 时 ui_status 色 | engaged/disengaged/… | assist 时跳过 status 色 | 🟡 |

---

## 4. Sunnypilot HUD 扩展

| 元素 | 原生 | WebUI | 状态 |
|------|------|-------|------|
| 限速牌 | `x = 60+width+30-6`，Vienna/MUTCD 两套 | 圆牌 `left:314` | 🟡 Vienna 简化为圆牌 |
| 路名 | `rect.y - 4`，高 60，font 46 | `top:-4px` | ✅ |
| 转向灯 | 中心±80，y+190，150 容器，闪烁滤波 | Unicode+图标，blink 动画 | 🟡 |
| 盲区条 | BSM 指示 | `.opui-bsl` | 🟡 |
| SCC 标签 | `height/4`，±260/±40/±100 | `25%` calc | 🟡 |
| Rocket fuel | 左竖条 28px 宽 | `.opui-rocket` | 🟡 |
| DM 弧 | 左下 126px inset，192 按钮 | `.opui-dm-wrap` | 🟡 |
| DM 点击 | 打开 driver cam | `#dm-arc-wrap` 点击弹窗 | ✅ |
| 圆形 E2E 告警 | `circular_alerts.py` r=250 | `#hud-circular-alert` + `hud_circular.js` | ✅ |
| 静止计时 | 圆牌内 STOPPED + 计时 | 合并入圆形告警 | ✅ |
| TorqueBar | `torque_bar.py` | `hud_torque.js` canvas 弧 | ✅ |
| Developer UI | 底栏/右栏数据 | `hud_dev.js` + `dev_ui_api.py` | ✅ |

---

## 5. 模型叠加（Model）

| 项 | 原生 | WebUI | 状态 |
|----|------|-------|------|
| 车道线/路径/前车 | `ModelRenderer` + shader | `model_overlay.py` → `model_canvas.js` | 🟡 基础 canvas |
| WebSocket 推送 | `watch_model_overlay` | `ws.js` + `app.js` | ✅ |
| Experimental 彩虹路径 | 加速度渐变 | 待 canvas 实现 | 🔧 |
| 宽角流切换 | experimental + 车速滞回 | 无 | ❌ |

---

## 6. Metrics 侧栏（300px）

| 项 | 原生 SP | WebUI | 状态 |
|----|---------|-------|------|
| 宽度 | 300 | `--onroad-sidebar-w` | ✅ |
| 四项 Y | 300 起等分至 HOME(860) | 300/435/570/705 | ✅ |
| 设置/主页按钮 | 纹理 + 坐标 | CSS 背景图 | 🟡 |
| 网络指示 | 分级 WiFi 纹理 / slash | 5 圆点 + 文字 | 🟡 |
| 录音麦克风 | `recording_audio` 红点 | `#sidebar-mic` | ✅ |
| 书签 Flag | `bookmarkButton` | `POST /api/opui/action/bookmark` | ✅ |
| 文案 i18n | `tr()` | 中文硬编码 | ❌ |
| 具体温度数值 | °C | 仅 良好/偏高 | 🟡 |

---

## 7. Home 离路屏

| 项 | 原生 | WebUI | 状态 |
|----|------|-------|------|
| Prime 卡 | 左列满高 + 勾选纹理 | flex 卡 | 🟡 |
| Setup 卡 | 右列 | 有 | ✅ |
| Experimental/Chill 横幅 | 描边 + 分隔线 | 简化样式 | 🟡 |
| UPDATE 药丸 | 可点 → 更新页 | overlay + CHECK/Reboot | ✅ |
| ALERTS 药丸 | offroad alerts 全屏 | overlay + dismiss/snooze | ✅ |
| 品牌 sunnypilot | Audiowide 48px | 仅 version 文本 | ❌ |

---

## 8. 设置面板

| 面板 | 主要缺口 |
|------|----------|
| **Toggles** | 行内图标缺失 |
| **Cruise** | ICBM/DEC 描述；Custom ACC 门控；Long Press `value_map` |
| **Visuals** | 长描述/HTML；Chevron 门控文案 |
| **Software** | Disable Updates 重启确认 |
| **Developer** | Quickboot 分支可见性 |
| **Sunnylink** | ✅ Sponsor + Pair 按钮（配对对话框仍简化） |
| **Steering→Torque** | 版本树应用 JSON 非硬编码 v1-v3 |
| **Trips** | 统计图标 |
| **Display** | 部分 desc 缺失 |
| 通用 | `renderGenericPanel` 与 `.opui-sp-row` 行高混用 |

---

## 9. 设计令牌与 i18n

| 项 | 状态 |
|----|------|
| `design_tokens.py` → CSS 变量全量注入 | ✅ engaged/disengaged/override/lat/long/alert/hud |
| `border_roundness` 动态 | 用 container query 替代 |
| Audiowide / OpFont | 未加载 |
| 侧栏/告警 i18n | 部分硬编码中文 |

---

## 10. 修复优先级（执行顺序）

### P0 — 行车视觉核心
1. ✅ 告警布局/字号/圆角
2. ✅ 边框圆角公式
3. 🟡 `model_canvas.js` 车道/路径基础绘制（实验彩虹待完善）
4. ✅ HUD 渐变、限速位置、路名、ICBM 保持

### P1 — 交互与状态
5. ✅ Developer UI / 圆形 E2E 告警 / TorqueBar
6. ✅ Exp 按钮门禁与 hold 动画
7. ✅ 书签 + 麦克风侧栏
8. ✅ DM 弧点击 → driver cam

### P2 — 离路/设置
9. ✅ Home UPDATE/ALERTS 流
10. ✅ Sunnylink Sponsor/Pair
11. Cruise/Visuals 文案与 value_map
12. Toggle 图标、Trips 图标、字体

### P3 — 抛光
13. 网络纹理图标、Prime 勾选资产
14. i18n 全覆盖
15. Dev 预设补全（long_only、standstill、full alert）

---

## 11. 验证方式

```bash
# PC
py -3 webui/dev/run_pc.py --port 5080

# J3（勿用 run_pc.py）
python3.12 -m webui.webuid
```

1. 强刷 `?v=<version>`
2. Dev 面板：严重告警 / onroad_engaged / lat_only / override
3. 对比 J3 同场景截图（边框、告警、HUD、限速）

---

## 12. 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-12 | 初版清单；告警+边框对齐；PC bootstrap/dev 优化 |
| 2026-08-12 | 补充全文；`model_canvas.js`；HUD 渐变/限速/路名/ICBM；设计令牌注入 |
| 2026-08-12 | P1：Developer UI、圆形 E2E/静止计时、Exp 门禁+hold、书签、侧栏麦克风（v34） |
| 2026-08-12 | P1 收尾：TorqueBar、DM 弧点击 driver cam（v35） |
