// ============================================
// BLOCKVERSE - Main App Module (Entry Point)
// ============================================
// Ties all modules together. Manages the game lifecycle:
// init → auth check → lobby → enter/leave game loop.
// Runs the main requestAnimationFrame update loop and
// wires up global keyboard shortcuts and window events.
// ============================================

const App = (() => {
    'use strict';

    // ---- Game loop state ----
    let _animFrameId = null;
    let _lastTime = 0;
    let _gameRunning = false;

    // ---- Track whether game modules have been initialised ----
    let _worldInitialised = false;
    let _playerInitialised = false;
    let _toolsInitialised = false;
    let _chatInitialised = false;

    // ========================================
    //  Public API
    // ========================================

    /**
     * Initialize the entire application.
     * 1. Check if the user is already logged in.
     * 2. If logged in → init all modules and show the lobby.
     * 3. If not logged in → show the auth screen.
     * 4. Set up global event listeners and keyboard shortcuts.
     */
    function init() {
        console.log(`[App] ${BV.NAME} v${BV.VERSION} starting...`);

        // ---- Initialise core UI first (needed by everything) ----
        UI.init();

        // ---- Global event listeners MUST be set up BEFORE Auth.init() ----
        // so that auth:login events are caught immediately.
        _setupGlobalEvents();
        _setupKeyboardShortcuts();
        _setupWindowEvents();
        _setupGameMenuButtons();

        // ---- Initialise auth (sets up forms, restores session, fires events) ----
        Auth.init();

        // ---- Check existing session ----
        // Auth.init() already restored the session and fired auth:login,
        // so _initLoggedInState was already called by the event handler.
        // If for some reason the user is logged in but the event didn't fire,
        // force-init the logged-in state here.
        if (Auth.isLoggedIn() && UI.getCurrentScreen() !== 'screen-lobby') {
            _initLoggedInState();
        } else if (!Auth.isLoggedIn()) {
            UI.showScreen('screen-auth');
        }
    }

    /**
     * Start the main game update loop via requestAnimationFrame.
     * Called once per frame:
     *  - Calculate deltaTime
     *  - Update World, Player, Tools
     *  - Broadcast position (throttled)
     */
    function startGameLoop() {
        if (_gameRunning) return;
        _gameRunning = true;
        _lastTime = performance.now();

        function loop(now) {
            if (!_gameRunning) return;

            const dt = Math.min((now - _lastTime) / 1000, 0.1); // cap at 100ms
            _lastTime = now;

            // Update game systems
            if (typeof World !== 'undefined') World.update(dt);
            if (typeof Player !== 'undefined') Player.update(dt, World.blockMap);
            if (typeof Tools !== 'undefined' && Player.camera) {
                // Cast a ray from the camera for the block highlight
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(new THREE.Vector2(0, 0), Player.camera);
                Tools.updateHighlight(raycaster.ray.origin, raycaster.ray.direction);
            }

            // Broadcast position (20 Hz, throttled inside Multiplayer)
            if (typeof Multiplayer !== 'undefined' && Player.position) {
                Multiplayer.broadcastPosition(
                    Player.position,
                    { yaw: Player.yaw || 0, pitch: Player.pitch || 0 }
                );
            }

            _animFrameId = requestAnimationFrame(loop);
        }

        _animFrameId = requestAnimationFrame(loop);
        console.log('[App] Game loop started');
    }

    /**
     * Stop the main game loop.
     */
    function stopGameLoop() {
        _gameRunning = false;
        if (_animFrameId) {
            cancelAnimationFrame(_animFrameId);
            _animFrameId = null;
        }
        console.log('[App] Game loop stopped');
    }

    /**
     * Enter a game. Called when the game screen is shown.
     * Initialises World, Player, Tools, Chat if needed;
     * locks the pointer; and starts the game loop.
     */
    function enterGame() {
        // Initialise World
        if (!_worldInitialised && typeof World !== 'undefined') {
            World.init();
            _worldInitialised = true;
            
            // Initialise remote players with the world scene
            if (typeof RemotePlayers !== 'undefined') {
                RemotePlayers.init(World.scene);
            }
        }

        // Initialise Player
        if (!_playerInitialised && typeof Player !== 'undefined') {
            Player.init();
            _playerInitialised = true;
        }

        // Initialise Tools
        if (!_toolsInitialised && typeof Tools !== 'undefined') {
            Tools.init();
            _toolsInitialised = true;
        }

        // Initialise Chat
        if (!_chatInitialised && typeof Chat !== 'undefined') {
            Chat.init();
            _chatInitialised = true;
        }

        // Lock the pointer for FPS controls
        if (typeof Player !== 'undefined' && Player.lock) {
            Player.lock();
        }

        // Start the update loop
        startGameLoop();

        // Add system message
        if (typeof Chat !== 'undefined') {
            Chat.addSystemMessage('Welcome to BlockVerse!');
        }
    }

    /**
     * Leave the current game and return to the lobby.
     */
    function leaveGame() {
        // Stop the loop first
        stopGameLoop();

        // Leave the multiplayer session
        if (typeof Multiplayer !== 'undefined') {
            Multiplayer.leaveGame();
        }

        // Clear the 3D world (leave renderer intact for re-use)
        if (typeof World !== 'undefined') {
            World.clearWorld();
        }

        // Return to lobby
        if (typeof UI !== 'undefined') {
            UI.closeAllModals();
            UI.showScreen('screen-lobby');
        }

        // Mark modules as needing re-init on next enter
        _worldInitialised = false;
        _playerInitialised = false;
        _toolsInitialised = false;
        _chatInitialised = false;
    }

    /**
     * Toggle the in-game menu (ESC key).
     * When the menu opens the pointer is unlocked; when it closes the pointer re-locks.
     */
    function toggleGameMenu() {
        const gameMenu = document.getElementById('game-menu');
        if (!gameMenu) return;

        const isVisible = !gameMenu.classList.contains('hidden');

        if (isVisible) {
            // Hide menu, re-lock pointer
            gameMenu.classList.add('hidden');
            if (typeof Player !== 'undefined' && Player.lock) {
                Player.lock();
            }
        } else {
            // Show menu, unlock pointer
            UI.closeAllModals();
            gameMenu.classList.remove('hidden');
            if (typeof Player !== 'undefined' && Player.unlock) {
                Player.unlock();
            }
        }
    }

    // ========================================
    //  Private helpers
    // ========================================

    /**
     * Initialise all modules that require a logged-in user.
     * Each init is wrapped in try-catch so one failure doesn't
     * prevent the lobby from showing.
     */
    function _initLoggedInState() {
        const username = Auth.getCurrentUser();
        console.log(`[App] Logged in as ${username}`);

        // Initialise modules in dependency order (safe wrappers)
        try { if (typeof Avatar !== 'undefined') Avatar.init(); } catch (err) { console.error('[App] Avatar.init failed:', err); }
        try { if (typeof Friends !== 'undefined') Friends.init(); } catch (err) { console.error('[App] Friends.init failed:', err); }
        try { if (typeof Lobby !== 'undefined') Lobby.init(); } catch (err) { console.error('[App] Lobby.init failed:', err); }
        try { if (typeof Multiplayer !== 'undefined') Multiplayer.init(); } catch (err) { console.error('[App] Multiplayer.init failed:', err); }

        // Show the lobby (must always execute)
        UI.showScreen('screen-lobby');

        // Refresh friend statuses in the background
        setTimeout(() => {
            try { if (typeof Friends !== 'undefined') Friends.refreshFriendStatuses(); } catch (_) {}
        }, 3000);
    }

    /**
     * Set up global custom-event listeners.
     */
    function _setupGlobalEvents() {
        // ---- Auth events ----
        document.addEventListener('auth:login', (e) => {
            console.log(`[App] User logged in: ${e.detail.username}`);
            try {
                _initLoggedInState();
            } catch (err) {
                console.error('[App] Failed to init logged-in state:', err);
                // Always ensure the lobby is shown even if something fails
                UI.showScreen('screen-lobby');
            }
        });

        document.addEventListener('auth:logout', () => {
            console.log('[App] User logged out');
            stopGameLoop();

            // Destroy identity peer
            if (Friends.identityPeer && !Friends.identityPeer.destroyed) {
                Friends.identityPeer.destroy();
                Friends.identityPeer = null;
            }

            // Reset module init flags
            _worldInitialised = false;
            _playerInitialised = false;
            _toolsInitialised = false;
            _chatInitialised = false;

            UI.showScreen('screen-auth');
        });

        // ---- Game events ----
        document.addEventListener('game:create', (e) => {
            console.log(`[App] Game created: ${e.detail.code}`);
        });

        document.addEventListener('game:play', (e) => {
            console.log(`[App] Playing game: ${e.detail.code}`);
            if (typeof Lobby !== 'undefined') {
                Lobby.joinGameByCode(e.detail.code);
            }
        });

        // ---- Multiplayer events ----
        document.addEventListener('multiplayer:leaveGame', () => {
            console.log('[App] Left game, returning to lobby');
            leaveGame();
        });

        // ---- Block events (relay from Tools → Multiplayer) ----
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

        // ---- UI resize ----
        document.addEventListener('ui:resize', () => {
            if (typeof World !== 'undefined' && World.onResize) {
                World.onResize();
            }
            if (typeof Player !== 'undefined' && Player.onResize) {
                Player.onResize();
            }
        });
    }

    /**
     * Set up global keyboard shortcuts.
     * Shortcuts only fire when the game screen is active.
     */
    function _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only act when the game screen is visible
            const gameScreen = document.getElementById('screen-game');
            if (!gameScreen || !gameScreen.classList.contains('active')) return;

            // Don't capture if typing in an input
            const tag = e.target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;

            // Don't capture if chat is open (chat module handles its own keys)
            if (typeof Chat !== 'undefined' && Chat.isVisible()) return;

            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    toggleGameMenu();
                    break;

                // Toolbar slots 1-9
                case '1': case '2': case '3':
                case '4': case '5': case '6':
                case '7': case '8': case '9':
                    if (typeof Tools !== 'undefined') {
                        Tools.selectSlot(parseInt(e.key) - 1);
                    }
                    break;

                // Player list toggle
                case 'F1':
                    e.preventDefault();
                    _togglePlayerList();
                    break;
            }
        });
    }

    /**
     * Set up window-level event handlers.
     */
    function _setupWindowEvents() {
        // Close all connections on page unload
        window.addEventListener('beforeunload', () => {
            if (typeof Multiplayer !== 'undefined') {
                Multiplayer.leaveGame();
            }
            if (Friends.identityPeer && !Friends.identityPeer.destroyed) {
                Friends.identityPeer.destroy();
            }
        });

        // Pause game when tab is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (_gameRunning) {
                    stopGameLoop();
                    _gameRunning = true; // Mark so we restart on visible
                }
            } else {
                // Resume if we were running
                if (typeof UI !== 'undefined' && UI.getCurrentScreen() === 'screen-game') {
                    // Re-lock pointer
                    if (typeof Player !== 'undefined' && Player.lock) {
                        Player.lock();
                    }
                    // Only restart if the game loop was running
                    if (_gameRunning) {
                        startGameLoop();
                    }
                }
            }
        });
    }

    /**
     * Toggle the player list panel (F1).
     */
    function _togglePlayerList() {
        const panel = document.getElementById('player-list-panel');
        if (!panel) return;
        panel.classList.toggle('hidden');

        // Update player list content
        if (!panel.classList.contains('hidden') && typeof Multiplayer !== 'undefined') {
            const list = panel.querySelector('.player-list');
            if (list) {
                let html = '';
                Multiplayer.players.forEach((info, peerId) => {
                    const isHost = peerId === Multiplayer.hostPeerId;
                    const hostTag = isHost ? ' ⭐' : '';
                    const youTag = (info.username === Auth.getCurrentUser()) ? ' (You)' : '';
                    html += `<div class="player-list-entry">
                        ${Avatar.getAvatarHTML(info.username, 'small')}
                        <span>${info.username}${youTag}${hostTag}</span>
                    </div>`;
                });
                list.innerHTML = html || '<p class="text-secondary">No players</p>';
            }
        }
    }

    // ========================================
    //  Game Menu Button Wiring
    // ========================================
    function _setupGameMenuButtons() {
        const resumeBtn = document.getElementById('btn-resume');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => toggleGameMenu());
        }

        const leaveBtn = document.getElementById('btn-leave-game');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => leaveGame());
        }

        const hudLeave = document.getElementById('hud-leave');
        if (hudLeave) {
            hudLeave.addEventListener('click', () => leaveGame());
        }

        const togglePlayersBtn = document.getElementById('btn-toggle-players');
        if (togglePlayersBtn) {
            togglePlayersBtn.addEventListener('click', () => _togglePlayerList());
        }

        // Wire up the logout button in the sidebar
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (typeof Auth !== 'undefined') Auth.logout();
            });
        }
    }

    // ========================================
    //  Bootstrap on DOM ready
    // ========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ========================================
    //  Return the public interface
    // ========================================
    return {
        init,
        startGameLoop,
        stopGameLoop,
        enterGame,
        leaveGame,
        toggleGameMenu,
    };
})();
