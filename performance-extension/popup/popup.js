// popup.js — Popup 弹窗逻辑

// 安全发送消息到 content script，避免 "Receiving end does not exist" 错误
function safeSendToTab(tabId, msg) {
  chrome.tabs.sendMessage(tabId, msg).catch(() => {});
}

function isSupportedUrl(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}

document.addEventListener('DOMContentLoaded', () => {
  let overlayVisible = true;

  // 获取当前 tab 数据
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return;

    document.getElementById('page-url').textContent = tab.url || '';

    // 只在 http/https 页面发送消息（chrome:// 等页面没有 content script）
    if (isSupportedUrl(tab.url)) {
      safeSendToTab(tab.id, { type: 'get-perf-data' });
    }

    const storageKey = 'perf-data-' + tab.id;
    chrome.storage.local.get(storageKey, (result) => {
      if (result[storageKey]) {
        renderData(result[storageKey]);
      }
    });
  });

  // 监听实时数据更新
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'perf-data-update') {
      renderData(msg.data);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.storage.local.set({ ['perf-data-' + tabs[0].id]: msg.data });
        }
      });
    }
  });

  // --- 渲染数据 ---
  function renderData(data) {
    if (!data) return;

    // Web Vitals 卡片（LCP / CLS / INP）
    renderVitalCard('card-lcp', data.lcp, RatingThresholds.lcp, 'ms');
    renderVitalCard('card-cls', data.cls, RatingThresholds.cls, 'cls');
    renderVitalCard('card-inp', data.inp, RatingThresholds.inp, 'ms');

    // 加载指标条
    renderLoadMetric('ttfb', data.ttfb, RatingThresholds.ttfb, 3000);
    renderLoadMetric('fcp', data.fcp, RatingThresholds.fcp, 5000);
    renderLoadMetric('domReady', data.domReady, RatingThresholds.domReady, 5000);
    renderLoadMetric('load', data.load, RatingThresholds.load, 8000);

    // 运行时
    renderRuntimeValue('val-fps', formatNumber(data.fps), getRating(data.fps, RatingThresholds.fps));
    renderRuntimeValue('val-memory', data.memory ? (data.memory / 1024 / 1024).toFixed(1) + 'MB' : '—', data.memory ? getRating(data.memory, RatingThresholds.memory) : 'unknown');
    renderRuntimeValue('val-domNodes', formatNumber(data.domNodes), data.domNodes ? getRating(data.domNodes, RatingThresholds.domNodes) : 'unknown');
    const longTaskCount = data.longTasks ? data.longTasks.length : 0;
    renderRuntimeValue('val-longTasks', longTaskCount + '', longTaskCount > 0 ? 'poor' : 'good');

    // 资源统计（使用摘要数据）
    renderResources(data.resourcesSummary || {}, data.resourcesTotal || 0);
  }

  function renderVitalCard(id, value, config, formatType) {
    const card = document.getElementById(id);
    if (!card) return;
    const rating = getRating(value, config);
    card.className = 'vital-card' + (rating !== 'unknown' ? ' rating-' + rating : '');
    const valueEl = card.querySelector('.vital-value');
    valueEl.style.color = ratingColor(rating);

    if (formatType === 'ms') {
      valueEl.textContent = formatMs(value);
    } else if (formatType === 'cls') {
      valueEl.textContent = value !== null && value !== undefined ? (value < 0.01 ? '0' : value.toFixed(3)) : '—';
    }
  }

  function renderLoadMetric(key, value, config, maxMs) {
    const barEl = document.getElementById('bar-' + key);
    const valEl = document.getElementById('val-' + key);
    if (!barEl || !valEl) return;

    const rating = getRating(value, config);
    const pct = value != null ? Math.min((value / maxMs) * 100, 100) : 0;
    barEl.style.width = pct + '%';
    barEl.className = 'metric-fill' + (rating !== 'good' ? ' ' + rating : '');
    valEl.textContent = formatMs(value);
    valEl.style.color = ratingColor(rating);
  }

  function renderRuntimeValue(id, text, rating) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || '—';
    el.style.color = ratingColor(rating);
  }

  // 资源统计（使用 collector 发送的摘要）
  function renderResources(summary, total) {
    const container = document.getElementById('resources-summary');
    if (!container) return;

    const types = Object.keys(summary);
    if (!types.length) {
      container.innerHTML = '<div class="res-loading">暂无资源数据</div>';
      return;
    }

    let totalCount = 0, totalSize = 0;
    for (const cat of Object.values(summary)) {
      totalCount += cat.count;
      totalSize += cat.size;
    }
    const maxCount = Math.max(...Object.values(summary).map(c => c.count));
    const typeOrder = ['JS', 'CSS', 'Image', 'Font', 'XHR', 'Media', 'Other'];

    let html = '';
    for (const type of typeOrder) {
      const cat = summary[type];
      if (!cat) continue;
      const pct = maxCount > 0 ? (cat.count / maxCount * 100) : 0;
      html += `
        <div class="res-row">
          <span class="res-type">${type}</span>
          <span class="res-count">${cat.count}</span>
          <span class="res-bar-wrap"><span class="res-bar-fill res-${type}" style="width:${pct}%"></span></span>
          <span class="res-size">${formatBytes(cat.size)}</span>
        </div>`;
    }

    html += `
      <div class="res-total">
        <span>总计 ${total || totalCount} 个请求</span>
        <span>${formatBytes(totalSize)}</span>
      </div>`;
    container.innerHTML = html;
  }

  // --- 按钮事件 ---
  document.getElementById('btn-toggle-overlay').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !isSupportedUrl(tabs[0].url)) return;
      overlayVisible = !overlayVisible;
      safeSendToTab(tabs[0].id, { type: 'toggle-overlay' });
      document.getElementById('btn-toggle-overlay').textContent = overlayVisible ? '隐藏浮动窗口' : '显示浮动窗口';
    });
  });

  document.getElementById('btn-refresh').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !isSupportedUrl(tabs[0].url)) return;
      safeSendToTab(tabs[0].id, { type: 'get-perf-data' });
    });
  });
});
