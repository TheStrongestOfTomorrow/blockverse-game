/**
 * Built-in Flavor Packs for BlockVerse
 */

// --- Medieval Pack ---
PackManager.registerPack({
    id: 'medieval',
    name: 'Medieval Pack',
    description: 'Ancient stones, wooden beams, and castle defenses.',
    autoActivate: true,
    blocks: {
        thatch: { name: 'Thatch', color: '#C2B280' },
        banner: { name: 'Banner', color: '#8B0000', emissive: '#440000' },
        torch:  { name: 'Torch',  color: '#FFA500', emissive: '#FF8C00' },
    },
    templates: {
        dungeon: {
            name: 'Dungeon',
            description: 'A dark, damp dungeon with torches and iron bars.',
            difficulty: 'Hard',
            generate(world) {
                // Large stone room
                for(let x=-10; x<=10; x++) {
                    for(let z=-10; z<=10; z++) {
                        World.addBlock(x, 0, z, 'cobble');
                        World.addBlock(x, 5, z, 'stone');
                        if (Math.abs(x) === 10 || Math.abs(z) === 10) {
                            for(let y=1; y<5; y++) World.addBlock(x, y, z, 'stone');
                        }
                    }
                }
                // Iron bars in the middle
                for(let y=1; y<5; y++) {
                    for(let i=-2; i<=2; i++) World.addBlock(i, y, 0, 'iron');
                }
                // Torches
                World.addBlock(9, 3, 9, 'torch');
                World.addBlock(-9, 3, -9, 'torch');
            }
        }
    },
    nodes: [
        {
            name: 'Play Fanfare',
            description: 'Play a heroic medieval fanfare.',
            inputs: [],
            outputType: 'action',
            code: 'Sound.play("fanfare", { volume: 0.8 });'
        }
    ]
});

// --- Space Pack ---
PackManager.registerPack({
    id: 'space',
    name: 'Space Pack',
    description: 'High-tech metals, neon lights, and zero-g vibes.',
    autoActivate: true,
    blocks: {
        neon_blue: { name: 'Neon Blue', color: '#00F3FF', emissive: '#00D1FF' },
        neon_pink: { name: 'Neon Pink', color: '#FF00FF', emissive: '#D100D1' },
        plating:   { name: 'Hull Plating', color: '#4A4A4A', castShadow: true },
    },
    templates: {
        moonbase: {
            name: 'Moonbase',
            description: 'A futuristic research station on the lunar surface.',
            difficulty: 'Medium',
            generate(world) {
                // Gray moon surface
                for(let x=-20; x<=20; x++) {
                    for(let z=-20; z<=20; z++) {
                        const h = Math.floor(Math.random() * 2);
                        World.addBlock(x, h, z, 'stone');
                    }
                }
                // Glass dome
                const radius = 8;
                for(let x=-radius; x<=radius; x++) {
                    for(let y=0; y<=radius; y++) {
                        for(let z=-radius; z<=radius; z++) {
                            const dist = Math.sqrt(x*x + y*y + z*z);
                            if (dist > radius - 0.5 && dist < radius + 0.5) {
                                World.addBlock(x, y+2, z, 'glass');
                            }
                        }
                    }
                }
                // Interior floor
                for(let x=-5; x<=5; x++) {
                    for(let z=-5; z<=5; z++) World.addBlock(x, 2, z, 'plating');
                }
            }
        }
    },
    nodes: [
        {
            name: 'Set Gravity',
            description: 'Change the world gravity.',
            inputs: [
                { name: 'value', type: 'number', default: '-10' }
            ],
            outputType: 'action',
            code: 'World.setGravity({{value}});'
        }
    ]
});
