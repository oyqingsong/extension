/**
 * 文本差异比较 - 主控制器
 */
(function () {
  // DOM 元素引用
  const elements = {
    typeChips: document.querySelectorAll('.type-chip'),
    sortKeysLabel: document.getElementById('sort-keys-label'),
    sortKeysCheck: document.getElementById('sort-keys-check'),
    leftInput: document.getElementById('left-input'),
    rightInput: document.getElementById('right-input'),
    leftDropZone: document.getElementById('left-drop-zone'),
    rightDropZone: document.getElementById('right-drop-zone'),
    clearBtn: document.getElementById('clear-btn'),
    compareBtn: document.getElementById('compare-btn'),
    inputView: document.getElementById('input-view'),
    resultView: document.getElementById('result-view'),
    backBtn: document.getElementById('back-btn'),
    diffOutput: document.getElementById('diff-output'),
    diffStats: document.getElementById('diff-stats'),
    copyResultBtn: document.getElementById('copy-result-btn'),
    copySummaryBtn: document.getElementById('copy-summary-btn')
  };

  let currentChanges = null;
  let currentOldText = '';
  let currentNewText = '';
  let currentView = 'side-by-side';
  let currentType = 'auto';

  // ===== 初始化 =====
  function init() {
    bindEvents();
    restoreInputs();
    checkContextMenuData();
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    // 类型选择（药片按钮）
    elements.typeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        elements.typeChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentType = chip.dataset.type;
        elements.sortKeysLabel.style.display = currentType === 'json' ? 'flex' : 'none';
        saveInputs();
      });
    });

    // 比较
    elements.compareBtn.addEventListener('click', compare);

    // 清空
    elements.clearBtn.addEventListener('click', clearInputs);

    // 返回
    elements.backBtn.addEventListener('click', backToEdit);

    // 视图切换
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view)); 
    });

    // 文件拖拽
    setupDragDrop(elements.leftDropZone, elements.leftInput);
    setupDragDrop(elements.rightDropZone, elements.rightInput);

    // 复制
    elements.copyResultBtn.addEventListener('click', copyResult);
    elements.copySummaryBtn.addEventListener('click', copySummary);

    // 自动保存输入
    elements.leftInput.addEventListener('input', saveInputs);
    elements.rightInput.addEventListener('input', saveInputs);
  }

  // ===== 拖拽设置 =====
  function setupDragDrop(zone, textarea) {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        textarea.value = event.target.result;
        const detected = Detector.detectByExtension(file.name);
        if (detected && currentType === 'auto') {
          selectType(detected);
        }
        saveInputs();
      };
      reader.readAsText(file);
    });
  }

  // ===== 类型选择辅助 =====
  function selectType(type) {
    currentType = type;
    elements.typeChips.forEach(c => {
      c.classList.toggle('active', c.dataset.type === type);
    });
    elements.sortKeysLabel.style.display = type === 'json' ? 'flex' : 'none';
  }

  // ===== 核心比较逻辑 =====
  function compare() {
    const leftText = elements.leftInput.value.trim();
    const rightText = elements.rightInput.value.trim();

    if (!leftText || !rightText) {
      showToast('请在两个文本框中都输入内容');
      return;
    }

    // 确定比较类型
    let type = currentType;
    if (type === 'auto') {
      type = Detector.detect(leftText);
    }

    // 格式化
    const options = {};
    if (type === 'json' && elements.sortKeysCheck.checked) {
      options.sortKeys = true;
    }

    const formattedLeft = Formatters.format(leftText, type, options);
    const formattedRight = Formatters.format(rightText, type, options);
    
    // 比较
    currentOldText = formattedLeft;
    currentNewText = formattedRight;
    currentChanges = Diff.diffLines(formattedLeft, formattedRight);

    // 渲染结果
    showResult();
  }

  // ===== 显示结果 =====
  function showResult() {
    elements.inputView.style.display = 'none';
    elements.resultView.style.display = 'flex';

    // 统计信息
    const stats = Renderer.getStats(currentChanges);
    elements.diffStats.innerHTML =
      `<span class="stat-add"><span class="stat-dot"></span>+${stats.added}</span>` +
      `<span class="stat-remove"><span class="stat-dot"></span>-${stats.removed}</span>` +
      `<span class="stat-modify"><span class="stat-dot"></span>~${stats.modified}</span>`;

    renderCurrentView();
  }

  function renderCurrentView() {
    if (currentView === 'side-by-side') {
      elements.diffOutput.innerHTML = Renderer.renderSideBySide(
        currentChanges, currentOldText, currentNewText
      );
    } else {
      elements.diffOutput.innerHTML = Renderer.renderInline(currentChanges);
    }
  }

  // ===== 视图切换 =====
  function switchView(view) {
    currentView = view;
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderCurrentView();
  }

  // ===== 返回编辑 =====
  function backToEdit() {
    elements.resultView.style.display = 'none';
    elements.inputView.style.display = 'flex';
    currentChanges = null;
  }

  // ===== 清空 =====
  function clearInputs() {
    elements.leftInput.value = '';
    elements.rightInput.value = '';
    selectType('auto');
    elements.sortKeysCheck.checked = false;
    saveInputs();
  }

  // ===== 复制功能 =====
  function copyResult() {
    const text = currentChanges.map(c => c.value).join('');
    copyToClipboard(text, '结果已复制');
  }

  function copySummary() {
    const stats = Renderer.getStats(currentChanges);
    const summary = `差异统计：+${stats.added} 新增 -${stats.removed} 删除 ~${stats.modified} 修改`;
    copyToClipboard(summary, '摘要已复制');
  }

  function copyToClipboard(text, message) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(message);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(message);
    });
  }

  // ===== Toast 提示 =====
  function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = 'toast';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  }

  // ===== 数据持久化 =====
  function saveInputs() {
    if (chrome && chrome.storage) {
      chrome.storage.local.set({
        diffToolInput: {
          left: elements.leftInput.value,
          right: elements.rightInput.value,
          type: currentType
        }
      });
    }
  }

  function restoreInputs() {
    if (chrome && chrome.storage) {
      chrome.storage.local.get('diffToolInput', (data) => {
        if (data.diffToolInput) {
          elements.leftInput.value = data.diffToolInput.left || '';
          elements.rightInput.value = data.diffToolInput.right || '';
          if (data.diffToolInput.type) {
            selectType(data.diffToolInput.type);
          }
        }
      });
    }
  }

  // ===== 右键菜单数据接收 =====
  function checkContextMenuData() {
    if (chrome && chrome.storage) {
      chrome.storage.local.get('contextMenuData', (data) => {
        if (data.contextMenuData) {
          const cmd = data.contextMenuData;
          if (cmd.left) elements.leftInput.value = cmd.left;
          if (cmd.right) elements.rightInput.value = cmd.right;
          saveInputs();
          chrome.storage.local.remove('contextMenuData');
        }
      });
    }
  }

  // 启动
  init();
})();
