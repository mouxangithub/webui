# Web UI vs 车机 raylib UI — 差距清单

**结论：未 100% 1:1 还原。** 下表按 sunnypilot BIG UI（15 面板 + Onroad）逐项对照。

## 设置（离路）

| 区域 | 车机 | Web UI v0.2 | 差距 |
|------|------|-------------|------|
| 侧栏导航 | 图标 + 滚动 + 圆角选中 | 文字按钮列表 | 无图标资源、字号/间距近似 |
| Device | 配对对话框、驾驶员相机 VisionIPC、语言选择、法规 HTML | 只读 + 动作按钮 | 缺相机预览、多语言 UI、HTML 弹窗 |
| Network | WifiManager 实时扫描、密码键盘、蜂窝高级 | 扫描 API + prompt 密码 | 无自定义键盘 UI、无高级蜂窝表单 |
| sunnylink | 配对流程、备份进度 cereal | Params + 触发备份 | 无配对向导、无实时进度 |
| Toggles | 锁定键、E2E 确认富文本、engaged 禁用 | 基本实现 | 缺 lock 显示、长描述 HTML |
| Software | updater 实时状态、分支多选对话框 | 状态 + 分支按钮 | 无 release notes 排版 |
| Models | 树形模型选择、下载进度条 | 参数 + 简要状态 | **缺核心：模型树 + 进度** |
| Steering | MADS/变道/扭矩子页面 | 扁平参数列表 | **缺子页面导航** |
| Cruise | SLA 子页面、ICBM 门控逻辑 | 扁平参数 | **缺 SLA 子页 + 动态门控** |
| Visuals | 条件启用 Chevron | 基本实现 | 门控逻辑简化 |
| Display | 亮度标签映射 | int 步进 | 标签文案未完全对齐 |
| OSM | 区域树下载、进度 shm | 只读 + 检查更新 | **缺地图树 + 下载进度** |
| Trips | 卡片图标统计 | JSON 文本摘要 | 视觉完全不同 |
| Vehicle | 平台选择器 + 品牌工厂 | 品牌 bool 列表 | **缺平台选择器** |
| Firehose | comma API 动态状态 | 静态说明 + param | 状态刷新弱 |
| Developer | SSH GitHub keys UI | bool 开关 | **缺 SSH keys 管理** |

## 行车（Onroad）

| 区域 | 车机 | Web UI | 差距 |
|------|------|--------|------|
| 相机 | VisionIPC EGL 纹理 | WebRTC（车机）/ 占位（PC） | PC 无流；车机依赖 webrtcd |
| 模型叠加 | ModelRenderer 车道/路径 | 无 | **未实现** |
| HUD | 速度、设定速度、Exp 按钮样式 | 简化数字 | 字体/布局非像素级 |
| 告警 | 动态高度、DevUI 偏移 | 固定底栏 | 高度/动画不同 |
| DM 弧 | DriverStateRenderer | 无 | **未实现** |
| SP 扩展 | 限速、路名、RocketFuel、Chevron… | 无 | **未实现** |
| 侧栏 | 300px 指标 + 图标按钮 | 简化指标块 | 无纹理图标 |
| 边框 | 双层圆角 | 单色 border | 缺内圆角细线 |

## 非功能

| 项 | 车机 | Web |
|----|------|-----|
| 分辨率 | 固定 2160×1080 缩放 | CSS scale 近似 |
| 字体 | 设备字体 | 系统 sans |
| 触摸 | raylib 手势 | 浏览器点击 |
| 多语言 | multilang 实时 | 中文/英文混用 |
| 屏保/亮度 | 硬件控制 | 不适用 |

## 建议验收标准

- **功能验收**：15 面板 Params 可读写、主要动作可触发 → **已基本满足**
- **视觉 1:1**：字体、图标、间距、动画 → **未满足**
- **行车完整**：相机 + 模型 + HUD 扩展 → **部分满足（仅 HUD 壳 + WebRTC）**

PC 本地预览见 [dev/README.md](../dev/README.md)，用于布局开发，**不能**作为 1:1 验收依据。
