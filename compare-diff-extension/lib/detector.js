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
