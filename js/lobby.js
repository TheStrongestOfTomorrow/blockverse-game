// ============================================
// BLOCKVERSE - Lobby Module
// ============================================

const Lobby = (() => {
    'use strict';

    const FEATURED_GAMES = [
        {
            name: 'Block World',
            description: 'Build anything you can imagine on a flat green terrain with border walls!',
            category: 'sandbox',
            icon: '🏗️',
            code: 'SAMPLE-BLDW',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#4CAF50',
            players: 0,
        },
        {
            name: 'Sky Island',
            description: 'Explore a floating island with trees, a house, and ocean below!',
            category: 'adventure',
            icon: '🏝️',
            code: 'SAMPLE-ISLD',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#00BCD4',
            players: 0,
        },
        {
            name: 'Tower of Doom',
            description: 'Climb through 5 stages of obstacles in this epic obby course!',
            category: 'obby',
            icon: '🏰',
            code: 'SAMPLE-TOWR',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#E74C3C',
            players: 0,
        },
        {
            name: 'City Tycoon',
            description: 'Explore a full city with buildings, roads, parks, and shops!',
            category: 'tycoon',
            icon: '💰',
            code: 'SAMPLE-CTYT',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#FFD700',
            players: 0,
        },
        {
            name: 'Pirate Adventure',
            description: 'Set sail on a pirate ship across the open ocean!',
            category: 'adventure',
            icon: '🏴‍☠️',
            code: 'SAMPLE-PIRT',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#1565C0',
            players: 0,
        },
        {
            name: 'Castle Siege',
            description: 'Battle in a medieval castle with towers and battlements!',
            category: 'minigame',
            icon: '⚔️',
            code: 'SAMPLE-CSTL',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#9C27B0',
            players: 0,
        },
        {
            name: 'Speed Builder',
            description: 'Build fast on this clean flat world! Perfect for creative mode.',
            category: 'sandbox',
            icon: '⚡',
            code: 'SAMPLE-SPDB',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#FF9800',
            players: 0,
        },
        {
            name: 'Village Life',
            description: 'Explore a peaceful village with houses, gardens, and a well!',
            category: 'roleplay',
            icon: '🏘️',
            code: 'SAMPLE-VLG',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#8D6E63',
            players: 0,
        },
        {
            name: 'Battle Arena',
            description: 'Fight in a walled arena with spectator stands and diamond center!',
            category: 'minigame',
            icon: '🏟️',
            code: 'SAMPLE-ARNA',
            maxPlayers: BV.MAX_PLAYERS_PER_SERVER,
            color: '#673AB7',
            players: 0,
        },
    ];

    let _activeCategory = 'all';
    let _searchDebounce = null;
    let _selectedThumbnailColor = null;
    let _selectedTemplate = 'flat';

    // ========================================
    //  Public API
    // ========================================

    function init() {
        const username = Auth.getCurrentUser();
        if (username) renderHome();
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

    function showSection(sectionId) {
        document.querySelectorAll('.lobby-section').forEach((el) => {
            el.classList.remove('active');
        });

        const targetId = sectionId.startsWith('section-') ? sectionId : `section-${sectionId}`;
        const target = document.getElementById(targetId);
        if (target) target.classList.add('active');

        document.querySelectorAll('.sidebar-btn').forEach((btn) => {
            btn.classList.remove('active');
            if (btn.dataset.section === sectionId) {
                btn.classList.add('active');
            }
        });

        if (sectionId === 'home') renderHome();
        else if (sectionId === 'my-games') renderMyGames();
        else if (sectionId === 'discover') renderFeaturedGames();
        else if (sectionId === 'settings') _loadSettings();
        else if (sectionId === 'friends') {
            if (typeof Friends !== 'undefined') Friends.renderUI();
        } else if (sectionId === 'join-friends') {
            if (typeof Friends !== 'undefined') {
                Friends.refreshFriendStatuses();
                Friends.renderJoinFriendsUI();
            }
        }
    }

    /**
     * Render the Roblox-inspired Home screen.
     */
    function renderHome() {
        const username = Auth.getCurrentUser();
        const homeUsernameEl = document.getElementById('home-username');
        if (homeUsernameEl) homeUsernameEl.textContent = username;

        const homeAvatarEl = document.getElementById('home-avatar-container');
        if (homeAvatarEl && typeof Avatar !== 'undefined') {
            homeAvatarEl.innerHTML = Avatar.getAvatarHTML(username, 'xlarge');
        }

        // Render Recently Played (just using top featured games for now)
        const recentGrid = document.getElementById('recently-played-grid');
        if (recentGrid) {
            recentGrid.innerHTML = FEATURED_GAMES.slice(0, 3).map(g => UI.renderGameCard(g)).join('');
            recentGrid.querySelectorAll('.game-card').forEach((card) => {
                card.addEventListener('click', (e) => {
                    const code = card.dataset.code;
                    const game = FEATURED_GAMES.find(g => g.code === code);
                    if (game) _showGameDetails(game);
                });
            });
        }

        // Render Friends Widget
        const friendsWidget = document.getElementById('home-friends-widget');
        if (friendsWidget && typeof Friends !== 'undefined') {
            const friends = Friends.getFriends();
            if (friends.length === 0) {
                friendsWidget.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">No friends yet.</p>';
            } else {
                friendsWidget.innerHTML = friends.map(u => `
                    <div class="home-friend-card online" onclick="Lobby.showSection('friends')">
                        <div class="home-friend-avatar">${Avatar.getAvatarHTML(u, 'small')}</div>
                        <div class="home-friend-name">${u}</div>
                    </div>
                `).join('');
            }
        }
    }

    function renderFeaturedGames() {
        const grid = document.getElementById('games-grid');
        if (!grid) return;

        const allGames = [...FEATURED_GAMES, ..._getUserGames()];
        const filtered = _activeCategory === 'all'
            ? allGames
            : allGames.filter((g) => g.category === _activeCategory);

        grid.innerHTML = filtered.map((g) => UI.renderGameCard(g)).join('');

        // Wire up game card click -> open Detail Modal
        grid.querySelectorAll('.game-card').forEach((card) => {
            card.addEventListener('click', (e) => {
                const code = card.dataset.code;
                const game = allGames.find(g => g.code === code);
                if (game) _showGameDetails(game);
            });
        });
    }

    function _showGameDetails(game) {
        const modal = document.getElementById('game-detail-modal');
        if (!modal) return;

        document.getElementById('gd-name').textContent = game.name;
        document.getElementById('gd-desc').textContent = game.description;
        const catEl = document.getElementById('gd-category');
        if (catEl) catEl.textContent = (game.category || 'sandbox').toUpperCase();
        const playersEl = document.getElementById('gd-players');
        if (playersEl) playersEl.textContent = game.players || 0;

        const thumb = document.getElementById('gd-thumb');
        const heroIcon = document.getElementById('gd-hero-icon');
        if (heroIcon) heroIcon.textContent = game.icon || '🎮';
        if (thumb) thumb.style.background = game.color || 'var(--primary)';

        const playBtn = document.getElementById('gd-btn-play');
        if (playBtn) {
            playBtn.onclick = () => {
                modal.classList.add('hidden');
                joinGameByCode(game.code);
            };
        }

        const refreshBtn = document.getElementById('gd-refresh-servers');
        if (refreshBtn) {
            refreshBtn.onclick = () => _renderGameDetailServers(game.code);
        }

        // Ratings system
        const likeBtn = modal.querySelector('.btn-rate[title="Like"]');
        const dislikeBtn = modal.querySelector('.btn-rate[title="Dislike"]');
        const favoriteBtn = modal.querySelector('.btn-rate[title="Favorite"]');

                const updateRatingUI = () => {
            const current = _getRatings(game.code);
            if (likeBtn) likeBtn.textContent = `👍 ${current.likes}`;
            if (dislikeBtn) dislikeBtn.textContent = `👎 ${current.dislikes}`;

            // Calculate ratio
            const total = current.likes + current.dislikes;
            const ratio = total > 0 ? Math.round((current.likes / total) * 100) : 100;
            const ratioEl = modal.querySelector('.gd-rating-ratio');
            if (ratioEl) {
                ratioEl.textContent = `${ratio}% Positive`;
                ratioEl.style.color = ratio >= 70 ? '#4CAF50' : (ratio >= 40 ? '#FF9800' : '#F44336');
            }

            const userRating = _getUserRating(game.code);
            if (likeBtn) likeBtn.style.color = userRating === 'like' ? '#4CAF50' : '';
            if (dislikeBtn) dislikeBtn.style.color = userRating === 'dislike' ? '#F44336' : '';

            const isFav = _isFavorite(game.code);
            if (favoriteBtn) {
                favoriteBtn.textContent = isFav ? '⭐' : '☆';
                favoriteBtn.style.color = isFav ? '#FFD700' : '';
            }
        };

        if (likeBtn) likeBtn.onclick = (e) => { e.stopPropagation(); _toggleRating(game.code, 'like'); updateRatingUI(); };
        if (dislikeBtn) dislikeBtn.onclick = (e) => { e.stopPropagation(); _toggleRating(game.code, 'dislike'); updateRatingUI(); };
        if (favoriteBtn) favoriteBtn.onclick = (e) => { e.stopPropagation(); _toggleFavorite(game.code); updateRatingUI(); };

        updateRatingUI();
        _renderGameDetailServers(game.code);
        modal.classList.remove('hidden');
    }

    function _getRatings(code) {
        try {
            const allRatings = JSON.parse(localStorage.getItem('bv_game_ratings') || '{}');
            if (allRatings[code]) return allRatings[code];
            const likes = Math.floor(Math.random() * 500) + 100;
            const dislikes = Math.floor(Math.random() * 50);
            return { likes, dislikes };
        } catch { return { likes: 0, dislikes: 0 }; }
    }

    function _getUserRating(code) {
        try {
            const userRatings = JSON.parse(localStorage.getItem('bv_user_ratings') || '{}');
            return userRatings[code];
        } catch { return null; }
    }

    function _toggleRating(code, type) {
        try {
            const userRatings = JSON.parse(localStorage.getItem('bv_user_ratings') || '{}');
            const allRatings = JSON.parse(localStorage.getItem('bv_game_ratings') || '{}');
            if (!allRatings[code]) allRatings[code] = _getRatings(code);

            const current = userRatings[code];
            if (current === type) {
                delete userRatings[code];
                allRatings[code][type === 'like' ? 'likes' : 'dislikes']--;
            } else {
                if (current) allRatings[code][current === 'like' ? 'likes' : 'dislikes']--;
                userRatings[code] = type;
                allRatings[code][type === 'like' ? 'likes' : 'dislikes']++;
            }
            localStorage.setItem('bv_user_ratings', JSON.stringify(userRatings));
            localStorage.setItem('bv_game_ratings', JSON.stringify(allRatings));
        } catch (e) {}
    }

    function _isFavorite(code) {
        try {
            const favorites = JSON.parse(localStorage.getItem('bv_user_favorites') || '[]');
            return favorites.includes(code);
        } catch { return false; }
    }

    function _toggleFavorite(code) {
        try {
            let favorites = JSON.parse(localStorage.getItem('bv_user_favorites') || '[]');
            if (favorites.includes(code)) {
                favorites = favorites.filter(c => c !== code);
            } else {
                favorites.push(code);
            }
            localStorage.setItem('bv_user_favorites', JSON.stringify(favorites));
        } catch (e) {}
    }

    async function _renderGameDetailServers(gameCode) {
        const container = document.getElementById('gd-server-list');
        if (!container) return;

        container.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--text-muted);">Scanning for active sessions...</div>';

        if (typeof Multiplayer !== 'undefined') {
            try {
                const servers = await Multiplayer.findServers(gameCode);
                if (servers.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state" style="padding:1rem;">
                            <p>No active servers found for this world.</p>
                            <button class="btn btn-sm btn-ghost mt-sm" onclick="Lobby.joinGameByCode('${gameCode}')">Create Solo Session</button>
                        </div>`;
                } else {
                    container.innerHTML = servers.map((s, i) => `
                        <div class="gd-server-card">
                            <div class="gd-server-info">
                                <div class="gd-server-name">🌐 ${s.name || 'Public Server #' + (i + 1)}</div>
                                <div class="gd-server-players">👤 ${s.playerCount}/${s.maxPlayers} players online</div>
                            </div>
                            <button class="btn btn-sm btn-primary" onclick="Lobby.joinGameByCode('${s.serverId}')">JOIN</button>
                        </div>
                    `).join('');
                }
            } catch (e) {
                container.innerHTML = '<div style="padding:1.5rem;color:var(--danger);text-align:center;">Network error while fetching servers.</div>';
            }
        }
    }

    function renderMyGames() {
        const grid = document.getElementById('my-games-grid');
        const noGamesMsg = document.getElementById('no-games-msg');
        if (!grid) return;

        const games = _getUserGames();

        if (games.length === 0) {
            grid.innerHTML = '';
            if (noGamesMsg) noGamesMsg.style.display = '';
            return;
        }

        if (noGamesMsg) noGamesMsg.style.display = 'none';

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

        grid.querySelectorAll('.host-game-btn').forEach((btn) => {
            btn.addEventListener('click', () => hostGame(btn.dataset.code));
        });
        grid.querySelectorAll('.delete-game-btn').forEach((btn) => {
            btn.addEventListener('click', () => deleteGame(btn.dataset.code));
        });
    }

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

        // Persist game config
        const games = _getUserGames();
        games.push(gameConfig);
        localStorage.setItem(BV.STORAGE_KEYS.CREATED_GAMES, JSON.stringify(games));

        document.dispatchEvent(new CustomEvent('game:create', { detail: { code, config: gameConfig } }));

        // Show loading
        if (typeof UI !== 'undefined') UI.showLoading('Creating game...');

        // Generate terrain first (before entering game screen)
        setTimeout(() => {
            try {
                if (typeof UI !== 'undefined') UI.updateLoadingBar(20, 'Generating world...');

                // Initialize World if needed
                if (typeof World !== 'undefined' && !World.scene) {
                    World.init();
                }

                // Generate terrain
                if (typeof World !== 'undefined') {
                    World.generateTerrain(gameConfig.template);
                }

                if (typeof UI !== 'undefined') UI.updateLoadingBar(60, 'Starting server...');

                // Try to host via multiplayer
                if (typeof Multiplayer !== 'undefined') {
                    Multiplayer.hostGame(code, gameConfig).then(() => {
                        if (typeof UI !== 'undefined') UI.updateLoadingBar(90, 'Almost ready...');
                        setTimeout(() => {
                            if (typeof UI !== 'undefined') {
                                UI.updateLoadingBar(100, 'Done!');
                                setTimeout(() => {
                                    UI.hideLoading();
                                    if (typeof App !== 'undefined') App.enterGame();
                                    UI.showGameCodeModal(code);
                                }, 300);
                            }
                        }, 500);
                    }).catch((err) => {
                        console.warn('[Lobby] Multiplayer host failed, starting solo:', err);
                        // Still launch in single-player mode
                        setTimeout(() => {
                            if (typeof UI !== 'undefined') {
                                UI.updateLoadingBar(100, 'Done!');
                                setTimeout(() => {
                                    UI.hideLoading();
                                    if (typeof App !== 'undefined') App.enterGame();
                                    UI.showGameCodeModal(code);
                                }, 300);
                            }
                        }, 300);
                    });
                } else {
                    setTimeout(() => {
                        if (typeof UI !== 'undefined') {
                            UI.updateLoadingBar(100, 'Done!');
                            setTimeout(() => {
                                UI.hideLoading();
                                if (typeof App !== 'undefined') App.enterGame();
                                UI.showGameCodeModal(code);
                            }, 300);
                        }
                    }, 300);
                }
            } catch (err) {
                console.error('[Lobby] Error creating game:', err);
                if (typeof UI !== 'undefined') UI.hideLoading();
                Utils.showToast('Failed to create game.', 'error');
            }
        }, 200);
    }

    function hostGame(gameCode) {
        const games = _getUserGames();
        const config = games.find((g) => g.code === gameCode) || {};

        if (typeof UI !== 'undefined') UI.showLoading('Starting server...');

        return new Promise((resolve, reject) => {
            try {
                // Initialize World if needed
                if (typeof World !== 'undefined' && !World.scene) {
                    World.init();
                }

                // Generate terrain
                if (typeof World !== 'undefined') {
                    World.generateTerrain(config.template || 'flat');
                }

                if (typeof UI !== 'undefined') UI.updateLoadingBar(50, 'Connecting...');

                // Try to host multiplayer
                if (typeof Multiplayer !== 'undefined') {
                    Multiplayer.hostGame(gameCode, config).then(() => {
                        if (typeof UI !== 'undefined') UI.updateLoadingBar(100, 'Ready!');
                        setTimeout(() => {
                            if (typeof UI !== 'undefined') {
                                UI.hideLoading();
                                if (typeof App !== 'undefined') App.enterGame();
                                UI.showGameCodeModal(gameCode);
                            }
                            resolve();
                        }, 400);
                    }).catch(() => {
                        // Solo mode fallback
                        setTimeout(() => {
                            if (typeof UI !== 'undefined') {
                                UI.updateLoadingBar(100, 'Ready!');
                                setTimeout(() => {
                                    UI.hideLoading();
                                    if (typeof App !== 'undefined') App.enterGame();
                                    UI.showGameCodeModal(gameCode);
                                }, 400);
                            }
                            resolve();
                        }, 300);
                    });
                } else {
                    setTimeout(() => {
                        if (typeof UI !== 'undefined') {
                            UI.updateLoadingBar(100, 'Ready!');
                            setTimeout(() => {
                                UI.hideLoading();
                                if (typeof App !== 'undefined') App.enterGame();
                                UI.showGameCodeModal(gameCode);
                            }, 400);
                        }
                        resolve();
                    }, 300);
                }
            } catch (err) {
                console.error('[Lobby] Failed to host:', err);
                if (typeof UI !== 'undefined') UI.hideLoading();
                Utils.showToast('Failed to host game.', 'error');
                reject(err);
            }
        });
    }

    function joinGameByCode(code) {
        if (!code) return;
        code = code.toUpperCase().trim();

        // For sample games, launch in single-player mode
        if (code.startsWith('SAMPLE-')) {
            if (typeof UI !== 'undefined') UI.showLoading('Loading game...');

            const templates = {
                'SAMPLE-BLDW': 'flat',
                'SAMPLE-TOWR': 'obby',
                'SAMPLE-SPDB': 'empty',
                'SAMPLE-CTYT': 'city',
                'SAMPLE-ISLD': 'island',
                'SAMPLE-PIRT': 'pirate',
                'SAMPLE-CSTL': 'castle',
                'SAMPLE-VLG': 'village',
                'SAMPLE-ARNA': 'arena',
            };
            const template = templates[code] || 'flat';

            const allGames = [...FEATURED_GAMES, ..._getUserGames()];
            const gameConfig = allGames.find(g => g.code === code) || {};

            setTimeout(() => {
                if (typeof UI !== 'undefined') UI.updateLoadingBar(30, 'Generating world...');

                // Init World and generate terrain
                if (typeof World !== 'undefined') {
                    if (!World.scene) World.init();
                    World.generateTerrain(template);
                }

                setTimeout(() => {
                    if (typeof UI !== 'undefined') {
                        UI.updateLoadingBar(100, 'Done!');
                        setTimeout(() => {
                            UI.hideLoading();
                            if (typeof App !== 'undefined') App.enterGame();
                            Utils.showToast(`Playing ${gameConfig.name || code}`, 'success');
                        }, 200);
                    }
                }, 400);
            }, 200);
            return;
        }

        // Normal multiplayer join for user-created games
        if (typeof UI !== 'undefined') UI.showLoading(`Joining ${code}...`);

        // Check if input is already a server ID (e.g. BV-XXXX-S1)
        const hostPeerId = code.includes('-S') ? code : `${code}-S1`;

        if (typeof Multiplayer !== 'undefined') {
            Multiplayer.joinGame(hostPeerId).then(() => {
                if (typeof UI !== 'undefined') UI.updateLoadingBar(100, 'Connected!');
                setTimeout(() => {
                    if (typeof UI !== 'undefined') {
                        UI.hideLoading();
                        if (typeof App !== 'undefined') App.enterGame();
                    }
                }, 400);
            }).catch(() => {
                console.warn('[Lobby] Multiplayer join failed, trying solo');
                // Solo fallback - just load with flat terrain
                if (typeof World !== 'undefined') {
                    if (!World.scene) World.init();
                    World.generateTerrain('flat');
                }
                if (typeof UI !== 'undefined') {
                    UI.updateLoadingBar(100, 'Solo mode');
                    setTimeout(() => {
                        UI.hideLoading();
                        if (typeof App !== 'undefined') App.enterGame();
                    }, 400);
                }
            });
        }
    };
            const template = templates[code] || 'flat';

            const allGames = [...FEATURED_GAMES, ..._getUserGames()];
            const gameConfig = allGames.find(g => g.code === code) || {};

            setTimeout(() => {
                if (typeof UI !== 'undefined') UI.updateLoadingBar(30, 'Generating world...');

                // Init World and generate terrain
                if (typeof World !== 'undefined') {
                    if (!World.scene) World.init();
                    World.generateTerrain(template);
                }

                setTimeout(() => {
                    if (typeof UI !== 'undefined') {
                        UI.updateLoadingBar(100, 'Done!');
                        setTimeout(() => {
                            UI.hideLoading();
                            if (typeof App !== 'undefined') App.enterGame();
                            Utils.showToast(`Playing ${gameConfig.name || code}`, 'success');
                        }, 200);
                    }
                }, 400);
            }, 200);
            return;
        }

        // Normal multiplayer join for user-created games
        if (typeof UI !== 'undefined') UI.showLoading(`Joining game ${code}...`);

        const hostPeerId = `${code}-S1`;
        if (typeof Multiplayer !== 'undefined') {
            Multiplayer.joinGame(hostPeerId).then(() => {
                if (typeof UI !== 'undefined') UI.updateLoadingBar(100, 'Connected!');
                setTimeout(() => {
                    if (typeof UI !== 'undefined') {
                        UI.hideLoading();
                        if (typeof App !== 'undefined') App.enterGame();
                    }
                }, 400);
            }).catch(() => {
                console.warn('[Lobby] Multiplayer join failed, trying solo');
                // Solo fallback - just load with flat terrain
                if (typeof World !== 'undefined') {
                    if (!World.scene) World.init();
                    World.generateTerrain('flat');
                }
                if (typeof UI !== 'undefined') {
                    UI.updateLoadingBar(100, 'Solo mode');
                    setTimeout(() => {
                        UI.hideLoading();
                        if (typeof App !== 'undefined') App.enterGame();
                        Utils.showToast('Joined in solo mode (host offline)', 'info');
                    }, 400);
                }
            });
        }
    }

    function randomPlay() {
        if (typeof UI !== 'undefined') UI.showLoading('Finding a game...');
        if (typeof UI !== 'undefined') UI.startCooldown('btn-random-play', BV.RANDOM_PLAY_COOLDOWN);

        // For now, just pick a random sample game
        const sampleCodes = ['SAMPLE-BLDW', 'SAMPLE-TOWR', 'SAMPLE-SPDB', 'SAMPLE-CTYT', 'SAMPLE-ISLD', 'SAMPLE-PIRT', 'SAMPLE-CSTL', 'SAMPLE-VLG', 'SAMPLE-ARNA'];
        const randomCode = sampleCodes[Math.floor(Math.random() * sampleCodes.length)];

        setTimeout(() => {
            joinGameByCode(randomCode);
        }, 500);
    }

    function loadServers(gameCode) {
        if (typeof UI !== 'undefined') UI.showLoading('Finding servers...');
        if (typeof UI !== 'undefined') UI.startCooldown('btn-load-servers', BV.REFRESH_COOLDOWN);

        if (typeof Multiplayer !== 'undefined') {
            Multiplayer.findServers(gameCode).then((servers) => {
                if (typeof UI !== 'undefined') UI.hideLoading();
                renderServers(servers);
            }).catch(() => {
                if (typeof UI !== 'undefined') UI.hideLoading();
                renderServers([]);
            });
        } else {
            if (typeof UI !== 'undefined') UI.hideLoading();
            renderServers([]);
        }
    }

    function renderServers(servers) {
        const container = document.getElementById('server-list-in-game');
        if (!container) return;

        if (!servers || servers.length === 0) {
            container.innerHTML = '<p style="color:#a0a0b0">No servers found. Host one from the lobby!</p>';
            return;
        }

        container.innerHTML = servers.map((s, i) => {
            const isFull = s.playerCount >= s.maxPlayers;
            return `
                <div class="server-item">
                    <div class="server-info">
                        <span>Server ${i + 1}</span>
                        <span>👤 ${s.playerCount}/${s.maxPlayers}</span>
                    </div>
                    <button class="btn btn-sm ${isFull ? 'btn-ghost' : 'btn-primary'} join-server-btn"
                            data-server="${s.serverId}" ${isFull ? 'disabled' : ''}>
                        ${isFull ? 'FULL' : 'JOIN'}
                    </button>
                </div>`;
        }).join('');

        container.querySelectorAll('.join-server-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const serverId = btn.dataset.server;
                if (!serverId || btn.disabled) return;
                joinGameByCode(serverId);
            });
        });
    }

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

    function _getUserGames() {
        try {
            const raw = localStorage.getItem(BV.STORAGE_KEYS.CREATED_GAMES);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function _setupSidebarNav() {
        document.querySelectorAll('.sidebar-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section;
                if (section) showSection(section);
            });
        });
    }

    function _setupCreateGameForm() {
        const btn = document.getElementById('btn-create-game');
        if (!btn) return;

        btn.addEventListener('click', (e) => {
            e.preventDefault();

            const formData = {
                name: document.getElementById('game-name')?.value?.trim(),
                description: document.getElementById('game-desc')?.value?.trim(),
                category: document.getElementById('game-category')?.value || 'sandbox',
                maxPlayers: document.getElementById('game-max-players')?.value || BV.MAX_PLAYERS_PER_SERVER,
                thumbnailColor: _selectedThumbnailColor || BV.COLORS.PRIMARY,
                template: _selectedTemplate || 'flat',
                allowSave: document.getElementById('game-allow-save')?.checked ?? true,
                saveableBlocks: true,
                maxBlocksPerPlayer: document.getElementById('game-max-blocks')?.value || BV.MAX_BLOCKS_PER_PLAYER_SAVE,
            };

            if (!formData.name) {
                Utils.showToast('Please enter a game name', 'error');
                return;
            }

            createGame(formData);
        });
    }

    function _populateCreateGameOptions() {
        // Thumbnail color picker
        const colorContainer = document.getElementById('thumbnail-colors');
        if (colorContainer) {
            const colors = ['#E74C3C', '#E91E63', '#9C27B0', '#3F51B5', '#2196F3',
                '#009688', '#4CAF50', '#FF9800', '#FF5722', '#795548'];
            colors.forEach((c) => {
                const el = document.createElement('div');
                el.className = 'color-circle';
                if (c === _selectedThumbnailColor) el.classList.add('selected');
                el.style.background = c;
                el.addEventListener('click', () => {
                    colorContainer.querySelectorAll('.color-circle').forEach((e) => e.classList.remove('selected'));
                    el.classList.add('selected');
                    _selectedThumbnailColor = c;
                });
                colorContainer.appendChild(el);
            });
        }

        // Template cards
        const templateContainer = document.getElementById('game-templates');
        if (templateContainer) {
            templateContainer.querySelectorAll('.template-card').forEach((card) => {
                const tpl = card.dataset.template;
                if (tpl === _selectedTemplate) card.classList.add('selected');
                card.addEventListener('click', () => {
                    templateContainer.querySelectorAll('.template-card').forEach((c) => c.classList.remove('selected'));
                    card.classList.add('selected');
                    _selectedTemplate = tpl;
                });
            });
        }

        // Max players slider
        const slider = document.getElementById('game-max-players');
        const valEl = document.getElementById('game-max-players-val');
        if (slider && valEl) {
            slider.addEventListener('input', () => { valEl.textContent = slider.value; });
        }

        // Allow save toggle
        const allowSaveCheckbox = document.getElementById('game-allow-save');
        const saveSettings = document.getElementById('save-settings');
        if (allowSaveCheckbox && saveSettings) {
            allowSaveCheckbox.addEventListener('change', () => {
                saveSettings.style.display = allowSaveCheckbox.checked ? 'block' : 'none';
            });
        }
    }

    function _setupRandomPlay() {
        const btn = document.getElementById('btn-random-play');
        if (btn) btn.addEventListener('click', randomPlay);
    }

    function _setupJoinCodeModal() {
        const btn = document.getElementById('btn-join-code');
        const input = document.getElementById('join-code-input');
        if (!btn || !input) return;

        btn.addEventListener('click', () => {
            const code = input.value.trim();
            if (!code) {
                Utils.showToast('Please enter a game code', 'error');
                return;
            }
            const modal = btn.closest('.modal');
            if (modal) modal.classList.add('hidden');
            joinGameByCode(code);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btn.click();
        });
    }

    function _setupServerListModal() {
        const loadBtn = document.getElementById('btn-load-servers');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                const code = prompt('Enter game code:');
                if (code) loadServers(code.trim().toUpperCase());
            });
        }
    }

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

    function _setupSettings() {
        const saveBtn = document.getElementById('btn-save-settings');
        if (saveBtn) saveBtn.addEventListener('click', _saveSettings);

        const sensitivitySlider = document.getElementById('setting-sensitivity');
        const sensitivityVal = document.getElementById('setting-sensitivity-val');
        if (sensitivitySlider && sensitivityVal) {
            sensitivitySlider.addEventListener('input', () => {
                sensitivityVal.textContent = sensitivitySlider.value;
            });
        }

        const renderDistSlider = document.getElementById('setting-render-dist');
        const renderDistVal = document.getElementById('setting-render-dist-val');
        if (renderDistSlider && renderDistVal) {
            renderDistSlider.addEventListener('input', () => {
                renderDistVal.textContent = renderDistSlider.value;
            });
        }
    }

    function _loadSettings() {
        const settings = _getSettings();
        _setInputValue('setting-sensitivity', settings.sensitivity ?? BV.MOUSE_SENSITIVITY);
        _setInputValue('setting-render-dist', settings.renderDistance ?? BV.RENDER_DISTANCE);
        _setChecked('setting-shadows', settings.shadows !== false);
        _setChecked('setting-particles', settings.particles !== false);
    }

    function _saveSettings() {
        const settings = {
            sensitivity: parseFloat(document.getElementById('setting-sensitivity')?.value) || BV.MOUSE_SENSITIVITY,
            renderDistance: parseInt(document.getElementById('setting-render-dist')?.value) || BV.RENDER_DISTANCE,
            shadows: document.getElementById('setting-shadows')?.checked ?? true,
            particles: document.getElementById('setting-particles')?.checked ?? true,
        };
        localStorage.setItem(BV.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        BV.MOUSE_SENSITIVITY = settings.sensitivity;
        BV.RENDER_DISTANCE = settings.renderDistance;
        Utils.showToast('Settings saved!', 'success');
    }

    function _getSettings() {
        try {
            const raw = localStorage.getItem(BV.STORAGE_KEYS.SETTINGS);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    function _setInputValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    function _setChecked(id, checked) {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    }

    document.addEventListener('lobby:filterCategory', (e) => {
        _activeCategory = e.detail.category;
        renderFeaturedGames();
    });

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
