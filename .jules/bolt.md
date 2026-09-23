# Bolt Persona Learnings

## Core Learnings
- **Flavor Packs System**: Successfully implemented a modular "Flavor Pack" system in `js/pack-manager.js`. This allows for zero-cost expansion of the game by registering new blocks, templates, and visual nodes in one place.
- **Unified Config**: Bridged the gap between legacy JS files (`js/config.js`) and modern Next.js constants (`src/lib/constants.ts`) by ensuring newly registered packs sync across both systems.
- **Resource Management**: Fixed critical material disposal bugs in the Three.js rendering pipeline to prevent GPU memory leaks during world resets.

## Performance Impact
- **Memory**: Reduced memory pressure by ensuring all `THREE.Material` and `THREE.Geometry` instances are properly disposed of when switching templates or resetting the world.
- **Load Time**: Modular packs are lightweight and registered at runtime, maintaining the "no database" and "client-side only" philosophy while allowing rich content.

## Technical Notes
- The `PackManager` dispatches a `bv:pack_activated` event, allowing the `NodeEditor` and `GameTemplates` to dynamically update their UIs.
- Built-in packs (Medieval and Space) provide high-quality templates (Dungeon, Moonbase) to showcase the system.
