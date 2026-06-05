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
    //  GitHub Device Flow Configuration
    // ========================================
    const GITHUB_CLIENT_ID = 'Ov23ligIlHtTGVeIIfoC';
    const GITHUB_CLIENT_SECRET = '40badd746d3d3986327ee8b86d6b70553ebf30cd';
    
    // Device Flow state
    let _deviceCodeData = null;
    let _githubUsername = null;

    // ========================================
    //  Public API
    // ========================================

    /**
     * Initialize the auth module.
     * - Check for an existing session and validate it.
     * - Wire up login / signup tab switching.
     * - Attach form submit handlers.
     * - Set up debounced username-availability checking.
     * - Check if GitHub linking is needed.
     */
    function init() {
        // Restore session if one exists
        const session = _loadSession();
        if (session && session.username) {
            const userData = _loadUserData(session.username);
            if (userData) {
                _currentUser = session.username;
                _githubUsername = userData.githubUsername || null;
                _dispatchLogin(session.username);
                
                // Check if user needs to link GitHub account
                if (!_githubUsername && !localStorage.getItem('bv_github_link_dismissed')) {
                    _showGitHubLinkPrompt();
                }
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
            const session = raw ? JSON.parse(raw) : null;
            // Handle mock sessions from verification scripts
            if (session && session.username && !session.loginTime) {
                session.loginTime = Date.now();
            }
            return session;
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
    //  GitHub Device Flow Functions
    // ========================================
    
    async function _showGitHubLinkPrompt() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px; text-align: center;">
                <h2 style="color: #fff; margin-bottom: 20px;">🔗 Link Your GitHub Account</h2>
                <p style="color: #ccc; margin-bottom: 20px;">
                    Link your GitHub account to unlock:
                </p>
                <ul style="text-align: left; color: #aaa; margin-bottom: 30px; list-style: disc; padding-left: 20px;">
                    <li>☁️ Cloud game saving</li>
                    <li>🌍 Publish games to the community</li>
                    <li>📦 Access to the Community Hub</li>
                    <li>🔓 Uncopylock your games (optional)</li>
                </ul>
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    <button id="btn-github-link" style="background: #6e5494; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">
                        🔗 Link GitHub Account
                    </button>
                    <button id="btn-github-later" style="background: #444; color: #ccc; border: 1px solid #666; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px;">
                        Maybe Later
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('btn-github-link').addEventListener('click', () => {
            modal.remove();
            _startDeviceFlow();
        });
        
        document.getElementById('btn-github-later').addEventListener('click', () => {
            modal.remove();
            localStorage.setItem('bv_github_link_dismissed', 'true');
        });
    }
    
    async function _startDeviceFlow() {
        try {
            // Step 1: Request device code from GitHub
            const response = await fetch('https://github.com/login/device/code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: new URLSearchParams({
                    client_id: GITHUB_CLIENT_ID,
                    scope: 'public_repo,user'
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to get device code');
            }
            
            const data = await response.json();
            _deviceCodeData = data;
            
            // Show verification UI
            _showVerificationUI(data);
            
            // Start polling for token
            _pollForToken(data.device_code, data.interval);
            
        } catch (error) {
            console.error('[Auth] Device Flow Error:', error);
            alert('Failed to start GitHub linking. Please try again.');
        }
    }
    
    function _showVerificationUI(data) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'github-verification-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px; text-align: center;">
                <h2 style="color: #fff; margin-bottom: 20px;">🔐 Verify Your Device</h2>
                <p style="color: #ccc; margin-bottom: 20px;">
                    1. Go to: <a href="${data.verification_uri}" target="_blank" style="color: #6e5494;">${data.verification_uri}</a>
                </p>
                <p style="color: #ccc; margin-bottom: 20px;">
                    2. Enter this code: <strong style="font-size: 24px; color: #fff; background: #333; padding: 10px 20px; border-radius: 8px; display: inline-block;">${data.user_code}</strong>
                </p>
                <div id="github-verification-status" style="color: #aaa; margin-top: 20px;">
                    ⏳ Waiting for verification...
                </div>
                <button id="btn-github-cancel" style="margin-top: 20px; background: #444; color: #ccc; border: 1px solid #666; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                    Cancel
                </button>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('btn-github-cancel').addEventListener('click', () => {
            modal.remove();
        });
    }
    
    async function _pollForToken(deviceCode, interval) {
        const statusEl = document.getElementById('github-verification-status');
        let attempts = 0;
        const maxAttempts = 300; // 15 minutes max
        
        const poll = async () => {
            attempts++;
            
            if (attempts > maxAttempts) {
                if (statusEl) statusEl.textContent = '❌ Verification timed out. Please try again.';
                return;
            }
            
            try {
                const response = await fetch('https://github.com/login/oauth/access_token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: new URLSearchParams({
                        client_id: GITHUB_CLIENT_ID,
                        client_secret: GITHUB_CLIENT_SECRET,
                        device_code: deviceCode,
                        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
                    })
                });
                
                const data = await response.json();
                
                if (data.error === 'authorization_pending') {
                    // Still waiting, continue polling
                    setTimeout(poll, interval * 1000);
                } else if (data.error === 'expired_token') {
                    if (statusEl) statusEl.textContent = '❌ Code expired. Please restart the process.';
                } else if (data.error === 'slow_down') {
                    // GitHub is asking us to slow down
                    setTimeout(poll, (interval + 5) * 1000);
                } else if (data.access_token) {
                    // Success! Get user info
                    if (statusEl) statusEl.textContent = '✅ Verified! Fetching your GitHub profile...';
                    await _fetchGitHubUser(data.access_token);
                } else {
                    if (statusEl) statusEl.textContent = '❌ An error occurred. Please try again.';
                }
            } catch (error) {
                console.error('[Auth] Polling error:', error);
                if (statusEl) statusEl.textContent = '❌ Network error. Please try again.';
            }
        };
        
        poll();
    }
    
    async function _fetchGitHubUser(accessToken) {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${accessToken}`,
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch GitHub user');
            }
            
            const userData = await response.json();
            _githubUsername = userData.login;
            
            // Save to user data
            const currentUser = _currentUser;
            if (currentUser) {
                const existingData = _loadUserData(currentUser) || {};
                existingData.githubUsername = _githubUsername;
                existingData.githubAccessToken = accessToken;
                _saveUserData(currentUser, existingData);
            }
            
            // Close verification modal
            const modal = document.getElementById('github-verification-modal');
            if (modal) modal.remove();
            
            // Show success message
            alert(`✅ Successfully linked to @${_githubUsername}!\n\nYou now have access to cloud saving and community features.`);
            
        } catch (error) {
            console.error('[Auth] Failed to fetch GitHub user:', error);
            alert('Failed to fetch GitHub profile. Please try again.');
        }
    }
    
    // Public method to manually link GitHub from settings
    function linkGitHubAccount() {
        _startDeviceFlow();
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
        linkGitHubAccount,
        getGitHubUsername: () => _githubUsername,
    };
})();
