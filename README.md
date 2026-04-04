# 🧱 BlockVerse

A Roblox-like multiplayer block building game running entirely on **GitHub Pages** using **WebRTC** (PeerJS) for real-time multiplayer. Zero servers, zero databases, zero cost.

## 🎮 Play Now

Visit: **https://thestrongestoftomorrow.github.io/blockverse-game/**

## ✨ Features

- **3D Block World** — Build, destroy, and paint blocks in a Three.js-powered 3D world
- **Real-time Multiplayer** — WebRTC peer-to-peer mesh networking (up to 12 players per server)
- **No Server Required** — One player's browser hosts, others connect directly
- **Account System** — localStorage-based signup/login with unique usernames
- **Friends System** — Add friends, see online status, join their games
- **Avatar Customization** — Customize your character's color, shape, and accessories
- **Multiple Game Templates** — Empty, Flat Terrain, Hills, Obby, City, Arena
- **Infinite Servers** — Games can auto-scale with multiple servers
- **Host Migration** — If host leaves, oldest player becomes new host
- **Player Saves** — Owner allows specific blocks to be saved to IndexedDB
- **Chat System** — In-game text chat with all players
- **4 Tools** — Build, Delete, Paint, and Grab

## 🏗️ Architecture

```
GitHub Pages (Free Hosting)
├── Three.js (3D Rendering)
├── PeerJS / WebRTC (Multiplayer)
├── localStorage (Accounts, Friends, Game Metadata)
├── IndexedDB (Player Block Saves)
└── No server, no database, no cost
```

## 📁 Project Structure

```
├── index.html          # Main HTML (all screens)
├── css/
│   └── style.css       # Complete styling
├── js/
│   ├── config.js       # Shared constants & utilities
│   ├── auth.js         # Account system (localStorage)
│   ├── avatar.js       # Avatar customization
│   ├── friends.js      # Friends system + PeerJS identity
│   ├── ui.js           # UI utilities, modals, cooldowns
│   ├── multiplayer.js  # WebRTC networking (PeerJS)
│   ├── world.js        # 3D world engine (Three.js)
│   ├── player.js       # Player controls + remote avatars
│   ├── tools.js        # Build/Delete/Paint/Grab tools
│   ├── chat.js         # In-game chat
│   ├── lobby.js        # Game browser, server management
│   └── main.js         # Entry point, game loop
└── assets/
    ├── avatars/
    ├── sounds/
    └── icons/
```

## 🚀 Getting Started

1. Sign up with a unique username
2. Browse games in the Discover tab or create your own
3. Click Play to enter a 3D block world
4. Use WASD to move, mouse to look, click to place/delete blocks
5. Share your game code with friends!

## 🎯 Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look around |
| Left Click | Use tool |
| Right Click | Secondary action |
| Space | Jump |
| Shift | Sprint |
| 1-9 | Select toolbar slot |
| Scroll | Cycle toolbar |
| T / Enter | Open chat |
| Escape | Pause menu |
| F1 | Toggle player list |

## 💰 Cost

**$0.00** — Everything runs on GitHub Pages for free!

## 📜 License

MIT
