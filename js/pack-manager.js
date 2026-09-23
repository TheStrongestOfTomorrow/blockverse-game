/**
 * BlockVerse Pack Manager
 * Handles "Flavor Packs" — modular collections of blocks, templates, and scripting nodes.
 */

const PackManager = (() => {
    'use strict';

    const _packs = new Map();
    const _activePacks = new Set();

    /**
     * Register a new Flavor Pack.
     * @param {object} pack - Pack definition.
     */
    function registerPack(pack) {
        if (!pack.id) {
            console.error('[PackManager] Pack missing ID:', pack);
            return;
        }
        _packs.set(pack.id, pack);
        console.log(`[PackManager] Registered pack: ${pack.name} (${pack.id})`);

        // Auto-activate if requested
        if (pack.autoActivate) {
            activatePack(pack.id);
        }
    }

    /**
     * Activate a pack, adding its content to the game.
     * @param {string} packId
     */
    function activatePack(packId) {
        const pack = _packs.get(packId);
        if (!pack) return;

        if (_activePacks.has(packId)) return;
        _activePacks.add(packId);

        // 1. Add blocks to BV.BLOCK_TYPES
        if (pack.blocks) {
            Object.assign(BV.BLOCK_TYPES, pack.blocks);
        }

        // 2. Add templates to GameTemplates
        if (pack.templates && typeof GameTemplates !== 'undefined') {
            Object.keys(pack.templates).forEach(id => {
                GameTemplates.templates[id] = pack.templates[id];
            });
        }

        // 3. Add custom nodes to CustomNodes
        if (pack.nodes && typeof CustomNodes !== 'undefined') {
            pack.nodes.forEach(node => {
                // Ensure nodes are registered in the palette
                CustomNodes.create(
                    node.name,
                    node.description,
                    node.inputs,
                    node.outputType,
                    node.code,
                    { category: pack.name, packId: pack.id }
                );
            });
        }

        console.log(`[PackManager] Activated pack: ${pack.name}`);

        // Notify systems of changes
        document.dispatchEvent(new CustomEvent('bv:pack_activated', { detail: { packId, pack } }));
    }

    /**
     * Get all registered packs.
     */
    function getPacks() {
        return Array.from(_packs.values());
    }

    /**
     * Get currently active packs.
     */
    function getActivePacks() {
        return Array.from(_activePacks).map(id => _packs.get(id));
    }

    return {
        registerPack,
        activatePack,
        getPacks,
        getActivePacks
    };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PackManager;
}
