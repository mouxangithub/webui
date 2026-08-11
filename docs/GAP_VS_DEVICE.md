# Web UI vs 车机 raylib UI — 差距清单 (v0.3)

**结论：功能与交互模式已大幅对齐，视觉像素级与 VisionIPC 渲染仍非 100%。**

## v0.3 已补齐

| 区域 | 内容 |
|------|------|
| 组件层 | Confirm / Keyboard / Tree / MultiOption / Html 弹窗 |
| 列表项 | SP 170px 行高、左侧 Toggle、Lock 显示、engaged 禁用 |
| Network | SCAN、车机式键盘输密码、FORGET 确认 |
| Models | Tree 选择器、下载进度条 |
| OSM | 国家 Tree、地图体积、下载进度 |
| Vehicle | Tree + Confirm + 图例 |
| sunnylink | 状态/备份进度/配对 URL |
| Firehose | 实时状态页 |
| Device | 语言选择、校准摘要、法规/培训 HTML |
| Trips | 三列统计卡片 |
| Developer | SSH keys |
| Onroad | model canvas、SP HUD、DM 姿态弧、动态告警高度 |
| 资源 | Inter 字体、侧栏/按钮图标、设计令牌 |

## 仍与车机有差异

| 项 | 说明 |
|----|------|
| 相机 | 车机 VisionIPC/EGL；Web 为 WebRTC（车机）或占位（PC） |
| 模型叠加 | Web canvas 近似，非同一 ModelRenderer 管线 |
| 像素级 | 动画曲线、字体 hinting、触摸手势未完全复刻 |
| multilang | 部分文案仍为英文/中文混用 |
| sunnylink | QR 配对向导、同意页多步流程为简化版 |
| OSM | 真机完整区域 JSON 树需在线拉取（当前 mock/简化） |

## 验收建议

- **功能+操作**：15 面板 Params、子页面、Tree/Keyboard/Confirm → **可验收**
- **行车**：车机 WebRTC + overlay API → **可验收**
- **视觉 1:1**：需真机截图对比 → **未完全满足**

PC 预览：`py -3 webui/dev/run_pc.py`（`:5080`）
