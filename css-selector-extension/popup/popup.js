/**
 * popup.js — Popup 弹窗逻辑
 * 只负责 UI 展示和转发操作到 Service Worker
 */

document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('toggleSwitch');

  // 读取当前状态
  chrome.storage.local.get(['cssHighlightEnabled'], (result) => {
    toggleSwitch.checked = !!result.cssHighlightEnabled;
  });

  // 切换开关 — 只发消息给 Service Worker，由它处理 storage 和 content script
  toggleSwitch.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      action: 'setState',
      enabled: toggleSwitch.checked
    });
  });
});
