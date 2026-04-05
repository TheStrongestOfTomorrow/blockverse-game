// ============================================
// BLOCKVERSE - Main App Module (Entry Point)
// ============================================

const App = (() => {
    'use strict';

    let _animFrameId = null;
    let _lastTime = 0;
    let _gameRunning = false;

    let _worldInitialised = false;
    let _playerInitialised = false;
    let _toolsInitialised = false;
    let _chatInitialised = false;

    // ---- Multi-tab session lock ----
    // Prevents the same user from having an active game in multiple tabs.
    // Uses BroadcastChannel for real-time tab-to-tab communication and
    // localStorage heartbeat for crash recovery (tab closed without cleanup).
    const _TAB_ID = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    let _heartbeatInterval = null;
    let _bcChannel = null;
    const SESSION_KEY = 'bv_active_session';
    const HEARTBEAT_INTERVAL_MS = 2000;
    const SESSION_TIMEOUT_MS = 6000;

    // ========================================
    //  Public API
    // ========================================

    function init() {
        console.log(`[App] ${BV.NAME} v${BV.VERSION} starting... (tab: ${_TAB_ID})`);

        _initTabLock();
        UI.init();
        _setupGlobalEvents();
        _setupKeyboardShortcuts();
        _setupWindowEvents();
        _setupGameMenuButtons();

        Auth.init();

        if (Auth.isLoggedIn() && UI.getCurrentScreen() !== 'screen-lobby') {
            _initLoggedInState();
        } else if (!Auth.isLoggedIn()) {
            UI.showScreen('screen-auth');
        }
    }

    function startGameLoop() {
        if (_gameRunning) return;
        _gameRunning = true;
        _lastTime = performance.now();

        function loop(now) {
            if (!_gameRunning) return;

            const dt = Math.min((now - _lastTime) / 1000, 0.1);
            _lastTime = now;

            if (typeof World !== 'undefined') World.update(dt);
            if (typeof Player !== 'undefined' && Player.camera) Player.update(dt, World.blockMap);
            if (typeof Tools !== 'undefined' && Player && Player.camera) {
                // Cursor-based highlight: follows mouse position, not screen center
                Tools.updateHighlight();
            }

            if (typeof RemotePlayers !== 'undefined') {
                RemotePlayers.updateAll(dt);
            }

            if (typeof Multiplayer !== 'undefined' && Player.position) {
                Multiplayer.broadcastPosition(
                    Player.position,
                    { yaw: Player.yaw || 0, pitch: Player.pitch || 0 }
                );
            }

            // RENDER — this was missing, causing the black screen!
            if (typeof World !== 'undefined') World.render();

            _animFrameId = requestAnimationFrame(loop);
        }

        _animFrameId = requestAnimationFrame(loop);
        console.log('[App] Game loop started');
    }

    function stopGameLoop() {
        _gameRunning = false;
        if (_animFrameId) {
            cancelAnimationFrame(_animFrameId);
            _animFrameId = null;
        }
        console.log('[App] Game loop stopped');
    }

    function enterGame() {
        // ---- Multi-tab lock check ----
        const existingSession = _getActiveSession();
        if (existingSession && existingSession.tabId !== _TAB_ID && existingSession.username === Auth.getCurrentUser()) {
            const elapsed = Date.now() - existingSession.lastHeartbeat;
            if (elapsed < SESSION_TIMEOUT_MS) {
                // Another tab has an active session for this user
                Utils.showToast('You already have an active game in another tab! Close it first.', 'error', 5000);
                // Notify the other tab to bring itself to focus
                _broadcastToTab(existingSession.tabId, { type: 'focus_request' });
                return;
            }
            // Session is stale — the other tab probably crashed. Take over.
            console.log(`[App] Stale session from tab ${existingSession.tabId} detected, taking over`);
        }

        // Claim the session
        _claimSession();

        // World MUST be initialized first (creates scene, camera, renderer)
        if (!_worldInitialised && typeof World !== 'undefined') {
            if (!World.scene) {
                World.init();
            }
            _worldInitialised = true;

            if (typeof RemotePlayers !== 'undefined') {
                RemotePlayers.init(World.scene);
            }
        }

        // Player depends on World.camera
        if (!_playerInitialised && typeof Player !== 'undefined') {
            Player.init();
            _playerInitialised = true;
        }

        // Tools depend on Player
        if (!_toolsInitialised && typeof Tools !== 'undefined') {
            Tools.init();
            _toolsInitialised = true;
        }

        if (!_chatInitialised && typeof Chat !== 'undefined') {
            Chat.init();
            _chatInitialised = true;
        }

        if (typeof Player !== 'undefined') {
            Player.setActive(true);
        }

        startGameLoop();

        // Update HUD
        if (typeof Chat !== 'undefined') {
            Chat.addSystemMessage('Welcome to BlockVerse!');
            Chat.addSystemMessage('WASD to move | Right-click drag to orbit camera');
            Chat.addSystemMessage('I/O or scroll to zoom | Left-click to use tools');
            Chat.addSystemMessage('B/X/P/G to switch tools | ESC for menu');
        }

        // Auto-fade controls hint after 6 seconds
        const hint = document.getElementById('controls-hint');
        if (hint) {
            setTimeout(() => { hint.classList.add('fade-out'); }, 6000);
        }
    }

    function leaveGame() {
        stopGameLoop();

        if (typeof Player !== 'undefined') {
            Player.setActive(false);
            Player.destroy();
        }

        if (typeof Multiplayer !== 'undefined') {
            Multiplayer.leaveGame();
        }

        if (typeof World !== 'undefined') {
            World.clearWorld();
        }

        // Release session lock
        _releaseSession();

        if (typeof UI !== 'undefined') {
            UI.closeAllModals();
            UI.showScreen('screen-lobby');
        }

        _worldInitialised = false;
        _playerInitialised = false;
        _toolsInitialised = false;
        _chatInitialised = false;
    }

    function toggleGameMenu() {
        const gameMenu = document.getElementById('game-menu');
        if (!gameMenu) return;

        const isVisible = !gameMenu.classList.contains('hidden');

        if (isVisible) {
            gameMenu.classList.add('hidden');
            if (typeof Player !== 'undefined') {
                Player.setActive(true);
            }
        } else {
            UI.closeAllModals();
            gameMenu.classList.remove('hidden');
            if (typeof Player !== 'undefined') {
                Player.setActive(false);
            }
        }
    }

    // ========================================
    //  Private helpers
    // ========================================

    function _initLoggedInState() {
        const username = Auth.getCurrentUser();
        console.log(`[App] Logged in as ${username}`);

        try { if (typeof Avatar !== 'undefined') Avatar.init(); } catch (err) { console.error('[App] Avatar.init failed:', err); }
        try { if (typeof Friends !== 'undefined') Friends.init(); } catch (err) { console.error('[App] Friends.init failed:', err); }
        try { if (typeof Lobby !== 'undefined') Lobby.init(); } catch (err) { console.error('[App] Lobby.init failed:', err); }
        try { if (typeof Multiplayer !== 'undefined') Multiplayer.init(); } catch (err) { console.error('[App] Multiplayer.init failed:', err); }

        UI.showScreen('screen-lobby');

        setTimeout(() => {
            try { if (typeof Friends !== 'undefined') Friends.refreshFriendStatuses(); } catch (_) {}
        }, 3000);
    }

    function _setupGlobalEvents() {
        document.addEventListener('auth:login', (e) => {
            console.log(`[App] User logged in: ${e.detail.username}`);
            try {
                _initLoggedInState();
            } catch (err) {
                console.error('[App] Failed to init logged-in state:', err);
                UI.showScreen('screen-lobby');
            }
        });

        document.addEventListener('auth:logout', () => {
            console.log('[App] User logged out');
            stopGameLoop();

            if (typeof Friends !== 'undefined' && Friends.identityPeer && !Friends.identityPeer.destroyed) {
                Friends.identityPeer.destroy();
                Friends.identityPeer = null;
            }

            _worldInitialised = false;
            _playerInitialised = false;
            _toolsInitialised = false;
            _chatInitialised = false;

            UI.showScreen('screen-auth');
        });

        document.addEventListener('game:create', (e) => {
            console.log(`[App] Game created: ${e.detail.code}`);
        });

        document.addEventListener('game:play', (e) => {
            console.log(`[App] Playing game: ${e.detail.code}`);
            if (typeof Lobby !== 'undefined') {
                Lobby.joinGameByCode(e.detail.code);
            }
        });

        document.addEventListener('multiplayer:leaveGame', () => {
            console.log('[App] Left game, returning to lobby');
            leaveGame();
        });

        document.addEventListener('block:place', (e) => {
            const { x, y, z, blockType } = e.detail;
            if (typeof Multiplayer !== 'undefined') {
                Multiplayer.broadcast({
                    type: BV.MSG.BLOCK_PLACE,
                    payload: { x, y, z, blockType },
                });
            }
        });

        document.addEventListener('block:remove', (e) => {
            const { x, y, z } = e.detail;
            if (typeof Multiplayer !== 'undefined') {
                Multiplayer.broadcast({
                    type: BV.MSG.BLOCK_REMOVE,
                    payload: { x, y, z },
                });
            }
        });

        document.addEventListener('ui:resize', () => {
            if (typeof World !== 'undefined' && World.onResize) {
                World.onResize();
            }
            if (typeof Player !== 'undefined' && Player.handleResize) {
                Player.handleResize();
            }
        });
    }

    function _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const gameScreen = document.getElementById('screen-game');
            if (!gameScreen || !gameScreen.classList.contains('active')) return;

            const tag = e.target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;
            if (typeof Chat !== 'undefined' && Chat.isVisible()) return;

            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    toggleGameMenu();
                    break;
                case '1': case '2': case '3':
                case '4': case '5': case '6':
                case '7': case '8': case '9':
                    if (typeof Tools !== 'undefined') {
                        Tools.selectSlot(parseInt(e.key) - 1);
                    }
                    break;
                case 'F1':
                    e.preventDefault();
                    _togglePlayerList();
                    break;
            }
        });
    }

    function _setupWindowEvents() {
        window.addEventListener('beforeunload', () => {
            // Release session lock before unloading
            _releaseSession();

            if (typeof Multiplayer !== 'undefined') {
                Multiplayer.leaveGame();
            }
            if (typeof Friends !== 'undefined' && Friends.identityPeer && !Friends.identityPeer.destroyed) {
                Friends.identityPeer.destroy();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (_gameRunning) {
                    stopGameLoop();
                    // Don't modify _gameRunning — stopGameLoop() already handles it
                }
            } else {
                if (typeof UI !== 'undefined' && UI.getCurrentScreen() === 'screen-game') {
                    if (!_gameRunning) {
                        startGameLoop();
                    }
                }
            }
        });
    }

    function _togglePlayerList() {
        const panel = document.getElementById('player-list-panel');
        if (!panel) return;
        panel.classList.toggle('hidden');

        if (!panel.classList.contains('hidden') && typeof Multiplayer !== 'undefined') {
            const list = panel.querySelector('.player-list');
            if (list) {
                let html = '';
                Multiplayer.players.forEach((info, peerId) => {
                    const isHost = peerId === Multiplayer.hostPeerId;
                    const hostTag = isHost ? ' ⭐' : '';
                    const youTag = (info.username === Auth.getCurrentUser()) ? ' (You)' : '';
                    html += `<div class="player-entry"><span>${info.username}${youTag}${hostTag}</span></div>`;
                });
                list.innerHTML = html || '<p style="color:#a0a0b0">No players</p>';
            }
        }
    }

    function _setupGameMenuButtons() {
        const resumeBtn = document.getElementById('btn-resume');
        if (resumeBtn) resumeBtn.addEventListener('click', () => toggleGameMenu());

        const leaveBtn = document.getElementById('btn-leave-game');
        if (leaveBtn) leaveBtn.addEventListener('click', () => leaveGame());

        const hudLeave = document.getElementById('hud-leave');
        if (hudLeave) hudLeave.addEventListener('click', () => leaveGame());

        const cornerLeaveBtn = document.getElementById('btn-leave-game-corner');
        if (cornerLeaveBtn) cornerLeaveBtn.addEventListener('click', () => leaveGame());

        const togglePlayersBtn = document.getElementById('btn-toggle-players');
        if (togglePlayersBtn) togglePlayersBtn.addEventListener('click', () => _togglePlayerList());

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (typeof Auth !== 'undefined') Auth.logout();
            });
        }
    }

    // ========================================
    //  Multi-Tab Session Lock (private)
    // ========================================

    /**
     * Initialize the BroadcastChannel for cross-tab communication
     * and set up the heartbeat interval.
     */
    function _initTabLock() {
        try {
            _bcChannel = new BroadcastChannel('bv_session_lock');
            _bcChannel.onmessage = (event) => {
                const msg = event.data;
                if (!msg || msg.type === undefined) return;

                if (msg.tabId === _TAB_ID) return; // Ignore our own messages

                switch (msg.type) {
                    case 'session_claimed':
                        // Another tab claimed a session — if we're in a game with the same user, kick ourselves
                        if (_gameRunning && msg.username === Auth.getCurrentUser()) {
                            console.warn(`[App] Another tab (${msg.tabId}) claimed the session, leaving game`);
                            Utils.showToast('Your game was opened in another tab. This tab will return to lobby.', 'error', 5000);
                            leaveGame();
                        }
                        break;

                    case 'session_released':
                        // Another tab released — no action needed
                        break;

                    case 'focus_request':
                        // Another tab wants us to focus
                        if (_gameRunning) {
                            window.focus();
                        }
                        break;
                }
            };
        } catch (err) {
            // BroadcastChannel not supported (very old browsers)
            console.warn('[App] BroadcastChannel not available, multi-tab lock disabled');
        }

        // Listen for storage changes from other tabs (heartbeat updates)
        window.addEventListener('storage', (e) => {
            if (e.key !== SESSION_KEY) return;
            // If another tab cleared the session and we're in-game, that's fine
            // If another tab wrote a session with a different tabId, check if we need to yield
        });

        // Clean up any stale session on init
        const existing = _getActiveSession();
        if (existing) {
            const elapsed = Date.now() - existing.lastHeartbeat;
            if (elapsed > SESSION_TIMEOUT_MS) {
                console.log(`[App] Cleaning stale session from tab ${existing.tabId}`);
                localStorage.removeItem(SESSION_KEY);
            }
        }
    }

    /**
     * Get the current active session from localStorage.
     * @returns {object|null}
     */
    function _getActiveSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    /**
     * Claim the game session for this tab.
     * Starts the heartbeat and broadcasts to other tabs.
     */
    function _claimSession() {
        const session = {
            tabId: _TAB_ID,
            username: Auth.getCurrentUser(),
            lastHeartbeat: Date.now(),
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));

        // Start heartbeat
        if (_heartbeatInterval) clearInterval(_heartbeatInterval);
        _heartbeatInterval = setInterval(() => {
            session.lastHeartbeat = Date.now();
            try {
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            } catch (_) {}
        }, HEARTBEAT_INTERVAL_MS);

        // Broadcast to other tabs
        _broadcastToAll({ type: 'session_claimed', tabId: _TAB_ID, username: Auth.getCurrentUser() });

        console.log(`[App] Session claimed by tab ${_TAB_ID}`);
    }

    /**
     * Release the game session lock.
     */
    function _releaseSession() {
        if (_heartbeatInterval) {
            clearInterval(_heartbeatInterval);
            _heartbeatInterval = null;
        }

        const existing = _getActiveSession();
        if (existing && existing.tabId === _TAB_ID) {
            localStorage.removeItem(SESSION_KEY);
            _broadcastToAll({ type: 'session_released', tabId: _TAB_ID });
            console.log(`[App] Session released by tab ${_TAB_ID}`);
        }
    }

    /**
     * Send a message to all other tabs via BroadcastChannel.
     * @param {object} msg
     */
    function _broadcastToAll(msg) {
        if (_bcChannel) {
            try { _bcChannel.postMessage(msg); } catch (_) {}
        }
    }

    /**
     * Send a message to a specific tab.
     * @param {string} tabId
     * @param {object} msg
     */
    function _broadcastToTab(tabId, msg) {
        msg.targetTabId = tabId;
        _broadcastToAll(msg);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        init,
        startGameLoop,
        stopGameLoop,
        enterGame,
        leaveGame,
        toggleGameMenu,
    };
})();
