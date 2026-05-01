'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const floatingBlocks = [
  { x: '10%', y: '20%', size: 40, color: '#4CAF50', delay: 0 },
  { x: '80%', y: '15%', size: 50, color: '#6c5ce7', delay: 1 },
  { x: '25%', y: '70%', size: 35, color: '#E74C3C', delay: 2 },
  { x: '70%', y: '60%', size: 45, color: '#FFD700', delay: 3 },
  { x: '50%', y: '80%', size: 30, color: '#2196F3', delay: 4 },
  { x: '15%', y: '45%', size: 38, color: '#9E9E9E', delay: 5 },
  { x: '90%', y: '35%', size: 32, color: '#8D6E63', delay: 6 },
  { x: '40%', y: '25%', size: 28, color: '#00BCD4', delay: 1.5 },
];

export function AuthScreen() {
  const { login, signup, isLoading, error, clearError } = useAuthStore();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'login') {
      await login(username, password);
    } else {
      await signup(username, password);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a1a] relative overflow-hidden">
      {/* Floating blocks background */}
      {floatingBlocks.map((block, i) => (
        <div
          key={i}
          className="floating-block"
          style={{
            left: block.x,
            top: block.y,
            width: block.size,
            height: block.size,
            backgroundColor: block.color,
            animationDelay: `${block.delay}s`,
          }}
        />
      ))}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a1a]/50 to-[#0a0a1a]" />

      {/* Auth card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold gradient-text mb-2">BlockVerse</h1>
          <p className="text-[#a0a0b0] text-lg">Build. Play. Create. Together.</p>
        </div>

        <Card className="glass-card border-0 shadow-2xl">
          <CardHeader className="pb-2">
            <Tabs value={tab} onValueChange={(v) => { setTab(v as 'login' | 'signup'); clearError(); }}>
              <TabsList className="w-full bg-[#1a1a2e]">
                <TabsTrigger value="login" className="flex-1 data-[state=active]:bg-[#6c5ce7]">
                  Log In
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1 data-[state=active]:bg-[#6c5ce7]">
                  Sign Up
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-[#a0a0b0]">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-[#1a1a2e] border-[#2d2d44] text-white placeholder:text-[#666] focus:border-[#6c5ce7]"
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_]+"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#a0a0b0]">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#1a1a2e] border-[#2d2d44] text-white placeholder:text-[#666] focus:border-[#6c5ce7]"
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#6c5ce7] hover:bg-[#5b4bd6] text-white font-semibold h-11"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  tab === 'login' ? 'Log In' : 'Create Account'
                )}
              </Button>

              {tab === 'signup' && (
                <p className="text-xs text-[#666] text-center">
                  3-20 characters, alphanumeric & underscores. Password min 6 chars.
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[#666] text-xs mt-6">
          BlockVerse v2.0 — A Roblox-like 3D multiplayer browser game
        </p>
      </div>
    </div>
  );
}
