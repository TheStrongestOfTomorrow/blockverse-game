const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Active servers/rooms
// Map<gameCode, Array<{serverId, hostId, playerCount, maxPlayers, webRtcEnabled, roomState}>>
const rooms = new Map();

// Map<ws, {id, username, currentRoom, isHost}>
const clients = new Map();

wss.on('connection', (ws) => {
    const clientId = uuidv4();
    clients.set(ws, { id: clientId });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (e) {
            console.error('[Server] Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        const client = clients.get(ws);
        if (client && client.currentRoom) {
            leaveRoom(ws, client.currentRoom);
        }
        clients.delete(ws);
    });
});

function handleMessage(ws, data) {
    const client = clients.get(ws);

    switch (data.type) {
        case 'host':
            hostRoom(ws, data.payload);
            break;
        case 'join':
            joinRoom(ws, data.payload);
            break;
        case 'discovery':
            discoverRooms(ws, data.payload);
            break;
        case 'player_pos':
        case 'block_place':
        case 'block_remove':
        case 'player_chat':
        case 'chat':
        case 'pos':
        case 'block':
            broadcastToRoom(ws, client.currentRoom, data);
            break;
    }
}

function hostRoom(ws, payload) {
    const { gameCode, settings } = payload;
    const client = clients.get(ws);

    client.currentRoom = gameCode;
    client.isHost = true;
    client.username = payload.username || 'Host';

    if (!rooms.has(gameCode)) {
        rooms.set(gameCode, []);
    }

    const roomInfo = {
        serverId: payload.serverId || uuidv4(),
        hostId: client.id,
        playerCount: 1,
        maxPlayers: (settings && settings.maxPlayers) || 12,
        webRtcEnabled: payload.webRtcEnabled || false,
        name: (settings && settings.name) || 'Public Server',
        category: (settings && settings.category) || 'sandbox'
    };

    rooms.get(gameCode).push(roomInfo);
    ws.send(JSON.stringify({ type: 'hosted', payload: { serverId: roomInfo.serverId } }));
    console.log(`[Server] Room hosted: ${gameCode} (${roomInfo.serverId}) by ${client.username}`);
}

function joinRoom(ws, payload) {
    const { gameCode, serverId } = payload;
    const client = clients.get(ws);
    client.username = payload.username || 'Player';

    const roomList = rooms.get(gameCode);
    if (!roomList) return;

    const room = roomList.find(r => r.serverId === serverId || !serverId);
    if (room && room.playerCount < room.maxPlayers) {
        room.playerCount++;
        client.currentRoom = gameCode;
        client.serverId = room.serverId;

        // Notify room
        broadcastToRoom(ws, gameCode, {
            type: 'player_join',
            payload: { username: client.username, id: client.id }
        });
        console.log(`[Server] ${client.username} joined room: ${gameCode}`);
    }
}

function discoverRooms(ws, payload) {
    const { gameCode } = payload;
    const roomList = rooms.get(gameCode) || [];
    ws.send(JSON.stringify({ type: 'discovery_results', payload: roomList }));
}

function broadcastToRoom(senderWs, gameCode, data) {
    if (!gameCode) return;
    const sender = clients.get(senderWs);
    data.senderId = sender ? sender.id : null;

    wss.clients.forEach(clientWs => {
        if (clientWs !== senderWs && clientWs.readyState === WebSocket.OPEN) {
            const target = clients.get(clientWs);
            if (target && target.currentRoom === gameCode) {
                clientWs.send(JSON.stringify(data));
            }
        }
    });
}

function leaveRoom(ws, gameCode) {
    const client = clients.get(ws);
    const roomList = rooms.get(gameCode);
    if (!roomList) return;

    const roomIdx = roomList.findIndex(r => r.hostId === client.id || r.serverId === client.serverId);
    if (roomIdx !== -1) {
        const room = roomList[roomIdx];
        if (client.isHost) {
            // Automatic Host Migration: promote another client if available
            const roomClients = Array.from(clients.entries()).filter(([w, c]) => c.currentRoom === gameCode && w !== ws);
            if (roomClients.length > 0) {
                const [nextWs, nextClient] = roomClients[0];
                nextClient.isHost = true;
                room.hostId = nextClient.id;
                room.playerCount--;
                nextWs.send(JSON.stringify({ type: 'became_host' }));
                console.log(`[Server] Host migrated to ${nextClient.username} in room: ${gameCode}`);
            } else {
                roomList.splice(roomIdx, 1);
                broadcastToRoom(ws, gameCode, { type: 'room_closed' });
                console.log(`[Server] Room closed: ${gameCode}`);
            }
        } else {
            room.playerCount--;
            broadcastToRoom(ws, gameCode, { type: 'player_leave', payload: { id: client.id } });
        }
    }
}

server.listen(PORT, () => {
    console.log(`[Server] Robust WebSocket server listening on port ${PORT}`);
});
