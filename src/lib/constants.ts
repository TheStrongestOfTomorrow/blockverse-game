// BlockVerse Configuration & Constants

export const BV = {
  VERSION: '2.0.0',
  NAME: 'BlockVerse',

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
    grass: { name: 'Grass', color: '#4CAF50', topColor: '#66BB6A', sideColor: '#795548', bottomColor: '#795548' },
    stone: { name: 'Stone', color: '#9E9E9E', castShadow: true },
    dirt: { name: 'Dirt', color: '#795548' },
    wood: { name: 'Wood', color: '#8D6E63' },
    brick: { name: 'Brick', color: '#E74C3C' },
    sand: { name: 'Sand', color: '#F5DEB3' },
    water: { name: 'Water', color: '#2196F3', transparent: true, opacity: 0.6 },
    lava: { name: 'Lava', color: '#FF5722', emissive: '#FF3D00' },
    glass: { name: 'Glass', color: '#E0F7FA', transparent: true, opacity: 0.3 },
    gold: { name: 'Gold', color: '#FFD700', emissive: '#FFA000' },
    diamond: { name: 'Diamond', color: '#00BCD4', emissive: '#0097A7' },
    obsidian: { name: 'Obsidian', color: '#1a1a2e', emissive: '#2d2d44' },
    snow: { name: 'Snow', color: '#FAFAFA' },
    ice: { name: 'Ice', color: '#B3E5FC', transparent: true, opacity: 0.5 },
    leaf: { name: 'Leaves', color: '#2E7D32', transparent: true, opacity: 0.8 },
    plank: { name: 'Planks', color: '#D7CCC8' },
    cobble: { name: 'Cobble', color: '#757575' },
    iron: { name: 'Iron', color: '#BDBDBD', castShadow: true },
  } as Record<string, BlockTypeConfig>,

  // Default Toolbar
  DEFAULT_TOOLBAR: ['grass', 'stone', 'dirt', 'wood', 'brick', 'sand', 'plank', 'cobble', 'glass'],

  // Avatar Parts
  AVATAR_PARTS: {
    head: ['default', 'round', 'square', 'pointy', 'cylindrical', 'flat'],
    body: ['default', 'slim', 'wide', 'tall', 'blocky', 'curved'],
    arms: ['default', 'short', 'long', 'thick', 'mechanical', 'ghostly'],
    legs: ['default', 'short', 'long', 'hover', 'quad'],
    accessory: ['none', 'hat', 'crown', 'wings', 'cape', 'horns', 'halo', 'scarf', 'aura'],
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

  // Templates
  TEMPLATES: [
    { id: 'flat', name: 'Flat World', icon: '🏔️', description: 'A flat grassy plain' },
    { id: 'hills', name: 'Rolling Hills', icon: '⛰️', description: 'Gentle hills with trees' },
    { id: 'obby', name: 'Obby Course', icon: '🏃', description: 'Parkour obstacle course' },
    { id: 'city', name: 'City', icon: '🏙️', description: 'Urban skyline' },
    { id: 'arena', name: 'Battle Arena', icon: '⚔️', description: 'PvP combat arena' },
    { id: 'island', name: 'Island', icon: '🏝️', description: 'Tropical island' },
    { id: 'village', name: 'Village', icon: '🏘️', description: 'Cozy village' },
    { id: 'castle', name: 'Castle', icon: '🏰', description: 'Medieval fortress' },
    { id: 'pirate', name: 'Pirate Ship', icon: '🏴‍☠️', description: 'Seafaring adventure' },
  ],

  // ICE Servers (STUN only — no hardcoded TURN)
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
} as const;

export interface BlockTypeConfig {
  name: string;
  color: string;
  topColor?: string;
  sideColor?: string;
  bottomColor?: string;
  transparent?: boolean;
  opacity?: number;
  emissive?: string;
  castShadow?: boolean;
}

export interface BlockData {
  x: number;
  y: number;
  z: number;
  type: string;
  customColor?: string;
}

export interface UserData {
  id: string;
  username: string;
  avatar: string;
  createdAt: string;
  lastSeen: string;
  settings: string;
}

export interface GameData {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;
  creatorId: string;
  maxPlayers: number;
  template: string;
  thumbnailColor: string;
  worldData: string;
  visits: number;
  activePlayers: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  creator?: { username: string };
}

// Utility functions
export function blockKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function isOpaque(type: string): boolean {
  const config = BV.BLOCK_TYPES[type];
  return config ? !config.transparent : true;
}

export const Utils = {
  generateCode: (prefix = 'BV', length = 4): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return `${prefix}-${code}`;
  },

  clamp: (val: number, min: number, max: number): number =>
    Math.min(Math.max(val, min), max),

  lerp: (a: number, b: number, t: number): number =>
    a + (b - a) * t,

  formatTime: (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  },

  formatNumber: (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  },

  debounce: <T extends (...args: unknown[]) => void>(fn: T, delay: number) => {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },
};
