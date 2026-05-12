/**
 * service-worker.js — Background Service Worker
 * 状态中枢：所有状态变更都经过这里
 */

// 插件安装/更新时初始化
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ cssHighlightEnabled: false });
  updateIcon(false);
});

// ==================== 消息处理 ====================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'setState') {
    // 来自 popup 或快捷键：设置明确的启用/禁用状态
    const enabled = msg.enabled;
    chrome.storage.local.set({ cssHighlightEnabled: enabled });
    updateIcon(enabled);
    notifyActiveTab(enabled);
  } else if (msg.action === 'statusChanged') {
    // 来自 content script（Esc 关闭等）：同步状态
    chrome.storage.local.set({ cssHighlightEnabled: msg.enabled });
    updateIcon(msg.enabled);
  }
  return true;
});

// ==================== 快捷键 ====================

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-highlight') {
    chrome.storage.local.get(['cssHighlightEnabled'], (result) => {
      const newState = !result.cssHighlightEnabled;
      chrome.storage.local.set({ cssHighlightEnabled: newState });
      updateIcon(newState);
      notifyActiveTab(newState);
    });
  }
});

// ==================== 通知 Content Script ====================

function notifyActiveTab(enabled) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;

    chrome.tabs.sendMessage(tabs[0].id, { action: 'setState', enabled }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script 未加载，手动注入后再通知
        injectContentScripts(tabs[0].id, () => {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'setState', enabled });
        });
      }
    });
  });
}

/**
 * 手动注入 content scripts
 * 解决"页面在插件安装前已打开"的问题
 */
function injectContentScripts(tabId, callback) {
  const scripts = [
    'content/highlight.js',
    'content/selector.js',
    'content/panel.js',
    'content/main.js'
  ];

  chrome.scripting.insertCSS({
    target: { tabId },
    files: ['content/styles.css']
  }, () => {
    let i = 0;
    function injectNext() {
      if (i >= scripts.length) {
        if (callback) callback();
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId },
        files: [scripts[i]]
      }, () => {
        i++;
        injectNext();
      });
    }
    injectNext();
  });
}

// ==================== 图标更新 ====================

function updateIcon(active) {
  if (active) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#4caf50' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}
