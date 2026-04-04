# 🧱 BlockVerse

**Build. Play. Connect. Script. Share.**

A Roblox-like browser 3D multiplayer game — zero cost, no databases, powered by WebRTC P2P. Now with a full visual scripting system and community hub.

## 🚀 Play Now

👉 **[BlockVerse Game](https://thestrongestoftomorrow.github.io/blockverse-game/)**

🔗 **[Creator Studio](https://thestrongestoftomorrow.github.io/blockverse-game/creator.html)** — Build games visually or with code

🌐 **[Community Hub](https://thestrongestoftomorrow.github.io/blockverse-game/community.html)** — Browse & share custom nodes and games

📖 **[Tutorials](https://thestrongestoftomorrow.github.io/blockverse-game/docs/tutorials.html)** — Learn scripting step by step

## ✨ Features

### 🎮 Core Game
- **3D Block Building** — Place, delete, paint, and grab blocks with cursor-based tools
- **Third-Person Camera** — Orbit with right-click drag, zoom with I/O or scroll wheel
- **Multiplayer** — Real-time P2P via WebRTC (PeerJS mesh networking)
- **12 Terrain Templates** — Flat, Hills, Obby, City, Arena, Island, Village, Castle, Pirate, and more
- **Avatar Customization** — Customize your character's colors and shape
- **Friends System** — Add friends, see online status, join their games
- **Chat** — In-game text chat with all players
- **Host Migration** — If the host leaves, another player takes over seamlessly
- **100% Client-Side** — No servers, no databases. GitHub Pages + localStorage only
- **Zero Cost** — Hosted free on GitHub Pages

### 🔧 Creator Studio (NEW in V2.0)
- **Full Creator Interface** — Roblox Studio-like layout with 3D viewport, tools panel, properties, and scripting
- **8 Tools** — Build, Delete, Paint, Grab, Select, Move, Scale, Rotate
- **Undo/Redo** — Full history with 100-level undo stack
- **Scripting Panel** — Toggle between Beginner (Visual) and Advanced (JavaScript) modes
- **Publish** — Save your game + scripts to localStorage

### 🧩 Visual Scripting (NEW in V2.0)
- **Scratch-Style Node Editor** — Drag and snap colorful blocks to create game logic
- **8 Block Categories** — Events (green), Motion (blue), Blocks (brown), Control (orange), Looks (purple), Sound (pink), Variables (red), Custom (teal)
- **30+ Block Types** — Covering everything from player movement to UI effects
- **Nested Blocks** — if/else, repeat, forever with proper indentation
- **Visual-to-JS Compiler** — Node graphs compile to executable JavaScript
- **Custom Nodes (My Blocks)** — Create your own reusable blocks like Scratch
- **Share Codes** — Export/import custom nodes as base64 strings

### 💻 JavaScript API (NEW in V2.0)
- **Kid-Friendly API** — 8 namespaces: Block, Player, Chat, UI, Tween, Sound, Events, Timer
- **Web Worker Sandbox** — Scripts run isolated with execution limits (no infinite loops)
- **Monaco Editor** — Full code editor with autocomplete, syntax highlighting, custom dark theme
- **4 Script Templates** — Welcome Message, Obby Scorer, Countdown Timer, Auto Builder

### 🌐 Community Hub (NEW in V2.0)
- **GitHub Issues as Database** — Zero-cost content storage using the GitHub API
- **Browse & Search** — Discover custom node packs, games, and tutorials
- **Publish & Share** — Upload your creations for others to use
- **Ratings** — Rate content with reactions (👍👎❤️🚀)
- **Comments** — Leave reviews and feedback
- **PAT Authentication** — Login with GitHub Personal Access Token

### 🎓 Tutorials (NEW in V2.0)
- **8 Comprehensive Guides** — From "Getting Started" to advanced API reference
- **Step-by-Step Instructions** — With code examples and ASCII diagrams
- **Progress Tracking** — Mark tutorials as complete (saved to localStorage)
- **Full API Reference** — Complete documentation for all scripting functions

## 🎮 Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Space | Jump |
| Shift | Sprint |
| Right-Click Drag | Orbit Camera |
| I / O | Zoom In / Out |
| Scroll Wheel | Zoom |
| Left-Click | Place/Remove Block (build/delete tool) |
| B / X / P / G | Switch Tools (Build/Delete/Paint/Grab) |
| 1-9 | Select Toolbar Slot |
| ESC | Game Menu |
| F1 | Player List |

## 📋 Update Log

### V2.0 — "The Everything Update" (April 2026)

**🧱 Core Optimizations**
- ✅ Numeric block keys — `((x+64)<<16)|(y<<8)|(z+64)` for 3x faster Map lookups
- ✅ blockMap converted from Object to Map for true numeric key support
- ✅ Block-level occlusion culling — ~70% fewer rendered blocks (fully-surrounded blocks hidden)
- ✅ Shadow optimization — Transparent blocks (water, glass, ice, leaf) don't cast shadows
- ✅ isOpaque() helper for transparent type detection

**🔧 Creator Studio** (NEW)
- ✅ Full creator.html page with Roblox Studio-like interface
- ✅ 3D viewport with orbit camera, zoom, pan
- ✅ 8 tools: Build, Delete, Paint, Grab, Select, Move, Scale, Rotate
- ✅ Properties inspector for selected blocks
- ✅ Asset library with all 17 block types
- ✅ Template generator for quick world building
- ✅ Undo/Redo system (100-level stack)
- ✅ Game settings panel and publish flow

**🧩 Visual Scripting System** (NEW)
- ✅ Scratch-style visual node editor with drag & snap behavior
- ✅ 8 block categories with 30+ block types
- ✅ HTML/CSS block rendering with category colors
- ✅ Palette sidebar with search filtering
- ✅ Workspace with zoom and pan
- ✅ Nested block support (if/repeat/forever)
- ✅ Copy/Paste and Delete functionality
- ✅ Visual-to-JS compiler (node graphs → executable JavaScript)

**📦 Custom Nodes (My Blocks)** (NEW)
- ✅ Create reusable custom blocks with custom inputs
- ✅ Share via base64 codes (export/import)
- ✅ Validation with recursion detection
- ✅ 8 built-in templates (Teleport, Give Item, Spawn Pattern, etc.)
- ✅ Bulk backup/restore support

**💻 JavaScript Scripting** (NEW)
- ✅ Kid-friendly Game API (Block, Player, Chat, UI, Tween, Sound, Events, Timer)
- ✅ Web Worker sandbox with execution limits (1M iterations, 5s timeout)
- ✅ Monaco Editor with custom "blockverse-dark" theme
- ✅ 40+ autocomplete items for Game API
- ✅ Script templates (Welcome Message, Obby Scorer, Countdown, Auto Builder)

**🌐 Community Hub** (NEW)
- ✅ GitHub Issues as free database (blockverse-community repo)
- ✅ Browse/publish custom node packs and games
- ✅ GitHub Reactions API for ratings
- ✅ Comments/reviews system
- ✅ Full-text search via GitHub Search API
- ✅ PAT authentication with session persistence
- ✅ Response caching (5-minute TTL) and rate limit handling

**🎓 Tutorials** (NEW)
- ✅ 8 comprehensive tutorials from beginner to advanced
- ✅ Interactive code examples with copy buttons
- ✅ Progress tracking via localStorage
- ✅ Complete JavaScript API reference
- ✅ Custom node creation guide

**🏗️ Architecture**
- ✅ 16 new files, 6 modified files
- ✅ ~14,000 lines of new code
- ✅ Modular design with clean separation of concerns

### V1.1 — "The Big Revamp" (April 2026)

- ✅ InstancedMesh rendering (16 draw calls instead of 10,000+)
- ✅ DDA voxel raycasting (O(distance) cursor-based block detection)
- ✅ Fixed double render loop
- ✅ Material caching (16 shared materials)
- ✅ Lighting rebalance (Roblox-like aesthetic)
- ✅ Leave button redesign with CSS icon
- ✅ 12 working terrain templates
- ✅ Controls hint auto-fade

### V1.0 — Initial Release

- Basic 3D block world with Three.js
- Third-person camera with orbit controls
- Block placement and deletion tools
- WebRTC multiplayer via PeerJS
- Auth system with localStorage
- Friends system and avatar customization
- Game creator with basic templates
- In-game chat

## 🛠️ Tech Stack

- **Three.js r128** — 3D rendering
- **PeerJS** — WebRTC P2P networking
- **Monaco Editor** — Code editor for advanced scripting
- **GitHub Issues API** — Community content database
- **localStorage** — Data persistence (no databases!)
- **GitHub Pages** — Static hosting ($0)

## 🏗️ Architecture

```
blockverse-game/
├── index.html              # Lobby + Game
├── creator.html            # Game Creator Studio
├── community.html          # Community Hub
├── css/
│   ├── style.css           # Main game styles
│   ├── creator.css         # Creator Studio styles
│   └── community.css       # Community Hub styles
├── docs/
│   └── tutorials.html      # Interactive tutorials
├── js/
│   ├── config.js           # Constants, block types, utilities
│   ├── auth.js             # Authentication (localStorage)
│   ├── avatar.js           # Avatar customization
│   ├── friends.js          # Friends system
│   ├── ui.js               # Screen switching, modals
│   ├── multiplayer.js      # WebRTC P2P networking
│   ├── block-renderer.js   # InstancedMesh + DDA raycast + occlusion
│   ├── world.js            # Scene, lighting, terrain generation
│   ├── player.js           # Third-person player + remote players
│   ├── tools.js            # Build/delete/paint/grab tools
│   ├── chat.js             # In-game chat
│   ├── lobby.js            # Game discovery, creation, server management
│   ├── main.js             # App entry point, game loop
│   ├── creator/
│   │   ├── api.js          # Game API (Block, Player, Chat, UI, etc.)
│   │   ├── sandbox.js      # Web Worker sandbox for script execution
│   │   ├── engine.js       # Scripting engine (bridge worker ↔ main)
│   │   ├── node-editor.js  # Scratch-style visual block editor
│   │   ├── custom-nodes.js # My Blocks system (create/share/import)
│   │   ├── node-compiler.js # Visual-to-JavaScript compiler
│   │   └── monaco-setup.js  # Monaco editor setup + autocomplete
│   └── community/
│       ├── hub.js           # GitHub Issues API client
│       ├── device-flow.js   # GitHub OAuth device flow
│       ├── ui.js            # Community hub UI components
│       └── tutorials.js     # Tutorial engine + progress tracking
```

## 📄 License

MIT
