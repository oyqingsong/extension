/**
 * Diff 结果渲染器
 * 支持字符级差异高亮：对修改行进一步用 diffChars 标记具体变化的字符
 */
const Renderer = {
  /**
   * 渲染并排对比视图
   */
  renderSideBySide(changes, oldText, newText) {
    // 将连续的 removed+added 块配对，用于字符级比较
    const pairs = this._pairChanges(changes);

    let leftHtml = '';
    let rightHtml = '';
    let oldLineNum = 0;
    let newLineNum = 0;

    pairs.forEach(pair => {
      if (pair.type === 'equal') {
        pair.lines.forEach(line => {
          oldLineNum++;
          newLineNum++;
          leftHtml += this._buildLine(oldLineNum, line, 'diff-equal', null);
          rightHtml += this._buildLine(newLineNum, line, 'diff-equal', null);
        });
      } else if (pair.type === 'removed') {
        pair.lines.forEach(line => {
          oldLineNum++;
          leftHtml += this._buildLine(oldLineNum, line, 'diff-removed', null);
          rightHtml += this._buildLine('', '', 'diff-empty', null);
        });
      } else if (pair.type === 'added') {
        pair.lines.forEach(line => {
          newLineNum++;
          leftHtml += this._buildLine('', '', 'diff-empty', null);
          rightHtml += this._buildLine(newLineNum, line, 'diff-added', null);
        });
      } else if (pair.type === 'modified') {
        // 字符级比较
        const maxLen = Math.max(pair.oldLines.length, pair.newLines.length);
        for (let i = 0; i < maxLen; i++) {
          const oldLine = i < pair.oldLines.length ? pair.oldLines[i] : null;
          const newLine = i < pair.newLines.length ? pair.newLines[i] : null;

          let leftContent = null;
          let rightContent = null;

          if (oldLine !== null && newLine !== null) {
            // 对这两行做字符级 diff
            const charDiffs = Diff.diffChars(oldLine, newLine);
            leftContent = this._renderCharDiff(charDiffs, 'remove');
            rightContent = this._renderCharDiff(charDiffs, 'add');
            oldLineNum++;
            newLineNum++;
            leftHtml += this._buildLine(oldLineNum, null, 'diff-removed', leftContent);
            rightHtml += this._buildLine(newLineNum, null, 'diff-added', rightContent);
          } else if (oldLine !== null) {
            oldLineNum++;
            leftHtml += this._buildLine(oldLineNum, oldLine, 'diff-removed', null);
            rightHtml += this._buildLine('', '', 'diff-empty', null);
          } else {
            newLineNum++;
            leftHtml += this._buildLine('', '', 'diff-empty', null);
            rightHtml += this._buildLine(newLineNum, newLine, 'diff-added', null);
          }
        }
      }
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
   */
  renderInline(changes) {
    const pairs = this._pairChanges(changes);
    let html = '';
    let lineNum = 0;

    pairs.forEach(pair => {
      if (pair.type === 'equal') {
        pair.lines.forEach(line => {
          lineNum++;
          html += this._buildLine(lineNum, line, 'diff-equal', null);
        });
      } else if (pair.type === 'removed') {
        pair.lines.forEach(line => {
          lineNum++;
          html += this._buildLine(lineNum, line, 'diff-removed', null);
        });
      } else if (pair.type === 'added') {
        pair.lines.forEach(line => {
          lineNum++;
          html += this._buildLine(lineNum, line, 'diff-added', null);
        });
      } else if (pair.type === 'modified') {
        const maxLen = Math.max(pair.oldLines.length, pair.newLines.length);
        for (let i = 0; i < maxLen; i++) {
          const oldLine = i < pair.oldLines.length ? pair.oldLines[i] : null;
          const newLine = i < pair.newLines.length ? pair.newLines[i] : null;

          if (oldLine !== null && newLine !== null) {
            const charDiffs = Diff.diffChars(oldLine, newLine);
            lineNum++;
            html += this._buildLine(lineNum, null, 'diff-removed', this._renderCharDiff(charDiffs, 'remove'));
            lineNum++;
            html += this._buildLine(lineNum, null, 'diff-added', this._renderCharDiff(charDiffs, 'add'));
          } else if (oldLine !== null) {
            lineNum++;
            html += this._buildLine(lineNum, oldLine, 'diff-removed', null);
          } else {
            lineNum++;
            html += this._buildLine(lineNum, newLine, 'diff-added', null);
          }
        }
      }
    });

    return `
      <div class="diff-view diff-inline">
        <div class="diff-content">${html}</div>
      </div>`;
  },

  /**
   * 将 diffLines 结果中的连续 removed+added 块配对
   * 返回 [{ type: 'equal'|'removed'|'added'|'modified', lines, oldLines, newLines }]
   */
  _pairChanges(changes) {
    const pairs = [];
    let i = 0;

    while (i < changes.length) {
      const change = changes[i];

      if (!change.added && !change.removed) {
        // 相同行
        const lines = change.value.replace(/\n$/, '').split('\n');
        pairs.push({ type: 'equal', lines });
        i++;
      } else if (change.removed) {
        const oldLines = change.value.replace(/\n$/, '').split('\n');
        // 检查下一个是否是 added（修改对）
        if (i + 1 < changes.length && changes[i + 1].added) {
          const newLines = changes[i + 1].value.replace(/\n$/, '').split('\n');
          pairs.push({ type: 'modified', oldLines, newLines });
          i += 2;
        } else {
          pairs.push({ type: 'removed', lines: oldLines });
          i++;
        }
      } else if (change.added) {
        const newLines = change.value.replace(/\n$/, '').split('\n');
        pairs.push({ type: 'added', lines: newLines });
        i++;
      } else {
        i++;
      }
    }

    return pairs;
  },

  /**
   * 渲染字符级差异 HTML
   * @param {Array} charDiffs - diffChars 结果
   * @param {string} side - 'add' 或 'remove'
   * @returns {string} HTML 字符串
   */
  _renderCharDiff(charDiffs, side) {
    const cssClass = side === 'add' ? 'diff-char-add' : 'diff-char-remove';
    let html = '';

    charDiffs.forEach(part => {
      const escaped = this._escapeHtml(part.value);
      if (side === 'add' && part.added) {
        html += `<span class="${cssClass}">${escaped}</span>`;
      } else if (side === 'remove' && part.removed) {
        html += `<span class="${cssClass}">${escaped}</span>`;
      } else if (!part.added && !part.removed) {
        html += escaped;
      }
      // 另一侧的部分在另一侧渲染时跳过
    });

    return html;
  },

  /**
   * 构建单行 HTML
   * @param {number|string} lineNum - 行号
   * @param {string|null} content - 行内容（如果 customContent 不为 null，此参数被忽略）
   * @param {string} cssClass - CSS 类名
   * @param {string|null} customContent - 自定义 HTML 内容（字符级高亮时使用）
   */
  _buildLine(lineNum, content, cssClass, customContent) {
    const escaped = customContent !== null ? customContent : this._escapeHtml(content);
    const prefix = this._getPrefix(cssClass);
    return `<div class="diff-line ${cssClass}">
      <span class="diff-line-num">${lineNum}</span>
      <span class="diff-line-content"><span class="diff-line-prefix">${prefix}</span>${escaped}</span>
    </div>`;
  },

  /**
   * 获取行前缀符号
   */
  _getPrefix(cssClass) {
    if (cssClass === 'diff-added') return '+';
    if (cssClass === 'diff-removed') return '-';
    return ' ';
  },

  /**
   * 计算差异统计
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
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
