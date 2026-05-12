// service-worker.js — Background service worker

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'perf-data-update') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      // 缓存数据到 storage（popup 打开时从这里读取）
      chrome.storage.local.set({ ['perf-data-' + tabId]: msg.data });

      // 更新 badge 显示 FPS
      if (msg.data && msg.data.fps != null) {
        const fps = Math.round(msg.data.fps);
        let color = '#0cce6a';
        if (fps < 30) color = '#ff4e42';
        else if (fps < 55) color = '#ffa400';
        const text = fps > 999 ? '999+' : fps + '';
        chrome.action.setBadgeText({ text, tabId }).catch(() => {});
        chrome.action.setBadgeBackgroundColor({ color, tabId }).catch(() => {});
      }
    }
  }
  // 回复 sender 避免 "message port closed" 错误
  sendResponse({ ok: true });
  return false;
});

// 清理 tab 关闭时的缓存
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove('perf-data-' + tabId);
});
