/**
 * panel.js — 信息面板
 * 在页面右侧显示选择器路径、精简选择器、匹配规则等信息
 */

const InfoPanel = (() => {
  const PANEL_ID = '__css_selector_panel__';
  const TOAST_ID = '__css_selector_toast__';
  const STORAGE_KEY = '__css_selector_panel_pos__';

  let panel = null;
  let isVisible = false;
  let isLocked = false;
  let toastTimer = null;

  function init() {
    if (document.getElementById(PANEL_ID)) return;

    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="__panel_header__">
        <div class="__panel_title_row__">
          <span class="__panel_title__">CSS Selector</span>
          <span class="__panel_lock_badge__">未锁定</span>
        </div>
        <div class="__panel_actions__">
          <button class="__panel_btn__" data-action="copy-compact" title="复制精简选择器">复制选择器</button>
          <button class="__panel_btn__" data-action="copy-path" title="复制完整路径">复制路径</button>
          <button class="__panel_btn__ __panel_close__" data-action="close" title="关闭面板">✕</button>
        </div>
      </div>
      <div class="__panel_body__">
        <div class="__panel_section__">
          <div class="__panel_label__">精简选择器</div>
          <code class="__panel_value__ __panel_compact__">—</code>
        </div>
        <div class="__panel_section__">
          <div class="__panel_label__">完整路径</div>
          <code class="__panel_value__ __panel_path__">—</code>
        </div>
        <div class="__panel_section__">
          <div class="__panel_label__">DOM 面包屑</div>
          <div class="__panel_breadcrumb__">—</div>
        </div>
        <div class="__panel_section__">
          <div class="__panel_label__">
            Specificity
            <span class="__panel_spec__">—</span>
          </div>
        </div>
        <div class="__panel_section__ __panel_rules_section__">
          <div class="__panel_label__">匹配的 CSS 规则</div>
          <div class="__panel_rules__">—</div>
        </div>
      </div>
      <div class="__panel_footer__">
        <kbd>C</kbd> 复制选择器 &nbsp; <kbd>Shift+C</kbd> 复制路径 &nbsp; <kbd>Esc</kbd> 解锁
      </div>
    `;

    document.documentElement.appendChild(panel);
    _setupDrag();
    _setupActions();
    _restorePosition();
  }

  function update(el) {
    if (!panel || !isVisible) return;

    const compact = SelectorEngine.getCompactSelector(el);
    const path = SelectorEngine.getUniqueSelector(el);
    const domPath = SelectorEngine.getDomPath(el);
    const spec = SelectorEngine.getSpecificity(compact);
    const rules = SelectorEngine.getMatchedRules(el);

    const compactEl = panel.querySelector('.__panel_compact__');
    compactEl.textContent = compact;
    compactEl.title = compact;

    const pathEl = panel.querySelector('.__panel_path__');
    pathEl.textContent = path;
    pathEl.title = path;

    const breadcrumbEl = panel.querySelector('.__panel_breadcrumb__');
    breadcrumbEl.innerHTML = domPath.map((item, i) => {
      const tag = item.tag;
      const suffix = item.id ? `#${item.id}` : (item.classes.length > 0 ? `.${item.classes[0]}` : '');
      const sep = i < domPath.length - 1 ? ' <span class="__bc_sep__">›</span> ' : '';
      return `<span class="__bc_item__">${tag}${suffix}</span>${sep}`;
    }).join('');

    const specEl = panel.querySelector('.__panel_spec__');
    specEl.textContent = SelectorEngine.formatSpecificity(spec);

    const rulesEl = panel.querySelector('.__panel_rules__');
    if (rules.length === 0) {
      rulesEl.innerHTML = '<div class="__no_rules__">无匹配的外部样式规则</div>';
    } else {
      rulesEl.innerHTML = rules.slice(0, 10).map(rule => {
        const shortSource = rule.source === 'inline' ? 'inline' : rule.source.split('/').pop();
        return `
          <div class="__rule_item__">
            <div class="__rule_selector__">${_escapeHtml(rule.selector)}</div>
            <div class="__rule_source__">${_escapeHtml(shortSource)}</div>
          </div>
        `;
      }).join('');
    }
  }

  function setLocked(locked) {
    isLocked = locked;
    if (!panel) return;

    const badge = panel.querySelector('.__panel_lock_badge__');
    if (badge) {
      badge.textContent = locked ? '已锁定' : '未锁定';
      badge.classList.toggle('__lock_active__', locked);
    }

    // 锁定时显示快捷键提示
    const footer = panel.querySelector('.__panel_footer__');
    if (footer) {
      footer.style.display = locked ? 'block' : 'none';
    }
  }

  function showToast(message) {
    // 移除已有的 toast
    let toast = document.getElementById(TOAST_ID);
    if (toast) toast.remove();

    toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.className = '__css_selector_toast__';
    toast.textContent = message;
    document.documentElement.appendChild(toast);

    // 触发动画
    requestAnimationFrame(() => {
      toast.classList.add('__toast_visible__');
    });

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('__toast_visible__');
      setTimeout(() => toast.remove(), 300);
    }, 1500);
  }

  function show() {
    if (!panel) init();
    isVisible = true;
    panel.classList.add('__panel_visible__');
  }

  function hide() {
    if (!panel) return;
    isVisible = false;
    panel.classList.remove('__panel_visible__');
  }

  function toggle() {
    isVisible ? hide() : show();
  }

  function destroy() {
    if (panel) panel.remove();
    panel = null;
    const toast = document.getElementById(TOAST_ID);
    if (toast) toast.remove();
  }

  // ==================== 内部方法 ====================

  function _setupDrag() {
    const header = panel.querySelector('.__panel_header__');
    let isDragging = false;
    let startX, startY, origX, origY;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.__panel_btn__')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = (origX + dx) + 'px';
      panel.style.top = (origY + dy) + 'px';
      panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        _savePosition();
      }
    });
  }

  function _setupActions() {
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('.__panel_btn__');
      if (!btn) return;

      const action = btn.dataset.action;
      if (action === 'close') {
        hide();
      } else if (action === 'copy-path') {
        _copyToClipboard(panel.querySelector('.__panel_path__').textContent);
        showToast('已复制完整路径');
      } else if (action === 'copy-compact') {
        _copyToClipboard(panel.querySelector('.__panel_compact__').textContent);
        showToast('已复制精简选择器');
      }
    });
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

  function _savePosition() {
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        top: rect.top,
        left: rect.left,
        right: panel.style.right === 'auto' ? null : '20px'
      }));
    } catch (e) { /* ignore */ }
  }

  function _restorePosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) {
        if (saved.left !== null && saved.right === null) {
          panel.style.left = saved.left + 'px';
          panel.style.right = 'auto';
        }
        if (saved.top !== null) {
          panel.style.top = saved.top + 'px';
        }
      }
    } catch (e) { /* ignore */ }
  }

  function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, update, show, hide, toggle, destroy, setLocked, showToast };
})();
