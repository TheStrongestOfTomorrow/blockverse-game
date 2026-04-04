// ============================================
// BLOCKVERSE - Tools Engine (tools.js)
// ============================================
// Handles tool selection, block placement/deletion,
// painting, the grab tool, toolbar UI, block picker,
// paint color picker, and block highlight rendering.
// ============================================

const Tools = {
    _currentTool: 'build',
    _currentBlockType: 'grass',
    _currentPaintColor: '#4CAF50',
    _activeSlot: 0,

    _toolbarSlots: [],

    _grabbedBlock: null,
    _grabOffset: null,
    _isGrabbing: false,

    _onMouseDown: null,
    _onMouseUp: null,
    _onKeyDown: null,

    _toolbarEl: null,
    _slotElements: [],

    // =============================================
    // INITIALIZATION
    // =============================================

    init() {
        this._currentTool = 'build';
        this._currentBlockType = 'grass';
        this._currentPaintColor = '#4CAF50';
        this._activeSlot = 0;

        this._toolbarSlots = [...BV.DEFAULT_TOOLBAR];
        while (this._toolbarSlots.length < BV.TOOLBAR_SIZE) {
            this._toolbarSlots.push('stone');
        }
        this._toolbarSlots = this._toolbarSlots.slice(0, BV.TOOLBAR_SIZE);

        this.buildToolbarUI();
        this.buildBlockPickerUI();
        this.buildPaintColorPicker();
        this.buildToolButtons();

        // Left-click on canvas = tool action
        this._onMouseDown = this.handleMouseDown.bind(this);
        this._onMouseUp = this.handleMouseUp.bind(this);

        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            canvas.addEventListener('mousedown', this._onMouseDown);
        }
        document.addEventListener('mouseup', this._onMouseUp);

        this._onKeyDown = this._handleKeyDown.bind(this);
        document.addEventListener('keydown', this._onKeyDown);
    },

    destroy() {
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            canvas.removeEventListener('mousedown', this._onMouseDown);
        }
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('keydown', this._onKeyDown);
    },

    // =============================================
    // TOOL GETTERS / SETTERS
    // =============================================

    setTool(toolName) {
        const valid = ['build', 'delete', 'paint', 'grab'];
        if (!valid.includes(toolName)) return;
        this._currentTool = toolName;

        // Update both btn-tool and tool-btn class elements
        document.querySelectorAll('.btn-tool, .tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === toolName);
        });

        window.dispatchEvent(new CustomEvent('tools:change', {
            detail: { tool: toolName },
        }));
    },

    getTool() { return this._currentTool; },

    setBlockType(type) {
        if (!BV.BLOCK_TYPES[type]) return;
        this._currentBlockType = type;

        if (this._toolbarSlots.indexOf(type) === -1) {
            this._toolbarSlots[this._activeSlot] = type;
            this._updateToolbarSlotUI(this._activeSlot);
        }

        document.querySelectorAll('.block-picker-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.type === type);
        });
    },

    getBlockType() { return this._currentBlockType; },

    setPaintColor(color) {
        this._currentPaintColor = color;
        document.querySelectorAll('.paint-color-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.color === color);
        });
    },

    getPaintColor() { return this._currentPaintColor; },

    selectSlot(index) { this.setToolbarSlot(index); },

    // =============================================
    // TOOLBAR MANAGEMENT
    // =============================================

    setToolbarSlot(index) {
        if (index < 0 || index >= BV.TOOLBAR_SIZE) return;
        this._activeSlot = index;
        this._currentBlockType = this._toolbarSlots[index];

        this._slotElements.forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });

        document.querySelectorAll('.block-picker-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.type === this._currentBlockType);
        });
    },

    _handleKeyDown(e) {
        if (typeof Player !== 'undefined' && !Player.isActive()) return;

        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if (typeof Chat !== 'undefined' && Chat.isVisible()) return;

        if (e.code >= 'Digit1' && e.code <= 'Digit9') {
            const slot = parseInt(e.code.charAt(5)) - 1;
            if (slot < BV.TOOLBAR_SIZE) this.setToolbarSlot(slot);
            return;
        }

        switch (e.code) {
            case 'KeyB': this.setTool('build'); break;
            case 'KeyX': this.setTool('delete'); break;
            case 'KeyP': this.setTool('paint'); break;
            case 'KeyG': this.setTool('grab'); break;
        }
    },

    // =============================================
    // MOUSE INPUT HANDLERS
    // =============================================

    handleMouseDown(event) {
        if (typeof Player !== 'undefined' && !Player.isActive()) return;
        if (event.button !== 0) return; // Only left-click for tools
        this._performPrimaryAction();
    },

    handleMouseUp(event) {
        if (event.button === 0 && this._isGrabbing) {
            this._releaseGrabbedBlock();
        }
    },

    // =============================================
    // TOOL ACTIONS
    // =============================================

    _performPrimaryAction() {
        if (typeof World === 'undefined' || !World.camera) return;

        const origin = new THREE.Vector3();
        const direction = new THREE.Vector3();
        World.camera.getWorldPosition(origin);
        World.camera.getWorldDirection(direction);

        const hit = World.getRaycastTarget(origin, direction, 10);
        if (!hit) return;

        switch (this._currentTool) {
            case 'build': this._buildAction(hit); break;
            case 'delete': this._deleteAction(hit); break;
            case 'paint': this._paintAction(hit); break;
            case 'grab': this._grabAction(hit); break;
        }
    },

    _buildAction(hit) {
        const placeX = hit.position.x + hit.normal.nx;
        const placeY = hit.position.y + hit.normal.ny;
        const placeZ = hit.position.z + hit.normal.nz;

        if (this._wouldCollideWithPlayer(placeX, placeY, placeZ)) return;

        const success = World.addBlock(placeX, placeY, placeZ, this._currentBlockType, true);
        if (success) {
            window.dispatchEvent(new CustomEvent('tools:block_placed', {
                detail: { x: placeX, y: placeY, z: placeZ, type: this._currentBlockType },
            }));
        }
    },

    _deleteAction(hit) {
        const success = World.removeBlock(hit.position.x, hit.position.y, hit.position.z, true);
        if (success) {
            window.dispatchEvent(new CustomEvent('tools:block_removed', {
                detail: { x: hit.position.x, y: hit.position.y, z: hit.position.z },
            }));
        }
    },

    _paintAction(hit) {
        const block = World.getBlock(hit.position.x, hit.position.y, hit.position.z);
        if (!block || !block.mesh || !block.mesh.material) return;

        block.mesh.material.color.set(this._currentPaintColor);

        window.dispatchEvent(new CustomEvent('tools:block_painted', {
            detail: { x: hit.position.x, y: hit.position.y, z: hit.position.z, color: this._currentPaintColor },
        }));
    },

    _grabAction(hit) {
        if (this._isGrabbing) this._releaseGrabbedBlock();

        const key = `${hit.position.x},${hit.position.y},${hit.position.z}`;
        const block = World.getBlock(hit.position.x, hit.position.y, hit.position.z);
        if (!block) return;

        this._grabbedBlock = {
            key, x: hit.position.x, y: hit.position.y, z: hit.position.z,
            type: block.type, mesh: block.mesh,
        };
        this._isGrabbing = true;

        block.mesh.material.emissive = new THREE.Color('#FFA000');
        block.mesh.material.emissiveIntensity = 0.5;
    },

    _releaseGrabbedBlock() {
        if (!this._grabbedBlock) return;

        const block = this._grabbedBlock;
        const newX = Math.round(block.mesh.position.x - 0.5);
        const newY = Math.round(block.mesh.position.y - 0.5);
        const newZ = Math.round(block.mesh.position.z - 0.5);

        if (newX !== block.x || newY !== block.y || newZ !== block.z) {
            delete World.blockMap[block.key];
            const newKey = `${newX},${newY},${newZ}`;
            if (!World.blockMap[newKey]) {
                World.blockMap[newKey] = { x: newX, y: newY, z: newZ, type: block.type, mesh: block.mesh };
            } else {
                block.mesh.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
            }
        }

        const config = BV.BLOCK_TYPES[block.type];
        if (config && config.emissive) {
            block.mesh.material.emissive = new THREE.Color(config.emissive);
            block.mesh.material.emissiveIntensity = 0.4;
        } else {
            block.mesh.material.emissive = new THREE.Color(0x000000);
            block.mesh.material.emissiveIntensity = 0;
        }

        this._grabbedBlock = null;
        this._isGrabbing = false;
    },

    _wouldCollideWithPlayer(x, y, z) {
        if (typeof Player === 'undefined') return false;
        const pPos = Player.getPosition();
        const pw = 0.3;
        const ph = 1.8;
        return (
            x + 1 > pPos.x - pw && x < pPos.x + pw &&
            y + 1 > pPos.y && y < pPos.y + ph &&
            z + 1 > pPos.z - pw && z < pPos.z + pw
        );
    },

    // =============================================
    // BLOCK HIGHLIGHT
    // =============================================

    updateHighlight(rayOrigin, rayDir) {
        if (typeof Player !== 'undefined' && !Player.isActive()) {
            if (typeof World !== 'undefined') World.removeHighlight();
            return;
        }

        if (!rayOrigin || !rayDir) {
            if (typeof World !== 'undefined' && World.camera) {
                const origin = new THREE.Vector3();
                const direction = new THREE.Vector3();
                World.camera.getWorldPosition(origin);
                World.camera.getWorldDirection(direction);
                rayOrigin = origin;
                rayDir = direction;
            } else return;
        }

        const hit = World.getRaycastTarget(rayOrigin, rayDir, 10);

        if (!hit) {
            World.removeHighlight();
            return;
        }

        switch (this._currentTool) {
            case 'build': World.highlightBlock(hit.position, hit.normal, 'place'); break;
            case 'delete': World.highlightBlock(hit.position, null, 'delete'); break;
            case 'paint': World.highlightBlock(hit.position, null, 'paint'); break;
            case 'grab': World.highlightBlock(hit.position, null, 'grab'); break;
            default: World.removeHighlight();
        }
    },

    // =============================================
    // UI BUILDING
    // =============================================

    buildToolbarUI() {
        this._toolbarEl = document.getElementById('toolbar');
        if (!this._toolbarEl) return;

        this._toolbarEl.innerHTML = '';
        this._slotElements = [];

        for (let i = 0; i < BV.TOOLBAR_SIZE; i++) {
            const slot = document.createElement('div');
            slot.className = 'toolbar-slot' + (i === this._activeSlot ? ' active' : '');
            slot.dataset.index = i;

            const preview = document.createElement('div');
            preview.className = 'toolbar-slot-content';
            const blockType = this._toolbarSlots[i];
            const config = BV.BLOCK_TYPES[blockType];
            if (config) {
                preview.style.backgroundColor = config.color;
                if (config.transparent) {
                    preview.style.opacity = config.opacity || 0.5;
                }
            }

            const keyLabel = document.createElement('span');
            keyLabel.className = 'toolbar-slot-key';
            keyLabel.textContent = (i + 1).toString();

            if (config) slot.title = config.name;

            slot.appendChild(preview);
            slot.appendChild(keyLabel);

            slot.addEventListener('click', () => this.setToolbarSlot(i));

            this._toolbarEl.appendChild(slot);
            this._slotElements.push(slot);
        }
    },

    _updateToolbarSlotUI(index) {
        if (index < 0 || index >= this._slotElements.length) return;
        const slot = this._slotElements[index];
        const blockType = this._toolbarSlots[index];
        const config = BV.BLOCK_TYPES[blockType];
        const preview = slot.querySelector('.toolbar-slot-content');

        if (preview && config) {
            preview.style.backgroundColor = config.color;
            preview.style.opacity = config.transparent ? (config.opacity || 0.5) : 1;
        }
        if (config) slot.title = config.name;
    },

    buildBlockPickerUI() {
        // Try both possible element IDs
        const container = document.getElementById('block-type-picker') || document.getElementById('block-picker');
        if (!container) return;

        container.innerHTML = '';

        for (const [type, config] of Object.entries(BV.BLOCK_TYPES)) {
            const item = document.createElement('div');
            item.className = 'block-picker-item' + (type === this._currentBlockType ? ' selected' : '');
            item.dataset.type = type;

            const swatch = document.createElement('div');
            swatch.className = 'block-preview';
            swatch.style.width = '20px';
            swatch.style.height = '20px';
            swatch.style.borderRadius = '3px';
            swatch.style.backgroundColor = config.color;
            if (config.transparent) {
                swatch.style.opacity = config.opacity || 0.5;
            }

            const label = document.createElement('span');
            label.textContent = config.name;

            item.appendChild(swatch);
            item.appendChild(label);

            item.addEventListener('click', () => this.setBlockType(type));

            container.appendChild(item);
        }
    },

    buildPaintColorPicker() {
        // Try both possible element IDs
        const container = document.getElementById('paint-colors') || document.getElementById('paint-picker');
        if (!container) return;

        container.innerHTML = '';

        const paintColors = [
            '#4CAF50', '#66BB6A', '#2E7D32',
            '#E74C3C', '#C0392B', '#FF5722',
            '#2196F3', '#1A237E', '#00BCD4',
            '#FFD700', '#FF9800', '#FFC107',
            '#9C27B0', '#673AB7', '#E91E63',
            '#9E9E9E', '#607D8B', '#000000',
            '#FFFFFF', '#FAFAFA', '#795548',
        ];

        for (const color of paintColors) {
            const swatch = document.createElement('div');
            swatch.className = 'paint-color-item color-circle' + (color === this._currentPaintColor ? ' selected' : '');
            swatch.dataset.color = color;
            swatch.style.backgroundColor = color;
            swatch.style.width = '32px';
            swatch.style.height = '32px';

            if (color === '#FFFFFF' || color === '#FAFAFA') {
                swatch.style.border = '2px solid #666';
            }

            swatch.addEventListener('click', () => this.setPaintColor(color));

            container.appendChild(swatch);
        }
    },

    buildToolButtons() {
        // Wire up .btn-tool buttons in the game menu (matching HTML class)
        const toolButtons = document.querySelectorAll('.btn-tool');
        toolButtons.forEach(btn => {
            const tool = btn.dataset.tool;
            if (!tool) return;

            if (tool === this._currentTool) {
                btn.classList.add('active');
            }

            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', () => this.setTool(tool));
        });
    },
};
