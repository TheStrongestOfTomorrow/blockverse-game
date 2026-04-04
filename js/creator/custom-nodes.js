/**
 * BlockVerse Custom Nodes (My Blocks)
 * A system for creating, managing, sharing, and importing custom visual blocks.
 * Similar to Scratch "My Blocks" — users define reusable block definitions
 * with custom inputs and generated code bodies.
 */

const CustomNodes = {
    // ── Storage ────────────────────────────────────────────────────────────
    _myBlocks: {},          // id -> block definition
    _storageKey: 'blockverse_custom_nodes',
    _idCounter: 0,

    /**
     * Initialize the custom nodes system.
     * Loads saved blocks from localStorage.
     */
    init() {
        this.loadAll();
        console.log('[CustomNodes] Initialized. Loaded', Object.keys(this._myBlocks).length, 'custom blocks.');
    },

    // ── CRUD Operations ────────────────────────────────────────────────────

    /**
     * Create a new custom block definition.
     * @param {string} name - Display name of the block (e.g., "Teleport Player").
     * @param {string} description - Human-readable description.
     * @param {Array} inputs - Array of input definitions.
     *   Each input: { name: string, type: 'number'|'text'|'select'|'color', default?: string, options?: string[] }
     * @param {string} outputType - "action" | "condition" | "value"
     * @param {string} bodyCode - JavaScript code template. Use {{inputName}} for substitution.
     * @returns {object} The created block definition.
     */
    create(name, description, inputs, outputType, bodyCode) {
        // Validate
        const errors = this.validate({ name, description, inputs, outputType, bodyCode });
        if (errors.length > 0) {
            console.error('[CustomNodes] Validation errors:', errors);
            return null;
        }

        const id = this._genId();
        const now = new Date().toISOString();

        const block = {
            id,
            name,
            description: description || '',
            author: this._getCurrentUser(),
            version: '1.0',
            inputs: inputs.map(inp => ({
                name: inp.name,
                type: inp.type || 'text',
                default: inp.default || (inp.type === 'number' ? '0' : ''),
                options: inp.options || [],
            })),
            outputType: outputType || 'action',
            code: bodyCode || '',
            createdAt: now,
            updatedAt: now,
        };

        this._myBlocks[id] = block;
        this.saveAll();

        // Dispatch event so NodeEditor can refresh its palette
        this._dispatchChange('create', block);

        console.log('[CustomNodes] Created block:', name, '(id:', id + ')');
        return block;
    },

    /**
     * Get all custom block definitions.
     * @returns {Array} Array of block definitions.
     */
    getAll() {
        return Object.values(this._myBlocks);
    },

    /**
     * Get a specific custom block by ID.
     * @param {string} id - The block ID.
     * @returns {object|null} The block definition or null.
     */
    get(id) {
        return this._myBlocks[id] || null;
    },

    /**
     * Find a custom block by name.
     * @param {string} name - Block name to search for.
     * @returns {object|null} First matching block or null.
     */
    getByName(name) {
        for (const block of Object.values(this._myBlocks)) {
            if (block.name.toLowerCase() === name.toLowerCase()) {
                return block;
            }
        }
        return null;
    },

    /**
     * Update an existing custom block.
     * @param {string} id - Block ID to update.
     * @param {object} changes - Partial object with fields to update.
     * @returns {object|null} Updated block or null if not found.
     */
    update(id, changes) {
        const block = this._myBlocks[id];
        if (!block) {
            console.warn('[CustomNodes] Block not found:', id);
            return null;
        }

        // Validate if name or inputs are changing
        if (changes.name !== undefined || changes.inputs !== undefined) {
            const tempBlock = { ...block, ...changes };
            const errors = this.validate(tempBlock);
            if (errors.length > 0) {
                console.error('[CustomNodes] Validation errors on update:', errors);
                return null;
            }
        }

        // Apply changes
        if (changes.name !== undefined) block.name = changes.name;
        if (changes.description !== undefined) block.description = changes.description;
        if (changes.inputs !== undefined) {
            block.inputs = changes.inputs.map(inp => ({
                name: inp.name,
                type: inp.type || 'text',
                default: inp.default || '',
                options: inp.options || [],
            }));
        }
        if (changes.outputType !== undefined) block.outputType = changes.outputType;
        if (changes.code !== undefined) block.code = changes.code;

        // Bump version on code change
        if (changes.code !== undefined) {
            const parts = block.version.split('.');
            block.version = parts[0] + '.' + (parseInt(parts[1] || '0') + 1);
        }

        block.updatedAt = new Date().toISOString();
        this.saveAll();
        this._dispatchChange('update', block);

        console.log('[CustomNodes] Updated block:', block.name);
        return block;
    },

    /**
     * Delete a custom block.
     * @param {string} id - Block ID to delete.
     * @returns {boolean} True if deleted, false if not found.
     */
    delete(id) {
        const block = this._myBlocks[id];
        if (!block) {
            console.warn('[CustomNodes] Block not found:', id);
            return false;
        }

        const name = block.name;
        delete this._myBlocks[id];
        this.saveAll();
        this._dispatchChange('delete', block);

        console.log('[CustomNodes] Deleted block:', name);
        return true;
    },

    // ── Share Codes (Export / Import) ──────────────────────────────────────

    /**
     * Export a custom block as a shareable base64-encoded JSON string.
     * @param {string} id - Block ID to export.
     * @returns {string|null} Base64 share code or null if not found.
     */
    exportToShareCode(id) {
        const block = this._myBlocks[id];
        if (!block) return null;

        // Create a clean export object (strip internal fields)
        const exportData = {
            _format: 'blockverse_custom_block',
            _version: '1.0',
            name: block.name,
            description: block.description,
            author: block.author,
            inputs: block.inputs,
            outputType: block.outputType,
            code: block.code,
            exportedAt: new Date().toISOString(),
        };

        try {
            const json = JSON.stringify(exportData);
            // Use btoa for base64 encoding (handles UTF-8 via encodeURIComponent)
            const base64 = btoa(encodeURIComponent(json));
            return base64;
        } catch (e) {
            console.error('[CustomNodes] Export failed:', e);
            return null;
        }
    },

    /**
     * Import a custom block from a share code (base64 JSON).
     * @param {string} code - Base64 share code.
     * @returns {object|null} Imported block definition or null on failure.
     */
    importFromShareCode(code) {
        try {
            // Decode base64
            const json = decodeURIComponent(atob(code.trim()));
            const data = JSON.parse(json);

            // Validate format
            if (data._format !== 'blockverse_custom_block') {
                console.error('[CustomNodes] Invalid share code format.');
                return null;
            }

            // Check for name collision
            const existing = this.getByName(data.name);
            if (existing) {
                console.warn('[CustomNodes] Block with name "' + data.name + '" already exists. Updating.');
                return this.update(existing.id, {
                    description: data.description,
                    inputs: data.inputs,
                    outputType: data.outputType,
                    code: data.code,
                });
            }

            // Create new block
            return this.create(
                data.name,
                data.description,
                data.inputs,
                data.outputType,
                data.code
            );
        } catch (e) {
            console.error('[CustomNodes] Import failed:', e);
            return null;
        }
    },

    /**
     * Export all custom blocks as a JSON string for backup.
     * @returns {string} JSON string of all blocks.
     */
    exportAll() {
        return JSON.stringify({
            format: 'blockverse_custom_nodes_backup',
            version: '1.0',
            blocks: Object.values(this._myBlocks),
            exportedAt: new Date().toISOString(),
        }, null, 2);
    },

    /**
     * Import custom blocks from a backup JSON string.
     * @param {string} jsonStr - JSON string from exportAll().
     * @returns {number} Number of blocks imported.
     */
    importAll(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (data.format !== 'blockverse_custom_nodes_backup') {
                console.error('[CustomNodes] Invalid backup format.');
                return 0;
            }

            let count = 0;
            for (const block of data.blocks) {
                const existing = this.getByName(block.name);
                if (existing) {
                    this.update(existing.id, {
                        description: block.description,
                        inputs: block.inputs,
                        outputType: block.outputType,
                        code: block.code,
                    });
                } else {
                    this.create(block.name, block.description, block.inputs, block.outputType, block.code);
                }
                count++;
            }
            return count;
        } catch (e) {
            console.error('[CustomNodes] Import all failed:', e);
            return 0;
        }
    },

    // ── Persistence ────────────────────────────────────────────────────────

    /**
     * Save all custom blocks to localStorage.
     */
    saveAll() {
        try {
            localStorage.setItem(this._storageKey, JSON.stringify(this._myBlocks));
        } catch (e) {
            console.error('[CustomNodes] Save failed:', e);
        }
    },

    /**
     * Load all custom blocks from localStorage.
     */
    loadAll() {
        try {
            const raw = localStorage.getItem(this._storageKey);
            if (raw) {
                this._myBlocks = JSON.parse(raw);

                // Update ID counter
                let maxId = 0;
                for (const id of Object.keys(this._myBlocks)) {
                    const num = parseInt(id.replace('custom_', ''), 10);
                    if (num > maxId) maxId = num;
                }
                this._idCounter = maxId;
            }
        } catch (e) {
            console.error('[CustomNodes] Load failed:', e);
            this._myBlocks = {};
        }
    },

    // ── Validation ─────────────────────────────────────────────────────────

    /**
     * Validate a block definition.
     * Checks for required fields, valid types, and prevents recursion.
     * @param {object} blockDef - Block definition to validate.
     * @returns {Array<string>} Array of error messages (empty if valid).
     */
    validate(blockDef) {
        const errors = [];

        // Name validation
        if (!blockDef.name || typeof blockDef.name !== 'string') {
            errors.push('Block name is required and must be a string.');
        } else if (blockDef.name.trim().length === 0) {
            errors.push('Block name cannot be empty.');
        } else if (blockDef.name.length > 50) {
            errors.push('Block name must be 50 characters or less.');
        } else if (!/^[a-zA-Z0-9\s_\-+!?]+$/.test(blockDef.name)) {
            errors.push('Block name contains invalid characters. Use only letters, numbers, spaces, and _-+!?');
        }

        // Check for reserved names (Scratch built-in block names)
        const reservedNames = [
            'when game starts', 'when player touches', 'when block placed',
            'when timer', 'when player joins', 'when key pressed',
            'move player to', 'move player by', 'set player speed',
            'tween player to', 'place block at', 'remove block at',
            'if block at', 'find all', 'wait', 'repeat', 'forever',
            'if', 'stop script', 'broadcast', 'when I receive',
            'show hint', 'show score', 'show timer', 'hide UI',
            'change sky color', 'play sound', 'stop all sounds', 'set volume',
            'set', 'change', 'show variable',
        ];
        if (reservedNames.some(r => blockDef.name.toLowerCase().startsWith(r.toLowerCase()))) {
            errors.push('Block name conflicts with a built-in block name. Choose a unique name.');
        }

        // Inputs validation
        if (!Array.isArray(blockDef.inputs)) {
            errors.push('Inputs must be an array.');
        } else {
            const usedNames = new Set();
            for (const inp of blockDef.inputs) {
                if (!inp.name || typeof inp.name !== 'string') {
                    errors.push('Each input must have a valid name.');
                    continue;
                }
                if (usedNames.has(inp.name)) {
                    errors.push('Duplicate input name: "' + inp.name + '"');
                }
                usedNames.add(inp.name);

                const validTypes = ['number', 'text', 'select', 'color'];
                if (!validTypes.includes(inp.type)) {
                    errors.push('Input "' + inp.name + '" has invalid type: "' + inp.type + '". Use: ' + validTypes.join(', '));
                }

                if (inp.type === 'select' && !Array.isArray(inp.options)) {
                    errors.push('Select input "' + inp.name + '" must have options array.');
                }
            }

            if (blockDef.inputs.length > 10) {
                errors.push('Maximum 10 inputs per block.');
            }
        }

        // Output type validation
        const validOutputTypes = ['action', 'condition', 'value'];
        if (blockDef.outputType && !validOutputTypes.includes(blockDef.outputType)) {
            errors.push('Invalid outputType. Use: ' + validOutputTypes.join(', '));
        }

        // Code validation (check for basic syntax issues)
        if (blockDef.code && typeof blockDef.code === 'string') {
            // Check for recursion references that could cause infinite loops
            const code = blockDef.code;
            // Check if the code tries to call itself by name
            const blockName = (blockDef.name || '').replace(/\s+/g, '_').toLowerCase();
            if (code.toLowerCase().includes(blockName + '(')) {
                errors.push('Block code appears to call itself recursively. This may cause infinite loops.');
            }

            // Check for dangerously deep nesting patterns
            const whileCount = (code.match(/\bwhile\b/g) || []).length;
            const forCount = (code.match(/\bfor\b/g) || []).length;
            if (whileCount > 2 || forCount > 3) {
                errors.push('Code contains many loops. Be careful of performance.');
            }

            // Check for obvious syntax errors using try/catch on a wrapped function
            try {
                // Substitute placeholder values for inputs
                let testCode = code;
                if (blockDef.inputs) {
                    for (const inp of blockDef.inputs) {
                        testCode = testCode.replace(new RegExp('\\{\\{' + inp.name + '\\}\\}', 'g'), inp.type === 'number' ? '0' : '""');
                    }
                }
                // Try to parse as a function body
                new Function(testCode);
            } catch (e) {
                errors.push('Code has syntax error: ' + e.message);
            }
        }

        return errors;
    },

    /**
     * Validate inputs against the block definition at runtime.
     * @param {object} blockDef - Block definition.
     * @param {object} inputValues - Key-value pairs of input values.
     * @returns {Array<string>} Array of error messages.
     */
    validateInputs(blockDef, inputValues) {
        const errors = [];

        for (const inp of blockDef.inputs) {
            const value = inputValues[inp.name];

            if (value === undefined || value === null || value === '') {
                errors.push('Missing required input: "' + inp.name + '"');
                continue;
            }

            if (inp.type === 'number') {
                if (isNaN(Number(value))) {
                    errors.push('Input "' + inp.name + '" must be a number, got: "' + value + '"');
                }
            }

            if (inp.type === 'select') {
                if (inp.options.length > 0 && !inp.options.includes(value)) {
                    errors.push('Input "' + inp.name + '" must be one of: ' + inp.options.join(', '));
                }
            }

            if (inp.type === 'color') {
                if (!/^#([0-9A-Fa-f]{3}){1,2}$/.test(value)) {
                    errors.push('Input "' + inp.name + '" must be a valid hex color (e.g., #FF0000)');
                }
            }
        }

        return errors;
    },

    // ── Code Generation Helpers ────────────────────────────────────────────

    /**
     * Generate the code for a custom block by substituting input values.
     * @param {object} blockDef - Block definition.
     * @param {object} inputValues - Key-value pairs of input values.
     * @returns {string} Generated JavaScript code.
     */
    generateCode(blockDef, inputValues) {
        let code = blockDef.code || '';

        // Substitute {{inputName}} placeholders with actual values
        if (blockDef.inputs) {
            for (const inp of blockDef.inputs) {
                const value = inputValues[inp.name] || inp.default || (inp.type === 'number' ? '0' : '""');
                const escapedValue = this._sanitizeValue(value, inp.type);
                code = code.replace(new RegExp('\\{\\{' + inp.name + '\\}\\}', 'g'), escapedValue);
            }
        }

        return code;
    },

    /**
     * Sanitize a value for safe code generation.
     * @param {string} value - Raw input value.
     * @param {string} type - Input type.
     * @returns {string} Sanitized value ready for JS injection.
     */
    _sanitizeValue(value, type) {
        switch (type) {
            case 'number':
                const num = Number(value);
                return isNaN(num) ? '0' : String(num);
            case 'text':
                // Escape for string literal
                return '"' + String(value)
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t')
                    + '"';
            case 'color':
                // Validate color format
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                    return '"' + value + '"';
                }
                return '"#FFFFFF"';
            case 'select':
                return '"' + String(value).replace(/"/g, '\\"') + '"';
            default:
                return '"' + String(value).replace(/"/g, '\\"') + '"';
        }
    },

    // ── Template Blocks ────────────────────────────────────────────────────

    /**
     * Get built-in template blocks for quick creation.
     * @returns {Array} Array of template definitions.
     */
    getTemplates() {
        return [
            {
                name: 'Teleport Player',
                description: 'Teleport the player to a specific position',
                inputs: [
                    { name: 'x', type: 'number', default: '0' },
                    { name: 'y', type: 'number', default: '5' },
                    { name: 'z', type: 'number', default: '0' },
                ],
                outputType: 'action',
                code: 'Player.setPosition({{x}}, {{y}}, {{z}});',
            },
            {
                name: 'Give Item',
                description: 'Give the player an item',
                inputs: [
                    { name: 'item', type: 'select', options: ['sword', 'pickaxe', 'shield', 'potion', 'key'], default: 'sword' },
                    { name: 'amount', type: 'number', default: '1' },
                ],
                outputType: 'action',
                code: 'Player.giveItem("{{item}}", {{amount}});',
            },
            {
                name: 'Show Message',
                description: 'Show a message to all players',
                inputs: [
                    { name: 'message', type: 'text', default: 'Hello!' },
                    { name: 'duration', type: 'number', default: '3' },
                ],
                outputType: 'action',
                code: 'UI.showMessage("{{message}}", {{duration}});',
            },
            {
                name: 'Spawn Block Pattern',
                description: 'Spawn blocks in a line pattern',
                inputs: [
                    { name: 'type', type: 'select', options: ['grass', 'stone', 'wood', 'gold', 'diamond', 'lava', 'water', 'sand', 'brick'], default: 'stone' },
                    { name: 'length', type: 'number', default: '5' },
                ],
                outputType: 'action',
                code: 'for (var i = 0; i < {{length}}; i++) {\n  Block.place(i, 0, 0, "{{type}}");\n}',
            },
            {
                name: 'Check Score',
                description: 'Check if a variable meets a threshold',
                inputs: [
                    { name: 'variable', type: 'text', default: 'score' },
                    { name: 'threshold', type: 'number', default: '100' },
                ],
                outputType: 'condition',
                code: '(Variables.get("{{variable}}") >= {{threshold}})',
            },
            {
                name: 'Random Position',
                description: 'Get a random position value',
                inputs: [
                    { name: 'min', type: 'number', default: '0' },
                    { name: 'max', type: 'number', default: '10' },
                ],
                outputType: 'value',
                code: '(Math.floor(Math.random() * ({{max}} - {{min}} + 1)) + {{min}})',
            },
            {
                name: 'Create Explosion',
                description: 'Create an explosion effect at player position',
                inputs: [
                    { name: 'radius', type: 'number', default: '3' },
                    { name: 'damage', type: 'number', default: '10' },
                ],
                outputType: 'action',
                code: 'Effects.explosion(Player.position, {{radius}}, {{damage}});',
            },
            {
                name: 'Count Blocks',
                description: 'Count all blocks of a specific type in the world',
                inputs: [
                    { name: 'type', type: 'select', options: ['grass', 'stone', 'wood', 'gold', 'diamond', 'lava', 'water', 'sand', 'brick'], default: 'gold' },
                ],
                outputType: 'value',
                code: 'Block.countByType("{{type}}")',
            },
        ];
    },

    /**
     * Create a block from a template.
     * @param {number} templateIndex - Index in getTemplates() array.
     * @returns {object|null} Created block or null.
     */
    createFromTemplate(templateIndex) {
        const templates = this.getTemplates();
        const template = templates[templateIndex];
        if (!template) return null;

        return this.create(
            template.name,
            template.description,
            template.inputs,
            template.outputType,
            template.code
        );
    },

    // ── Internal Utilities ─────────────────────────────────────────────────

    _genId() {
        this._idCounter++;
        return 'custom_' + Date.now() + '_' + this._idCounter;
    },

    _getCurrentUser() {
        // Try to get from BlockVerse auth system if available
        if (typeof Auth !== 'undefined' && Auth.currentUser) {
            return Auth.currentUser.username || 'anonymous';
        }
        return 'anonymous';
    },

    /**
     * Dispatch a custom event when blocks change.
     * This allows NodeEditor to reactively update its palette.
     */
    _dispatchChange(type, block) {
        const event = new CustomEvent('customNodesChanged', {
            detail: { type, block },
        });
        document.dispatchEvent(event);
    },
};

// Export for module usage (also works as global)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CustomNodes;
}
