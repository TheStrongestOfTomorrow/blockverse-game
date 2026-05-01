'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useGameStore, type LobbySection } from '@/lib/stores/game-store';
import { BV, Utils } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Home, Gamepad2, Users, Settings, Palette, Plus, LogOut, Search,
  Play, Crown, Eye, ChevronRight, Menu, X, Sparkles, Server, Wrench
} from 'lucide-react';
import { toast } from 'sonner';

const NAV_ITEMS: { id: LobbySection; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
  { id: 'games', label: 'Discover', icon: <Gamepad2 className="w-5 h-5" /> },
  { id: 'create', label: 'Create', icon: <Plus className="w-5 h-5" /> },
  { id: 'friends', label: 'Friends', icon: <Users className="w-5 h-5" /> },
  { id: 'avatar', label: 'Avatar', icon: <Palette className="w-5 h-5" /> },
  { id: 'servers', label: 'Servers', icon: <Server className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

export function LobbyScreen() {
  const { user, logout } = useAuthStore();
  const {
    lobbySection, setLobbySection, setScreen,
    games, fetchGames, gamesLoading, gameCategory, setGameCategory,
    gameSearch, setGameSearch, createGame, setCurrentGame, joinGame,
  } = useGameStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [newGameDesc, setNewGameDesc] = useState('');
  const [newGameCategory, setNewGameCategory] = useState('sandbox');
  const [newGameTemplate, setNewGameTemplate] = useState('flat');

  useEffect(() => {
    fetchGames();
  }, [gameCategory, fetchGames]);

  const handleCreateGame = async () => {
    if (!newGameName.trim()) {
      toast.error('Game name is required');
      return;
    }
    const game = await createGame({
      name: newGameName,
      description: newGameDesc,
      category: newGameCategory,
      template: newGameTemplate,
    });
    if (game) {
      toast.success(`Game "${game.name}" created!`);
      setCreateDialogOpen(false);
      setNewGameName('');
      setNewGameDesc('');
      fetchGames();
    } else {
      toast.error('Failed to create game');
    }
  };

  const handlePlayGame = async (game: typeof games[0]) => {
    await joinGame(game.id);
    setCurrentGame(game);
    setScreen('game');
    toast.success(`Joining ${game.name}...`);
  };

  const handleLogout = async () => {
    await logout();
  };

  const avatarData = user?.avatar ? (() => { try { return JSON.parse(user.avatar); } catch { return {}; } })() : {};
  const bodyColor = avatarData.bodyColor || '#6c5ce7';

  return (
    <div className="flex min-h-screen bg-[#0a0a1a]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`lobby-sidebar ${sidebarOpen ? 'open' : ''} flex flex-col p-4`}>
        {/* User info */}
        <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-[#1a1a2e]">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: bodyColor }}
          >
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white truncate">{user?.username}</div>
            <div className="text-xs text-[#a0a0b0]">Online</div>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { setLobbySection(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                lobbySection === item.id
                  ? 'bg-[#6c5ce7]/20 text-[#6c5ce7]'
                  : 'text-[#a0a0b0] hover:bg-[#1a1a2e] hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Creator & Community */}
        <div className="space-y-1 pt-2 border-t border-[#2d2d44]">
          <button
            onClick={() => setScreen('creator')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#a0a0b0] hover:bg-[#1a1a2e] hover:text-white transition-all"
          >
            <Wrench className="w-5 h-5" />
            Creator Studio
          </button>
          <button
            onClick={() => setScreen('community')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#a0a0b0] hover:bg-[#1a1a2e] hover:text-white transition-all"
          >
            <Sparkles className="w-5 h-5" />
            Community
          </button>
        </div>

        {/* Logout */}
        <div className="pt-4 border-t border-[#2d2d44]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen overflow-auto">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 p-4 border-b border-[#2d2d44]">
          <Button variant="ghost" size="icon" className="text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg gradient-text">BlockVerse</h1>
        </div>

        <div className="p-4 md:p-6 max-w-6xl mx-auto">
          {/* Home Section */}
          {lobbySection === 'home' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Welcome back, {user?.username}! 👋</h2>
                <p className="text-[#a0a0b0] mt-1">Ready to build something amazing?</p>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Play Now', icon: <Play className="w-6 h-6" />, color: '#6c5ce7', action: () => setLobbySection('games') },
                  { label: 'Create Game', icon: <Plus className="w-6 h-6" />, color: '#00b894', action: () => setCreateDialogOpen(true) },
                  { label: 'Friends', icon: <Users className="w-6 h-6" />, color: '#e91e63', action: () => setLobbySection('friends') },
                  { label: 'Avatar', icon: <Palette className="w-6 h-6" />, color: '#ff9800', action: () => setLobbySection('avatar') },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={action.action}
                    className="glass-card p-4 text-center hover:scale-105 transition-transform"
                  >
                    <div className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: action.color + '30' }}>
                      <div style={{ color: action.color }}>{action.icon}</div>
                    </div>
                    <div className="text-sm font-medium text-white">{action.label}</div>
                  </button>
                ))}
              </div>

              {/* Featured games */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">Popular Games</h3>
                  <button onClick={() => setLobbySection('games')} className="text-[#6c5ce7] text-sm flex items-center gap-1 hover:underline">
                    See all <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {games.slice(0, 6).map((game) => (
                    <GameCard key={game.id} game={game} onPlay={handlePlayGame} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Games/Discover Section */}
          {lobbySection === 'games' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">Discover Games</h2>

              {/* Search & filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                  <Input
                    placeholder="Search games..."
                    value={gameSearch}
                    onChange={(e) => setGameSearch(e.target.value)}
                    className="pl-10 bg-[#1a1a2e] border-[#2d2d44] text-white"
                  />
                </div>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#6c5ce7] hover:bg-[#5b4bd6]">
                      <Plus className="w-4 h-4 mr-2" /> Create Game
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1a1a2e] border-[#2d2d44] text-white">
                    <DialogHeader>
                      <DialogTitle>Create New Game</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div className="space-y-2">
                        <Label>Game Name</Label>
                        <Input
                          value={newGameName}
                          onChange={(e) => setNewGameName(e.target.value)}
                          placeholder="My awesome game"
                          className="bg-[#0a0a1a] border-[#2d2d44]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={newGameDesc}
                          onChange={(e) => setNewGameDesc(e.target.value)}
                          placeholder="Describe your game..."
                          className="bg-[#0a0a1a] border-[#2d2d44]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Category</Label>
                          <Select value={newGameCategory} onValueChange={setNewGameCategory}>
                            <SelectTrigger className="bg-[#0a0a1a] border-[#2d2d44]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a2e] border-[#2d2d44]">
                              {BV.GAME_CATEGORIES.filter(c => c.id !== 'all').map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Template</Label>
                          <Select value={newGameTemplate} onValueChange={setNewGameTemplate}>
                            <SelectTrigger className="bg-[#0a0a1a] border-[#2d2d44]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a2e] border-[#2d2d44]">
                              {BV.TEMPLATES.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.icon} {t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button onClick={handleCreateGame} className="w-full bg-[#6c5ce7] hover:bg-[#5b4bd6]">
                        Create Game
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Category tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {BV.GAME_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setGameCategory(cat.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      gameCategory === cat.id
                        ? 'bg-[#6c5ce7] text-white'
                        : 'bg-[#1a1a2e] text-[#a0a0b0] hover:bg-[#2d2d44]'
                    }`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>

              {/* Games grid */}
              {gamesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-48 rounded-xl bg-[#1a1a2e] animate-pulse" />
                  ))}
                </div>
              ) : games.length === 0 ? (
                <div className="text-center py-12">
                  <Gamepad2 className="w-12 h-12 text-[#666] mx-auto mb-3" />
                  <p className="text-[#a0a0b0]">No games found. Be the first to create one!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {games.map((game) => (
                    <GameCard key={game.id} game={game} onPlay={handlePlayGame} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create Section */}
          {lobbySection === 'create' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Create a Game</h2>
              <p className="text-[#a0a0b0]">Choose a template to get started quickly, or create from scratch.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {BV.TEMPLATES.map((template) => (
                  <Card
                    key={template.id}
                    className="glass-card game-card-hover cursor-pointer"
                    onClick={async () => {
                      const game = await createGame({
                        name: `${template.name} Game`,
                        description: template.description,
                        category: 'sandbox',
                        template: template.id,
                      });
                      if (game) {
                        toast.success(`Created "${game.name}"!`);
                        setCurrentGame(game);
                        setScreen('game');
                      }
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="text-3xl mb-2">{template.icon}</div>
                      <h3 className="font-semibold text-white">{template.name}</h3>
                      <p className="text-sm text-[#a0a0b0]">{template.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Friends Section */}
          {lobbySection === 'friends' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">Friends</h2>
              <FriendsPanel />
            </div>
          )}

          {/* Avatar Section */}
          {lobbySection === 'avatar' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">Customize Avatar</h2>
              <AvatarCustomizer />
            </div>
          )}

          {/* Servers Section */}
          {lobbySection === 'servers' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">Active Servers</h2>
              <ServersPanel />
            </div>
          )}

          {/* Settings Section */}
          {lobbySection === 'settings' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">Settings</h2>
              <SettingsPanel />
            </div>
          )}

          {/* Inventory Section */}
          {lobbySection === 'inventory' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">Inventory</h2>
              <p className="text-[#a0a0b0]">Your collected items and accessories will appear here.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Game Card Component
function GameCard({ game, onPlay }: { game: { id: string; name: string; description: string; category: string; thumbnailColor: string; visits: number; activePlayers: number; maxPlayers: number; creator?: { username: string }; code: string }; onPlay: (game: typeof game) => void }) {
  return (
    <Card className="glass-card game-card-hover overflow-hidden border-0">
      {/* Thumbnail */}
      <div
        className="h-28 flex items-center justify-center relative"
        style={{ backgroundColor: game.thumbnailColor || '#6c5ce7' }}
      >
        <Gamepad2 className="w-10 h-10 text-white/40" />
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="bg-black/40 text-white text-xs">
            {game.category}
          </Badge>
        </div>
        <div className="absolute bottom-2 left-2 flex items-center gap-2 text-white/80 text-xs">
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {Utils.formatNumber(game.visits)}</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {game.activePlayers}/{game.maxPlayers}</span>
        </div>
      </div>
      <CardContent className="p-3">
        <h3 className="font-semibold text-white text-sm truncate">{game.name}</h3>
        <p className="text-xs text-[#a0a0b0] mt-0.5">by {game.creator?.username || 'Unknown'}</p>
        <Button
          onClick={() => onPlay(game)}
          className="w-full mt-2 bg-[#6c5ce7] hover:bg-[#5b4bd6] text-white h-8 text-xs"
        >
          <Play className="w-3 h-3 mr-1" /> Play
        </Button>
      </CardContent>
    </Card>
  );
}

// Friends Panel
function FriendsPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string }>>([]);
  const [friends, setFriends] = useState<Array<{ id: string; username: string; avatar: string }>>([]);
  const [requests, setRequests] = useState<Array<{ id: string; from: { id: string; username: string } }>>([]);

  useEffect(() => {
    fetch('/api/friends').then(r => r.json()).then(d => setFriends(d.friends || [])).catch(() => {});
    fetch('/api/friends/requests').then(r => r.json()).then(d => setRequests(d.requests || [])).catch(() => {});
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    try {
      const res = await fetch(`/api/users/search?q=${q}`);
      const data = await res.json();
      setSearchResults(data.users || []);
    } catch { setSearchResults([]); }
  };

  const handleSendRequest = async (toId: string) => {
    try {
      await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toId }),
      });
      toast.success('Friend request sent!');
      setSearchResults([]);
      setSearchQuery('');
    } catch { toast.error('Failed to send request'); }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await fetch(`/api/friends/${requestId}/accept`, { method: 'POST' });
      setRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success('Friend request accepted!');
      // Refresh friends list
      const res = await fetch('/api/friends');
      const data = await res.json();
      setFriends(data.friends || []);
    } catch { toast.error('Failed to accept request'); }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10 bg-[#1a1a2e] border-[#2d2d44] text-white"
        />
      </div>
      {searchResults.length > 0 && (
        <div className="glass-card p-2 space-y-1">
          {searchResults.map(u => (
            <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#2d2d44]">
              <span className="text-white text-sm">{u.username}</span>
              <Button size="sm" variant="ghost" className="text-[#6c5ce7]" onClick={() => handleSendRequest(u.id)}>
                Add
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Pending requests */}
      {requests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#a0a0b0] mb-2">Pending Requests</h3>
          <div className="space-y-1">
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between p-2 glass-card rounded-lg">
                <span className="text-white text-sm">{r.from.username}</span>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-[#6c5ce7] text-white h-7 text-xs" onClick={() => handleAcceptRequest(r.id)}>
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div>
        <h3 className="text-sm font-semibold text-[#a0a0b0] mb-2">Friends ({friends.length})</h3>
        {friends.length === 0 ? (
          <p className="text-[#666] text-sm">No friends yet. Search and add some!</p>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="space-y-1">
              {friends.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#1a1a2e]">
                  <div className="w-8 h-8 rounded-lg bg-[#6c5ce7] flex items-center justify-center text-white text-xs font-bold">
                    {f.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-white text-sm">{f.username}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// Avatar Customizer
function AvatarCustomizer() {
  const { user, updateAvatar } = useAuthStore();
  const [avatarConfig, setAvatarConfig] = useState(() => {
    try { return user?.avatar ? JSON.parse(user.avatar) : {}; } catch { return {}; }
  });

  const handleColorChange = async (color: string) => {
    const newConfig = { ...avatarConfig, bodyColor: color };
    setAvatarConfig(newConfig);
    try {
      await fetch(`/api/users/${user?.id}/avatar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: JSON.stringify(newConfig) }),
      });
      updateAvatar(JSON.stringify(newConfig));
    } catch { toast.error('Failed to save avatar'); }
  };

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="glass-card p-6 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-24 h-24 rounded-2xl mx-auto mb-3 flex items-center justify-center text-4xl font-bold text-white"
            style={{ backgroundColor: avatarConfig.bodyColor || '#6c5ce7' }}
          >
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="font-semibold text-white">{user?.username}</div>
        </div>
      </div>

      {/* Body Color */}
      <div>
        <Label className="text-[#a0a0b0] text-sm mb-2 block">Body Color</Label>
        <div className="flex flex-wrap gap-2">
          {BV.AVATAR_COLORS.map((color) => (
            <button
              key={color}
              className={`block-swatch ${avatarConfig.bodyColor === color ? 'active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => handleColorChange(color)}
            />
          ))}
        </div>
      </div>

      {/* Head shape */}
      <div>
        <Label className="text-[#a0a0b0] text-sm mb-2 block">Head Shape</Label>
        <div className="flex flex-wrap gap-2">
          {BV.AVATAR_PARTS.head.map((shape) => (
            <button
              key={shape}
              onClick={() => {
                const newConfig = { ...avatarConfig, headShape: shape };
                setAvatarConfig(newConfig);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                avatarConfig.headShape === shape
                  ? 'bg-[#6c5ce7] text-white'
                  : 'bg-[#1a1a2e] text-[#a0a0b0] hover:bg-[#2d2d44]'
              }`}
            >
              {shape}
            </button>
          ))}
        </div>
      </div>

      {/* Accessory */}
      <div>
        <Label className="text-[#a0a0b0] text-sm mb-2 block">Accessory</Label>
        <div className="flex flex-wrap gap-2">
          {BV.AVATAR_PARTS.accessory.map((acc) => (
            <button
              key={acc}
              onClick={() => {
                const newConfig = { ...avatarConfig, accessory: acc };
                setAvatarConfig(newConfig);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                avatarConfig.accessory === acc
                  ? 'bg-[#6c5ce7] text-white'
                  : 'bg-[#1a1a2e] text-[#a0a0b0] hover:bg-[#2d2d44]'
              }`}
            >
              {acc}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Servers Panel
function ServersPanel() {
  return (
    <div className="space-y-3">
      <p className="text-[#a0a0b0] text-sm">Active game servers will appear here when players are online.</p>
      <div className="glass-card p-6 text-center">
        <Server className="w-10 h-10 text-[#666] mx-auto mb-2" />
        <p className="text-[#a0a0b0]">No active servers</p>
        <p className="text-[#666] text-sm">Start a game to create a server!</p>
      </div>
    </div>
  );
}

// Settings Panel
function SettingsPanel() {
  const [sensitivity, setSensitivity] = useState(2);
  const [renderDist, setRenderDist] = useState(4);
  const [shadows, setShadows] = useState(true);

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 space-y-4">
        <h3 className="font-semibold text-white">Game Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-[#a0a0b0]">Mouse Sensitivity</Label>
            <span className="text-white text-sm">{sensitivity}</span>
          </div>
          <input type="range" min="1" max="10" value={sensitivity} onChange={(e) => setSensitivity(parseInt(e.target.value))} className="w-full" />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-[#a0a0b0]">Render Distance</Label>
            <span className="text-white text-sm">{renderDist} chunks</span>
          </div>
          <input type="range" min="2" max="8" value={renderDist} onChange={(e) => setRenderDist(parseInt(e.target.value))} className="w-full" />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[#a0a0b0]">Shadows</Label>
          <button
            onClick={() => setShadows(!shadows)}
            className={`w-12 h-6 rounded-full transition-all ${shadows ? 'bg-[#6c5ce7]' : 'bg-[#2d2d44]'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${shadows ? 'translate-x-6.5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h3 className="font-semibold text-white">Controls</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-[#a0a0b0]">Move</div><div className="text-white">W A S D</div>
          <div className="text-[#a0a0b0]">Jump</div><div className="text-white">Space</div>
          <div className="text-[#a0a0b0]">Sprint</div><div className="text-white">Shift</div>
          <div className="text-[#a0a0b0]">Camera</div><div className="text-white">Right-click drag</div>
          <div className="text-[#a0a0b0]">Zoom</div><div className="text-white">Scroll / I O</div>
          <div className="text-[#a0a0b0]">Build</div><div className="text-white">B / Left-click</div>
          <div className="text-[#a0a0b0]">Delete</div><div className="text-white">X</div>
          <div className="text-[#a0a0b0]">Paint</div><div className="text-white">P</div>
          <div className="text-[#a0a0b0]">Grab</div><div className="text-white">G</div>
          <div className="text-[#a0a0b0]">Toolbar</div><div className="text-white">1-9</div>
          <div className="text-[#a0a0b0]">Chat</div><div className="text-white">Enter</div>
          <div className="text-[#a0a0b0]">Menu</div><div className="text-white">Esc</div>
        </div>
      </div>
    </div>
  );
}
