// ============================================
// BLOCKVERSE - World Engine (world.js)
// ============================================
// Manages the Three.js scene, rendering, blocks,
// lighting, terrain generation, and raycasting.
// ============================================

const World = {
    scene: null,
    camera: null,
    renderer: null,

    blockMap: {},
    blockCount: 0,

    _sharedBoxGeo: null,

    _blockGroup: null,
    _groundGroup: null,
    _skyMesh: null,
    _gridHelper: null,
    _highlightMesh: null,
    _highlightMode: null,
    _animClock: null,
    _lastTime: 0,

    _blockMeshArray: null,
    _blockMeshDirty: true,
    _running: false,

    playerGroup: null,

    // =============================================
    // INITIALIZATION
    // =============================================

    init(canvasElement) {
        const canvas = canvasElement || document.getElementById('game-canvas');
        if (!canvas) { console.warn('[World] No canvas found'); return; }

        // --- Renderer ---
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // --- Scene ---
        this.scene = new THREE.Scene();
        const fogColor = 0x87CEEB;
        this.scene.fog = new THREE.Fog(fogColor, 40, BV.RENDER_DISTANCE * BV.CHUNK_SIZE);
        this.scene.background = new THREE.Color(fogColor);

        // --- Camera ---
        this.camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(5, 7, 5);

        // --- Lighting ---
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xfff5e6, 0.8);
        sun.position.set(50, 80, 30);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 200;
        sun.shadow.camera.left = -60;
        sun.shadow.camera.right = 60;
        sun.shadow.camera.top = 60;
        sun.shadow.camera.bottom = -60;
        this.scene.add(sun);

        const hemi = new THREE.HemisphereLight(0x87CEEB, 0x8B7355, 0.3);
        this.scene.add(hemi);

        // --- Sky ---
        this._createSky();

        // --- Grid helper ---
        this._gridHelper = new THREE.GridHelper(64, 64, 0x444466, 0x333355);
        this._gridHelper.position.y = 0.01;
        this._gridHelper.material.transparent = true;
        this._gridHelper.material.opacity = 0.3;
        this.scene.add(this._gridHelper);

        // --- Shared geometry ---
        this._sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1);

        // --- Groups ---
        this._blockGroup = new THREE.Group();
        this._blockGroup.name = 'blocks';
        this.scene.add(this._blockGroup);

        this._groundGroup = new THREE.Group();
        this._groundGroup.name = 'terrain';
        this.scene.add(this._groundGroup);

        this.playerGroup = new THREE.Group();
        this.playerGroup.name = 'players';
        this.scene.add(this.playerGroup);

        // --- Highlight wireframe ---
        const hlGeo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
        const hlMat = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.7,
            depthTest: true,
        });
        this._highlightMesh = new THREE.Mesh(hlGeo, hlMat);
        this._highlightMesh.visible = false;
        this.scene.add(this._highlightMesh);

        // --- Clock ---
        this._animClock = new THREE.Clock();

        // --- Resize ---
        this._onResize = this.resize.bind(this);
        window.addEventListener('resize', this._onResize);

        // --- Start render loop ---
        this._lastTime = performance.now();
        this._running = true;
        this._loop();
    },

    _loop() {
        if (!this._running) return;
        requestAnimationFrame(() => this._loop());

        const now = performance.now();
        const dt = (now - this._lastTime) / 1000;
        this._lastTime = now;

        this.update(dt);
        this.render();
    },

    stop() {
        this._running = false;
        window.removeEventListener('resize', this._onResize);
    },

    // =============================================
    // FRAME UPDATE & RENDER
    // =============================================

    update(deltaTime) {
        const far = BV.RENDER_DISTANCE * BV.CHUNK_SIZE;
        if (this.scene.fog) {
            this.scene.fog.far = far;
            this.scene.fog.near = far * 0.4;
        }

        if (this._highlightMesh && this._highlightMesh.visible) {
            const pulse = 0.5 + 0.3 * Math.sin(performance.now() * 0.006);
            this._highlightMesh.material.opacity = pulse;
        }
    },

    render() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    },

    resize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    onResize() { this.resize(); },

    clearWorld() {
        this.clearAll();
        this.stop();
        if (this._sharedBoxGeo) {
            this._sharedBoxGeo.dispose();
            this._sharedBoxGeo = null;
        }
        this._blockMeshArray = null;
        this._running = false;
    },

    // =============================================
    // SKY
    // =============================================

    _createSky() {
        const skyGeo = new THREE.SphereGeometry(400, 32, 15);

        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#1a237e');
        gradient.addColorStop(0.3, '#42a5f5');
        gradient.addColorStop(0.6, '#87CEEB');
        gradient.addColorStop(1.0, '#B3E5FC');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 256);

        const skyTex = new THREE.CanvasTexture(canvas);
        const skyMat = new THREE.MeshBasicMaterial({
            map: skyTex,
            side: THREE.BackSide,
            fog: false,
        });
        this._skyMesh = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(this._skyMesh);
    },

    // =============================================
    // TERRAIN GENERATION
    // =============================================

    _noiseHeight(x, z, scale = 0.08, amplitude = 6) {
        let h = 0;
        h += Math.sin(x * scale + 1.3) * Math.cos(z * scale + 0.7) * amplitude;
        h += Math.sin(x * scale * 2.1 + 4.0) * Math.cos(z * scale * 2.3 + 2.5) * amplitude * 0.4;
        h += Math.sin(x * scale * 0.5 + 0.2) * Math.cos(z * scale * 0.6 + 3.0) * amplitude * 0.6;
        return h;
    },

    generateTerrain(template) {
        this.clearAll();

        switch (template) {
            case 'empty': this._generateEmpty(); break;
            case 'flat': this._generateFlat(); break;
            case 'hills': this._generateHills(); break;
            case 'obby': this._generateObby(); break;
            case 'city': this._generateCity(); break;
            case 'arena': this._generateArena(); break;
            default:
                console.warn(`[World] Unknown terrain template: "${template}", using flat.`);
                this._generateFlat();
        }
    },

    /** Empty world — stone floor platform so players don't fall through. */
    _generateEmpty() {
        const size = 32;
        const half = Math.floor(size / 2);

        // Stone base layer for collision
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'stone', false);
                this.addBlock(x, 0, z, 'grass', false);
            }
        }
    },

    /** 32x32 grass on y=0, dirt on y=-1. */
    _generateFlat() {
        const size = 32;
        const half = Math.floor(size / 2);

        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'dirt', false);
                this.addBlock(x, 0, z, 'grass', false);
            }
        }
    },

    /** Rolling terrain using sin/cos noise. */
    _generateHills() {
        const size = 48;
        const half = Math.floor(size / 2);

        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                const h = this._noiseHeight(x, z, 0.08, 5);
                const topY = Math.round(h);
                this.addBlock(x, topY - 2, z, 'stone', false);
                this.addBlock(x, topY - 1, z, 'dirt', false);
                if (topY >= -1) {
                    this.addBlock(x, topY, z, 'grass', false);
                }
            }
        }
    },

    /** Obstacle course */
    _generateObby() {
        // Start platform
        for (let x = 0; x < 4; x++) {
            for (let z = 0; z < 4; z++) {
                this.addBlock(x, 0, z, 'stone', false);
            }
        }

        const platformCount = 12;
        let curX = 4, curY = 0, curZ = 2;

        for (let i = 0; i < platformCount; i++) {
            const dirs = [
                { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
                { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
            ];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            const gap = 2 + Math.floor(Math.random() * 3);
            curX += dir.dx * gap;
            curZ += dir.dz * gap;
            const pSize = 2 + Math.floor(Math.random() * 4);
            const heightChange = Math.random() < 0.4 ? 1 : (Math.random() < 0.5 ? 0 : -1);
            curY = Math.max(0, curY + heightChange);

            const types = ['stone', 'plank', 'brick', 'sand', 'cobble'];
            const blockType = types[Math.floor(Math.random() * types.length)];

            for (let px = 0; px < pSize; px++) {
                for (let pz = 0; pz < pSize; pz++) {
                    this.addBlock(curX + px, curY, curZ + pz, blockType, false);
                }
            }

            if (i % 3 === 0 && i > 0) {
                const centerX = curX + Math.floor(pSize / 2);
                const centerZ = curZ + Math.floor(pSize / 2);
                this.addBlock(centerX, curY + 1, centerZ, 'gold', false);
            }
        }
    },

    /** City */
    _generateCity() {
        const groundSize = 48;
        const half = Math.floor(groundSize / 2);
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'stone', false);
                this.addBlock(x, 0, z, 'cobble', false);
            }
        }

        const spacing = 7;
        const buildingRange = 3;
        for (let bx = -buildingRange; bx <= buildingRange; bx++) {
            for (let bz = -buildingRange; bz <= buildingRange; bz++) {
                if (Math.abs(bx) <= 0 && Math.abs(bz) <= 0) continue;

                const baseX = bx * spacing - 1;
                const baseZ = bz * spacing - 1;
                const width = 2 + Math.floor(Math.random() * 3);
                const depth = 2 + Math.floor(Math.random() * 3);
                const height = 3 + Math.floor(Math.random() * 6);
                const wallType = Math.random() < 0.5 ? 'brick' : 'stone';
                const topType = 'plank';

                for (let wx = 0; wx < width; wx++) {
                    for (let wz = 0; wz < depth; wz++) {
                        for (let wy = 1; wy <= height; wy++) {
                            const isEdgeX = (wx === 0 || wx === width - 1);
                            const isEdgeZ = (wz === 0 || wz === depth - 1);
                            if (isEdgeX || isEdgeZ) {
                                this.addBlock(baseX + wx, wy, baseZ + wz, wallType, false);
                            } else if (wy === height) {
                                this.addBlock(baseX + wx, wy, baseZ + wz, topType, false);
                            }
                        }
                    }
                }
            }
        }
    },

    /** Arena */
    _generateArena() {
        const size = 20;
        const half = Math.floor(size / 2);
        const wallHeight = 5;

        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'stone', false);
                this.addBlock(x, 0, z, 'cobble', false);
            }
        }

        for (let y = 1; y <= wallHeight; y++) {
            for (let i = -half; i < half; i++) {
                this.addBlock(i, y, -half, 'brick', false);
                this.addBlock(i, y, half - 1, 'brick', false);
                this.addBlock(-half, y, i, 'brick', false);
                this.addBlock(half - 1, y, i, 'brick', false);
            }
        }

        const corners = [
            [-half, -half], [-half, half - 1],
            [half - 1, -half], [half - 1, half - 1],
        ];
        for (const [cx, cz] of corners) {
            for (let y = 1; y <= wallHeight + 2; y++) {
                this.addBlock(cx, y, cz, 'stone', false);
            }
            this.addBlock(cx, wallHeight + 3, cz, 'gold', false);
        }

        this.addBlock(0, 1, 0, 'diamond', false);
    },

    // =============================================
    // BLOCK MANAGEMENT
    // =============================================

    addBlock(x, y, z, blockType, emitEvent = false) {
        x = Math.round(x);
        y = Math.round(y);
        z = Math.round(z);

        if (y < -32 || y > BV.WORLD_HEIGHT_LIMIT) return false;

        const key = `${x},${y},${z}`;
        if (this.blockMap[key]) return false;

        const config = BV.BLOCK_TYPES[blockType];
        if (!config) {
            console.warn(`[World] Unknown block type: "${blockType}"`);
            return false;
        }

        const geo = this._sharedBoxGeo;
        const matOpts = { color: config.color };
        if (config.transparent) {
            matOpts.transparent = true;
            matOpts.opacity = config.opacity || 0.5;
        }
        const mat = new THREE.MeshLambertMaterial(matOpts);

        if (config.emissive) {
            mat.emissive = new THREE.Color(config.emissive);
            mat.emissiveIntensity = 0.4;
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = `block_${blockType}`;

        this._blockGroup.add(mesh);

        const blockData = { x, y, z, type: blockType, mesh };
        this.blockMap[key] = blockData;
        this.blockCount++;
        this._blockMeshDirty = true;

        if (emitEvent) {
            const event = new CustomEvent('block:place', {
                detail: { x, y, z, type: blockType },
            });
            window.dispatchEvent(event);
        }

        return true;
    },

    removeBlock(x, y, z, emitEvent = false) {
        x = Math.round(x);
        y = Math.round(y);
        z = Math.round(z);

        const key = `${x},${y},${z}`;
        const block = this.blockMap[key];
        if (!block) return false;

        this._blockGroup.remove(block.mesh);
        if (block.mesh.material.dispose) block.mesh.material.dispose();

        delete this.blockMap[key];
        this.blockCount--;
        this._blockMeshDirty = true;

        if (emitEvent) {
            const event = new CustomEvent('block:remove', {
                detail: { x, y, z, type: block.type },
            });
            window.dispatchEvent(event);
        }

        return true;
    },

    getBlock(x, y, z) {
        const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
        return this.blockMap[key] || null;
    },

    getBlocksSnapshot() {
        const blocks = [];
        for (const key of Object.keys(this.blockMap)) {
            const b = this.blockMap[key];
            blocks.push({ x: b.x, y: b.y, z: b.z, type: b.type });
        }
        return blocks;
    },

    loadBlocksSnapshot(blocks) {
        this.clearAll();
        if (!Array.isArray(blocks)) return;
        for (const b of blocks) {
            this.addBlock(b.x, b.y, b.z, b.type, false);
        }
    },

    clearAll() {
        for (const key of Object.keys(this.blockMap)) {
            const b = this.blockMap[key];
            if (b.mesh) {
                this._blockGroup.remove(b.mesh);
                if (b.mesh.material.dispose) b.mesh.material.dispose();
            }
        }
        this.blockMap = {};
        this.blockCount = 0;
        this._blockMeshArray = null;
        this._blockMeshDirty = true;

        while (this._groundGroup.children.length > 0) {
            const child = this._groundGroup.children[0];
            this._groundGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                if (child.material.dispose) child.material.dispose();
            }
        }

        if (this._gridHelper) this._gridHelper.visible = true;
    },

    // =============================================
    // RAYCASTING
    // =============================================

    getRaycastTarget(origin, direction, maxDist = 8) {
        if (!origin || !direction) return null;

        if (this._blockMeshDirty || !this._blockMeshArray) {
            this._blockMeshArray = Object.values(this.blockMap).map(b => b.mesh);
            this._blockMeshDirty = false;
        }

        if (this._blockMeshArray.length === 0) return null;

        const raycaster = new THREE.Raycaster();
        raycaster.set(origin, direction.clone().normalize());
        raycaster.far = maxDist;

        const intersections = raycaster.intersectObjects(this._blockMeshArray, false);
        if (intersections.length === 0) return null;

        const hit = intersections[0];
        const mesh = hit.object;
        const bx = Math.round(mesh.position.x - 0.5);
        const by = Math.round(mesh.position.y - 0.5);
        const bz = Math.round(mesh.position.z - 0.5);

        const normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);

        return {
            position: { x: bx, y: by, z: bz },
            normal: { nx: Math.round(normal.x), ny: Math.round(normal.y), nz: Math.round(normal.z) },
            mesh: mesh,
            distance: hit.distance,
        };
    },

    // =============================================
    // BLOCK HIGHLIGHTING
    // =============================================

    highlightBlock(position, normal, mode = 'place') {
        if (!this._highlightMesh) return;

        const colors = {
            place: 0x00ff00,
            delete: 0xff0000,
            paint: 0x2196F3,
            grab: 0xFFD700,
        };
        this._highlightMesh.material.color.setHex(colors[mode] || colors.place);
        this._highlightMode = mode;

        if (mode === 'place' && normal) {
            this._highlightMesh.position.set(
                position.x + normal.nx + 0.5,
                position.y + normal.ny + 0.5,
                position.z + normal.nz + 0.5
            );
        } else {
            this._highlightMesh.position.set(
                position.x + 0.5,
                position.y + 0.5,
                position.z + 0.5
            );
        }

        this._highlightMesh.visible = true;
    },

    removeHighlight() {
        if (this._highlightMesh) {
            this._highlightMesh.visible = false;
        }
        this._highlightMode = null;
    },

    shouldBlockGravity(x, y, z) {
        return !!this.getBlock(x, y - 1, z);
    },
};
