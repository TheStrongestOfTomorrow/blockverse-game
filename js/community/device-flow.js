/**
 * BlockVerse Community Hub - GitHub Device Flow Authentication
 * 
 * GitHub Device Flow provides a way to authenticate users without
 * requiring them to manually handle tokens. However, it requires a
 * registered OAuth App with a client_id.
 * 
 * Since we cannot register an OAuth App in this environment,
 * this module provides:
 *   1. A complete Device Flow implementation (ready for a client_id)
 *   2. A PAT (Personal Access Token) fallback that is fully functional
 *   3. A user-friendly UI for the PAT flow
 */

const DeviceFlow = {
    // ── GitHub OAuth settings ──
    // NOTE: To use device flow, register an OAuth App at:
    // https://github.com/settings/applications/new
    // Set the callback URL and get a client_id.
    _clientId: null, // Set this if you have a registered OAuth App
    _apiBase: 'https://github.com',
    _pollingInterval: null,
    _pollingTimeout: null,

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
                type: 'no-client',
                message: 'Device flow requires a registered OAuth App client_id. Using PAT fallback.',
                instructions: [
                    '1. Go to https://github.com/settings/tokens',
                    '2. Click "Generate new token (classic)"',
                    '3. Name it "BlockVerse Community"',
                    '4. Check the "public_repo" scope',
                    '5. Click "Generate token" & copy the token',
                    '6. Paste it in the token input below',
                ],
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
     * Step 3: Get user info using an access token.
     * GET https://api.github.com/user
     * 
     * @param {string} token - The access_token from step 2
     * @returns {Promise<{login, id, avatar_url, name}>}
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

    /**
     * Render the device flow UI inside a container.
     * If device flow is not available, renders PAT instructions instead.
     */
    renderAuthUI(containerEl, onSuccess) {
        if (!containerEl) return;

        if (!this.isAvailable()) {
            // PAT fallback UI
            containerEl.innerHTML = `
                <div class="device-flow-ui">
                    <div class="device-flow-header">
                        <span class="device-flow-icon">🔑</span>
                        <h3>Connect with GitHub</h3>
                        <p class="device-flow-subtitle">
                            Use a Personal Access Token to publish and rate community content.
                        </p>
                    </div>
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
                        <button id="bv-auth-submit" class="btn btn-primary btn-full">Connect</button>
                        <div id="bv-auth-error" class="form-error" style="display:none;"></div>
                        <div id="bv-auth-loading" class="auth-loading" style="display:none;">
                            <div class="auth-spinner"></div> Verifying token...
                        </div>
                    </div>
                </div>
            `;

            // Bind events
            document.getElementById('bv-auth-submit').addEventListener('click', async () => {
                const tokenInput = document.getElementById('bv-pat-input');
                const errorEl = document.getElementById('bv-auth-error');
                const loadingEl = document.getElementById('bv-auth-loading');
                const submitBtn = document.getElementById('bv-auth-submit');
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
                    if (onSuccess) onSuccess(result.user);
                } else {
                    errorEl.textContent = result.error;
                    errorEl.style.display = 'block';
                }
            });

            // Enter key to submit
            document.getElementById('bv-pat-input').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') document.getElementById('bv-auth-submit').click();
            });
        } else {
            // Full device flow UI
            this._renderDeviceFlowUI(containerEl, onSuccess);
        }
    },

    /**
     * Render the full device flow UI (when client_id is available).
     */
    _renderDeviceFlowUI(containerEl, onSuccess) {
        containerEl.innerHTML = `
            <div class="device-flow-ui" id="bv-df-container">
                <div class="device-flow-header">
                    <span class="device-flow-icon">🔐</span>
                    <h3>Connect with GitHub</h3>
                    <p class="device-flow-subtitle">Enter the code below at GitHub to authorize BlockVerse.</p>
                </div>
                <div id="bv-df-step1" class="device-flow-step">
                    <button id="bv-df-start" class="btn btn-primary btn-full">Get Authorization Code</button>
                </div>
                <div id="bv-df-step2" class="device-flow-step" style="display:none;">
                    <div class="device-code-display">
                        <span id="bv-df-user-code" class="user-code">------</span>
                        <button id="bv-df-copy" class="btn btn-sm btn-secondary" title="Copy code">📋 Copy</button>
                    </div>
                    <p class="device-flow-link">
                        Go to <a id="bv-df-link" href="#" target="_blank" rel="noopener">github.com/login/device</a> and enter the code above.
                    </p>
                    <div class="device-flow-polling">
                        <div class="auth-spinner"></div>
                        <p id="bv-df-poll-status">Waiting for authorization...</p>
                    </div>
                    <button id="bv-df-cancel" class="btn btn-ghost btn-sm">Cancel</button>
                </div>
            </div>
        `;

        // Bind events
        document.getElementById('bv-df-start').addEventListener('click', async () => {
            const step1 = document.getElementById('bv-df-step1');
            const step2 = document.getElementById('bv-df-step2');

            step1.innerHTML = '<div class="auth-spinner"></div> Requesting code...';

            const result = await this.requestDeviceCode();
            if (!result.success) {
                step1.innerHTML = `<p style="color: var(--danger);">${result.error || result.message}</p>`;
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
            const onPoll = (count, max) => {
                const dots = '.'.repeat(count % 4);
                document.getElementById('bv-df-poll-status').textContent = `Waiting for authorization${dots}`;
            };

            const tokenResult = await this.pollForToken(result.deviceCode, onPoll, result.interval);

            if (tokenResult.success) {
                // Get user info
                const userInfo = await this.getUserInfo(tokenResult.accessToken);
                CommunityHub.init(tokenResult.accessToken, userInfo.login);
                if (onSuccess) onSuccess(userInfo);
            } else {
                step2.innerHTML = `<p style="color: var(--danger);">${tokenResult.error}</p>
                    <button class="btn btn-primary btn-sm" onclick="DeviceFlow.renderAuthUI(document.getElementById('bv-df-container'))">Try Again</button>`;
            }
        });

        // Cancel button
        document.getElementById('bv-df-cancel').addEventListener('click', () => {
            this.cancel();
            document.getElementById('bv-df-step1').style.display = 'block';
            document.getElementById('bv-df-step2').style.display = 'none';
            document.getElementById('bv-df-step1').innerHTML = '<button id="bv-df-start" class="btn btn-primary btn-full">Get Authorization Code</button>';
            // Re-bind
            document.getElementById('bv-df-start').addEventListener('click', async () => {
                location.reload(); // Simplest approach
            });
        });
    },
};
