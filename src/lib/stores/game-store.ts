'use client';

import { create } from 'zustand';
import type { GameData } from '@/lib/constants';

export type Screen = 'auth' | 'lobby' | 'game' | 'creator' | 'community';
export type LobbySection = 'home' | 'games' | 'avatar' | 'friends' | 'create' | 'settings' | 'inventory' | 'servers';

interface GameState {
  currentScreen: Screen;
  lobbySection: LobbySection;
  currentGame: GameData | null;
  games: GameData[];
  gamesLoading: boolean;
  gameCategory: string;
  gameSearch: string;
  isInGame: boolean;
  isPaused: boolean;
  currentTool: string;
  currentBlockType: string;
  toolbarSlots: string[];
  activeSlot: number;
  chatMessages: ChatMessage[];
  chatVisible: boolean;
  onlinePlayers: OnlinePlayer[];
  showGameMenu: boolean;
  blockCount: number;

  // Actions
  setScreen: (screen: Screen) => void;
  setLobbySection: (section: LobbySection) => void;
  setCurrentGame: (game: GameData | null) => void;
  setGames: (games: GameData[]) => void;
  setGamesLoading: (loading: boolean) => void;
  setGameCategory: (category: string) => void;
  setGameSearch: (search: string) => void;
  setIsInGame: (inGame: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  setCurrentTool: (tool: string) => void;
  setCurrentBlockType: (type: string) => void;
  setActiveSlot: (slot: number) => void;
  setToolbarSlots: (slots: string[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  setChatVisible: (visible: boolean) => void;
  setOnlinePlayers: (players: OnlinePlayer[]) => void;
  setShowGameMenu: (show: boolean) => void;
  setBlockCount: (count: number) => void;
  fetchGames: () => Promise<void>;
  createGame: (data: { name: string; description?: string; category?: string; template?: string; maxPlayers?: number }) => Promise<GameData | null>;
  joinGame: (gameId: string) => Promise<void>;
  leaveGame: () => void;
}

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  type: 'chat' | 'system' | 'action';
}

export interface OnlinePlayer {
  id: string;
  username: string;
  position?: { x: number; y: number; z: number };
  isHost?: boolean;
}

export const useGameStore = create<GameState>((set, get) => ({
  currentScreen: 'auth',
  lobbySection: 'home',
  currentGame: null,
  games: [],
  gamesLoading: false,
  gameCategory: 'all',
  gameSearch: '',
  isInGame: false,
  isPaused: false,
  currentTool: 'build',
  currentBlockType: 'grass',
  toolbarSlots: ['grass', 'stone', 'dirt', 'wood', 'brick', 'sand', 'plank', 'cobble', 'glass'],
  activeSlot: 0,
  chatMessages: [],
  chatVisible: false,
  onlinePlayers: [],
  showGameMenu: false,
  blockCount: 0,

  setScreen: (screen) => set({ currentScreen: screen }),
  setLobbySection: (section) => set({ lobbySection: section }),
  setCurrentGame: (game) => set({ currentGame: game }),
  setGames: (games) => set({ games }),
  setGamesLoading: (loading) => set({ gamesLoading: loading }),
  setGameCategory: (category) => set({ gameCategory: category }),
  setGameSearch: (search) => set({ gameSearch: search }),
  setIsInGame: (inGame) => set({ isInGame: inGame }),
  setIsPaused: (paused) => set({ isPaused: paused }),
  setCurrentTool: (tool) => set({ currentTool: tool }),
  setCurrentBlockType: (type) => set({ currentBlockType: type }),
  setActiveSlot: (slot) => set({ activeSlot: slot }),
  setToolbarSlots: (slots) => set({ toolbarSlots: slots }),
  addChatMessage: (message) => set((state) => ({
    chatMessages: [...state.chatMessages.slice(-99), message],
  })),
  setChatVisible: (visible) => set({ chatVisible: visible }),
  setOnlinePlayers: (players) => set({ onlinePlayers: players }),
  setShowGameMenu: (show) => set({ showGameMenu: show }),
  setBlockCount: (count) => set({ blockCount: count }),

  fetchGames: async () => {
    set({ gamesLoading: true });
    try {
      const { gameCategory, gameSearch } = get();
      const params = new URLSearchParams();
      if (gameCategory !== 'all') params.set('category', gameCategory);
      if (gameSearch) params.set('search', gameSearch);
      const res = await fetch(`/api/games?${params}`);
      const data = await res.json();
      set({ games: data.games || [], gamesLoading: false });
    } catch {
      set({ gamesLoading: false });
    }
  },

  createGame: async (data) => {
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.ok && result.game) {
        set((state) => ({ games: [result.game, ...state.games] }));
        return result.game;
      }
      return null;
    } catch {
      return null;
    }
  },

  joinGame: async (gameId: string) => {
    try {
      await fetch(`/api/games/${gameId}/join`, { method: 'POST' });
    } catch {
      // Silent fail for join tracking
    }
  },

  leaveGame: () => {
    set({
      currentGame: null,
      isInGame: false,
      isPaused: false,
      showGameMenu: false,
      chatMessages: [],
      chatVisible: false,
      onlinePlayers: [],
      blockCount: 0,
    });
  },
}));
