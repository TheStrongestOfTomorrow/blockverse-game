// ============================================
// BLOCKVERSE - Tools Engine (tools.js)
// ============================================
// V2.0 — Uses DDA voxel raycasting (via BlockRenderer) instead of
// mesh-based raycasting. Single shared Raycaster object.
// Paint/grab tools adapted for InstancedMesh architecture.
// ============================================

const Tools = {
    _currentTool: 'build',
    _currentBlockType: 'grass',
    _currentPaintColor: '#4CAF50',
    _activeSlot: 0,

    _toolbarSlots: [],
    _gearSlots: [],
    _hasGears: false,

    _grabbedBlock: null,
    _grabOffset: null,
    _isGrabbing: false,

    _onMouseDown: null,
    _onMouseUp: null,
    _onKeyDown: null,

    _toolbarEl: null,
    _slotElements: [],

    // Shared raycaster (reused every frame — no allocation)
    _sharedRaycaster: null,

    // =============================================
    // INITIALIZATION
    // =============================================

    init() {
        this._currentTool = 'build';
        this._currentBlockType = 'grass';
        this._currentPaintColor = '#4CAF50';
        this._activeSlot = 0;

        // Shared raycaster — created once, reused forever
        this._sharedRaycaster = new THREE.Raycaster();

        this._toolbarSlots = [...BV.DEFAULT_TOOLBAR];
        while (this._toolbarSlots.length < BV.TOOLBAR_SIZE) {
            this._toolbarSlots.push('stone');
        }
        this._toolbarSlots = this._toolbarSlots.slice(0, BV.TOOLBAR_SIZE);

        // Gear check (Owner only in sandbox)
        this._checkGears();

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
    // CURSOR-BASED RAYCASTING (DDA via BlockRenderer)
    // =============================================

    /**
     * Get ray from camera through the mouse cursor position.
     * Uses the shared raycaster — no allocation per frame.
     */
    _getCursorRay() {
        if (typeof World === 'undefined' || !World.camera) return null;

        const ndc = (typeof Player !== 'undefined' && Player.isActive())
            ? Player.getMouseNDC()
            : { x: 0, y: 0 };

        this._sharedRaycaster.setFromCamera(
            new THREE.Vector2(ndc.x, ndc.y),
            World.camera
        );
        this._sharedRaycaster.far = 10;

        return {
            origin: this._sharedRaycaster.ray.origin,
            direction: this._sharedRaycaster.ray.direction,
        };
    },

    /**
     * Perform DDA voxel raycast from cursor into the world.
     * Delegates to BlockRenderer.raycast — O(distance) instead of O(num_blocks).
     */
    _cursorRaycast() {
        const ray = this._getCursorRay();
        if (!ray || typeof World === 'undefined') return null;

        const hit = World.getRaycastTarget(ray.origin, ray.direction, 10);
        return hit;
    },

    // =============================================
    // MOUSE INPUT HANDLERS
    // =============================================

    handleMouseDown(event) {
        if (typeof Player !== 'undefined' && !Player.isActive()) return;
        if (event.button !== 0) return; // Only left-click for tools
        
        // Sandbox mode enforcement
        const isSandbox = (typeof Multiplayer !== 'undefined' && Multiplayer.gameSettings?.category === 'sandbox');
        if (!isSandbox) {
            console.warn('[Tools] Tool not allowed in this game mode.');
            return;
        }

        this._performPrimaryAction();
    },

    handleMouseUp(event) {
        if (event.button === 0 && this._isGrabbing) {
            this._releaseGrabbedBlock();
        }
    },

    // =============================================
    // TOOL ACTIONS (cursor-based)
    // =============================================

    _performPrimaryAction() {
        if (typeof World === 'undefined' || !World.camera) return;

        // Tool Restrictions: Disable building/deleting in competitive modes
        const competitiveTemplates = ['arena', 'obby', 'racing', 'parkour'];
        const isCompetitiveTemplate = competitiveTemplates.includes(World.template);
        const amIHost = (typeof Multiplayer !== 'undefined') ? Multiplayer.getAmIHost() : true;

        if (isCompetitiveTemplate && !amIHost) {
            Utils.showToast('Building is disabled in this game mode.', 'info');
            return;
        }

        // Legacy check for backward compatibility with sandbox codes
        if (typeof Multiplayer !== 'undefined' && Multiplayer.gameCode) {
            const isSandbox = Multiplayer.gameCode.includes('BLDW') || Multiplayer.gameCode.includes('SPDB') || Multiplayer.gameCode.includes('SAND');

            // Non-hosts can't modify non-sandbox games
            if (!isSandbox && !amIHost) {
                Utils.showToast('Building is disabled in this game mode.', 'info');
                return;
            }
        }

        // If holding a grabbed block, place it
        if (this._isGrabbing) {
            this._placeGrabbedBlock();
            return;
        }

        const hit = this._cursorRaycast();
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
        if (!block) return;

        // Already painted with same color — skip
        if (block.customColor === this._currentPaintColor) return;

        // Remove from InstancedMesh (standard block)
        if (!block.customColor) {
            if (typeof BlockRenderer !== 'undefined') {
                BlockRenderer.removeBlock(hit.position.x, hit.position.y, hit.position.z, block.type);
            }
        }

        // Remove old custom mesh if exists
        if (typeof BlockRenderer !== 'undefined') {
            BlockRenderer.removeCustomMesh(hit.position.x, hit.position.y, hit.position.z);
        }

        // Create new custom mesh with paint color
        const mat = new THREE.MeshLambertMaterial({ color: this._currentPaintColor });
        let customMesh = null;
        if (typeof BlockRenderer !== 'undefined') {
            customMesh = BlockRenderer.addCustomMesh(
                hit.position.x, hit.position.y, hit.position.z, mat
            );
        }

        // Update block data
        block.customColor = this._currentPaintColor;
        block.mesh = customMesh;

        window.dispatchEvent(new CustomEvent('tools:block_painted', {
            detail: { x: hit.position.x, y: hit.position.y, z: hit.position.z, color: this._currentPaintColor },
        }));
    },

    _grabAction(hit) {
        const block = World.getBlock(hit.position.x, hit.position.y, hit.position.z);
        if (!block) return;

        const key = blockKey(hit.position.x, hit.position.y, hit.position.z);

        // Remove from render
        if (block.customColor) {
            if (typeof BlockRenderer !== 'undefined') {
                BlockRenderer.removeCustomMesh(hit.position.x, hit.position.y, hit.position.z);
            }
        } else {
            if (typeof BlockRenderer !== 'undefined') {
                BlockRenderer.removeBlock(hit.position.x, hit.position.y, hit.position.z, block.type);
            }
        }

        // Create temporary grab mesh with glow effect
        const config = BV.BLOCK_TYPES[block.type] || {};
        const color = block.customColor || config.color || '#ffffff';
        const mat = new THREE.MeshLambertMaterial({ color: color });
        mat.emissive = new THREE.Color('#FFA000');
        mat.emissiveIntensity = 0.5;

        const grabMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1), mat
        );
        grabMesh.position.set(hit.position.x + 0.5, hit.position.y + 0.5, hit.position.z + 0.5);
        if (typeof World !== 'undefined' && World.scene) {
            World.scene.add(grabMesh);
        }

        this._grabbedBlock = {
            key: key,
            x: hit.position.x,
            y: hit.position.y,
            z: hit.position.z,
            type: block.type,
            mesh: grabMesh,
            customColor: block.customColor || null,
        };

        this._isGrabbing = true;

        // Remove from blockMap (will be re-added on place)
        World.blockMap.delete(key);
        World.blockCount--;
    },

    _placeGrabbedBlock() {
        if (!this._grabbedBlock) return;

        // Raycast to find placement position
        const hit = this._cursorRaycast();
        if (!hit) {
            // No valid position — put block back
            this._cancelGrab();
            return;
        }

        const placeX = hit.position.x + hit.normal.nx;
        const placeY = hit.position.y + hit.normal.ny;
        const placeZ = hit.position.z + hit.normal.nz;

        // Check if position is occupied
        const existingKey = blockKey(placeX, placeY, placeZ);
        if (World.blockMap.has(existingKey)) {
            this._cancelGrab();
            return;
        }

        // Remove temp mesh from scene
        if (this._grabbedBlock.mesh && this._grabbedBlock.mesh.parent) {
            this._grabbedBlock.mesh.parent.remove(this._grabbedBlock.mesh);
        }
        this._grabbedBlock.mesh.material.dispose();

        // Add block at new position
        World.blockMap.set(existingKey, {
            x: placeX, y: placeY, z: placeZ,
            type: this._grabbedBlock.type,
        });
        World.blockCount++;

        if (this._grabbedBlock.customColor) {
            if (typeof BlockRenderer !== 'undefined') {
                const mat = new THREE.MeshLambertMaterial({ color: this._grabbedBlock.customColor });
                BlockRenderer.addCustomMesh(placeX, placeY, placeZ, mat);
            }
        } else {
            if (typeof BlockRenderer !== 'undefined') {
                BlockRenderer.addBlock(placeX, placeY, placeZ, this._grabbedBlock.type);
            }
        }

        window.dispatchEvent(new CustomEvent('tools:block_placed', {
            detail: { x: placeX, y: placeY, z: placeZ, type: this._grabbedBlock.type },
        }));

        this._grabbedBlock = null;
        this._isGrabbing = false;
    },

    _releaseGrabbedBlock() {
        this._placeGrabbedBlock();
    },

    _cancelGrab() {
        if (!this._grabbedBlock) return;

        // Put block back at original position
        const key = this._grabbedBlock.key;

        if (this._grabbedBlock.mesh && this._grabbedBlock.mesh.parent) {
            this._grabbedBlock.mesh.parent.remove(this._grabbedBlock.mesh);
        }
        this._grabbedBlock.mesh.material.dispose();

        World.blockMap.set(key, {
            x: this._grabbedBlock.x,
            y: this._grabbedBlock.y,
            z: this._grabbedBlock.z,
            type: this._grabbedBlock.type,
        });
        World.blockCount++;

        if (this._grabbedBlock.customColor) {
            if (typeof BlockRenderer !== 'undefined') {
                const mat = new THREE.MeshLambertMaterial({ color: this._grabbedBlock.customColor });
                BlockRenderer.addCustomMesh(this._grabbedBlock.x, this._grabbedBlock.y, this._grabbedBlock.z, mat);
            }
        } else {
            if (typeof BlockRenderer !== 'undefined') {
                BlockRenderer.addBlock(this._grabbedBlock.x, this._grabbedBlock.y, this._grabbedBlock.z, this._grabbedBlock.type);
            }
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
    // BLOCK HIGHLIGHT (cursor-based)
    // =============================================

    updateHighlight() {
        if (typeof Player !== 'undefined' && !Player.isActive()) {
            if (typeof World !== 'undefined') World.removeHighlight();
            return;
        }

        const hit = this._cursorRaycast();

        if (!hit) {
            if (typeof World !== 'undefined') World.removeHighlight();
            return;
        }

        if (typeof World === 'undefined') return;

        switch (this._currentTool) {
            case 'build': World.highlightBlock(hit.position, hit.normal, 'place'); break;
            case 'delete': World.highlightBlock(hit.position, null, 'delete'); break;
            case 'paint': World.highlightBlock(hit.position, null, 'paint'); break;
            case 'grab': World.highlightBlock(hit.position, null, 'grab'); break;
            default: World.removeHighlight();
        }
    },

    // =============================================
    // TOOL CONFIGURATION (Game-Specific)
    // =============================================

    _checkGears() {
        const isSandbox = (typeof Multiplayer !== 'undefined' && Multiplayer.gameSettings?.category === 'sandbox');
        const isHost = (typeof Multiplayer !== 'undefined' && Multiplayer.getAmIHost());
        
        this._hasGears = (isSandbox && isHost);
        this._gearSlots = [
            { id: 'gear-bomb', name: 'Explosive Gear', icon: '💣', action: () => this._gearBomb() },
            { id: 'gear-wall', name: 'Instant Wall', icon: '🚧', action: () => this._gearWall() },
        ];
    },

    // New: Helper to get allowed tools based on category
    getAllowedTools() {
        const category = (typeof Multiplayer !== 'undefined' && Multiplayer.gameSettings?.category) || 'sandbox';
        
        const toolDefinitions = {
            'sandbox': ['build', 'delete', 'paint', 'grab'],
            'racing': ['boost', 'drift', 'horn'],
            'adventure': ['sword', 'interact', 'heal'],
            'obby': ['check-point', 'jump-boost'],
            'roleplay': ['emote', 'chat-bubble', 'trade'],
            'minigame': ['shoot', 'interact']
        };

        return toolDefinitions[category] || ['interact'];
    },

    buildToolButtons() {
        const allowedTools = this.getAllowedTools();
        const toolButtons = document.querySelectorAll('.btn-tool');
        
        toolButtons.forEach(btn => {
            const tool = btn.dataset.tool;
            if (!tool) return;

            // Hide tools not in the allowed list
            if (!allowedTools.includes(tool)) {
                btn.style.display = 'none';
                return;
            }

            btn.style.display = 'inline-block';
            if (tool === this._currentTool) {
                btn.classList.add('active');
            }

            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', () => this.setTool(tool));
        });
    },

    _gearBomb() {
        const hit = this._cursorRaycast();
        if (!hit) return;
        const radius = 2;
        for (let x = hit.position.x - radius; x <= hit.position.x + radius; x++) {
            for (let y = hit.position.y - radius; y <= hit.position.y + radius; y++) {
                for (let z = hit.position.z - radius; z <= hit.position.z + radius; z++) {
                    const dist = Math.sqrt((x-hit.position.x)**2 + (y-hit.position.y)**2 + (z-hit.position.z)**2);
                    if (dist <= radius) World.removeBlock(x, y, z, true);
                }
            }
        }
        Utils.showToast('BOOM! 💣', 'warning');
    },

    _gearWall() {
        const hit = this._cursorRaycast();
        if (!hit) return;
        const dir = Player.getForwardDirection();
        const axis = Math.abs(dir.x) > Math.abs(dir.z) ? 'z' : 'x';
        for (let i = -2; i <= 2; i++) {
            for (let j = 0; j <= 3; j++) {
                const px = axis === 'z' ? hit.position.x + hit.normal.nx : hit.position.x + hit.normal.nx + i;
                const pz = axis === 'z' ? hit.position.z + hit.normal.nz + i : hit.position.z + hit.normal.nz;
                const py = hit.position.y + hit.normal.ny + j;
                World.addBlock(px, py, pz, this._currentBlockType, true);
            }
        }
        Utils.showToast('Wall Built! 🚧', 'success');
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
