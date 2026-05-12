# CSS Selector Highlighter — CSS 选择器实时高亮工具

一个 Chrome 扩展，实时高亮显示鼠标悬停元素的 CSS 选择器路径、匹配规则和 Specificity，帮助前端开发者快速定位样式问题。

## 功能概览

### 核心功能

| 功能 | 说明 |
|------|------|
| **实时高亮** | 鼠标悬停时在元素上绘制高亮边框，显示标签、ID、类名和尺寸 |
| **精简选择器** | 自动计算最短唯一选择器（id > 唯一 class > tag+class > 完整路径） |
| **完整路径** | 从目标元素到 `html` 的完整 CSS 选择器路径 |
| **DOM 面包屑** | 页面右侧面板展示元素的 DOM 层级关系 |
| **Specificity** | 计算选择器的 CSS 优先级权重 `(inline, id, class/attr, type)` |
| **匹配规则** | 列出当前元素匹配的所有外部样式规则，按 Specificity 排序 |
| **元素锁定** | 点击锁定当前元素，固定查看其选择器信息 |
| **一键复制** | 按 `C` 复制精简选择器，按 `Shift+C` 复制完整路径 |

### 操作方式

| 操作 | 效果 |
|------|------|
| **鼠标移动** | 实时高亮悬停元素并显示信息 |
| **鼠标点击** | 锁定当前元素（边框变橙色） |
| **C 键** | 复制精简选择器到剪贴板 |
| **Shift + C** | 复制完整路径到剪贴板 |
| **Esc** | 锁定状态解锁 / 未锁定则关闭高亮 |
| **Alt+Shift+S** | 全局快捷键，开关高亮功能 |

## 项目结构

```
css-selector-extension/
├── manifest.json                  # Manifest V3 配置
├── background/
│   └── service-worker.js          # 状态中枢：高亮状态管理、图标 Badge、快捷键响应
├── content/
│   ├── main.js                    # Content Script 主入口：事件绑定、锁定/复制逻辑
│   ├── highlight.js               # 高亮覆盖层管理：绘制元素边框和尺寸标签
│   ├── selector.js                # CSS 选择器路径计算引擎：Unique/Compact/DomPath/Specificity
│   ├── panel.js                   # 信息面板：页面右侧浮动面板，展示选择器信息和匹配规则
│   └── styles.css                 # 面板和 Toast 样式
├── popup/
│   ├── popup.html                 # 弹窗：开关切换、快捷键提示
│   ├── popup.css                  # 弹窗样式
│   └── popup.js                   # 弹窗逻辑：开关状态同步
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## 安装使用

1. 打开 Chrome，地址栏输入 `chrome://extensions`
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择 `css-selector-extension` 目录
4. 点击工具栏扩展图标，打开开关
5. 在页面上移动鼠标查看选择器，点击目标元素锁定
6. 按 `C` 复制选择器，`Esc` 解锁或关闭

## 架构设计

```
┌──────────────────────────────────────────────────────────────────┐
│                       Service Worker                              │
│  · 状态持久化（chrome.storage）                                    │
│  · 图标 Badge 更新（ON/空）                                        │
│  · 快捷键 Alt+Shift+S → 切换状态                                   │
│  · 页面未注入时自动 injectContentScripts()                         │
└──────────┬───────────────────────────────────────────────────────┘
           │ chrome.tabs.sendMessage / chrome.scripting.executeScript
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Content Script（注入目标页面）                   │
│                                                                  │
│  main.js  ── 事件中枢：                                          │
│  ├── mousemove → HighlightOverlay.highlight() + InfoPanel.update()│
│  ├── mousedown → lock() / unlock()                               │
│  └── keydown  → copyCompact() / copyPath() / disable()           │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ HighlightOverlay │  │  SelectorEngine  │  │   InfoPanel    │  │
│  │                 │  │                  │  │               │  │
│  │ · 高亮边框       │  │ · getUniqueSel    │  │ · 精简选择器    │  │
│  │ · 尺寸标签       │  │ · getCompactSel   │  │ · 完整路径      │  │
│  │ · 锁定提示       │  │ · getDomPath      │  │ · DOM 面包屑    │  │
│  │ · 颜色切换       │  │ · getSpecificity  │  │ · Specificity   │  │
│  │   (蓝⇄橙)       │  │ · getMatchedRules  │  │ · 匹配规则列表   │  │
│  └──────────────────┘  └──────────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**数据流：**
1. 用户打开开关（弹窗或快捷键）→ Service Worker 更新状态 → 通知 Content Script
2. `main.js` 监听鼠标移动 → 更新 `HighlightOverlay`（边框）+ `InfoPanel`（信息）
3. 点击锁定后，`SelectorEngine` 计算最终选择器和匹配规则
4. 用户按 `C` 复制选择器，或到面板点击按钮复制
5. 按 `Esc` 解锁或关闭，状态同步回 Service Worker

## 技术细节

### 选择器引擎策略

`SelectorEngine.getCompactSelector()` 按优先级尝试：

1. **ID 选择器** — `#my-element`，最精简且有语义
2. **唯一 Class 组合** — `.btn.primary`，用 `document.querySelectorAll` 验证唯一性
3. **Tag + Class** — `button.btn.primary`，验证唯一性
4. **完整路径** — `div.container > div.row > button.btn:nth-child(2)`

如果元素带 ID，`getUniqueSelector()` 会以 ID 为锚点终止向上查找，避免选择器过长。

### Specificity 计算

支持标准 CSS 优先级四元组 `(inline, id, class/attr/pseudo-class, type/pseudo-element)`：

| 权重位 | 匹配规则 |
|--------|---------|
| inline | `!important` |
| id | `#id` 选择器 |
| class | `.class`、`[attr]`、`:pseudo-class`（不含 `::`） |
| type | 元素名、`::pseudo-element` |

### 高亮覆盖层

- 使用 `position: fixed` 覆盖层，`pointer-events: none` 不干扰交互
- 锁定/未锁定双色设计（蓝色 ⇄ 橙色）
- 显示元素标签名、ID、前两个 class 和实际尺寸
- 锁定状态下底部显示操作提示

### 信息面板

- 页面右侧浮动，可拖拽到任意位置
- 位置持久化到 `localStorage`
- 显示 TOP 10 匹配的 CSS 规则，按 Specificity 降序排列
- Shadow DOM 不要求（面板使用独立 ID 和 class 前缀）

### 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 获取当前标签页信息 |
| `scripting` | 向页面注入 Content Script（解决预打开页面注入问题） |
| `storage` | 持久化高亮开关状态 |
