// ============================================
// BLOCKVERSE - Shared Configuration & Constants
// ============================================

const BV = {
    VERSION: '1.0.0',
    NAME: 'BlockVerse',
    
    // Network
    PEERJS_HOST: '0.peerjs.com',
    PEERJS_PORT: 443,
    PEERJS_SECURE: true,
    MAX_PLAYERS_PER_SERVER: 12,
    
    // World
    BLOCK_SIZE: 1,
    WORLD_HEIGHT_LIMIT: 64,
    CHUNK_SIZE: 16,
    RENDER_DISTANCE: 4,
    GRAVITY: -25,
    JUMP_FORCE: 9,
    PLAYER_SPEED: 5,
    PLAYER_SPRINT_SPEED: 8,
    MOUSE_SENSITIVITY: 0.002,
    
    // UI
    CHAT_MAX_MESSAGES: 100,
    CHAT_MAX_LENGTH: 200,
    FRIEND_LIMIT: 200,
    REFRESH_COOLDOWN: 20,
    RANDOM_PLAY_COOLDOWN: 10,
    MAX_BLOCKS_PER_PLAYER_SAVE: 500,
    TOOLBAR_SIZE: 9,
    
    // Colors
    COLORS: {
        PRIMARY: '#6c5ce7',
        SECONDARY: '#00b894',
        DANGER: '#d63031',
        WARNING: '#fdcb6e',
        SUCCESS: '#00b894',
        BG_DARK: '#0a0a1a',
        BG_CARD: '#1a1a2e',
        BG_HOVER: '#2d2d44',
        TEXT_PRIMARY: '#ffffff',
        TEXT_SECONDARY: '#a0a0b0',
        ACCENT: '#6c5ce7',
    },

    // Block Types
    BLOCK_TYPES: {
        grass:   { name: 'Grass',   color: '#4CAF50', topColor: '#66BB6A', sideColor: '#795548', bottomColor: '#795548' },
        stone:   { name: 'Stone',   color: '#9E9E9E' },
        dirt:    { name: 'Dirt',    color: '#795548' },
        wood:    { name: 'Wood',    color: '#8D6E63' },
        brick:   { name: 'Brick',   color: '#E74C3C' },
        sand:    { name: 'Sand',    color: '#F5DEB3' },
        water:   { name: 'Water',   color: '#2196F3', transparent: true, opacity: 0.6 },
        lava:    { name: 'Lava',    color: '#FF5722', emissive: '#FF3D00' },
        glass:   { name: 'Glass',   color: '#E0F7FA', transparent: true, opacity: 0.3 },
        gold:    { name: 'Gold',    color: '#FFD700', emissive: '#FFA000' },
        diamond: { name: 'Diamond', color: '#00BCD4', emissive: '#0097A7' },
        obsidian:{ name: 'Obsidian',color: '#1a1a2e', emissive: '#2d2d44' },
        snow:    { name: 'Snow',    color: '#FAFAFA' },
        ice:     { name: 'Ice',     color: '#B3E5FC', transparent: true, opacity: 0.5 },
        leaf:    { name: 'Leaves',  color: '#2E7D32', transparent: true, opacity: 0.8 },
        plank:   { name: 'Planks',  color: '#D7CCC8' },
        cobble:  { name: 'Cobble',  color: '#757575' },
    },

    // Default Toolbar
    DEFAULT_TOOLBAR: ['grass', 'stone', 'dirt', 'wood', 'brick', 'sand', 'plank', 'cobble', 'glass'],

    // Avatar Part Types
    AVATAR_PARTS: {
        head: ['default', 'round', 'square', 'pointy'],
        body: ['default', 'slim', 'wide', 'tall'],
        arms: ['default', 'short', 'long', 'thick'],
        legs: ['default', 'short', 'long'],
        accessory: ['none', 'hat', 'crown', 'wings', 'cape', 'horns'],
    },

    // Avatar Colors
    AVATAR_COLORS: [
        '#E74C3C', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
        '#2196F3', '#00BCD4', '#009688', '#4CAF50', '#8BC34A',
        '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
        '#795548', '#9E9E9E', '#607D8B', '#FFFFFF', '#000000',
    ],

    // Game Categories
    GAME_CATEGORIES: [
        { id: 'all', name: 'All Games', icon: '🎮' },
        { id: 'sandbox', name: 'Sandbox', icon: '🏗️' },
        { id: 'obby', name: 'Obby', icon: '🏃' },
        { id: 'tycoon', name: 'Tycoon', icon: '💰' },
        { id: 'racing', name: 'Racing', icon: '🏎️' },
        { id: 'adventure', name: 'Adventure', icon: '⚔️' },
        { id: 'roleplay', name: 'Roleplay', icon: '🎭' },
        { id: 'minigame', name: 'Minigame', icon: '🎯' },
    ],

    // Storage Keys
    STORAGE_KEYS: {
        AUTH: 'bv_auth',
        PROFILE: 'bv_profile',
        FRIENDS: 'bv_friends',
        FRIEND_REQUESTS: 'bv_friend_requests',
        INVENTORY: 'bv_inventory',
        CREATED_GAMES: 'bv_created_games',
        SETTINGS: 'bv_settings',
        BLOCK_SAVES_PREFIX: 'bv_save_',
    },

    // Message Types (Network)
    MSG: {
        // Server/World
        WORLD_STATE: 'world_state',
        BLOCK_PLACE: 'block_place',
        BLOCK_REMOVE: 'block_remove',
        PLAYER_JOIN: 'player_join',
        PLAYER_LEAVE: 'player_leave',
        PLAYER_POSITION: 'player_pos',
        PLAYER_CHAT: 'player_chat',
        PLAYER_ANIMATION: 'player_anim',

        // Lobby
        LOBBY_INFO: 'lobby_info',
        LOBBY_LIST_SERVERS: 'lobby_list_servers',
        LOBBY_CREATE_SERVER: 'lobby_create_server',
        LOBBY_JOIN_SERVER: 'lobby_join_server',
        LOBBY_LEAVE_SERVER: 'lobby_leave_server',

        // Friends
        FRIEND_STATUS: 'friend_status',
        FRIEND_REQUEST: 'friend_request',
        FRIEND_ACCEPT: 'friend_accept',
        FRIEND_DECLINE: 'friend_decline',
        FRIEND_REMOVE: 'friend_remove',
        FRIEND_INVITE: 'friend_invite',
        FRIEND_WHOAMI: 'friend_whoami',

        // Game
        GAME_SETTINGS: 'game_settings',
        GAME_TOOLS: 'game_tools',
        GAME_PERMISSIONS: 'game_permissions',

        // Host Migration
        HOST_TRANSFER: 'host_transfer',
        HOST_CONFIRM: 'host_confirm',

        // Identity
        IDENTITY_PING: 'identity_ping',
        IDENTITY_PONG: 'identity_pong',
        IDENTITY_GAME_INFO: 'identity_game_info',
    },
};

// Utility functions
const Utils = {
    generateCode: (prefix = 'BV', length = 4) => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return `${prefix}-${code}`;
    },

    generateId: () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36),

    hashPassword: async (password) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + 'blockverse_salt_2024');
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    clamp: (val, min, max) => Math.min(Math.max(val, min), max),

    lerp: (a, b, t) => a + (b - a) * t,

    formatTime: (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    },

    debounce: (fn, delay) => {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    },

    showToast: (message, type = 'info', duration = 3000) => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },
};
