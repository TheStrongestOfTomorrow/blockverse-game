// ============================================
// BLOCKVERSE - Game API (api.js)
// ============================================
// Kid-friendly scripting API that user scripts can use.
// These are proxy stubs — the real implementations live on
// the main thread. The worker sends messages via postMessage
// and the engine routes them to these handlers.
// ============================================

const GameAPI = {
    // Track registered callbacks by event name
    _callbacks: {},
    _callbackId: 0,

    /**
     * Initialize the API proxy — call from engine when setting up.
     * @param {Function} sendToWorker - Function to send messages to worker
     */
    init(sendToWorker) {
        this._sendToWorker = sendToWorker;
    },

    /**
     * Handle a message from the worker (API call request).
     * @param {Object} msg - { api, method, args, callbackId }
     * @returns {*} result to send back to worker
     */
    handleMessage(msg) {
        if (!msg.api || !msg.method) return undefined;

        const namespace = this[msg.api];
        if (!namespace || typeof namespace[msg.method] !== 'function') {
            console.warn('[GameAPI] Unknown call:', msg.api + '.' + msg.method);
            return undefined;
        }

        try {
            return namespace[msg.method](...msg.args);
        } catch (err) {
            console.error('[GameAPI] Error in', msg.api + '.' + msg.method, err);
            return { __error: err.message };
        }
    },

    // =============================================
    // BLOCK API
    // =============================================
    Block: {
        place(x, y, z, type) {
            if (typeof World !== 'undefined') {
                return World.addBlock(x, y, z, type, true);
            }
            return false;
        },

        remove(x, y, z) {
            if (typeof World !== 'undefined') {
                return World.removeBlock(x, y, z, true);
            }
            return false;
        },

        get(x, y, z) {
            if (typeof World !== 'undefined') {
                const block = World.getBlock(x, y, z);
                return block ? { x: block.x, y: block.y, z: block.z, type: block.type } : null;
            }
            return null;
        },

        find(type) {
            if (typeof World !== 'undefined') {
                const results = [];
                for (const key of Object.keys(World.blockMap)) {
                    const b = World.blockMap[key];
                    if (b.type === type) {
                        results.push({ x: b.x, y: b.y, z: b.z, type: b.type });
                    }
                }
                return results;
            }
            return [];
        },

        getAll() {
            if (typeof World !== 'undefined') {
                return World.getBlocksSnapshot();
            }
            return [];
        },

        count() {
            if (typeof World !== 'undefined') {
                return World.blockCount;
            }
            return 0;
        },
    },

    // =============================================
    // PLAYER API
    // =============================================
    Player: {
        getPosition() {
            if (typeof Player !== 'undefined') {
                const pos = Player.getPosition();
                return { x: pos.x, y: pos.y, z: pos.z };
            }
            return { x: 0, y: 1, z: 0 };
        },

        setPosition(x, y, z) {
            if (typeof Player !== 'undefined') {
                Player.setPosition(x, y, z);
            }
        },

        getSpeed() {
            return BV.PLAYER_SPEED;
        },

        setSpeed(speed) {
            // Clamp speed to reasonable range
            BV.PLAYER_SPEED = Math.max(1, Math.min(50, speed));
        },

        getName() {
            if (typeof Auth !== 'undefined') {
                const profile = Auth.getProfile();
                return profile ? profile.username : 'Player';
            }
            return 'Player';
        },
    },

    // =============================================
    // CHAT API
    // =============================================
    Chat: {
        send(message) {
            if (typeof Chat !== 'undefined') {
                Chat.addSystemMessage(message);
            }
            // Also dispatch event
            window.dispatchEvent(new CustomEvent('script:chat', {
                detail: { message }
            }));
        },

        onMessage(callback) {
            const handler = (e) => {
                if (e.detail && e.detail.message) {
                    callback(e.detail.message);
                }
            };
            window.addEventListener('script:chat', handler);
            return () => window.removeEventListener('script:chat', handler);
        },
    },

    // =============================================
    // UI API
    // =============================================
    UI: {
        showHint(text, duration) {
            duration = duration || 3;
            if (typeof Utils !== 'undefined') {
                Utils.showToast(text, 'info', duration * 1000);
            }
        },

        showScore(value) {
            const el = document.getElementById('creator-score-display');
            if (el) {
                el.textContent = 'Score: ' + value;
                el.style.display = 'block';
            }
            // Dispatch for HUD integration
            window.dispatchEvent(new CustomEvent('script:score', {
                detail: { value }
            }));
        },

        showTimer(seconds) {
            window.dispatchEvent(new CustomEvent('script:timer_show', {
                detail: { seconds }
            }));
        },

        hideTimer() {
            window.dispatchEvent(new CustomEvent('script:timer_hide'));
        },

        showLeaderboard(players) {
            window.dispatchEvent(new CustomEvent('script:leaderboard', {
                detail: { players }
            }));
        },
    },

    // =============================================
    // TWEEN API (simple animations)
    // =============================================
    Tween: {
        _tweens: [],

        moveTo(object, x, y, z, duration) {
            // object should be { x, y, z }
            // Returns a promise
            return new Promise((resolve) => {
                const start = { x: object.x, y: object.y, z: object.z };
                const startTime = performance.now();
                duration = (duration || 1) * 1000;

                const tween = {
                    update(now) {
                        const t = Math.min((now - startTime) / duration, 1);
                        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut
                        object.x = start.x + (x - start.x) * ease;
                        object.y = start.y + (y - start.y) * ease;
                        object.z = start.z + (z - start.z) * ease;

                        if (t >= 1) {
                            object.x = x;
                            object.y = y;
                            object.z = z;
                            return true; // done
                        }
                        return false;
                    },
                    resolve
                };
                this._tweens.push(tween);
            });
        },

        rotateTo(object, rx, ry, rz, duration) {
            return new Promise((resolve) => {
                const start = { rx: object.rx || 0, ry: object.ry || 0, rz: object.rz || 0 };
                const startTime = performance.now();
                duration = (duration || 1) * 1000;

                const tween = {
                    update(now) {
                        const t = Math.min((now - startTime) / duration, 1);
                        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                        object.rx = start.rx + (rx - start.rx) * ease;
                        object.ry = start.ry + (ry - start.ry) * ease;
                        object.rz = start.rz + (rz - start.rz) * ease;

                        if (t >= 1) {
                            object.rx = rx; object.ry = ry; object.rz = rz;
                            return true;
                        }
                        return false;
                    },
                    resolve
                };
                this._tweens.push(tween);
            });
        },

        scaleTo(object, sx, sy, sz, duration) {
            return new Promise((resolve) => {
                const start = { sx: object.sx || 1, sy: object.sy || 1, sz: object.sz || 1 };
                const startTime = performance.now();
                duration = (duration || 1) * 1000;

                const tween = {
                    update(now) {
                        const t = Math.min((now - startTime) / duration, 1);
                        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                        object.sx = start.sx + (sx - start.sx) * ease;
                        object.sy = start.sy + (sy - start.sy) * ease;
                        object.sz = start.sz + (sz - start.sz) * ease;

                        if (t >= 1) {
                            object.sx = sx; object.sy = sy; object.sz = sz;
                            return true;
                        }
                        return false;
                    },
                    resolve
                };
                this._tweens.push(tween);
            });
        },

        wait(seconds) {
            return new Promise((resolve) => {
                setTimeout(resolve, (seconds || 1) * 1000);
            });
        },

        updateTweens() {
            const now = performance.now();
            this._tweens = this._tweens.filter((tween) => {
                const done = tween.update(now);
                if (done) tween.resolve();
                return !done;
            });
        },
    },

    // =============================================
    // SOUND API
    // =============================================
    Sound: {
        _audioCtx: null,
        _sounds: {
            click:   { freq: 800,  duration: 0.08, type: 'square' },
            place:   { freq: 440,  duration: 0.12, type: 'sine' },
            delete:  { freq: 300,  duration: 0.15, type: 'sawtooth' },
            jump:    { freq: 600,  duration: 0.1,  type: 'sine' },
            land:    { freq: 200,  duration: 0.08, type: 'triangle' },
            coin:    { freq: 1200, duration: 0.2, type: 'sine' },
            win:     { freq: 880,  duration: 0.3,  type: 'sine' },
            lose:    { freq: 220,  duration: 0.4,  type: 'sawtooth' },
        },

        _getCtx() {
            if (!this._audioCtx) {
                try {
                    this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) {
                    console.warn('[Sound] Web Audio not available');
                    return null;
                }
            }
            return this._audioCtx;
        },

        play(name) {
            const cfg = this._sounds[name];
            if (!cfg) {
                console.warn('[Sound] Unknown sound:', name);
                return;
            }
            const ctx = this._getCtx();
            if (!ctx) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = cfg.type;
            osc.frequency.setValueAtTime(cfg.freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + cfg.duration);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + cfg.duration + 0.05);
        },
    },

    // =============================================
    // EVENTS API
    // =============================================
    Events: {
        _listeners: {},

        on(event, callback) {
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(callback);
        },

        off(event, callback) {
            if (!this._listeners[event]) return;
            this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
        },

        emit(event, data) {
            if (!this._listeners[event]) return;
            for (const cb of this._listeners[event]) {
                try {
                    cb(data);
                } catch (err) {
                    console.error('[Events] Error in handler for', event, err);
                }
            }
        },
    },

    // =============================================
    // TIMER API
    // =============================================
    Timer: {
        _timers: {},
        _nextId: 1,

        every(seconds, callback) {
            const id = this._nextId++;
            this._timers[id] = setInterval(() => {
                try { callback(); } catch (e) { console.error('[Timer]', e); }
            }, (seconds || 1) * 1000);
            return id;
        },

        after(seconds, callback) {
            const id = this._nextId++;
            this._timers[id] = setTimeout(() => {
                delete this._timers[id];
                try { callback(); } catch (e) { console.error('[Timer]', e); }
            }, (seconds || 1) * 1000);
            return id;
        },

        stop(id) {
            if (this._timers[id] !== undefined) {
                clearInterval(this._timers[id]);
                clearTimeout(this._timers[id]);
                delete this._timers[id];
            }
        },

        stopAll() {
            for (const id in this._timers) {
                clearInterval(this._timers[id]);
                clearTimeout(this._timers[id]);
            }
            this._timers = {};
        },
    },

    // =============================================
    // UTILITY - Called from engine to update tween loop
    // =============================================
    update() {
        this.Tween.updateTweens();
    },
};
