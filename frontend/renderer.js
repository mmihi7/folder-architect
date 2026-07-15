const FILE_ICONS = {
  '.py': '🐍', '.js': '📜', '.jsx': '⚛️', '.ts': '📜', '.tsx': '⚛️',
  '.html': '🌐', '.htm': '🌐', '.css': '🎨', '.scss': '🎨', '.sass': '🎨',
  '.json': '📋', '.xml': '📋', '.yaml': '⚙️', '.yml': '⚙️', '.toml': '⚙️',
  '.md': '📝', '.markdown': '📝', '.txt': '📄', '.rst': '📝',
  '.jpg': '🖼️', '.jpeg': '🖼️', '.png': '🖼️', '.gif': '🖼️',
  '.svg': '🖼️', '.webp': '🖼️', '.ico': '🖼️', '.bmp': '🖼️',
  '.pdf': '📕', '.doc': '📘', '.docx': '📘', '.xls': '📗', '.xlsx': '📗',
  '.zip': '📦', '.tar': '📦', '.gz': '📦', '.rar': '📦', '.7z': '📦',
  '.sh': '⚙️', '.bash': '⚙️', '.zsh': '⚙️', '.bat': '⚙️', '.ps1': '⚙️',
  '.java': '☕', '.c': '🔧', '.cpp': '🔧', '.cc': '🔧', '.h': '🔧',
  '.hpp': '🔧', '.go': '🐹', '.rs': '🦀', '.rb': '💎', '.php': '🐘',
  '.swift': '🦅', '.kt': '🟣', '.scala': '🔴',
  '.sql': '🗄️', '.db': '🗄️', '.sqlite': '🗄️',
  '.env': '🔐', '.lock': '🔒', '.log': '📃',
  '.mp3': '🎵', '.wav': '🎵', '.mp4': '🎬', '.avi': '🎬', '.mkv': '🎬',
  '.ttf': '🔤', '.otf': '🔤', '.woff': '🔤', '.woff2': '🔤',
  '.dockerfile': '🐳', '.gitignore': '🚫'
};

const folderPathInput = document.getElementById('folderPath');
const browseBtn = document.getElementById('browseBtn');
const scanBtn = document.getElementById('scanBtn');
const extensionList = document.getElementById('extensionList');
const treeView = document.getElementById('treeView');
const canvasViewContainer = document.getElementById('canvasViewContainer');
const canvasScroll = document.getElementById('canvasScroll');
const canvasView = document.getElementById('canvasView');
const canvasEmptyState = document.querySelector('.canvas-empty-state');
const canvasLegend = document.getElementById('canvasLegend');
const statusBar = document.getElementById('statusBar');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const selectAllExt = document.getElementById('selectAllExt');
const deselectAllExt = document.getElementById('deselectAllExt');
const extFilter = document.getElementById('extFilter');
const excludeDirs = document.getElementById('excludeDirs');
const excludeLocks = document.getElementById('excludeLocks');
const collapseDefault = document.getElementById('collapseDefault');
const maxDepth = document.getElementById('maxDepth');
const copyTreeBtn = document.getElementById('copyTreeBtn');
const copyJsonBtn = document.getElementById('copyJsonBtn');
const copyImageBtn = document.getElementById('copyImageBtn');
const exportPngBtn = document.getElementById('exportPngBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const viewTreeBtn = document.getElementById('viewTreeBtn');
const viewCanvasBtn = document.getElementById('viewCanvasBtn');

// Canvas Controls
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const fitScreenBtn = document.getElementById('fitScreenBtn');
const zoomLevelEl = document.getElementById('zoomLevel');

// Depth Controls
const depthUpBtn = document.getElementById('depthUp');
const depthDownBtn = document.getElementById('depthDown');
const depthValueEl = document.getElementById('depthValue');

// Layout Controls
const layoutVertBtn = document.getElementById('layoutVertBtn');
const layoutHorizBtn = document.getElementById('layoutHorizBtn');

let currentExtensions = [];
let currentTree = null;
let currentFolder = null;
let currentView = 'tree';

// Canvas State
let scale = 1;
let baseLayout = null;
let canvasMaxDepth = 0;
let absoluteMaxDepth = 0;
let canvasOrientation = 'vertical';

// Panning State
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panScrollLeft = 0;
let panScrollTop = 0;

function getFileIcon(ext, name) {
  const lowerName = name.toLowerCase();
  if (lowerName === 'dockerfile') return '🐳';
  if (lowerName === '.gitignore') return '🚫';
  if (lowerName === 'license' || lowerName.startsWith('license.')) return '📜';
  if (lowerName === 'readme.md' || lowerName === 'readme') return '📖';
  return FILE_ICONS[ext] || '📄';
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

viewTreeBtn.addEventListener('click', () => {
  currentView = 'tree';
  viewTreeBtn.classList.add('active');
  viewCanvasBtn.classList.remove('active');
  treeView.classList.remove('hidden');
  canvasViewContainer.classList.add('hidden');
});

viewCanvasBtn.addEventListener('click', () => {
  currentView = 'canvas';
  viewCanvasBtn.classList.add('active');
  viewTreeBtn.classList.remove('active');
  treeView.classList.add('hidden');
  canvasViewContainer.classList.remove('hidden');
  
  if (currentTree) {
    renderCanvas(currentTree);
    setTimeout(centerInitialView, 50);
  } else {
    canvasEmptyState.classList.remove('hidden');
    canvasView.classList.add('hidden');
    canvasLegend.classList.add('hidden');
  }
});

browseBtn.addEventListener('click', async () => {
  const folder = await window.api.selectFolder();
  if (folder) {
    currentFolder = folder;
    folderPathInput.value = folder;
    scanBtn.disabled = false;
    await loadExtensions(folder);
  }
});

async function loadExtensions(folder) {
  extensionList.innerHTML = '<p class="hint">Loading file types...</p>';
  try {
    const result = await window.api.listExtensions(folder);
    currentExtensions = result.extensions || [];
    renderExtensionList();
  } catch (e) {
    extensionList.innerHTML = `<p class="hint error">Error: ${e.message}</p>`;
  }
}

function renderExtensionList() {
  if (currentExtensions.length === 0) {
    extensionList.innerHTML = '<p class="hint">No files found.</p>';
    return;
  }

  const filter = extFilter.value.toLowerCase();
  const filtered = currentExtensions.filter(e =>
    !filter || e.extension.toLowerCase().includes(filter) ||
    (e.extension === '' && '(none)'.includes(filter))
  );

  if (filtered.length === 0) {
    extensionList.innerHTML = '<p class="hint">No extensions match filter.</p>';
    return;
  }

  extensionList.innerHTML = filtered.map(e => {
    const label = e.extension === '' ? '(no extension)' : e.extension;
    return `<label class="ext-item">
      <input type="checkbox" checked data-ext="${e.extension}">
      <span class="ext-label">${label}</span>
      <span class="ext-count">${e.count}</span>
    </label>`;
  }).join('');
}

extFilter.addEventListener('input', renderExtensionList);

selectAllExt.addEventListener('click', () => {
  extensionList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
});

deselectAllExt.addEventListener('click', () => {
  extensionList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
});

scanBtn.addEventListener('click', async () => {
  if (!currentFolder) return;

  const selectedExts = Array.from(
    extensionList.querySelectorAll('input[type="checkbox"]:checked')
  ).map(cb => cb.dataset.ext);

  const allSelected = selectedExts.length === currentExtensions.length;

  const options = {
    folder: currentFolder,
    extensions: allSelected ? [] : selectedExts,
    excludeDirs: excludeDirs.checked,
    excludeLocks: excludeLocks.checked,
    maxDepth: parseInt(maxDepth.value) || 0
  };

  loadingText.textContent = 'Scanning folder...';
  loading.classList.remove('hidden');
  treeView.classList.add('hidden');
  canvasViewContainer.classList.add('hidden');
  statusBar.classList.add('hidden');

  const startTime = performance.now();

  try {
    const tree = await window.api.scanFolder(options);
    currentTree = tree;
    
    const counts = countNodes(tree);
    document.getElementById('folderCount').textContent = `${counts.dirs} folders`;
    document.getElementById('fileCount').textContent = `${counts.files} files`;
    document.getElementById('totalSize').textContent = formatSize(counts.size);
    document.getElementById('scanTime').textContent =
      `Scanned in ${((performance.now() - startTime) / 1000).toFixed(2)}s`;

    statusBar.classList.remove('hidden');
    copyTreeBtn.disabled = false;
    copyJsonBtn.disabled = false;
    copyImageBtn.disabled = false;
    exportPngBtn.disabled = false;
    exportPdfBtn.disabled = false;
    
    absoluteMaxDepth = getTreeMaxDepth(tree);
    canvasMaxDepth = absoluteMaxDepth;
    updateDepthLabel();
    
    if (currentView === 'tree') {
      renderTree(tree, collapseDefault.checked);
      treeView.classList.remove('hidden');
    } else {
      canvasViewContainer.classList.remove('hidden');
      canvasLegend.classList.remove('hidden');
      renderCanvas(tree);
      setTimeout(centerInitialView, 50);
    }
  } catch (e) {
    treeView.innerHTML = `<div class="empty-state">
      <div class="empty-icon" style="color: var(--danger)">⚠️</div>
      <p style="color: var(--danger)">Error: ${e.message}</p>
    </div>`;
    treeView.classList.remove('hidden');
  } finally {
    loading.classList.add('hidden');
  }
});

function countNodes(node) {
  let dirs = 0, files = 0, size = 0;
  function walk(n) {
    if (n.type === 'directory') {
      dirs++;
      (n.children || []).forEach(walk);
    } else {
      files++;
      size += (n.size || 0);
    }
  }
  walk(node);
  return { dirs, files, size };
}

function getTreeMaxDepth(node, depth = 0) {
  if (!node.children || node.children.length === 0) return depth;
  return Math.max(...node.children.map(c => getTreeMaxDepth(c, depth + 1)));
}

function pruneTree(node, currentDepth = 0, maxDepth = Infinity) {
  const newNode = { ...node };
  if (currentDepth >= maxDepth) {
    newNode.children = [];
    newNode.truncated = true;
  } else if (node.children) {
    newNode.children = node.children.map(c => pruneTree(c, currentDepth + 1, maxDepth));
  }
  return newNode;
}

function renderTree(tree, collapse) {
  treeView.innerHTML = '';
  const root = renderNode(tree, collapse, 0, true);
  treeView.appendChild(root);
}

function renderNode(node, collapse, depth, isRoot) {
  const container = document.createElement('div');
  container.className = 'tree-node';

  const row = document.createElement('div');
  row.className = 'tree-row ' + node.type;
  row.title = node.path;

  if (node.type === 'directory') {
    const shouldCollapse = collapse && !isRoot && depth > 0;
    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle';
    toggle.textContent = shouldCollapse ? '▶' : '▼';
    row.appendChild(toggle);

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = shouldCollapse ? '📁' : '📂';
    row.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'tree-name';
    name.textContent = node.name;
    row.appendChild(name);

    if (node.error) {
      const err = document.createElement('span');
      err.className = 'tree-meta error';
      err.textContent = '⚠ ' + node.error;
      row.appendChild(err);
    } else {
      const meta = document.createElement('span');
      meta.className = 'tree-meta';
      const childCount = (node.children || []).length;
      meta.textContent = `${childCount} item${childCount !== 1 ? 's' : ''}`;
      row.appendChild(meta);
    }

    container.appendChild(row);

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    if (shouldCollapse) childrenContainer.classList.add('collapsed');

    (node.children || []).forEach(child => {
      childrenContainer.appendChild(renderNode(child, collapse, depth + 1, false));
    });

    container.appendChild(childrenContainer);

    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = childrenContainer.classList.toggle('collapsed');
      toggle.textContent = isCollapsed ? '▶' : '▼';
      icon.textContent = isCollapsed ? '📁' : '📂';
    });
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'tree-toggle';
    row.appendChild(spacer);

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = getFileIcon(node.extension, node.name);
    row.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'tree-name';
    name.textContent = node.name;
    row.appendChild(name);

    if (node.size !== undefined) {
      const meta = document.createElement('span');
      meta.className = 'tree-meta';
      meta.textContent = formatSize(node.size);
      row.appendChild(meta);
    }

    container.appendChild(row);
  }

  return container;
}

// --- CANVAS VIEW LOGIC ---
function getRenderedTree() {
  if (canvasMaxDepth >= absoluteMaxDepth) return currentTree;
  return pruneTree(currentTree, 0, canvasMaxDepth);
}

function renderCanvas(tree) {
  if (!tree) return;
  canvasEmptyState.classList.add('hidden');
  canvasView.classList.remove('hidden');
  canvasLegend.classList.remove('hidden');

  const treeToRender = getRenderedTree();
  const ctx = canvasView.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  baseLayout = calculateLayout(treeToRender, canvasOrientation);

  const padding = 60;
  const cssWidth = (baseLayout.maxX + padding) * scale;
  const cssHeight = (baseLayout.maxY + padding) * scale;

  canvasView.width = cssWidth * dpr;
  canvasView.height = cssHeight * dpr;
  canvasView.style.width = `${cssWidth}px`;
  canvasView.style.height = `${cssHeight}px`;

  ctx.scale(dpr, dpr);
  ctx.scale(scale, scale);

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  drawTree(ctx, treeToRender, canvasOrientation);

  updateZoomLevel();
}

function calculateLayout(node, orientation, depth = 0, startCoord = 0) {
  const isVertical = orientation === 'vertical';

  if (isVertical) {
    const x = depth * 240 + 40;
    if (!node.children || node.children.length === 0) {
      node._x = x;
      node._y = startCoord + 25;
      return { maxY: node._y + 40, maxX: x + 200 };
    }
    
    let currentY = startCoord;
    let maxX = x + 200;
    node.children.forEach(child => {
      const l = calculateLayout(child, orientation, depth + 1, currentY);
      currentY = l.maxY;
      maxX = Math.max(maxX, l.maxX);
    });
    node._x = x;
    node._y = (node.children[0]._y + node.children[node.children.length - 1]._y) / 2;
    return { maxY: currentY, maxX };
  } else {
    const y = depth * 60 + 40; // Horizontal spacing tighter
    if (!node.children || node.children.length === 0) {
      node._y = y;
      node._x = startCoord + 25;
      return { maxY: y + 40, maxX: node._x + 180 };
    }

    let currentX = startCoord;
    let maxY = y + 40;
    node.children.forEach(child => {
      const l = calculateLayout(child, orientation, depth + 1, currentX);
      currentX = l.maxX;
      maxY = Math.max(maxY, l.maxY);
    });
    node._y = y;
    node._x = (node.children[0]._x + node.children[node.children.length - 1]._x) / 2;
    return { maxY, maxX: currentX };
  }
}

function drawTree(ctx, node, orientation) {
  if (node.children) {
    node.children.forEach(child => {
      ctx.beginPath();
      if (orientation === 'vertical') {
        ctx.moveTo(node._x + 180, node._y);
        const cpX = (node._x + 180 + child._x) / 2;
        ctx.bezierCurveTo(cpX, node._y, cpX, child._y, child._x, child._y);
      } else {
        ctx.moveTo(node._x + 90, node._y + 36);
        const cpY = (node._y + 36 + child._y) / 2;
        ctx.bezierCurveTo(node._x + 90, cpY, child._x + 90, cpY, child._x + 90, child._y);
      }
      
      ctx.strokeStyle = child.type === 'directory' ? '#7c3aed' : '#3a3a52';
      ctx.lineWidth = child.type === 'directory' ? 2 : 1.5;
      ctx.stroke();
      
      drawTree(ctx, child, orientation);
    });
  }
  drawNode(ctx, node);
}

function drawNode(ctx, node) {
  const x = node._x;
  const y = node._y;
  const w = 180;
  const h = 36;
  const r = 8;
  
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  
  ctx.beginPath();
  ctx.moveTo(x + r, y - h/2);
  ctx.arcTo(x + w, y - h/2, x + w, y + h/2, r);
  ctx.arcTo(x + w, y + h/2, x, y + h/2, r);
  ctx.arcTo(x, y + h/2, x, y - h/2, r);
  ctx.arcTo(x, y - h/2, x + w, y - h/2, r);
  ctx.closePath();
  
  if (node.type === 'directory') {
    const grad = ctx.createLinearGradient(x, y - h/2, x, y + h/2);
    grad.addColorStop(0, '#8b5cf6');
    grad.addColorStop(1, '#6d28d9');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = '#252537';
  }
  ctx.fill();
  
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = node.type === 'directory' ? '#a78bfa' : '#3a3a52';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  
  let icon = node.type === 'directory' ? '📂' : getFileIcon(node.extension, node.name);
  if (node.truncated) icon = '✂️';
  ctx.fillText(icon, x + 10, y);
  
  ctx.font = '500 13px "JetBrains Mono", "Consolas", monospace';
  ctx.fillStyle = node.type === 'directory' ? '#ffffff' : '#e4e4ef';
  
  let text = node.name;
  const maxWidth = w - 40;
  if (ctx.measureText(text).width > maxWidth) {
    while (ctx.measureText(text + '...').width > maxWidth && text.length > 0) {
      text = text.slice(0, -1);
    }
    text += '...';
  }
  ctx.fillText(text, x + 32, y);
}

// --- ZOOM, PAN & CONTROLS ---
function setZoom(newScale) {
  const containerRect = canvasScroll.getBoundingClientRect();
  const scrollX = canvasScroll.scrollLeft;
  const scrollY = canvasScroll.scrollTop;
  
  const centerX = scrollX + containerRect.width / 2;
  const centerY = scrollY + containerRect.height / 2;

  const oldWidth = canvasView.style.width ? parseFloat(canvasView.style.width) : 1;
  const oldHeight = canvasView.style.height ? parseFloat(canvasView.style.height) : 1;
  const ratioX = centerX / oldWidth;
  const ratioY = centerY / oldHeight;

  scale = Math.max(0.1, Math.min(5, newScale));
  renderCanvas(currentTree);

  const newWidth = parseFloat(canvasView.style.width);
  const newHeight = parseFloat(canvasView.style.height);
  canvasScroll.scrollLeft = newWidth * ratioX - containerRect.width / 2;
  canvasScroll.scrollTop = newHeight * ratioY - containerRect.height / 2;
}

function updateZoomLevel() {
  zoomLevelEl.textContent = `${Math.round(scale * 100)}%`;
}

zoomInBtn.addEventListener('click', () => setZoom(scale * 1.2));
zoomOutBtn.addEventListener('click', () => setZoom(scale / 1.2));

canvasScroll.addEventListener('wheel', (e) => {
  if (e.ctrlKey) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 / 1.1 : 1.1;
    setZoom(scale * delta);
  }
}, { passive: false });

function centerInitialView() {
  if (!baseLayout || !currentTree) return;
  
  // Calculate bounding box of root + immediate children to center on them
  let minX = currentTree._x;
  let maxX = currentTree._x + 180;
  let minY = currentTree._y - 18;
  let maxY = currentTree._y + 18;
  
  (currentTree.children || []).forEach(child => {
    minX = Math.min(minX, child._x);
    maxX = Math.max(maxX, child._x + 180);
    minY = Math.min(minY, child._y - 18);
    maxY = Math.max(maxY, child._y + 18);
  });
  
  const padding = 120;
  const boxW = (maxX - minX) + padding;
  const boxH = (maxY - minY) + padding;
  
  const viewW = canvasScroll.clientWidth;
  const viewH = canvasScroll.clientHeight;
  
  let targetScale = Math.min(viewW / boxW, viewH / boxH);
  // Limit initial zoom so it doesn't over-zoom tiny directories or under-zoom massive ones
  targetScale = Math.max(0.4, Math.min(1.5, targetScale)); 
  
  scale = targetScale;
  renderCanvas(currentTree);
  
  // Center the view exactly on the bounding box center
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  canvasScroll.scrollLeft = (centerX * scale) - (viewW / 2);
  canvasScroll.scrollTop = (centerY * scale) - (viewH / 2);
}

function fitToScreen() {
  if (!baseLayout) return;
  const padding = 60;
  const containerW = canvasScroll.clientWidth - 40;
  const containerH = canvasScroll.clientHeight - 40;
  
  const scaleX = containerW / (baseLayout.maxX + padding);
  const scaleY = containerH / (baseLayout.maxY + padding);
  
  scale = Math.min(scaleX, scaleY);
  scale = Math.max(0.1, scale);
  
  renderCanvas(currentTree);
  
  const newWidth = parseFloat(canvasView.style.width);
  const newHeight = parseFloat(canvasView.style.height);
  canvasScroll.scrollLeft = (newWidth - canvasScroll.clientWidth) / 2;
  canvasScroll.scrollTop = (newHeight - canvasScroll.clientHeight) / 2;
}

fitScreenBtn.addEventListener('click', fitToScreen);

// Click & Drag to Pan
canvasScroll.addEventListener('mousedown', (e) => {
  isPanning = true;
  panStartX = e.pageX;
  panStartY = e.pageY;
  panScrollLeft = canvasScroll.scrollLeft;
  panScrollTop = canvasScroll.scrollTop;
  canvasScroll.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
  if (!isPanning) return;
  e.preventDefault();
  const dx = e.pageX - panStartX;
  const dy = e.pageY - panStartY;
  canvasScroll.scrollLeft = panScrollLeft - dx;
  canvasScroll.scrollTop = panScrollTop - dy;
});

window.addEventListener('mouseup', () => {
  if (isPanning) {
    isPanning = false;
    canvasScroll.style.cursor = 'grab';
  }
});

// --- DEPTH & LAYOUT CONTROLS ---
function updateDepthLabel() {
  depthValueEl.textContent = canvasMaxDepth >= absoluteMaxDepth ? 'All' : `${canvasMaxDepth + 1}`;
}

depthUpBtn.addEventListener('click', () => {
  if (canvasMaxDepth < absoluteMaxDepth) {
    canvasMaxDepth++;
    updateDepthLabel();
    renderCanvas(currentTree);
    setTimeout(centerInitialView, 50);
  }
});

depthDownBtn.addEventListener('click', () => {
  if (canvasMaxDepth > 0) {
    canvasMaxDepth--;
    updateDepthLabel();
    renderCanvas(currentTree);
    setTimeout(centerInitialView, 50);
  }
});

layoutVertBtn.addEventListener('click', () => {
  canvasOrientation = 'vertical';
  layoutVertBtn.classList.add('active');
  layoutHorizBtn.classList.remove('active');
  renderCanvas(currentTree);
  setTimeout(centerInitialView, 50);
});

layoutHorizBtn.addEventListener('click', () => {
  canvasOrientation = 'horizontal';
  layoutHorizBtn.classList.add('active');
  layoutVertBtn.classList.remove('active');
  renderCanvas(currentTree);
  setTimeout(centerInitialView, 50);
});

// --- HIGH RES EXPORT LOGIC ---
function generateHighResCanvas(exportScale = 2) {
  if (!currentTree) return null;
  const treeToRender = getRenderedTree();
  const tempCanvas = document.createElement('canvas');
  const ctx = tempCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  
  const layoutData = calculateLayout(treeToRender, canvasOrientation);
  const padding = 60;
  const w = layoutData.maxX + padding;
  const h = layoutData.maxY + padding;

  tempCanvas.width = w * exportScale * dpr;
  tempCanvas.height = h * exportScale * dpr;
  tempCanvas.style.width = `${w}px`;
  tempCanvas.style.height = `${h}px`;

  ctx.scale(dpr, dpr);
  ctx.scale(exportScale, exportScale);
  
  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(0, 0, w, h);
  
  drawTree(ctx, treeToRender, canvasOrientation);
  return tempCanvas;
}

copyImageBtn.addEventListener('click', async () => {
  const tempCanvas = generateHighResCanvas(2);
  if (!tempCanvas) return;
  
  tempCanvas.toBlob(async (blob) => {
    const success = await window.api.copyImageToClipboard(blob);
    if (success) flashButton(copyImageBtn, 'Copied!');
  }, 'image/png');
});

exportPngBtn.addEventListener('click', async () => {
  const tempCanvas = generateHighResCanvas(2);
  if (!tempCanvas) return;
  
  tempCanvas.toBlob(async (blob) => {
    const saved = await window.api.saveFile(blob, 'image/png', 'folder-architecture.png');
    if (saved) flashButton(exportPngBtn, 'Saved!');
  }, 'image/png');
});

exportPdfBtn.addEventListener('click', async () => {
  const tempCanvas = generateHighResCanvas(2);
  if (!tempCanvas) return;
  
  const imgData = tempCanvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  
  const pdfW = 595.28;
  const pdfH = 841.89;
  
  const margin = 20;
  const usableW = pdfW - (margin * 2);
  const usableH = pdfH - (margin * 2);
  
  const imgRatio = tempCanvas.height / tempCanvas.width;
  let renderedImgW = usableW;
  let renderedImgH = usableW * imgRatio;
  
  let orientation = 'p';
  if (tempCanvas.width > tempCanvas.height) {
    orientation = 'l';
    renderedImgW = usableH; 
    renderedImgH = usableH * (tempCanvas.width / tempCanvas.height);
  }

  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  
  let heightLeft = renderedImgH;
  let position = margin;

  pdf.addImage(imgData, 'PNG', margin, position, renderedImgW, renderedImgH);
  heightLeft -= (orientation === 'p' ? usableH : usableW);

  while (heightLeft > 0) {
    position = heightLeft - renderedImgH + margin;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, position, renderedImgW, renderedImgH);
    heightLeft -= (orientation === 'p' ? usableH : usableW);
  }

  const pdfBlob = pdf.output('blob');
  const saved = await window.api.saveFile(pdfBlob, 'application/pdf', 'folder-architecture.pdf');
  if (saved) flashButton(exportPdfBtn, 'Saved!');
});

// --- EXPORT TEXT/JSON ---
copyTreeBtn.addEventListener('click', () => {
  if (!currentTree) return;
  const text = treeToText(currentTree, 0);
  navigator.clipboard.writeText(text).then(() => flashButton(copyTreeBtn, 'Copied!'));
});

copyJsonBtn.addEventListener('click', () => {
  if (!currentTree) return;
  const text = JSON.stringify(currentTree, (key, value) => {
    if (key.startsWith('_')) return undefined;
    return value;
  }, 2);
  navigator.clipboard.writeText(text).then(() => flashButton(copyJsonBtn, 'Copied!'));
});

function flashButton(btn, msg) {
  const orig = btn.textContent;
  btn.textContent = msg;
  btn.classList.add('success');
  setTimeout(() => {
    btn.textContent = orig;
    btn.classList.remove('success');
  }, 1500);
}

function treeToText(node, depth) {
  const indent = '  '.repeat(depth);
  let line = '';
  if (node.type === 'directory') {
    line = `${indent}📁 ${node.name}/\n`;
    if (node.children) {
      line += node.children.map(c => treeToText(c, depth + 1)).join('');
    }
  } else {
    line = `${indent}📄 ${node.name}\n`;
  }
  return line;
}

folderPathInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !scanBtn.disabled) scanBtn.click();
});
