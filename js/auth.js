// ============================================
// BLOCKVERSE - Authentication Module
// ============================================
// Handles user registration, login, logout, and session management
// using localStorage for persistence. Passwords are hashed with SHA-256.
// ============================================

const Auth = (() => {
    'use strict';

    // ---- Internal state ----
    let _currentUser = null;

    // ---- Username validation regex (3-20 alphanumeric + underscore) ----
    const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

    // ---- Default avatar config assigned to new accounts ----
    const DEFAULT_AVATAR = {
        bodyColor: '#3F51B5',
        headShape: 'default',
        bodyShape: 'default',
        accessory: 'none',
    };

    // ========================================
    //  Public API
    // ========================================

    /**
     * Initialize the auth module.
     * - Check for an existing session and validate it.
     * - Wire up login / signup tab switching.
     * - Attach form submit handlers.
     * - Set up debounced username-availability checking.
     */
    function init() {
        // Restore session if one exists
        const session = _loadSession();
        if (session && session.username) {
            const userData = _loadUserData(session.username);
            if (userData) {
                _currentUser = session.username;
                _dispatchLogin(session.username);
            } else {
                // Session references a deleted user – clear it
                _clearSession();
            }
        }

        _setupTabSwitching();
        _setupFormHandlers();
        _setupUsernameCheck();
    }

    /**
     * Create a new account.
     * @param {string} username
     * @param {string} password
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async function signup(username, password) {
        // Validate username format
        if (!USERNAME_REGEX.test(username)) {
            return {
                success: false,
                error: 'Username must be 3-20 characters (letters, numbers, underscore)',
            };
        }

        // Check if username is already taken
        if (!_checkUsernameAvailable(username)) {
            return { success: false, error: 'Username is already taken' };
        }

        // Validate password
        if (!password || password.length < 4) {
            return { success: false, error: 'Password must be at least 4 characters' };
        }

        // Hash password and store user record
        const passwordHash = await Utils.hashPassword(password);
        const userData = {
            username,
            passwordHash,
            createdAt: Date.now(),
            avatar: { ...DEFAULT_AVATAR },
        };
        _saveUserData(username, userData);

        // Auto-login after successful signup
        _saveSession({ username, loginTime: Date.now() });
        _currentUser = username;
        _dispatchLogin(username);

        return { success: true };
    }

    /**
     * Log in an existing user.
     * @param {string} username
     * @param {string} password
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async function login(username, password) {
        const userData = _loadUserData(username);

        if (!userData) {
            return { success: false, error: 'Invalid username or password' };
        }

        const passwordHash = await Utils.hashPassword(password);

        if (passwordHash !== userData.passwordHash) {
            return { success: false, error: 'Invalid username or password' };
        }

        // Persist session
        _saveSession({ username, loginTime: Date.now() });
        _currentUser = username;
        _dispatchLogin(username);

        return { success: true };
    }

    /**
     * Log out the current user, clear session, and show the auth screen.
     */
    function logout() {
        const username = _currentUser;
        _clearSession();
        _currentUser = null;

        document.dispatchEvent(new CustomEvent('auth:logout', { detail: { username } }));

        // Show the auth screen
        if (typeof UI !== 'undefined') {
            UI.showScreen('screen-auth');
        }
    }

    /** @returns {boolean} True when a user is currently logged in. */
    function isLoggedIn() {
        return _currentUser !== null;
    }

    /** @returns {string|null} The current username, or null. */
    function getCurrentUser() {
        return _currentUser;
    }

    /**
     * Get a user's public profile data (no password hash).
     * @param {string} username
     * @returns {object|null}
     */
    function getUserData(username) {
        const data = _loadUserData(username);
        if (!data) return null;
        // Strip sensitive fields
        const { passwordHash, ...publicData } = data;
        return publicData;
    }

    /**
     * Update a user's stored data. Merges shallowly.
     * @param {string} username
     * @param {object} data  Fields to update.
     */
    function updateUserData(username, data) {
        const existing = _loadUserData(username);
        if (!existing) return;
        const merged = { ...existing, ...data };
        _saveUserData(username, merged);

        // If we're updating the currently logged-in user, keep in sync
        if (username === _currentUser) {
            document.dispatchEvent(
                new CustomEvent('auth:dataUpdated', { detail: { username, data } })
            );
        }
    }

    /**
     * Check whether a username is available (not yet registered).
     * @param {string} username
     * @returns {boolean}
     */
    function checkUsernameAvailability(username) {
        return _checkUsernameAvailable(username);
    }

    /**
     * Get a rich status string for a username.
     * @param {string} username
     * @returns {'available'|'taken'|'invalid'}
     */
    function getUsernameStatus(username) {
        if (!USERNAME_REGEX.test(username)) return 'invalid';
        return _checkUsernameAvailable(username) ? 'available' : 'taken';
    }

    // ========================================
    //  Private helpers
    // ========================================

    function _loadSession() {
        try {
            const raw = localStorage.getItem(BV.STORAGE_KEYS.AUTH);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function _saveSession(session) {
        localStorage.setItem(BV.STORAGE_KEYS.AUTH, JSON.stringify(session));
    }

    function _clearSession() {
        localStorage.removeItem(BV.STORAGE_KEYS.AUTH);
    }

    function _userKey(username) {
        return `bv_user_${username}`;
    }

    function _loadUserData(username) {
        try {
            const raw = localStorage.getItem(_userKey(username));
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function _saveUserData(username, data) {
        localStorage.setItem(_userKey(username), JSON.stringify(data));
    }

    function _checkUsernameAvailable(username) {
        return localStorage.getItem(_userKey(username)) === null;
    }

    function _dispatchLogin(username) {
        document.dispatchEvent(new CustomEvent('auth:login', { detail: { username } }));
    }

    // ---- Tab switching (login ↔ signup) ----
    function _setupTabSwitching() {
        const tabs = document.querySelectorAll('.auth-tab');
        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                tabs.forEach((t) => t.classList.remove('active'));
                tab.classList.add('active');

                const loginForm = document.getElementById('form-login');
                const signupForm = document.getElementById('form-signup');
                if (loginForm) loginForm.classList.toggle('hidden', target !== 'login');
                if (signupForm) signupForm.classList.toggle('hidden', target !== 'signup');
            });
        });
    }

    // ---- Form submission ----
    function _setupFormHandlers() {
        const loginForm = document.getElementById('form-login');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('login-username').value.trim();
                const password = document.getElementById('login-password').value;
                if (!username || !password) return;

                const result = await login(username, password);
                if (!result.success) {
                    Utils.showToast(result.error, 'error');
                }
            });
        }

        const signupForm = document.getElementById('form-signup');
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('signup-username').value.trim();
                const password = document.getElementById('signup-password').value;
                const confirm = document.getElementById('signup-confirm').value;

                if (password !== confirm) {
                    Utils.showToast('Passwords do not match', 'error');
                    return;
                }

                const result = await signup(username, password);
                if (!result.success) {
                    Utils.showToast(result.error, 'error');
                }
            });
        }
    }

    // ---- Debounced username availability indicator ----
    function _setupUsernameCheck() {
        const input = document.getElementById('signup-username');
        const statusEl = document.getElementById('username-status');
        if (!input || !statusEl) return;

        const debouncedCheck = Utils.debounce(() => {
            const username = input.value.trim();

            // Clear previous
            statusEl.textContent = '';
            statusEl.className = '';

            if (!username) return;

            const status = getUsernameStatus(username);

            switch (status) {
                case 'available':
                    statusEl.textContent = '✅';
                    statusEl.className = 'status-available';
                    break;
                case 'taken':
                    statusEl.textContent = '❌';
                    statusEl.className = 'status-taken';
                    break;
                case 'invalid':
                    statusEl.textContent = '⚠️';
                    statusEl.className = 'status-invalid';
                    break;
            }
        }, 500);

        input.addEventListener('input', () => {
            const username = input.value.trim();
            if (!username) {
                statusEl.textContent = '';
                statusEl.className = '';
                return;
            }
            // Show "checking..." immediately
            statusEl.textContent = '...';
            statusEl.className = 'status-checking';
            debouncedCheck();
        });
    }

    // ========================================
    //  Return the public interface
    // ========================================
    return {
        init,
        signup,
        login,
        logout,
        isLoggedIn,
        getCurrentUser,
        getUserData,
        updateUserData,
        checkUsernameAvailability,
        getUsernameStatus,
    };
})();
