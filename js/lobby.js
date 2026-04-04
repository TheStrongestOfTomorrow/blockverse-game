// ============================================
// BLOCKVERSE - Lobby Module
// ============================================
// Lobby page logic: game browsing, creating/hosting games,
// joining by code, random play, server list, search, settings.
// ============================================

const Lobby = (() => {
    'use strict';

    // ---- Built-in / featured sample games (always visible) ----
    const FEATURED_GAMES = [
        {
            name: 'Block World',
            description: 'Build anything you can imagine!',
            category: 'sandbox',
            icon: '🏗️',
            code: 'SAMPLE-BLDW',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#4CAF50',
            players: 0,
        },
        {
            name: 'Tower of Doom',
            description: 'Climb the tallest tower!',
            category: 'obby',
            icon: '🏰',
            code: 'SAMPLE-TOWR',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#E74C3C',
            players: 0,
        },
        {
            name: 'Speed Builder',
            description: 'Build fast, build smart!',
            category: 'minigame',
            icon: '⚡',
            code: 'SAMPLE-SPDB',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#FF9800',
            players: 0,
        },
        {
            name: 'City Tycoon',
            description: 'Build your city empire!',
            category: 'tycoon',
            icon: '💰',
            code: 'SAMPLE-CTYT',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#FFD700',
            players: 0,
        },
        {
            name: 'Racing Arena',
            description: 'Race your friends!',
            category: 'racing',
            icon: '🏎️',
            code: 'SAMPLE-RCEA',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#2196F3',
            players: 0,
        },
        {
            name: 'Sword Fight',
            description: 'Battle with swords!',
            category: 'adventure',
            icon: '⚔️',
            code: 'SAMPLE-SWFT',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#9C27B0',
            players: 0,
        },
    ];

    // Currently active category filter
    let _activeCategory = 'all';

    // Debounced search handler
    let _searchDebounce = null;

    // ========================================
    //  Public API
    // ========================================

    /**
     * Initialize the lobby module.
     * - Render featured games.
     * - Render category filters.
     * - Render "My Games".
     * - Wire up create-game form, random play, join-by-code, etc.
     */
    function init() {
        renderFeaturedGames();
        if (typeof UI !== 'undefined') UI.renderCategoryFilters();
        renderMyGames();
        _setupSidebarNav();
        _setupCreateGameForm();
        _setupRandomPlay();
        _setupJoinCodeModal();
        _setupServerListModal();
        _setupSearch();
        _setupSettings();
        _populateCreateGameOptions();
    }

    /**
     * Show a lobby section and hide the others.
     * Also updates sidebar button active state.
     * @param {string} sectionId
     */
    function showSection(sectionId) {
        // Hide all lobby sections
        document.querySelectorAll('.lobby-section').forEach((el) => {
            el.classList.remove('active');
        });

        // Show target
        const target = document.getElementById(sectionId);
        if (target) target.classList.add('active');

        // Update sidebar buttons
        document.querySelectorAll('.sidebar-btn').forEach((btn) => {
            btn.classList.remove('active');
            if (btn.dataset.section === sectionId) {
                btn.classList.add('active');
            }
        });

        // Refresh data when switching sections
        if (sectionId === 'section-my-games') {
            renderMyGames();
        } else if (sectionId === 'section-discover') {
            renderFeaturedGames();
        } else if (sectionId === 'section-settings') {
            _loadSettings();
        } else if (sectionId === 'section-friends') {
            if (typeof Friends !== 'undefined') Friends.renderUI();
        }
    }

    /**
     * Render featured + user-created game cards into #games-grid.
     */
    function renderFeaturedGames() {
        const grid = document.getElementById('games-grid');
        if (!grid) return;

        // Combine featured games with user-created games
        const allGames = [...FEATURED_GAMES, ..._getUserGames()];
        const filtered = _activeCategory === 'all'
            ? allGames
            : allGames.filter((g) => g.category === _activeCategory);

        grid.innerHTML = filtered.map((g) => UI.renderGameCard(g)).join('');

        // Wire up play buttons
        grid.querySelectorAll('.game-card-play-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const code = btn.dataset.code;
                if (code) {
                    document.dispatchEvent(new CustomEvent('game:play', { detail: { code } }));
                }
            });
        });
    }

    /**
     * Render the user's created games in #my-games-grid.
     */
    function renderMyGames() {
        const grid = document.getElementById('my-games-grid');
        if (!grid) return;

        const games = _getUserGames();

        if (games.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <p>You haven't created any games yet.</p>
                    <p class="text-secondary">Go to "Create" to build one!</p>
                </div>`;
            return;
        }

        grid.innerHTML = games.map((g) => `
            <div class="my-game-card" data-code="${g.code}">
                <div class="my-game-info">
                    <h4>${g.name}</h4>
                    <span class="game-category-tag">${g.category}</span>
                    <span class="game-date">${new Date(g.createdAt).toLocaleDateString()}</span>
                </div>
                <div class="my-game-actions">
                    <button class="btn btn-primary btn-sm host-game-btn" data-code="${g.code}">HOST</button>
                    <button class="btn btn-danger btn-sm delete-game-btn" data-code="${g.code}">DELETE</button>
                </div>
            </div>
        `).join('');

        // Wire buttons
        grid.querySelectorAll('.host-game-btn').forEach((btn) => {
            btn.addEventListener('click', () => hostGame(btn.dataset.code));
        });
        grid.querySelectorAll('.delete-game-btn').forEach((btn) => {
            btn.addEventListener('click', () => deleteGame(btn.dataset.code));
        });
    }

    /**
     * Create a new game from form data.
     * @param {object} formData
     */
    function createGame(formData) {
        const code = Utils.generateCode('BV', 4);

        const gameConfig = {
            name: formData.name || 'Untitled Game',
            description: formData.description || '',
            category: formData.category || 'sandbox',
            maxPlayers: parseInt(formData.maxPlayers) || BV.MAX_PLAYERS_PER_SERVER,
            thumbnailColor: formData.thumbnailColor || BV.COLORS.PRIMARY,
            template: formData.template || 'flat',
            allowSave: formData.allowSave !== false,
            saveableBlocks: formData.saveableBlocks || true,
            maxBlocksPerPlayer: parseInt(formData.maxBlocksPerPlayer) || BV.MAX_BLOCKS_PER_PLAYER_SAVE,
            color: formData.thumbnailColor || BV.COLORS.PRIMARY,
            createdAt: Date.now(),
            code,
            createdBy: Auth.getCurrentUser(),
        };

        // Persist
        const games = _getUserGames();
        games.push(gameConfig);
        localStorage.setItem(BV.STORAGE_KEYS.CREATED_GAMES, JSON.stringify(games));

        // Dispatch event
        document.dispatchEvent(new CustomEvent('game:create', { detail: { code, config: gameConfig } }));

        // Show loading & start hosting
        if (typeof UI !== 'undefined') UI.showLoading('Creating game...');
        if (typeof UI !== 'undefined') UI.updateLoadingBar(20, 'Starting server...');

        hostGame(code).then(() => {
            if (typeof UI !== 'undefined') UI.updateLoadingBar(60, 'Generating world...');
            // Generate terrain with the selected template
            if (typeof World !== 'undefined') {
                World.generateTerrain(gameConfig.template);
                if (typeof UI !== 'undefined') UI.updateLoadingBar(90, 'Almost ready...');
            }
            // Transition to game screen
            setTimeout(() => {
                if (typeof UI !== 'undefined') {
                    UI.updateLoadingBar(100, 'Done!');
                    setTimeout(() => {
                        UI.hideLoading();
                        UI.showScreen('screen-game');
                        if (typeof UI !== 'undefined') UI.showGameCodeModal(code);
                    }, 300);
                }
            }, 500);
        }).catch((err) => {
            console.error('[Lobby] Failed to host game:', err);
            if (typeof UI !== 'undefined') UI.hideLoading();
            Utils.showToast('Failed to create game. Please try again.', 'error');
        });
    }

    /**
     * Start hosting an existing game.
     * @param {string} gameCode
     * @returns {Promise<void>}
     */
    function hostGame(gameCode) {
        // Load game config
        const games = _getUserGames();
        const config = games.find((g) => g.code === gameCode) || {};

        if (typeof UI !== 'undefined') UI.showLoading('Starting server...');

        return Multiplayer.hostGame(gameCode, config).then((serverPeerId) => {
            if (typeof UI !== 'undefined') UI.updateLoadingBar(40, 'Generating world...');

            return new Promise((resolve) => {
                if (typeof World !== 'undefined') {
                    World.init();
                    World.generateTerrain(config.template || 'flat');
                }

                if (typeof UI !== 'undefined') UI.updateLoadingBar(80, 'Ready!');
                setTimeout(() => {
                    if (typeof UI !== 'undefined') {
                        UI.updateLoadingBar(100);
                        setTimeout(() => {
                            UI.hideLoading();
                            UI.showScreen('screen-game');
                            if (typeof UI !== 'undefined') UI.showGameCodeModal(gameCode);
                        }, 300);
                    }
                    resolve();
                }, 500);
            });
        }).catch((err) => {
            console.error('[Lobby] Failed to host:', err);
            if (typeof UI !== 'undefined') UI.hideLoading();
            Utils.showToast('Failed to host game.', 'error');
            throw err;
        });
    }

    /**
     * Join a game by entering its code.
     * @param {string} code
     */
    function joinGameByCode(code) {
        if (!code) return;

        code = code.toUpperCase().trim();
        if (typeof UI !== 'undefined') UI.showLoading(`Joining game ${code}...`);

        const hostPeerId = `${code}-S1`;

        Multiplayer.joinGame(hostPeerId).then(() => {
            if (typeof UI !== 'undefined') UI.updateLoadingBar(100, 'Connected!');
            setTimeout(() => {
                if (typeof UI !== 'undefined') UI.hideLoading();
                if (typeof UI !== 'undefined') UI.showScreen('screen-game');
            }, 400);
        }).catch((err) => {
            console.error('[Lobby] Failed to join:', err);
            if (typeof UI !== 'undefined') UI.hideLoading();
            Utils.showToast('Could not find or join that game.', 'error');
        });
    }

    /**
     * Find and join a random available game.
     */
    function randomPlay() {
        if (typeof UI !== 'undefined') UI.showLoading('Finding a game...');

        // Apply cooldown
        if (typeof UI !== 'undefined') {
            UI.startCooldown('random-play-btn', BV.RANDOM_PLAY_COOLDOWN);
        }

        Multiplayer.randomPlay().then((result) => {
            if (!result) {
                if (typeof UI !== 'undefined') UI.hideLoading();
                Utils.showToast('No games available right now. Try again later!', 'info');
                return;
            }

            if (typeof UI !== 'undefined') UI.updateLoadingBar(50, `Joining ${result.gameCode}...`);
            return Multiplayer.joinGame(result.serverId);
        }).then(() => {
            if (typeof UI !== 'undefined') {
                UI.updateLoadingBar(100, 'Connected!');
                setTimeout(() => {
                    UI.hideLoading();
                    UI.showScreen('screen-game');
                }, 300);
            }
        }).catch((err) => {
            console.error('[Lobby] Random play failed:', err);
            if (typeof UI !== 'undefined') UI.hideLoading();
            Utils.showToast('Failed to join a game.', 'error');
        });
    }

    /**
     * Load and display the server list for a game code.
     * @param {string} gameCode
     */
    function loadServers(gameCode) {
        if (typeof UI !== 'undefined') UI.showLoading('Finding servers...');

        // Apply refresh cooldown
        if (typeof UI !== 'undefined') {
            UI.startCooldown('refresh-servers-btn', BV.REFRESH_COOLDOWN);
        }

        Multiplayer.findServers(gameCode).then((servers) => {
            if (typeof UI !== 'undefined') UI.hideLoading();
            renderServers(servers);
        }).catch(() => {
            if (typeof UI !== 'undefined') UI.hideLoading();
            renderServers([]);
        });
    }

    /**
     * Render the server list into the server list modal/container.
     * @param {Array<{serverId, playerCount, maxPlayers}>} servers
     */
    function renderServers(servers) {
        const container = document.getElementById('server-list-content');
        if (!container) return;

        if (!servers || servers.length === 0) {
            container.innerHTML = '<p class="text-secondary">No servers found for this game.</p>';
            return;
        }

        container.innerHTML = servers.map((s, i) => {
            const isFull = s.playerCount >= s.maxPlayers;
            const displayName = s.serverId.split('-').slice(1).join('-');
            return `
                <div class="server-item">
                    <div class="server-info">
                        <span class="server-name">Server ${i + 1} (${displayName})</span>
                        <span class="server-players ${isFull ? 'full' : ''}">
                            👤 ${s.playerCount}/${s.maxPlayers}
                        </span>
                    </div>
                    <button class="btn btn-sm ${isFull ? 'btn-disabled' : 'btn-primary'} join-server-btn"
                            data-server="${s.serverId}" ${isFull ? 'disabled' : ''}>
                        ${isFull ? 'FULL' : 'JOIN'}
                    </button>
                </div>`;
        }).join('');

        // Wire join buttons
        container.querySelectorAll('.join-server-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const serverId = btn.dataset.server;
                if (!serverId || btn.disabled) return;
                joinGameByCode(serverId);
            });
        });
    }

    /**
     * Delete a created game from localStorage.
     * @param {string} gameCode
     */
    function deleteGame(gameCode) {
        let games = _getUserGames();
        games = games.filter((g) => g.code !== gameCode);
        localStorage.setItem(BV.STORAGE_KEYS.CREATED_GAMES, JSON.stringify(games));
        renderMyGames();
        Utils.showToast('Game deleted', 'info');
    }

    // ========================================
    //  Private helpers
    // ========================================

    /** Get user-created games from localStorage. */
    function _getUserGames() {
        try {
            const raw = localStorage.getItem(BV.STORAGE_KEYS.CREATED_GAMES);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    // ---- Sidebar navigation ----
    function _setupSidebarNav() {
        document.querySelectorAll('.sidebar-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section;
                if (section) showSection(section);
            });
        });
    }

    // ---- Create game form ----
    function _setupCreateGameForm() {
        const form = document.getElementById('create-game-form');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const formData = {
                name: form.querySelector('#game-name')?.value?.trim(),
                description: form.querySelector('#game-description')?.value?.trim(),
                category: form.querySelector('#game-category')?.value || 'sandbox',
                maxPlayers: form.querySelector('#game-max-players')?.value || BV.MAX_PLAYERS_PER_SERVER,
                thumbnailColor: form.querySelector('#game-thumbnail-color')?.value || BV.COLORS.PRIMARY,
                template: form.querySelector('#game-template')?.value || 'flat',
                allowSave: form.querySelector('#game-allow-save')?.checked ?? true,
                saveableBlocks: form.querySelector('#game-saveable-blocks')?.checked ?? true,
                maxBlocksPerPlayer: form.querySelector('#game-max-blocks')?.value || BV.MAX_BLOCKS_PER_PLAYER_SAVE,
            };

            if (!formData.name) {
                Utils.showToast('Please enter a game name', 'error');
                return;
            }

            createGame(formData);
        });
    }

    // ---- Populate create-game dropdowns ----
    function _populateCreateGameOptions() {
        // Category select
        _populateSelect('game-category', BV.GAME_CATEGORIES.slice(1), 'id', 'name');

        // Template select
        _populateSelect('game-template', [
            { id: 'flat', name: 'Flat World' },
            { id: 'hills', name: 'Rolling Hills' },
            { id: 'mountains', name: 'Mountains' },
            { id: 'islands', name: 'Islands' },
            { id: 'desert', name: 'Desert' },
        ], 'id', 'name');

        // Thumbnail color picker
        const colorContainer = document.getElementById('game-thumbnail-colors');
        if (colorContainer) {
            const colors = ['#E74C3C', '#E91E63', '#9C27B0', '#3F51B5', '#2196F3',
                '#009688', '#4CAF50', '#FF9800', '#FF5722', '#795548'];
            colors.forEach((c) => {
                const el = document.createElement('div');
                el.className = 'color-circle thumbnail-color';
                el.style.background = c;
                el.dataset.color = c;
                el.addEventListener('click', () => {
                    colorContainer.querySelectorAll('.color-circle').forEach((e) => e.classList.remove('active'));
                    el.classList.add('active');
                    const hiddenInput = document.getElementById('game-thumbnail-color');
                    if (hiddenInput) hiddenInput.value = c;
                });
                colorContainer.appendChild(el);
            });
        }
    }

    /**
     * Populate a <select> from an array of objects.
     * @param {string} elementId
     * @param {Array} items
     * @param {string} valueKey
     * @param {string} labelKey
     */
    function _populateSelect(elementId, items, valueKey, labelKey) {
        const select = document.getElementById(elementId);
        if (!select) return;
        select.innerHTML = '';

        items.forEach((item) => {
            const opt = document.createElement('option');
            opt.value = item[valueKey];
            opt.textContent = item[labelKey];
            select.appendChild(opt);
        });
    }

    // ---- Random play button ----
    function _setupRandomPlay() {
        const btn = document.getElementById('random-play-btn');
        if (btn) {
            btn.addEventListener('click', randomPlay);
        }
    }

    // ---- Join-by-code modal ----
    function _setupJoinCodeModal() {
        const form = document.getElementById('join-code-form');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = form.querySelector('#join-code-input');
            const code = input ? input.value.trim() : '';
            if (!code) {
                Utils.showToast('Please enter a game code', 'error');
                return;
            }

            // Close modal
            const modal = form.closest('.modal');
            if (modal) modal.classList.add('hidden');

            joinGameByCode(code);
        });
    }

    // ---- Server list modal ----
    function _setupServerListModal() {
        const form = document.getElementById('server-list-form');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = form.querySelector('#server-list-code-input');
            const code = input ? input.value.trim() : '';
            if (!code) return;
            loadServers(code);
        });

        // Refresh button inside server list modal
        const refreshBtn = document.getElementById('refresh-servers-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const input = form.querySelector('#server-list-code-input');
                const code = input ? input.value.trim() : '';
                if (code) loadServers(code);
            });
        }
    }

    // ---- Search ----
    function _setupSearch() {
        const input = document.getElementById('lobby-search');
        if (!input) return;

        input.addEventListener('input', () => {
            clearTimeout(_searchDebounce);
            _searchDebounce = setTimeout(() => {
                _filterGames(input.value.trim().toLowerCase());
            }, 250);
        });
    }

    /**
     * Filter visible game cards by search text.
     * @param {string} query
     */
    function _filterGames(query) {
        const cards = document.querySelectorAll('#games-grid .game-card');
        if (!query) {
            cards.forEach((c) => c.style.display = '');
            return;
        }

        cards.forEach((card) => {
            const title = (card.querySelector('.game-card-title')?.textContent || '').toLowerCase();
            const desc = (card.querySelector('.game-card-desc')?.textContent || '').toLowerCase();
            const category = (card.querySelector('.game-card-category')?.textContent || '').toLowerCase();
            const match = title.includes(query) || desc.includes(query) || category.includes(query);
            card.style.display = match ? '' : 'none';
        });
    }

    // ---- Settings ----
    function _setupSettings() {
        const saveBtn = document.getElementById('save-settings-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', _saveSettings);
        }
    }

    /** Load current settings from localStorage into the settings form. */
    function _loadSettings() {
        const settings = _getSettings();

        _setInputValue('setting-sensitivity', settings.sensitivity ?? BV.MOUSE_SENSITIVITY);
        _setInputValue('setting-render-distance', settings.renderDistance ?? BV.RENDER_DISTANCE);
        _setChecked('setting-shadows', settings.shadows !== false);
        _setChecked('setting-particles', settings.particles !== false);
    }

    /** Persist settings to localStorage. */
    function _saveSettings() {
        const settings = {
            sensitivity: parseFloat(document.getElementById('setting-sensitivity')?.value) || BV.MOUSE_SENSITIVITY,
            renderDistance: parseInt(document.getElementById('setting-render-distance')?.value) || BV.RENDER_DISTANCE,
            shadows: document.getElementById('setting-shadows')?.checked ?? true,
            particles: document.getElementById('setting-particles')?.checked ?? true,
        };

        localStorage.setItem(BV.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

        // Apply sensitivity immediately
        BV.MOUSE_SENSITIVITY = settings.sensitivity;

        Utils.showToast('Settings saved!', 'success');
    }

    /** Get settings from localStorage. */
    function _getSettings() {
        try {
            const raw = localStorage.getItem(BV.STORAGE_KEYS.SETTINGS);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    function _setInputValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    function _setChecked(id, checked) {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    }

    // ---- Category filter listener ----
    document.addEventListener('lobby:filterCategory', (e) => {
        _activeCategory = e.detail.category;
        renderFeaturedGames();
    });

    // ========================================
    //  Return the public interface
    // ========================================
    return {
        init,
        showSection,
        renderFeaturedGames,
        renderMyGames,
        createGame,
        hostGame,
        joinGameByCode,
        randomPlay,
        loadServers,
        renderServers,
        deleteGame,
    };
})();
