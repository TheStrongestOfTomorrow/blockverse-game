// BlockVerse WebSocket Game Server
// Handles multiplayer rooms, block sync, player positions, chat, and host migration

import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = 3001;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Room state
interface RoomPlayer {
  id: string;
  username: string;
  isHost: boolean;
  position: { x: number; y: number; z: number };
  rotation: number;
  joinedAt: number;
}

interface Room {
  id: string;
  gameCode: string;
  name: string;
  category: string;
  maxPlayers: number;
  players: Map<string, RoomPlayer>;
  hostId: string;
  createdAt: number;
}

const rooms = new Map<string, Room>();

// Rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 1000; // 1 second
const RATE_LIMIT_MAX = 20; // 20 messages per second

function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(socketId);
  if (!limit || now > limit.resetAt) {
    rateLimits.set(socketId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (limit.count >= RATE_LIMIT_MAX) return false;
  limit.count++;
  return true;
}

// Input validation
function validatePosition(pos: unknown): pos is { x: number; y: number; z: number } {
  return typeof pos === 'object' && pos !== null &&
    typeof (pos as Record<string, unknown>).x === 'number' &&
    typeof (pos as Record<string, unknown>).y === 'number' &&
    typeof (pos as Record<string, unknown>).z === 'number';
}

io.on('connection', (socket) => {
  console.log(`[GameServer] Client connected: ${socket.id}`);

  let currentRoomId: string | null = null;
  let currentPlayerId: string | null = null;

  // Host a room
  socket.on('host', (data: {
    gameCode: string;
    name: string;
    category: string;
    maxPlayers: number;
    username: string;
  }) => {
    if (!data.gameCode || !data.username) {
      socket.emit('error', { message: 'Invalid host data' });
      return;
    }

    const roomId = data.gameCode;
    if (rooms.has(roomId)) {
      socket.emit('error', { message: 'Room already exists' });
      return;
    }

    const playerId = socket.id;
    const player: RoomPlayer = {
      id: playerId,
      username: data.username,
      isHost: true,
      position: { x: 0, y: 5, z: 0 },
      rotation: 0,
      joinedAt: Date.now(),
    };

    const room: Room = {
      id: roomId,
      gameCode: data.gameCode,
      name: data.name || data.gameCode,
      category: data.category || 'sandbox',
      maxPlayers: data.maxPlayers || 12,
      players: new Map([[playerId, player]]),
      hostId: playerId,
      createdAt: Date.now(),
    };

    rooms.set(roomId, room);
    currentRoomId = roomId;
    currentPlayerId = playerId;

    socket.join(roomId);
    socket.emit('hosted', { serverId: roomId, hostId: playerId });
    console.log(`[GameServer] Room hosted: ${roomId} by ${data.username}`);
  });

  // Join a room
  socket.on('join', (data: { gameCode: string; username: string }) => {
    if (!data.gameCode || !data.username) {
      socket.emit('error', { message: 'Invalid join data' });
      return;
    }

    const room = rooms.get(data.gameCode);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.players.size >= room.maxPlayers) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    // Check if already in room
    if (room.players.has(socket.id)) {
      socket.emit('error', { message: 'Already in room' });
      return;
    }

    const playerId = socket.id;
    const player: RoomPlayer = {
      id: playerId,
      username: data.username,
      isHost: false,
      position: { x: 0, y: 5, z: 0 },
      rotation: 0,
      joinedAt: Date.now(),
    };

    room.players.set(playerId, player);
    currentRoomId = data.gameCode;
    currentPlayerId = playerId;

    socket.join(data.gameCode);

    // Send current players to the joiner
    const playersList = Array.from(room.players.values()).map(p => ({
      id: p.id,
      username: p.username,
      isHost: p.isHost,
      position: p.position,
    }));

    socket.emit('joined', {
      serverId: data.gameCode,
      players: playersList,
      hostId: room.hostId,
    });

    // Notify others
    socket.to(data.gameCode).emit('player_join', {
      id: playerId,
      username: data.username,
      position: player.position,
    });

    console.log(`[GameServer] ${data.username} joined room ${data.gameCode}`);
  });

  // Player position update
  socket.on('player_pos', (data: { position: { x: number; y: number; z: number }; rotation: number }) => {
    if (!currentRoomId || !checkRateLimit(socket.id)) return;
    if (!validatePosition(data.position)) return;

    const room = rooms.get(currentRoomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    player.position = data.position;
    player.rotation = data.rotation || 0;

    socket.to(currentRoomId).emit('player_pos', {
      id: socket.id,
      position: data.position,
      rotation: data.rotation,
    });
  });

  // Block place
  socket.on('block_place', (data: { x: number; y: number; z: number; type: string }) => {
    if (!currentRoomId || !checkRateLimit(socket.id)) return;

    const room = rooms.get(currentRoomId);
    if (!room) return;

    socket.to(currentRoomId).emit('block_place', {
      id: socket.id,
      x: data.x,
      y: data.y,
      z: data.z,
      type: data.type,
    });
  });

  // Block remove
  socket.on('block_remove', (data: { x: number; y: number; z: number }) => {
    if (!currentRoomId || !checkRateLimit(socket.id)) return;

    const room = rooms.get(currentRoomId);
    if (!room) return;

    socket.to(currentRoomId).emit('block_remove', {
      id: socket.id,
      x: data.x,
      y: data.y,
      z: data.z,
    });
  });

  // Chat message
  socket.on('chat', (data: { message: string }) => {
    if (!currentRoomId || !checkRateLimit(socket.id)) return;

    const room = rooms.get(currentRoomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const message = typeof data.message === 'string' ? data.message.slice(0, 200) : '';
    if (!message) return;

    io.to(currentRoomId).emit('chat', {
      id: socket.id,
      username: player.username,
      message,
      timestamp: Date.now(),
    });
  });

  // Discovery - list rooms
  socket.on('discovery', (data: { gameCode?: string }) => {
    const roomList = Array.from(rooms.values())
      .filter(r => !data.gameCode || r.gameCode === data.gameCode)
      .map(r => ({
        id: r.id,
        name: r.name,
        category: r.category,
        playerCount: r.players.size,
        maxPlayers: r.maxPlayers,
      }));

    socket.emit('discovery_results', roomList);
  });

  // Host transfer
  socket.on('host_transfer', (data: { targetId: string }) => {
    if (!currentRoomId) return;

    const room = rooms.get(currentRoomId);
    if (!room || room.hostId !== socket.id) return;

    const target = room.players.get(data.targetId);
    if (!target) return;

    const oldHost = room.players.get(room.hostId);
    if (oldHost) oldHost.isHost = false;

    room.hostId = data.targetId;
    target.isHost = true;

    io.to(currentRoomId).emit('host_change', {
      oldHostId: socket.id,
      newHostId: data.targetId,
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[GameServer] Client disconnected: ${socket.id}`);

    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.players.delete(socket.id);

        if (room.players.size === 0) {
          rooms.delete(currentRoomId);
          console.log(`[GameServer] Room deleted: ${currentRoomId}`);
        } else {
          // Host migration
          if (room.hostId === socket.id) {
            const newHost = room.players.values().next().value;
            if (newHost) {
              newHost.isHost = true;
              room.hostId = newHost.id;
              io.to(currentRoomId).emit('host_change', {
                oldHostId: socket.id,
                newHostId: newHost.id,
              });
              console.log(`[GameServer] Host migrated to ${newHost.username} in room ${currentRoomId}`);
            }
          }

          socket.to(currentRoomId).emit('player_leave', { id: socket.id });
        }
      }
    }

    rateLimits.delete(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[GameServer] WebSocket server listening on port ${PORT}`);
});
