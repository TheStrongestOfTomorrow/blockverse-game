// ============================================
// BLOCKVERSE - Game Templates
// ============================================
// Procedurally generate base games (Obby, Arena, Parkour, etc.)
// When clicking discovery templates, this builds the actual game world.
// ============================================

const GameTemplates = (() => {
    'use strict';

    // =====================================================
    // OBBY TEMPLATE - Obstacle Course
    // =====================================================

    const obby = {
        name: 'Obby',
        description: 'Multi-stage parkour challenge with checkpoints and varying hazards!',
        difficulty: 'Medium',

        generate(world) {
            console.log('[Templates] Generating Pro Obby...');

            // Spawn Area
            _addPlatform(world, 0, 0, 0, 10, 1, 10, 'stone');
            _addPlatform(world, 0, 1, 0, 4, 0.5, 4, 'gold', { spawn: true });

            // Stage 1: The Rising Steps
            for (let i = 0; i < 6; i++) {
                _addPlatform(world, 8 + i * 4, 1 + i * 1.5, 0, 3, 0.5, 3, 'stone');
            }

            // Checkpoint 1
            _addPlatform(world, 32, 8, 0, 6, 0.5, 6, 'gold');

            // Stage 2: Glass Walkway
            for (let i = 0; i < 5; i++) {
                const zOff = (i % 2 === 0) ? 2 : -2;
                _addPlatform(world, 40 + i * 4, 8, zOff, 2, 0.2, 2, 'glass');
            }

            // Stage 3: Brick Pillars
            for (let i = 0; i < 4; i++) {
                _addPlatform(world, 60 + i * 5, 8, 0, 2, 1 + i*2, 2, 'brick');
            }

            // Checkpoint 2
            _addPlatform(world, 80, 15, 0, 8, 0.5, 8, 'gold');

            // Final Challenge: The Void Leap
            _addPlatform(world, 90, 14, 4, 2, 0.5, 2, 'diamond');
            _addPlatform(world, 95, 16, -4, 2, 0.5, 2, 'diamond');

            // Victory Platform
            _addPlatform(world, 105, 18, 0, 12, 1, 12, 'grass');
            _addPlatform(world, 105, 19, 0, 4, 2, 4, 'gold');

            // Hazard floor (Lava)
            for (let x = -10; x < 120; x += 10) {
                for (let z = -20; z < 20; z += 10) {
                    _addPlatform(world, x, -5, z, 10, 1, 10, 'lava');
                }
            }

            console.log('[Templates] Pro Obby generated successfully');
        }
    };

    // =====================================================
    // ARENA TEMPLATE - PvP Combat Arena
    // =====================================================

    const arena = {
        name: 'Arena',
        description: 'PvP battle arena - last player standing wins!',
        difficulty: 'Medium',

        generate(world) {
            console.log('[Templates] Generating Arena...');

            // Arena floor (large circular)
            _addPlatform(world, 0, 0, 0, 30, 1, 30, 'stone');

            // Walls (octagon shape)
            const corners = 8;
            const radius = 15;
            for (let i = 0; i < corners; i++) {
                const angle = (i / corners) * Math.PI * 2;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                _addWall(world, x, 1, z, 0.5, 20, 3, 'stone');
            }

            // Central platform (elevated)
            _addPlatform(world, 0, 3, 0, 8, 0.5, 8, 'iron');

            // Spawn points (4 corners)
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const x = Math.cos(angle) * 12;
                const z = Math.sin(angle) * 12;
                _addPlatform(world, x, 1, z, 3, 0.5, 3, 'glass', { spawn: true });
            }

            // Elevated platforms (for combat variety)
            _addPlatform(world, -8, 2.5, -8, 4, 0.5, 4, 'stone');
            _addPlatform(world, 8, 2.5, -8, 4, 0.5, 4, 'stone');
            _addPlatform(world, -8, 2.5, 8, 4, 0.5, 4, 'stone');
            _addPlatform(world, 8, 2.5, 8, 4, 0.5, 4, 'stone');

            console.log('[Templates] Arena generated successfully');
        }
    };

    // =====================================================
    // PARKOUR TEMPLATE - Parkour Challenge
    // =====================================================

    const parkour = {
        name: 'Parkour',
        description: 'Navigate parkour obstacles and reach the finish!',
        difficulty: 'Hard',

        generate(world) {
            console.log('[Templates] Generating Parkour...');

            // Start platform
            _addPlatform(world, 0, 0, 0, 6, 1, 6, 'stone');

            // Jump sequence (varying heights)
            const jumpSequence = [
                { x: 8, y: 2, z: 0 },
                { x: 14, y: 4, z: 2 },
                { x: 18, y: 3, z: 5 },
                { x: 22, y: 5, z: 3 },
                { x: 28, y: 2, z: 0 },
            ];

            jumpSequence.forEach((pos, idx) => {
                const size = 2 + (idx % 2);
                _addPlatform(world, pos.x, pos.y, pos.z, size, 0.5, size, 'stone');
            });

            // Wall jump section
            _addWall(world, 35, 2, 0, 0.5, 10, 3, 'stone');
            _addWall(world, 40, 2, 0, 0.5, 10, 3, 'stone');

            // Narrow beam (balance challenge)
            _addPlatform(world, 45, 3, 0, 20, 0.3, 1, 'stone', { narrow: true });

            // Final section (jump puzzle)
            for (let i = 0; i < 5; i++) {
                _addPlatform(world, 50 + i * 4, 2 + (i % 2), i - 2, 2.5, 0.5, 2.5, 'iron');
            }

            // Finish
            _addPlatform(world, 70, 2, 0, 8, 1, 8, 'grass', { finish: true });

            console.log('[Templates] Parkour generated successfully');
        }
    };

    // =====================================================
    // CITY TEMPLATE - Urban Build
    // =====================================================

    const city = {
        name: 'City',
        description: 'A thriving mini-metropolis with detailed buildings, interiors, and foliage.',
        difficulty: 'Easy',

        generate(world) {
            console.log('[Templates] Generating Detailed City...');

            // Main Plaza
            _addPlatform(world, 0, -1, 0, 60, 1, 60, 'stone');

            // Roads
            _addPlatform(world, 0, -0.9, 0, 100, 0.1, 12, 'cobble');
            _addPlatform(world, 0, -0.9, 0, 12, 0.1, 100, 'cobble');

            // Building 1: The Skyscraper
            _addPlatform(world, -20, 0, -20, 12, 30, 12, 'stone');
            _addPlatform(world, -20, 30, -20, 14, 1, 14, 'iron'); // Roof lip
            // Windows
            for(let y=2; y<28; y+=4) {
                _addPlatform(world, -14, y, -20, 0.1, 2, 8, 'glass');
                _addPlatform(world, -26, y, -20, 0.1, 2, 8, 'glass');
            }

            // Building 2: Red Brick Apartments
            _addPlatform(world, 20, 0, -20, 10, 12, 10, 'brick');
            _addPlatform(world, 20, 12, -20, 10, 1, 10, 'plank');

            // Building 3: Modern Hub
            _addPlatform(world, -20, 0, 20, 14, 8, 14, 'iron');
            _addPlatform(world, -20, 8, 20, 10, 4, 10, 'glass');

            // Central Fountain
            _addPlatform(world, 0, 0, 0, 6, 0.5, 6, 'stone');
            _addPlatform(world, 0, 0.5, 0, 4, 0.5, 4, 'water');

            // Trees and Benches
            for(let i=0; i<4; i++) {
                const ang = (i/4) * Math.PI * 2;
                const tx = Math.cos(ang) * 10;
                const tz = Math.sin(ang) * 10;
                // Trunk
                for(let ty=0; ty<4; ty++) World.addBlock(Math.round(tx), ty, Math.round(tz), 'wood');
                // Leaves
                _addPlatform(world, tx, 4, tz, 3, 2, 3, 'leaf');
            }

            console.log('[Templates] Detailed City generated successfully');
        }
    };

    // =====================================================
    // HELPER FUNCTIONS
    // =====================================================

    function _addPlatform(world, x, y, z, width, height, depth, blockType, options = {}) {
        if (!world || !world.blockMap) return;

        for (let xx = x - width / 2; xx < x + width / 2; xx++) {
            for (let yy = y; yy < y + height; yy++) {
                for (let zz = z - depth / 2; zz < z + depth / 2; zz++) {
                    World.addBlock(Math.round(xx), Math.round(yy), Math.round(zz), blockType);
                }
            }
        }
    }

    function _addWall(world, x, y, z, thickness, height, length, blockType) {
        if (!world || !world.blockMap) return;

        for (let xx = x - thickness / 2; xx < x + thickness / 2; xx++) {
            for (let yy = y; yy < y + height; yy++) {
                for (let zz = z - length / 2; zz < z + length / 2; zz++) {
                    World.addBlock(Math.round(xx), Math.round(yy), Math.round(zz), blockType);
                }
            }
        }
    }

    // =====================================================
    // PUBLIC API
    // =====================================================

    const templates = {
        obby,
        arena,
        parkour,
        city,
    };

    return {
        templates,

        getTemplateList() {
            return Object.values(templates).map(t => ({
                id: Object.keys(templates).find(k => templates[k] === t),
                name: t.name,
                description: t.description,
                difficulty: t.difficulty,
            }));
        },

        getTemplate(id) {
            return templates[id];
        },

        async generateGame(templateId, world) {
            const template = templates[templateId];
            if (!template) {
                console.warn(`[Templates] Unknown template: ${templateId}`);
                return false;
            }

            try {
                template.generate(world);
                return true;
            } catch (err) {
                console.error(`[Templates] Error generating ${templateId}:`, err);
                return false;
            }
        },
    };
})();
