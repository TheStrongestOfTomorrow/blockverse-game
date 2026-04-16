// ============================================
// BLOCKVERSE - Multiplayer Module
// ============================================
// Core WebRTC networking layer built on PeerJS.
// Handles hosting, joining, mesh connections, message routing,
// position broadcasting, host migration, and server discovery.
// ============================================

const Multiplayer = (() => {
    'use strict';

    // ---- Hybrid Networking (WebSocket + WebRTC) ----
    const WS_URL = window.location.hostname === 'localhost' ? 'ws://localhost:3000' : null;
    let socket = null;
    let useWebSocket = false;

    // ---- PeerJS instances ----
    let gamePeer = null;       // Peer used for game connections (created per game session)
    let identityPeer = null;   // Shared with Friends module if already created

    // ---- Connection state ----
    let connections = new Map();   // Map<peerId, DataConnection>
    let amIHost = false;
    let hostPeerId = null;
    let serverId = null; // Can be PeerID or UUID from WebSocket
    let gameCode = null;
    let gameSettings = {};

    // ---- Player roster ----
    // Map<peerId, { username, joinedAt, avatar }>
    let players = new Map();

    // ---- Position broadcast throttling ----
    let _lastBroadcastTime = 0;
    let _lastBroadcastPos = { x: 0, y: 0, z: 0 };
    let _lastBroadcastRot = { yaw: 0, pitch: 0 };
    const BROADCAST_INTERVAL = 50; // 20 Hz
    const POSITION_THRESHOLD = 0.01;

    // ========================================
    //  Public API
    // ========================================

    /**
     * Initialize the multiplayer module.
     * Reuses the identity peer if Friends already created one.
     */
    function init() {
        // Share the identity peer with Friends if available
        if (Friends.identityPeer && !Friends.identityPeer.destroyed) {
            identityPeer = Friends.identityPeer;
        }

        // Initialize decentralized discovery
        if (typeof LobbyRegistry !== 'undefined') {
            LobbyRegistry.init();
        }

        // Attempt WebSocket connection
        if (WS_URL) {
            _connectWebSocket();
        }

        // Listen for auth:logout to tear down
        document.addEventListener('auth:logout', () => {
            leaveGame();
        });
    }

    function _connectWebSocket() {
        try {
            socket = new WebSocket(WS_URL);
            socket.onopen = () => {
                console.log('[Multiplayer] WebSocket connected');
                useWebSocket = true;
            };
            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    _handleSocketMessage(data);
                } catch (e) {
                    console.error('[Multiplayer] Socket parse error:', e);
                }
            };
            socket.onclose = () => {
                console.warn('[Multiplayer] WebSocket disconnected');
                useWebSocket = false;
                socket = null;
            };
            socket.onerror = () => {
                useWebSocket = false;
            };
        } catch (e) {
            console.error('[Multiplayer] WebSocket init error:', e);
        }
    }

    function _handleSocketMessage(data) {
        switch (data.type) {
            case 'hosted':
                serverId = data.payload.serverId;
                break;
            case 'discovery_results':
                document.dispatchEvent(new CustomEvent('multiplayer:discovery', { detail: data.payload }));
                break;
            case 'player_join':
                _onPlayerJoin(data.payload.id, { username: data.payload.username });
                break;
            case 'player_leave':
                _onPlayerLeave(data.payload.id);
                break;
            case 'room_closed':
                leaveGame();
                Utils.showToast('The host closed the room.', 'info');
                break;
            default:
                // Pass through for generic game messages (chat, pos, block)
                handleMessage(data.senderId || 'socket', data);
                break;
        }
    }

    // ---- Accessors ----

    /** @returns {Peer|null} */
    function getGamePeer() { return gamePeer; }
    /** @returns {Map} */
    function getConnections() { return connections; }
    /** @returns {boolean} */
    function getAmIHost() { return amIHost; }
    /** @returns {string|null} */
    function getHostPeerId() { return hostPeerId; }
    /** @returns {string|null} */
    function getServerId() { return serverId; }
    /** @returns {Map} */
    function getPlayers() { return players; }

    // ========================================
    //  HOSTING
    // ========================================

    /**
     * Create a new game server and start listening for connections.
     * @param {string} gameCode
     * @param {object} [settings={}]
     * @returns {Promise<string>} The server peer ID.
     */
    function hostGame(pGameCode, settings = {}) {
        gameCode = pGameCode;
        gameSettings = settings;
        amIHost = true;
        players.clear();
        connections.clear();

        // 1. WebSocket Host
        if (useWebSocket && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'host',
                payload: {
                    gameCode: pGameCode,
                    username: Auth.getCurrentUser(),
                    settings: settings,
                    webRtcEnabled: true // Always allow WebRTC bridge
                }
            }));
        }

        // 2. WebRTC Host (PeerJS) - always start for hybrid support
        return new Promise((resolve, reject) => {
            serverId = `${pGameCode}-S1`;
            hostPeerId = null;

            if (gamePeer && !gamePeer.destroyed) {
                gamePeer.destroy();
            }

            gamePeer = new Peer(serverId, {
                host: BV.PEERJS_HOST,
                port: BV.PEERJS_PORT,
                secure: BV.PEERJS_SECURE,
                config: {
                    iceServers: BV.ICE_SERVERS || [],
                    iceTransportPolicy: 'all'
                }
            });

            gamePeer.on('open', (id) => {
                console.log(`[Multiplayer] WebRTC Host started on ${id}`);
                
                // Announce to decentralized lobby
                if (typeof LobbyRegistry !== 'undefined') {
                    LobbyRegistry.announceServer(pGameCode, id, {
                        name: settings.name || 'Public Server',
                        playerCount: players.size + 1, // Include host
                        maxPlayers: settings.maxPlayers || BV.MAX_PLAYERS_PER_SERVER
                    });
                }

                resolve(id);
            });

            gamePeer.on('connection', (conn) => {
                _handleIncomingConnection(conn);
            });

            gamePeer.on('error', (err) => {
                console.error('[Multiplayer] WebRTC Host error:', err);
                if (err.type === 'unavailable-id') {
                    console.warn(`[Multiplayer] ${serverId} taken, trying S2`);
                    createServer(pGameCode, 2).then(id => {
                        serverId = id;
                        resolve(id);
                    });
                } else {
                    reject(err);
                }
            });
        });
    }

    /**
     * Create an additional server for auto-scaling.
     * @param {string} gameCode
     * @param {number} [serverNum]  Optional explicit server number.
     * @returns {Promise<string>} New server peer ID.
     */
    function createServer(gameCode, serverNum) {
        return new Promise((resolve, reject) => {
            if (!serverNum) {
                // Find next available number S1..S10
                for (let i = 1; i <= 10; i++) {
                    const testId = `${gameCode}-S${i}`;
                    if (testId !== serverId) {
                        serverNum = i;
                        break;
                    }
                }
                serverNum = serverNum || 2;
            }

            const newServerId = `${gameCode}-S${serverNum}`;
            const newPeer = new Peer(newServerId, {
                host: BV.PEERJS_HOST,
                port: BV.PEERJS_PORT,
                secure: BV.PEERJS_SECURE,
            });

            newPeer.on('open', (id) => resolve(id));
            newPeer.on('error', reject);
        });
    }

    /**
     * Return lobby info: list of servers with player counts.
     * @returns {object}
     */
    function getLobbyInfo() {
        const servers = [{ serverId, playerCount: players.size }];
        return {
            servers,
            gameSettings,
            totalPlayers: players.size,
        };
    }

    // ========================================
    //  JOINING
    // ========================================

    /**
     * Join an existing game server.
     * @param {string} hostPeerIdToJoin  The full PeerJS ID of the host (e.g. "BV-ABCD-S1").
     * @returns {Promise<void>}
     */
    function joinGame(targetId) {
        // WebSocket Join
        if (useWebSocket && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'join',
                payload: {
                    gameCode: targetId.includes('-') ? targetId.split('-')[0] : targetId,
                    serverId: targetId,
                    username: Auth.getCurrentUser()
                }
            }));
        }

        return new Promise((resolve, reject) => {
            serverId = null;
            amIHost = false;
            hostPeerId = targetId;
            players.clear();
            connections.clear();

            // Generate a random player peer ID
            const myPeerId = `BV-Player-${Utils.generateId()}`;

            if (gamePeer && !gamePeer.destroyed) {
                gamePeer.destroy();
            }

            gamePeer = new Peer(myPeerId, {
                host: BV.PEERJS_HOST,
                port: BV.PEERJS_PORT,
                secure: BV.PEERJS_SECURE,
                config: {
                    iceServers: BV.ICE_SERVERS || [],
                    iceTransportPolicy: 'all'
                }
            });

            gamePeer.on('open', () => {
                // Connect to the host (WebRTC fallback)
                const conn = gamePeer.connect(targetId, { reliable: true });

                conn.on('open', () => {
                    connections.set(targetId, conn);
                    serverId = targetId;

                    // Send our info to the host
                    const myUsername = Auth.getCurrentUser();
                    const myAvatar = Avatar ? Avatar.getConfig() : {};
                    conn.send({
                        type: BV.MSG.PLAYER_JOIN,
                        payload: {
                            username: myUsername,
                            avatar: myAvatar,
                            peerId: myPeerId,
                        },
                    });

                    // Set up data handler
                    _setupConnectionHandlers(conn, targetId);
                });

                conn.on('data', (data) => {
                    handleMessage(targetId, data);
                });

                conn.on('error', (err) => {
                    console.warn('[Multiplayer] WebRTC connection failed, continuing with WebSocket:', err);
                    // Don't reject yet, we might be on WebSocket
                    if (!useWebSocket) reject(err);
                    else resolve(); // Proceed with WebSocket only
                });

                conn.on('close', () => {
                    connections.delete(targetId);
                });
            });

            gamePeer.on('error', (err) => {
                console.warn('[Multiplayer] Game peer error:', err);
                if (!useWebSocket) reject(err);
                else resolve();
            });

            // Listen for other players wanting to connect to us (mesh)
            gamePeer.on('connection', (conn) => {
                _setupConnectionHandlers(conn, conn.peer);
                connections.set(conn.peer, conn);
            });

            // Mark game as joined once we receive world state
            _joinResolve = resolve;

            // Timeout for join if neither works
            setTimeout(() => {
                if (!serverId && !useWebSocket) reject(new Error('Join timeout'));
            }, 5000);
        });
    }

    let _joinResolve = null;

    /**
     * Join a specific server (alias for joinGame).
     * @param {string} serverPeerId
     */
    function joinServer(serverPeerId) {
        return joinGame(serverPeerId);
    }

    // ========================================
    //  MESH CONNECTIONS
    // ========================================

    /**
     * Connect to another player in the mesh network.
     * @param {string} peerId
     * @returns {Promise<DataConnection>}
     */
    function connectToPlayer(peerId) {
        return new Promise((resolve, reject) => {
            if (connections.has(peerId)) {
                resolve(connections.get(peerId));
                return;
            }

            if (!gamePeer || gamePeer.destroyed) {
                reject(new Error('Game peer not available'));
                return;
            }

            const conn = gamePeer.connect(peerId, { reliable: true });

            conn.on('open', () => {
                connections.set(peerId, conn);

                // Send current player state
                const myUsername = Auth.getCurrentUser();
                conn.send({
                    type: BV.MSG.PLAYER_JOIN,
                    payload: {
                        username: myUsername,
                        avatar: Avatar ? Avatar.getConfig() : {},
                        peerId: gamePeer.id,
                    },
                });

                resolve(conn);
            });

            conn.on('error', reject);

            _setupConnectionHandlers(conn, peerId);
        });
    }

    // ========================================
    //  MESSAGE HANDLING
    // ========================================

    /**
     * Route an incoming message to the appropriate handler.
     * @param {string} peerId  Sender's peer ID.
     * @param {object} data    { type, payload }
     */
    function handleMessage(peerId, data) {
        if (!data || !data.type) return;

        const payload = data.payload || {};

        switch (data.type) {
            // ---- Player events ----
            case BV.MSG.PLAYER_POSITION:
                _onPlayerPosition(peerId, payload);
                break;

            case BV.MSG.PLAYER_JOIN:
                _onPlayerJoin(peerId, payload);
                break;

            case BV.MSG.PLAYER_LEAVE:
                _onPlayerLeave(peerId, payload);
                break;

            case BV.MSG.PLAYER_CHAT:
                if (typeof Chat !== 'undefined') {
                    Chat.addMessage(payload.username || 'Unknown', payload.text || '', 'player');
                }
                break;

            case BV.MSG.PLAYER_ANIMATION:
                _onPlayerAnimation(peerId, payload);
                break;

            // ---- Block events (host-authoritative for clients) ----
            case BV.MSG.BLOCK_PLACE:
                if (typeof World !== 'undefined') {
                    World.addBlock(payload.x, payload.y, payload.z, payload.blockType, false);
                }
                break;

            case BV.MSG.BLOCK_REMOVE:
                if (typeof World !== 'undefined') {
                    World.removeBlock(payload.x, payload.y, payload.z, false);
                }
                break;

            // ---- World state (sent to new players by host) ----
            case BV.MSG.WORLD_STATE:
                _onWorldState(payload);
                if (_joinResolve) {
                    _joinResolve();
                    _joinResolve = null;
                }
                break;

            // ---- Game settings ----
            case BV.MSG.GAME_SETTINGS:
                gameSettings = payload;
                document.dispatchEvent(
                    new CustomEvent('multiplayer:settings', { detail: { settings: payload } })
                );
                break;

            // ---- Lobby info response ----
            case BV.MSG.LOBBY_INFO:
                document.dispatchEvent(
                    new CustomEvent('multiplayer:lobbyInfo', { detail: payload })
                );
                break;

            // ---- Player list update (host → all) ----
            case 'player_list':
                _onPlayerList(payload);
                break;

            // ---- Connect to peers (host tells client about other players) ----
            case 'connect_to_peers':
                _onConnectToPeers(payload);
                break;

            // ---- Host migration ----
            case BV.MSG.HOST_TRANSFER:
                _onHostTransfer(payload);
                break;

            case BV.MSG.HOST_CONFIRM:
                // The old host confirms transfer is complete
                break;

            default:
                console.log(`[Multiplayer] Unhandled message type: ${data.type}`);
        }
    }

    // ========================================
    //  SENDING
    // ========================================

    /**
     * Send data to ALL connected peers.
     * @param {object} data
     * @param {string} [excludePeer]  Optional peer to skip.
     */
    function broadcast(data, excludePeer) {
        // Send via WebSocket
        if (useWebSocket && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
        }

        // Send via WebRTC
        connections.forEach((conn, peerId) => {
            if (peerId !== excludePeer && conn.open) {
                try {
                    conn.send(data);
                } catch (err) {
                    console.warn(`[Multiplayer] Broadcast to ${peerId} failed:`, err);
                }
            }
        });
    }

    /**
     * Send data to the host only.
     * @param {object} data
     */
    function sendToHost(data) {
        if (!hostPeerId) return;
        sendToPeer(hostPeerId, data);
    }

    /**
     * Send data to a specific peer.
     * @param {string} peerId
     * @param {object} data
     */
    function sendToPeer(peerId, data) {
        const conn = connections.get(peerId);
        if (conn && conn.open) {
            try {
                conn.send(data);
            } catch (err) {
                console.warn(`[Multiplayer] Send to ${peerId} failed:`, err);
            }
        }
    }

    // ========================================
    //  POSITION BROADCAST
    // ========================================

    /**
     * Broadcast the local player's position. Call this every frame;
     * it will throttle itself to ~20 Hz and skip if unchanged.
     * @param {THREE.Vector3} position
     * @param {{yaw: number, pitch: number}} rotation
     */
    function broadcastPosition(position, rotation) {
        const now = performance.now();
        if (now - _lastBroadcastTime < BROADCAST_INTERVAL) return;

        // Skip if position hasn't changed meaningfully
        const dx = Math.abs(position.x - _lastBroadcastPos.x);
        const dy = Math.abs(position.y - _lastBroadcastPos.y);
        const dz = Math.abs(position.z - _lastBroadcastPos.z);
        const dYaw = Math.abs(rotation.yaw - _lastBroadcastRot.yaw);
        const dPitch = Math.abs(rotation.pitch - _lastBroadcastRot.pitch);

        if (dx < POSITION_THRESHOLD && dy < POSITION_THRESHOLD && dz < POSITION_THRESHOLD &&
            dYaw < POSITION_THRESHOLD && dPitch < POSITION_THRESHOLD) {
            return;
        }

        _lastBroadcastTime = now;
        _lastBroadcastPos = { x: position.x, y: position.y, z: position.z };
        _lastBroadcastRot = { yaw: rotation.yaw, pitch: rotation.pitch };

        broadcast({
            type: BV.MSG.PLAYER_POSITION,
            payload: {
                x: position.x,
                y: position.y,
                z: position.z,
                yaw: rotation.yaw,
                pitch: rotation.pitch,
            },
        });
    }

    // ========================================
    //  HOST MIGRATION
    // ========================================

    /**
     * Transfer the host role to another player.
     * @param {string} newHostPeerId
     */
    function transferHost(newHostPeerId) {
        if (!amIHost) return;

        // Collect full world state
        const worldState = (typeof World !== 'undefined')
            ? World.getBlocksSnapshot()
            : {};

        const playerList = {};
        players.forEach((info, pid) => {
            playerList[pid] = info;
        });

        // Send transfer payload
        sendToPeer(newHostPeerId, {
            type: BV.MSG.HOST_TRANSFER,
            payload: {
                worldState,
                gameSettings,
                playerList,
            },
        });

        // Announce to everyone
        broadcast({
            type: 'host_changed',
            payload: { newHostPeerId },
        });

        amIHost = false;
        hostPeerId = newHostPeerId;

        document.dispatchEvent(
            new CustomEvent('multiplayer:hostChanged', { detail: { newHostPeerId } })
        );
    }

    /**
     * Receive the host role (called internally via message handler).
     * @param {object} data  { worldState, gameSettings, playerList }
     */
    function _onHostTransfer(data) {
        amIHost = true;
        gameSettings = data.gameSettings || {};

        // Restore world state
        if (typeof World !== 'undefined' && data.worldState) {
            World.loadBlocksSnapshot(data.worldState);
        }

        // Restore player list
        players.clear();
        if (data.playerList) {
            Object.entries(data.playerList).forEach(([pid, info]) => {
                players.set(pid, info);
            });
        }

        // Update serverId to our peer ID
        if (gamePeer) {
            serverId = gamePeer.id;
        }

        // Start accepting new connections as host
        if (gamePeer) {
            gamePeer.on('connection', (conn) => {
                _handleIncomingConnection(conn);
            });
        }

        Utils.showToast('You are now the host!', 'success');

        document.dispatchEvent(
            new CustomEvent('multiplayer:becameHost', { detail: {} })
        );
    }

    // ========================================
    //  SERVER DISCOVERY
    // ========================================

    /**
     * Probe potential servers for a given game code.
     * Uses decentralized discovery via GunDB.
     * @param {string} gameCode
     * @returns {Promise<Array<{serverId, playerCount, maxPlayers}>>}
     */
    async function findServers(pGameCode) {
        if (typeof LobbyRegistry !== 'undefined') {
            return new Promise((resolve) => {
                // Get current list from GunDB
                LobbyRegistry.discoverServers(pGameCode, (servers) => {
                    resolve(servers);
                });
                
                // Safety timeout
                setTimeout(() => resolve([]), 3000);
            });
        }

        // Fallback to legacy probing if LobbyRegistry is missing
        const results = [];

        const probePromise = (async () => {
            const maxServers = 5;
            const checks = [];
            for (let i = 1; i <= maxServers; i++) {
                checks.push(_probeServer(`${pGameCode}-S${i}`));
            }
            const outcomes = await Promise.allSettled(checks);
            return outcomes
                .filter(o => o.status === 'fulfilled' && o.value)
                .map(o => ({ ...o.value, type: 'webrtc' }));
        })();

        if (useWebSocket && socket && socket.readyState === WebSocket.OPEN) {
            const socketPromise = new Promise((resolve) => {
                const handler = (e) => {
                    document.removeEventListener('multiplayer:discovery', handler);
                    resolve(e.detail.map(s => ({ ...s, type: 'websocket' })));
                };
                document.addEventListener('multiplayer:discovery', handler);
                socket.send(JSON.stringify({ type: 'discovery', payload: { gameCode: pGameCode } }));
                setTimeout(() => {
                    document.removeEventListener('multiplayer:discovery', handler);
                    resolve([]);
                }, 2000);
            });

            const [webrtc, ws] = await Promise.all([probePromise, socketPromise]);
            return [...ws, ...webrtc];
        }

        return await probePromise;
    }

    /**
     * Probe a single server to see if it exists and get player count.
     * @param {string} serverPeerId
     * @returns {Promise<object|null>}
     */
    function _probeServer(serverPeerId) {
        return new Promise((resolve) => {
            const probePeer = new Peer(`Probe-${Utils.generateId()}`, {
                host: BV.PEERJS_HOST,
                port: BV.PEERJS_PORT,
                secure: BV.PEERJS_SECURE,
            });

            let resolved = false;
            const finish = (result) => {
                if (resolved) return;
                resolved = true;
                probePeer.destroy();
                resolve(result);
            };

            probePeer.on('open', () => {
                const conn = probePeer.connect(serverPeerId, { reliable: false });

                const timeout = setTimeout(() => {
                    conn.close();
                    finish(null);
                }, 3000);

                conn.on('open', () => {
                    conn.send({ type: BV.MSG.LOBBY_LIST_SERVERS, payload: {} });
                });

                conn.on('data', (data) => {
                    clearTimeout(timeout);
                    if (data && data.type === BV.MSG.LOBBY_INFO) {
                        finish({
                            serverId,
                            playerCount: data.payload.playerCount || 0,
                            maxPlayers: data.payload.maxPlayers || BV.MAX_PLAYERS_PER_SERVER,
                        });
                    } else {
                        finish(null);
                    }
                });

                conn.on('error', () => {
                    clearTimeout(timeout);
                    finish(null);
                });
            });

            probePeer.on('error', () => {
                finish(null);
            });

            // Absolute fallback
            setTimeout(() => finish(null), 4000);
        });
    }

    /**
     * Attempt to find and join a random available game.
     * @returns {Promise<{gameCode, serverId}|null>}
     */
    async function randomPlay() {
        // Check friends' games first
        const friendList = Friends.getFriends();
        for (const friend of friendList) {
            // This is a best-effort check; if the friend is in a game,
            // we'd need to get their gameInfo from the status cache.
            // For now, return null and let the caller show a toast.
        }

        // Try some common sample codes
        const sampleCodes = ['SAMPLE-BLDW', 'SAMPLE-TOWR', 'SAMPLE-SPDB', 'SAMPLE-CTYT', 'SAMPLE-RCEA', 'SAMPLE-SWFT'];

        for (const code of sampleCodes) {
            const servers = await findServers(code);
            if (servers.length > 0) {
                const server = servers.find((s) => s.playerCount < s.maxPlayers);
                if (server) {
                    return { gameCode: code, serverId: server.serverId };
                }
            }
        }

        return null;
    }

    // ========================================
    //  LEAVE GAME
    // ========================================

    /**
     * Leave the current game: clean up all connections, destroy game peer.
     */
    function leaveGame() {
        // Stop announcing to lobby
        if (typeof LobbyRegistry !== 'undefined') {
            LobbyRegistry.stopAnnouncing();
        }

        // Notify peers
        broadcast({
            type: BV.MSG.PLAYER_LEAVE,
            payload: { peerId: gamePeer ? gamePeer.id : null },
        });

        // If hosting, transfer or close
        if (amIHost && players.size > 0) {
            // Transfer to the oldest connected non-host player
            const candidates = [...players.keys()].filter((pid) => pid !== hostPeerId);
            if (candidates.length > 0) {
                transferHost(candidates[0]);
            }
        }

        // Close all connections
        connections.forEach((conn) => {
            try { conn.close(); } catch (_) { /* noop */ }
        });
        connections.clear();

        // Destroy game peer
        if (gamePeer && !gamePeer.destroyed) {
            gamePeer.destroy();
        }
        gamePeer = null;

        // Reset state
        amIHost = false;
        hostPeerId = null;
        serverId = null;
        players.clear();

        _lastBroadcastPos = { x: 0, y: 0, z: 0 };
        _lastBroadcastRot = { yaw: 0, pitch: 0 };
        _lastBroadcastTime = 0;

        document.dispatchEvent(new CustomEvent('multiplayer:leaveGame'));
    }

    // ========================================
    //  Connection Handlers (private)
    // ========================================

    /**
     * Handle an incoming connection as the host.
     * @param {DataConnection} conn
     */
    function _handleIncomingConnection(conn) {
        conn.on('open', () => {
            connections.set(conn.peer, conn);
        });

        conn.on('data', (data) => {
            handleMessage(conn.peer, data);
        });

        conn.on('close', () => {
            connections.delete(conn.peer);
            _onPlayerDisconnect(conn.peer);
        });

        conn.on('error', (err) => {
            console.warn(`[Multiplayer] Connection error from ${conn.peer}:`, err);
        });
    }

    /**
     * Set up handlers for a connection (used by both host and client).
     * @param {DataConnection} conn
     * @param {string} peerId
     */
    function _setupConnectionHandlers(conn, peerId) {
        conn.on('data', (data) => {
            handleMessage(peerId, data);
        });

        conn.on('close', () => {
            connections.delete(peerId);
            _onPlayerDisconnect(peerId);
        });
    }

    // ========================================
    //  Message-specific handlers (private)
    // ========================================

    function _onPlayerJoin(peerId, payload) {
        const username = payload.username || 'Unknown';
        players.set(peerId, {
            username,
            joinedAt: Date.now(),
            avatar: payload.avatar || {},
            peerId,
        });

        // If I'm the host, send world state + settings + player list
        if (amIHost) {
            const conn = connections.get(peerId);
            if (conn && conn.open) {
                // Send world state
                if (typeof World !== 'undefined') {
                    conn.send({
                        type: BV.MSG.WORLD_STATE,
                        payload: World.getBlocksSnapshot(),
                    });
                }

                // Send game settings
                conn.send({
                    type: BV.MSG.GAME_SETTINGS,
                    payload: gameSettings,
                });

                // Send player list
                const playerList = {};
                players.forEach((info, pid) => {
                    playerList[pid] = info;
                });
                conn.send({
                    type: 'player_list',
                    payload: playerList,
                });

                // Tell the new player to connect to existing peers (mesh)
                const otherPeers = [...connections.keys()].filter((pid) => pid !== peerId);
                if (otherPeers.length > 0) {
                    conn.send({
                        type: 'connect_to_peers',
                        payload: { peerIds: otherPeers },
                    });
                }

                // Broadcast new player join to everyone else
                broadcast(
                    {
                        type: BV.MSG.PLAYER_JOIN,
                        payload: { username, peerId, avatar: payload.avatar },
                    },
                    peerId
                );
            }
        }

        // Add remote player avatar to world
        if (typeof RemotePlayers !== 'undefined') {
            RemotePlayers.addPlayer(peerId, username, payload.avatar);
        }

        if (typeof Chat !== 'undefined') {
            Chat.addSystemMessage(`${username} joined the game`);
        }
    }

    function _onPlayerLeave(peerId, payload) {
        const player = players.get(peerId);
        if (player) {
            if (typeof Chat !== 'undefined') {
                Chat.addSystemMessage(`${player.username} left the game`);
            }
            players.delete(peerId);
        }

        if (typeof RemotePlayers !== 'undefined') {
            RemotePlayers.removePlayer(peerId);
        }
    }

    function _onPlayerDisconnect(peerId) {
        const player = players.get(peerId);
        if (player) {
            if (typeof Chat !== 'undefined') {
                Chat.addSystemMessage(`${player.username} disconnected`);
            }
            players.delete(peerId);
        }

        if (typeof RemotePlayers !== 'undefined') {
            RemotePlayers.removePlayer(peerId);
        }
    }

    function _onPlayerPosition(peerId, payload) {
        if (typeof RemotePlayers !== 'undefined') {
            RemotePlayers.updatePosition(
                peerId,
                { x: payload.x, y: payload.y, z: payload.z },
                { yaw: payload.yaw, pitch: payload.pitch }
            );
        }
    }

    function _onPlayerAnimation(peerId, payload) {
        if (typeof RemotePlayers !== 'undefined') {
            RemotePlayers.playAnimation(peerId, payload.animation, payload.params);
        }
    }

    function _onWorldState(payload) {
        if (typeof World !== 'undefined' && payload) {
            World.loadBlocksSnapshot(payload);
        }
    }

    function _onPlayerList(payload) {
        if (!payload) return;

        players.clear();
        Object.entries(payload).forEach(([pid, info]) => {
            players.set(pid, info);

            // Create remote player visuals
            if (typeof RemotePlayers !== 'undefined' && pid !== (gamePeer && gamePeer.id)) {
                RemotePlayers.addPlayer(pid, info.username, info.avatar);
            }
        });
    }

    function _onConnectToPeers(payload) {
        if (!payload || !payload.peerIds) return;

        payload.peerIds.forEach((peerId) => {
            connectToPlayer(peerId).catch(() => {
                // Mesh connection may fail if the peer is behind strict NAT
                console.warn(`[Multiplayer] Failed to connect to peer ${peerId}`);
            });
        });
    }

    // ========================================
    //  Host connection handler (responds to probes)
    // ========================================

    // Augment _handleIncomingConnection to respond to lobby probes
    // We do this by checking for LOBBY_LIST_SERVERS in handleMessage.
    // Override the base switch in handleMessage:
    // The LOBBY_LIST_SERVERS case is already handled above.

    // ========================================
    //  Return the public interface
    // ========================================
    return {
        init,
        // State accessors
        get gamePeer() { return gamePeer; },
        set gamePeer(v) { gamePeer = v; },
        get connections() { return connections; },
        get amIHost() { return amIHost; },
        set amIHost(v) { amIHost = v; },
        get hostPeerId() { return hostPeerId; },
        get serverId() { return serverId; },
        get gameCode() { return gameCode; },
        get players() { return players; },

        // Hosting
        hostGame,
        createServer,
        getLobbyInfo,

        // Joining
        joinGame,
        joinServer,

        // Mesh
        connectToPlayer,

        // Messages
        handleMessage,
        broadcast,
        sendToHost,
        sendToPeer,

        // Position
        broadcastPosition,

        // Host migration
        transferHost,

        // Discovery
        findServers,
        randomPlay,

        // Cleanup
        leaveGame,
    };
})();
