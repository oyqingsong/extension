# 文本差异比较浏览器插件 - 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 构建一个支持多种文本类型的差异比较 Chrome 扩展，具备格式化、双视图、多输入方式等功能。

**架构：** 原生 JS + jsdiff 库，popup 弹窗作为主界面，service worker 管理右键菜单和消息中转，lib 目录存放核心逻辑模块（格式化器、渲染器）。

**技术栈：** 原生 HTML/CSS/JS、jsdiff 库、Chrome Extension Manifest V3

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `manifest.json` | 扩展配置，声明权限、popup、background、content_scripts |
| `background/service-worker.js` | 注册右键菜单，处理右键菜单点击消息，中转数据到 popup |
| `popup/popup.html` | 主界面 HTML 结构（输入阶段 + 结果阶段） |
| `popup/popup.css` | 所有样式：输入布局、diff 高亮颜色、并排/内联视图 |
| `popup/popup.js` | 主控制器：输入管理、类型检测、调用比较、视图切换、数据持久化 |
| `lib/diff.js` | jsdiff 库文件（第三方，直接引入） |
| `lib/formatters.js` | 格式化器：JSON key 排序缩进、XML 美化、YAML 标准化 |
| `lib/renderer.js` | 渲染器：将 diff 结果渲染为并排视图或内联视图的 HTML |
| `content/context-menu.js` | 监听右键菜单消息，将选中文本传递给 background |
| `icons/icon*.png` | 扩展图标（16/32/48/128 四种尺寸） |

---

### Task 1: 项目脚手架与 manifest.json

**文件：**
- 创建：`compare-diff-extension/manifest.json`
- 创建：`compare-diff-extension/icons/icon16.png`、`icon32.png`、`icon48.png`、`icon128.png`

- [ ] **Step 1: 创建 manifest.json**

```json
{
  "manifest_version": 3,
  "name": "文本差异比较",
  "version": "1.0.0",
  "description": "支持 JSON、XML、YAML、纯文本的格式化差异比较工具",
  "permissions": ["activeTab", "contextMenus", "storage"],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/context-menu.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: 创建占位图标文件**

使用内联 SVG 转 PNG 的方式，生成一个简单的对比图标。创建一个临时 HTML 文件用 Canvas 生成四个尺寸的图标 PNG。

先创建 `compare-diff-extension/icons/` 目录，然后创建 `compare-diff-extension/generate-icons.html` 辅助生成图标：

```html
<!DOCTYPE html>
<html>
<body>
<script>
const sizes = [16, 32, 48, 128];
sizes.forEach(size => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  // 背景
  ctx.fillStyle = '#4A90D9';
  ctx.fillRect(0, 0, size, size);
  // 两个对比面板图标
  const p = size * 0.15;
  const w = (size - p * 3) / 2;
  const h = size - p * 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(p, p, w, h);
  ctx.fillRect(p * 2 + w, p, w, h);
  // 差异线条
  ctx.fillStyle = '#FF6B6B';
  const lineY1 = p + h * 0.3;
  ctx.fillRect(p + w * 0.15, lineY1, w * 0.5, size * 0.04);
  ctx.fillStyle = '#51CF66';
  const lineY2 = p + h * 0.55;
  ctx.fillRect((p * 2 + w) + w * 0.15, lineY2, w * 0.5, size * 0.04);

  const link = document.createElement('a');
  link.download = `icon${size}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});
</script>
</body>
</html>
```

在浏览器中打开此文件下载图标，然后移动到 `icons/` 目录。完成后删除 `generate-icons.html`。

- [ ] **Step 3: 创建目录结构**

创建 `background/`、`popup/`、`lib/`、`content/` 目录，各放入空的占位文件。

- [ ] **Step 4: 验证**

在 Chrome 的 `chrome://extensions/` 中加载 `compare-diff-extension` 目录，确认扩展能被识别且无报错。

---

### Task 2: 引入 jsdiff 库

**文件：**
- 创建：`compare-diff-extension/lib/diff.js`

- [ ] **Step 1: 下载 jsdiff 库**

从 jsdiff 的 CDN 获取最小化版本，保存到 `lib/diff.js`：

```bash
curl -o compare-diff-extension/lib/diff.js https://cdn.jsdelivr.net/npm/diff@5.2.0/dist/diff.min.js
```

如果无法下载，手动创建 `lib/diff.js`，使用以下方式引入：

在 `popup.html` 中通过 CDN script 标签引入（离线方案则需要手动下载）。本计划采用本地文件方式，在 `popup.html` 中引用 `../lib/diff.js`。

- [ ] **Step 2: 验证库可用**

在 `popup/popup.html` 中临时添加测试代码，确认 `Diff` 全局对象可用：

```html
<script src="../lib/diff.js"></script>
<script>console.log('jsdiff loaded:', typeof Diff !== 'undefined')</script>
```

---

### Task 3: 格式化器模块 (formatters.js)

**文件：**
- 创建：`compare-diff-extension/lib/formatters.js`

- [ ] **Step 1: 实现 formatters.js**

```javascript
/**
 * 文本格式化器
 * 提供不同文本类型的格式化处理
 */
const Formatters = {
  /**
   * 格式化 JSON 文本
   * @param {string} text - 原始 JSON 文本
   * @param {object} options - 选项 { sortKeys: boolean }
   * @returns {string} 格式化后的 JSON
   */
  formatJSON(text, options = {}) {
    try {
      let obj = JSON.parse(text);
      if (options.sortKeys) {
        obj = this._sortObjectKeys(obj);
      }
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return text;
    }
  },

  /**
   * 递归排序对象 key
   */
  _sortObjectKeys(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this._sortObjectKeys(item));
    }
    if (obj !== null && typeof obj === 'object') {
      const sorted = {};
      Object.keys(obj).sort().forEach(key => {
        sorted[key] = this._sortObjectKeys(obj[key]);
      });
      return sorted;
    }
    return obj;
  },

  /**
   * 格式化 XML/HTML 文本
   * @param {string} text - 原始 XML 文本
   * @returns {string} 格式化后的 XML
   */
  formatXML(text) {
    try {
      // 移除已有缩进
      let formatted = '';
      let indent = 0;
      const tab = '  ';
      // 标准化换行
      text = text.replace(/>\s+</g, '><').trim();

      const tokens = text.split(/(<[^>]+>)/g).filter(t => t.trim() !== '');

      tokens.forEach(token => {
        if (token.match(/^<\/\w/)) {
          indent--;
        }
        formatted += tab.repeat(Math.max(indent, 0)) + token.trim() + '\n';
        if (token.match(/^<\w[^>]*[^/]>.*$/) && !token.match(/<\/\w/)) {
          indent++;
        }
      });

      return formatted.trim();
    } catch (e) {
      return text;
    }
  },

  /**
   * 格式化 YAML 文本
   * @param {string} text - 原始 YAML 文本
   * @returns {string} 格式化后的 YAML
   */
  formatYAML(text) {
    // YAML 格式化较复杂，此处做基本处理：
    // 统一换行符、去除尾部空白
    return text
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .replace(/\r\n/g, '\n')
      .trim();
  },

  /**
   * 纯文本格式化（可选统一空白符）
   * @param {string} text - 原始文本
   * @param {object} options - { normalizeWhitespace: boolean }
   * @returns {string} 格式化后的文本
   */
  formatPlainText(text, options = {}) {
    let result = text.replace(/\r\n/g, '\n');
    if (options.normalizeWhitespace) {
      result = result.replace(/\t/g, '    ');
    }
    return result;
  },

  /**
   * 根据类型自动格式化
   * @param {string} text - 原始文本
   * @param {string} type - 类型：'json' | 'xml' | 'yaml' | 'text'
   * @param {object} options - 格式化选项
   * @returns {string} 格式化后的文本
   */
  format(text, type, options = {}) {
    switch (type) {
      case 'json': return this.formatJSON(text, options);
      case 'xml': return this.formatXML(text);
      case 'yaml': return this.formatYAML(text);
      case 'text': return this.formatPlainText(text, options);
      default: return text;
    }
  }
};
```

- [ ] **Step 2: 验证格式化器**

在 popup 中临时调用测试：

```javascript
console.log(Formatters.formatJSON('{"b":2,"a":1}', { sortKeys: true }));
// 预期输出:
// {
//   "a": 1,
//   "b": 2
// }
```

---

### Task 4: 自动类型检测模块

**文件：**
- 创建：`compare-diff-extension/lib/detector.js`

- [ ] **Step 1: 实现 detector.js**

```javascript
/**
 * 文本类型自动检测器
 */
const Detector = {
  /**
   * 根据内容特征检测文本类型
   * @param {string} text - 待检测文本
   * @returns {string} 检测到的类型：'json' | 'xml' | 'yaml' | 'text'
   */
  detect(text) {
    const trimmed = text.trim();
    if (!trimmed) return 'text';

    // JSON 检测
    if ((trimmed.startsWith('{') || trimmed.startsWith('['))) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch (e) {
        // 不是有效 JSON，继续检测
      }
    }

    // XML/HTML 检测
    if (trimmed.startsWith('<') && trimmed.includes('>')) {
      const tagMatch = trimmed.match(/^<(\w+)/);
      if (tagMatch) {
        const tagName = tagMatch[1].toLowerCase();
        if (tagName === 'html' || tagName === '!doctype' || trimmed.includes('</')) {
          return 'xml';
        }
      }
    }

    // YAML 检测：包含 key: value 模式且不含 HTML 标签
    const yamlPattern = /^\s*\w[\w-]*\s*:\s*.+/m;
    if (yamlPattern.test(trimmed) && !trimmed.includes('<')) {
      return 'yaml';
    }

    return 'text';
  },

  /**
   * 根据文件扩展名推断类型
   * @param {string} filename - 文件名
   * @returns {string|null} 类型或 null
   */
  detectByExtension(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      'json': 'json',
      'xml': 'xml',
      'html': 'xml',
      'htm': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'txt': 'text'
    };
    return map[ext] || null;
  }
};
```

- [ ] **Step 2: 验证检测器**

```javascript
console.log(Detector.detect('{"a":1}'));        // 'json'
console.log(Detector.detect('<div>hi</div>'));   // 'xml'
console.log(Detector.detect('name: value'));     // 'yaml'
console.log(Detector.detect('hello world'));     // 'text'
```

---

### Task 5: 差异渲染器模块 (renderer.js)

**文件：**
- 创建：`compare-diff-extension/lib/renderer.js`

- [ ] **Step 1: 实现 renderer.js**

```javascript
/**
 * Diff 结果渲染器
 * 将 jsdiff 的比较结果渲染为并排视图或内联视图 HTML
 */
const Renderer = {
  /**
   * 渲染并排对比视图
   * @param {Array} changes - jsdiff diffLines 结果数组
   * @param {string} oldText - 原始文本（用于生成行号）
   * @param {string} newText - 对比文本（用于生成行号）
   * @returns {string} HTML 字符串
   */
  renderSideBySide(changes, oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    let leftHtml = '';
    let rightHtml = '';
    let oldLineNum = 0;
    let newLineNum = 0;

    changes.forEach(change => {
      const lines = change.value.replace(/\n$/, '').split('\n');
      const cssClass = change.added ? 'diff-added' : (change.removed ? 'diff-removed' : 'diff-equal');

      lines.forEach(line => {
        if (change.removed) {
          oldLineNum++;
          leftHtml += this._buildLine(oldLineNum, line, cssClass);
          rightHtml += this._buildLine('', '', 'diff-empty');
        } else if (change.added) {
          newLineNum++;
          leftHtml += this._buildLine('', '', 'diff-empty');
          rightHtml += this._buildLine(newLineNum, line, cssClass);
        } else {
          oldLineNum++;
          newLineNum++;
          leftHtml += this._buildLine(oldLineNum, line, cssClass);
          rightHtml += this._buildLine(newLineNum, line, cssClass);
        }
      });
    });

    return `
      <div class="diff-view diff-side-by-side">
        <div class="diff-pane diff-pane-left">
          <div class="diff-pane-header">原始文本</div>
          <div class="diff-content">${leftHtml}</div>
        </div>
        <div class="diff-pane diff-pane-right">
          <div class="diff-pane-header">对比文本</div>
          <div class="diff-content">${rightHtml}</div>
        </div>
      </div>`;
  },

  /**
   * 渲染内联合并视图
   * @param {Array} changes - jsdiff diffLines 结果数组
   * @returns {string} HTML 字符串
   */
  renderInline(changes) {
    let html = '';
    let lineNum = 0;

    changes.forEach(change => {
      const lines = change.value.replace(/\n$/, '').split('\n');
      const cssClass = change.added ? 'diff-added' : (change.removed ? 'diff-removed' : 'diff-equal');

      lines.forEach(line => {
        lineNum++;
        html += this._buildLine(lineNum, line, cssClass);
      });
    });

    return `
      <div class="diff-view diff-inline">
        <div class="diff-content">${html}</div>
      </div>`;
  },

  /**
   * 构建单行 HTML
   * @param {number|string} lineNum - 行号
   * @param {string} content - 行内容
   * @param {string} cssClass - CSS 类名
   * @returns {string} HTML 字符串
   */
  _buildLine(lineNum, content, cssClass) {
    const escaped = this._escapeHtml(content);
    return `<div class="diff-line ${cssClass}">
      <span class="diff-line-num">${lineNum}</span>
      <span class="diff-line-content">${escaped}</span>
    </div>`;
  },

  /**
   * 计算差异统计
   * @param {Array} changes - jsdiff 结果数组
   * @returns {object} { added: number, removed: number, modified: number }
   */
  getStats(changes) {
    let added = 0, removed = 0;
    changes.forEach(change => {
      const lines = change.value.replace(/\n$/, '').split('\n');
      if (change.added) added += lines.length;
      if (change.removed) removed += lines.length;
    });
    return { added, removed, modified: Math.min(added, removed) };
  },

  /**
   * HTML 转义
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
```

- [ ] **Step 2: 验证渲染器**

使用简单 diff 数据测试渲染输出是否包含正确的 CSS 类和结构。

---

### Task 6: 主界面 HTML 结构 (popup.html)

**文件：**
- 创建：`compare-diff-extension/popup/popup.html`

- [ ] **Step 1: 实现 popup.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文本差异比较</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <!-- 输入阶段 -->
  <div id="input-view">
    <!-- 类型选择栏 -->
    <div class="type-bar">
      <select id="type-select">
        <option value="auto">自动检测</option>
        <option value="json">JSON</option>
        <option value="xml">XML/HTML</option>
        <option value="yaml">YAML</option>
        <option value="text">纯文本</option>
      </select>
      <label class="option-label" id="sort-keys-label" style="display:none;">
        <input type="checkbox" id="sort-keys-check"> 忽略 key 顺序
      </label>
    </div>

    <!-- 输入区域 -->
    <div class="input-panels">
      <div class="input-panel">
        <div class="panel-header">原始文本</div>
        <textarea id="left-input" placeholder="粘贴文本或拖拽文件到此处..."></textarea>
      </div>
      <div class="input-panel">
        <div class="panel-header">对比文本</div>
        <textarea id="right-input" placeholder="粘贴文本或拖拽文件到此处..."></textarea>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button id="clear-btn" class="btn btn-secondary">清空</button>
      <button id="compare-btn" class="btn btn-primary">比较差异</button>
    </div>
  </div>

  <!-- 结果阶段 -->
  <div id="result-view" style="display:none;">
    <!-- 工具栏 -->
    <div class="result-toolbar">
      <button id="back-btn" class="btn btn-secondary">&larr; 返回编辑</button>
      <div class="view-toggle">
        <button class="toggle-btn active" data-view="side-by-side">并排视图</button>
        <button class="toggle-btn" data-view="inline">内联视图</button>
      </div>
      <div id="diff-stats" class="diff-stats"></div>
    </div>

    <!-- 差异展示区 -->
    <div id="diff-output"></div>

    <!-- 底部操作 -->
    <div class="action-bar">
      <button id="copy-result-btn" class="btn btn-secondary">复制结果</button>
      <button id="copy-summary-btn" class="btn btn-secondary">复制差异摘要</button>
    </div>
  </div>

  <!-- 依赖库 -->
  <script src="../lib/diff.js"></script>
  <script src="../lib/formatters.js"></script>
  <script src="../lib/detector.js"></script>
  <script src="../lib/renderer.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: 验证 HTML 结构**

在浏览器中直接打开 `popup.html`，确认输入区域和结果区域的结构正确显示（样式可能还不完整，但元素应都存在）。

---

### Task 7: 样式文件 (popup.css)

**文件：**
- 创建：`compare-diff-extension/popup/popup.css`

- [ ] **Step 1: 实现 popup.css**

```css
/* ===== 基础重置与全局 ===== */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  color: #1a1a1a;
  background: #f8f9fa;
  min-width: 780px;
  min-height: 500px;
}

/* ===== 类型选择栏 ===== */
.type-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e5e5e5;
}

.type-bar select {
  padding: 6px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  cursor: pointer;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
}

/* ===== 输入面板 ===== */
.input-panels {
  display: flex;
  gap: 0;
  flex: 1;
}

.input-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e5e5e5;
}

.input-panel:last-child {
  border-right: none;
}

.panel-header {
  padding: 8px 16px;
  font-weight: 600;
  font-size: 12px;
  color: #666;
  background: #f1f3f5;
  border-bottom: 1px solid #e5e5e5;
}

textarea {
  flex: 1;
  padding: 12px 16px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.6;
  min-height: 350px;
  background: #ffffff;
}

textarea:focus {
  background: #fafbfc;
}

textarea::placeholder {
  color: #adb5bd;
}

/* 拖拽高亮 */
textarea.drag-over {
  background: #e8f4fd;
  border: 2px dashed #4A90D9;
}

/* ===== 操作按钮栏 ===== */
.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  background: #ffffff;
  border-top: 1px solid #e5e5e5;
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.btn:active {
  transform: scale(0.97);
}

.btn-primary {
  background: #4A90D9;
  color: #fff;
}

.btn-primary:hover {
  background: #3a7bc8;
}

.btn-secondary {
  background: #e9ecef;
  color: #495057;
}

.btn-secondary:hover {
  background: #dee2e6;
}

/* ===== 结果视图 ===== */
#result-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.result-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e5e5e5;
}

.view-toggle {
  display: flex;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  overflow: hidden;
}

.toggle-btn {
  padding: 5px 14px;
  border: none;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.toggle-btn.active {
  background: #4A90D9;
  color: #fff;
}

.diff-stats {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
}

.diff-stats .stat-add { color: #2b8a3e; }
.diff-stats .stat-remove { color: #e03131; }
.diff-stats .stat-modify { color: #e8590c; }

/* ===== 差异展示区 ===== */
#diff-output {
  flex: 1;
  overflow: auto;
}

/* 并排视图 */
.diff-side-by-side {
  display: flex;
  height: 100%;
}

.diff-pane {
  flex: 1;
  overflow: auto;
  border-right: 1px solid #e5e5e5;
}

.diff-pane:last-child {
  border-right: none;
}

.diff-pane-header {
  padding: 6px 12px;
  font-weight: 600;
  font-size: 11px;
  color: #666;
  background: #f1f3f5;
  border-bottom: 1px solid #e5e5e5;
  position: sticky;
  top: 0;
  z-index: 1;
}

.diff-content {
  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.5;
}

/* 行样式 */
.diff-line {
  display: flex;
  min-height: 22px;
  border-bottom: 1px solid #f1f1f1;
}

.diff-line-num {
  width: 45px;
  min-width: 45px;
  padding: 2px 8px;
  text-align: right;
  color: #999;
  background: #fafafa;
  border-right: 1px solid #eee;
  font-size: 11px;
  user-select: none;
}

.diff-line-content {
  padding: 2px 12px;
  white-space: pre-wrap;
  word-break: break-all;
  flex: 1;
}

/* 差异颜色 */
.diff-added {
  background: #e6fcf0;
}

.diff-added .diff-line-content {
  color: #1b5e20;
}

.diff-removed {
  background: #ffebee;
}

.diff-removed .diff-line-content {
  color: #b71c1c;
}

.diff-equal {
  background: #ffffff;
}

.diff-empty {
  background: #f5f5f5;
}

.diff-empty .diff-line-num {
  color: transparent;
}

/* 内联视图 */
.diff-inline .diff-pane-header {
  display: none;
}
```

- [ ] **Step 2: 验证样式**

在浏览器中打开 `popup.html`，检查输入区域布局、按钮样式是否正常。

---

### Task 8: 主控制器逻辑 (popup.js)

**文件：**
- 创建：`compare-diff-extension/popup/popup.js`

- [ ] **Step 1: 实现 popup.js**

```javascript
/**
 * 文本差异比较 - 主控制器
 */
(function () {
  // DOM 元素引用
  const elements = {
    typeSelect: document.getElementById('type-select'),
    sortKeysLabel: document.getElementById('sort-keys-label'),
    sortKeysCheck: document.getElementById('sort-keys-check'),
    leftInput: document.getElementById('left-input'),
    rightInput: document.getElementById('right-input'),
    clearBtn: document.getElementById('clear-btn'),
    compareBtn: document.getElementById('compare-btn'),
    inputView: document.getElementById('input-view'),
    resultView: document.getElementById('result-view'),
    backBtn: document.getElementById('back-btn'),
    diffOutput: document.getElementById('diff-output'),
    diffStats: document.getElementById('diff-stats'),
    copyResultBtn: document.getElementById('copy-result-btn'),
    copySummaryBtn: document.getElementById('copy-summary-btn')
  };

  let currentChanges = null;
  let currentOldText = '';
  let currentNewText = '';
  let currentView = 'side-by-side';

  // ===== 初始化 =====
  function init() {
    bindEvents();
    restoreInputs();
    checkContextMenuData();
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    // 类型选择
    elements.typeSelect.addEventListener('change', onTypeChange);

    // 比较
    elements.compareBtn.addEventListener('click', compare);

    // 清空
    elements.clearBtn.addEventListener('click', clearInputs);

    // 返回
    elements.backBtn.addEventListener('click', backToEdit);

    // 视图切换
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // 文件拖拽
    [elements.leftInput, elements.rightInput].forEach(textarea => {
      textarea.addEventListener('dragover', onDragOver);
      textarea.addEventListener('dragleave', onDragLeave);
      textarea.addEventListener('drop', onDrop);
    });

    // 复制
    elements.copyResultBtn.addEventListener('click', copyResult);
    elements.copySummaryBtn.addEventListener('click', copySummary);

    // 自动保存输入
    [elements.leftInput, elements.rightInput].forEach(textarea => {
      textarea.addEventListener('input', saveInputs);
    });
  }

  // ===== 类型选择 =====
  function onTypeChange() {
    const type = elements.typeSelect.value;
    elements.sortKeysLabel.style.display = type === 'json' ? 'flex' : 'none';
  }

  // ===== 文件拖拽 =====
  function onDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }

  function onDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  function onDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      e.currentTarget.value = event.target.result;
      // 根据文件扩展名自动选择类型
      const detected = Detector.detectByExtension(file.name);
      if (detected && elements.typeSelect.value === 'auto') {
        elements.typeSelect.value = detected;
        onTypeChange();
      }
      saveInputs();
    };
    reader.readAsText(file);
  }

  // ===== 核心比较逻辑 =====
  function compare() {
    const leftText = elements.leftInput.value.trim();
    const rightText = elements.rightInput.value.trim();

    if (!leftText || !rightText) {
      alert('请在两个文本框中都输入内容');
      return;
    }

    // 确定比较类型
    let type = elements.typeSelect.value;
    if (type === 'auto') {
      type = Detector.detect(leftText);
    }

    // 格式化
    const options = {};
    if (type === 'json' && elements.sortKeysCheck.checked) {
      options.sortKeys = true;
    }

    const formattedLeft = Formatters.format(leftText, type, options);
    const formattedRight = Formatters.format(rightText, type, options);

    // 比较
    currentOldText = formattedLeft;
    currentNewText = formattedRight;
    currentChanges = Diff.diffLines(formattedLeft, formattedRight);

    // 渲染结果
    showResult();
  }

  // ===== 显示结果 =====
  function showResult() {
    elements.inputView.style.display = 'none';
    elements.resultView.style.display = 'flex';

    // 统计信息
    const stats = Renderer.getStats(currentChanges);
    elements.diffStats.innerHTML =
      `<span class="stat-add">+${stats.added}</span> ` +
      `<span class="stat-remove">-${stats.removed}</span> ` +
      `<span class="stat-modify">~${stats.modified}</span>`;

    // 渲染视图
    renderCurrentView();
  }

  function renderCurrentView() {
    if (currentView === 'side-by-side') {
      elements.diffOutput.innerHTML = Renderer.renderSideBySide(
        currentChanges, currentOldText, currentNewText
      );
    } else {
      elements.diffOutput.innerHTML = Renderer.renderInline(currentChanges);
    }
  }

  // ===== 视图切换 =====
  function switchView(view) {
    currentView = view;
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderCurrentView();
  }

  // ===== 返回编辑 =====
  function backToEdit() {
    elements.resultView.style.display = 'none';
    elements.inputView.style.display = 'block';
    currentChanges = null;
  }

  // ===== 清空 =====
  function clearInputs() {
    elements.leftInput.value = '';
    elements.rightInput.value = '';
    elements.typeSelect.value = 'auto';
    elements.sortKeysLabel.style.display = 'none';
    elements.sortKeysCheck.checked = false;
    saveInputs();
  }

  // ===== 复制功能 =====
  function copyResult() {
    const text = currentChanges.map(c => c.value).join('');
    copyToClipboard(text, '结果已复制');
  }

  function copySummary() {
    const stats = Renderer.getStats(currentChanges);
    const summary = `差异统计：+${stats.added} 新增 -${stats.removed} 删除 ~${stats.modified} 修改`;
    copyToClipboard(summary, '摘要已复制');
  }

  function copyToClipboard(text, message) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(message);
    }).catch(() => {
      // 回退方案
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(message);
    });
  }

  // ===== Toast 提示 =====
  function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = 'toast';
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
      'background:#333;color:#fff;padding:8px 20px;border-radius:6px;font-size:12px;z-index:9999;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  }

  // ===== 数据持久化 =====
  function saveInputs() {
    if (chrome && chrome.storage) {
      chrome.storage.local.set({
        diffToolInput: {
          left: elements.leftInput.value,
          right: elements.rightInput.value,
          type: elements.typeSelect.value
        }
      });
    }
  }

  function restoreInputs() {
    if (chrome && chrome.storage) {
      chrome.storage.local.get('diffToolInput', (data) => {
        if (data.diffToolInput) {
          elements.leftInput.value = data.diffToolInput.left || '';
          elements.rightInput.value = data.diffToolInput.right || '';
          if (data.diffToolInput.type) {
            elements.typeSelect.value = data.diffToolInput.type;
            onTypeChange();
          }
        }
      });
    }
  }

  // ===== 右键菜单数据接收 =====
  function checkContextMenuData() {
    if (chrome && chrome.storage) {
      chrome.storage.local.get('contextMenuData', (data) => {
        if (data.contextMenuData) {
          const { side, text } = data.contextMenuData;
          if (side === 'left') {
            elements.leftInput.value = text;
          } else {
            elements.rightInput.value = text;
          }
          saveInputs();
          // 清除，避免重复读取
          chrome.storage.local.remove('contextMenuData');
        }
      });
    }
  }

  // 启动
  init();
})();
```

- [ ] **Step 2: 验证主控制器**

在浏览器中加载扩展，打开 popup，尝试粘贴两段不同文本并点击比较，确认基本流程可用。

---

### Task 9: Service Worker (右键菜单 + 消息中转)

**文件：**
- 创建：`compare-diff-extension/background/service-worker.js`

- [ ] **Step 1: 实现 service-worker.js**

```javascript
/**
 * Service Worker
 * 负责右键菜单注册和消息中转
 */

// 安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'diff-add-left',
    title: '添加到文本对比（左 - 原始文本）',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'diff-add-right',
    title: '添加到文本对比（右 - 对比文本）',
    contexts: ['selection']
  });
});

// 右键菜单点击处理
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const selectedText = info.selectionText;
  if (!selectedText) return;

  let side;
  if (info.menuItemId === 'diff-add-left') {
    side = 'left';
  } else if (info.menuItemId === 'diff-add-right') {
    side = 'right';
  } else {
    return;
  }

  // 将选中文本存入 storage
  chrome.storage.local.get('contextMenuData', (data) => {
    const existing = data.contextMenuData || {};
    if (side === 'left') {
      existing.left = selectedText;
    } else {
      existing.right = selectedText;
    }

    // 判断是否两侧都有数据了
    if (existing.left && existing.right) {
      // 两段文本都已设置，打开 popup
      chrome.storage.local.set({ contextMenuData: existing }, () => {
        chrome.action.openPopup();
      });
    } else {
      chrome.storage.local.set({ contextMenuData: existing });
    }
  });
});
```

- [ ] **Step 2: 验证右键菜单**

在任意网页选中文本后右键，确认看到两个菜单项。点击后打开 popup 检查文本是否正确填入。

---

### Task 10: Content Script (右键菜单辅助)

**文件：**
- 创建：`compare-diff-extension/content/context-menu.js`

- [ ] **Step 1: 实现 context-menu.js**

```javascript
/**
 * Content Script
 * 监听右键菜单选中事件（目前仅需 content_scripts 声明来确保右键菜单生效）
 * 如需额外页面交互可在此扩展
 */
// 当前右键菜单功能完全由 service worker 的 contextMenus API 处理，
// 此文件作为 content script 入口保留，供未来扩展使用。
```

- [ ] **Step 2: 验证**

重新加载扩展，确认 content script 注入成功，在页面中右键菜单仍然可用。

---

### Task 11: 端到端测试与修复

**文件：**
- 无新文件，修复现有文件中的问题

- [ ] **Step 1: 测试纯文本比较**

在 popup 中粘贴两段不同纯文本，点击比较，确认：
- 并排视图正确显示差异行
- 内联视图正确显示
- 颜色标记正确（绿=新增，红=删除）
- 统计数字正确

- [ ] **Step 2: 测试 JSON 比较**

粘贴两段 JSON 文本（key 顺序不同），选择 JSON 类型：
- 确认格式化后 key 排列整齐
- 勾选"忽略 key 顺序"后，key 顺序差异不再标记
- 未勾选时正确显示顺序差异

- [ ] **Step 3: 测试 XML 比较**

粘贴两段 XML 文本，选择 XML/HTML 类型：
- 确认格式化缩进正确
- 差异标记准确

- [ ] **Step 4: 测试文件拖拽**

拖拽 .json 文件到输入框：
- 文件内容正确读入
- 类型自动切换为 JSON

- [ ] **Step 5: 测试右键菜单**

在网页中选中文本 → 右键 → 添加到对比（左）→ 再选中另一段 → 添加到对比（右）：
- popup 打开并填入两段文本

- [ ] **Step 6: 测试数据持久化**

输入文本后关闭 popup → 重新打开：
- 文本内容恢复

- [ ] **Step 7: 测试复制功能**

点击"复制结果"和"复制差异摘要"：
- 剪贴板内容正确

- [ ] **Step 8: 修复发现的问题**

根据以上测试修复任何发现的 bug。

---

### Task 12: 最终优化与提交

**文件：**
- 可能微调 `popup.css`、`popup.js`

- [ ] **Step 1: 检查 popup 尺寸适配**

确保 popup 在 Chrome 中的默认尺寸下显示正常，如果需要可以在 `popup.html` 中添加：

```html
<style>
  html, body {
    width: 800px;
    height: 550px;
  }
</style>
```

- [ ] **Step 2: 检查空状态处理**

确保空输入时的提示友好、类型自动检测的回退正确。

- [ ] **Step 3: 清理临时文件**

删除 `generate-icons.html`（如果还存在于 icons 目录中）、确保 `context-menu.js` 内容简洁。

- [ ] **Step 4: 最终验证**

完整流程走一遍：粘贴 → 比较 → 切换视图 → 复制 → 返回 → 清空。

- [ ] **Step 5: 提交代码**

```bash
cd D:/yqs/myProject/wx/extension/compare-diff-extension
git add .
git commit -m "feat: 文本差异比较浏览器插件 v1.0.0

支持 JSON/XML/YAML/纯文本的格式化差异比较，提供并排和内联两种视图，
支持粘贴、文件拖拽和右键菜单三种输入方式。"
```
