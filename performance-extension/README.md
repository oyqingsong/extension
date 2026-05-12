# Performance Monitor — Chrome 页面性能监控工具

一个 Chrome 扩展，用于实时监控网页性能指标，帮助前端开发者快速发现性能瓶颈。

## 功能概览

### 监控指标

| 分类 | 指标 | 说明 |
|------|------|------|
| **Core Web Vitals** | LCP | 最大内容绘制（官方 Session Window 算法） |
| | CLS | 累积布局偏移（官方 P98 算法） |
| | INP | 交互到绘制延迟 |
| **页面加载** | TTFB | 首字节时间 |
| | FCP | 首次内容绘制 |
| | DOM Ready | DOM 加载完成 |
| | Page Load | 页面完全加载 |
| **运行时** | FPS | 帧率（requestAnimationFrame 实时计数） |
| | Memory | JS 堆内存使用量 |
| | DOM Nodes | DOM 节点数 |
| | Long Tasks | >50ms 长任务检测与告警 |
| **资源分析** | Requests | 按 JS/CSS/Image/Font/XHR 分类统计请求数 |
| | Transfer | 各类资源传输大小汇总 |

### 双视图展示

- **浮动窗口（Overlay）** — 注入页面右下角的迷你面板，实时显示关键指标，可拖拽、可最小化、可关闭
- **Popup 弹窗** — 点击扩展图标打开，展示完整性能报告，包含 Web Vitals 评分卡片、加载时间条形图、资源分类统计

### 其他特性

- 扩展图标 Badge 实时显示 FPS，颜色标识健康状态（绿/橙/红）
- 数据缓存到 `chrome.storage`，Popup 打开时立即可见
- Shadow DOM 隔离浮动窗口样式，不与目标页面冲突
- 扩展重载后自动清理旧 content script，避免报错

## 项目结构

```
performance-extension/
├── manifest.json                  # Manifest V3 配置
├── background/
│   └── service-worker.js          # 后台服务：数据缓存、Badge 更新
├── content/
│   ├── collector.js               # 性能数据采集（运行在页面 MAIN world）
│   └── overlay.js                 # 浮动面板（Content Script，Shadow DOM）
├── popup/
│   ├── popup.html                 # Popup 页面结构
│   ├── popup.css                  # Popup 深色主题样式
│   └── popup.js                   # Popup 数据渲染与交互
├── shared/
│   └── utils.js                   # 共享工具函数（评级、格式化、分类）
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 安装使用

1. 打开 Chrome，地址栏输入 `chrome://extensions`
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择 `performance-extension` 目录
4. 打开任意网页（http/https），右下角自动出现浮动监控面板
5. 点击工具栏扩展图标，查看完整性能报告

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                      目标页面                            │
│  ┌──────────────┐              ┌──────────────────────┐  │
│  │ collector.js │──postMessage──▶ overlay.js           │  │
│  │  (MAIN world)│              │ (Content Script)      │  │
│  │              │              │                       │  │
│  │ · PerformanceObserver      │ · Shadow DOM 浮动面板  │  │
│  │ · requestAnimationFrame    │ · 数据转发到 background│  │
│  │ · performance.memory       │                       │  │
│  └──────────────┘              └──────────┬───────────┘  │
└───────────────────────────────────────────┼──────────────┘
                                            │ chrome.runtime.sendMessage
                                            ▼
                                 ┌──────────────────────┐
                                 │ service-worker.js    │
                                 │ · chrome.storage 缓存│
                                 │ · Badge FPS 显示     │
                                 └──────────┬───────────┘
                                            │
                          ┌─────────────────┼─────────────────┐
                          │                 ▼                  │
                          │  ┌──────────────────────┐         │
                          │  │ popup.html/js/css    │         │
                          │  │ · Web Vitals 卡片    │         │
                          │  │ · 加载指标条形图     │         │
                          │  │ · 运行时数值面板     │         │
                          │  │ · 资源分类统计       │         │
                          │  └──────────────────────┘         │
                          │         Popup 弹窗                │
                          └───────────────────────────────────┘
```

**数据流：**
1. `collector.js` 在页面主世界运行，通过 `PerformanceObserver` 和 `performance` API 采集数据
2. 每 2 秒通过 `window.postMessage` 发送给 `overlay.js`
3. `overlay.js` 更新浮动面板，同时通过 `chrome.runtime.sendMessage` 转发给 service worker
4. service worker 缓存数据并更新 Badge
5. Popup 打开时从 storage 读取缓存数据，同时监听实时更新

## 技术细节

### 指标采集方式

| 指标 | 采集方式 |
|------|---------|
| LCP | `PerformanceObserver` + `largest-contentful-paint` 类型 |
| CLS | `PerformanceObserver` + `layout-shift` 类型，Session Window 算法（1s 间隔分组，5s 上限） |
| INP | `PerformanceObserver` + `event` 类型，P98 百分位算法（保留最近 500 条） |
| FPS | `requestAnimationFrame` 计数，每秒统计帧数 |
| FCP/TTFB | `performance.getEntriesByType('paint')` / `navigation` |
| Memory | `performance.memory.usedJSHeapSize`（Chrome 专有 API） |
| 资源 | `performance.getEntriesByType('resource')`，分类摘要 |

### 性能优化

- 资源数据只发送分类摘要（几十字节），不发送全量 URL 列表
- DOM 节点数每 5 秒采集一次，避免频繁遍历
- 页面加载指标加载完成后不再重复采集
- 共享 `shared/utils.js` 统一工具函数，避免 overlay 和 popup 重复实现

### 评级阈值

| 指标 | 良好 | 需改进 | 差 |
|------|------|--------|-----|
| LCP | <=2.5s | <=4s | >4s |
| CLS | <=0.1 | <=0.25 | >0.25 |
| INP | <=200ms | <=500ms | >500ms |
| FPS | >=55 | >=30 | <30 |
| TTFB | <=800ms | <=1.8s | >1.8s |

## 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 获取当前标签页信息 |
| `storage` | 缓存性能数据供 Popup 读取 |
| `scripting` | 向页面注入采集脚本 |
