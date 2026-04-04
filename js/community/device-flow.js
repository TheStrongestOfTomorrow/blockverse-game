/**
 * BlockVerse Community Hub - GitHub Authentication (Device Flow + PAT)
 * 
 * Provides TWO authentication methods:
 *   1. Device Flow — User enters a code on GitHub, no token handling needed
 *      Requires a registered OAuth App with a client_id.
 *   2. Personal Access Token (PAT) — User pastes a GitHub token directly
 *      Works immediately, no OAuth App registration needed.
 * 
 * The UI shows both methods as tabs so users can choose.
 * The client_id for Device Flow is stored in localStorage and can be configured.
 */

const DeviceFlow = {
    // ── GitHub OAuth settings ──
    _apiBase: 'https://github.com',
    _pollingInterval: null,
    _pollingTimeout: null,
    _activeAuthTab: 'device-flow', // 'device-flow' | 'pat'
    _onSuccessCallback: null,

    /**
     * Initialize: load saved client_id from localStorage.
     */
    init() {
        const saved = localStorage.getItem('bv_oauth_client_id');
        if (saved) {
            this._clientId = saved;
        }
    },

    /**
     * Get the current client_id (may be null if not configured).
     */
    getClientId() {
        return this._clientId || null;
    },

    /**
     * Set the OAuth App client_id and persist it.
     */
    setClientId(clientId) {
        this._clientId = clientId ? clientId.trim() : null;
        if (this._clientId) {
            localStorage.setItem('bv_oauth_client_id', this._clientId);
        } else {
            localStorage.removeItem('bv_oauth_client_id');
        }
    },

    /**
     * Check if device flow is available (has a client_id configured).
     */
    isAvailable() {
        return !!this._clientId;
    },

    /**
     * Step 1: Request a device code from GitHub.
     * POST https://github.com/login/device/code
     * 
     * Returns: { device_code, user_code, verification_uri, expires_in, interval }
     */
    async requestDeviceCode() {
        if (!this._clientId) {
            return {
                success: false,
                error: 'No OAuth App client_id configured. Please set up a client_id first.',
            };
        }

        try {
            const response = await fetch(`${this._apiBase}/login/device/code`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    client_id: this._clientId,
                    scope: 'public_repo',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error_description || data.error || 'Failed to request device code.');
            }

            return {
                success: true,
                deviceCode: data.device_code,
                userCode: data.user_code,
                verificationUri: data.verification_uri,
                expiresIn: data.expires_in,
                interval: data.interval || 5,
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    /**
     * Step 2: Poll GitHub for the access token.
     * POST https://github.com/login/device/token
     * 
     * Keep polling until the user authorizes the app.
     * 
     * @param {string} deviceCode - The device_code from step 1
     * @param {function} onPolling - Callback(pollCount, maxEstimate) called on each poll
     * @param {number} interval - Seconds between polls (from step 1)
     * @returns {Promise<{success: boolean, access_token?: string, error?: string}>}
     */
    async pollForToken(deviceCode, onPolling, interval = 5) {
        if (!this._clientId) {
            return { success: false, error: 'No client_id configured.' };
        }

        return new Promise((resolve) => {
            let pollCount = 0;
            const maxPolls = Math.ceil(900 / interval); // GitHub expires after 15 min

            const poll = async () => {
                pollCount++;
                if (onPolling) onPolling(pollCount, maxPolls);

                try {
                    const response = await fetch(`${this._apiBase}/login/device/token`, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            client_id: this._clientId,
                            device_code: deviceCode,
                        }),
                    });

                    const data = await response.json();

                    if (response.ok && data.access_token) {
                        // Success!
                        this._stopPolling();
                        resolve({ success: true, accessToken: data.access_token, tokenType: data.token_type });
                        return;
                    }

                    // Handle errors
                    if (data.error === 'authorization_pending') {
                        // User hasn't authorized yet, keep polling
                        this._pollingTimeout = setTimeout(poll, interval * 1000);
                        return;
                    }

                    if (data.error === 'slow_down') {
                        // GitHub wants us to slow down
                        const newInterval = interval + 5;
                        this._pollingTimeout = setTimeout(poll, newInterval * 1000);
                        return;
                    }

                    if (data.error === 'expired_token') {
                        this._stopPolling();
                        resolve({ success: false, error: 'The device code has expired. Please try again.' });
                        return;
                    }

                    if (data.error === 'access_denied') {
                        this._stopPolling();
                        resolve({ success: false, error: 'Authorization was denied by the user.' });
                        return;
                    }

                    // Unknown error
                    this._stopPolling();
                    resolve({ success: false, error: data.error_description || data.error || 'Unknown error.' });

                } catch (err) {
                    // Network error, keep trying
                    this._pollingTimeout = setTimeout(poll, interval * 1000);
                }
            };

            // Start polling
            this._pollingInterval = poll;
            poll();
        });
    },

    /**
     * Stop any active polling.
     */
    _stopPolling() {
        if (this._pollingTimeout) {
            clearTimeout(this._pollingTimeout);
            this._pollingTimeout = null;
        }
        this._pollingInterval = null;
    },

    /**
     * Cancel device flow (user clicked cancel).
     */
    cancel() {
        this._stopPolling();
    },

    /**
     * Get user info using an access token.
     * GET https://api.github.com/user
     */
    async getUserInfo(token) {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch user info: ${response.status}`);
            }

            const data = await response.json();
            return {
                login: data.login,
                id: data.id,
                avatar_url: data.avatar_url,
                name: data.name || data.login,
                bio: data.bio || '',
                public_repos: data.public_repos || 0,
            };
        } catch (err) {
            throw new Error(err.message);
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    //  AUTH UI — Shows BOTH Device Flow & PAT as tabs
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Render the full auth UI with BOTH Device Flow and PAT tabs.
     * @param {HTMLElement} containerEl - DOM element to render into
     * @param {function} onSuccess - Callback(user) on successful auth
     */
    renderAuthUI(containerEl, onSuccess) {
        if (!containerEl) return;
        this._onSuccessCallback = onSuccess;
        this.init(); // Load saved client_id

        const hasClientId = this.isAvailable();

        containerEl.innerHTML = `
            <div class="device-flow-ui">
                <div class="device-flow-header">
                    <span class="device-flow-icon">🔐</span>
                    <h3>Connect with GitHub</h3>
                    <p class="device-flow-subtitle">
                        Choose how you want to connect your GitHub account.
                    </p>
                </div>

                <!-- Auth Method Tabs -->
                <div class="auth-method-tabs">
                    <button class="auth-tab ${this._activeAuthTab === 'device-flow' ? 'active' : ''}" 
                            id="auth-tab-device-flow" data-tab="device-flow">
                        📱 Device Flow
                    </button>
                    <button class="auth-tab ${this._activeAuthTab === 'pat' ? 'active' : ''}" 
                            id="auth-tab-pat" data-tab="pat">
                        🔑 Access Token
                    </button>
                </div>

                <!-- Device Flow Panel -->
                <div class="auth-panel ${this._activeAuthTab === 'device-flow' ? 'active' : ''}" 
                     id="auth-panel-device-flow">
                    ${hasClientId ? this._renderDeviceFlowReady() : this._renderDeviceFlowSetup()}
                </div>

                <!-- PAT Panel -->
                <div class="auth-panel ${this._activeAuthTab === 'pat' ? 'active' : ''}" 
                     id="auth-panel-pat">
                    ${this._renderPATForm()}
                </div>
            </div>
        `;

        // Bind tab switching
        containerEl.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this._activeAuthTab = tabName;
                // Update active states
                containerEl.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                containerEl.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
                containerEl.querySelector(`#auth-panel-${tabName}`).classList.add('active');
            });
        });

        // Bind Device Flow events
        if (hasClientId) {
            this._bindDeviceFlowEvents(containerEl);
        } else {
            this._bindSetupEvents(containerEl);
        }

        // Bind PAT events
        this._bindPATEvents(containerEl);
    },

    // ── Device Flow: Ready (client_id configured) ──

    _renderDeviceFlowReady() {
        return `
            <div id="bv-df-container">
                <p class="auth-method-desc">
                    Click the button below, then enter the code on GitHub to authorize BlockVerse.
                    No need to copy or paste any tokens!
                </p>
                <div id="bv-df-step1" class="device-flow-step">
                    <button id="bv-df-start" class="btn btn-primary btn-full">
                        📱 Get Authorization Code
                    </button>
                </div>
                <div id="bv-df-step2" class="device-flow-step" style="display:none;">
                    <div class="device-code-display">
                        <span class="device-code-label">Your code:</span>
                        <span id="bv-df-user-code" class="user-code">------</span>
                        <button id="bv-df-copy" class="btn btn-sm btn-secondary" title="Copy code">📋 Copy</button>
                    </div>
                    <p class="device-flow-link">
                        Go to <a id="bv-df-link" href="https://github.com/login/device" target="_blank" rel="noopener">github.com/login/device</a> 
                        and enter the code above.
                    </p>
                    <div class="device-flow-polling">
                        <div class="auth-spinner"></div>
                        <p id="bv-df-poll-status">Waiting for authorization...</p>
                    </div>
                    <button id="bv-df-cancel" class="btn btn-ghost btn-sm">Cancel</button>
                </div>
                <div id="bv-df-success" class="device-flow-step" style="display:none;">
                    <div class="auth-success">
                        <span class="auth-success-icon">✅</span>
                        <p>Connected successfully!</p>
                    </div>
                </div>
            </div>
        `;
    },

    _bindDeviceFlowEvents(containerEl) {
        const startBtn = document.getElementById('bv-df-start');
        if (!startBtn) return;

        startBtn.addEventListener('click', async () => {
            const step1 = document.getElementById('bv-df-step1');
            const step2 = document.getElementById('bv-df-step2');

            step1.innerHTML = '<div class="auth-spinner"></div> Requesting code...';

            const result = await this.requestDeviceCode();
            if (!result.success) {
                step1.innerHTML = `
                    <p style="color: var(--danger);">${this._escapeHtml(result.error)}</p>
                    <button class="btn btn-primary btn-sm" id="bv-df-retry">Try Again</button>
                `;
                document.getElementById('bv-df-retry').addEventListener('click', () => {
                    step1.innerHTML = '<button id="bv-df-start" class="btn btn-primary btn-full">📱 Get Authorization Code</button>';
                    this._bindDeviceFlowEvents(containerEl);
                });
                return;
            }

            // Show step 2
            step1.style.display = 'none';
            step2.style.display = 'block';

            document.getElementById('bv-df-user-code').textContent = result.userCode;
            document.getElementById('bv-df-link').href = result.verificationUri;

            // Copy button
            document.getElementById('bv-df-copy').addEventListener('click', () => {
                navigator.clipboard.writeText(result.userCode).then(() => {
                    document.getElementById('bv-df-copy').textContent = '✅ Copied!';
                    setTimeout(() => {
                        document.getElementById('bv-df-copy').textContent = '📋 Copy';
                    }, 2000);
                });
            });

            // Start polling
            const onPoll = (count) => {
                const dots = '.'.repeat(count % 4);
                const statusEl = document.getElementById('bv-df-poll-status');
                if (statusEl) statusEl.textContent = `Waiting for authorization${dots}`;
            };

            const tokenResult = await this.pollForToken(result.deviceCode, onPoll, result.interval);

            if (tokenResult.success) {
                // Get user info and initialize
                const userInfo = await this.getUserInfo(tokenResult.accessToken);
                CommunityHub.init(tokenResult.accessToken, userInfo.login);

                step2.style.display = 'none';
                const successEl = document.getElementById('bv-df-success');
                if (successEl) {
                    successEl.style.display = 'block';
                    successEl.innerHTML = `
                        <div class="auth-success">
                            <span class="auth-success-icon">✅</span>
                            <p>Connected as <strong>@${this._escapeHtml(userInfo.login)}</strong></p>
                        </div>
                    `;
                }

                if (this._onSuccessCallback) {
                    setTimeout(() => this._onSuccessCallback(userInfo), 500);
                }
            } else {
                step2.innerHTML = `
                    <p style="color: var(--danger);">${this._escapeHtml(tokenResult.error)}</p>
                    <button class="btn btn-primary btn-sm" id="bv-df-retry2">Try Again</button>
                `;
                document.getElementById('bv-df-retry2').addEventListener('click', () => {
                    step2.style.display = 'none';
                    step1.style.display = 'block';
                    step1.innerHTML = '<button id="bv-df-start" class="btn btn-primary btn-full">📱 Get Authorization Code</button>';
                    this._bindDeviceFlowEvents(containerEl);
                });
            }
        });

        // Cancel button
        const cancelBtn = document.getElementById('bv-df-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.cancel();
                const step1 = document.getElementById('bv-df-step1');
                const step2 = document.getElementById('bv-df-step2');
                step2.style.display = 'none';
                step1.style.display = 'block';
                step1.innerHTML = '<button id="bv-df-start" class="btn btn-primary btn-full">📱 Get Authorization Code</button>';
                this._bindDeviceFlowEvents(containerEl);
            });
        }
    },

    // ── Device Flow: Setup (no client_id) ──

    _renderDeviceFlowSetup() {
        return `
            <div class="device-flow-setup">
                <div class="setup-notice">
                    <span class="setup-notice-icon">⚙️</span>
                    <p><strong>One-time setup required.</strong></p>
                    <p>Device Flow needs an OAuth App client_id. Create one on GitHub (takes 30 seconds), then paste the client_id below.</p>
                </div>

                <div class="setup-steps">
                    <h4>Quick Setup (one time only):</h4>
                    <ol>
                        <li>Go to <a href="https://github.com/settings/applications/new" target="_blank" rel="noopener"><strong>github.com/settings/applications/new</strong></a></li>
                        <li><strong>Application name:</strong> <code>BlockVerse Community</code></li>
                        <li><strong>Homepage URL:</strong> <code>https://thestrongestoftomorrow.github.io/blockverse-game/</code></li>
                        <li><strong>Authorization callback URL:</strong> <code>https://thestrongestoftomorrow.github.io/blockverse-game/</code></li>
                        <li>Click <strong>"Register application"</strong></li>
                        <li>Copy the <strong>Client ID</strong> from the top of the page</li>
                    </ol>
                </div>

                <div class="form-group">
                    <label for="bv-client-id-input">OAuth App Client ID</label>
                    <input type="text" id="bv-client-id-input" 
                           placeholder="e.g. Ov23liAbCdEf..." 
                           value="${this._clientId || ''}"
                           autocomplete="off" spellcheck="false">
                    <small class="form-hint">Paste your OAuth App Client ID here. It's saved in your browser for next time.</small>
                </div>

                <button id="bv-save-client-id" class="btn btn-primary btn-full">
                    💾 Save & Enable Device Flow
                </button>
                <div id="bv-client-id-error" class="form-error" style="display:none;"></div>

                <div class="setup-alternative">
                    <p>Don't want to set this up? Use the <strong>Access Token</strong> tab instead — it works immediately!</p>
                </div>
            </div>
        `;
    },

    _bindSetupEvents(containerEl) {
        const saveBtn = document.getElementById('bv-save-client-id');
        if (!saveBtn) return;

        saveBtn.addEventListener('click', () => {
            const input = document.getElementById('bv-client-id-input');
            const errorEl = document.getElementById('bv-client-id-error');
            const clientId = input.value.trim();

            if (!clientId) {
                errorEl.textContent = 'Please enter a Client ID.';
                errorEl.style.display = 'block';
                return;
            }

            if (clientId.length < 5) {
                errorEl.textContent = 'Client ID seems too short. Please check and try again.';
                errorEl.style.display = 'block';
                return;
            }

            errorEl.style.display = 'none';
            this.setClientId(clientId);

            // Re-render the Device Flow panel with the ready state
            const panel = document.getElementById('auth-panel-device-flow');
            if (panel) {
                panel.innerHTML = this._renderDeviceFlowReady();
                this._bindDeviceFlowEvents(panel);
            }
        });
    },

    // ── PAT Form ──

    _renderPATForm() {
        return `
            <div class="device-flow-pat-section">
                <p class="auth-method-desc">
                    Paste a GitHub Personal Access Token to connect. Works immediately — no setup needed.
                </p>
                <div class="device-flow-instructions">
                    <h4>How to get a token:</h4>
                    <ol>
                        <li>Go to <a href="https://github.com/settings/tokens" target="_blank" rel="noopener">github.com/settings/tokens</a></li>
                        <li>Click <strong>"Generate new token (classic)"</strong></li>
                        <li>Name it <strong>"BlockVerse Community"</strong></li>
                        <li>Check the <strong>"public_repo"</strong> scope</li>
                        <li>Click <strong>"Generate token"</strong> & copy it</li>
                    </ol>
                </div>
                <div class="device-flow-pat-form">
                    <div class="form-group">
                        <label for="bv-pat-input">Personal Access Token</label>
                        <input type="password" id="bv-pat-input" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" autocomplete="off">
                    </div>
                    <button id="bv-auth-submit" class="btn btn-primary btn-full">🔑 Connect with Token</button>
                    <div id="bv-auth-error" class="form-error" style="display:none;"></div>
                    <div id="bv-auth-loading" class="auth-loading" style="display:none;">
                        <div class="auth-spinner"></div> Verifying token...
                    </div>
                </div>
            </div>
        `;
    },

    _bindPATEvents(containerEl) {
        const submitBtn = document.getElementById('bv-auth-submit');
        if (!submitBtn) return;

        const handleSubmit = async () => {
            const tokenInput = document.getElementById('bv-pat-input');
            const errorEl = document.getElementById('bv-auth-error');
            const loadingEl = document.getElementById('bv-auth-loading');
            const token = tokenInput.value.trim();

            if (!token) {
                errorEl.textContent = 'Please enter your token.';
                errorEl.style.display = 'block';
                return;
            }

            errorEl.style.display = 'none';
            loadingEl.style.display = 'flex';
            submitBtn.disabled = true;

            const result = await CommunityHub.authWithPAT(token);
            loadingEl.style.display = 'none';
            submitBtn.disabled = false;

            if (result.success) {
                if (this._onSuccessCallback) this._onSuccessCallback(result.user);
            } else {
                errorEl.textContent = result.error;
                errorEl.style.display = 'block';
            }
        };

        submitBtn.addEventListener('click', handleSubmit);

        // Enter key to submit
        const patInput = document.getElementById('bv-pat-input');
        if (patInput) {
            patInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleSubmit();
            });
        }
    },

    // ── Helpers ──

    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};
