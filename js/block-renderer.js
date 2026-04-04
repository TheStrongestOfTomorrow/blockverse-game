// ============================================
// BLOCKVERSE - Block Renderer (InstancedMesh)
// ============================================
// High-performance block rendering using InstancedMesh.
// One InstancedMesh per block type = ~16 draw calls instead of 10,000+.
// DDA voxel raycasting for cursor-based interaction.
// ============================================

const BlockRenderer = (() => {
    'use strict';

    const MAX_INSTANCES = 50000;

    // Per-type instance data
    let _instances = {};      // type -> { mesh, count, data[] }
    let _materials = {};      // type -> Material (cached)
    let _customMeshes = {};   // key -> Mesh (painted blocks)
    let _customGroup = null;
    let _geo = null;
    let _tempMatrix = null;

    // =============================================
    // INITIALIZATION
    // =============================================

    function init(scene) {
        _geo = new THREE.BoxGeometry(1, 1, 1);
        _tempMatrix = new THREE.Matrix4();

        _customGroup = new THREE.Group();
        _customGroup.name = 'custom-blocks';
        scene.add(_customGroup);

        // Create InstancedMesh for each block type
        for (const [type, config] of Object.entries(BV.BLOCK_TYPES)) {
            const mat = _createMaterial(type, config);
            _materials[type] = mat;

            const mesh = new THREE.InstancedMesh(_geo, mat, MAX_INSTANCES);
            mesh.name = 'blocks_' + type;
            // Shadow optimization: transparent blocks don't cast meaningful shadows
            mesh.castShadow = !config.transparent;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false; // Don't cull — we manage visibility ourselves

            // Initialize all matrices to zero scale (invisible)
            _tempMatrix.makeScale(0, 0, 0);
            for (let i = 0; i < MAX_INSTANCES; i++) {
                mesh.setMatrixAt(i, _tempMatrix);
            }
            mesh.instanceMatrix.needsUpdate = true;

            scene.add(mesh);

            _instances[type] = {
                mesh: mesh,
                count: 0,
                data: new Array(MAX_INSTANCES).fill(null),
            };
        }

        console.log('[BlockRenderer] Initialized with ' + Object.keys(_instances).length + ' block types, ' + MAX_INSTANCES + ' max instances each');
    }

    function _createMaterial(type, config) {
        const opts = { color: config.color };
        if (config.transparent) {
            opts.transparent = true;
            opts.opacity = config.opacity || 0.5;
        }
        const mat = new THREE.MeshLambertMaterial(opts);
        if (config.emissive) {
            mat.emissive = new THREE.Color(config.emissive);
            mat.emissiveIntensity = 0.4;
        }
        return mat;
    }

    // =============================================
    // BLOCK RENDERING (InstancedMesh)
    // =============================================

    function addBlock(x, y, z, type) {
        const inst = _instances[type];
        if (!inst) {
            console.warn('[BlockRenderer] Unknown block type:', type);
            return false;
        }

        if (inst.count >= MAX_INSTANCES) {
            console.warn('[BlockRenderer] Max instances reached for type:', type);
            return false;
        }

        const idx = inst.count;

        _tempMatrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
        inst.mesh.setMatrixAt(idx, _tempMatrix);

        inst.data[idx] = { x, y, z, key: blockKey(x, y, z) };
        inst.count++;

        // Try to set render count (works in most Three.js versions)
        try { inst.mesh.count = inst.count; } catch (e) { /* graceful fallback */ }

        inst.mesh.instanceMatrix.needsUpdate = true;

        return true;
    }

    function removeBlock(x, y, z, type) {
        const inst = _instances[type];
        if (!inst || inst.count === 0) return false;

        const key = blockKey(x, y, z);
        let idx = -1;

        for (let i = 0; i < inst.count; i++) {
            if (inst.data[i] && inst.data[i].key === key) {
                idx = i;
                break;
            }
        }

        if (idx === -1) return false;

        _removeAtIndex(inst, idx);
        return true;
    }

    function _removeAtIndex(inst, idx) {
        const lastIdx = inst.count - 1;

        if (idx !== lastIdx) {
            // Swap with last instance — copy matrix from Float32Array
            const arr = inst.mesh.instanceMatrix.array;
            const srcOff = lastIdx * 16;
            const dstOff = idx * 16;
            for (let i = 0; i < 16; i++) {
                arr[dstOff + i] = arr[srcOff + i];
            }
            inst.data[idx] = inst.data[lastIdx];
        }

        inst.data[lastIdx] = null;
        inst.count--;

        try { inst.mesh.count = inst.count; } catch (e) {}
        inst.mesh.instanceMatrix.needsUpdate = true;
    }

    // =============================================
    // CUSTOM MESHES (Painted Blocks)
    // =============================================

    function addCustomMesh(x, y, z, material) {
        const key = blockKey(x, y, z);

        if (_customMeshes[key]) {
            _customGroup.remove(_customMeshes[key]);
            if (_customMeshes[key].material && _customMeshes[key].material.dispose) {
                _customMeshes[key].material.dispose();
            }
        }

        const mesh = new THREE.Mesh(_geo, material);
        mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        _customGroup.add(mesh);
        _customMeshes[key] = mesh;

        return mesh;
    }

    function removeCustomMesh(x, y, z) {
        const key = blockKey(x, y, z);
        if (_customMeshes[key]) {
            _customGroup.remove(_customMeshes[key]);
            if (_customMeshes[key].material && _customMeshes[key].material.dispose) {
                _customMeshes[key].material.dispose();
            }
            delete _customMeshes[key];
            return true;
        }
        return false;
    }

    function getCustomMesh(x, y, z) {
        return _customMeshes[blockKey(x, y, z)] || null;
    }

    // =============================================
    // DDA VOXEL RAYCASTING
    // =============================================

    /**
     * Raycast through voxel grid using DDA algorithm.
     * Based on "A Fast Voxel Traversal Algorithm" by Amanatides & Woo.
     * Returns hit position + face normal. O(distance) — much faster than mesh raycasting.
     */
    function raycast(origin, direction, maxDist, blockMap) {
        if (!origin || !direction || !blockMap) return null;
        maxDist = maxDist || 10;

        let x = Math.floor(origin.x);
        let y = Math.floor(origin.y);
        let z = Math.floor(origin.z);

        const dx = direction.x;
        const dy = direction.y;
        const dz = direction.z;

        const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
        const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
        const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

        const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : 1e30;
        const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : 1e30;
        const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : 1e30;

        // Distance to next voxel boundary along each axis
        let tMaxX = dx > 0 ? ((x + 1) - origin.x) / dx : dx < 0 ? (x - origin.x) / dx : 1e30;
        let tMaxY = dy > 0 ? ((y + 1) - origin.y) / dy : dy < 0 ? (y - origin.y) / dy : 1e30;
        let tMaxZ = dz > 0 ? ((z + 1) - origin.z) / dz : dz < 0 ? (z - origin.z) / dz : 1e30;

        let nx = 0, ny = 0, nz = 0;
        let t = 0;

        for (let step = 0; step < 200; step++) {
            const key = blockKey(x, y, z);

            // Skip the block the camera is inside
            if (blockMap.get && blockMap.get(key) && t > 0.01) {
                return { x: x, y: y, z: z, nx: nx, ny: ny, nz: nz, distance: t };
            }

            // Advance to next voxel boundary
            if (tMaxX < tMaxY) {
                if (tMaxX < tMaxZ) {
                    t = tMaxX;
                    if (t > maxDist) break;
                    tMaxX += tDeltaX;
                    x += stepX;
                    nx = -stepX; ny = 0; nz = 0;
                } else {
                    t = tMaxZ;
                    if (t > maxDist) break;
                    tMaxZ += tDeltaZ;
                    z += stepZ;
                    nx = 0; ny = 0; nz = -stepZ;
                }
            } else {
                if (tMaxY < tMaxZ) {
                    t = tMaxY;
                    if (t > maxDist) break;
                    tMaxY += tDeltaY;
                    y += stepY;
                    nx = 0; ny = -stepY; nz = 0;
                } else {
                    t = tMaxZ;
                    if (t > maxDist) break;
                    tMaxZ += tDeltaZ;
                    z += stepZ;
                    nx = 0; ny = 0; nz = -stepZ;
                }
            }
        }

        return null;
    }

    // =============================================
    // BLOCK-LEVEL OCCLUSION CULLING
    // =============================================

    /**
     * Rebuild visibility for all blocks using occlusion culling.
     * A block is hidden (not rendered) if ALL 6 neighbors exist AND are opaque.
     * Transparent blocks are always visible.
     * Call after terrain generation and after every block add/remove.
     */
    function rebuildVisibility(blockMap) {
        if (!blockMap) return;

        const neighbors = [
            [1, 0, 0], [-1, 0, 0],
            [0, 1, 0], [0, -1, 0],
            [0, 0, 1], [0, 0, -1],
        ];

        // Step 1: Clear all InstancedMesh instances back to zero scale
        for (const type in _instances) {
            const inst = _instances[type];
            inst.count = 0;
            inst.data.fill(null);
        }

        // Step 2: For each block, check visibility and add to InstancedMesh if visible
        blockMap.forEach((block) => {
            const { x, y, z, type } = block;

            // Transparent blocks are always visible (no occlusion)
            if (!isOpaque(type)) {
                addBlock(x, y, z, type);
                return;
            }

            // Check all 6 neighbors
            let allOpaqueNeighbors = true;
            for (const [dx, dy, dz] of neighbors) {
                const nKey = blockKey(x + dx, y + dy, z + dz);
                const neighbor = blockMap.get ? blockMap.get(nKey) : blockMap[nKey];
                if (!neighbor || !isOpaque(neighbor.type)) {
                    allOpaqueNeighbors = false;
                    break;
                }
            }

            // If NOT fully surrounded by opaque neighbors, render it
            if (!allOpaqueNeighbors) {
                addBlock(x, y, z, type);
            }
        });

        // Step 3: Finalize — set zero-scale matrices for unused slots, update GPU
        _tempMatrix.makeScale(0, 0, 0);
        for (const type in _instances) {
            const inst = _instances[type];
            // Zero-scale remaining slots beyond count
            for (let i = inst.count; i < MAX_INSTANCES; i++) {
                inst.mesh.setMatrixAt(i, _tempMatrix);
            }
            try { inst.mesh.count = inst.count; } catch (e) {}
            inst.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    // =============================================
    // CLEAR ALL
    // =============================================

    function clearAll() {
        for (const type in _instances) {
            const inst = _instances[type];
            inst.count = 0;
            try { inst.mesh.count = 0; } catch (e) {}
            inst.data.fill(null);
            inst.mesh.instanceMatrix.needsUpdate = true;
        }

        for (const key in _customMeshes) {
            if (_customMeshes[key].parent) {
                _customMeshes[key].parent.remove(_customMeshes[key]);
            }
            if (_customMeshes[key].material && _customMeshes[key].material.dispose) {
                _customMeshes[key].material.dispose();
            }
        }
        _customMeshes = {};
    }

    // =============================================
    // DISPOSE
    // =============================================

    function dispose() {
        clearAll();

        for (const type in _instances) {
            if (_instances[type].mesh) {
                _instances[type].mesh.dispose();
            }
        }
        _instances = {};
        _materials = {};

        if (_geo) { _geo.dispose(); _geo = null; }
        if (_customGroup && _customGroup.parent) {
            _customGroup.parent.remove(_customGroup);
        }
        _customGroup = null;
    }

    // =============================================
    // STATS
    // =============================================

    function getStats() {
        let totalVisible = 0;
        for (const type in _instances) {
            totalVisible += _instances[type].count;
        }
        return {
            visible: totalVisible,
            custom: Object.keys(_customMeshes).length,
            types: Object.keys(_instances).length,
            maxPerType: MAX_INSTANCES,
        };
    }

    // =============================================
    // PUBLIC API
    // =============================================

    return {
        init,
        addBlock,
        removeBlock,
        addCustomMesh,
        removeCustomMesh,
        getCustomMesh,
        raycast,
        clearAll,
        dispose,
        getStats,
        rebuildVisibility,
        // Expose _instances for World.generateTerrain matrix flush
        get _instances() { return _instances; },
    };
})();
