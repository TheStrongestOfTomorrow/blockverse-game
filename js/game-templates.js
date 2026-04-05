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
        description: 'Parkour obstacle course - jump to survive!',
        difficulty: 'Medium',

        generate(world) {
            console.log('[Templates] Generating Obby...');

            // Spawn platform
            _addPlatform(world, 0, 0, 0, 8, 1, 8, 'stone');

            // Stage 1: Jump sequence (Y steps)
            for (let i = 0; i < 8; i++) {
                _addPlatform(world, i * 3, 3 + i * 1.5, 0, 3, 0.5, 3, 'stone');
            }

            // Stage 2: Moving platforms (simulated with obstacles)
            for (let i = 0; i < 6; i++) {
                _addPlatform(world, 25, 15 + i * 2, -5 - i * 2, 2, 0.5, 2, 'glass');
            }

            // Stage 3: Rotating obstacles
            for (let i = 0; i < 5; i++) {
                _addPlatform(world, 30 + i * 3, 12, 0, 1.5, 3, 1.5, 'iron');
            }

            // Stage 4: Jump pads (use colored stone to indicate)
            _addPlatform(world, 50, 5, 0, 4, 0.5, 4, 'stone', { highlight: true });

            // Finish platform
            _addPlatform(world, 55, 5, 15, 6, 1, 6, 'grass');

            // Add decorative walls
            _addWall(world, -5, 0, -5, 0.5, 30, 30, 'stone');
            _addWall(world, 65, 0, -5, 0.5, 30, 30, 'stone');

            console.log('[Templates] Obby generated successfully');
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
        description: 'Urban environment with buildings and streets',
        difficulty: 'Easy',

        generate(world) {
            console.log('[Templates] Generating City...');

            // Streets
            _addPlatform(world, 0, 0, 0, 100, 0.5, 10, 'stone');
            _addPlatform(world, 0, 0, -15, 100, 0.5, 10, 'stone');

            // Buildings (varying heights)
            const buildings = [
                { x: -15, y: 1, z: 5, w: 8, h: 10, d: 8 },
                { x: -15, y: 1, z: -20, w: 8, h: 15, d: 8 },
                { x: 10, y: 1, z: 5, w: 6, h: 12, d: 6 },
                { x: 10, y: 1, z: -20, w: 10, h: 8, d: 10 },
                { x: 35, y: 1, z: 5, w: 8, h: 14, d: 8 },
            ];

            buildings.forEach(b => {
                // Building base
                _addPlatform(world, b.x, b.y, b.z, b.w, b.h, b.d, 'stone');
                // Roof
                _addPlatform(world, b.x, b.y + b.h, b.z, b.w, 0.5, b.d, 'iron');
            });

            // Trees (decorative)
            for (let i = 0; i < 10; i++) {
                const x = -30 + i * 7;
                _addPlatform(world, x, 0, -25, 1, 6, 1, 'leaf');
            }

            console.log('[Templates] City generated successfully');
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
