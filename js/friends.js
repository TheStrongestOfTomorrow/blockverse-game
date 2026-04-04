// ============================================
// BLOCKVERSE - Friends Module
// ============================================
// Manages the friends list, pending friend requests, online-status
// checks, and game invites.  Uses localStorage for persistence and
// PeerJS for real-time communication between identity peers.
// ============================================

const Friends = (() => {
    'use strict';

    // ---- Persistent data structures ----
    // friendsList      : string[]  (accepted usernames)
    // pendingReceived  : string[]  (requests I've received)
    // pendingSent      : string[]  (requests I've sent)
    let friendsList = [];
    let pendingReceived = [];
    let pendingSent = [];

    // ---- Online-status cache ----
    // Map<username, { online: bool, gameInfo?: object }>
    let friendStatuses = new Map();

    // ---- PeerJS identity peer (always alive while logged in) ----
    let identityPeer = null;

    // ---- Temporary connections used for status probing / messaging ----
    // Map<peerId, DataConnection>  (NOT game connections)
    let probeConnections = new Map();

    // ========================================
    //  Public API
    // ========================================

    /**
     * Initialize the friends module.
     * - Load persisted friends & requests from localStorage.
     * - Wire up UI event handlers.
     * - Start the identity PeerJS peer for incoming friend events.
     */
    function init() {
        _loadFromStorage();
        _setupUIHandlers();
        _startIdentityPeer();
        renderUI();
    }

    /** @returns {string[]} Current accepted friend usernames. */
    function getFriends() {
        return [...friendsList];
    }

    /** @returns {string[]} Current pending request usernames (received). */
    function getRequests() {
        return [...pendingReceived];
    }

    /**
     * Send a friend request to another user.
     * @param {string} username
     * @returns {{success: boolean, error?: string}}
     */
    function addFriend(username) {
        if (!Auth.isLoggedIn()) return { success: false, error: 'Not logged in' };

        const me = Auth.getCurrentUser();

        // Can't add yourself
        if (username === me) return { success: false, error: "You can't add yourself" };

        // Already friends?
        if (friendsList.includes(username)) return { success: false, error: 'Already friends' };

        // Already pending?
        if (pendingSent.includes(username)) return { success: false, error: 'Request already sent' };

        // Does user exist?
        if (!localStorage.getItem(`bv_user_${username}`)) {
            return { success: false, error: 'User not found' };
        }

        // Try to reach their identity peer and send the request
        const targetPeerId = `BV-Peer-${username}`;
        try {
            const conn = new Peer(me, {
                host: BV.PEERJS_HOST,
                port: BV.PEERJS_PORT,
                secure: BV.PEERJS_SECURE,
            });
            // We actually use the identity peer to connect
        } catch (err) {
            // Non-critical – we still store the pending request
        }

        // Connect via identity peer
        _connectToIdentity(username, (conn) => {
            if (conn && conn.open) {
                conn.send({
                    type: BV.MSG.FRIEND_REQUEST,
                    payload: { from: me, username: me },
                });
                // Close probe after sending
                setTimeout(() => conn.close(), 2000);
            }
        });

        // Persist
        pendingSent.push(username);
        _saveToStorage();

        Utils.showToast(`Friend request sent to ${username}`, 'success');
        return { success: true };
    }

    /**
     * Accept an incoming friend request.
     * @param {string} username
     */
    function acceptRequest(username) {
        if (!pendingReceived.includes(username)) return;

        // Add to friends
        friendsList.push(username);
        pendingReceived = pendingReceived.filter((u) => u !== username);
        pendingSent = pendingSent.filter((u) => u !== username);
        _saveToStorage();

        // Notify the requester via PeerJS
        _connectToIdentity(username, (conn) => {
            if (conn && conn.open) {
                conn.send({
                    type: BV.MSG.FRIEND_ACCEPT,
                    payload: { from: Auth.getCurrentUser() },
                });
                setTimeout(() => conn.close(), 2000);
            }
        });

        renderUI();
        Utils.showToast(`You are now friends with ${username}!`, 'success');
    }

    /**
     * Decline an incoming friend request.
     * @param {string} username
     */
    function declineRequest(username) {
        pendingReceived = pendingReceived.filter((u) => u !== username);
        _saveToStorage();

        // Optionally notify
        _connectToIdentity(username, (conn) => {
            if (conn && conn.open) {
                conn.send({
                    type: BV.MSG.FRIEND_DECLINE,
                    payload: { from: Auth.getCurrentUser() },
                });
                setTimeout(() => conn.close(), 1000);
            }
        });

        renderUI();
    }

    /**
     * Remove an existing friend.
     * @param {string} username
     */
    function removeFriend(username) {
        friendsList = friendsList.filter((u) => u !== username);
        friendStatuses.delete(username);
        _saveToStorage();

        // Notify the other user
        _connectToIdentity(username, (conn) => {
            if (conn && conn.open) {
                conn.send({
                    type: BV.MSG.FRIEND_REMOVE,
                    payload: { from: Auth.getCurrentUser() },
                });
                setTimeout(() => conn.close(), 1000);
            }
        });

        renderUI();
        Utils.showToast(`Removed ${username} from friends`, 'info');
    }

    /**
     * Check online status for every friend via PeerJS identity peers.
     * Applies a cooldown to prevent hammering.
     */
    function refreshFriendStatuses() {
        if (!Auth.isLoggedIn()) return;

        // Reset all statuses to unknown first
        friendsList.forEach((f) => friendStatuses.set(f, { online: false, gameInfo: null }));

        if (friendsList.length === 0) {
            renderUI();
            return;
        }

        let checked = 0;
        const total = friendsList.length;

        friendsList.forEach((friend) => {
            const targetPeerId = `BV-Peer-${friend}`;

            // Attempt connection with a 3-second timeout
            const conn = identityPeer.connect(targetPeerId, { reliable: true });

            const timeout = setTimeout(() => {
                conn.close();
                friendStatuses.set(friend, { online: false, gameInfo: null });
                checked++;
                if (checked === total) {
                    renderUI();
                    _startRefreshCooldown();
                }
            }, 3000);

            conn.on('open', () => {
                clearTimeout(timeout);
                // Ask for identity info
                conn.send({ type: BV.MSG.IDENTITY_PING, payload: {} });

                conn.on('data', (data) => {
                    if (data && data.type === BV.MSG.IDENTITY_PONG) {
                        const info = data.payload || {};
                        friendStatuses.set(friend, {
                            online: true,
                            gameInfo: info.gameInfo || null,
                        });
                    }
                    conn.close();
                });

                // Safety timeout after pong
                setTimeout(() => {
                    conn.close();
                    checked++;
                    if (checked === total) {
                        renderUI();
                        _startRefreshCooldown();
                    }
                }, 2000);
            });

            conn.on('error', () => {
                clearTimeout(timeout);
                friendStatuses.set(friend, { online: false, gameInfo: null });
                checked++;
                if (checked === total) {
                    renderUI();
                    _startRefreshCooldown();
                }
            });
        });
    }

    /**
     * Handle an incoming friend request (called from identity peer message handler).
     * @param {string} from  Username of the requester.
     */
    function handleIncomingRequest(from) {
        if (pendingReceived.includes(from)) return; // Already pending
        if (friendsList.includes(from)) return;     // Already friends

        pendingReceived.push(from);
        _saveToStorage();
        renderUI();

        Utils.showToast(`Friend request from ${from}`, 'info', 5000);
    }

    /**
     * Handle a friend-accept message.
     * @param {string} from  Username who accepted.
     */
    function handleAccept(from) {
        if (!friendsList.includes(from)) {
            friendsList.push(from);
        }
        pendingSent = pendingSent.filter((u) => u !== from);
        _saveToStorage();

        Utils.showToast(`You are now friends with ${from}!`, 'success', 4000);
        renderUI();
    }

    /**
     * Send a game invite to a friend.
     * @param {string} username
     * @param {string} gameCode
     */
    function sendInvite(username, gameCode) {
        const me = Auth.getCurrentUser();
        _connectToIdentity(username, (conn) => {
            if (conn && conn.open) {
                conn.send({
                    type: BV.MSG.FRIEND_INVITE,
                    payload: { from: me, gameCode },
                });
                setTimeout(() => conn.close(), 2000);
            }
        });
        Utils.showToast(`Invite sent to ${username}!`, 'success');
    }

    /**
     * Handle an incoming game invite.
     * @param {string} from
     * @param {string} gameCode
     */
    function handleInvite(from, gameCode) {
        const modal = document.getElementById('invite-modal');
        if (!modal) return;

        const inviterEl = modal.querySelector('.invite-from');
        const codeEl = modal.querySelector('.invite-code');
        if (inviterEl) inviterEl.textContent = from;
        if (codeEl) codeEl.textContent = gameCode;

        modal.classList.remove('hidden');

        // Wire accept / decline buttons (remove old listeners first)
        const acceptBtn = modal.querySelector('.invite-accept');
        const declineBtn = modal.querySelector('.invite-decline');

        const newAccept = acceptBtn.cloneNode(true);
        acceptBtn.parentNode.replaceChild(newAccept, acceptBtn);
        newAccept.addEventListener('click', () => {
            modal.classList.add('hidden');
            if (typeof Lobby !== 'undefined') {
                Lobby.joinGameByCode(gameCode);
            }
        });

        const newDecline = declineBtn.cloneNode(true);
        declineBtn.parentNode.replaceChild(newDecline, declineBtn);
        newDecline.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    /**
     * Render the full friends panel UI into #friends-list.
     */
    function renderUI() {
        const container = document.getElementById('friends-list');
        if (!container) return;
        container.innerHTML = '';

        // ---- Friends section ----
        if (friendsList.length === 0 && pendingReceived.length === 0) {
            container.innerHTML = `
                <div class="friends-empty">
                    <p>No friends yet!</p>
                    <p class="text-secondary">Use the add friend button to get started.</p>
                </div>`;
            return;
        }

        // Pending requests section
        if (pendingReceived.length > 0) {
            const section = document.createElement('div');
            section.className = 'friends-section';
            section.innerHTML = `<h4 class="section-title">Pending Requests (${pendingReceived.length})</h4>`;

            pendingReceived.forEach((username) => {
                const item = document.createElement('div');
                item.className = 'friend-item friend-pending';
                item.innerHTML = `
                    ${Avatar.getAvatarHTML(username, 'small')}
                    <div class="friend-info">
                        <span class="friend-name">${username}</span>
                        <span class="friend-status-text">Wants to be friends</span>
                    </div>
                    <div class="friend-actions">
                        <button class="btn btn-sm btn-success accept-friend-btn" data-username="${username}">Accept</button>
                        <button class="btn btn-sm btn-danger decline-friend-btn" data-username="${username}">Decline</button>
                    </div>`;
                section.appendChild(item);
            });

            container.appendChild(section);
        }

        // Accepted friends
        if (friendsList.length > 0) {
            const section = document.createElement('div');
            section.className = 'friends-section';
            section.innerHTML = `<h4 class="section-title">Friends (${friendsList.length})</h4>`;

            // Sort: online first
            const sorted = [...friendsList].sort((a, b) => {
                const aOnline = friendStatuses.get(a)?.online ? 1 : 0;
                const bOnline = friendStatuses.get(b)?.online ? 1 : 0;
                return bOnline - aOnline;
            });

            sorted.forEach((username) => {
                const status = friendStatuses.get(username) || { online: false, gameInfo: null };
                const item = document.createElement('div');
                item.className = 'friend-item';

                const statusDot = status.online ? 'status-online' : 'status-offline';
                let statusText = 'Offline';
                let actionHTML = '';

                if (status.online && status.gameInfo) {
                    statusText = `Playing: ${status.gameInfo.name || 'a game'}`;
                    actionHTML = `<button class="btn btn-sm btn-primary join-game-btn" data-code="${status.gameInfo.code || ''}">Join Game</button>`;
                } else if (status.online) {
                    statusText = 'In Lobby';
                    actionHTML = `<button class="btn btn-sm btn-secondary invite-friend-btn" data-username="${username}">Invite</button>`;
                }

                item.innerHTML = `
                    ${Avatar.getAvatarHTML(username, 'small')}
                    <div class="friend-info">
                        <span class="friend-name">${username}</span>
                        <span class="friend-status-text">${statusText}</span>
                    </div>
                    <div class="friend-meta">
                        <span class="status-dot ${statusDot}"></span>
                    </div>
                    <div class="friend-actions">
                        ${actionHTML}
                        <button class="btn btn-sm btn-ghost remove-friend-btn" data-username="${username}" title="Remove friend">✕</button>
                    </div>`;

                section.appendChild(item);
            });

            container.appendChild(section);
        }
    }

    // ========================================
    //  Identity Peer
    // ========================================

    /**
     * Create the PeerJS identity peer for the current user.
     * This peer stays alive for the entire session and handles
     * incoming friend requests, accepts, pings, and invites.
     */
    function _startIdentityPeer() {
        if (!Auth.isLoggedIn()) return;

        const username = Auth.getCurrentUser();
        const peerId = `BV-Peer-${username}`;

        if (identityPeer && !identityPeer.destroyed) {
            identityPeer.destroy();
        }

        identityPeer = new Peer(peerId, {
            host: BV.PEERJS_HOST,
            port: BV.PEERJS_PORT,
            secure: BV.PEERJS_SECURE,
        });

        identityPeer.on('open', (id) => {
            console.log(`[Friends] Identity peer open: ${id}`);
        });

        identityPeer.on('connection', (conn) => {
            conn.on('open', () => {
                // We expect at most one message per probe connection
            });
            conn.on('data', (data) => {
                if (!data || !data.type) return;

                switch (data.type) {
                    case BV.MSG.FRIEND_REQUEST:
                        handleIncomingRequest(data.payload.from || data.payload.username);
                        break;

                    case BV.MSG.FRIEND_ACCEPT:
                        handleAccept(data.payload.from);
                        break;

                    case BV.MSG.FRIEND_DECLINE:
                        pendingSent = pendingSent.filter((u) => u !== data.payload.from);
                        _saveToStorage();
                        renderUI();
                        Utils.showToast(`${data.payload.from} declined your friend request`, 'info');
                        break;

                    case BV.MSG.FRIEND_REMOVE:
                        friendsList = friendsList.filter((u) => u !== data.payload.from);
                        friendStatuses.delete(data.payload.from);
                        _saveToStorage();
                        renderUI();
                        Utils.showToast(`${data.payload.from} removed you from friends`, 'info');
                        break;

                    case BV.MSG.FRIEND_INVITE:
                        handleInvite(data.payload.from, data.payload.gameCode);
                        break;

                    case BV.MSG.IDENTITY_PING:
                        // Respond with current status
                        const gameInfo = (typeof Multiplayer !== 'undefined' && Multiplayer.serverId)
                            ? { name: 'BlockVerse Game', code: Multiplayer.serverId }
                            : null;
                        conn.send({
                            type: BV.MSG.IDENTITY_PONG,
                            payload: {
                                username,
                                online: true,
                                gameInfo,
                            },
                        });
                        setTimeout(() => conn.close(), 1000);
                        break;
                }
            });
        });

        identityPeer.on('error', (err) => {
            // Peer ID may already be taken (e.g., another tab)
            if (err.type === 'unavailable-id') {
                console.warn(`[Friends] Identity peer ID ${peerId} unavailable`);
            } else {
                console.warn('[Friends] Identity peer error:', err);
            }
        });

        // Expose for reference
        Friends.identityPeer = identityPeer;
    }

    /**
     * Connect to another user's identity peer.
     * @param {string} username
     * @param {function} onOpen  Called with the DataConnection once open.
     */
    function _connectToIdentity(username, onOpen) {
        if (!identityPeer || identityPeer.destroyed) return;
        const targetPeerId = `BV-Peer-${username}`;
        const conn = identityPeer.connect(targetPeerId, { reliable: true });
        conn.on('open', () => onOpen(conn));
        conn.on('error', () => { /* Silently fail */ });
        // Auto-close after 5 seconds safety
        setTimeout(() => { if (!conn.destroyed) conn.close(); }, 5000);
    }

    // ========================================
    //  UI Handlers
    // ========================================

    function _setupUIHandlers() {
        // Add friend form
        const addInput = document.getElementById('add-friend-input');
        const addBtn = document.getElementById('add-friend-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const username = addInput.value.trim();
                if (!username) return;
                const result = addFriend(username);
                if (result.success) {
                    addInput.value = '';
                } else {
                    Utils.showToast(result.error, 'error');
                }
            });
        }
        if (addInput) {
            addInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') addBtn && addBtn.click();
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('refresh-friends-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (typeof UI !== 'undefined') {
                    UI.startCooldown('refresh-friends-btn', BV.REFRESH_COOLDOWN, () => {
                        refreshFriendStatuses();
                    });
                } else {
                    refreshFriendStatuses();
                }
            });
        }

        // Event delegation for friend list actions
        const container = document.getElementById('friends-list');
        if (container) {
            container.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                const username = btn.dataset.username;
                const code = btn.dataset.code;

                if (btn.classList.contains('accept-friend-btn') && username) {
                    acceptRequest(username);
                } else if (btn.classList.contains('decline-friend-btn') && username) {
                    declineRequest(username);
                } else if (btn.classList.contains('remove-friend-btn') && username) {
                    removeFriend(username);
                } else if (btn.classList.contains('invite-friend-btn') && username) {
                    const serverId = (typeof Multiplayer !== 'undefined') ? Multiplayer.serverId : null;
                    if (serverId) {
                        sendInvite(username, serverId);
                    } else {
                        Utils.showToast('You need to be in a game to send invites', 'error');
                    }
                } else if (btn.classList.contains('join-game-btn') && code) {
                    if (typeof Lobby !== 'undefined') {
                        Lobby.joinGameByCode(code);
                    }
                }
            });
        }
    }

    /**
     * Apply a cooldown badge to the refresh button.
     */
    function _startRefreshCooldown() {
        const btn = document.getElementById('refresh-friends-btn');
        if (!btn) return;

        let remaining = BV.REFRESH_COOLDOWN;
        btn.disabled = true;

        const badge = btn.querySelector('.cooldown-badge') || document.createElement('span');
        badge.className = 'cooldown-badge';
        btn.appendChild(badge);

        const interval = setInterval(() => {
            remaining--;
            badge.textContent = remaining + 's';
            if (remaining <= 0) {
                clearInterval(interval);
                btn.disabled = false;
                badge.remove();
            }
        }, 1000);
    }

    // ========================================
    //  Persistence
    // ========================================

    function _loadFromStorage() {
        try {
            const raw = localStorage.getItem(BV.STORAGE_KEYS.FRIENDS);
            friendsList = raw ? JSON.parse(raw) : [];
        } catch { friendsList = []; }

        try {
            const raw = localStorage.getItem(BV.STORAGE_KEYS.FRIEND_REQUESTS);
            const parsed = raw ? JSON.parse(raw) : {};
            pendingReceived = parsed.received || [];
            pendingSent = parsed.sent || [];
        } catch {
            pendingReceived = [];
            pendingSent = [];
        }
    }

    function _saveToStorage() {
        localStorage.setItem(BV.STORAGE_KEYS.FRIENDS, JSON.stringify(friendsList));
        localStorage.setItem(
            BV.STORAGE_KEYS.FRIEND_REQUESTS,
            JSON.stringify({ received: pendingReceived, sent: pendingSent })
        );
    }

    // ========================================
    //  Return the public interface
    // ========================================
    return {
        init,
        getFriends,
        getRequests,
        addFriend,
        acceptRequest,
        declineRequest,
        removeFriend,
        refreshFriendStatuses,
        handleIncomingRequest,
        handleAccept,
        sendInvite,
        handleInvite,
        renderUI,
        identityPeer: null,
    };
})();
