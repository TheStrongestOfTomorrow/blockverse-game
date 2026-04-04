# 🧱 BlockVerse

**Build. Play. Connect.**

A Roblox-like browser 3D multiplayer game — zero cost, no databases, powered by WebRTC P2P.

## 🚀 Play Now

👉 **[BlockVerse on GitHub Pages](https://thestrongestoftomorrow.github.io/blockverse-game/)**

## ✨ Features

- **3D Block Building** — Place, delete, paint, and grab blocks with cursor-based tools
- **Third-Person Camera** — Orbit with right-click drag, zoom with I/O or scroll wheel
- **Multiplayer** — Real-time P2P via WebRTC (PeerJS mesh networking)
- **Game Creator** — Create and publish your own games with 12 terrain templates
- **Avatar Customization** — Customize your character's colors and shape
- **Friends System** — Add friends, see online status, join their games
- **Chat** — In-game text chat with all players
- **Host Migration** — If the host leaves, another player takes over seamlessly
- **100% Client-Side** — No servers, no databases. localStorage + IndexedDB only
- **Zero Cost** — Hosted free on GitHub Pages

## 🎮 Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Space | Jump |
| Right-Click Drag | Orbit Camera |
| I / O | Zoom In / Out |
| Scroll Wheel | Zoom |
| Left-Click | Place/Remove Block (build/delete tool) |
| B / X / P / G | Switch Tools (Build/Delete/Paint/Grab) |
| 1-9 | Select Toolbar Slot |
| ESC | Game Menu |
| F1 | Player List |

## 📋 Update Log

### V1.1 — "The Big Revamp" (April 2026)

- ✅ Added **leave button** with ✕ symbol at top-right corner of game screen
- ✅ **12 working terrain templates** that actually generate proper worlds:
  - Flat World (grass + stone border walls)
  - Rolling Hills (trees, lake, varied terrain)
  - Obby Course (5-stage obstacle course with checkpoints)
  - City Blocks (buildings with doors/windows, roads, park)
  - Battle Arena (walled arena with spectator stands)
  - Sky Island (floating island with house, trees, water below)
  - Village (6 houses with doors/windows, central well, garden)
  - Castle (medieval castle with towers, battlements, inner keep)
  - Pirate Ship (ship with hull, deck, mast, sail, treasure)
  - Bridge Challenge (two cliffs connected by bridge over water)
  - Parkour (ascending spiral platforms)
  - Empty World (clean slate with spawn marker)
- ✅ **9 featured base games** in Discovery — all with proper templates that work
- ✅ Improved **game creator** with better template previews and descriptions
- ✅ System optimization and code cleanup
- ✅ All templates now generate **platforms, terrain, and interactive elements** — no more blank white worlds

### V1.0 — Initial Release

- Basic 3D block world with Three.js
- Third-person camera with orbit controls
- Block placement and deletion tools
- WebRTC multiplayer via PeerJS
- Auth system with localStorage
- Friends system
- Avatar customization
- Game creator with basic templates
- In-game chat

## 🛠️ Tech Stack

- **Three.js** — 3D rendering
- **PeerJS** — WebRTC P2P networking
- **localStorage/IndexedDB** — Data persistence (no databases!)
- **GitHub Pages** — Static hosting ($0)

## 📄 License

MIT
