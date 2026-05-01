'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/stores/game-store';
import { BV, Utils } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft, Search, Heart, MessageCircle, Share2, Star,
  TrendingUp, Clock, Award, Users, Gamepad2, Eye
} from 'lucide-react';
import { toast } from 'sonner';

const SAMPLE_POSTS = [
  { id: '1', title: 'Amazing Castle Build!', author: 'BuilderKing', likes: 342, comments: 28, thumbnailColor: '#E74C3C', category: 'sandbox' },
  { id: '2', title: 'Speed Obby World Record', author: 'SpeedRunner42', likes: 891, comments: 56, thumbnailColor: '#FFD700', category: 'obby' },
  { id: '3', title: 'Medieval Village Tour', author: 'VillageMaker', likes: 156, comments: 12, thumbnailColor: '#8D6E63', category: 'roleplay' },
  { id: '4', title: 'Pirate Ship Battle', author: 'SeaCaptain', likes: 567, comments: 34, thumbnailColor: '#2196F3', category: 'adventure' },
  { id: '5', title: 'Modern City Skyline', author: 'UrbanDev', likes: 234, comments: 19, thumbnailColor: '#607D8B', category: 'sandbox' },
  { id: '6', title: 'Parkour Challenge #5', author: 'JumperPro', likes: 445, comments: 41, thumbnailColor: '#4CAF50', category: 'minigame' },
];

export function CommunityScreen() {
  const { setScreen } = useGameStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'trending' | 'new' | 'top'>('trending');

  const filteredPosts = SAMPLE_POSTS.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0a1a]">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between p-4 border-b border-[#2d2d44] bg-[#0a0a1a]/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white" onClick={() => setScreen('lobby')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-white text-lg">Community Hub</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-[#a0a0b0]">
            <Award className="w-4 h-4 mr-1" /> Leaderboard
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {/* Featured banner */}
        <div className="glass-card p-6 flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-[#6c5ce7]/30 flex items-center justify-center flex-shrink-0">
            <Star className="w-8 h-8 text-[#6c5ce7]" />
          </div>
          <div>
            <h2 className="font-bold text-white text-lg">Welcome to the Community!</h2>
            <p className="text-[#a0a0b0] text-sm">Share your creations, discover amazing builds, and connect with other players.</p>
          </div>
        </div>

        {/* Search & Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
            <Input
              placeholder="Search community..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#1a1a2e] border-[#2d2d44] text-white"
            />
          </div>
          <div className="flex gap-1">
            {[
              { id: 'trending' as const, icon: <TrendingUp className="w-4 h-4" />, label: 'Trending' },
              { id: 'new' as const, icon: <Clock className="w-4 h-4" />, label: 'New' },
              { id: 'top' as const, icon: <Heart className="w-4 h-4" />, label: 'Top' },
            ].map((sort) => (
              <Button
                key={sort.id}
                variant={sortBy === sort.id ? 'default' : 'ghost'}
                size="sm"
                className={sortBy === sort.id ? 'bg-[#6c5ce7] text-white' : 'text-[#a0a0b0]'}
                onClick={() => setSortBy(sort.id)}
              >
                {sort.icon} <span className="ml-1 hidden sm:inline">{sort.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPosts.map((post) => (
            <Card key={post.id} className="glass-card game-card-hover overflow-hidden border-0">
              <div
                className="h-32 flex items-center justify-center relative"
                style={{ backgroundColor: post.thumbnailColor }}
              >
                <Gamepad2 className="w-10 h-10 text-white/30" />
                <Badge variant="secondary" className="absolute top-2 right-2 bg-black/40 text-white text-xs">
                  {post.category}
                </Badge>
              </div>
              <CardContent className="p-3">
                <h3 className="font-semibold text-white text-sm truncate">{post.title}</h3>
                <p className="text-xs text-[#a0a0b0] mt-0.5">by {post.author}</p>
                <div className="flex items-center gap-3 mt-2 text-[#a0a0b0] text-xs">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.likes}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.comments}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="ghost" className="text-[#a0a0b0] hover:text-red-400 h-7 text-xs flex-1"
                    onClick={() => toast.success('Liked!')}>
                    <Heart className="w-3 h-3 mr-1" /> Like
                  </Button>
                  <Button size="sm" variant="ghost" className="text-[#a0a0b0] hover:text-[#6c5ce7] h-7 text-xs flex-1"
                    onClick={() => toast.info('Share link copied!')}>
                    <Share2 className="w-3 h-3 mr-1" /> Share
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-[#666] mx-auto mb-3" />
            <p className="text-[#a0a0b0]">No results found</p>
          </div>
        )}
      </div>
    </div>
  );
}
