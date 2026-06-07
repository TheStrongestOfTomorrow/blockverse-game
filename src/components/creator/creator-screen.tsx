'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/stores/game-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { BV } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft, Hammer, Trash2, Paintbrush, Hand, MousePointer,
  Move, RotateCcw, Maximize, Code, TreePine, Save, Play,
  Layers, Settings, Package
} from 'lucide-react';
import { toast } from 'sonner';

export function CreatorScreen() {
  const { setScreen, setCurrentGame, createGame } = useGameStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('build');
  const [scriptContent, setScriptContent] = useState('-- BlockVerse Script Editor\n-- Write Luau-style scripts here\n-- Luau is the scripting language used in BlockVerse (similar to Roblox Luau)\n\nfunction onPlayerJoin(player)\n  print("Welcome, " .. player.name)\nend\n');
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);

  const buildTools = [
    { id: 'build', icon: <Hammer className="w-4 h-4" />, label: 'Build' },
    { id: 'delete', icon: <Trash2 className="w-4 h-4" />, label: 'Delete' },
    { id: 'paint', icon: <Paintbrush className="w-4 h-4" />, label: 'Paint' },
    { id: 'grab', icon: <Hand className="w-4 h-4" />, label: 'Grab' },
    { id: 'select', icon: <MousePointer className="w-4 h-4" />, label: 'Select' },
    { id: 'move', icon: <Move className="w-4 h-4" />, label: 'Move' },
    { id: 'rotate', icon: <RotateCcw className="w-4 h-4" />, label: 'Rotate' },
    { id: 'scale', icon: <Maximize className="w-4 h-4" />, label: 'Scale' },
  ];

  const handlePlayTest = async () => {
    // Play Test: Initialize the 3D world and enter game mode
    // This bridges the Creator Studio to the actual game engine
    try {
      const canvas = document.getElementById('creator-canvas') as HTMLCanvasElement;
      if (typeof World !== 'undefined' && canvas) {
        // Initialize the world with the canvas
        if (!World.scene) {
          World.init(canvas);
        }
        // Generate flat terrain for testing
        World.generateTerrain('flat');
        // Enter game mode
        if (typeof App !== 'undefined') {
          App.enterGame();
        }
        toast.success('Play test started! Press ESC to return.');
      } else {
        // Fallback: create game through store and switch to game screen
        const game = await createGame({
          name: 'Play Test',
          description: 'Creator Studio play test',
          category: 'sandbox',
          template: 'flat',
        });
        if (game) {
          setCurrentGame(game);
          setScreen('game');
        }
      }
    } catch (err) {
      console.error('[Creator] Play test failed:', err);
      toast.error('Failed to start play test. Try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-3 border-b border-[#2d2d44] bg-[#0d0d1f]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white" onClick={() => setScreen('lobby')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-white">Creator Studio</h1>
          <span className="text-xs text-[#6c5ce7] bg-[#6c5ce7]/20 px-2 py-0.5 rounded">Beta</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="text-[#a0a0b0]" onClick={() => toast.success('Project saved!')}>
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
          <Button className="bg-[#00b894] hover:bg-[#00a381] text-white" onClick={handlePlayTest}>
            <Play className="w-4 h-4 mr-2" /> Play Test
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Tools & Hierarchy */}
        <div className="w-64 border-r border-[#2d2d44] bg-[#0d0d1f] flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-[#0a0a1a] rounded-none border-b border-[#2d2d44]">
              <TabsTrigger value="build" className="flex-1 text-xs data-[state=active]:bg-[#6c5ce7]">Tools</TabsTrigger>
              <TabsTrigger value="hierarchy" className="flex-1 text-xs data-[state=active]:bg-[#6c5ce7]">Objects</TabsTrigger>
              <TabsTrigger value="script" className="flex-1 text-xs data-[state=active]:bg-[#6c5ce7]">Script</TabsTrigger>
            </TabsList>

            <TabsContent value="build" className="p-3 m-0">
              <div className="space-y-3">
                <Label className="text-[#a0a0b0] text-xs">Build Tools</Label>
                <div className="grid grid-cols-2 gap-2">
                  {buildTools.map((tool) => (
                    <button
                      key={tool.id}
                      className="flex items-center gap-2 p-2 rounded-lg text-xs text-[#a0a0b0] hover:bg-[#2d2d44] hover:text-white transition-colors"
                      onClick={() => toast.info(`${tool.label} tool selected`)}
                    >
                      {tool.icon}
                      {tool.label}
                    </button>
                  ))}
                </div>

                <Label className="text-[#a0a0b0] text-xs">Block Palette</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {Object.entries(BV.BLOCK_TYPES).map(([type, config]) => (
                    <button
                      key={type}
                      className={`w-10 h-10 rounded-md border-2 ${selectedBlock === type ? 'border-white' : 'border-transparent'} hover:border-[#6c5ce7] transition-colors`}
                      style={{
                        backgroundColor: config.color,
                        opacity: config.transparent ? (config.opacity || 0.5) : 1,
                      }}
                      onClick={() => setSelectedBlock(type)}
                      title={config.name}
                    />
                  ))}
                </div>

                <Label className="text-[#a0a0b0] text-xs">Templates</Label>
                <div className="space-y-1">
                  {BV.TEMPLATES.slice(0, 5).map((t) => (
                    <button
                      key={t.id}
                      className="w-full flex items-center gap-2 p-2 rounded-lg text-xs text-[#a0a0b0] hover:bg-[#2d2d44] hover:text-white transition-colors"
                      onClick={() => toast.info(`Template: ${t.name}`)}
                    >
                      <span>{t.icon}</span>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="hierarchy" className="m-0">
              <ScrollArea className="h-full p-3">
                <Label className="text-[#a0a0b0] text-xs mb-2 block">Scene Hierarchy</Label>
                <div className="space-y-1">
                  {['Terrain', 'SpawnPoint', 'Lighting', 'Camera', 'Skybox'].map((item) => (
                    <div key={item} className="flex items-center gap-2 p-1.5 rounded text-xs text-[#a0a0b0] hover:bg-[#2d2d44] cursor-pointer">
                      <Layers className="w-3 h-3" />
                      {item}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="script" className="m-0">
              <div className="p-3">
                <Label className="text-[#a0a0b0] text-xs mb-2 block">Script Editor</Label>
                <textarea
                  value={scriptContent}
                  onChange={(e) => setScriptContent(e.target.value)}
                  className="w-full h-64 bg-[#0a0a1a] border border-[#2d2d44] rounded-lg p-3 text-xs text-[#a0f0a0] font-mono resize-none focus:border-[#6c5ce7] focus:outline-none"
                  spellCheck={false}
                />
                <Button
                  size="sm"
                  className="mt-2 w-full bg-[#6c5ce7] hover:bg-[#5b4bd6] text-white text-xs"
                  onClick={() => toast.info('Script execution not available in browser preview')}
                >
                  <Code className="w-3 h-3 mr-1" /> Run Script
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Main viewport - 3D Canvas */}
        <div className="flex-1 bg-[#1a1a2e] relative" id="creator-viewport">
          <canvas id="creator-canvas" className="w-full h-full" />
          {/* Viewport overlay controls */}
          <div className="absolute top-2 right-2 flex gap-1">
            <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-[#2d2d44] h-8 w-8" onClick={() => {
              if (typeof World !== 'undefined') World.onResize?.();
            }}>
              <Maximize className="w-3 h-3" />
            </Button>
          </div>
          {/* Viewport info */}
          <div className="absolute bottom-2 left-2 text-[#666] text-xs">
            {selectedBlock ? `Selected: ${BV.BLOCK_TYPES[selectedBlock]?.name || selectedBlock}` : 'Select a block to place'}
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-64 border-l border-[#2d2d44] bg-[#0d0d1f] p-3">
          <Label className="text-[#a0a0b0] text-xs mb-3 block">Properties</Label>
          {selectedBlock ? (
            <div className="space-y-3">
              <div>
                <Label className="text-[#666] text-xs">Block Type</Label>
                <div className="text-white text-sm">{BV.BLOCK_TYPES[selectedBlock]?.name}</div>
              </div>
              <div>
                <Label className="text-[#666] text-xs">Color</Label>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: BV.BLOCK_TYPES[selectedBlock]?.color }} />
                  <span className="text-white text-xs">{BV.BLOCK_TYPES[selectedBlock]?.color}</span>
                </div>
              </div>
              <div>
                <Label className="text-[#666] text-xs">Position</Label>
                <div className="grid grid-cols-3 gap-1">
                  <Input className="bg-[#0a0a1a] border-[#2d2d44] text-white text-xs h-7" placeholder="X" />
                  <Input className="bg-[#0a0a1a] border-[#2d2d44] text-white text-xs h-7" placeholder="Y" />
                  <Input className="bg-[#0a0a1a] border-[#2d2d44] text-white text-xs h-7" placeholder="Z" />
                </div>
              </div>
              <div>
                <Label className="text-[#666] text-xs">Rotation</Label>
                <Input className="bg-[#0a0a1a] border-[#2d2d44] text-white text-xs h-7" placeholder="0" />
              </div>
              <div>
                <Label className="text-[#666] text-xs">Scale</Label>
                <Input className="bg-[#0a0a1a] border-[#2d2d44] text-white text-xs h-7" placeholder="1" />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-[#666] text-xs">Collidable</Label>
                <div className="w-8 h-4 rounded-full bg-[#6c5ce7]" />
              </div>
            </div>
          ) : (
            <p className="text-[#666] text-xs">Select a block to view its properties</p>
          )}
        </div>
      </div>
    </div>
  );
}
