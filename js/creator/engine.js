// ============================================
// BLOCKVERSE - Scripting Engine (engine.js)
// ============================================
// Core engine that bridges the visual node editor,
// Monaco code editor, Web Worker sandbox, and Game API.
// Manages script lifecycle: load, compile, run, stop.
// ============================================

const ScriptEngine = {
    _worker: null,
    _scripts: {},
    _activeScriptId: null,
    _isRunning: false,
    _eventListeners: {},  // callbackId -> { event, filter }
    _timerTracker: {},
    _tweenTracker: {},

    // =============================================
    // INITIALIZATION
    // =============================================

    init() {
        // Initialize the Game API on the main thread
        if (typeof GameAPI !== 'undefined') {
            GameAPI.init((msg) => {
                // Send message to worker if needed
                if (this._worker) {
                    this._worker.sendResult(msg.callbackId, msg.result);
                }
            });
        }

        // Create the sandbox worker
        if (typeof Sandbox !== 'undefined') {
            this._worker = Sandbox.create({
                onMessage: this._handleWorkerMessage.bind(this),
                onError: this._handleWorkerError.bind(this),
                onConsole: this._handleWorkerConsole.bind(this),
            });
        }

        // Listen to world events and forward to worker
        this._setupWorldEventBridge();

        console.log('[ScriptEngine] Initialized');
    },

    // =============================================
    // SCRIPT MANAGEMENT
    // =============================================

    /**
     * Load a script (prepare but don't execute).
     * @param {string} id - Script identifier
     * @param {string} code - JavaScript source code
     * @param {string} type - 'javascript' or 'visual'
     */
    loadScript(id, code, type) {
        type = type || 'javascript';

        // Store the script
        this._scripts[id] = {
            id,
            code,
            type,
            loadedAt: Date.now(),
        };

        // If visual, compile to JS first
        if (type === 'visual') {
            code = this.compileNodesToJS(code);
            this._scripts[id].compiledCode = code;
        }

        // Load into the worker
        if (this._worker) {
            this._worker.loadScript(id, code);
        }

        this._activeScriptId = id;
        this._logToConsole('info', 'Script loaded: ' + id);
    },

    /**
     * Get the currently active script code.
     */
    getActiveScript() {
        if (this._activeScriptId && this._scripts[this._activeScriptId]) {
            return this._scripts[this._activeScriptId];
        }
        return null;
    },

    /**
     * Update the active script code.
     */
    updateActiveScript(code) {
        if (this._activeScriptId && this._scripts[this._activeScriptId]) {
            this._scripts[this._activeScriptId].code = code;
        }
    },

    // =============================================
    // EXECUTION
    // =============================================

    /**
     * Run the currently loaded script.
     */
    run() {
        if (this._isRunning) {
            this._logToConsole('warn', 'Script is already running. Stop it first.');
            return;
        }

        this._isRunning = true;
        this._logToConsole('info', 'Starting script...');

        // Fire gameStart event
        if (typeof GameAPI !== 'undefined') {
            GameAPI.Events.emit('gameStart', {});
        }

        if (this._worker) {
            this._worker.runScript();
        }
    },

    /**
     * Run a specific script by ID.
     */
    runScript(id) {
        const script = this._scripts[id];
        if (!script) {
            this._logToConsole('error', 'Script not found: ' + id);
            return;
        }
        this.loadScript(id, script.code, script.type);
        this.run();
    },

    /**
     * Stop all script execution.
     */
    stop() {
        this._isRunning = false;
        this._logToConsole('warn', 'Stopping script...');

        // Stop all timers
        if (typeof GameAPI !== 'undefined') {
            GameAPI.Timer.stopAll();
        }

        // Clear event listeners
        this._eventListeners = {};

        if (this._worker) {
            this._worker.stopScript();
        }
    },

    /**
     * Check if a script is currently running.
     */
    isRunning() {
        return this._isRunning;
    },

    // =============================================
    // NODE COMPILER (Visual -> JavaScript)
    // =============================================

    /**
     * Compile a visual node graph to executable JavaScript.
     * @param {Object|string} nodeGraph - JSON node graph or string
     * @returns {string} Executable JavaScript code
     */
    compileNodesToJS(nodeGraph) {
        // If it's a string, try to parse it
        if (typeof nodeGraph === 'string') {
            try {
                nodeGraph = JSON.parse(nodeGraph);
            } catch (e) {
                return nodeGraph; // Already JS code
            }
        }

        if (!nodeGraph || !nodeGraph.nodes) {
            return '// No visual nodes to compile\n';
        }

        let code = '// Auto-generated from visual node editor\n\n';
        code += '// Node events\n';
        code += 'Events.on("gameStart", async function() {\n';

        // Process nodes in order
        const sortedNodes = (nodeGraph.nodes || []).sort((a, b) => (a.y || 0) - (b.y || 0));

        for (const node of sortedNodes) {
            switch (node.type) {
                case 'event_start':
                    // Already wrapped in gameStart
                    break;
                case 'block_place':
                    code += '    Block.place(' + (node.x || 0) + ', ' + (node.y_pos || 0) + ', ' + (node.z || 0) + ', "' + (node.blockType || 'grass') + '");\n';
                    break;
                case 'block_remove':
                    code += '    Block.remove(' + (node.x || 0) + ', ' + (node.y_pos || 0) + ', ' + (node.z || 0) + ');\n';
                    break;
                case 'player_message':
                    code += '    UI.showHint("' + (node.text || 'Hello!') + '", ' + (node.duration || 3) + ');\n';
                    break;
                case 'play_sound':
                    code += '    Sound.play("' + (node.soundName || 'click') + '");\n';
                    break;
                case 'wait':
                    code += '    await Tween.wait(' + (node.seconds || 1) + ');\n';
                    break;
                case 'set_score':
                    code += '    UI.showScore(' + (node.score || 0) + ');\n';
                    break;
                case 'timer':
                    code += '    Timer.' + (node.repeat ? 'every' : 'after') + '(' + (node.seconds || 1) + ', function() {\n';
                    code += '        // Timer callback\n';
                    code += '    });\n';
                    break;
                case 'custom_code':
                    code += '    ' + (node.code || '') + '\n';
                    break;
                default:
                    code += '    // Unknown node type: ' + node.type + '\n';
            }
        }

        code += '});\n';
        return code;
    },

    // =============================================
    // WORKER MESSAGE HANDLING
    // =============================================

    _handleWorkerMessage(msg) {
        switch (msg.type) {
            case 'api_call':
                // Worker wants to call a Game API method
                this._handleAPICall(msg);
                break;
            case 'event_listen':
                // Worker wants to listen to an event
                this._handleEventListen(msg);
                break;
            case 'timer_create':
                // Worker created a timer (track it)
                this._timerTracker[msg.id] = msg.interval;
                break;
            case 'timer_stop':
                delete this._timerTracker[msg.id];
                break;
            case 'tween':
                // Worker wants to create a tween
                this._handleTween(msg);
                break;
        }
    },

    _handleAPICall(msg) {
        if (typeof GameAPI === 'undefined') return;

        const result = GameAPI.handleMessage({
            api: msg.api,
            method: msg.method,
            args: msg.args,
        });

        // Send result back to worker
        if (this._worker) {
            // Most API calls are fire-and-forget, no callbackId needed
            // If we needed to support synchronous returns, we'd use callbackId
        }
    },

    _handleEventListen(msg) {
        // Store the event listener mapping
        this._eventListeners[msg.callbackId] = {
            event: msg.event,
            filter: msg.filter,
        };
    },

    _handleTween(msg) {
        // Tween execution happens on main thread for Three.js access
        if (typeof GameAPI !== 'undefined') {
            const tween = GameAPI.Tween;
            let promise;

            switch (msg.tweenType) {
                case 'moveTo':
                    promise = tween.moveTo(msg.object, msg.x, msg.y, msg.z, msg.duration);
                    break;
                case 'rotateTo':
                    promise = tween.rotateTo(msg.object, msg.rx, msg.ry, msg.rz, msg.duration);
                    break;
                case 'scaleTo':
                    promise = tween.scaleTo(msg.object, msg.sx, msg.sy, msg.sz, msg.duration);
                    break;
            }

            if (promise && this._worker) {
                promise.then(() => {
                    this._worker.sendResult(msg.callbackId, true);
                }).catch(() => {
                    this._worker.sendResult(msg.callbackId, false);
                });
            }
        }
    },

    _handleWorkerError(error) {
        this._isRunning = false;
        this._logToConsole('error', 'Script error: ' + error);

        // Dispatch error event
        if (typeof GameAPI !== 'undefined') {
            GameAPI.Events.emit('scriptError', { error });
        }
    },

    _handleWorkerConsole(level, message) {
        this._logToConsole(level, message);
    },

    // =============================================
    // WORLD EVENT BRIDGE
    // =============================================

    _setupWorldEventBridge() {
        // Forward block events from the world to worker scripts
        window.addEventListener('block:place', (e) => {
            this._fireWorkerEvent('blockPlace', e.detail);
            if (typeof GameAPI !== 'undefined') {
                GameAPI.Events.emit('blockPlace', e.detail);
            }
        });

        window.addEventListener('block:remove', (e) => {
            this._fireWorkerEvent('blockRemove', e.detail);
            if (typeof GameAPI !== 'undefined') {
                GameAPI.Events.emit('blockRemove', e.detail);
            }
        });

        window.addEventListener('tools:block_placed', (e) => {
            if (typeof GameAPI !== 'undefined') {
                GameAPI.Events.emit('blockPlace', e.detail);
            }
        });

        window.addEventListener('tools:block_removed', (e) => {
            if (typeof GameAPI !== 'undefined') {
                GameAPI.Events.emit('blockRemove', e.detail);
            }
        });
    },

    _fireWorkerEvent(eventName, data) {
        if (!this._worker || !this._isRunning) return;

        // Find all listeners for this event
        for (const callbackId in this._eventListeners) {
            const listener = this._eventListeners[callbackId];
            if (listener.event === eventName) {
                // Check filter if any
                if (listener.filter && data && data.type !== listener.filter) continue;
                this._worker.fireEvent(parseInt(callbackId), data);
            }
        }
    },

    // =============================================
    // CONSOLE LOGGING
    // =============================================

    _consoleEl: null,

    setConsoleElement(el) {
        this._consoleEl = el;
    },

    _logToConsole(level, message) {
        if (!this._consoleEl) return;

        const line = document.createElement('div');
        line.className = 'script-console-line ' + level;
        line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;

        // Auto-scroll to bottom
        this._consoleEl.appendChild(line);
        this._consoleEl.scrollTop = this._consoleEl.scrollHeight;

        // Limit lines
        while (this._consoleEl.children.length > 200) {
            this._consoleEl.removeChild(this._consoleEl.firstChild);
        }
    },

    clearConsole() {
        if (this._consoleEl) {
            this._consoleEl.innerHTML = '';
        }
    },

    // =============================================
    // UPDATE LOOP (called from creator render loop)
    // =============================================

    update() {
        if (this._isRunning && typeof GameAPI !== 'undefined') {
            GameAPI.update();
        }
    },

    // =============================================
    // CLEANUP
    // =============================================

    dispose() {
        this.stop();
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;
        }
        this._scripts = {};
        this._eventListeners = {};
        this._timerTracker = {};
    },
};
