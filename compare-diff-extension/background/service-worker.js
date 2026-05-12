/**
 * Service Worker
 * 负责右键菜单注册和消息中转
 */

// 安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'diff-add-left',
    title: '添加到文本对比（左 - 原始文本）',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'diff-add-right',
    title: '添加到文本对比（右 - 对比文本）',
    contexts: ['selection']
  });
});

// 右键菜单点击处理
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const selectedText = info.selectionText;
  if (!selectedText) return;

  let side;
  if (info.menuItemId === 'diff-add-left') {
    side = 'left';
  } else if (info.menuItemId === 'diff-add-right') {
    side = 'right';
  } else {
    return;
  }

  // 将选中文本存入 storage
  chrome.storage.local.get('contextMenuData', (data) => {
    const existing = data.contextMenuData || {};
    if (side === 'left') {
      existing.left = selectedText;
    } else {
      existing.right = selectedText;
    }

    // 判断是否两侧都有数据了
    if (existing.left && existing.right) {
      // 两段文本都已设置，打开 popup
      chrome.storage.local.set({ contextMenuData: existing }, () => {
        chrome.action.openPopup();
      });
    } else {
      chrome.storage.local.set({ contextMenuData: existing });
    }
  });
});
