// ============================================
// BLOCKVERSE - UI Module
// ============================================
// General-purpose UI utilities: screen switching, modal management,
// cooldown badges, category filters, loading overlays, and game cards.
// ============================================

const UI = (() => {
    'use strict';

    // Track the currently visible screen
    let _currentScreen = null;

    // Track active cooldowns: Map<buttonId, intervalId>
    let _cooldowns = new Map();

    // ========================================
    //  Public API
    // ========================================

    /**
     * Initialize the UI module.
     * - Set up screen switching.
     * - Wire up modal open/close handlers.
     * - Render category filter pills.
     * - Set up event delegation for close buttons.
     */
    function init() {
        _setupModalDelegation();
        _setupResizeHandler();
    }

    /**
     * Show a screen and hide all others.
     * @param {string} screenId  The id of the .screen element to show.
     */
    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach((el) => {
            el.classList.remove('active');
        });

        const target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active');
            _currentScreen = screenId;
        }

        // Special per-screen hooks
        if (screenId === 'screen-lobby') {
            _onLobbyScreen();
        } else if (screenId === 'screen-game') {
            _onGameScreen();
        }
    }

    /**
     * Show a modal by removing the .hidden class.
     * @param {string} modalId
     */
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('hidden');
    }

    /**
     * Hide a modal by adding the .hidden class.
     * @param {string} modalId
     */
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
    }

    /** Hide every modal element on the page. */
    function closeAllModals() {
        document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
    }

    /**
     * Disable a button and show a countdown badge for the given duration.
     * @param {string} buttonId   The button's id attribute.
     * @param {number} seconds    Cooldown length.
     * @param {function} [onComplete]  Called when cooldown finishes.
     */
    function startCooldown(buttonId, seconds, onComplete) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;

        // Clear any existing cooldown on this button
        if (_cooldowns.has(buttonId)) {
            clearInterval(_cooldowns.get(buttonId));
            _cooldowns.delete(buttonId);
        }

        btn.disabled = true;

        let remaining = seconds;

        // Create or reuse badge element
        let badge = btn.querySelector('.cooldown-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'cooldown-badge';
            btn.appendChild(badge);
        }
        badge.textContent = remaining + 's';

        const intervalId = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(intervalId);
                _cooldowns.delete(buttonId);
                btn.disabled = false;
                if (badge.parentNode) badge.remove();
                if (typeof onComplete === 'function') onComplete();
            } else {
                badge.textContent = remaining + 's';
            }
        }, 1000);

        _cooldowns.set(buttonId, intervalId);
    }

    /**
     * Render category filter pills from BV.GAME_CATEGORIES into #category-filters.
     * The "All Games" pill is active by default.
     */
    function renderCategoryFilters() {
        const container = document.getElementById('category-filters');
        if (!container) return;
        container.innerHTML = '';

        BV.GAME_CATEGORIES.forEach((cat, index) => {
            const pill = document.createElement('button');
            pill.className = 'category-pill';
            if (index === 0) pill.classList.add('active');
            pill.dataset.category = cat.id;
            pill.textContent = `${cat.icon} ${cat.name}`;

            pill.addEventListener('click', () => {
                container.querySelectorAll('.category-pill').forEach((p) => p.classList.remove('active'));
                pill.classList.add('active');

                // Dispatch filter event for Lobby to pick up
                document.dispatchEvent(
                    new CustomEvent('lobby:filterCategory', { detail: { category: cat.id } })
                );
            });

            container.appendChild(pill);
        });
    }

    /**
     * Show the global loading overlay with optional text.
     * @param {string} [text='Loading...']
     */
    function showLoading(text) {
        const overlay = document.getElementById('loading-screen');
        const bar = document.getElementById('loading-bar');
 const label = document.getElementById('loading-text');

        if (overlay) overlay.classList.remove('hidden');
        if (label) label.textContent = text || 'Loading...';
        if (bar) bar.style.width = '0%';
    }

    /** Hide the global loading overlay. */
    function hideLoading() {
        const overlay = document.getElementById('loading-screen');
        if (overlay) overlay.classList.add('hidden');
    }

    /**
     * Update the loading progress bar.
     * @param {number} percent  0-100
     * @param {string} [text]
     */
    function updateLoadingBar(percent, text) {
        const bar = document.getElementById('loading-bar');
        const label = document.getElementById('loading-text');
        if (bar) bar.style.width = Utils.clamp(percent, 0, 100) + '%';
        if (text && label) label.textContent = text;
    }

    /**
     * Generate the HTML string for a game card.
     * @param {object} game
     * @returns {string}
     */
    function renderGameCard(game) {
        const color = game.color || BV.COLORS.PRIMARY;
        const gradient = `linear-gradient(135deg, ${color} 0%, ${_shiftColor(color, -30)} 100%)`;
        const playerText = game.players != null
            ? `${game.players}/${game.maxPlayers || BV.MAX_PLAYERS_PER_SERVER}`
            : `0/${game.maxPlayers || BV.MAX_PLAYERS_PER_SERVER}`;

        return `
            <div class="game-card" data-code="${game.code || ''}" data-category="${game.category || ''}">
                <div class="game-card-thumb" style="background:${gradient};">
                    <span class="thumb-icon">${game.icon || '🏗️'}</span>
                </div>
                <div class="game-card-info">
                    <h3 class="game-card-title">${game.name || 'Untitled'}</h3>
                    <p class="game-card-desc">${game.description || ''}</p>
                    <div class="game-card-meta">
                        <span class="game-card-category">${game.category || ''}</span>
                        <span class="game-card-players">👤 ${playerText}</span>
                    </div>
                </div>
                <button class="btn btn-primary game-card-play-btn" data-code="${game.code || ''}">
                    ▶ PLAY
                </button>
            </div>`;
    }

    /**
     * Show a modal displaying a game code the host can share.
     * @param {string} code
     */
    function showGameCodeModal(code) {
        Utils.showToast('Game Code: ' + code + ' (copied to clipboard!)', 'success', 8000);
        navigator.clipboard.writeText(code).catch(() => {});
    }

    /** @returns {string|null} The id of the currently visible screen. */
    function getCurrentScreen() {
        return _currentScreen;
    }

    // ========================================
    //  Private helpers
    // ========================================

    /**
     * Hook called when the lobby screen is shown.
     * Updates sidebar user info and triggers rendering.
     */
    function _onLobbyScreen() {
        // Update sidebar username
        try {
            const nameEl = document.getElementById('sidebar-username');
            if (nameEl && Auth.isLoggedIn()) {
                nameEl.textContent = Auth.getCurrentUser();
            }

            // Update sidebar avatar
            const avatarEl = document.getElementById('sidebar-avatar');
            if (avatarEl && Auth.isLoggedIn() && typeof Avatar !== 'undefined') {
                avatarEl.innerHTML = Avatar.getAvatarHTML(Auth.getCurrentUser(), 'small');
            }
        } catch (err) {
            console.error('[UI] _onLobbyScreen error:', err);
        }

        // Render category filters
        try {
            renderCategoryFilters();
        } catch (err) {
            console.error('[UI] renderCategoryFilters error:', err);
        }
    }

    /**
     * Hook called when the game screen is shown.
     * Triggers game-world initialisation via the App module.
     */
    function _onGameScreen() {
        if (typeof App !== 'undefined') {
            App.enterGame();
        }
    }

    /**
     * Set up event delegation so that any click on a .modal-close
     * button closes its closest .modal parent.
     */
    function _setupModalDelegation() {
        document.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('.modal-close');
            if (closeBtn) {
                const modal = closeBtn.closest('.modal');
                if (modal) modal.classList.add('hidden');
            }
        });

        // Close modal on backdrop click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.add('hidden');
            }
        });
    }

    /** Dispatch resize events so World and Player can adapt. */
    function _setupResizeHandler() {
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                document.dispatchEvent(new CustomEvent('ui:resize'));
            }, 100);
        });
    }

    /**
     * Shift a hex colour by a percentage (negative = darker).
     * @param {string} hex
     * @param {number} percent
     * @returns {string}
     */
    function _shiftColor(hex, percent) {
        if (!hex || hex.length < 7) return hex;
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        r = Math.min(255, Math.max(0, r + Math.round(r * (percent / 100))));
        g = Math.min(255, Math.max(0, g + Math.round(g * (percent / 100))));
        b = Math.min(255, Math.max(0, b + Math.round(b * (percent / 100))));
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // ========================================
    //  Return the public interface
    // ========================================
    return {
        init,
        showScreen,
        openModal,
        closeModal,
        closeAllModals,
        startCooldown,
        renderCategoryFilters,
        showLoading,
        hideLoading,
        updateLoadingBar,
        renderGameCard,
        showGameCodeModal,
        getCurrentScreen,
    };
})();
