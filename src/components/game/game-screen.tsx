'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useGameStore, type ChatMessage } from '@/lib/stores/game-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { BV, blockKey } from '@/lib/constants';
import { ThreeScene } from '@/lib/game/three-scene';
import { PlayerController } from '@/lib/game/player';
import { ToolsEngine } from '@/lib/game/tools';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft, MessageSquare, Users, Crosshair, Hammer, Trash2,
  Paintbrush, Hand, ChevronUp, Pause, Home, RotateCcw, Volume2, VolumeX
} from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';

export function GameScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ThreeScene | null>(null);
  const playerRef = useRef<PlayerController | null>(null);
  const toolsRef = useRef<ToolsEngine | null>(null);
  const animFrameRef = useRef<number>(0);
  const socketRef = useRef<Socket | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const { currentGame, setScreen, leaveGame, showGameMenu, setShowGameMenu, isPaused, setIsPaused,
    currentTool, setCurrentTool, currentBlockType, setCurrentBlockType, activeSlot, setActiveSlot,
    toolbarSlots, blockCount, setBlockCount, chatMessages, addChatMessage, chatVisible, setChatVisible,
    onlinePlayers, setOnlinePlayers } = useGameStore();
  const { user } = useAuthStore();

  const [chatInput, setChatInput] = useState('');
  const [isChatFocused, setIsChatFocused] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [showPaintPicker, setShowPaintPicker] = useState(false);
  const [paintColor, setPaintColor] = useState('#4CAF50');

  // Initialize game
  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new ThreeScene(canvasRef.current);
    sceneRef.current = scene;

    const player = new PlayerController(scene.camera, canvasRef.current, scene.scene);
    playerRef.current = player;

    // Set avatar color from user profile
    if (user?.avatar) {
      try {
        const avatarData = JSON.parse(user.avatar);
        if (avatarData.bodyColor) player.setBodyColor(avatarData.bodyColor);
      } catch { /* ignore */ }
    }

    player.init();

    const tools = new ToolsEngine(scene, player, canvasRef.current);
    toolsRef.current = tools;
    tools.init();

    tools.onToolAction = (action, data) => {
      if (socketRef.current) {
        if (action === 'place') {
          socketRef.current.emit('block_place', data);
        } else if (action === 'remove') {
          socketRef.current.emit('block_remove', data);
        }
      }
      setBlockCount(scene.blockCount);
    };

    scene.onBlockPlace = (x, y, z, type) => {
      setBlockCount(scene.blockCount);
    };
    scene.onBlockRemove = (x, y, z) => {
      setBlockCount(scene.blockCount);
    };

    // Generate terrain from game template
    if (currentGame?.template) {
      scene.generateTerrain(currentGame.template);
      setBlockCount(scene.blockCount);
    } else if (currentGame?.worldData) {
      try {
        const blocks = JSON.parse(currentGame.worldData);
        scene.loadBlocksSnapshot(blocks);
        setBlockCount(scene.blockCount);
      } catch { scene.generateTerrain('flat'); }
    } else {
      scene.generateTerrain('flat');
      setBlockCount(scene.blockCount);
    }

    // Game loop
    const clock = new THREE.Clock();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      player.update(dt, scene.blockMap);
      tools.updateHighlight();
      scene.update(dt);
      scene.render();
    };
    animate();

    // Connect to game server
    try {
      const socket = io('/?XTransformPort=3001', { transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('connect', () => {
        if (currentGame?.code) {
          socket.emit('host', {
            gameCode: currentGame.code,
            name: currentGame.name,
            category: currentGame.category,
            maxPlayers: currentGame.maxPlayers,
            username: user?.username || 'Player',
          });
        }
        addChatMessage({
          id: 'system-1',
          username: 'System',
          message: 'Connected to game server',
          timestamp: Date.now(),
          type: 'system',
        });
      });

      socket.on('player_join', (data: { id: string; username: string }) => {
        addChatMessage({
          id: `join-${data.id}`,
          username: 'System',
          message: `${data.username} joined the game`,
          timestamp: Date.now(),
          type: 'system',
        });
      });

      socket.on('player_leave', (data: { id: string }) => {
        addChatMessage({
          id: `leave-${data.id}`,
          username: 'System',
          message: 'A player left the game',
          timestamp: Date.now(),
          type: 'system',
        });
      });

      socket.on('chat', (data: { username: string; message: string }) => {
        addChatMessage({
          id: `chat-${Date.now()}`,
          username: data.username,
          message: data.message,
          timestamp: Date.now(),
          type: 'chat',
        });
      });

      socket.on('block_place', (data: { x: number; y: number; z: number; type: string }) => {
        scene.addBlock(data.x, data.y, data.z, data.type, false);
        setBlockCount(scene.blockCount);
      });

      socket.on('block_remove', (data: { x: number; y: number; z: number }) => {
        scene.removeBlock(data.x, data.y, data.z, false);
        setBlockCount(scene.blockCount);
      });
    } catch (err) {
      console.warn('Could not connect to game server:', err);
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      tools.destroy();
      player.destroy();
      scene.dispose();
      socketRef.current?.disconnect();
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isChatFocused) return;

      if (e.code === 'Escape') {
        e.preventDefault();
        setShowGameMenu(!showGameMenu);
        setIsPaused(!isPaused);
      }

      if (e.code === 'Enter' && !isChatFocused) {
        e.preventDefault();
        setChatVisible(true);
        setTimeout(() => chatInputRef.current?.focus(), 100);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showGameMenu, isChatFocused, setChatVisible, setShowGameMenu, setIsPaused]);

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    if (socketRef.current) {
      socketRef.current.emit('chat', { message: chatInput });
    }
    addChatMessage({
      id: `me-${Date.now()}`,
      username: user?.username || 'You',
      message: chatInput,
      timestamp: Date.now(),
      type: 'chat',
    });
    setChatInput('');
    setChatVisible(false);
  }, [chatInput, addChatMessage, user, setChatVisible]);

  const handleLeaveGame = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    leaveGame();
    setScreen('lobby');
  }, [leaveGame, setScreen]);

  const toolButtons = [
    { id: 'build', icon: <Hammer className="w-4 h-4" />, label: 'Build (B)', color: '#4CAF50' },
    { id: 'delete', icon: <Trash2 className="w-4 h-4" />, label: 'Delete (X)', color: '#E74C3C' },
    { id: 'paint', icon: <Paintbrush className="w-4 h-4" />, label: 'Paint (P)', color: '#6c5ce7' },
    { id: 'grab', icon: <Hand className="w-4 h-4" />, label: 'Grab (G)', color: '#FFC107' },
  ];

  return (
    <div className="game-canvas-container">
      <canvas ref={canvasRef} />

      {/* Crosshair */}
      {!isPaused && <div className="crosshair" />}

      {/* HUD - Top Bar */}
      {!isPaused && (
        <div className="game-hud">
          <div className="flex items-center justify-between p-3">
            <div className="glass-card px-4 py-2 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="text-white h-8 w-8"
                onClick={() => { setShowGameMenu(true); setIsPaused(true); }}
              >
                <Pause className="w-4 h-4" />
              </Button>
              <div>
                <div className="text-white font-semibold text-sm">{currentGame?.name || 'BlockVerse'}</div>
                <div className="text-[#a0a0b0] text-xs">{blockCount} blocks • {onlinePlayers.length + 1} players</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChatVisible(!chatVisible)}
                className="glass-card px-3 py-2 text-white hover:bg-[#2d2d44] transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar - Bottom */}
      {!isPaused && (
        <div className="game-toolbar">
          <div className="glass-card p-2 flex items-center gap-2">
            {/* Tool buttons */}
            {toolButtons.map((tool) => (
              <button
                key={tool.id}
                onClick={() => {
                  setCurrentTool(tool.id);
                  toolsRef.current?.setTool(tool.id);
                }}
                className={`toolbar-slot ${currentTool === tool.id ? 'active' : ''}`}
                style={currentTool === tool.id ? { borderColor: tool.color, background: tool.color + '30' } : {}}
                title={tool.label}
              >
                {tool.icon}
              </button>
            ))}

            <div className="w-px h-8 bg-[#2d2d44] mx-1" />

            {/* Block slots */}
            {toolbarSlots.map((type, idx) => {
              const config = BV.BLOCK_TYPES[type];
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveSlot(idx);
                    setCurrentBlockType(type);
                    toolsRef.current?.setToolbarSlot(idx);
                  }}
                  className={`toolbar-slot ${activeSlot === idx ? 'active' : ''}`}
                  title={`${config?.name || type} (${idx + 1})`}
                >
                  <div
                    className="w-6 h-6 rounded"
                    style={{
                      backgroundColor: config?.color || '#666',
                      opacity: config?.transparent ? (config.opacity || 0.5) : 1,
                    }}
                  />
                </button>
              );
            })}

            {/* Expand button */}
            <button
              onClick={() => setShowBlockPicker(!showBlockPicker)}
              className="toolbar-slot text-white/60"
              title="More blocks"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Block picker popup */}
      {showBlockPicker && !isPaused && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[62] glass-card p-3 max-w-md">
          <div className="grid grid-cols-6 gap-2">
            {Object.entries(BV.BLOCK_TYPES).map(([type, config]) => (
              <button
                key={type}
                onClick={() => {
                  setCurrentBlockType(type);
                  toolsRef.current?.setBlockType(type);
                  setShowBlockPicker(false);
                }}
                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-[#2d2d44] transition-colors"
                title={config.name}
              >
                <div
                  className="w-8 h-8 rounded-md"
                  style={{
                    backgroundColor: config.color,
                    opacity: config.transparent ? (config.opacity || 0.5) : 1,
                  }}
                />
                <span className="text-[10px] text-[#a0a0b0]">{config.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paint color picker */}
      {currentTool === 'paint' && !isPaused && (
        <div className="fixed bottom-24 right-4 z-[62] glass-card p-3">
          <div className="text-xs text-[#a0a0b0] mb-2">Paint Color</div>
          <div className="grid grid-cols-5 gap-1.5">
            {[
              '#4CAF50', '#66BB6A', '#2E7D32', '#E74C3C', '#C0392B',
              '#FF5722', '#2196F3', '#1A237E', '#00BCD4', '#FFD700',
              '#FF9800', '#FFC107', '#9C27B0', '#673AB7', '#E91E63',
              '#9E9E9E', '#607D8B', '#000000', '#FFFFFF', '#795548',
            ].map((color) => (
              <button
                key={color}
                className={`w-7 h-7 rounded-md border-2 ${paintColor === color ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
                onClick={() => {
                  setPaintColor(color);
                  toolsRef.current?.setPaintColor(color);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Chat */}
      {chatVisible && !isPaused && (
        <div className="game-chat">
          <div className="glass-card rounded-xl overflow-hidden">
            <ScrollArea className="h-48 p-3 custom-scrollbar">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`mb-1 ${msg.type === 'system' ? 'text-[#6c5ce7] text-xs italic' : ''}`}>
                  {msg.type !== 'system' && (
                    <span className="text-[#6c5ce7] font-semibold text-sm mr-1">{msg.username}:</span>
                  )}
                  <span className={msg.type === 'system' ? '' : 'text-white text-sm'}>{msg.message}</span>
                </div>
              ))}
            </ScrollArea>
            <div className="p-2 border-t border-[#2d2d44]">
              <Input
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendChat();
                  if (e.key === 'Escape') { setChatVisible(false); setChatInput(''); }
                }}
                onFocus={() => setIsChatFocused(true)}
                onBlur={() => setIsChatFocused(false)}
                placeholder="Type a message..."
                className="bg-[#0a0a1a] border-[#2d2d44] text-white h-8 text-sm"
                maxLength={200}
              />
            </div>
          </div>
        </div>
      )}

      {/* Pause Menu */}
      {showGameMenu && isPaused && (
        <div className="game-menu-overlay" onClick={() => { setShowGameMenu(false); setIsPaused(false); }}>
          <div className="glass-card p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4 text-center">Game Paused</h2>
            <div className="space-y-2">
              <Button
                className="w-full bg-[#6c5ce7] hover:bg-[#5b4bd6] text-white"
                onClick={() => { setShowGameMenu(false); setIsPaused(false); }}
              >
                Resume
              </Button>
              <Button
                variant="ghost"
                className="w-full text-[#a0a0b0] hover:text-white hover:bg-[#2d2d44]"
                onClick={() => {
                  if (playerRef.current) playerRef.current.setPosition(0, 5, 0);
                  setShowGameMenu(false);
                  setIsPaused(false);
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Respawn
              </Button>
              <Button
                variant="ghost"
                className="w-full text-[#a0a0b0] hover:text-white hover:bg-[#2d2d44]"
                onClick={() => { setShowGameMenu(false); setIsPaused(false); }}
              >
                <Home className="w-4 h-4 mr-2" /> Settings
              </Button>
              <div className="border-t border-[#2d2d44] pt-2 mt-2">
                <Button
                  variant="ghost"
                  className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={handleLeaveGame}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Leave Game
                </Button>
              </div>
            </div>

            {/* Player list */}
            <div className="mt-4 pt-4 border-t border-[#2d2d44]">
              <div className="text-xs text-[#a0a0b0] mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" /> Players ({onlinePlayers.length + 1})
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-2 text-sm text-white py-1">
                  <div className="w-5 h-5 rounded bg-[#6c5ce7] flex items-center justify-center text-xs font-bold">
                    {user?.username?.charAt(0).toUpperCase()}
                  </div>
                  {user?.username} (You)
                </div>
                {onlinePlayers.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm text-[#a0a0b0] py-1">
                    <div className="w-5 h-5 rounded bg-[#2d2d44] flex items-center justify-center text-xs">
                      {p.username.charAt(0).toUpperCase()}
                    </div>
                    {p.username}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
