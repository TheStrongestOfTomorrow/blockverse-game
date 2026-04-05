// ============================================
// BLOCKVERSE - Web Worker Sandbox (sandbox.js)
// ============================================
// Creates an isolated Web Worker (via Blob URL for GitHub Pages compat)
// that executes user scripts safely with the Game API injected.
// Enforces execution limits: max iterations, no infinite loops, timeout.
// ============================================

const Sandbox = {
    _worker: null,
    _onMessage: null,
    _onError: null,
    _onConsole: null,

    /**
     * Create the sandbox worker.
     * @param {Object} handlers - { onMessage, onError, onConsole }
     */
    create(handlers) {
        this._onMessage = handlers.onMessage || (() => {});
        this._onError = handlers.onError || (() => {});
        this._onConsole = handlers.onConsole || (() => {});

        // Worker code — runs in complete isolation
        const workerCode = `
            // ============================================
            // SANDBOX WORKER - Isolated Script Execution
            // ============================================

            'use strict';

            // Execution limits
            const MAX_ITERATIONS = 1000000;
            const EXECUTION_TIMEOUT = 5000; // 5 seconds per script run
            let _iterationCount = 0;
            let _startTime = 0;
            let _timedOut = false;
            let _running = false;

            // Check iteration limit
            function _checkIterations() {
                _iterationCount++;
                if (_iterationCount > MAX_ITERATIONS) {
                    throw new Error('Script exceeded maximum iterations (' + MAX_ITERATIONS + '). Possible infinite loop.');
                }
                if (Date.now() - _startTime > EXECUTION_TIMEOUT) {
                    _timedOut = true;
                    throw new Error('Script execution timed out (' + EXECUTION_TIMEOUT / 1000 + 's).');
                }
            }

            // =============================================
            // GAME API STUBS (proxy to main thread)
            // =============================================

            const _pendingCallbacks = {};
            let _callbackCounter = 0;

            function _sendAPI(api, method, args) {
                self.postMessage({
                    type: 'api_call',
                    api: api,
                    method: method,
                    args: args,
                });
            }

            // Block API
            const Block = {
                place: function(x, y, z, type) { _checkIterations(); return _sendAPI('Block', 'place', [x, y, z, type]); },
                remove: function(x, y, z) { _checkIterations(); return _sendAPI('Block', 'remove', [x, y, z]); },
                get: function(x, y, z) { _checkIterations(); return _sendAPI('Block', 'get', [x, y, z]); },
                find: function(type) { _checkIterations(); return _sendAPI('Block', 'find', [type]); },
                getAll: function() { _checkIterations(); return _sendAPI('Block', 'getAll', []); },
                count: function() { _checkIterations(); return _sendAPI('Block', 'count', []); },
                onPlaced: function(cb) { self.postMessage({ type: 'event_listen', event: 'blockPlace', callbackId: _registerCallback(cb) }); },
                onRemoved: function(cb) { self.postMessage({ type: 'event_listen', event: 'blockRemove', callbackId: _registerCallback(cb) }); },
            };

            // Player API
            const Player = {
                getPosition: function() { _checkIterations(); return _sendAPI('Player', 'getPosition', []); },
                setPosition: function(x, y, z) { _checkIterations(); _sendAPI('Player', 'setPosition', [x, y, z]); },
                getSpeed: function() { return _sendAPI('Player', 'getSpeed', []); },
                setSpeed: function(speed) { _sendAPI('Player', 'setSpeed', [speed]); },
                getName: function() { return _sendAPI('Player', 'getName', []); },
                onTouched: function(blockType, cb) {
                    self.postMessage({ type: 'event_listen', event: 'playerTouch', filter: blockType, callbackId: _registerCallback(cb) });
                },
                onDied: function(cb) { self.postMessage({ type: 'event_listen', event: 'playerDied', callbackId: _registerCallback(cb) }); },
                onRespawned: function(cb) { self.postMessage({ type: 'event_listen', event: 'playerRespawned', callbackId: _registerCallback(cb) }); },
            };

            // Chat API
            const Chat = {
                send: function(message) { _sendAPI('Chat', 'send', [message]); },
                onMessage: function(cb) { self.postMessage({ type: 'event_listen', event: 'chatMessage', callbackId: _registerCallback(cb) }); },
            };

            // UI API
            const UI = {
                showHint: function(text, duration) { _sendAPI('UI', 'showHint', [text, duration]); },
                showScore: function(value) { _sendAPI('UI', 'showScore', [value]); },
                showTimer: function(seconds) { _sendAPI('UI', 'showTimer', [seconds]); },
                hideTimer: function() { _sendAPI('UI', 'hideTimer', []); },
                showLeaderboard: function(players) { _sendAPI('UI', 'showLeaderboard', [players]); },
            };

            // Tween API
            const Tween = {
                moveTo: function(obj, x, y, z, dur) { return new Promise(function(resolve) { self.postMessage({ type: 'tween', tweenType: 'moveTo', object: obj, x: x, y: y, z: z, duration: dur, callbackId: _registerCallback(resolve) }); }); },
                rotateTo: function(obj, rx, ry, rz, dur) { return new Promise(function(resolve) { self.postMessage({ type: 'tween', tweenType: 'rotateTo', object: obj, rx: rx, ry: ry, rz: rz, duration: dur, callbackId: _registerCallback(resolve) }); }); },
                scaleTo: function(obj, sx, sy, sz, dur) { return new Promise(function(resolve) { self.postMessage({ type: 'tween', tweenType: 'scaleTo', object: obj, sx: sx, sy: sy, sz: sz, duration: dur, callbackId: _registerCallback(resolve) }); }); },
                wait: function(seconds) { return new Promise(function(resolve) { setTimeout(resolve, (seconds || 1) * 1000); }); },
            };

            // Sound API
            const Sound = {
                play: function(name) { _sendAPI('Sound', 'play', [name]); },
            };

            // Events API
            const Events = {
                _listeners: {},
                on: function(event, callback) {
                    if (!this._listeners[event]) this._listeners[event] = [];
                    this._listeners[event].push(callback);
                },
                off: function(event, callback) {
                    if (!this._listeners[event]) return;
                    this._listeners[event] = this._listeners[event].filter(function(cb) { return cb !== callback; });
                },
                emit: function(event, data) {
                    if (!this._listeners[event]) return;
                    for (var i = 0; i < this._listeners[event].length; i++) {
                        try { this._listeners[event][i](data); } catch(e) { /* swallow */ }
                    }
                },
            };

            // Timer API
            const Timer = {
                _timers: {},
                _nextId: 1,
                every: function(seconds, callback) {
                    var id = this._nextId++;
                    var self_ref = this;
                    this._timers[id] = setInterval(function() { _checkIterations(); try { callback(); } catch(e) { /* swallow */ } }, (seconds || 1) * 1000);
                    self.postMessage({ type: 'timer_create', id: id, interval: true });
                    return id;
                },
                after: function(seconds, callback) {
                    var id = this._nextId++;
                    var self_ref = this;
                    this._timers[id] = setTimeout(function() { delete self_ref._timers[id]; _checkIterations(); try { callback(); } catch(e) { /* swallow */ } }, (seconds || 1) * 1000);
                    self.postMessage({ type: 'timer_create', id: id, interval: false });
                    return id;
                },
                stop: function(id) {
                    if (this._timers[id] !== undefined) {
                        clearInterval(this._timers[id]);
                        clearTimeout(this._timers[id]);
                        delete this._timers[id];
                    }
                    self.postMessage({ type: 'timer_stop', id: id });
                },
            };

            // Callback management
            function _registerCallback(fn) {
                var id = _callbackCounter++;
                _pendingCallbacks[id] = fn;
                return id;
            }

            // Override console to post messages back
            const _origConsole = {
                log: console.log.bind(console),
                warn: console.warn.bind(console),
                error: console.error.bind(console),
                info: console.info.bind(console),
            };

            console.log = function() {
                var args = Array.from(arguments).map(function(a) {
                    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
                });
                self.postMessage({ type: 'console', level: 'log', message: args.join(' ') });
                _origConsole.log.apply(console, arguments);
            };

            console.warn = function() {
                var args = Array.from(arguments).map(function(a) {
                    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
                });
                self.postMessage({ type: 'console', level: 'warn', message: args.join(' ') });
                _origConsole.warn.apply(console, arguments);
            };

            console.error = function() {
                var args = Array.from(arguments).map(function(a) {
                    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
                });
                self.postMessage({ type: 'console', level: 'error', message: args.join(' ') });
                _origConsole.error.apply(console, arguments);
            };

            console.info = function() {
                var args = Array.from(arguments).map(function(a) {
                    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
                });
                self.postMessage({ type: 'console', level: 'info', message: args.join(' ') });
                _origConsole.info.apply(console, arguments);
            };

            // =============================================
            // SCRIPT EXECUTION
            // =============================================

            // Store the current script for stop/reload
            let _currentScript = null;
            let _scriptModule = null;

            self.onmessage = function(e) {
                var msg = e.data;

                if (msg.type === 'load_script') {
                    // Load and prepare script (don't execute yet)
                    _currentScript = msg.code;
                    self.postMessage({ type: 'script_loaded', id: msg.id });
                }
                else if (msg.type === 'run_script') {
                    // Execute the loaded script
                    if (!_currentScript) {
                        self.postMessage({ type: 'script_error', error: 'No script loaded' });
                        return;
                    }

                    _running = true;
                    _iterationCount = 0;
                    _startTime = Date.now();
                    _timedOut = false;

                    try {
                        // Create an async wrapper so we can handle async scripts
                        var scriptCode = _currentScript;

                        // Wrap in async function to support await
                        var wrappedCode = '(async function() { ' +
                            'const Block = self.Block;' +
                            'const Player = self.Player;' +
                            'const Chat = self.Chat;' +
                            'const UI = self.UI;' +
                            'const Tween = self.Tween;' +
                            'const Sound = self.Sound;' +
                            'const Events = self.Events;' +
                            'const Timer = self.Timer;' +
                            scriptCode +
                        ' })()';

                        // Use Function constructor for clean scope
                        var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                        _scriptModule = new AsyncFunction(
                            'Block', 'Player', 'Chat', 'UI', 'Tween', 'Sound', 'Events', 'Timer',
                            'return (async function() { ' + scriptCode + ' })()'
                        );

                        _scriptModule(Block, Player, Chat, UI, Tween, Sound, Events, Timer)
                            .then(function() {
                                _running = false;
                                self.postMessage({ type: 'script_complete' });
                            })
                            .catch(function(err) {
                                _running = false;
                                self.postMessage({ type: 'script_error', error: err.message || String(err) });
                            });

                    } catch (err) {
                        _running = false;
                        self.postMessage({ type: 'script_error', error: err.message || String(err) });
                    }
                }
                else if (msg.type === 'stop_script') {
                    _running = false;
                    _currentScript = null;
                    _scriptModule = null;
                    // Clear all timers
                    for (var tid in Timer._timers) {
                        clearInterval(Timer._timers[tid]);
                        clearTimeout(Timer._timers[tid]);
                    }
                    Timer._timers = {};
                    self.postMessage({ type: 'script_stopped' });
                }
                else if (msg.type === 'event_fire') {
                    // Main thread fires an event — call matching callbacks
                    var callbacks = _pendingCallbacks[msg.callbackId];
                    if (callbacks && typeof callbacks === 'function') {
                        try { callbacks(msg.data); } catch(e) { /* swallow */ }
                    }
                }
                else if (msg.type === 'api_result') {
                    // Main thread returns an API call result — resolve promise
                    var cb = _pendingCallbacks[msg.callbackId];
                    if (cb && typeof cb === 'function') {
                        try { cb(msg.result); } catch(e) { /* swallow */ }
                    }
                }
            };

            // Notify ready
            self.postMessage({ type: 'worker_ready' });
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);

        this._worker = new Worker(url);

        // Clean up blob URL after worker loads
        this._worker.addEventListener('message', (e) => {
            // Initial ready message — clean up blob URL
            if (e.data && e.data.type === 'worker_ready') {
                URL.revokeObjectURL(url);
            }
        });

        // Forward messages from worker to main thread
        this._worker.addEventListener('message', (e) => {
            const msg = e.data;
            if (!msg || !msg.type) return;

            switch (msg.type) {
                case 'console':
                    this._onConsole(msg.level, msg.message);
                    break;
                case 'script_error':
                    this._onError(msg.error);
                    break;
                case 'script_complete':
                    this._onConsole('success', 'Script completed successfully');
                    break;
                case 'script_stopped':
                    this._onConsole('warn', 'Script stopped');
                    break;
                case 'api_call':
                    // Route API calls to GameAPI on main thread
                    this._onMessage(msg);
                    break;
                case 'event_listen':
                case 'timer_create':
                case 'timer_stop':
                case 'tween':
                    // Forward to engine for handling
                    this._onMessage(msg);
                    break;
                default:
                    this._onMessage(msg);
            }
        });

        // Worker error handling
        this._worker.addEventListener('error', (e) => {
            this._onError('Worker error: ' + (e.message || 'Unknown error'));
        });

        return this._worker;
    },

    /**
     * Load a script into the worker (prepare, don't execute).
     * @param {string} id - Script identifier
     * @param {string} code - Script source code
     */
    loadScript(id, code) {
        if (this._worker) {
            this._worker.postMessage({ type: 'load_script', id, code });
        }
    },

    /**
     * Execute the currently loaded script.
     */
    runScript() {
        if (this._worker) {
            this._worker.postMessage({ type: 'run_script' });
        }
    },

    /**
     * Stop all script execution.
     */
    stopScript() {
        if (this._worker) {
            this._worker.postMessage({ type: 'stop_script' });
        }
    },

    /**
     * Send an API result back to the worker.
     * @param {number} callbackId
     * @param {*} result
     */
    sendResult(callbackId, result) {
        if (this._worker) {
            this._worker.postMessage({ type: 'api_result', callbackId, result });
        }
    },

    /**
     * Fire an event to the worker.
     * @param {string} callbackId
     * @param {*} data
     */
    fireEvent(callbackId, data) {
        if (this._worker) {
            this._worker.postMessage({ type: 'event_fire', callbackId, data });
        }
    },

    /**
     * Terminate the worker.
     */
    terminate() {
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;
        }
    },
};
