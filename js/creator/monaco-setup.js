// ============================================
// BLOCKVERSE - Monaco Editor Setup (monaco-setup.js)
// ============================================
// Configures Monaco Editor for the BlockVerse scripting panel.
// Provides Game API autocomplete, dark theme, and keyboard shortcuts.
// Loads Monaco from CDN (jsdelivr).
// ============================================

const MonacoSetup = {
    editor: null,
    _container: null,
    _isReady: false,

    /**
     * Initialize Monaco Editor in the given container.
     * @param {string} containerId - DOM element ID for the editor
     * @param {Object} options - Optional overrides
     */
    init(containerId, options) {
        this._container = document.getElementById(containerId);
        if (!this._container) {
            console.warn('[MonacoSetup] Container not found:', containerId);
            return;
        }

        options = options || {};

        // Check if Monaco loader is already available
        if (typeof require === 'undefined' || !require.config) {
            console.warn('[MonacoSetup] Monaco loader not available. Using fallback textarea.');
            this._createFallbackEditor(options);
            return;
        }

        // Configure Monaco
        require.config({
            paths: {
                vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
            }
        });

        // Load Monaco
        require(['vs/editor/editor.main'], () => {
            this._setupEditor(options);
        });

        // Handle loading error
        require.onError = (err) => {
            console.warn('[MonacoSetup] Failed to load Monaco:', err);
            this._createFallbackEditor(options);
        };
    },

    /**
     * Set up the Monaco editor with BlockVerse theme and API completions.
     */
    _setupEditor(options) {
        // Define custom dark theme
        monaco.editor.defineTheme('blockverse-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '6c6c80', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'c792ea' },
                { token: 'string', foreground: 'c3e88d' },
                { token: 'number', foreground: 'f78c6c' },
                { token: 'type', foreground: 'ffcb6b' },
                { token: 'identifier', foreground: '82aaff' },
                { token: 'delimiter', foreground: '89ddff' },
            ],
            colors: {
                'editor.background': '#0f0f23',
                'editor.foreground': '#eeffff',
                'editorLineNumber.foreground': '#4a4a6a',
                'editorLineNumber.activeForeground': '#a0a0b0',
                'editor.selectionBackground': '#6c5ce740',
                'editor.lineHighlightBackground': '#1a1a2e',
                'editorCursor.foreground': '#6c5ce7',
                'editorIndentGuide.background': '#1a1a2e',
                'editorIndentGuide.activeBackground': '#2d2d44',
                'editorBracketMatch.background': '#6c5ce730',
                'editorBracketMatch.border': '#6c5ce7',
                'scrollbar.shadow': '#00000000',
                'scrollbarSlider.background': '#2d2d4480',
                'scrollbarSlider.hoverBackground': '#3d3d5480',
                'scrollbarSlider.activeBackground': '#6c5ce780',
            },
        });

        // Create editor
        this.editor = monaco.editor.create(this._container, {
            value: options.value || this._getDefaultScript(),
            language: 'javascript',
            theme: 'blockverse-dark',
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            fontLigatures: true,
            lineNumbers: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            bracketPairColorization: { enabled: true },
            suggest: {
                showKeywords: true,
                showSnippets: true,
            },
            quickSuggestions: {
                other: true,
                comments: false,
                strings: false,
            },
            parameterHints: { enabled: true },
            scrollBeyondLastLine: false,
            renderWhitespace: 'none',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            padding: { top: 8, bottom: 8 },
        });

        // Register autocomplete for Game API
        this._registerCompletions();

        // Register custom keybindings
        this._registerKeybindings();

        this._isReady = true;
        console.log('[MonacoSetup] Editor initialized');

        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('monaco:ready'));
    },

    /**
     * Create a fallback textarea editor if Monaco fails to load.
     */
    _createFallbackEditor(options) {
        this._container.innerHTML = '';

        const textarea = document.createElement('textarea');
        textarea.value = options.value || this._getDefaultScript();
        textarea.style.cssText = 'width:100%;height:100%;background:#0f0f23;color:#eeffff;border:none;outline:none;resize:none;padding:8px;font-family:"JetBrains Mono","Fira Code","Consolas",monospace;font-size:13px;line-height:1.5;tab-size:2;';
        textarea.spellcheck = false;

        this._container.appendChild(textarea);

        // Store reference
        this.editor = {
            getValue: () => textarea.value,
            setValue: (v) => { textarea.value = v; },
            onDidChangeModelContent: (cb) => { textarea.addEventListener('input', cb); },
            focus: () => textarea.focus(),
            layout: () => {},
            getAction: () => null,
        };

        this._isReady = true;
        window.dispatchEvent(new CustomEvent('monaco:ready'));
    },

    // =============================================
    // AUTOCOMPLETE REGISTRATION
    // =============================================

    _registerCompletions() {
        if (!monaco) return;

        // Game API completion items
        const apiCompletions = [
            // Block API
            { label: 'Block', detail: 'Game API', insertText: 'Block', kind: monaco.languages.CompletionItemKind.Module },
            { label: 'Block.place', detail: 'Block.place(x, y, z, type)', insertText: 'Block.place(${1:x}, ${2:y}, ${3:z}, ${4:"grass"})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Place a block at the given position' },
            { label: 'Block.remove', detail: 'Block.remove(x, y, z)', insertText: 'Block.remove(${1:x}, ${2:y}, ${3:z})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Remove a block at the given position' },
            { label: 'Block.get', detail: 'Block.get(x, y, z)', insertText: 'Block.get(${1:x}, ${2:y}, ${3:z})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Get block data at position (or null)' },
            { label: 'Block.find', detail: 'Block.find(type)', insertText: 'Block.find(${1:"grass"})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Find all blocks of a type' },
            { label: 'Block.getAll', detail: 'Block.getAll()', insertText: 'Block.getAll()', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Get all blocks in the world' },
            { label: 'Block.count', detail: 'Block.count()', insertText: 'Block.count()', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Get total block count' },

            // Player API
            { label: 'Player', detail: 'Game API', insertText: 'Player', kind: monaco.languages.CompletionItemKind.Module },
            { label: 'Player.getPosition', detail: 'Player.getPosition()', insertText: 'Player.getPosition()', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Get player position {x, y, z}' },
            { label: 'Player.setPosition', detail: 'Player.setPosition(x, y, z)', insertText: 'Player.setPosition(${1:x}, ${2:y}, ${3:z})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Set player position' },
            { label: 'Player.getSpeed', detail: 'Player.getSpeed()', insertText: 'Player.getSpeed()', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Get player movement speed' },
            { label: 'Player.setSpeed', detail: 'Player.setSpeed(speed)', insertText: 'Player.setSpeed(${1:10})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Set player movement speed (1-50)' },
            { label: 'Player.getName', detail: 'Player.getName()', insertText: 'Player.getName()', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Get player username' },

            // Chat API
            { label: 'Chat', detail: 'Game API', insertText: 'Chat', kind: monaco.languages.CompletionItemKind.Module },
            { label: 'Chat.send', detail: 'Chat.send(message)', insertText: 'Chat.send(${1:"Hello!"})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Send a chat message' },
            { label: 'Chat.onMessage', detail: 'Chat.onMessage(callback)', insertText: 'Chat.onMessage(function(msg) {\n  ${1:// handle message}\n})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Listen for chat messages' },

            // UI API
            { label: 'UI', detail: 'Game API', insertText: 'UI', kind: monaco.languages.CompletionItemKind.Module },
            { label: 'UI.showHint', detail: 'UI.showHint(text, duration)', insertText: 'UI.showHint(${1:"Hello!"}, ${2:3})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Show a hint notification' },
            { label: 'UI.showScore', detail: 'UI.showScore(value)', insertText: 'UI.showScore(${1:0})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Display score on screen' },
            { label: 'UI.showTimer', detail: 'UI.showTimer(seconds)', insertText: 'UI.showTimer(${1:60})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Show countdown timer' },
            { label: 'UI.hideTimer', detail: 'UI.hideTimer()', insertText: 'UI.hideTimer()', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Hide the timer display' },
            { label: 'UI.showLeaderboard', detail: 'UI.showLeaderboard(players)', insertText: 'UI.showLeaderboard(${1:[]})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Show a leaderboard' },

            // Tween API
            { label: 'Tween', detail: 'Game API', insertText: 'Tween', kind: monaco.languages.CompletionItemKind.Module },
            { label: 'Tween.moveTo', detail: 'await Tween.moveTo(obj, x, y, z, duration)', insertText: 'await Tween.moveTo(${1:obj}, ${2:0}, ${3:0}, ${4:0}, ${5:1})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Animate object position' },
            { label: 'Tween.rotateTo', detail: 'await Tween.rotateTo(obj, rx, ry, rz, duration)', insertText: 'await Tween.rotateTo(${1:obj}, ${2:0}, ${3:0}, ${4:0}, ${5:1})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Animate object rotation' },
            { label: 'Tween.scaleTo', detail: 'await Tween.scaleTo(obj, sx, sy, sz, duration)', insertText: 'await Tween.scaleTo(${1:obj}, ${2:1}, ${3:1}, ${4:1}, ${5:1})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Animate object scale' },
            { label: 'Tween.wait', detail: 'await Tween.wait(seconds)', insertText: 'await Tween.wait(${1:1})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Wait for specified seconds' },

            // Sound API
            { label: 'Sound', detail: 'Game API', insertText: 'Sound', kind: monaco.languages.CompletionItemKind.Module },
            { label: 'Sound.play', detail: 'Sound.play(name)', insertText: 'Sound.play(${1:"click"})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Play a built-in sound. Options: click, place, delete, jump, land, coin, win, lose' },

            // Events API
            { label: 'Events', detail: 'Game API', insertText: 'Events', kind: monaco.languages.CompletionItemKind.Module },
            { label: 'Events.on', detail: 'Events.on(event, callback)', insertText: 'Events.on(${1:"gameStart"}, function(data) {\n  ${2:// handle event}\n})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Listen for an event. Events: gameStart, blockPlace, blockRemove, scriptError' },
            { label: 'Events.off', detail: 'Events.off(event, callback)', insertText: 'Events.off(${1:"gameStart"}, ${2:callback})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Remove an event listener' },
            { label: 'Events.emit', detail: 'Events.emit(event, data)', insertText: 'Events.emit(${1:"customEvent"}, ${2:{}})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Emit a custom event' },

            // Timer API
            { label: 'Timer', detail: 'Game API', insertText: 'Timer', kind: monaco.languages.CompletionItemKind.Module },
            { label: 'Timer.every', detail: 'Timer.every(seconds, callback)', insertText: 'Timer.every(${1:1}, function() {\n  ${2:// runs every second}\n})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Run callback every N seconds' },
            { label: 'Timer.after', detail: 'Timer.after(seconds, callback)', insertText: 'Timer.after(${1:3}, function() {\n  ${2:// runs once after 3 seconds}\n})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Run callback once after N seconds' },
            { label: 'Timer.stop', detail: 'Timer.stop(id)', insertText: 'Timer.stop(${1:timerId})', kind: monaco.languages.CompletionItemKind.Function, documentation: 'Stop a timer by ID' },
        ];

        // Block types for string completion
        const blockTypes = Object.keys(BV.BLOCK_TYPES || {});
        for (const bt of blockTypes) {
            apiCompletions.push({
                label: '"' + bt + '"',
                detail: 'Block Type: ' + bt,
                insertText: bt,
                kind: monaco.languages.CompletionItemKind.Enum,
                documentation: (BV.BLOCK_TYPES[bt] || {}).name || bt,
            });
        }

        // Register completions provider
        monaco.languages.registerCompletionItemProvider('javascript', {
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };

                return {
                    suggestions: apiCompletions.map(item => ({
                        ...item,
                        range,
                    })),
                };
            },
        });
    },

    // =============================================
    // KEYBINDINGS
    // =============================================

    _registerKeybindings() {
        if (!this.editor || !this.editor.addAction) return;

        // Ctrl+S / Cmd+S -> Save script
        this.editor.addAction({
            id: 'save-script',
            label: 'Save Script',
            keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
            ],
            run: () => {
                window.dispatchEvent(new CustomEvent('script:save'));
            },
        });

        // Ctrl+Enter -> Run script
        this.editor.addAction({
            id: 'run-script',
            label: 'Run Script',
            keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
            ],
            run: () => {
                window.dispatchEvent(new CustomEvent('script:run'));
            },
        });

        // Ctrl+Shift+Enter -> Stop script
        this.editor.addAction({
            id: 'stop-script',
            label: 'Stop Script',
            keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
            ],
            run: () => {
                window.dispatchEvent(new CustomEvent('script:stop'));
            },
        });
    },

    // =============================================
    // PUBLIC API
    // =============================================

    getValue() {
        if (!this.editor) return '';
        return this.editor.getValue();
    },

    setValue(code) {
        if (!this.editor) return;
        this.editor.setValue(code);
    },

    focus() {
        if (!this.editor) return;
        if (this.editor.focus) {
            this.editor.focus();
        }
    },

    layout() {
        if (!this.editor) return;
        if (this.editor.layout) {
            this.editor.layout();
        }
    },

    isReady() {
        return this._isReady;
    },

    // =============================================
    // DEFAULT SCRIPT
    // =============================================

    _getDefaultScript() {
        return `// Welcome to BlockVerse Scripting!
// Use the Game API to create interactive games.
// Press Ctrl+Enter to run, Ctrl+S to save.

Events.on("gameStart", async function() {
  UI.showHint("Welcome to my game!", 3);
  Sound.play("coin");

  // Place some blocks
  Block.place(0, 1, 0, "gold");
  Block.place(1, 1, 0, "diamond");
  Block.place(-1, 1, 0, "diamond");

  // Wait and show score
  await Tween.wait(2);
  UI.showScore(100);
  Sound.play("win");

  // Set up a repeating timer
  Timer.every(5, function() {
    UI.showHint("Keep playing!", 2);
  });
});

// Listen for block placement
Events.on("blockPlace", function(data) {
  console.log("Block placed:", data.type, "at", data.x, data.y, data.z);
  Sound.play("place");
});
`;
    },
};
