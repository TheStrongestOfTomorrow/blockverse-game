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
    let _raycastResult = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, distance: 0 };

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
                data: new Uint32Array(MAX_INSTANCES), // Store only the numeric blockKey
                keyToIndex: new Map(), // O(1) lookup: key -> index
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

    /**
     * Add a block to the InstancedMesh system.
     * @param {number} x, y, z
     * @param {string} type
     * @param {boolean} [skipUpdate=false] If true, skip setting needsUpdate (use for batching)
     */
    function addBlock(x, y, z, type, skipUpdate = false) {
        const inst = _instances[type];
        if (!inst) {
            console.warn('[BlockRenderer] Unknown block type:', type);
            return false;
        }

        const key = blockKey(x, y, z);
        // Already rendered?
        if (inst.keyToIndex.has(key)) return false;

        if (inst.count >= MAX_INSTANCES) {
            console.warn('[BlockRenderer] Max instances reached for type:', type);
            return false;
        }

        const idx = inst.count;
        _tempMatrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
        inst.mesh.setMatrixAt(idx, _tempMatrix);

        inst.data[idx] = key;
        inst.keyToIndex.set(key, idx);
        inst.count++;

        // Try to set render count (works in most Three.js versions)
        try { inst.mesh.count = inst.count; } catch (e) { /* graceful fallback */ }

        if (!skipUpdate) {
            inst.mesh.instanceMatrix.needsUpdate = true;
        }

        return true;
    }

    /**
     * Remove a block from the InstancedMesh system.
     */
    function removeBlock(x, y, z, type, skipUpdate = false) {
        const inst = _instances[type];
        if (!inst || inst.count === 0) return false;

        const key = blockKey(x, y, z);
        const idx = inst.keyToIndex.has(key) ? inst.keyToIndex.get(key) : -1;

        if (idx === -1) return false;

        _removeAtIndex(inst, idx, skipUpdate);
        return true;
    }

    function _removeAtIndex(inst, idx, skipUpdate = false) {
        const lastIdx = inst.count - 1;
        const keyToRemove = inst.data[idx];

        if (idx !== lastIdx) {
            const lastKey = inst.data[lastIdx];
            // Swap with last instance — copy matrix from Float32Array
            const arr = inst.mesh.instanceMatrix.array;
            const srcOff = lastIdx * 16;
            const dstOff = idx * 16;
            for (let i = 0; i < 16; i++) {
                arr[dstOff + i] = arr[srcOff + i];
            }
            inst.data[idx] = lastKey;
            inst.keyToIndex.set(lastKey, idx);
        }

        inst.keyToIndex.delete(keyToRemove);
        inst.data[lastIdx] = 0;
        inst.count--;

        try { inst.mesh.count = inst.count; } catch (e) {}

        if (!skipUpdate) {
            inst.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    function isBlockRendered(x, y, z, type) {
        const inst = _instances[type];
        if (!inst) return false;
        return inst.keyToIndex.has(blockKey(x, y, z));
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
                _raycastResult.x = x;
                _raycastResult.y = y;
                _raycastResult.z = z;
                _raycastResult.nx = nx;
                _raycastResult.ny = ny;
                _raycastResult.nz = nz;
                _raycastResult.distance = t;
                return _raycastResult;
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
    /**
     * Rebuild visibility for all blocks using occlusion culling.
     * Batch process: clears all and re-adds only visible blocks.
     */
    function rebuildVisibility(blockMap) {
        if (!blockMap) return;

        const neighbors = [
            [1, 0, 0], [-1, 0, 0],
            [0, 1, 0], [0, -1, 0],
            [0, 0, 1], [0, 0, -1],
        ];

        // Step 1: Reset all instance counts (O(types) — fast)
        for (const type in _instances) {
            const inst = _instances[type];
            inst.count = 0;
            inst.keyToIndex.clear();
        }

        // Step 2: Occlusion check (O(N) — only rendered blocks added)
        const mapGet = blockMap.get.bind(blockMap);

        blockMap.forEach((block) => {
            const { x, y, z, type } = block;

            // Non-opaque (glass, water, leaf) never occlude neighbors and are always visible
            if (!isOpaque(type)) {
                addBlock(x, y, z, type, true);
                return;
            }

            // Check 6 faces for opaque neighbors
            let visibleFaces = 0;
            for (let i = 0; i < 6; i++) {
                const nKey = blockKey(x + neighbors[i][0], y + neighbors[i][1], z + neighbors[i][2]);
                const neighbor = mapGet(nKey);
                if (!neighbor || !isOpaque(neighbor.type)) {
                    visibleFaces++;
                }
            }

            if (visibleFaces > 0) {
                addBlock(x, y, z, type, true);
            }
        });

        // Step 3: Single GPU upload per type (O(types) — very fast)
        for (const type in _instances) {
            const inst = _instances[type];
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
            inst.data.fill(0);
            inst.keyToIndex.clear();
            inst.mesh.instanceMatrix.needsUpdate = true;
        }

        for (const key in _customMeshes) {
            const mesh = _customMeshes[key];
            if (mesh.parent) {
                mesh.parent.remove(mesh);
            }
            if (mesh.geometry) {
                mesh.geometry.dispose();
            }
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(mat => mat.dispose());
                } else if (mesh.material.dispose) {
                    mesh.material.dispose();
                }
            }
        }
        _customMeshes = {};
    }

    // =============================================
    // DISPOSE
    // =============================================

    function dispose() {
        clearAll();

        // Dispose all InstancedMesh instances and their materials
        for (const type in _instances) {
            const inst = _instances[type];
            if (inst.mesh) {
                // Dispose geometry and materials
                if (inst.mesh.geometry) inst.mesh.geometry.dispose();
                if (inst.mesh.material) {
                    if (Array.isArray(inst.mesh.material)) {
                        inst.mesh.material.forEach(mat => mat.dispose());
                    } else {
                        inst.mesh.material.dispose();
                    }
                }
                inst.mesh.dispose();
            }
        }

        // Dispose cached materials
        for (const type in _materials) {
            if (_materials[type]) {
                _materials[type].dispose();
            }
        }

        // Dispose custom painted blocks
        for (const key in _customMeshes) {
            const mesh = _customMeshes[key];
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(mat => mat.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        }

        _instances = {};
        _materials = {};
        _customMeshes = {};

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
        isBlockRendered,
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
