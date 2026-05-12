// overlay.js — Content Script，负责创建浮动面板和注入 collector
(function () {
  if (window.__perfOverlayActive) return;
  window.__perfOverlayActive = true;

  let overlayVisible = true;
  let currentData = null;
  let contextValid = true;

  // 检查扩展上下文是否仍然有效（扩展重新加载后会失效）
  function checkContext() {
    try {
      if (!chrome.runtime?.id) {
        contextValid = false;
      }
    } catch (e) {
      contextValid = false;
    }
    return contextValid;
  }

  // 上下文失效时清理自身，让重新加载后的新 content script 能正常注入
  function cleanup() {
    if (host.parentNode) host.remove();
    window.__perfOverlayActive = false;
  }

  // --- 注入 collector.js 到页面主世界 ---
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content/collector.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  // --- 创建浮动面板 (Shadow DOM) ---
  const host = document.createElement('div');
  host.id = 'perf-monitor-host';
  host.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .panel {
      background: #1a1a2e;
      border-radius: 12px;
      color: #eee;
      font-size: 12px;
      width: 220px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      overflow: hidden;
      transition: all 0.3s ease;
      user-select: none;
    }
    .panel.minimized .panel-body { display: none; }
    .panel.minimized { width: auto; }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: #16213e;
      cursor: move;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .panel-header .title {
      font-weight: 600;
      font-size: 12px;
      color: #7fdbca;
      letter-spacing: 0.5px;
    }
    .panel-header .controls { display: flex; gap: 6px; }
    .panel-header button {
      background: none; border: none; color: #888;
      cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px;
    }
    .panel-header button:hover { color: #fff; }
    .panel-body { padding: 8px 12px; }
    .metric-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .metric-row:last-child { border-bottom: none; }
    .metric-label { color: #999; font-size: 11px; min-width: 70px; }
    .metric-value {
      font-weight: 600; font-size: 13px;
      font-variant-numeric: tabular-nums; text-align: right;
    }
    .rating-good { color: #0cce6a; }
    .rating-needs-improvement { color: #ffa400; }
    .rating-poor { color: #ff4e42; }
    .rating-unknown { color: #888; }
    .section-title {
      color: #7fdbca; font-size: 10px; text-transform: uppercase;
      letter-spacing: 1px; margin-top: 8px; margin-bottom: 4px;
      padding-bottom: 2px; border-bottom: 1px solid rgba(127,219,202,0.2);
    }
    .long-task-warn { color: #ff4e42; font-size: 10px; margin-top: 4px; }
  `;
  shadow.appendChild(style);

  // 面板 HTML — 移除 FID，保留 LCP / CLS / INP
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="panel-header">
      <span class="title">Perf Monitor</span>
      <div class="controls">
        <button class="btn-minimize" title="最小化">—</button>
        <button class="btn-close" title="关闭">✕</button>
      </div>
    </div>
    <div class="panel-body">
      <div class="section-title">Runtime</div>
      <div class="metric-row">
        <span class="metric-label">FPS</span>
        <span class="metric-value" id="m-fps">—</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Memory</span>
        <span class="metric-value" id="m-memory">—</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">DOM Nodes</span>
        <span class="metric-value" id="m-dom">—</span>
      </div>

      <div class="section-title">Web Vitals</div>
      <div class="metric-row">
        <span class="metric-label">LCP</span>
        <span class="metric-value" id="m-lcp">—</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">CLS</span>
        <span class="metric-value" id="m-cls">—</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">INP</span>
        <span class="metric-value" id="m-inp">—</span>
      </div>

      <div class="section-title">Page Load</div>
      <div class="metric-row">
        <span class="metric-label">TTFB</span>
        <span class="metric-value" id="m-ttfb">—</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">FCP</span>
        <span class="metric-value" id="m-fcp">—</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Load</span>
        <span class="metric-value" id="m-load">—</span>
      </div>

      <div id="long-task-area"></div>

      <div class="section-title">Resources</div>
      <div class="metric-row">
        <span class="metric-label">Requests</span>
        <span class="metric-value" id="m-requests">—</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Transfer</span>
        <span class="metric-value" id="m-transfer">—</span>
      </div>
    </div>
  `;
  shadow.appendChild(panel);

  // --- 拖拽 ---
  const header = panel.querySelector('.panel-header');
  let isDragging = false, dragOffsetX, dragOffsetY;

  header.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    dragOffsetX = e.clientX - host.offsetLeft;
    dragOffsetY = e.clientY - host.offsetTop;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    host.style.left = (e.clientX - dragOffsetX) + 'px';
    host.style.top = (e.clientY - dragOffsetY) + 'px';
    host.style.right = 'auto';
    host.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => { isDragging = false; });

  // --- 最小化 / 关闭 ---
  panel.querySelector('.btn-minimize').addEventListener('click', () => {
    panel.classList.toggle('minimized');
  });
  panel.querySelector('.btn-close').addEventListener('click', () => {
    host.style.display = 'none';
    overlayVisible = false;
  });

  // --- 更新面板（使用 shared/utils.js 的 RatingThresholds）---
  function updateOverlay(data) {
    const updates = {
      'm-fps':     { v: data.fps, cfg: RatingThresholds.fps, fmt: v => formatNumber(v) },
      'm-memory':  { v: data.memory, cfg: RatingThresholds.memory, fmt: v => v != null ? (v / 1024 / 1024).toFixed(1) + 'MB' : '—' },
      'm-dom':     { v: data.domNodes, cfg: RatingThresholds.domNodes, fmt: v => formatNumber(v) },
      'm-lcp':     { v: data.lcp, cfg: RatingThresholds.lcp, fmt: v => formatMs(v) },
      'm-cls':     { v: data.cls, cfg: RatingThresholds.cls, fmt: v => v !== null && v !== undefined ? (v < 0.01 ? '0' : v.toFixed(3)) : '—' },
      'm-inp':     { v: data.inp, cfg: RatingThresholds.inp, fmt: v => formatMs(v) },
      'm-ttfb':    { v: data.ttfb, cfg: RatingThresholds.ttfb, fmt: v => formatMs(v) },
      'm-fcp':     { v: data.fcp, cfg: RatingThresholds.fcp, fmt: v => formatMs(v) },
      'm-load':    { v: data.load, cfg: RatingThresholds.load, fmt: v => formatMs(v) },
    };

    for (const [id, { v, cfg, fmt }] of Object.entries(updates)) {
      const el = shadow.getElementById(id);
      if (!el) continue;
      el.textContent = fmt(v);
      const rating = getRating(v, cfg);
      el.className = 'metric-value rating-' + rating;
    }

    // 资源统计
    const summary = data.resourcesSummary || {};
    let totalCount = 0, totalSize = 0;
    for (const cat of Object.values(summary)) {
      totalCount += cat.count;
      totalSize += cat.size;
    }
    const reqEl = shadow.getElementById('m-requests');
    const transEl = shadow.getElementById('m-transfer');
    if (reqEl) reqEl.textContent = (data.resourcesTotal || totalCount) + '';
    if (transEl) transEl.textContent = formatBytes(totalSize);

    // 长任务告警
    const ltArea = shadow.getElementById('long-task-area');
    if (ltArea && data.longTasks && data.longTasks.length > 0) {
      const maxDur = Math.round(Math.max(...data.longTasks.map(t => t.duration)));
      ltArea.innerHTML = `<div class="long-task-warn">⚠ ${data.longTasks.length} long tasks (max ${maxDur}ms)</div>`;
    } else if (ltArea) {
      ltArea.innerHTML = '';
    }
  }

  // --- 接收 collector 数据 ---
  window.addEventListener('message', (e) => {
    if (e.data && e.data.source === 'perf-monitor-collector' && !e.data.type) {
      currentData = e.data.payload;
      if (overlayVisible) updateOverlay(currentData);

      // 上下文失效 → 清理自身，不再尝试调用任何 Chrome API
      if (!checkContext()) {
        cleanup();
        return;
      }

      try {
        chrome.runtime.sendMessage({
          type: 'perf-data-update',
          data: currentData,
          tabUrl: location.href,
        }).catch(() => {});
      } catch (e) {
        // chrome.runtime 不可用
      }
    }
  });

  // --- 接收来自 popup 的控制消息 ---
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!checkContext()) {
      cleanup();
      sendResponse({ ok: false });
      return false;
    }
    if (msg.type === 'toggle-overlay') {
      overlayVisible = !overlayVisible;
      host.style.display = overlayVisible ? '' : 'none';
      if (overlayVisible && currentData) updateOverlay(currentData);
    }
    if (msg.type === 'get-perf-data') {
      window.postMessage({ source: 'perf-monitor-content', type: 'request-data' }, '*');
    }
    if (msg.type === 'get-resource-details') {
      window.postMessage({ source: 'perf-monitor-content', type: 'request-resource-details' }, '*');
    }
    sendResponse({ ok: true });
    return false;
  });
})();
