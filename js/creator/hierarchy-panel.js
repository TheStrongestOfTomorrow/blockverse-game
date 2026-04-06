// ============================================
// BLOCKVERSE - Object Hierarchy Panel (Explorer)
// ============================================
// Tree view of all objects in the world.
// Click to select, right-click for context menu.
// Based on Roblox Studio Explorer.
// =============================================

const HierarchyPanel = (() => {
    'use strict';

    let _rootNode = null;
    let _selectedNodeId = null;
    let _treeData = new Map();  // id -> { name, type, children[], visible, locked }
    let _blockIdToNodeId = new Map();  // blockKey -> nodeId

    // =====================================================
    // INITIALIZATION
    // =====================================================

    function init(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) {
            console.warn('[HierarchyPanel] Container not found:', containerSelector);
            return;
        }

        container.innerHTML = `
            <div class="hierarchy-header">
                <h3>Explorer</h3>
                <div class="hierarchy-search-wrapper">
                    <input type="text" class="hierarchy-search" placeholder="Search blocks..." />
                </div>
            </div>
            <div class="hierarchy-tree"></div>
        `;

        _buildTree();
        _setupEventListeners();

        // Listen for world changes to refresh tree
        window.addEventListener('block:place', () => refresh());
        window.addEventListener('block:remove', () => refresh());

        console.log('[HierarchyPanel] Initialized');
    }

    function _buildTree() {
        const treeContainer = document.querySelector('.hierarchy-tree');
        if (!treeContainer) return;

        _treeData.clear();
        _blockIdToNodeId.clear();

        // Create root workspace node
        _rootNode = {
            id: 'workspace',
            name: 'Workspace',
            type: 'folder',
            visible: true,
            locked: false,
            children: [],
        };
        _treeData.set('workspace', _rootNode);

        // Build terrain node
        const terrainNode = _createNode('terrain', 'Terrain', 'folder', _rootNode);
        _rootNode.children.push(terrainNode);

        // Build blocks group from blockMap
        const blocksGroupNode = _createNode('blocks-group', 'Blocks', 'folder', _rootNode);
        _rootNode.children.push(blocksGroupNode);

        if (typeof World !== 'undefined' && World.blockMap) {
            // Optimization: Only render the first 100 blocks to prevent UI lag,
            // with a "show more" or search filtering.
            let count = 0;
            const MAX_DISPLAY = 100;

            World.blockMap.forEach((block, key) => {
                if (count < MAX_DISPLAY) {
                    const blockNode = _createNode(
                        `block-${key}`,
                        `${block.type.charAt(0).toUpperCase() + block.type.slice(1)} [${block.x}, ${block.y}, ${block.z}]`,
                        'block',
                        blocksGroupNode
                    );
                    blocksGroupNode.children.push(blockNode);
                }
                _blockIdToNodeId.set(key, `block-${key}`);
                count++;
            });

            if (count > MAX_DISPLAY) {
                const moreNode = _createNode('more-blocks', `... and ${count - MAX_DISPLAY} more`, 'folder', blocksGroupNode);
                blocksGroupNode.children.push(moreNode);
            }
        }

        // Build spawners node
        const spawnersNode = _createNode('spawners', 'Spawners', 'folder', _rootNode);
        _rootNode.children.push(spawnersNode);

        // Build decorations node
        const decorNode = _createNode('decorations', 'Decorations', 'folder', _rootNode);
        _rootNode.children.push(decorNode);

        // Render tree
        _renderTree(treeContainer, _rootNode);
    }

    function _createNode(id, name, type, parent = null) {
        const node = {
            id,
            name,
            type,
            parent,
            visible: true,
            locked: false,
            children: [],
            element: null,
        };
        _treeData.set(id, node);
        return node;
    }

    function _renderTree(container, node, level = 0) {
        const isRoot = level === 0;

        if (!isRoot) {
            // Create node element
            const nodeEl = document.createElement('div');
            nodeEl.className = `hierarchy-node level-${level}`;
            nodeEl.dataset.nodeId = node.id;
            nodeEl.innerHTML = `
                <div class="node-content">
                    ${node.children.length > 0 ? `<span class="expand-icon">▶</span>` : '<span class="expand-icon empty">•</span>'}
                    <span class="node-icon">${_getNodeIcon(node.type)}</span>
                    <span class="node-name">${node.name}</span>
                    <div class="node-buttons">
                        <button class="toggle-visible" title="Toggle visibility">👁</button>
                        <button class="toggle-lock" title="Toggle lock">🔓</button>
                    </div>
                </div>
                <div class="hierarchy-children" style="display: none;"></div>
            `;

            node.element = nodeEl;

            // Expand/collapse
            const expandIcon = nodeEl.querySelector('.expand-icon');
            if (expandIcon && !expandIcon.classList.contains('empty')) {
                expandIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    _toggleExpanded(nodeEl);
                });
            }

            // Select on click
            const content = nodeEl.querySelector('.node-content');
            content.addEventListener('click', () => {
                _selectNode(node.id);
            });

            // Right-click context menu
            content.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                _showContextMenu(node.id, e.clientX, e.clientY);
            });

            // Visibility toggle
            const visBtn = nodeEl.querySelector('.toggle-visible');
            visBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                node.visible = !node.visible;
                visBtn.textContent = node.visible ? '👁' : '🚫';
            });

            // Lock toggle
            const lockBtn = nodeEl.querySelector('.toggle-lock');
            lockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                node.locked = !node.locked;
                lockBtn.textContent = node.locked ? '🔒' : '🔓';
            });

            container.appendChild(nodeEl);
        } else {
            // Root level
            node.element = container;
        }

        // Render children
        if (node.children.length > 0) {
            const childrenContainer = isRoot 
                ? container 
                : node.element.querySelector('.hierarchy-children');

            node.children.forEach(child => {
                _renderTree(childrenContainer, child, level + 1);
            });
        }
    }

    function _toggleExpanded(nodeEl) {
        const expanded = nodeEl.classList.contains('expanded');
        if (expanded) {
            nodeEl.classList.remove('expanded');
            nodeEl.querySelector('.hierarchy-children').style.display = 'none';
            nodeEl.querySelector('.expand-icon').textContent = '▶';
        } else {
            nodeEl.classList.add('expanded');
            nodeEl.querySelector('.hierarchy-children').style.display = 'block';
            nodeEl.querySelector('.expand-icon').textContent = '▼';
        }
    }

    function _selectNode(nodeId) {
        // Deselect previous
        if (_selectedNodeId) {
            const prevEl = document.querySelector(`[data-node-id="${_selectedNodeId}"]`);
            if (prevEl) prevEl.classList.remove('selected');
        }

        // Select new
        _selectedNodeId = nodeId;
        const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeEl) {
            nodeEl.classList.add('selected');
        }

        // Update properties panel if it exists
        if (typeof PropertiesPanel !== 'undefined') {
            PropertiesPanel.showProperties(_selectedNodeId);
        }

        // Highlight block in 3D view
        const node = _treeData.get(nodeId);
        if (node && node.type === 'block') {
            _highlightBlockInWorld(nodeId);
        }

        console.log('[HierarchyPanel] Selected:', nodeId);
    }

    function _highlightBlockInWorld(nodeId) {
        if (typeof World === 'undefined') return;

        // Find block by node ID and highlight it
        const blockKey = Array.from(_blockIdToNodeId.entries())
            .find(([key, id]) => id === nodeId)?.[0];

        if (blockKey && World.blockMap.has(blockKey)) {
            const block = World.blockMap.get(blockKey);
            if (typeof Tools !== 'undefined' && Tools._highlightMesh) {
                Tools._highlightMesh.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
                Tools._highlightMesh.visible = true;
            }
        }
    }

    function _showContextMenu(nodeId, x, y) {
        // Remove old menu
        const oldMenu = document.querySelector('.context-menu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.innerHTML = `
            <div class="context-item" data-action="duplicate">Duplicate</div>
            <div class="context-item" data-action="delete">Delete</div>
            <div class="context-item" data-action="rename">Rename</div>
            <div class="context-divider"></div>
            <div class="context-item" data-action="group">Group</div>
            <div class="context-item" data-action="copy">Copy</div>
            <div class="context-item" data-action="paste">Paste</div>
        `;

        menu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            _handleContextAction(nodeId, action);
            menu.remove();
        });

        document.body.appendChild(menu);
    }

    function _handleContextAction(nodeId, action) {
        const node = _treeData.get(nodeId);
        if (!node) return;

        switch (action) {
            case 'delete':
                console.log('[HierarchyPanel] Delete:', nodeId);
                // Remove from tree
                node.parent.children = node.parent.children.filter(c => c.id !== nodeId);
                _rebuildTree();
                break;

            case 'duplicate':
                console.log('[HierarchyPanel] Duplicate:', nodeId);
                // Create copy
                _rebuildTree();
                break;

            case 'rename':
                console.log('[HierarchyPanel] Rename:', nodeId);
                const newName = prompt('New name:', node.name);
                if (newName) {
                    node.name = newName;
                    _rebuildTree();
                }
                break;

            case 'group':
                console.log('[HierarchyPanel] Group:', nodeId);
                // Implement grouping logic
                break;

            default:
                console.log('[HierarchyPanel] Action:', action);
        }
    }

    function _rebuildTree() {
        _treeData.clear();
        const container = document.querySelector('.hierarchy-tree');
        if (container) {
            container.innerHTML = '';
            _buildTree();
        }
    }

    function _getNodeIcon(type) {
        const icons = {
            folder: '📁',
            block: '📦',
            spawner: '⭐',
            terrain: '🌍',
            group: '📂',
        };
        return icons[type] || '•';
    }

    function _setupEventListeners() {
        // Search functionality
        const searchInput = document.querySelector('.hierarchy-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                _filterTree(query);
            });
        }

        // Click outside to close context menu
        document.addEventListener('click', () => {
            const menu = document.querySelector('.context-menu');
            if (menu) menu.remove();
        });
    }

    function _filterTree(query) {
        if (query === '') {
            _buildTree(); // Show standard tree
            return;
        }

        // Deep search and build a flat result list if searching
        const results = [];
        const MAX_SEARCH_RESULTS = 200;

        if (typeof World !== 'undefined' && World.blockMap) {
            World.blockMap.forEach((block, key) => {
                const name = `${block.type} [${block.x}, ${block.y}, ${block.z}]`;
                if (name.toLowerCase().includes(query) && results.length < MAX_SEARCH_RESULTS) {
                    results.push({ key, block, name });
                }
            });
        }

        const treeContainer = document.querySelector('.hierarchy-tree');
        if (!treeContainer) return;
        treeContainer.innerHTML = '';

        results.forEach(res => {
            const nodeEl = document.createElement('div');
            nodeEl.className = 'hierarchy-node level-1';
            nodeEl.innerHTML = `
                <div class="node-content">
                    <span class="expand-icon empty">•</span>
                    <span class="node-icon">📦</span>
                    <span class="node-name">${res.name}</span>
                </div>
            `;
            nodeEl.addEventListener('click', () => _selectNode(`block-${res.key}`));
            treeContainer.appendChild(nodeEl);
        });

        if (results.length === 0) {
            treeContainer.innerHTML = '<div style="padding:1rem;color:var(--text-muted);font-size:0.75rem;text-align:center;">No blocks found</div>';
        }
    }

    // =====================================================
    // PUBLIC API
    // =====================================================

    return {
        init,
        selectNode: _selectNode,
        refresh: _rebuildTree,
        getSelectedNode: () => _selectedNodeId,
    };
})();
