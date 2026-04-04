/**
 * BlockVerse Node Compiler
 * Compiles visual node graphs (from NodeEditor) into executable JavaScript.
 * Traverses block trees starting from event (hat) blocks and generates
 * equivalent JavaScript code with proper nesting, parameters, and safety.
 */

const NodeCompiler = {

    // ── Compilation Entry Point ────────────────────────────────────────────

    /**
     * Compile a full node graph to JavaScript.
     * @param {Array} blocks - Array of block objects from NodeEditor.
     * @param {object} context - { variables: {}, customBlocks: {} }
     * @returns {string} Complete JavaScript code string.
     */
    compile(blocks, context) {
        if (!blocks || blocks.length === 0) {
            return '// No blocks to compile.';
        }

        const ctx = {
            variables: context.variables || {},
            customBlocks: context.customBlocks || {},
            usedEvents: new Set(),
            errors: [],
            warnings: [],
        };

        // Find all hat blocks (event starters)
        const hatBlocks = blocks.filter(b => b.isHat);

        if (hatBlocks.length === 0) {
            ctx.errors.push('No event blocks found. Scripts need at least one event block (green) to start.');
        }

        let code = '';
        code += '// ==========================================\n';
        code += '// BlockVerse — Generated Script\n';
        code += '// Compiled at: ' + new Date().toISOString() + '\n';
        code += '// Blocks: ' + blocks.length + ' | Events: ' + hatBlocks.length + '\n';
        code += '// ==========================================\n\n';

        // Variable declarations
        const varNames = Object.keys(ctx.variables);
        if (varNames.length > 0) {
            code += '// Variables\n';
            for (const name of varNames) {
                const safeName = this._sanitizeVarName(name);
                code += `var ${safeName} = ${this._sanitizeLiteral(ctx.variables[name], 'number')};\n`;
            }
            code += '\n';
        }

        // Compile each event chain
        for (const hatBlock of hatBlocks) {
            const eventCode = this._compileBlock(hatBlock, ctx, 0);
            if (eventCode) {
                code += eventCode + '\n\n';
            }
        }

        // Warnings
        if (ctx.warnings.length > 0) {
            code += '// Warnings:\n';
            for (const w of ctx.warnings) {
                code += '// ⚠ ' + w + '\n';
            }
            code += '\n';
        }

        // Errors
        if (ctx.errors.length > 0) {
            code += '// ERRORS:\n';
            for (const e of ctx.errors) {
                code += '// ❌ ' + e + '\n';
            }
        }

        return code;
    },

    // ── Block Dispatch ─────────────────────────────────────────────────────

    /**
     * Compile a single block and its chain (next blocks).
     */
    _compileBlock(block, ctx, indent) {
        if (!block) return '';

        const category = block.category || 'events';
        let code = '';

        switch (category) {
            case 'events':
                code = this._compileEvent(block, ctx, indent);
                break;
            case 'motion':
                code = this._compileMotion(block, ctx, indent);
                break;
            case 'blocks':
                code = this._compileBlocks(block, ctx, indent);
                break;
            case 'control':
                code = this._compileControl(block, ctx, indent);
                break;
            case 'looks':
                code = this._compileLooks(block, ctx, indent);
                break;
            case 'sound':
                code = this._compileSound(block, ctx, indent);
                break;
            case 'variables':
                code = this._compileVariables(block, ctx, indent);
                break;
            case 'custom':
                code = this._compileCustom(block, ctx, indent);
                break;
            default:
                ctx.warnings.push(`Unknown block category: "${category}" (block: ${block.label})`);
                code = this._indent(`// Unknown block: ${block.label}`, indent);
        }

        // Compile next block in sequence
        if (block.next) {
            const nextBlock = ctx._allBlocks ? ctx._allBlocks.find(b => b.id === block.next) : null;
            if (nextBlock) {
                code += '\n' + this._compileBlock(nextBlock, ctx, indent);
            }
        }

        return code;
    },

    // ── Find Block by ID Helper ────────────────────────────────────────────

    _findBlock(blockId, allBlocks) {
        return allBlocks.find(b => b.id === blockId) || null;
    },

    /**
     * Compile children (body blocks) of a parent.
     */
    _compileChildren(childIds, ctx, indent, allBlocks) {
        if (!childIds || childIds.length === 0) return '';
        let code = '';
        ctx._allBlocks = allBlocks || ctx._allBlocks;
        for (const childId of childIds) {
            const child = this._findBlock(childId, ctx._allBlocks);
            if (child) {
                code += this._compileBlock(child, ctx, indent);
            }
        }
        return code;
    },

    // ── Event Compilers ────────────────────────────────────────────────────

    _compileEvent(block, ctx, indent) {
        const p = block.params || {};
        let code = '';
        let eventBody = '';
        const ind = indent + 1;

        // Collect body from the chain (next blocks)
        ctx._allBlocks = ctx._allBlocks || [];
        const nextBlock = this._findBlock(block.next, ctx._allBlocks);
        if (nextBlock) {
            eventBody = this._compileBlock(nextBlock, ctx, ind);
        }

        switch (block.type) {
            case 'event_game_start':
                code = this._indent('Events.on("gameStart", function() {', indent);
                code += eventBody ? '\n' + eventBody : this._indent('// (empty)', ind);
                code += '\n' + this._indent('});', indent);
                break;

            case 'event_player_touches': {
                const type = this._sanitizeLiteral(p.type || 'any', 'text');
                code = this._indent(`Player.onTouched(${type}, function() {`, indent);
                code += eventBody ? '\n' + eventBody : this._indent('// (empty)', ind);
                code += '\n' + this._indent('});', indent);
                break;
            }

            case 'event_block_placed': {
                const type = this._sanitizeLiteral(p.type || 'grass', 'text');
                code = this._indent(`Block.onPlaced(${type}, function(x, y, z) {`, indent);
                code += eventBody ? '\n' + eventBody : this._indent('// (empty)', ind);
                code += '\n' + this._indent('});', indent);
                break;
            }

            case 'event_timer': {
                const seconds = this._sanitizeLiteral(p.seconds || '10', 'number');
                code = this._indent(`Timer.after(${seconds}, function() {`, indent);
                code += eventBody ? '\n' + eventBody : this._indent('// (empty)', ind);
                code += '\n' + this._indent('});', indent);
                break;
            }

            case 'event_player_joins':
                code = this._indent('Events.on("playerJoin", function(player) {', indent);
                code += eventBody ? '\n' + eventBody : this._indent('// (empty)', ind);
                code += '\n' + this._indent('});', indent);
                break;

            case 'event_key_pressed': {
                const key = this._sanitizeLiteral(p.key || 'E', 'text');
                code = this._indent(`Input.onKey(${key}, function() {`, indent);
                code += eventBody ? '\n' + eventBody : this._indent('// (empty)', ind);
                code += '\n' + this._indent('});', indent);
                break;
            }

            case 'control_receive': {
                const eventName = this._sanitizeLiteral(p.event || 'my event', 'text');
                code = this._indent(`Events.on("broadcast_${this._sanitizeEventName(p.event || 'my event')}", function() {`, indent);
                code += eventBody ? '\n' + eventBody : this._indent('// (empty)', ind);
                code += '\n' + this._indent('});', indent);
                break;
            }

            default:
                code = this._indent(`// Unknown event: ${block.label}`, indent);
        }

        return code;
    },

    // ── Motion Compilers ───────────────────────────────────────────────────

    _compileMotion(block, ctx, indent) {
        const p = block.params || {};

        switch (block.type) {
            case 'motion_move_to': {
                const x = this._sanitizeLiteral(p.x || '0', 'number');
                const y = this._sanitizeLiteral(p.y || '5', 'number');
                const z = this._sanitizeLiteral(p.z || '0', 'number');
                return this._indent(`Player.setPosition(${x}, ${y}, ${z});`, indent);
            }

            case 'motion_move_by': {
                const dx = this._sanitizeLiteral(p.dx || '0', 'number');
                const dy = this._sanitizeLiteral(p.dy || '0', 'number');
                const dz = this._sanitizeLiteral(p.dz || '0', 'number');
                return this._indent('Player.moveRelative(' + dx + ', ' + dy + ', ' + dz + ');', indent);
            }

            case 'motion_set_speed': {
                const speed = this._sanitizeLiteral(p.speed || '16', 'number');
                return this._indent('Player.setSpeed(' + speed + ');', indent);
            }

            case 'motion_tween_to': {
                const x = this._sanitizeLiteral(p.x || '0', 'number');
                const y = this._sanitizeLiteral(p.y || '5', 'number');
                const z = this._sanitizeLiteral(p.z || '0', 'number');
                const seconds = this._sanitizeLiteral(p.seconds || '1', 'number');
                return this._indent(`Tween.to(Player, { x: ${x}, y: ${y}, z: ${z} }, ${seconds});`, indent);
            }

            default:
                return this._indent(`// Unknown motion: ${block.label}`, indent);
        }
    },

    // ── Blocks Compilers ───────────────────────────────────────────────────

    _compileBlocks(block, ctx, indent) {
        const p = block.params || {};

        switch (block.type) {
            case 'block_place': {
                const x = this._sanitizeLiteral(p.x || '0', 'number');
                const y = this._sanitizeLiteral(p.y || '0', 'number');
                const z = this._sanitizeLiteral(p.z || '0', 'number');
                const type = this._sanitizeLiteral(p.type || 'stone', 'text');
                return this._indent(`Block.place(${x}, ${y}, ${z}, ${type});`, indent);
            }

            case 'block_remove': {
                const x = this._sanitizeLiteral(p.x || '0', 'number');
                const y = this._sanitizeLiteral(p.y || '0', 'number');
                const z = this._sanitizeLiteral(p.z || '0', 'number');
                return this._indent(`Block.remove(${x}, ${y}, ${z});`, indent);
            }

            case 'block_if_is': {
                const x = this._sanitizeLiteral(p.x || '0', 'number');
                const y = this._sanitizeLiteral(p.y || '0', 'number');
                const z = this._sanitizeLiteral(p.z || '0', 'number');
                const type = this._sanitizeLiteral(p.type || 'gold', 'text');
                const ind = indent + 1;

                let code = this._indent(`if (Block.at(${x}, ${y}, ${z}) === ${type}) {`, indent);
                const bodyCode = this._compileChildren(block.children, ctx, ind);
                code += bodyCode ? '\n' + bodyCode : this._indent('// (empty)', ind);
                code += '\n' + this._indent('}', indent);
                return code;
            }

            case 'block_find_all': {
                const type = this._sanitizeLiteral(p.type || 'gold', 'text');
                return this._indent(`var foundBlocks = Block.findAll(${type});`, indent);
            }

            default:
                return this._indent(`// Unknown blocks: ${block.label}`, indent);
        }
    },

    // ── Control Compilers ──────────────────────────────────────────────────

    _compileControl(block, ctx, indent) {
        const p = block.params || {};
        const ind = indent + 1;

        switch (block.type) {
            case 'control_wait': {
                const seconds = this._sanitizeLiteral(p.seconds || '1', 'number');
                return this._indent(`yield Tween.wait(${seconds});`, indent);
            }

            case 'control_repeat': {
                const times = this._sanitizeLiteral(p.times || '10', 'number');
                let code = this._indent(`for (var _i = 0; _i < ${times}; _i++) {`, indent);
                const bodyCode = this._compileChildren(block.children, ctx, ind);
                code += bodyCode ? '\n' + bodyCode : this._indent('// (empty)', ind);
                code += '\n' + this._indent('}', indent);
                return code;
            }

            case 'control_forever': {
                let code = this._indent('while (true) {', indent);
                const bodyCode = this._compileChildren(block.children, ctx, ind);
                code += bodyCode ? '\n' + bodyCode : this._indent('// (empty)', ind);
                code += '\n' + this._indent('    yield; // prevent infinite loop', ind);
                code += '\n' + this._indent('}', indent);
                ctx.warnings.push('"forever" loop detected. Ensure yield is called to prevent freezing.');
                return code;
            }

            case 'control_if': {
                const condition = this._compileCondition(p.condition || 'true', ctx);
                let code = this._indent(`if (${condition}) {`, indent);
                const bodyCode = this._compileChildren(block.children, ctx, ind);
                code += bodyCode ? '\n' + bodyCode : this._indent('// (empty)', ind);

                // else body
                if (block.elseChildren && block.elseChildren.length > 0) {
                    code += '\n' + this._indent('} else {', indent);
                    const elseCode = this._compileChildren(block.elseChildren, ctx, ind);
                    code += elseCode ? '\n' + elseCode : this._indent('// (empty)', ind);
                }

                code += '\n' + this._indent('}', indent);
                return code;
            }

            case 'control_if_else': {
                // Same as control_if but always shows else
                return this._compileControl({ ...block, type: 'control_if' }, ctx, indent);
            }

            case 'control_stop': {
                return this._indent('return; // stop script', indent);
            }

            case 'control_broadcast': {
                const eventName = this._sanitizeLiteral(p.event || 'my event', 'text');
                return this._indent(`Events.emit("broadcast_${this._sanitizeEventName(p.event || 'my event')}");`, indent);
            }

            default:
                return this._indent(`// Unknown control: ${block.label}`, indent);
        }
    },

    // ── Looks Compilers ────────────────────────────────────────────────────

    _compileLooks(block, ctx, indent) {
        const p = block.params || {};

        switch (block.type) {
            case 'looks_show_hint': {
                const text = this._sanitizeLiteral(p.text || 'Hello!', 'text');
                return this._indent(`UI.showHint(${text});`, indent);
            }

            case 'looks_show_score': {
                const value = this._sanitizeLiteral(p.value || '0', 'text');
                return this._indent(`UI.showScore(${value});`, indent);
            }

            case 'looks_show_timer': {
                const seconds = this._sanitizeLiteral(p.seconds || '60', 'number');
                return this._indent(`UI.showTimer(${seconds});`, indent);
            }

            case 'looks_hide_ui': {
                return this._indent('UI.hideAll();', indent);
            }

            case 'looks_sky_color': {
                const color = this._sanitizeLiteral(p.color || '#87CEEB', 'color');
                return this._indent(`World.setSkyColor(${color});`, indent);
            }

            default:
                return this._indent(`// Unknown looks: ${block.label}`, indent);
        }
    },

    // ── Sound Compilers ────────────────────────────────────────────────────

    _compileSound(block, ctx, indent) {
        const p = block.params || {};

        switch (block.type) {
            case 'sound_play': {
                const name = this._sanitizeLiteral(p.name || 'coin', 'text');
                return this._indent(`Sound.play(${name});`, indent);
            }

            case 'sound_stop_all': {
                return this._indent('Sound.stopAll();', indent);
            }

            case 'sound_set_volume': {
                const volume = this._sanitizeLiteral(p.volume || '100', 'number');
                return this._indent(`Sound.setVolume(${volume} / 100);`, indent);
            }

            default:
                return this._indent(`// Unknown sound: ${block.label}`, indent);
        }
    },

    // ── Variables Compilers ────────────────────────────────────────────────

    _compileVariables(block, ctx, indent) {
        const p = block.params || {};

        switch (block.type) {
            case 'var_set': {
                const varName = this._sanitizeVarName(p.variable || 'myVar');
                const value = this._resolveValue(p.value || '0', ctx);
                return this._indent(`${varName} = ${value};`, indent);
            }

            case 'var_change': {
                const varName = this._sanitizeVarName(p.variable || 'myVar');
                const value = this._resolveValue(p.value || '1', ctx);
                return this._indent(`${varName} += ${value};`, indent);
            }

            case 'var_show': {
                const varName = this._sanitizeVarName(p.variable || 'myVar');
                return this._indent(`UI.showVariable("${p.variable || 'myVar'}", ${varName});`, indent);
            }

            case 'var_if_equals': {
                const varName = this._sanitizeVarName(p.variable || 'myVar');
                const value = this._resolveValue(p.value || '0', ctx);
                const ind = indent + 1;

                let code = this._indent(`if (${varName} === ${value}) {`, indent);
                const bodyCode = this._compileChildren(block.children, ctx, ind);
                code += bodyCode ? '\n' + bodyCode : this._indent('// (empty)', ind);
                code += '\n' + this._indent('}', indent);
                return code;
            }

            default:
                return this._indent(`// Unknown variable: ${block.label}`, indent);
        }
    },

    // ── Custom Block Compiler ───────────────────────────────────────────────

    _compileCustom(block, ctx, indent) {
        const p = block.params || {};

        // Find the custom block definition
        let customDef = null;
        if (block.customId && ctx.customBlocks) {
            customDef = ctx.customBlocks[block.customId];
        }
        if (!customDef && ctx.customBlocks) {
            // Search by name
            for (const cb of Object.values(ctx.customBlocks)) {
                if (cb.name === block.label) {
                    customDef = cb;
                    break;
                }
            }
        }

        if (!customDef) {
            return this._indent(`// Custom block not found: "${block.label}"`, indent);
        }

        // Use CustomNodes to generate code with input substitution
        if (typeof CustomNodes !== 'undefined') {
            const code = CustomNodes.generateCode(customDef, p);
            return this._indent(code, indent);
        }

        // Fallback: manual substitution
        let code = customDef.code || '';
        if (customDef.inputs) {
            for (const inp of customDef.inputs) {
                const value = p[inp.name] || inp.default || '0';
                const sanitized = this._sanitizeLiteral(value, inp.type);
                code = code.replace(new RegExp('\\{\\{' + inp.name + '\\}\\}', 'g'), sanitized);
            }
        }

        return this._indent(code, indent);
    },

    // ── Condition Compiler ──────────────────────────────────────────────────

    /**
     * Compile a condition string into a safe JS expression.
     * Supports simple conditions like "var > 5", "player.x = 10", etc.
     */
    _compileCondition(conditionStr, ctx) {
        if (!conditionStr || typeof conditionStr !== 'string') {
            return 'true';
        }

        let expr = conditionStr.trim();

        // Replace common patterns
        // Variable references: use the actual variable names
        for (const varName of Object.keys(ctx.variables || {})) {
            const safeName = this._sanitizeVarName(varName);
            // Replace quoted variable names with actual variable references
            expr = expr.replace(new RegExp('\\b' + varName + '\\b', 'g'), safeName);
        }

        // Replace common game object references
        expr = expr.replace(/\bplayer\.x\b/gi, 'Player.position.x');
        expr = expr.replace(/\bplayer\.y\b/gi, 'Player.position.y');
        expr = expr.replace(/\bplayer\.z\b/gi, 'Player.position.z');
        expr = expr.replace(/\bscore\b/gi, 'Variables.get("score")');
        expr = expr.replace(/\btimer\b/gi, 'Timer.remaining');

        // Replace = with === for comparisons (but not == or ===)
        expr = expr.replace(/(?<![=!<>])=(?!=)/g, '===');

        // Sanitize: only allow safe characters
        if (!this._isSafeExpression(expr)) {
            ctx.warnings.push(`Condition "${conditionStr}" contains potentially unsafe expressions. Using true as fallback.`);
            return 'true';
        }

        return expr || 'true';
    },

    /**
     * Resolve a value — could be a literal, variable reference, or expression.
     */
    _resolveValue(value, ctx) {
        if (value === undefined || value === null) return '0';

        const str = String(value).trim();

        // Number literal
        if (/^-?\d+(\.\d+)?$/.test(str)) {
            return str;
        }

        // String literal (quoted)
        if (str.startsWith('"') && str.endsWith('"')) {
            return this._sanitizeLiteral(str.slice(1, -1), 'text');
        }

        // Variable reference
        for (const varName of Object.keys(ctx.variables || {})) {
            if (str === varName) {
                return this._sanitizeVarName(varName);
            }
        }

        // Boolean
        if (str.toLowerCase() === 'true') return 'true';
        if (str.toLowerCase() === 'false') return 'false';

        // Default: treat as string
        return this._sanitizeLiteral(str, 'text');
    },

    // ── Sanitization & Safety ──────────────────────────────────────────────

    /**
     * Sanitize a literal value for safe code generation.
     */
    _sanitizeLiteral(value, type) {
        switch (type) {
            case 'number': {
                const num = Number(value);
                return isNaN(num) ? '0' : String(num);
            }
            case 'color': {
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                    return '"' + value + '"';
                }
                return '"#FFFFFF"';
            }
            default: {
                // String literal — escape for safety
                return '"' + String(value)
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/</g, '\\x3C')
                    .replace(/>/g, '\\x3E')
                    + '"';
            }
        }
    },

    /**
     * Sanitize a variable name for use as a JS identifier.
     */
    _sanitizeVarName(name) {
        if (!name) return '_var';
        // Replace non-alphanumeric chars with underscore
        let safe = String(name)
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/^(\d)/, '_$1');

        // Ensure it doesn't start with a JS keyword
        const jsKeywords = ['var', 'let', 'const', 'function', 'return', 'if', 'else', 'for', 'while',
            'do', 'switch', 'case', 'break', 'continue', 'new', 'this', 'typeof', 'instanceof',
            'try', 'catch', 'finally', 'throw', 'class', 'extends', 'import', 'export', 'default',
            'true', 'false', 'null', 'undefined', 'void', 'delete', 'in', 'of', 'yield', 'await'];

        if (jsKeywords.includes(safe)) {
            safe = '_' + safe;
        }

        // Ensure not empty
        if (!safe || safe === '_') {
            safe = '_var_' + Date.now();
        }

        return safe;
    },

    /**
     * Sanitize an event name for use in event identifiers.
     */
    _sanitizeEventName(name) {
        return String(name || 'unknown')
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .toLowerCase();
    },

    /**
     * Check if an expression string is safe for code generation.
     * Prevents code injection from user inputs.
     */
    _isSafeExpression(expr) {
        // Block dangerous patterns
        const dangerous = [
            /\beval\b/,
            /\bFunction\b/,
            /\bdocument\./,
            /\bwindow\./,
            /\blocalStorage\b/,
            /\bsessionStorage\b/,
            /\bXMLHttpRequest\b/,
            /\bfetch\b/,
            /\bimport\b/,
            /\brequire\b/,
            /\bprocess\b/,
            /\b__proto__\b/,
            /\bconstructor\b/,
            /\[.*\]\s*\(/,  // bracket notation + call
            /setTimeout/,
            /setInterval/,
        ];

        for (const pattern of dangerous) {
            if (pattern.test(expr)) {
                return false;
            }
        }

        // Only allow safe characters: letters, numbers, spaces, operators, parens, dots, quotes
        return /^[a-zA-Z0-9_\s\+\-\*\/\%\(\)\[\]\{\}\.\,\;\>\<\=\!\&\|\?\:\'\"\\]+$/.test(expr);
    },

    // ── Formatting Helpers ─────────────────────────────────────────────────

    /**
     * Indent a block of code by `level` levels (4 spaces each).
     */
    _indent(code, level) {
        const spaces = '    '.repeat(level);
        return code.split('\n').map(line => spaces + line).join('\n');
    },

    // ── Utility: Quick Compile with Context ─────────────────────────────────

    /**
     * Compile blocks from NodeEditor with full context.
     * Convenience method that sets up the internal _allBlocks reference.
     */
    compileWithBlocks(allBlocks, context) {
        if (!allBlocks || allBlocks.length === 0) {
            return '// No blocks to compile.';
        }

        const ctx = {
            variables: context.variables || {},
            customBlocks: context.customBlocks || {},
            _allBlocks: allBlocks,
            errors: [],
            warnings: [],
        };

        return this.compile(allBlocks, ctx);
    },
};

// Export for module usage (also works as global)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NodeCompiler;
}
