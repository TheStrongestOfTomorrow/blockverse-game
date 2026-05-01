'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useGameStore } from '@/lib/stores/game-store';
import { AuthScreen } from '@/components/auth/auth-screen';
import { LobbyScreen } from '@/components/lobby/lobby-screen';
import { GameScreen } from '@/components/game/game-screen';
import { CreatorScreen } from '@/components/creator/creator-screen';
import { CommunityScreen } from '@/components/community/community-screen';

export default function BlockVerseApp() {
  const { isAuthenticated, checkAuth, isLoading } = useAuthStore();
  const { currentScreen, setScreen } = useGameStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    checkAuth().finally(() => setInitialized(true));
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated && currentScreen === 'auth') {
      setScreen('lobby');
    } else if (!isAuthenticated && currentScreen !== 'auth') {
      setScreen('auth');
    }
  }, [isAuthenticated, currentScreen, setScreen]);

  if (!initialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a1a]">
        <div className="text-center">
          <div className="text-4xl font-bold gradient-text mb-4">BlockVerse</div>
          <div className="w-8 h-8 border-2 border-[#6c5ce7] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {currentScreen === 'auth' && <AuthScreen />}
      {currentScreen === 'lobby' && <LobbyScreen />}
      {currentScreen === 'game' && <GameScreen />}
      {currentScreen === 'creator' && <CreatorScreen />}
      {currentScreen === 'community' && <CommunityScreen />}
    </div>
  );
}
