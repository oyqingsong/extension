/**
 * selector.js — CSS 选择器路径计算引擎
 * 负责从 DOM 元素生成完整的 CSS 选择器路径
 */

const SelectorEngine = (() => {

  // 忽略的标签（script, style, 自身注入的元素等）
  const IGNORE_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

  /**
   * 获取元素的唯一 CSS 选择器
   * 优先级：id > 唯一 class 组合 > nth-child
   */
  function getUniqueSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el === document.documentElement) return 'html';
    if (el === document.body) return 'body';

    const path = [];
    let current = el;

    while (current && current !== document.documentElement) {
      if (current.nodeType !== 1) {
        current = current.parentNode;
        continue;
      }
      const selector = _getElementSelector(current);
      path.unshift(selector);

      // 如果已经可以通过 id 唯一确定，就不再往上查找
      if (current.id) break;

      // 检查当前路径是否已经唯一
      const testSelector = path.join(' > ');
      try {
        const found = document.querySelector(testSelector);
        if (found === el) break;
      } catch (e) {
        // 选择器无效，继续向上查找
      }

      current = current.parentNode;
    }

    return path.join(' > ');
  }

  /**
   * 获取完整的 DOM 路径（用于显示面包屑）
   */
  function getDomPath(el) {
    if (!el || el.nodeType !== 1) return [];

    const path = [];
    let current = el;

    while (current && current !== document.documentElement) {
      if (current.nodeType !== 1) {
        current = current.parentNode;
        continue;
      }
      path.unshift({
        tag: current.tagName.toLowerCase(),
        id: current.id || null,
        classes: current.className && typeof current.className === 'string'
          ? current.className.trim().split(/\s+/).filter(Boolean)
          : [],
        selector: _getElementSelector(current)
      });
      current = current.parentNode;
    }

    path.unshift({ tag: 'html', id: null, classes: [], selector: 'html' });
    return path;
  }

  /**
   * 获取精简选择器（更短、更实用的选择器）
   */
  function getCompactSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el === document.documentElement) return 'html';
    if (el === document.body) return 'body';

    // 1. 尝试 id 选择器
    if (el.id) {
      return `#${CSS.escape(el.id)}`;
    }

    // 2. 尝试唯一 class 选择器
    const classSelector = _getClassSelector(el);
    if (classSelector) {
      try {
        const found = document.querySelectorAll(classSelector);
        if (found.length === 1 && found[0] === el) {
          return classSelector;
        }
      } catch (e) { /* ignore */ }
    }

    // 3. 尝试 tag + class 组合
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length > 0) {
        const selector = el.tagName.toLowerCase() + '.' + classes.map(c => CSS.escape(c)).join('.');
        try {
          const found = document.querySelectorAll(selector);
          if (found.length === 1 && found[0] === el) {
            return selector;
          }
        } catch (e) { /* ignore */ }
      }
    }

    // 4. 回退到完整路径
    return getUniqueSelector(el);
  }

  /**
   * 计算 CSS specificity
   * 返回 [inline, id, class/attr/pseudo-class, type/pseudo-element]
   */
  function getSpecificity(selector) {
    try {
      // 使用浏览器原生方法计算
      const style = document.createElement('style');
      style.textContent = `${selector} {}`;
      document.head.appendChild(style);
      const sheet = style.sheet;
      const rule = sheet.cssRules[0];
      const specificity = rule ? rule.selectorText : selector;
      document.head.removeChild(style);

      // 手动计算 specificity
      return _calculateSpecificity(selector);
    } catch (e) {
      return _calculateSpecificity(selector);
    }
  }

  /**
   * 格式化 specificity 为字符串
   */
  function formatSpecificity(spec) {
    if (!spec) return '(0, 0, 0, 0)';
    return `(${spec[0]}, ${spec[1]}, ${spec[2]}, ${spec[3]})`;
  }

  /**
   * 获取元素的所有匹配的 CSS 规则
   */
  function getMatchedRules(el) {
    const rules = [];
    const sheets = document.styleSheets;

    for (const sheet of sheets) {
      try {
        const cssRules = sheet.cssRules || sheet.rules;
        for (const rule of cssRules) {
          if (rule.selectorText) {
            try {
              if (el.matches(rule.selectorText)) {
                rules.push({
                  selector: rule.selectorText,
                  specificity: _calculateSpecificity(rule.selectorText),
                  cssText: rule.cssText,
                  source: sheet.href || 'inline'
                });
              }
            } catch (e) {
              // matches() 可能抛异常（伪元素等）
            }
          }
        }
      } catch (e) {
        // 跨域样式表无法访问
      }
    }

    // 按 specificity 降序排序
    rules.sort((a, b) => {
      for (let i = 0; i < 4; i++) {
        if (b.specificity[i] !== a.specificity[i]) {
          return b.specificity[i] - a.specificity[i];
        }
      }
      return 0;
    });

    return rules;
  }

  // ==================== 内部方法 ====================

  function _getElementSelector(el) {
    const tag = el.tagName.toLowerCase();

    // 有 id 就用 id
    if (el.id) {
      return `${tag}#${CSS.escape(el.id)}`;
    }

    // 尝试用 class
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length > 0) {
        return `${tag}.${classes.map(c => CSS.escape(c)).join('.')}`;
      }
    }

    // 回退到 nth-child
    return `${tag}:nth-child(${_getChildIndex(el)})`;
  }

  function _getClassSelector(el) {
    if (!el.className || typeof el.className !== 'string') return null;

    const classes = el.className.trim().split(/\s+/).filter(Boolean);
    if (classes.length === 0) return null;

    return '.' + classes.map(c => CSS.escape(c)).join('.');
  }

  function _getChildIndex(el) {
    let index = 1;
    let sibling = el.previousElementSibling;
    while (sibling) {
      index++;
      sibling = sibling.previousElementSibling;
    }
    return index;
  }

  function _calculateSpecificity(selector) {
    const spec = [0, 0, 0, 0]; // [inline, id, class/attr/pseudo-class, type/pseudo-element]

    // 移除 :not() 内容（但 :not 自身计算）
    let s = selector;

    // !important → inline
    if (s.includes('!important')) spec[0]++;

    // #id
    const idMatches = s.match(/#[a-zA-Z_][\w-]*/g);
    if (idMatches) spec[1] += idMatches.length;

    // .class
    const classMatches = s.match(/\.[a-zA-Z_][\w-]*/g);
    if (classMatches) spec[2] += classMatches.length;

    // [attr]
    const attrMatches = s.match(/\[[^\]]+\]/g);
    if (attrMatches) spec[2] += attrMatches.length;

    // :pseudo-class（排除 ::pseudo-element）
    const pseudoClassMatches = s.match(/:[a-zA-Z][\w-]*(?=\(|(?::)|[^\[:])/g);
    if (pseudoClassMatches) {
      spec[2] += pseudoClassMatches.filter(p => !p.startsWith('::')).length;
    }

    // ::pseudo-element
    const pseudoElMatches = s.match(/::[a-zA-Z][\w-]*/g);
    if (pseudoElMatches) spec[3] += pseudoElMatches.length;

    // type 选择器
    const typeMatches = s.match(/(?:^|[\s>+~])([a-zA-Z][\w-]*)/g);
    if (typeMatches) {
      const filtered = typeMatches.filter(t => {
        const name = t.trim();
        return name && !name.startsWith('#') && !name.startsWith('.') && !name.startsWith(':');
      });
      spec[3] += filtered.length;
    }

    return spec;
  }

  return {
    getUniqueSelector,
    getDomPath,
    getCompactSelector,
    getSpecificity,
    formatSpecificity,
    getMatchedRules
  };
})();
