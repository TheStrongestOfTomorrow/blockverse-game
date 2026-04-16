/**
 * BLOCKVERSE - Lobby Registry (js/lobby-registry.js)
 * Decentralized server discovery using GunDB.
 * Ensures hosts can broadcast their availability without a central server.
 */

const LobbyRegistry = (() => {
    'use strict';

    let gun = null;
    let _heartbeatInterval = null;
    const LOBBY_NODE = 'blockverse-v2-lobby';
    const HEARTBEAT_MS = 5000;
    const STALE_MS = 15000;

    function init() {
        if (typeof Gun === 'undefined') {
            console.error('[LobbyRegistry] GunDB not found. Please include Gun.js script.');
            return;
        }

        // Use public Gun relays for discovery
        gun = Gun([
            'https://gun-manhattan.herokuapp.com/gun',
            'https://libera.miraheze.org/gun'
        ]);

        console.log('[LobbyRegistry] Initialized decentralized discovery');
    }

    /**
     * Host: Announce server presence.
     */
    function announceServer(gameCode, serverId, metadata) {
        if (!gun) return;

        const serverNode = gun.get(LOBBY_NODE).get('servers').get(serverId);
        
        const update = () => {
            serverNode.put({
                serverId: serverId,
                gameCode: gameCode,
                name: metadata.name || 'Public Server',
                playerCount: metadata.playerCount || 0,
                maxPlayers: metadata.maxPlayers || 12,
                lastSeen: Date.now(),
                isPrivate: !!metadata.isPrivate,
                hasPassword: !!metadata.hasPassword,
                host: metadata.host || Auth.getCurrentUser(),
            });
        };

        // Initial announce
        update();

        // Register in game-specific list
        gun.get(LOBBY_NODE).get('games').get(gameCode).get(serverId).put(true);

        // Heartbeat
        if (_heartbeatInterval) clearInterval(_heartbeatInterval);
        _heartbeatInterval = setInterval(update, HEARTBEAT_MS);

        console.log(`[LobbyRegistry] Announcing server ${serverId} for ${gameCode}`);
    }

    /**
     * Client: Discover active servers for a game code.
     */
    function discoverServers(gameCode, callback) {
        if (!gun) return callback([]);

        const activeServers = new Map();
        const now = Date.now();

        // Listen to the game's server list
        gun.get(LOBBY_NODE).get('games').get(gameCode).map().on((val, serverId) => {
            if (val === null) {
                activeServers.delete(serverId);
                callback(Array.from(activeServers.values()));
                return;
            }

            // Fetch server metadata
            gun.get(LOBBY_NODE).get('servers').get(serverId).on((data) => {
                if (!data) return;

                // Filter stale servers
                if (Date.now() - data.lastSeen > STALE_MS) {
                    activeServers.delete(serverId);
                } else {
                    activeServers.set(serverId, data);
                }
                callback(Array.from(activeServers.values()));
            });
        });
        
        // Return current state immediately
        return Array.from(activeServers.values());
    }

    function stopAnnouncing() {
        if (_heartbeatInterval) {
            clearInterval(_heartbeatInterval);
            _heartbeatInterval = null;
        }
    }

    return {
        init,
        announceServer,
        discoverServers,
        stopAnnouncing
    };
})();
