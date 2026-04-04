/**
 * BlockVerse Visual Node Editor
 * A Scratch-inspired visual block programming system for creating game scripts.
 * Uses HTML/CSS rendering (NOT canvas) for accessible, interactive blocks.
 */

const NodeEditor = {
    // ── State ──────────────────────────────────────────────────────────────
    _blocks: [],
    _connections: [],
    _selectedBlock: null,
    _dragOffset: { x: 0, y: 0 },
    _isDragging: false,
    _dragSource: null,          // 'workspace' | 'palette'
    _dragGhost: null,           // Ghost element during palette drag
    _palette: null,
    _customBlocks: {},
    _variables: {},
    _namedEvents: {},
    _container: null,
    _workspaceEl: null,
    _paletteEl: null,
    _propsEl: null,
    _undoStack: [],
    _redoStack: [],
    _blockIdCounter: 0,
    _zoom: 1,
    _scrollOffset: { x: 0, y: 0 },
    _activeCategory: 'events',
    _snapThreshold: 20,
    _trashZone: null,
    _isOverTrash: false,
    _clipboard: null,
    _searchQuery: '',

    // ── Block Category Definitions ─────────────────────────────────────────
    CATEGORIES: {
        events:    { label: 'Events',    color: '#4CAF50', bg: '#1a3d1a', icon: '⚡' },
        motion:    { label: 'Motion',    color: '#2196F3', bg: '#1a1a4a', icon: '🏃' },
        blocks:    { label: 'Blocks',    color: '#8D6E63', bg: '#3e2a22', icon: '🧱' },
        control:   { label: 'Control',   color: '#FF9800', bg: '#4a3210', icon: '🔄' },
        looks:     { label: 'Looks',     color: '#9C27B0', bg: '#3a1a44', icon: '👁' },
        sound:     { label: 'Sound',     color: '#E91E63', bg: '#4a1028', icon: '🔊' },
        variables: { label: 'Variables', color: '#F44336', bg: '#4a1a1a', icon: '📊' },
        custom:    { label: 'My Blocks', color: '#009688', bg: '#0a3a36', icon: '🔧' },
    },

    // ── Block Type Definitions ─────────────────────────────────────────────
    BLOCK_DEFS: {
        // Events (green)
        event_game_start:      { category: 'events', label: 'when game starts', isHat: true, params: [] },
        event_player_touches:  { category: 'events', label: 'when player touches', isHat: true, params: [{ name: 'type', type: 'select', options: ['gold', 'diamond', 'lava', 'water', 'portal', 'any'], default: 'gold' }] },
        event_block_placed:    { category: 'events', label: 'when block placed', isHat: true, params: [{ name: 'type', type: 'select', options: ['grass', 'stone', 'wood', 'gold', 'diamond', 'lava', 'water', 'sand', 'brick'], default: 'grass' }] },
        event_timer:           { category: 'events', label: 'when timer reaches', isHat: true, params: [{ name: 'seconds', type: 'number', default: '10' }] },
        event_player_joins:    { category: 'events', label: 'when player joins', isHat: true, params: [] },
        event_key_pressed:     { category: 'events', label: 'when key pressed', isHat: true, params: [{ name: 'key', type: 'select', options: ['W', 'A', 'S', 'D', 'Space', 'E', 'Q', 'R', 'F', '1', '2', '3', '4', '5'], default: 'E' }] },

        // Motion (blue)
        motion_move_to:        { category: 'motion', label: 'move player to', params: [{ name: 'x', type: 'number', default: '0' }, { name: 'y', type: 'number', default: '5' }, { name: 'z', type: 'number', default: '0' }] },
        motion_move_by:        { category: 'motion', label: 'move player by', params: [{ name: 'dx', type: 'number', default: '1' }, { name: 'dy', type: 'number', default: '0' }, { name: 'dz', type: 'number', default: '0' }] },
        motion_set_speed:      { category: 'motion', label: 'set player speed to', params: [{ name: 'speed', type: 'number', default: '16' }] },
        motion_tween_to:       { category: 'motion', label: 'tween player to', params: [{ name: 'x', type: 'number', default: '0' }, { name: 'y', type: 'number', default: '5' }, { name: 'z', type: 'number', default: '0' }, { name: 'seconds', type: 'number', default: '1' }] },

        // Blocks (brown)
        block_place:           { category: 'blocks', label: 'place block at', params: [{ name: 'x', type: 'number', default: '0' }, { name: 'y', type: 'number', default: '0' }, { name: 'z', type: 'number', default: '0' }, { name: 'type', type: 'select', options: ['grass', 'stone', 'wood', 'gold', 'diamond', 'lava', 'water', 'sand', 'brick'], default: 'stone' }] },
        block_remove:          { category: 'blocks', label: 'remove block at', params: [{ name: 'x', type: 'number', default: '0' }, { name: 'y', type: 'number', default: '0' }, { name: 'z', type: 'number', default: '0' }] },
        block_if_is:           { category: 'blocks', label: 'if block at is', hasBody: true, params: [{ name: 'x', type: 'number', default: '0' }, { name: 'y', type: 'number', default: '0' }, { name: 'z', type: 'number', default: '0' }, { name: 'type', type: 'select', options: ['grass', 'stone', 'wood', 'gold', 'diamond', 'lava', 'water', 'sand', 'brick'], default: 'gold' }] },
        block_find_all:        { category: 'blocks', label: 'find all blocks of type', params: [{ name: 'type', type: 'select', options: ['grass', 'stone', 'wood', 'gold', 'diamond', 'lava', 'water', 'sand', 'brick'], default: 'gold' }] },

        // Control (orange)
        control_wait:          { category: 'control', label: 'wait', params: [{ name: 'seconds', type: 'number', default: '1' }, { name: '_suffix', type: 'static', value: 'seconds' }] },
        control_repeat:        { category: 'control', label: 'repeat', hasBody: true, params: [{ name: 'times', type: 'number', default: '10' }, { name: '_suffix', type: 'static', value: 'times' }] },
        control_forever:       { category: 'control', label: 'forever', hasBody: true, params: [], isForever: true },
        control_if:            { category: 'control', label: 'if', hasBody: true, params: [{ name: 'condition', type: 'condition', default: '' }] },
        control_if_else:       { category: 'control', label: 'if', hasBody: true, hasElseBody: true, params: [{ name: 'condition', type: 'condition', default: '' }] },
        control_stop:          { category: 'control', label: 'stop script', params: [] },
        control_broadcast:     { category: 'control', label: 'broadcast', params: [{ name: 'event', type: 'text', default: 'my event' }] },
        control_receive:       { category: 'control', label: 'when I receive', isHat: true, params: [{ name: 'event', type: 'text', default: 'my event' }] },

        // Looks (purple)
        looks_show_hint:       { category: 'looks', label: 'show hint', params: [{ name: 'text', type: 'text', default: 'Hello!' }] },
        looks_show_score:      { category: 'looks', label: 'show score', params: [{ name: 'value', type: 'text', default: '0' }] },
        looks_show_timer:      { category: 'looks', label: 'show timer', params: [{ name: 'seconds', type: 'number', default: '60' }] },
        looks_hide_ui:         { category: 'looks', label: 'hide UI', params: [] },
        looks_sky_color:       { category: 'looks', label: 'change sky color to', params: [{ name: 'color', type: 'color', default: '#87CEEB' }] },

        // Sound (pink)
        sound_play:            { category: 'sound', label: 'play sound', params: [{ name: 'name', type: 'select', options: ['coin', 'explosion', 'jump', 'step', 'victory', 'defeat', 'alert', 'click'], default: 'coin' }] },
        sound_stop_all:        { category: 'sound', label: 'stop all sounds', params: [] },
        sound_set_volume:      { category: 'sound', label: 'set volume to', params: [{ name: 'volume', type: 'number', default: '100' }, { name: '_suffix', type: 'static', value: '%' }] },

        // Variables (red)
        var_set:               { category: 'variables', label: 'set', params: [{ name: 'variable', type: 'varName', default: 'myVar' }, { name: '_to', type: 'static', value: 'to' }, { name: 'value', type: 'text', default: '0' }] },
        var_change:            { category: 'variables', label: 'change', params: [{ name: 'variable', type: 'varName', default: 'myVar' }, { name: '_by', type: 'static', value: 'by' }, { name: 'value', type: 'number', default: '1' }] },
        var_show:              { category: 'variables', label: 'show variable', params: [{ name: 'variable', type: 'varName', default: 'myVar' }] },
        var_if_equals:         { category: 'variables', label: 'if', hasBody: true, params: [{ name: 'variable', type: 'varName', default: 'myVar' }, { name: '_eq', type: 'static', value: '=' }, { name: 'value', type: 'text', default: '0' }] },
    },

    // ── Initialization ─────────────────────────────────────────────────────

    /**
     * Initialize the node editor inside a container element.
     * @param {string} containerId - The DOM id of the container element.
     */
    init(containerId) {
        this._container = document.getElementById(containerId);
        if (!this._container) {
            console.error('[NodeEditor] Container not found:', containerId);
            return;
        }

        this._buildUI();
        this._attachGlobalListeners();
        this._loadFromStorage();
        this._renderPalette();
        this._renderWorkspace();
        console.log('[NodeEditor] Initialized.');
    },

    /**
     * Build the full UI layout: palette | workspace | properties.
     */
    _buildUI() {
        this._container.innerHTML = '';

        // Outer wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'ne-wrapper';
        wrapper.innerHTML = `
            <style>${this._getStyles()}</style>
            <div class="ne-toolbar">
                <button class="ne-toolbar-btn" id="ne-btn-undo" title="Undo (Ctrl+Z)">&#x21A9; Undo</button>
                <button class="ne-toolbar-btn" id="ne-btn-redo" title="Redo (Ctrl+Y)">&#x21AA; Redo</button>
                <div class="ne-toolbar-sep"></div>
                <button class="ne-toolbar-btn" id="ne-btn-compile" title="Compile to JavaScript">&#x25B6; Run</button>
                <button class="ne-toolbar-btn" id="ne-btn-clear" title="Clear workspace">&#x2715; Clear</button>
                <div class="ne-toolbar-sep"></div>
                <button class="ne-toolbar-btn" id="ne-btn-save" title="Save project">&#x1F4BE; Save</button>
                <button class="ne-toolbar-btn" id="ne-btn-load" title="Load project">&#x1F4C2; Load</button>
                <div class="ne-toolbar-sep"></div>
                <button class="ne-toolbar-btn" id="ne-btn-new-var" title="Create variable">+ Variable</button>
                <button class="ne-toolbar-btn" id="ne-btn-zoom-in" title="Zoom in">🔍+</button>
                <button class="ne-toolbar-btn" id="ne-btn-zoom-out" title="Zoom out">🔍-</button>
            </div>
            <div class="ne-body">
                <div class="ne-palette" id="ne-palette"></div>
                <div class="ne-workspace-container">
                    <div class="ne-workspace" id="ne-workspace">
                        <div class="ne-workspace-grid" id="ne-workspace-grid"></div>
                    </div>
                    <div class="ne-trash-zone" id="ne-trash-zone">&#x1F5D1; Drop here to delete</div>
                </div>
                <div class="ne-properties" id="ne-properties">
                    <div class="ne-props-title">Properties</div>
                    <div class="ne-props-body" id="ne-props-body">
                        <p class="ne-props-empty">Select a block to view its properties.</p>
                    </div>
                </div>
            </div>
            <div class="ne-statusbar" id="ne-statusbar">Ready &mdash; Blocks: 0</div>
        `;
        this._container.appendChild(wrapper);

        // Cache elements
        this._paletteEl = document.getElementById('ne-palette');
        this._workspaceEl = document.getElementById('ne-workspace');
        this._propsEl = document.getElementById('ne-props-body');
        this._trashZone = document.getElementById('ne-trash-zone');

        // Toolbar listeners
        document.getElementById('ne-btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('ne-btn-redo').addEventListener('click', () => this.redo());
        document.getElementById('ne-btn-compile').addEventListener('click', () => this.compile());
        document.getElementById('ne-btn-clear').addEventListener('click', () => this.clearWorkspace());
        document.getElementById('ne-btn-save').addEventListener('click', () => this._saveToStorage());
        document.getElementById('ne-btn-load').addEventListener('click', () => this._loadFromStorage());
        document.getElementById('ne-btn-new-var').addEventListener('click', () => this._promptNewVariable());
        document.getElementById('ne-btn-zoom-in').addEventListener('click', () => this._zoomBy(0.1));
        document.getElementById('ne-btn-zoom-out').addEventListener('click', () => this._zoomBy(-0.1));
    },

    // ── CSS Styles ─────────────────────────────────────────────────────────

    _getStyles() {
        return `
        /* ── Reset & Layout ───────────────────────────────────────── */
        .ne-wrapper {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            font-size: 13px;
            color: #e0e0e0;
            overflow: hidden;
            background: #0d0d1a;
        }

        .ne-toolbar {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 12px;
            background: #16162b;
            border-bottom: 1px solid #2a2a44;
            flex-shrink: 0;
            z-index: 100;
            overflow-x: auto;
        }
        .ne-toolbar-btn {
            padding: 4px 10px;
            background: #1e1e38;
            border: 1px solid #3a3a5c;
            border-radius: 6px;
            color: #ccc;
            font-size: 12px;
            cursor: pointer;
            white-space: nowrap;
            transition: background 0.15s, color 0.15s;
        }
        .ne-toolbar-btn:hover {
            background: #2a2a50;
            color: #fff;
        }
        .ne-toolbar-sep {
            width: 1px;
            height: 20px;
            background: #3a3a5c;
            margin: 0 4px;
        }

        .ne-body {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        /* ── Palette ──────────────────────────────────────────────── */
        .ne-palette {
            width: 220px;
            flex-shrink: 0;
            background: #12122a;
            border-right: 1px solid #2a2a44;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .ne-palette-search {
            padding: 8px;
            border-bottom: 1px solid #2a2a44;
        }
        .ne-palette-search input {
            width: 100%;
            box-sizing: border-box;
            padding: 5px 8px;
            background: #1a1a36;
            border: 1px solid #3a3a5c;
            border-radius: 6px;
            color: #e0e0e0;
            font-size: 12px;
            outline: none;
        }
        .ne-palette-search input:focus {
            border-color: #6a6aac;
        }
        .ne-palette-categories {
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
            padding: 6px 8px;
            border-bottom: 1px solid #2a2a44;
        }
        .ne-cat-btn {
            padding: 3px 8px;
            border: 1px solid transparent;
            border-radius: 12px;
            font-size: 11px;
            cursor: pointer;
            background: #1e1e38;
            color: #aaa;
            transition: all 0.15s;
        }
        .ne-cat-btn:hover, .ne-cat-btn.active {
            color: #fff;
            border-color: currentColor;
        }
        .ne-palette-blocks {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
        }
        .ne-palette-blocks::-webkit-scrollbar { width: 6px; }
        .ne-palette-blocks::-webkit-scrollbar-track { background: transparent; }
        .ne-palette-blocks::-webkit-scrollbar-thumb { background: #3a3a5c; border-radius: 3px; }

        .ne-palette-item {
            padding: 6px 10px;
            margin-bottom: 4px;
            border-radius: 6px;
            cursor: grab;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: transform 0.1s, box-shadow 0.1s;
            border-left: 4px solid;
            user-select: none;
        }
        .ne-palette-item:hover {
            transform: translateX(2px);
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }

        /* ── Workspace ────────────────────────────────────────────── */
        .ne-workspace-container {
            flex: 1;
            position: relative;
            overflow: hidden;
        }
        .ne-workspace {
            position: absolute;
            top: 0; left: 0;
            width: 4000px;
            height: 4000px;
            transform-origin: 0 0;
        }
        .ne-workspace-grid {
            position: absolute;
            top: 0; left: 0;
            width: 100%;
            height: 100%;
            background-image:
                radial-gradient(circle, #2a2a44 1px, transparent 1px);
            background-size: 24px 24px;
            pointer-events: none;
            opacity: 0.5;
        }

        .ne-trash-zone {
            position: absolute;
            bottom: 12px;
            left: 50%;
            transform: translateX(-50%);
            padding: 8px 20px;
            background: rgba(180, 40, 40, 0.15);
            border: 2px dashed #b42828;
            border-radius: 10px;
            color: #ff6b6b;
            font-size: 12px;
            font-weight: 600;
            opacity: 0;
            transition: opacity 0.2s, background 0.2s;
            pointer-events: none;
            z-index: 200;
        }
        .ne-trash-zone.visible {
            opacity: 1;
        }
        .ne-trash-zone.hover {
            opacity: 1;
            background: rgba(180, 40, 40, 0.35);
            transform: translateX(-50%) scale(1.05);
        }

        /* ── Block ────────────────────────────────────────────────── */
        .ne-block {
            position: absolute;
            min-width: 180px;
            max-width: 420px;
            padding: 8px 12px;
            border-radius: 8px;
            cursor: grab;
            user-select: none;
            font-family: 'Segoe UI', system-ui, sans-serif;
            font-size: 13px;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            transition: transform 0.1s, box-shadow 0.15s;
            border-left: 4px solid;
            z-index: 10;
        }
        .ne-block:hover {
            transform: scale(1.02);
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            z-index: 20;
        }
        .ne-block.selected {
            outline: 2px solid #fff;
            outline-offset: 1px;
            z-index: 30;
        }
        .ne-block.dragging {
            cursor: grabbing;
            opacity: 0.85;
            z-index: 1000;
            box-shadow: 0 8px 24px rgba(0,0,0,0.6);
        }

        /* Notch & bump */
        .ne-block-hat::before {
            content: '';
            position: absolute;
            top: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 40px;
            height: 10px;
            background: inherit;
            border-radius: 10px 10px 0 0;
            border-left: inherit;
            border-right: none;
        }
        .ne-block::after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 16px;
            height: 8px;
            background: inherit;
            border-radius: 0 0 8px 8px;
        }
        .ne-block.no-notch::after { display: none; }

        /* Category colors */
        .ne-block.cat-events    { background: #1a3d1a; border-left-color: #4CAF50; color: #a5d6a7; }
        .ne-block.cat-motion    { background: #1a1a4a; border-left-color: #2196F3; color: #90caf9; }
        .ne-block.cat-blocks    { background: #3e2a22; border-left-color: #8D6E63; color: #bcaaa4; }
        .ne-block.cat-control   { background: #4a3210; border-left-color: #FF9800; color: #ffcc80; }
        .ne-block.cat-looks     { background: #3a1a44; border-left-color: #9C27B0; color: #ce93d8; }
        .ne-block.cat-sound     { background: #4a1028; border-left-color: #E91E63; color: #f48fb1; }
        .ne-block.cat-variables { background: #4a1a1a; border-left-color: #F44336; color: #ef9a9a; }
        .ne-block.cat-custom    { background: #0a3a36; border-left-color: #009688; color: #80cbc4; }

        /* Block inputs */
        .ne-block-label {
            white-space: nowrap;
            font-weight: 500;
        }
        .ne-block-input {
            background: rgba(0,0,0,0.35);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 4px;
            padding: 2px 6px;
            color: #fff;
            font-size: 12px;
            font-family: 'Consolas', 'Courier New', monospace;
            outline: none;
            min-width: 36px;
            transition: border-color 0.15s;
        }
        .ne-block-input:focus {
            border-color: rgba(255,255,255,0.4);
        }
        .ne-block-input.wide { min-width: 80px; }
        .ne-block-select {
            background: rgba(0,0,0,0.35);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 4px;
            padding: 2px 4px;
            color: #fff;
            font-size: 12px;
            outline: none;
            cursor: pointer;
        }
        .ne-block-color-input {
            width: 28px;
            height: 22px;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 4px;
            cursor: pointer;
            background: transparent;
            padding: 0;
        }
        .ne-block-static {
            color: #888;
            font-size: 12px;
            font-style: italic;
        }

        /* Delete button */
        .ne-block-delete {
            position: absolute;
            top: -8px;
            right: -8px;
            width: 20px;
            height: 20px;
            background: #d32f2f;
            border: 2px solid #0d0d1a;
            border-radius: 50%;
            color: #fff;
            font-size: 11px;
            line-height: 16px;
            text-align: center;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.15s;
            z-index: 50;
        }
        .ne-block:hover .ne-block-delete {
            opacity: 1;
        }

        /* Body wrapper (for if/repeat blocks) */
        .ne-block-body {
            width: calc(100% + 4px);
            margin-left: -2px;
            margin-top: 6px;
            padding: 6px 4px 4px 16px;
            border-left: 3px solid rgba(255,255,255,0.15);
            border-radius: 0 0 6px 6px;
            min-height: 36px;
            position: relative;
        }
        .ne-block-body.ne-else-body {
            border-top: 1px solid rgba(255,255,255,0.1);
            margin-top: 4px;
            padding-top: 8px;
        }
        .ne-block-body-label {
            position: absolute;
            top: -1px;
            left: 4px;
            font-size: 10px;
            color: #888;
            background: inherit;
            padding: 0 4px;
            line-height: 1;
        }

        /* ── Properties Panel ─────────────────────────────────────── */
        .ne-properties {
            width: 240px;
            flex-shrink: 0;
            background: #12122a;
            border-left: 1px solid #2a2a44;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .ne-props-title {
            padding: 10px 12px;
            font-weight: 600;
            font-size: 13px;
            border-bottom: 1px solid #2a2a44;
            color: #aaa;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .ne-props-body {
            flex: 1;
            padding: 12px;
            overflow-y: auto;
        }
        .ne-props-body::-webkit-scrollbar { width: 6px; }
        .ne-props-body::-webkit-scrollbar-track { background: transparent; }
        .ne-props-body::-webkit-scrollbar-thumb { background: #3a3a5c; border-radius: 3px; }
        .ne-props-empty {
            color: #666;
            font-size: 12px;
            font-style: italic;
        }
        .ne-props-field {
            margin-bottom: 10px;
        }
        .ne-props-label {
            font-size: 11px;
            color: #888;
            margin-bottom: 3px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        .ne-props-value {
            width: 100%;
            box-sizing: border-box;
            padding: 5px 8px;
            background: #1a1a36;
            border: 1px solid #3a3a5c;
            border-radius: 6px;
            color: #e0e0e0;
            font-size: 12px;
            outline: none;
            font-family: 'Consolas', monospace;
        }
        .ne-props-value:focus {
            border-color: #6a6aac;
        }
        .ne-props-category {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 600;
        }

        /* ── Status Bar ───────────────────────────────────────────── */
        .ne-statusbar {
            padding: 4px 12px;
            background: #16162b;
            border-top: 1px solid #2a2a44;
            font-size: 11px;
            color: #666;
            flex-shrink: 0;
        }

        /* ── Zoom label ───────────────────────────────────────────── */
        .ne-zoom-label {
            font-size: 11px;
            color: #888;
            margin-left: auto;
        }
        `;
    },

    // ── Global Event Listeners ─────────────────────────────────────────────

    _attachGlobalListeners() {
        // Mouse events for dragging blocks
        document.addEventListener('mousemove', (e) => this._onMouseMove(e));
        document.addEventListener('mouseup', (e) => this._onMouseUp(e));

        // Workspace scrolling via middle-click or shift+wheel
        this._workspaceEl.addEventListener('wheel', (e) => {
            if (e.shiftKey || e.ctrlKey) {
                e.preventDefault();
                if (e.ctrlKey) {
                    const delta = e.deltaY > 0 ? -0.05 : 0.05;
                    this._zoomBy(delta);
                } else {
                    this._scrollOffset.x -= e.deltaX;
                    this._scrollOffset.y -= e.deltaY;
                    this._updateWorkspaceTransform();
                }
            }
        }, { passive: false });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) this.redo(); else this.undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this._selectedBlock) {
                    this.removeBlock(this._selectedBlock);
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (this._selectedBlock) this._copyBlock(this._selectedBlock);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                this._pasteBlock();
            }
        });

        // Click workspace to deselect
        this._workspaceEl.addEventListener('mousedown', (e) => {
            if (e.target === this._workspaceEl || e.target.id === 'ne-workspace-grid') {
                this._selectBlock(null);
            }
        });
    },

    // ── Palette Rendering ──────────────────────────────────────────────────

    _renderPalette() {
        this._paletteEl.innerHTML = '';

        // Search
        const searchDiv = document.createElement('div');
        searchDiv.className = 'ne-palette-search';
        searchDiv.innerHTML = `<input type="text" id="ne-search" placeholder="Search blocks..." value="${this._searchQuery}">`;
        this._paletteEl.appendChild(searchDiv);
        searchDiv.querySelector('input').addEventListener('input', (e) => {
            this._searchQuery = e.target.value.toLowerCase();
            this._renderPalette();
        });

        // Category tabs
        const catDiv = document.createElement('div');
        catDiv.className = 'ne-palette-categories';
        for (const [catId, cat] of Object.entries(this.CATEGORIES)) {
            const btn = document.createElement('button');
            btn.className = 'ne-cat-btn' + (this._activeCategory === catId ? ' active' : '');
            btn.textContent = cat.icon + ' ' + cat.label;
            btn.style.color = cat.color;
            if (this._activeCategory === catId) btn.style.borderColor = cat.color;
            btn.addEventListener('click', () => {
                this._activeCategory = catId;
                this._renderPalette();
            });
            catDiv.appendChild(btn);
        }
        this._paletteEl.appendChild(catDiv);

        // Block list
        const blocksDiv = document.createElement('div');
        blocksDiv.className = 'ne-palette-blocks';

        const filteredBlocks = Object.entries(this.BLOCK_DEFS)
            .filter(([id, def]) => {
                const matchCategory = def.category === this._activeCategory;
                const matchSearch = !this._searchQuery ||
                    def.label.toLowerCase().includes(this._searchQuery) ||
                    id.toLowerCase().includes(this._searchQuery);
                return matchCategory && matchSearch;
            });

        // Add custom blocks to the custom category
        let customEntries = [];
        if (this._activeCategory === 'custom') {
            customEntries = Object.values(this._customBlocks).map(cb => ({
                id: 'custom_' + cb.id,
                def: {
                    category: 'custom',
                    label: cb.name,
                    isHat: false,
                    params: cb.inputs.map(inp => ({
                        name: inp.name,
                        type: inp.type === 'number' ? 'number' : 'text',
                        default: inp.default || '0',
                    })),
                    isCustom: true,
                    customId: cb.id,
                },
            }));
        }

        const allItems = [
            ...filteredBlocks.map(([id, def]) => ({ id, def })),
            ...customEntries,
        ];

        for (const item of allItems) {
            const cat = this.CATEGORIES[item.def.category];
            const el = document.createElement('div');
            el.className = 'ne-palette-item';
            el.style.borderLeftColor = cat.color;
            el.style.background = cat.bg;
            el.style.color = cat.color;
            el.textContent = (cat.icon + ' ' + item.def.label);
            el.dataset.blockType = item.id;

            if (item.def.isCustom) {
                el.dataset.customId = item.def.customId;
            }

            // Drag start from palette
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this._startPaletteDrag(e, item.id, item.def);
            });

            blocksDiv.appendChild(el);
        }

        if (allItems.length === 0) {
            blocksDiv.innerHTML = '<p style="color:#555;font-size:11px;text-align:center;padding:20px;">No blocks found.</p>';
        }

        this._paletteEl.appendChild(blocksDiv);
    },

    // ── Palette Drag ───────────────────────────────────────────────────────

    _startPaletteDrag(e, blockType, blockDef) {
        this._dragSource = 'palette';
        this._isDragging = true;

        // Create ghost element
        const ghost = this._createBlockElement({
            id: '__drag_ghost__',
            type: blockType,
            category: blockDef.category,
            label: blockDef.label,
            params: {},
            children: [],
            next: null,
            x: 0, y: 0,
            isHat: blockDef.isHat,
            hasBody: blockDef.hasBody,
            hasElseBody: blockDef.hasElseBody,
            isCustom: blockDef.isCustom,
            customId: blockDef.customId,
        });
        ghost.style.position = 'fixed';
        ghost.style.left = (e.clientX - 90) + 'px';
        ghost.style.top = (e.clientY - 18) + 'px';
        ghost.style.zIndex = '10000';
        ghost.style.pointerEvents = 'none';
        ghost.style.opacity = '0.85';
        ghost.classList.add('dragging');
        document.body.appendChild(ghost);
        this._dragGhost = ghost;

        // Store metadata for drop
        this._dragMeta = { blockType, blockDef };

        this._trashZone.classList.add('visible');
    },

    // ── Mouse Move ─────────────────────────────────────────────────────────

    _onMouseMove(e) {
        if (!this._isDragging) return;

        if (this._dragSource === 'palette' && this._dragGhost) {
            this._dragGhost.style.left = (e.clientX - 90) + 'px';
            this._dragGhost.style.top = (e.clientY - 18) + 'px';
        } else if (this._dragSource === 'workspace' && this._selectedBlock) {
            const wsRect = this._workspaceEl.getBoundingClientRect();
            const x = (e.clientX - wsRect.left) / this._zoom + this._scrollOffset.x - this._dragOffset.x;
            const y = (e.clientY - wsRect.top) / this._zoom + this._scrollOffset.y - this._dragOffset.y;

            const block = this._getBlock(this._selectedBlock);
            if (block) {
                block.x = x;
                block.y = y;
                this._updateBlockPosition(this._selectedBlock);
            }
        }

        // Trash zone hover detection
        if (this._trashZone) {
            const trashRect = this._trashZone.getBoundingClientRect();
            const over = e.clientX >= trashRect.left && e.clientX <= trashRect.right &&
                         e.clientY >= trashRect.top && e.clientY <= trashRect.bottom;
            this._trashZone.classList.toggle('hover', over);
            this._isOverTrash = over;
        }
    },

    // ── Mouse Up ───────────────────────────────────────────────────────────

    _onMouseUp(e) {
        if (!this._isDragging) return;
        this._isDragging = false;

        // Clean up trash zone
        if (this._trashZone) {
            this._trashZone.classList.remove('visible', 'hover');
        }

        if (this._dragSource === 'palette') {
            // Remove ghost
            if (this._dragGhost) {
                this._dragGhost.remove();
                this._dragGhost = null;
            }

            // Check if dropped over trash (ignore for palette items)
            if (this._isOverTrash) {
                this._isOverTrash = false;
                this._dragMeta = null;
                return;
            }

            // Check if dropped on workspace
            const wsRect = this._workspaceEl.getBoundingClientRect();
            if (e.clientX >= wsRect.left && e.clientX <= wsRect.right &&
                e.clientY >= wsRect.top && e.clientY <= wsRect.bottom) {
                const x = (e.clientX - wsRect.left) / this._zoom + this._scrollOffset.x - 90;
                const y = (e.clientY - wsRect.top) / this._zoom + this._scrollOffset.y - 18;
                this.addBlock(this._dragMeta.blockType, {}, x, y, this._dragMeta.blockDef);
            }
            this._dragMeta = null;
        } else if (this._dragSource === 'workspace') {
            // Delete if over trash
            if (this._isOverTrash && this._selectedBlock) {
                this.removeBlock(this._selectedBlock);
            }
            this._isOverTrash = false;

            // Snap check
            if (this._selectedBlock) {
                this._snapBlock(this._selectedBlock);
            }
        }

        this._dragSource = null;
    },

    // ── Block Management ───────────────────────────────────────────────────

    /**
     * Generate a unique block ID.
     */
    _genId() {
        this._blockIdCounter++;
        return 'block_' + Date.now() + '_' + this._blockIdCounter;
    },

    /**
     * Add a new block to the workspace.
     */
    addBlock(type, params, x, y, overrideDef) {
        const def = overrideDef || this.BLOCK_DEFS[type];
        if (!def) {
            console.warn('[NodeEditor] Unknown block type:', type);
            return null;
        }

        const block = {
            id: this._genId(),
            type: type,
            category: def.category,
            label: def.label,
            params: { ...params },
            children: [],
            next: null,
            x: x || 100,
            y: y || 100,
            isHat: def.isHat || false,
            hasBody: def.hasBody || false,
            hasElseBody: def.hasElseBody || false,
            isForever: def.isForever || false,
            isCustom: def.isCustom || false,
            customId: def.customId || null,
        };

        // Initialize params from defaults
        for (const p of def.params) {
            if (p.type !== 'static' && !(p.name in block.params)) {
                block.params[p.name] = p.default || '';
            }
        }

        this._pushUndo('addBlock', { blockId: block.id, blockData: { ...block } });
        this._blocks.push(block);
        this._renderBlock(block);
        this._updateStatus();
        this._selectBlock(block.id);
        return block;
    },

    /**
     * Remove a block and all connected children/next blocks.
     */
    removeBlock(blockId) {
        const block = this._getBlock(blockId);
        if (!block) return;

        // Collect all blocks to remove (this block + its chain)
        const toRemove = new Set();
        const collect = (id) => {
            toRemove.add(id);
            const b = this._getBlock(id);
            if (!b) return;
            if (b.next) collect(b.next);
            for (const childId of b.children) collect(childId);
            if (b.elseChildren) for (const childId of b.elseChildren) collect(childId);
        };
        collect(blockId);

        // Disconnect from parent
        this._disconnectFromParents(blockId);

        // Store undo data
        const removedBlocks = [];
        for (const id of toRemove) {
            const b = this._getBlock(id);
            if (b) removedBlocks.push({ ...b });
        }
        this._pushUndo('removeBlock', { blockId, removedBlocks });

        // Remove DOM elements
        for (const id of toRemove) {
            const el = document.getElementById(id);
            if (el) el.remove();
        }

        // Remove from data
        this._blocks = this._blocks.filter(b => !toRemove.has(b.id));

        if (this._selectedBlock === blockId) {
            this._selectBlock(null);
        }
        this._updateStatus();
    },

    /**
     * Move a block to new coordinates.
     */
    moveBlock(blockId, x, y) {
        const block = this._getBlock(blockId);
        if (!block) return;
        block.x = x;
        block.y = y;
        this._updateBlockPosition(blockId);
    },

    /**
     * Connect a child block below a parent block (sequential connection).
     */
    connectBlocks(parentId, childId) {
        const parent = this._getBlock(parentId);
        const child = this._getBlock(childId);
        if (!parent || !child) return;

        // Disconnect child from any previous parent
        this._disconnectFromParents(childId);

        this._pushUndo('connectBlocks', { parentId, childId, oldNext: parent.next });
        parent.next = childId;

        // Position child below parent
        const parentEl = document.getElementById(parentId);
        if (parentEl) {
            child.x = parent.x;
            child.y = parent.y + parentEl.offsetHeight + 12;
            this._updateBlockPosition(childId);
        }
    },

    /**
     * Add a child block into the body of a parent (for if/repeat blocks).
     */
    connectToBody(parentId, childId, bodySlot) {
        const parent = this._getBlock(parentId);
        const child = this._getBlock(childId);
        if (!parent || !child) return;

        this._disconnectFromParents(childId);
        this._pushUndo('connectToBody', { parentId, childId, bodySlot });

        if (bodySlot === 'else') {
            if (!parent.elseChildren) parent.elseChildren = [];
            parent.elseChildren.push(childId);
        } else {
            parent.children.push(childId);
        }

        // Render body if needed
        this._renderBlockBody(parent, bodySlot);
        this._updateStatus();
    },

    /**
     * Disconnect a block from its parent.
     */
    disconnectBlocks(blockId) {
        this._disconnectFromParents(blockId);
    },

    /**
     * Internal: disconnect block from any parent reference.
     */
    _disconnectFromParents(blockId) {
        for (const b of this._blocks) {
            if (b.next === blockId) {
                b.next = null;
            }
            b.children = b.children.filter(id => id !== blockId);
            if (b.elseChildren) {
                b.elseChildren = b.elseChildren.filter(id => id !== blockId);
            }
        }
    },

    /**
     * Get a block by ID.
     */
    _getBlock(id) {
        return this._blocks.find(b => b.id === id) || null;
    },

    // ── Block Rendering ────────────────────────────────────────────────────

    /**
     * Render the entire workspace (all blocks).
     */
    _renderWorkspace() {
        // Remove all existing block elements
        this._workspaceEl.querySelectorAll('.ne-block').forEach(el => el.remove());

        // Re-render all blocks
        for (const block of this._blocks) {
            this._renderBlock(block);
        }
        this._updateWorkspaceTransform();
    },

    /**
     * Render a single block on the workspace.
     */
    _renderBlock(block) {
        const el = this._createBlockElement(block);
        this._workspaceEl.appendChild(el);

        // Render children inside body
        if (block.hasBody || block.hasElseBody) {
            this._renderBlockBody(block);
        }
    },

    /**
     * Create the DOM element for a block (without children).
     */
    _createBlockElement(block) {
        const def = this.BLOCK_DEFS[block.type];
        const catId = block.category;
        const cat = this.CATEGORIES[catId];

        const el = document.createElement('div');
        el.id = block.id;
        el.className = 'ne-block cat-' + catId;
        if (block.isHat) el.classList.add('ne-block-hat');
        if (!block.next && !block.hasBody && !block.hasElseBody) el.classList.add('no-notch');
        if (block.isCustom) el.classList.add('cat-custom');
        el.style.left = block.x + 'px';
        el.style.top = block.y + 'px';

        // Label
        const labelSpan = document.createElement('span');
        labelSpan.className = 'ne-block-label';
        labelSpan.textContent = cat.icon + ' ' + block.label;
        el.appendChild(labelSpan);

        // Parameters
        const params = def ? def.params : [];
        for (const p of params) {
            if (p.type === 'static') {
                const staticEl = document.createElement('span');
                staticEl.className = 'ne-block-static';
                staticEl.textContent = ' ' + p.value;
                el.appendChild(staticEl);
            } else {
                const input = this._createParamInput(block, p);
                if (input) el.appendChild(input);
            }
        }

        // Delete button
        const delBtn = document.createElement('div');
        delBtn.className = 'ne-block-delete';
        delBtn.textContent = 'x';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeBlock(block.id);
        });
        el.appendChild(delBtn);

        // Drag handler
        el.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            if (e.target.classList.contains('ne-block-delete')) return;
            e.preventDefault();
            this._startWorkspaceDrag(e, block.id);
        });

        // Click to select
        el.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            if (e.target.classList.contains('ne-block-delete')) return;
            this._selectBlock(block.id);
        });

        return el;
    },

    /**
     * Create an input element for a block parameter.
     */
    _createParamInput(block, paramDef) {
        const value = block.params[paramDef.name] || paramDef.default || '';

        if (paramDef.type === 'number') {
            const input = document.createElement('input');
            input.className = 'ne-block-input';
            input.type = 'number';
            input.value = value;
            input.style.width = '52px';
            input.addEventListener('change', (e) => {
                block.params[paramDef.name] = e.target.value;
                this._onParamChange(block, paramDef.name, e.target.value);
            });
            input.addEventListener('mousedown', (e) => e.stopPropagation());
            return input;
        }

        if (paramDef.type === 'text') {
            const input = document.createElement('input');
            input.className = 'ne-block-input wide';
            input.type = 'text';
            input.value = value;
            input.addEventListener('change', (e) => {
                block.params[paramDef.name] = e.target.value;
                this._onParamChange(block, paramDef.name, e.target.value);
            });
            input.addEventListener('mousedown', (e) => e.stopPropagation());
            return input;
        }

        if (paramDef.type === 'select') {
            const select = document.createElement('select');
            select.className = 'ne-block-select';
            for (const opt of paramDef.options) {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                if (opt === value) option.selected = true;
                select.appendChild(option);
            }
            select.addEventListener('change', (e) => {
                block.params[paramDef.name] = e.target.value;
                this._onParamChange(block, paramDef.name, e.target.value);
            });
            select.addEventListener('mousedown', (e) => e.stopPropagation());
            return select;
        }

        if (paramDef.type === 'color') {
            const input = document.createElement('input');
            input.className = 'ne-block-color-input';
            input.type = 'color';
            input.value = value || '#87CEEB';
            input.addEventListener('change', (e) => {
                block.params[paramDef.name] = e.target.value;
                this._onParamChange(block, paramDef.name, e.target.value);
            });
            input.addEventListener('mousedown', (e) => e.stopPropagation());
            return input;
        }

        if (paramDef.type === 'condition') {
            const input = document.createElement('input');
            input.className = 'ne-block-input wide';
            input.type = 'text';
            input.value = value;
            input.placeholder = 'condition...';
            input.addEventListener('change', (e) => {
                block.params[paramDef.name] = e.target.value;
                this._onParamChange(block, paramDef.name, e.target.value);
            });
            input.addEventListener('mousedown', (e) => e.stopPropagation());
            return input;
        }

        if (paramDef.type === 'varName') {
            const select = document.createElement('select');
            select.className = 'ne-block-select';
            const varNames = Object.keys(this._variables);
            for (const v of varNames) {
                const option = document.createElement('option');
                option.value = v;
                option.textContent = v;
                if (v === value) option.selected = true;
                select.appendChild(option);
            }
            // Add "New variable..." option
            const newOpt = document.createElement('option');
            newOpt.value = '__new__';
            newOpt.textContent = '+ New...';
            select.appendChild(newOpt);

            select.addEventListener('change', (e) => {
                if (e.target.value === '__new__') {
                    const name = prompt('Variable name:');
                    if (name && name.trim()) {
                        this._variables[name.trim()] = 0;
                        block.params[paramDef.name] = name.trim();
                        this._renderBlock(block);
                        // Re-render entire workspace to update all variable selects
                        this._renderWorkspace();
                    }
                } else {
                    block.params[paramDef.name] = e.target.value;
                    this._onParamChange(block, paramDef.name, e.target.value);
                }
            });
            select.addEventListener('mousedown', (e) => e.stopPropagation());
            return select;
        }

        return null;
    },

    /**
     * Handle parameter change on a block.
     */
    _onParamChange(block, paramName, value) {
        this._pushUndo('paramChange', { blockId: block.id, paramName, oldValue: block.params[paramName], newValue: value });
        // Update properties panel if this block is selected
        if (this._selectedBlock === block.id) {
            this._renderProperties(block);
        }
    },

    /**
     * Render the body (children) of a block that has hasBody or hasElseBody.
     */
    _renderBlockBody(block, onlySlot) {
        const el = document.getElementById(block.id);
        if (!el) return;

        // Remove existing body elements
        el.querySelectorAll('.ne-block-body').forEach(b => b.remove());

        const createBodySlot = (childIds, label, slotClass) => {
            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'ne-block-body ' + slotClass;

            const bodyLabel = document.createElement('span');
            bodyLabel.className = 'ne-block-body-label';
            bodyLabel.textContent = label;
            bodyDiv.appendChild(bodyLabel);

            for (const childId of childIds) {
                const child = this._getBlock(childId);
                if (child) {
                    const childEl = this._createBlockElement(child);
                    childEl.style.position = 'relative';
                    childEl.style.left = '0';
                    childEl.style.top = '0';
                    childEl.style.marginBottom = '4px';
                    bodyDiv.appendChild(childEl);

                    // Render child's body if applicable
                    if (child.hasBody || child.hasElseBody) {
                        this._renderBlockBody(child);
                    }
                }
            }

            // Drop zone: detect drop onto empty body
            bodyDiv.addEventListener('mouseup', (e) => {
                if (this._isDragging && this._dragSource === 'workspace' && this._selectedBlock) {
                    // Dropped into body
                    const dragId = this._selectedBlock;
                    this._disconnectFromParents(dragId);
                    this.connectToBody(block.id, dragId, slotClass === 'ne-else-body' ? 'else' : 'main');
                    e.stopPropagation();
                }
            });

            return bodyDiv;
        };

        if (block.hasBody || block.children.length > 0) {
            const slot = onlySlot === 'else' ? null : createBodySlot(block.children, 'do', '');
            if (slot) el.appendChild(slot);
        }

        if (block.hasElseBody && block.elseChildren) {
            const elseSlot = createBodySlot(block.elseChildren, 'else', 'ne-else-body');
            el.appendChild(elseSlot);
        }
    },

    /**
     * Update a block's position on the workspace.
     */
    _updateBlockPosition(blockId) {
        const block = this._getBlock(blockId);
        const el = document.getElementById(blockId);
        if (!block || !el) return;

        el.style.left = block.x + 'px';
        el.style.top = block.y + 'px';
    },

    // ── Workspace Drag ─────────────────────────────────────────────────────

    _startWorkspaceDrag(e, blockId) {
        this._dragSource = 'workspace';
        this._isDragging = true;
        this._selectBlock(blockId);

        const block = this._getBlock(blockId);
        if (!block) return;

        const wsRect = this._workspaceEl.getBoundingClientRect();
        const blockScreenX = (block.x - this._scrollOffset.x) * this._zoom + wsRect.left;
        const blockScreenY = (block.y - this._scrollOffset.y) * this._zoom + wsRect.top;

        this._dragOffset = {
            x: e.clientX - blockScreenX,
            y: e.clientY - blockScreenY,
        };

        // Visual feedback
        const el = document.getElementById(blockId);
        if (el) el.classList.add('dragging');

        this._trashZone.classList.add('visible');
    },

    // ── Snapping ───────────────────────────────────────────────────────────

    /**
     * Snap a block to nearby connection points.
     */
    _snapBlock(blockId) {
        const block = this._getBlock(blockId);
        if (!block) return;

        const el = document.getElementById(blockId);
        if (!el) return;

        const blockCx = block.x + el.offsetWidth / 2;
        const blockCy = block.y;
        const threshold = this._snapThreshold;

        let bestDist = Infinity;
        let bestTarget = null;
        let bestType = null; // 'next' or 'body'

        for (const other of this._blocks) {
            if (other.id === blockId) continue;
            const otherEl = document.getElementById(other.id);
            if (!otherEl) continue;

            // Check bottom notch of other → top bump of this block (sequential snap)
            if (!block.isHat) {
                const notchX = other.x + otherEl.offsetWidth / 2;
                const notchY = other.y + otherEl.offsetHeight + 8; // bottom of other + notch height

                // Only snap if other doesn't already have a next block
                if (!other.next) {
                    const dist = Math.sqrt((blockCx - notchX) ** 2 + (blockCy - notchY) ** 2);
                    if (dist < threshold && dist < bestDist) {
                        bestDist = dist;
                        bestTarget = other;
                        bestType = 'next';
                    }
                }
            }

            // Check if block is near a body area of a hasBody block
            if (other.hasBody || other.hasElseBody) {
                const bodyArea = el.parentElement;
                if (bodyArea && bodyArea.classList.contains('ne-block-body')) {
                    // Already in a body, skip
                    continue;
                }

                // Check distance to other block's body area
                const otherBodyEl = otherEl.querySelector('.ne-block-body');
                if (otherBodyEl) {
                    const bodyRect = otherBodyEl.getBoundingClientRect();
                    const wsRect = this._workspaceEl.getBoundingClientRect();
                    const bodyCx = (bodyRect.left + bodyRect.width / 2 - wsRect.left) / this._zoom + this._scrollOffset.x;
                    const bodyTop = (bodyRect.top + 16 - wsRect.top) / this._zoom + this._scrollOffset.y;

                    const dist = Math.sqrt((blockCx - bodyCx) ** 2 + (blockCy - bodyTop) ** 2);
                    if (dist < threshold * 2 && dist < bestDist) {
                        bestDist = dist;
                        bestTarget = other;
                        bestType = other.hasElseBody && blockCy > (other.y + otherEl.offsetHeight / 2) ? 'else-body' : 'body';
                    }
                }
            }
        }

        if (bestTarget) {
            this._disconnectFromParents(blockId);

            if (bestType === 'next') {
                const targetEl = document.getElementById(bestTarget.id);
                block.x = bestTarget.x;
                block.y = bestTarget.y + targetEl.offsetHeight + 12;
                bestTarget.next = blockId;
            } else if (bestType === 'body') {
                bestTarget.children.push(blockId);
                block.x = bestTarget.x + 20;
                block.y = bestTarget.y + 40;
            } else if (bestType === 'else-body') {
                if (!bestTarget.elseChildren) bestTarget.elseChildren = [];
                bestTarget.elseChildren.push(blockId);
                block.x = bestTarget.x + 20;
                block.y = bestTarget.y + 80;
            }

            this._updateBlockPosition(blockId);
            if (bestTarget.hasBody || bestTarget.hasElseBody) {
                this._renderBlockBody(bestTarget);
            }
        }

        // Remove dragging class
        const dragEl = document.getElementById(blockId);
        if (dragEl) dragEl.classList.remove('dragging');
    },

    // ── Block Selection ────────────────────────────────────────────────────

    _selectBlock(blockId) {
        // Deselect previous
        if (this._selectedBlock) {
            const prev = document.getElementById(this._selectedBlock);
            if (prev) prev.classList.remove('selected');
        }

        this._selectedBlock = blockId;

        if (blockId) {
            const el = document.getElementById(blockId);
            if (el) el.classList.add('selected');
            const block = this._getBlock(blockId);
            if (block) this._renderProperties(block);
        } else {
            this._propsEl.innerHTML = '<p class="ne-props-empty">Select a block to view its properties.</p>';
        }
    },

    /**
     * Render properties panel for a selected block.
     */
    _renderProperties(block) {
        const def = this.BLOCK_DEFS[block.type];
        const cat = this.CATEGORIES[block.category];
        if (!cat) return;

        let html = `
            <div class="ne-props-field">
                <div class="ne-props-label">Type</div>
                <div style="font-size:13px;">${block.label}</div>
            </div>
            <div class="ne-props-field">
                <div class="ne-props-label">Category</div>
                <span class="ne-props-category" style="background:${cat.bg};color:${cat.color};border:1px solid ${cat.color};">${cat.icon} ${cat.label}</span>
            </div>
            <div class="ne-props-field">
                <div class="ne-props-label">ID</div>
                <div style="font-size:10px;font-family:monospace;color:#666;word-break:break-all;">${block.id}</div>
            </div>
            <div style="border-top:1px solid #2a2a44;margin:8px 0;"></div>
        `;

        // Parameter fields
        if (def) {
            for (const p of def.params) {
                if (p.type === 'static') continue;
                const val = block.params[p.name] || '';
                html += `
                    <div class="ne-props-field">
                        <div class="ne-props-label">${p.name}</div>
                        <input class="ne-props-value" data-param="${p.name}" value="${this._escapeHtml(val)}" />
                    </div>
                `;
            }
        }

        // Position
        html += `
            <div style="border-top:1px solid #2a2a44;margin:8px 0;"></div>
            <div class="ne-props-field">
                <div class="ne-props-label">Position</div>
                <div style="font-size:11px;color:#888;">x: ${Math.round(block.x)}, y: ${Math.round(block.y)}</div>
            </div>
        `;

        this._propsEl.innerHTML = html;

        // Wire up param change listeners
        this._propsEl.querySelectorAll('.ne-props-value').forEach(input => {
            input.addEventListener('change', (e) => {
                const paramName = e.target.dataset.param;
                const newVal = e.target.value;
                this._onParamChange(block, paramName, newVal);
                // Update the input on the block itself
                const blockEl = document.getElementById(block.id);
                if (blockEl) {
                    const inputs = blockEl.querySelectorAll('.ne-block-input, .ne-block-select');
                    inputs.forEach(inp => {
                        // Match by value (approximate)
                        if (inp.value === block.params[paramName]) {
                            inp.value = newVal;
                        }
                    });
                }
            });
        });
    },

    // ── Undo / Redo ────────────────────────────────────────────────────────

    _pushUndo(action, data) {
        this._undoStack.push({ action, data, timestamp: Date.now() });
        if (this._undoStack.length > 100) this._undoStack.shift();
        this._redoStack = [];
    },

    undo() {
        if (this._undoStack.length === 0) return;
        const entry = this._undoStack.pop();
        this._redoStack.push(entry);
        this._applyUndoEntry(entry);
        console.log('[NodeEditor] Undo:', entry.action);
    },

    redo() {
        if (this._redoStack.length === 0) return;
        const entry = this._redoStack.pop();
        this._undoStack.push(entry);
        this._applyRedoEntry(entry);
        console.log('[NodeEditor] Redo:', entry.action);
    },

    _applyUndoEntry(entry) {
        switch (entry.action) {
            case 'addBlock':
                this._removeBlockNoUndo(entry.data.blockId);
                break;
            case 'removeBlock':
                for (const bd of entry.data.removedBlocks) {
                    this._blocks.push({ ...bd });
                }
                this._renderWorkspace();
                break;
            case 'paramChange':
                const b = this._getBlock(entry.data.blockId);
                if (b) {
                    b.params[entry.data.paramName] = entry.data.oldValue;
                    this._renderWorkspace();
                }
                break;
            case 'connectBlocks':
                const parent = this._getBlock(entry.data.parentId);
                if (parent) parent.next = entry.data.oldNext;
                this._renderWorkspace();
                break;
            case 'connectToBody':
                const p = this._getBlock(entry.data.parentId);
                if (p) {
                    p.children = p.children.filter(id => id !== entry.data.childId);
                    if (p.elseChildren) p.elseChildren = p.elseChildren.filter(id => id !== entry.data.childId);
                }
                this._renderWorkspace();
                break;
        }
    },

    _applyRedoEntry(entry) {
        switch (entry.action) {
            case 'addBlock':
                this._blocks.push({ ...entry.data.blockData });
                this._renderWorkspace();
                break;
            case 'removeBlock':
                for (const bd of entry.data.removedBlocks) {
                    this._blocks = this._blocks.filter(b => b.id !== bd.id);
                }
                this._renderWorkspace();
                break;
            case 'paramChange':
                const b = this._getBlock(entry.data.blockId);
                if (b) {
                    b.params[entry.data.paramName] = entry.data.newValue;
                    this._renderWorkspace();
                }
                break;
            case 'connectBlocks':
                const parent = this._getBlock(entry.data.parentId);
                if (parent) parent.next = entry.data.childId;
                this._renderWorkspace();
                break;
            case 'connectToBody':
                const p = this._getBlock(entry.data.parentId);
                if (p) {
                    if (entry.data.bodySlot === 'else') {
                        if (!p.elseChildren) p.elseChildren = [];
                        p.elseChildren.push(entry.data.childId);
                    } else {
                        p.children.push(entry.data.childId);
                    }
                }
                this._renderWorkspace();
                break;
        }
    },

    _removeBlockNoUndo(blockId) {
        const el = document.getElementById(blockId);
        if (el) el.remove();
        this._blocks = this._blocks.filter(b => b.id !== blockId);
        this._disconnectFromParents(blockId);
    },

    // ── Copy / Paste ───────────────────────────────────────────────────────

    _copyBlock(blockId) {
        const block = this._getBlock(blockId);
        if (!block) return;
        this._clipboard = JSON.parse(JSON.stringify(block));
    },

    _pasteBlock() {
        if (!this._clipboard) return;
        const copy = JSON.parse(JSON.stringify(this._clipboard));
        copy.id = this._genId();
        copy.x += 30;
        copy.y += 30;

        this._blocks.push(copy);
        this._renderBlock(copy);
        this._selectBlock(copy.id);
        this._updateStatus();
    },

    // ── Variables ──────────────────────────────────────────────────────────

    _promptNewVariable() {
        const name = prompt('Enter variable name:');
        if (name && name.trim()) {
            const varName = name.trim();
            if (this._variables[varName] !== undefined) {
                alert('Variable "' + varName + '" already exists.');
                return;
            }
            this._variables[varName] = 0;
            console.log('[NodeEditor] Created variable:', varName);
            alert('Variable "' + varName + '" created. Use it in Variable blocks.');
        }
    },

    // ── Zoom & Pan ─────────────────────────────────────────────────────────

    _zoomBy(delta) {
        this._zoom = Math.max(0.3, Math.min(2, this._zoom + delta));
        this._updateWorkspaceTransform();
    },

    _updateWorkspaceTransform() {
        if (this._workspaceEl) {
            this._workspaceEl.style.transform = `translate(${-this._scrollOffset.x * this._zoom}px, ${-this._scrollOffset.y * this._zoom}px) scale(${this._zoom})`;
        }
    },

    // ── Serialization ──────────────────────────────────────────────────────

    /**
     * Serialize the workspace to a JSON-compatible object.
     */
    serialize() {
        return {
            version: '1.0',
            blocks: this._blocks.map(b => ({ ...b })),
            variables: { ...this._variables },
            namedEvents: { ...this._namedEvents },
            customBlocks: { ...this._customBlocks },
            scrollOffset: { ...this._scrollOffset },
            zoom: this._zoom,
        };
    },

    /**
     * Deserialize and load from a JSON object.
     */
    deserialize(data) {
        if (!data || !data.blocks) return;

        this.clearWorkspace();

        this._blocks = data.blocks.map(b => ({ ...b }));
        this._variables = data.variables || {};
        this._namedEvents = data.namedEvents || {};
        this._customBlocks = data.customBlocks || {};
        this._scrollOffset = data.scrollOffset || { x: 0, y: 0 };
        this._zoom = data.zoom || 1;

        // Update ID counter
        let maxId = 0;
        for (const b of this._blocks) {
            const num = parseInt(b.id.replace('block_', '').split('_')[1] || '0');
            if (num > maxId) maxId = num;
        }
        this._blockIdCounter = maxId;

        this._renderWorkspace();
        this._renderPalette();
        this._updateWorkspaceTransform();
        this._updateStatus();
    },

    // ── Persistence ────────────────────────────────────────────────────────

    _saveToStorage() {
        try {
            const data = this.serialize();
            localStorage.setItem('blockverse_node_editor', JSON.stringify(data));
            console.log('[NodeEditor] Project saved to localStorage.');
            this._updateStatus('Saved!');
        } catch (e) {
            console.error('[NodeEditor] Save failed:', e);
        }
    },

    _loadFromStorage() {
        try {
            const raw = localStorage.getItem('blockverse_node_editor');
            if (raw) {
                const data = JSON.parse(raw);
                this.deserialize(data);
                console.log('[NodeEditor] Project loaded from localStorage.');
            }
        } catch (e) {
            console.error('[NodeEditor] Load failed:', e);
        }
    },

    // ── Compilation ────────────────────────────────────────────────────────

    /**
     * Compile the visual node graph to executable JavaScript.
     * Delegates to NodeCompiler.
     */
    compile() {
        if (typeof NodeCompiler === 'undefined') {
            console.error('[NodeEditor] NodeCompiler not found.');
            alert('Compiler not loaded.');
            return null;
        }

        const code = NodeCompiler.compile(this._blocks, {
            variables: this._variables,
            customBlocks: this._customBlocks,
        });

        console.log('[NodeEditor] Compiled code:\n', code);
        this._updateStatus('Compiled! ' + this._blocks.length + ' blocks.');
        return code;
    },

    // ── Clear ──────────────────────────────────────────────────────────────

    clearWorkspace() {
        if (this._blocks.length > 0) {
            this._pushUndo('clear', { blocks: this._blocks.map(b => ({ ...b })) });
        }
        this._blocks = [];
        this._selectedBlock = null;
        this._renderWorkspace();
        this._updateStatus();
    },

    // ── Status Bar ─────────────────────────────────────────────────────────

    _updateStatus(message) {
        const bar = document.getElementById('ne-statusbar');
        if (bar) {
            bar.textContent = message || `Ready \u2014 Blocks: ${this._blocks.length} | Zoom: ${Math.round(this._zoom * 100)}%`;
        }
    },

    // ── Utilities ──────────────────────────────────────────────────────────

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};

// Export for module usage (also works as global)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NodeEditor;
}
