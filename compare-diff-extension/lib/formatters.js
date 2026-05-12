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
      let formatted = '';
      let indent = 0;
      const tab = '  ';
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
   */
  formatYAML(text) {
    return text
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .replace(/\r\n/g, '\n')
      .trim();
  },

  /**
   * 纯文本格式化（可选统一空白符）
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
