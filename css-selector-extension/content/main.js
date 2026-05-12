/**
 * main.js — Content Script 主入口
 * 串联高亮覆盖层、选择器引擎、信息面板
 */

(() => {
  'use strict';

  const PANEL_ID = '__css_selector_panel__';
  const OVERLAY_ID = '__css_selector_overlay__';

  let enabled = false;
  let locked = false;         // 是否锁定当前元素
  let lockedElement = null;   // 锁定的元素
  let currentElement = null;
  let rafId = null;

  // ==================== 初始化 ====================

  function init() {
    chrome.storage.local.get(['cssHighlightEnabled'], (result) => {
      if (result.cssHighlightEnabled) {
        enable();
      }
    });

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'setState') {
        // 接收明确的状态，不做翻转
        if (msg.enabled && !enabled) {
          enable();
        } else if (!msg.enabled && enabled) {
          disable();
        }
        sendResponse({ enabled });
      } else if (msg.action === 'getStatus') {
        sendResponse({ enabled });
      }
      return true;
    });
  }

  // ==================== 启用/禁用 ====================

  function enable() {
    if (enabled) return;
    enabled = true;

    HighlightOverlay.init();
    InfoPanel.init();
    InfoPanel.show();

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function disable() {
    if (!enabled) return;
    enabled = false;
    unlock();

    HighlightOverlay.setActive(false);
    HighlightOverlay.destroy();
    InfoPanel.hide();
    InfoPanel.destroy();

    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('keydown', onKeyDown, true);

    currentElement = null;
    if (rafId) cancelAnimationFrame(rafId);
  }

  // ==================== 锁定/解锁 ====================

  function lock() {
    if (!currentElement || locked) return;
    locked = true;
    lockedElement = currentElement;

    HighlightOverlay.setLocked(true);
    InfoPanel.setLocked(true);
  }

  function unlock() {
    if (!locked) return;
    locked = false;
    lockedElement = null;

    HighlightOverlay.setLocked(false);
    InfoPanel.setLocked(false);
  }

  // ==================== 复制 ====================

  function copyCompact() {
    const el = locked ? lockedElement : currentElement;
    if (!el) return;

    const selector = SelectorEngine.getCompactSelector(el);
    _copyToClipboard(selector);
    InfoPanel.showToast('已复制: ' + selector);
  }

  function copyPath() {
    const el = locked ? lockedElement : currentElement;
    if (!el) return;

    const path = SelectorEngine.getUniqueSelector(el);
    _copyToClipboard(path);
    InfoPanel.showToast('已复制: ' + path);
  }

  function _copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    });
  }

  // ==================== 事件处理 ====================

  function onMouseMove(e) {
    if (!enabled) return;
    if (locked) return; // 锁定时不跟随鼠标

    const target = document.elementFromPoint(e.clientX, e.clientY);

    if (!target ||
        target.id === OVERLAY_ID ||
        target.id === PANEL_ID ||
        target.closest(`#${PANEL_ID}`) ||
        target.closest(`#${OVERLAY_ID}`)) {
      return;
    }

    if (target !== currentElement) {
      currentElement = target;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        HighlightOverlay.setActive(true);
        HighlightOverlay.highlight(currentElement);
        InfoPanel.update(currentElement);
      });
    }
  }

  function onMouseDown(e) {
    if (!enabled) return;

    // 点击面板内部，不处理
    if (e.target.closest(`#${PANEL_ID}`)) return;

    // 忽略插件自身元素
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target.closest(`#${PANEL_ID}`) || target.closest(`#${OVERLAY_ID}`)) return;

    if (locked) {
      // 已锁定时点击 → 解锁
      e.preventDefault();
      e.stopPropagation();
      unlock();
    } else {
      // 未锁定时点击 → 锁定当前元素
      e.preventDefault();
      e.stopPropagation();
      lock();
    }
  }

  function onKeyDown(e) {
    if (!enabled) return;

    // 不在输入框中拦截按键
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    switch (e.key) {
      case 'c':
        // C 键复制精简选择器
        e.preventDefault();
        copyCompact();
        break;
      case 'C':
        // Shift+C 复制完整路径
        e.preventDefault();
        copyPath();
        break;
      case 'Escape':
        if (locked) {
          // 锁定状态先解锁
          unlock();
        } else {
          // 未锁定则关闭整个插件
          disable();
          chrome.runtime.sendMessage({ action: 'statusChanged', enabled: false });
        }
        break;
    }
  }

  // ==================== 启动 ====================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
