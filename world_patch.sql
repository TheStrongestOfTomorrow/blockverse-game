<<<<<<< SEARCH
    loadBlocksSnapshot(blocks) {
        this.clearAll();
        if (!Array.isArray(blocks)) return;
        for (const b of blocks) {
            this.addBlock(b.x, b.y, b.z, b.type, false);
        }
    },
=======
    loadBlocksSnapshot(blocks) {
        this.clearAll();
        if (!Array.isArray(blocks)) return;
        for (const b of blocks) {
            this.addBlock(b.x, b.y, b.z, b.type, false);
            if (b.customColor) {
                const block = this.getBlock(b.x, b.y, b.z);
                if (block) {
                    block.customColor = b.customColor;
                    if (typeof BlockRenderer !== 'undefined') {
                        // Remove the standard block that addBlock might have added to InstancedMesh
                        BlockRenderer.removeBlock(b.x, b.y, b.z, b.type);
                        const mat = new THREE.MeshLambertMaterial({ color: b.customColor });
                        BlockRenderer.addCustomMesh(b.x, b.y, b.z, mat);
                    }
                }
            }
        }
        if (typeof BlockRenderer !== 'undefined') {
            BlockRenderer.rebuildVisibility(this.blockMap);
        }
    },
>>>>>>> REPLACE
