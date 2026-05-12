/**
 * highlight.js — 高亮覆盖层管理
 * 负责在鼠标悬停元素上绘制高亮边框和覆盖层
 */

const HighlightOverlay = (() => {
  const OVERLAY_ID = '__css_selector_overlay__';
  const TOOLTIP_ID = '__css_selector_tooltip__';

  let overlay = null;
  let isActive = false;
  let isLocked = false;

  const COLOR_HOVER = '#4285f4';
  const COLOR_LOCKED = '#ff9800';

  function init() {
    if (document.getElementById(OVERLAY_ID)) return;

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483640;
      border: 2px solid ${COLOR_HOVER};
      background: rgba(66, 133, 244, 0.12);
      border-radius: 3px;
      transition: all 0.05s ease-out;
      display: none;
      box-shadow: 0 0 0 1px rgba(66, 133, 244, 0.4);
    `;
    document.documentElement.appendChild(overlay);

    // 尺寸标签
    const label = document.createElement('div');
    label.className = '__css_highlight_label__';
    label.style.cssText = `
      position: absolute;
      top: -22px;
      left: 0;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      line-height: 18px;
      padding: 1px 6px;
      background: ${COLOR_HOVER};
      color: #fff;
      border-radius: 3px;
      white-space: nowrap;
      pointer-events: none;
      transition: background 0.15s ease;
    `;
    overlay.appendChild(label);

    // 锁定提示标签（锁定时显示在底部）
    const lockLabel = document.createElement('div');
    lockLabel.className = '__css_highlight_lock__';
    lockLabel.style.cssText = `
      position: absolute;
      bottom: -22px;
      left: 50%;
      transform: translateX(-50%);
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 10px;
      line-height: 16px;
      padding: 1px 8px;
      background: ${COLOR_LOCKED};
      color: #fff;
      border-radius: 3px;
      white-space: nowrap;
      pointer-events: none;
      display: none;
      transition: background 0.15s ease;
    `;
    lockLabel.textContent = '已锁定 — 点击解锁 / C 复制 / Esc 解锁';
    overlay.appendChild(lockLabel);
  }

  function highlight(el) {
    if (!isActive || !overlay) return;

    const rect = el.getBoundingClientRect();

    if (el.id === OVERLAY_ID || el.id === TOOLTIP_ID ||
        el.closest(`#${OVERLAY_ID}`) || el.closest(`#${TOOLTIP_ID}`)) {
      hide();
      return;
    }

    const color = isLocked ? COLOR_LOCKED : COLOR_HOVER;
    const bgColor = isLocked ? 'rgba(255, 152, 0, 0.12)' : 'rgba(66, 133, 244, 0.12)';

    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.borderColor = color;
    overlay.style.background = bgColor;
    overlay.style.boxShadow = `0 0 0 1px ${isLocked ? 'rgba(255,152,0,0.4)' : 'rgba(66,133,244,0.4)'}`;

    // 尺寸标签
    const label = overlay.querySelector('.__css_highlight_label__');
    if (label) {
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const classes = el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
      label.textContent = `${tag}${id}${classes}  ${w} × ${h}`;
      label.style.background = color;
    }

    // 锁定标签
    const lockLabel = overlay.querySelector('.__css_highlight_lock__');
    if (lockLabel) {
      lockLabel.style.display = isLocked ? 'block' : 'none';
    }
  }

  function hide() {
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  function setActive(active) {
    isActive = active;
    if (!active) hide();
  }

  function setLocked(locked) {
    isLocked = locked;
    // 锁定状态下重新渲染当前高亮颜色
    if (overlay && overlay.style.display === 'block') {
      const color = locked ? COLOR_LOCKED : COLOR_HOVER;
      const bgColor = locked ? 'rgba(255, 152, 0, 0.12)' : 'rgba(66, 133, 244, 0.12)';
      overlay.style.borderColor = color;
      overlay.style.background = bgColor;

      const label = overlay.querySelector('.__css_highlight_label__');
      if (label) label.style.background = color;

      const lockLabel = overlay.querySelector('.__css_highlight_lock__');
      if (lockLabel) lockLabel.style.display = locked ? 'block' : 'none';
    }
  }

  function destroy() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
    overlay = null;
    isLocked = false;
  }

  return { init, highlight, hide, setActive, setLocked, destroy };
})();
