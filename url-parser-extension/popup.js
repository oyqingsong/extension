// ========== Tab Switching ==========
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab + '-panel').classList.add('active');
  });
});

// ========== Toast ==========
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1400);
}

// ========== Copy ==========
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '已复制';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1000);
    } else {
      showToast('已复制');
    }
  });
}

// ========== URL Helpers ==========
function parseURL(urlString) {
  try {
    if (urlString && !/^[a-zA-Z]+:\/\//.test(urlString)) urlString = 'https://' + urlString;
    return new URL(urlString);
  } catch { return null; }
}

function parseHashParams(hash) {
  if (!hash || !hash.startsWith('#')) return [];
  const str = hash.slice(1);
  if (!str.includes('=')) return [];
  return str.split('&').map(pair => {
    const i = pair.indexOf('=');
    return i === -1 ? { key: pair, value: '' } : { key: pair.slice(0, i), value: tryDecode(pair.slice(i + 1)) };
  });
}

function findDuplicateKeys(entries) {
  const count = {};
  entries.forEach(e => { count[e.key] = (count[e.key] || 0) + 1; });
  return new Set(Object.keys(count).filter(k => count[k] > 1));
}

function tryDecode(s) { try { return decodeURIComponent(s); } catch { return s; } }

// ========== Render ==========
function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function escAttr(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function renderParamsTable(title, entries) {
  if (!entries.length) return '';

  const dupKeys = findDuplicateKeys(entries);
  const hasDup = dupKeys.size > 0;

  let h = '<div class="result-section"><div class="section-head">';
  h += `<span class="section-title">${esc(title)}</span>`;
  h += `<span class="section-count">${entries.length}</span>`;
  if (hasDup) h += `<span class="dup-hint">${dupKeys.size} 个重复</span>`;
  h += '</div>';

  h += '<table class="data-table"><thead><tr>';
  h += '<th>Key</th><th>Value</th><th class="col-act">操作</th>';
  h += '</tr></thead><tbody>';

  entries.forEach(e => {  
    const isDup = dupKeys.has(e.key);
    h += `<tr${isDup ? ' class="dup-row"' : ''}>`;
    h += `<td class="cell-key">${esc(e.key)}${isDup ? '<span class="dup-badge">重复</span>' : ''}</td>`;
    h += `<td class="cell-val">${esc(e.value)}</td>`;
    h += `<td class="cell-act">`;
    h += `<button class="copy-btn" data-copy="${escAttr(e.key)}">Key</button>`;
    h += `<button class="copy-btn" data-copy="${escAttr(e.value)}">Val</button>`;
    h += '</td></tr>';
  });

  h += '</tbody></table></div>';
  return h;
}

function renderParsedResult(url, container) {
  let h = '';

  // Basic info
  const fields = [
    { key: '主机', value: url.hostname },
    { key: '路径', value: url.pathname },
    { key: '完整', value: url.href },
  ];
  if (url.port) fields.splice(1, 0, { key: '端口', value: url.port });

  h += '<div class="result-section"><div class="section-head"><span class="section-title">基本信息</span></div  >';
  h += '<table class="data-table info-table"><thead><tr><th>属性</th><th>值</th><th class="col-act">操作</th></tr></thead><tbody>';
  fields.forEach(f => {
    h += `<tr><td>${esc(f.key)}</td><td class="cell-val">${esc(f.value)}</td>`;
    h += `<td class="cell-act"><button class="copy-btn" data-copy="${escAttr(f.value)}">复制</button></td></tr>`;
  });
  h += '</tbody></table></div>';

  // Search params
  const searchEntries = [];
  for (const [key, value] of url.searchParams) {
    searchEntries.push({ key, value: tryDecode(value) });
  }
  h += renderParamsTable('Search 参数', searchEntries);

  // Hash params
  const hashEntries = parseHashParams(url.hash);
  h += renderParamsTable('Hash 参数', hashEntries);

  container.innerHTML = h;
  bindCopyButtons(container);
}

function renderEmpty(container, msg) {
  container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔗</div>${msg}</div>`;
}
function renderError(container, msg) {
  container.innerHTML = `<div class="error-msg">${msg}</div>`;
}

// ========== Parse Panel ==========
const urlInput = document.getElementById('urlInput');
const parseBtn = document.getElementById('parseBtn');
const clearBtn = document.getElementById('clearBtn');
const parseResult = document.getElementById('parseResult');

parseBtn.addEventListener('click', () => {
  const raw = urlInput.value.trim();
  if (!raw) { renderEmpty(parseResult, '请输入 URL 进行解析'); return; }
  const url = parseURL(raw);
  if (!url) { renderError(parseResult, '无法解析该 URL，请检查格式'); return; }
  renderParsedResult(url, parseResult);
});

clearBtn.addEventListener('click', () => { urlInput.value = ''; parseResult.innerHTML = ''; });
urlInput.addEventListener('paste', () => setTimeout(() => parseBtn.click(), 50));

// ========== Current Page Panel ==========
function loadCurrentPage() {
  const urlText = document.getElementById('currentUrlText');
  const result = document.getElementById('currentResult');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url) { urlText.textContent = '无法获取'; renderEmpty(result, '请刷新页面后重试'); return; }

    urlText.textContent = tab.url;
    const url = parseURL(tab.url);
    if (!url) { renderError(result, 'URL 无法解析'); return; }
    if (['chrome:','chrome-extension:','about:'].includes(url.protocol)) {
      renderEmpty(result, '浏览器内部页面，无 URL 参数');
      return;
    }
    renderParsedResult(url, result);
  });
}

document.getElementById('copyCurrentUrl').addEventListener('click', () => {
  const t = document.getElementById('currentUrlText').textContent;
  if (t && t !== '获取中...' && t !== '无法获取') copyText(t);
});

// ========== Bind ==========
function bindCopyButtons(container) {
  container.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); copyText(btn.dataset.copy, btn); });
  });
}

// ========== Init ==========
document.querySelector('[data-tab="current"]').addEventListener('click', loadCurrentPage);
