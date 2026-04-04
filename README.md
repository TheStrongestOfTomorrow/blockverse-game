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

### V2.0 — "The Performance Overhaul + Creator Update" (April 2026)

**🚀 Performance (Massive)**
- ✅ **InstancedMesh rendering** — 16 draw calls instead of 10,000+ (600x reduction)
- ✅ **DDA voxel raycasting** — O(distance) cursor-based block detection, replaces mesh raycasting
- ✅ **Fixed double render loop** — World no longer runs its own animation frame; App drives everything
- ✅ **Material caching** — 16 shared materials instead of one per block (eliminates shader duplication)
- ✅ **Shared Raycaster** — Single reusable raycaster object (eliminates GC pressure)
- ✅ **Block count stats** — Real-time rendering stats for debugging

**🎨 Lighting Rebalance**
- ✅ Ambient light reduced (0.6→0.35) with cool tint — no more flat washed-out look
- ✅ Sun light increased (0.8→1.0) — crisper shadows, better contrast
- ✅ **NEW: Fill light** from opposite side — prevents pure-black shadow sides on buildings
- ✅ Hemisphere light adjusted — bluer sky tint, darker ground bounce
- ✅ **Tone mapping exposure reduced** (1.0→0.85) — prevents bloom/washout
- ✅ **Shadow map optimized** — 1024px (was 2048), tighter frustum ±25 (was ±60), farther near=0.5
- ✅ **Shadow type** — PCF (was PCFSoft) — harder shadows look better on blocks + faster
- ✅ **Fog tuned** — smoother near/far ratio for clean distance fade

**🖥️ UI Improvements**
- ✅ **Leave button redesign** — Rounded rectangle with CSS door/exit icon + pulsing glow animation
- ✅ **Controls hint auto-fade** — Fades out after 6 seconds, cleaner gameplay experience

**🔧 Architecture (For Game Creator)**
- ✅ BlockRenderer module — new `js/block-renderer.js` separates rendering from data
- ✅ World.js simplified — pure data layer + lighting, delegates rendering to BlockRenderer
- ✅ Tools.js simplified — uses DDA raycast, paint/grab adapted for InstancedMesh
- ✅ Custom painted blocks use individual meshes (separated from InstancedMesh system)
- ✅ Grab tool redesigned — pick up block (creates temp mesh), click to place at new position

**📋 Planned (V2.0 Continued)**
- ⏳ Game Creator as separate `creator.html` tab (full-fledged studio)
- ⏳ Visual Node Editor (beginner mode) — drag-and-drop like Scratch
- ⏳ JavaScript scripting API (advanced mode) — simplified API for game logic
- ⏳ Custom Nodes system — users create their own reusable nodes
- ⏳ Node ↔ Code bridge — switch between visual and JS, both generate same output
- ⏳ Community Hub — GitHub Issues as free database for sharing nodes
- ⏳ Block-level occlusion culling (only render visible surface blocks)
- ⏳ Spatial hash for collision detection
- ⏳ Async terrain generation (no loading freezes)

### V1.1 — "The Big Revamp" (April 2026)

- ✅ Added **leave button** with ✕ symbol at top-right corner of game screen
- ✅ **12 working terrain templates** that actually generate proper worlds
- ✅ **9 featured base games** in Discovery — all with proper templates that work
- ✅ Improved **game creator** with better template previews and descriptions
- ✅ All templates now generate **platforms, terrain, and interactive elements**

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

- **Three.js r128** — 3D rendering
- **PeerJS** — WebRTC P2P networking
- **localStorage/IndexedDB** — Data persistence (no databases!)
- **GitHub Pages** — Static hosting ($0)

## 🏗️ Architecture

```
blockverse-game/
├── index.html          # Lobby + Game
├── creator.html        # (Planned) Game Creator Studio
├── css/
│   └── style.css       # All styles
├── js/
│   ├── config.js       # Constants, block types, utilities
│   ├── auth.js         # Authentication (localStorage)
│   ├── avatar.js       # Avatar customization
│   ├── friends.js      # Friends system
│   ├── ui.js           # Screen switching, modals
│   ├── multiplayer.js   # WebRTC P2P networking
│   ├── block-renderer.js # V2.0: InstancedMesh + DDA raycast
│   ├── world.js        # Scene, lighting, terrain generation
│   ├── player.js       # Third-person player + remote players
│   ├── tools.js        # Build/delete/paint/grab tools
│   ├── chat.js         # In-game chat
│   ├── lobby.js        # Game discovery, creation, server management
│   └── main.js         # App entry point, game loop
```

## 📄 License

MIT
