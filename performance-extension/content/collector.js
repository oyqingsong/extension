// collector.js — 注入到页面主世界 (MAIN world) 中运行
// 直接访问 performance API，采集性能数据后通过 postMessage 发送给 content script
(function () {
  if (window.__perfMonitorActive) return;
  window.__perfMonitorActive = true;

  // --- 一次性加载指标（页面加载后不再变化）---
  const loadMetrics = {
    fcp: null, ttfb: null, domReady: null, load: null, lcp: null,
    loaded: false,
  };

  // --- 实时指标（持续变化）---
  const realtime = {
    fps: null,
    memory: null,
    domNodes: null,
    cls: 0,
    inp: null,
    longTasks: [],
    resourcesSummary: {},
    resourcesTotal: 0,
    timestamp: Date.now(),
  };

  // ========== 一次性加载指标采集 ==========

  function collectLoadMetrics() {
    // FCP — 从 paint entries 获取
    const paintEntries = performance.getEntriesByType('paint');
    for (const e of paintEntries) {
      if (e.name === 'first-contentful-paint') {
        loadMetrics.fcp = e.startTime;
      }
    }

    // TTFB / DOM Ready / Load — 从 navigation entry 获取
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      loadMetrics.ttfb = nav.responseStart - nav.startTime;
      loadMetrics.domReady = nav.domContentLoadedEventEnd - nav.startTime;
      loadMetrics.load = nav.loadEventEnd - nav.startTime;
    }
  }

  // ========== CLS — Session Window 算法 ==========
  let clsSessionValue = 0;
  let clsSessionEntries = [];
  let clsSessionStartTime = 0;
  let clsMaxSessionValue = 0;

  function processLayoutShift(entry) {
    if (entry.hadRecentInput) return;

    const shouldStartNewSession =
      !clsSessionEntries.length ||
      entry.startTime - clsSessionStartTime > 1000 ||
      entry.startTime - clsSessionEntries[0].startTime > 5000;

    if (shouldStartNewSession) {
      clsMaxSessionValue = Math.max(clsMaxSessionValue, clsSessionValue);
      clsSessionValue = 0;
      clsSessionEntries = [];
      clsSessionStartTime = entry.startTime;
    }

    clsSessionValue += entry.value;
    clsSessionEntries.push(entry);
    realtime.cls = Math.max(clsMaxSessionValue, clsSessionValue);
  }

  // ========== INP — P98 算法 ==========
  const eventDurations = [];

  function processEvent(entry) {
    if (entry.duration < 16) return;
    eventDurations.push(entry.duration);
    if (eventDurations.length > 500) eventDurations.shift();
    realtime.inp = percentile(eventDurations, 98);
  }

  function percentile(arr, p) {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  // ========== Performance Observers ==========
  function setupObservers() {
    // LCP
    try {
      new PerformanceObserver(list => {
        const entries = list.getEntries();
        if (entries.length) loadMetrics.lcp = entries[entries.length - 1].startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {}

    // CLS
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) processLayoutShift(entry);
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (e) {}

    // INP
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) processEvent(entry);
      }).observe({ type: 'event', buffered: true });
    } catch (e) {}

    // Long Tasks
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          realtime.longTasks.push({
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime),
          });
          if (realtime.longTasks.length > 20) realtime.longTasks.shift();
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch (e) {}
  }

  // ========== FPS Counter ==========
  let frameCount = 0;
  let lastTime = performance.now();
  function fpsLoop(now) {
    frameCount++;
    if (now - lastTime >= 1000) {
      realtime.fps = Math.round(frameCount * 1000 / (now - lastTime));
      frameCount = 0;
      lastTime = now;
    }
    requestAnimationFrame(fpsLoop);
  }
  requestAnimationFrame(fpsLoop);

  // ========== Memory ==========
  function collectMemory() {
    if (performance.memory) {
      realtime.memory = performance.memory.usedJSHeapSize;
    }
  }

  // ========== DOM Nodes ==========
  // [fix] 使用 -Infinity 确保首次调用必定采集
  let lastDomCollect = -Infinity;
  function collectDOMNodes(now) {
    if (now - lastDomCollect < 5000) return;
    lastDomCollect = now;
    realtime.domNodes = document.querySelectorAll('*').length;
  }

  // ========== 资源摘要 ==========
  function collectResourcesSummary() {
    const resources = performance.getEntriesByType('resource');
    const summary = {};
    for (const r of resources) {
      let type = 'Other';
      const t = r.initiatorType || '';
      const u = r.name || '';
      if (t === 'xmlhttprequest' || t === 'fetch') type = 'XHR';
      else if (t === 'script' || /\.js(\?|$)/.test(u)) type = 'JS';
      else if (t === 'css' || /\.css(\?|$)/.test(u)) type = 'CSS';
      else if (t === 'img' || /\.(png|jpg|jpeg|gif|svg|webp|ico)(\?|$)/.test(u)) type = 'Image';
      else if (t === 'font' || /\.(woff2?|ttf|eot)(\?|$)/.test(u)) type = 'Font';

      if (!summary[type]) summary[type] = { count: 0, size: 0, maxDuration: 0 };
      summary[type].count++;
      summary[type].size += r.transferSize || 0;
      summary[type].maxDuration = Math.max(summary[type].maxDuration, Math.round(r.duration));
    }
    realtime.resourcesSummary = summary;
    realtime.resourcesTotal = resources.length;
  }

  // ========== 数据发送 ==========
  function sendData() {
    const now = performance.now();

    // [fix] 持续采集加载指标直到页面加载完成，之后不再重复采集
    if (!loadMetrics.loaded) {
      collectLoadMetrics();
      if (loadMetrics.load > 0) {
        loadMetrics.loaded = true;
      }
    }

    collectMemory();
    collectDOMNodes(now);
    collectResourcesSummary(); // [fix] 每次都采集，摘要很轻量

    realtime.timestamp = Date.now();

    // [fix] 始终包含所有字段，不再按 loaded 条件过滤
    window.postMessage({
      source: 'perf-monitor-collector',
      payload: {
        fcp: loadMetrics.fcp,
        ttfb: loadMetrics.ttfb,
        domReady: loadMetrics.domReady,
        load: loadMetrics.load,
        lcp: loadMetrics.lcp,
        fps: realtime.fps,
        memory: realtime.memory,
        domNodes: realtime.domNodes,
        cls: realtime.cls,
        inp: realtime.inp,
        longTasks: realtime.longTasks,
        resourcesSummary: realtime.resourcesSummary,
        resourcesTotal: realtime.resourcesTotal,
        timestamp: realtime.timestamp,
      },
    }, '*');
  }

  // ========== 初始化 ==========
  setupObservers();

  if (document.readyState === 'complete') {
    setTimeout(sendData, 500);
  } else {
    window.addEventListener('load', () => setTimeout(sendData, 500));
  }

  setInterval(sendData, 2000);

  window.addEventListener('message', (e) => {
    if (e.data && e.data.source === 'perf-monitor-content') {
      if (e.data.type === 'request-data') sendData();
    }
  });
})();
