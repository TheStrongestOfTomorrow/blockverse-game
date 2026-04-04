// ============================================
// BLOCKVERSE - Tools Engine (tools.js)
// ============================================
// Handles tool selection, block placement/deletion,
// painting, the grab tool, toolbar UI, block picker,
// paint color picker, and block highlight rendering.
// ============================================

const Tools = {
    // --- Tool State ---
    _currentTool: 'build',        // 'build' | 'delete' | 'paint' | 'grab'
    _currentBlockType: 'grass',
    _currentPaintColor: '#4CAF50',
    _activeSlot: 0,              // Currently selected toolbar slot (0-8)

    // --- Toolbar ---
    _toolbarSlots: [],            // Array of block type strings (length 9)

    // --- Grab tool ---
    _grabbedBlock: null,          // { key, x, y, z, type, mesh } currently grabbed
    _grabOffset: null,            // {x, y, z} offset from block to grab point
    _isGrabbing: false,

    // --- Event handlers ---
    _onMouseDown: null,
    _onMouseUp: null,
    _onMouseMove: null,
    _onWheel: null,
    _onContextMenu: null,

    // --- UI references ---
    _toolbarEl: null,             // #toolbar container
    _slotElements: [],            // Array of .toolbar-slot DOM elements

    // =============================================
    // INITIALIZATION
    // =============================================

    /**
     * Initialize the tools system: set defaults, build UI, wire up events.
     */
    init() {
        // Set default state
        this._currentTool = 'build';
        this._currentBlockType = 'grass';
        this._currentPaintColor = '#4CAF50';
        this._activeSlot = 0;

        // Initialize toolbar from config defaults
        this._toolbarSlots = [...BV.DEFAULT_TOOLBAR];
        // Ensure exactly TOOLBAR_SIZE slots
        while (this._toolbarSlots.length < BV.TOOLBAR_SIZE) {
            this._toolbarSlots.push('stone');
        }
        this._toolbarSlots = this._toolbarSlots.slice(0, BV.TOOLBAR_SIZE);

        // Build UI
        this.buildToolbarUI();
        this.buildBlockPickerUI();
        this.buildPaintColorPicker();
        this.buildToolButtons();

        // --- Event listeners ---
        this._onMouseDown = this.handleMouseDown.bind(this);
        this._onMouseUp = this.handleMouseUp.bind(this);
        this._onMouseMove = this.handleMouseMove.bind(this);
        this._onWheel = this.handleScroll.bind(this);
        this._onContextMenu = (e) => e.preventDefault();

        document.addEventListener('mousedown', this._onMouseDown);
        document.addEventListener('mouseup', this._onMouseUp);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('wheel', this._onWheel, { passive: false });
        document.addEventListener('contextmenu', this._onContextMenu);

        // Keyboard shortcuts for toolbar slots (1-9)
        this._onKeyDown = this._handleKeyDown.bind(this);
        document.addEventListener('keydown', this._onKeyDown);
    },

    /**
     * Clean up event listeners.
     */
    destroy() {
        document.removeEventListener('mousedown', this._onMouseDown);
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('wheel', this._onWheel);
        document.removeEventListener('contextmenu', this._onContextMenu);
        document.removeEventListener('keydown', this._onKeyDown);
    },

    // =============================================
    // TOOL GETTERS / SETTERS
    // =============================================

    /**
     * Set the active tool.
     * @param {string} toolName - 'build' | 'delete' | 'paint' | 'grab'
     */
    setTool(toolName) {
        const valid = ['build', 'delete', 'paint', 'grab'];
        if (!valid.includes(toolName)) {
            console.warn(`[Tools] Invalid tool: "${toolName}"`);
            return;
        }
        this._currentTool = toolName;

        // Update tool button UI active states
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === toolName);
        });

        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('tools:change', {
            detail: { tool: toolName },
        }));
    },

    /**
     * Get the current tool name.
     * @returns {string}
     */
    getTool() {
        return this._currentTool;
    },

    /**
     * Set the current block type for the build tool.
     * @param {string} type - Key from BV.BLOCK_TYPES
     */
    setBlockType(type) {
        if (!BV.BLOCK_TYPES[type]) {
            console.warn(`[Tools] Unknown block type: "${type}"`);
            return;
        }
        this._currentBlockType = type;

        // Update the active toolbar slot to reflect this type
        if (this._toolbarSlots.indexOf(type) === -1) {
            // Replace current slot
            this._toolbarSlots[this._activeSlot] = type;
            this._updateToolbarSlotUI(this._activeSlot);
        }

        // Update block picker UI
        document.querySelectorAll('.block-picker-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.type === type);
        });
    },

    /**
     * Get the current block type.
     * @returns {string}
     */
    getBlockType() {
        return this._currentBlockType;
    },

    /**
     * Set the paint color.
     * @param {string} color - Hex color string
     */
    setPaintColor(color) {
        this._currentPaintColor = color;

        // Update color picker UI
        document.querySelectorAll('.paint-color-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.color === color);
        });
    },

    /**
     * Get the current paint color.
     * @returns {string}
     */
    getPaintColor() {
        return this._currentPaintColor;
    },

    // =============================================
    // TOOLBAR MANAGEMENT
    // =============================================

    /**
     * Select a toolbar slot by index (0-8).
     * @param {number} index
     */
    setToolbarSlot(index) {
        if (index < 0 || index >= BV.TOOLBAR_SIZE) return;

        this._activeSlot = index;
        this._currentBlockType = this._toolbarSlots[index];

        // Update UI
        this._slotElements.forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });

        // Update block picker selection
        document.querySelectorAll('.block-picker-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.type === this._currentBlockType);
        });
    },

    /**
     * Handle keyboard shortcuts for toolbar slots (1-9) and tool switching.
     * @param {KeyboardEvent} e
     */
    _handleKeyDown(e) {
        // Only respond when pointer is locked (in-game)
        if (!Player.isLocked()) return;

        // Number keys 1-9 for toolbar slots
        if (e.code >= 'Digit1' && e.code <= 'Digit9') {
            const slot = parseInt(e.code.charAt(5)) - 1;
            if (slot < BV.TOOLBAR_SIZE) {
                this.setToolbarSlot(slot);
            }
            return;
        }

        // Tool shortcuts (only if not handled by Player)
        switch (e.code) {
            case 'KeyB':
                this.setTool('build');
                break;
            case 'KeyX':
                this.setTool('delete');
                break;
            case 'KeyP':
                this.setTool('paint');
                break;
            case 'KeyG':
                this.setTool('grab');
                break;
        }
    },

    // =============================================
    // MOUSE INPUT HANDLERS
    // =============================================

    /**
     * Handle mouse button down (left = action, right = secondary action).
     * @param {MouseEvent} event
     */
    handleMouseDown(event) {
        // Only process when pointer is locked (in-game)
        if (!Player.isLocked()) return;

        // Left click (button 0) = primary action
        if (event.button === 0) {
            this._performPrimaryAction();
        }
    },

    /**
     * Handle mouse button up.
     * @param {MouseEvent} event
     */
    handleMouseUp(event) {
        if (event.button === 0 && this._isGrabbing) {
            this._releaseGrabbedBlock();
        }
    },

    /**
     * Handle mouse movement for grab tool.
     * @param {MouseEvent} event
     */
    handleMouseMove(event) {
        if (!Player.isLocked() || !this._isGrabbing || !this._grabbedBlock) return;

        // Calculate ray from camera
        const origin = new THREE.Vector3();
        const direction = new THREE.Vector3();
        World.camera.getWorldPosition(origin);
        World.camera.getWorldDirection(direction);

        // Cast ray and place the grabbed block at a short distance
        const hit = World.getRaycastTarget(origin, direction, 6);
        if (hit) {
            const targetX = hit.position.x + hit.normal.nx;
            const targetY = hit.position.y + hit.normal.ny;
            const targetZ = hit.position.z + hit.normal.nz;

            // Update the grabbed block mesh position
            this._grabbedBlock.mesh.position.set(
                targetX + 0.5,
                targetY + 0.5,
                targetZ + 0.5
            );

            // Update highlight
            this.updateHighlight(origin, direction);
        }
    },

    /**
     * Handle scroll wheel to cycle toolbar slots.
     * @param {WheelEvent} event
     */
    handleScroll(event) {
        if (!Player.isLocked()) return;
        event.preventDefault();

        let newSlot;
        if (event.deltaY > 0) {
            // Scroll down: next slot
            newSlot = (this._activeSlot + 1) % BV.TOOLBAR_SIZE;
        } else {
            // Scroll up: previous slot
            newSlot = (this._activeSlot - 1 + BV.TOOLBAR_SIZE) % BV.TOOLBAR_SIZE;
        }
        this.setToolbarSlot(newSlot);
    },

    // =============================================
    // TOOL ACTIONS
    // =============================================

    /**
     * Perform the primary action for the current tool.
     */
    _performPrimaryAction() {
        // Get ray from camera
        const origin = new THREE.Vector3();
        const direction = new THREE.Vector3();
        World.camera.getWorldPosition(origin);
        World.camera.getWorldDirection(direction);

        const hit = World.getRaycastTarget(origin, direction, 8);
        if (!hit) return;

        switch (this._currentTool) {
            case 'build':
                this._buildAction(hit);
                break;
            case 'delete':
                this._deleteAction(hit);
                break;
            case 'paint':
                this._paintAction(hit);
                break;
            case 'grab':
                this._grabAction(hit);
                break;
        }
    },

    /**
     * BUILD tool: place a block on the face that was hit.
     * @param {object} hit - Raycast result
     */
    _buildAction(hit) {
        const placeX = hit.position.x + hit.normal.nx;
        const placeY = hit.position.y + hit.normal.ny;
        const placeZ = hit.position.z + hit.normal.nz;

        // Don't place a block inside the player
        if (this._wouldCollideWithPlayer(placeX, placeY, placeZ)) return;

        const success = World.addBlock(placeX, placeY, placeZ, this._currentBlockType, true);
        if (success) {
            // Dispatch multiplayer sync event
            window.dispatchEvent(new CustomEvent('tools:block_placed', {
                detail: { x: placeX, y: placeY, z: placeZ, type: this._currentBlockType },
            }));
        }
    },

    /**
     * DELETE tool: remove the block that was hit.
     * @param {object} hit - Raycast result
     */
    _deleteAction(hit) {
        const success = World.removeBlock(hit.position.x, hit.position.y, hit.position.z, true);
        if (success) {
            window.dispatchEvent(new CustomEvent('tools:block_removed', {
                detail: { x: hit.position.x, y: hit.position.y, z: hit.position.z },
            }));
        }
    },

    /**
     * PAINT tool: change the color of the hit block.
     * @param {object} hit - Raycast result
     */
    _paintAction(hit) {
        const block = World.getBlock(hit.position.x, hit.position.y, hit.position.z);
        if (!block || !block.mesh || !block.mesh.material) return;

        block.mesh.material.color.set(this._currentPaintColor);

        window.dispatchEvent(new CustomEvent('tools:block_painted', {
            detail: {
                x: hit.position.x,
                y: hit.position.y,
                z: hit.position.z,
                color: this._currentPaintColor,
            },
        }));
    },

    /**
     * GRAB tool: pick up a block so it can be moved.
     * @param {object} hit - Raycast result
     */
    _grabAction(hit) {
        // Don't grab if already grabbing
        if (this._isGrabbing) {
            this._releaseGrabbedBlock();
        }

        const key = `${hit.position.x},${hit.position.y},${hit.position.z}`;
        const block = World.getBlock(hit.position.x, hit.position.y, hit.position.z);
        if (!block) return;

        this._grabbedBlock = {
            key,
            x: hit.position.x,
            y: hit.position.y,
            z: hit.position.z,
            type: block.type,
            mesh: block.mesh,
        };
        this._isGrabbing = true;

        // Give the grabbed block a yellow tint to indicate it's being held
        block.mesh.material.emissive = new THREE.Color('#FFA000');
        block.mesh.material.emissiveIntensity = 0.5;

        window.dispatchEvent(new CustomEvent('tools:block_grabbed', {
            detail: { x: hit.position.x, y: hit.position.y, z: hit.position.z },
        }));
    },

    /**
     * Release the currently grabbed block, updating its position in the block map.
     */
    _releaseGrabbedBlock() {
        if (!this._grabbedBlock) return;

        const block = this._grabbedBlock;

        // Calculate new grid position from current mesh position
        const newX = Math.round(block.mesh.position.x - 0.5);
        const newY = Math.round(block.mesh.position.y - 0.5);
        const newZ = Math.round(block.mesh.position.z - 0.5);

        // If position changed, update blockMap
        if (newX !== block.x || newY !== block.y || newZ !== block.z) {
            // Remove old entry
            delete World.blockMap[block.key];

            // Check new position isn't occupied
            const newKey = `${newX},${newY},${newZ}`;
            if (!World.blockMap[newKey]) {
                // Update block map entry
                World.blockMap[newKey] = {
                    x: newX, y: newY, z: newZ,
                    type: block.type,
                    mesh: block.mesh,
                };

                window.dispatchEvent(new CustomEvent('tools:block_moved', {
                    detail: {
                        from: { x: block.x, y: block.y, z: block.z },
                        to: { x: newX, y: newY, z: newZ },
                        type: block.type,
                    },
                }));
            } else {
                // Return to original position
                block.mesh.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
            }
        }

        // Reset emissive
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

        window.dispatchEvent(new CustomEvent('tools:block_released', {
            detail: {},
        }));
    },

    /**
     * Check if placing a block at (x,y,z) would collide with the player.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {boolean}
     */
    _wouldCollideWithPlayer(x, y, z) {
        const pPos = Player.getPosition();
        const pw = 0.3; // Half player width
        const ph = 1.8; // Player height

        return (
            x + 1 > pPos.x - pw &&
            x < pPos.x + pw &&
            y + 1 > pPos.y &&
            y < pPos.y + ph &&
            z + 1 > pPos.z - pw &&
            z < pPos.z + pw
        );
    },

    // =============================================
    // BLOCK HIGHLIGHT
    // =============================================

    /**
     * Show the block highlight based on current tool and raycast hit.
     * Call this every frame while pointer is locked.
     * @param {THREE.Vector3} rayOrigin - Camera world position
     * @param {THREE.Vector3} rayDir - Normalized camera direction
     */
    updateHighlight(rayOrigin, rayDir) {
        if (!Player.isLocked()) {
            World.removeHighlight();
            return;
        }

        const hit = World.getRaycastTarget(rayOrigin, rayDir, 8);

        if (!hit) {
            World.removeHighlight();
            return;
        }

        switch (this._currentTool) {
            case 'build':
                World.highlightBlock(hit.position, hit.normal, 'place');
                break;
            case 'delete':
                World.highlightBlock(hit.position, null, 'delete');
                break;
            case 'paint':
                World.highlightBlock(hit.position, null, 'paint');
                break;
            case 'grab':
                World.highlightBlock(hit.position, null, 'grab');
                break;
            default:
                World.removeHighlight();
        }
    },

    // =============================================
    // UI BUILDING
    // =============================================

    /**
     * Build the toolbar HTML in the #toolbar container.
     * 9 slots with colored block previews and key numbers.
     */
    buildToolbarUI() {
        this._toolbarEl = document.getElementById('toolbar');
        if (!this._toolbarEl) return;

        this._toolbarEl.innerHTML = '';
        this._slotElements = [];

        for (let i = 0; i < BV.TOOLBAR_SIZE; i++) {
            const slot = document.createElement('div');
            slot.className = 'toolbar-slot' + (i === this._activeSlot ? ' active' : '');
            slot.dataset.index = i;

            // Block color preview
            const preview = document.createElement('div');
            preview.className = 'toolbar-preview';
            const blockType = this._toolbarSlots[i];
            const config = BV.BLOCK_TYPES[blockType];
            if (config) {
                preview.style.backgroundColor = config.color;
                if (config.transparent) {
                    preview.style.opacity = config.opacity || 0.5;
                }
            }

            // Key number label
            const keyLabel = document.createElement('span');
            keyLabel.className = 'toolbar-key';
            keyLabel.textContent = (i + 1).toString();

            // Block name tooltip
            if (config) {
                slot.title = config.name;
            }

            slot.appendChild(preview);
            slot.appendChild(keyLabel);

            // Click to select slot
            slot.addEventListener('click', () => {
                if (!Player.isLocked()) {
                    this.setToolbarSlot(i);
                }
            });

            this._toolbarEl.appendChild(slot);
            this._slotElements.push(slot);
        }
    },

    /**
     * Update a single toolbar slot's visual (after changing block type).
     * @param {number} index
     */
    _updateToolbarSlotUI(index) {
        if (index < 0 || index >= this._slotElements.length) return;

        const slot = this._slotElements[index];
        const blockType = this._toolbarSlots[index];
        const config = BV.BLOCK_TYPES[blockType];
        const preview = slot.querySelector('.toolbar-preview');

        if (preview && config) {
            preview.style.backgroundColor = config.color;
            if (config.transparent) {
                preview.style.opacity = config.opacity || 0.5;
            } else {
                preview.style.opacity = 1;
            }
        }
        if (config) {
            slot.title = config.name;
        }
    },

    /**
     * Build the block type picker grid (in game menu).
     * Grid of all block types from BV.BLOCK_TYPES.
     */
    buildBlockPickerUI() {
        const container = document.getElementById('block-picker');
        if (!container) return;

        container.innerHTML = '';

        // Section title
        const title = document.createElement('div');
        title.className = 'menu-section-title';
        title.textContent = 'Block Types';
        container.appendChild(title);

        // Grid
        const grid = document.createElement('div');
        grid.className = 'block-picker-grid';

        for (const [type, config] of Object.entries(BV.BLOCK_TYPES)) {
            const item = document.createElement('div');
            item.className = 'block-picker-item' + (type === this._currentBlockType ? ' selected' : '');
            item.dataset.type = type;

            // Color swatch
            const swatch = document.createElement('div');
            swatch.className = 'block-swatch';
            swatch.style.backgroundColor = config.color;
            if (config.transparent) {
                // Show checkerboard pattern behind for transparency indication
                swatch.style.backgroundImage = 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)';
                swatch.style.backgroundSize = '8px 8px';
                swatch.style.backgroundPosition = '0 0, 0 4px, 4px -4px, -4px 0px';
                swatch.style.backgroundColor = config.color;
                swatch.style.opacity = config.opacity || 0.5;
            }

            // Name label
            const label = document.createElement('span');
            label.className = 'block-name';
            label.textContent = config.name;

            item.appendChild(swatch);
            item.appendChild(label);

            // Click to select
            item.addEventListener('click', () => {
                this.setBlockType(type);
            });

            grid.appendChild(item);
        }

        container.appendChild(grid);
    },

    /**
     * Build the paint color picker (in game menu).
     * Row of common colors for the paint tool.
     */
    buildPaintColorPicker() {
        const container = document.getElementById('paint-picker');
        if (!container) return;

        container.innerHTML = '';

        // Section title
        const title = document.createElement('div');
        title.className = 'menu-section-title';
        title.textContent = 'Paint Colors';
        container.appendChild(title);

        // Common paint colors
        const paintColors = [
            '#4CAF50', '#66BB6A', '#2E7D32',     // Greens
            '#E74C3C', '#C0392B', '#FF5722',     // Reds/Oranges
            '#2196F3', '#1A237E', '#00BCD4',     // Blues
            '#FFD700', '#FF9800', '#FFC107',     // Yellows
            '#9C27B0', '#673AB7', '#E91E63',     // Purples/Pink
            '#9E9E9E', '#607D8B', '#000000',     // Grays/Black
            '#FFFFFF', '#FAFAFA', '#795548',     // Whites/Brown
        ];

        const row = document.createElement('div');
        row.className = 'paint-color-row';

        for (const color of paintColors) {
            const swatch = document.createElement('div');
            swatch.className = 'paint-color-item' + (color === this._currentPaintColor ? ' selected' : '');
            swatch.dataset.color = color;
            swatch.style.backgroundColor = color;

            // Add border for white colors
            if (color === '#FFFFFF' || color === '#FAFAFA') {
                swatch.style.border = '2px solid #666';
            }

            swatch.addEventListener('click', () => {
                this.setPaintColor(color);
            });

            row.appendChild(swatch);
        }

        container.appendChild(row);

        // Custom color input
        const customRow = document.createElement('div');
        customRow.className = 'paint-custom-row';

        const customLabel = document.createElement('label');
        customLabel.textContent = 'Custom: ';
        customLabel.className = 'paint-custom-label';

        const customInput = document.createElement('input');
        customInput.type = 'color';
        customInput.className = 'paint-custom-input';
        customInput.value = this._currentPaintColor;
        customInput.addEventListener('input', (e) => {
            this.setPaintColor(e.target.value);
        });

        customRow.appendChild(customLabel);
        customRow.appendChild(customInput);
        container.appendChild(customRow);
    },

    /**
     * Wire up tool selection buttons in the game menu.
     * Looks for elements with class 'tool-btn' and data-tool attribute.
     */
    buildToolButtons() {
        const toolButtons = document.querySelectorAll('.tool-btn');
        if (toolButtons.length === 0) {
            // If no buttons exist in DOM yet, create them in a tools panel
            this._createToolButtonsFallback();
            return;
        }

        toolButtons.forEach(btn => {
            const tool = btn.dataset.tool;
            if (!tool) return;

            // Set initial active state
            if (tool === this._currentTool) {
                btn.classList.add('active');
            }

            // Remove old listeners by cloning
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', () => {
                this.setTool(tool);
            });
        });
    },

    /**
     * Fallback: create tool buttons if they don't exist in the DOM.
     * Adds them to #tools-panel if available.
     */
    _createToolButtonsFallback() {
        const panel = document.getElementById('tools-panel');
        if (!panel) return;

        panel.innerHTML = '';

        const title = document.createElement('div');
        title.className = 'menu-section-title';
        title.textContent = 'Tools';
        panel.appendChild(title);

        const tools = [
            { id: 'build',  name: 'Build',  icon: '🔨', key: 'B', desc: 'Place blocks' },
            { id: 'delete', name: 'Delete', icon: '🗑️', key: 'X', desc: 'Remove blocks' },
            { id: 'paint',  name: 'Paint',  icon: '🎨', key: 'P', desc: 'Paint blocks' },
            { id: 'grab',   name: 'Grab',   icon: '✋', key: 'G', desc: 'Move blocks' },
        ];

        const grid = document.createElement('div');
        grid.className = 'tools-grid';

        for (const tool of tools) {
            const btn = document.createElement('div');
            btn.className = 'tool-btn' + (tool.id === this._currentTool ? ' active' : '');
            btn.dataset.tool = tool.id;

            const icon = document.createElement('span');
            icon.className = 'tool-icon';
            icon.textContent = tool.icon;

            const name = document.createElement('span');
            name.className = 'tool-name';
            name.textContent = tool.name;

            const key = document.createElement('span');
            key.className = 'tool-key';
            key.textContent = `[${tool.key}]`;

            const desc = document.createElement('span');
            desc.className = 'tool-desc';
            desc.textContent = tool.desc;

            btn.appendChild(icon);
            btn.appendChild(name);
            btn.appendChild(key);
            btn.appendChild(desc);

            btn.addEventListener('click', () => {
                this.setTool(tool.id);
            });

            grid.appendChild(btn);
        }

        panel.appendChild(grid);
    },
};
