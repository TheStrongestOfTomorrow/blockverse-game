const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Active servers/rooms
// Map<gameCode, Array<{serverId, hostId, playerCount, maxPlayers, webRtcEnabled}>>
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
            console.error('Error parsing message:', e);
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
    client.username = payload.username;

    if (!rooms.has(gameCode)) {
        rooms.set(gameCode, []);
    }

    const roomInfo = {
        serverId: payload.serverId || uuidv4(),
        hostId: client.id,
        playerCount: 1,
        maxPlayers: settings.maxPlayers || 12,
        webRtcEnabled: payload.webRtcEnabled || false,
        name: settings.name,
        category: settings.category
    };

    rooms.get(gameCode).push(roomInfo);
    ws.send(JSON.stringify({ type: 'hosted', payload: { serverId: roomInfo.serverId } }));
}

function joinRoom(ws, payload) {
    const { gameCode, serverId } = payload;
    const client = clients.get(ws);

    const roomList = rooms.get(gameCode);
    if (!roomList) return;

    const room = roomList.find(r => r.serverId === serverId);
    if (room && room.playerCount < room.maxPlayers) {
        room.playerCount++;
        client.currentRoom = gameCode;
        client.serverId = serverId;

        // Notify others in room
        broadcastToRoom(ws, gameCode, {
            type: 'player_join',
            payload: { username: client.username, id: client.id }
        });
    }
}

function discoverRooms(ws, payload) {
    const { gameCode } = payload;
    const roomList = rooms.get(gameCode) || [];
    ws.send(JSON.stringify({ type: 'discovery_results', payload: roomList }));
}

function broadcastToRoom(senderWs, gameCode, data) {
    const sender = clients.get(senderWs);
    wss.clients.forEach(clientWs => {
        if (clientWs !== senderWs && clientWs.readyState === WebSocket.OPEN) {
            const target = clients.get(clientWs);
            if (target.currentRoom === gameCode) {
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
            // Room closes if host leaves (simple version)
            roomList.splice(roomIdx, 1);
            broadcastToRoom(ws, gameCode, { type: 'room_closed' });
        } else {
            room.playerCount--;
            broadcastToRoom(ws, gameCode, { type: 'player_leave', payload: { id: client.id } });
        }
    }
}

server.listen(PORT, () => {
    console.log(`WebSocket server listening on port ${PORT}`);
});
