// 共用的工具函数 — 被 overlay.js 和 popup.js 引用

// 评级阈值配置
const RatingThresholds = {
  lcp:    { good: 2500, poor: 4000 },
  cls:    { good: 0.1, poor: 0.25 },
  inp:    { good: 200, poor: 500 },
  fcp:    { good: 1800, poor: 3000 },
  domReady: { good: 1000, poor: 3000 },
  load:   { good: 3000, poor: 5000 },
  ttfb:   { good: 800, poor: 1800 },
  fps:    { good: 55, poor: 30, inverse: true },
  memory: { good: 50 * 1024 * 1024, poor: 100 * 1024 * 1024 },
  domNodes: { good: 1500, poor: 3000 },
  longTasks: { good: 0, poor: 5 },
};

function getRating(value, config) {
  if (value === null || value === undefined) return 'unknown';
  if (config.inverse) {
    if (value >= config.good) return 'good';
    if (value >= config.poor) return 'needs-improvement';
    return 'poor';
  }
  if (value <= config.good) return 'good';
  if (value <= config.poor) return 'needs-improvement';
  return 'poor';
}

function ratingColor(rating) {
  const map = { good: '#0cce6a', 'needs-improvement': '#ffa400', poor: '#ff4e42', unknown: '#888' };
  return map[rating] || '#888';
}

function formatMs(value) {
  if (value === null || value === undefined) return '—';
  return value >= 1000 ? (value / 1000).toFixed(2) + 's' : Math.round(value) + 'ms';
}

function formatBytes(bytes) {
  if (!bytes) return '0B';
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  if (!value && value !== 0) return '—';
  return Math.round(value) + '';
}

// 资源类型分类
function categorizeResource(initiatorType, url) {
  const t = initiatorType || '';
  const u = url || '';
  if (t === 'xmlhttprequest' || t === 'fetch') return 'XHR';
  if (t === 'script' || /\.js(\?|$)/.test(u)) return 'JS';
  if (t === 'css' || /\.css(\?|$)/.test(u)) return 'CSS';
  if (t === 'img' || /\.(png|jpg|jpeg|gif|svg|webp|ico)(\?|$)/.test(u)) return 'Image';
  if (t === 'font' || /\.(woff2?|ttf|eot)(\?|$)/.test(u)) return 'Font';
  if ( /\.(mp4|webm|avi)(\?|$)/.test(u)) return 'Media';
  return 'Other';
}
