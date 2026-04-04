// ============================================
// BLOCKVERSE - World Engine (world.js)
// ============================================
// Manages the Three.js scene, rendering, blocks,
// lighting, terrain generation, and raycasting.
// Three.js is loaded globally as `THREE`.
// Config is loaded from config.js as `BV` / `Utils`.
// ============================================

const World = {
    // --- Core Three.js objects (set during init) ---
    scene: null,
    camera: null,
    renderer: null,

    // --- Block storage ---
    blockMap: {},           // key "${x},${y},${z}" -> { x, y, z, type, mesh }

    // --- Internal state ---
    _blockGroup: null,      // THREE.Group holding all block meshes
    _groundGroup: null,     // THREE.Group for terrain ground elements
    _skyMesh: null,         // Sky sphere
    _gridHelper: null,      // Reference grid on ground
    _highlightMesh: null,   // Wireframe highlight box
    _highlightMode: null,   // 'place' | 'delete' | 'paint' | 'grab'
    _animClock: null,       // Clock for delta-time tracking
    _lastTime: 0,           // Last frame timestamp

    // Player group for remote avatars
    playerGroup: null,

    // =============================================
    // INITIALIZATION
    // =============================================

    /**
     * Initialize the Three.js scene, renderer, camera, lighting, sky, and ground grid.
     * @param {HTMLCanvasElement} canvasElement - The canvas to render into.
     */
    init(canvasElement) {
        const canvas = canvasElement || document.getElementById('game-canvas');
        if (!canvas) { console.warn('[World] No canvas found'); return; }

        // --- Renderer ---
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // --- Scene ---
        this.scene = new THREE.Scene();
        const fogColor = 0x87CEEB; // Sky blue to match skybox
        this.scene.fog = new THREE.Fog(fogColor, 40, BV.RENDER_DISTANCE * BV.CHUNK_SIZE);
        this.scene.background = new THREE.Color(fogColor);

        // --- Camera ---
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(8, 5, 8);

        // --- Lighting ---
        // Ambient: soft fill
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        // Directional: sun
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

        // Hemisphere: sky blue above, brown below
        const hemi = new THREE.HemisphereLight(0x87CEEB, 0x8B7355, 0.3);
        this.scene.add(hemi);

        // --- Sky sphere ---
        this._createSky();

        // --- Ground grid helper (subtle reference) ---
        this._gridHelper = new THREE.GridHelper(64, 64, 0x444466, 0x333355);
        this._gridHelper.position.y = 0.01;
        this._gridHelper.material.transparent = true;
        this._gridHelper.material.opacity = 0.3;
        this.scene.add(this._gridHelper);

        // --- Groups for organized management ---
        this._blockGroup = new THREE.Group();
        this._blockGroup.name = 'blocks';
        this.scene.add(this._blockGroup);

        this._groundGroup = new THREE.Group();
        this._groundGroup.name = 'terrain';
        this.scene.add(this._groundGroup);

        this.playerGroup = new THREE.Group();
        this.playerGroup.name = 'players';
        this.scene.add(this.playerGroup);

        // --- Highlight wireframe (reusable) ---
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

        // --- Resize handler ---
        this._onResize = this.resize.bind(this);
        window.addEventListener('resize', this._onResize);

        // --- Start render loop ---
        this._lastTime = performance.now();
        this._running = true;
        this._loop();
    },

    /**
     * Main animation / render loop.
     */
    _loop() {
        if (!this._running) return;
        requestAnimationFrame(() => this._loop());

        const now = performance.now();
        const dt = (now - this._lastTime) / 1000;
        this._lastTime = now;

        this.update(dt);
        this.render();
    },

    /**
     * Stop the render loop (call when leaving game).
     */
    stop() {
        this._running = false;
        window.removeEventListener('resize', this._onResize);
    },

    // =============================================
    // FRAME UPDATE & RENDER
    // =============================================

    /**
     * Called every frame. Updates animations and fog.
     * @param {number} deltaTime - Time since last frame in seconds.
     */
    update(deltaTime) {
        // Fog follows render distance setting
        const far = BV.RENDER_DISTANCE * BV.CHUNK_SIZE;
        if (this.scene.fog) {
            this.scene.fog.far = far;
            this.scene.fog.near = far * 0.4;
        }

        // Animate highlight wireframe pulse
        if (this._highlightMesh && this._highlightMesh.visible) {
            const pulse = 0.5 + 0.3 * Math.sin(performance.now() * 0.006);
            this._highlightMesh.material.opacity = pulse;
        }
    },

    /**
     * Render the scene from the camera's perspective.
     */
    render() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    },

    /**
     * Handle window resize — update camera aspect and renderer size.
     */
    resize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    /**
     * Handle resize event (alias for resize).
     */
    onResize() {
        this.resize();
    },

    /**
     * Clear the world and stop the render loop. Called when leaving a game.
     */
    clearWorld() {
        this.clearAll();
        this.stop();
    },

    // =============================================
    // SKY
    // =============================================

    /**
     * Create a large sky sphere with vertical gradient material.
     */
    _createSky() {
        const skyGeo = new THREE.SphereGeometry(400, 32, 15);

        // Build gradient texture via canvas
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#1a237e');   // dark blue top
        gradient.addColorStop(0.3, '#42a5f5');  // mid blue
        gradient.addColorStop(0.6, '#87CEEB');  // light blue
        gradient.addColorStop(1.0, '#B3E5FC');  // pale horizon
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 256);

        const skyTex = new THREE.CanvasTexture(canvas);
        const skyMat = new THREE.MeshBasicMaterial({
            map: skyTex,
            side: THREE.BackSide,
            fog: false, // Sky should not be affected by fog
        });
        this._skyMesh = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(this._skyMesh);
    },

    // =============================================
    // TERRAIN GENERATION
    // =============================================

    /**
     * Simple pseudo-noise using layered sin/cos for heightmaps.
     * Not true Perlin, but produces smooth rolling terrain.
     * @param {number} x
     * @param {number} z
     * @param {number} scale - Controls hill size (lower = bigger hills)
     * @param {number} amplitude - Max height offset
     * @returns {number} Height value (can be fractional)
     */
    _noiseHeight(x, z, scale = 0.08, amplitude = 6) {
        let h = 0;
        // Two octaves of sin/cos for variety
        h += Math.sin(x * scale + 1.3) * Math.cos(z * scale + 0.7) * amplitude;
        h += Math.sin(x * scale * 2.1 + 4.0) * Math.cos(z * scale * 2.3 + 2.5) * amplitude * 0.4;
        h += Math.sin(x * scale * 0.5 + 0.2) * Math.cos(z * scale * 0.6 + 3.0) * amplitude * 0.6;
        return h;
    },

    /**
     * Generate terrain based on a template string.
     * @param {string} template - 'empty' | 'flat' | 'hills' | 'obby' | 'city' | 'arena'
     */
    generateTerrain(template) {
        // Clear existing terrain blocks
        this.clearAll();

        switch (template) {
            case 'empty':
                this._generateEmpty();
                break;
            case 'flat':
                this._generateFlat();
                break;
            case 'hills':
                this._generateHills();
                break;
            case 'obby':
                this._generateObby();
                break;
            case 'city':
                this._generateCity();
                break;
            case 'arena':
                this._generateArena();
                break;
            default:
                console.warn(`[World] Unknown terrain template: "${template}", using empty.`);
                this._generateEmpty();
        }
    },

    /** Empty world — just a flat ground plane. */
    _generateEmpty() {
        // Add an invisible ground plane for raycasting / reference
        const planeGeo = new THREE.PlaneGeometry(200, 200);
        const planeMat = new THREE.MeshLambertMaterial({
            color: 0x4CAF50,
            transparent: true,
            opacity: 0.15,
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -0.01;
        plane.receiveShadow = true;
        plane.name = 'groundPlane';
        this._groundGroup.add(plane);
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
                // Bottom stone layer
                this.addBlock(x, topY - 2, z, 'stone', false);
                // Dirt layer
                this.addBlock(x, topY - 1, z, 'dirt', false);
                // Grass on top
                if (topY >= -1) {
                    this.addBlock(x, topY, z, 'grass', false);
                }
            }
        }
    },

    /** Obstacle course — series of platforms at increasing heights with gaps. */
    _generateObby() {
        // Start platform
        for (let x = 0; x < 4; x++) {
            for (let z = 0; z < 4; z++) {
                this.addBlock(x, 0, z, 'stone', false);
            }
        }

        const platformCount = 12;
        let curX = 4;
        let curY = 0;
        let curZ = 2;

        for (let i = 0; i < platformCount; i++) {
            // Random direction: +x, -x, +z, -z
            const dirs = [
                { dx: 1, dz: 0 },
                { dx: -1, dz: 0 },
                { dx: 0, dz: 1 },
                { dx: 0, dz: -1 },
            ];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];

            // Gap of 2-4 blocks
            const gap = 2 + Math.floor(Math.random() * 3);
            curX += dir.dx * gap;
            curZ += dir.dz * gap;

            // Random platform size 2-5
            const pSize = 2 + Math.floor(Math.random() * 4);

            // Height changes
            const heightChange = Math.random() < 0.4 ? 1 : (Math.random() < 0.5 ? 0 : -1);
            curY = Math.max(0, curY + heightChange);

            // Varying block types for visual interest
            const types = ['stone', 'plank', 'brick', 'sand', 'cobble'];
            const blockType = types[Math.floor(Math.random() * types.length)];

            // Build platform
            for (let px = 0; px < pSize; px++) {
                for (let pz = 0; pz < pSize; pz++) {
                    this.addBlock(curX + px, curY, curZ + pz, blockType, false);
                }
            }

            // Add checkpoint marker every 3 platforms
            if (i % 3 === 0 && i > 0) {
                const centerX = curX + Math.floor(pSize / 2);
                const centerZ = curZ + Math.floor(pSize / 2);
                this.addBlock(centerX, curY + 1, centerZ, 'gold', false);
            }
        }
    },

    /** City — grid of "buildings" (stone/brick columns with wood tops) on flat ground. */
    _generateCity() {
        // Flat ground
        const groundSize = 48;
        const half = Math.floor(groundSize / 2);
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'stone', false);
                this.addBlock(x, 0, z, 'cobble', false);
            }
        }

        // Buildings on a grid
        const spacing = 7;
        const buildingRange = 3; // -3 to 3 in both axes

        for (let bx = -buildingRange; bx <= buildingRange; bx++) {
            for (let bz = -buildingRange; bz <= buildingRange; bz++) {
                // Skip center area for spawn
                if (Math.abs(bx) <= 0 && Math.abs(bz) <= 0) continue;

                const baseX = bx * spacing - 1;
                const baseZ = bz * spacing - 1;
                const width = 2 + Math.floor(Math.random() * 3);
                const depth = 2 + Math.floor(Math.random() * 3);
                const height = 3 + Math.floor(Math.random() * 6);

                const wallType = Math.random() < 0.5 ? 'brick' : 'stone';
                const topType = 'plank';

                // Hollow building: walls and roof
                for (let wx = 0; wx < width; wx++) {
                    for (let wz = 0; wz < depth; wz++) {
                        for (let wy = 1; wy <= height; wy++) {
                            const isEdgeX = (wx === 0 || wx === width - 1);
                            const isEdgeZ = (wz === 0 || wz === depth - 1);
                            const isEdge = isEdgeX || isEdgeZ;

                            if (isEdge) {
                                // Walls
                                this.addBlock(baseX + wx, wy, baseZ + wz, wallType, false);
                            } else if (wy === height) {
                                // Roof
                                this.addBlock(baseX + wx, wy, baseZ + wz, topType, false);
                            }
                            // Interior is empty
                        }
                    }
                }
            }
        }
    },

    /** Arena — flat stone ground with walls around 20x20 area. */
    _generateArena() {
        const size = 20;
        const half = Math.floor(size / 2);
        const wallHeight = 5;

        // Stone floor
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'stone', false);
                this.addBlock(x, 0, z, 'cobble', false);
            }
        }

        // Walls around perimeter
        for (let y = 1; y <= wallHeight; y++) {
            for (let i = -half; i < half; i++) {
                // North & South walls
                this.addBlock(i, y, -half, 'brick', false);
                this.addBlock(i, y, half - 1, 'brick', false);
                // East & West walls
                this.addBlock(-half, y, i, 'brick', false);
                this.addBlock(half - 1, y, i, 'brick', false);
            }
        }

        // Corner pillars (stone, taller)
        const corners = [
            [-half, -half], [-half, half - 1],
            [half - 1, -half], [half - 1, half - 1],
        ];
        for (const [cx, cz] of corners) {
            for (let y = 1; y <= wallHeight + 2; y++) {
                this.addBlock(cx, y, cz, 'stone', false);
            }
            // Gold cap
            this.addBlock(cx, wallHeight + 3, cz, 'gold', false);
        }

        // Center marker
        this.addBlock(0, 1, 0, 'diamond', false);
    },

    // =============================================
    // BLOCK MANAGEMENT
    // =============================================

    /**
     * Place a block at the given integer grid position.
     * @param {number} x - Grid X
     * @param {number} y - Grid Y
     * @param {number} z - Grid Z
     * @param {string} blockType - Key from BV.BLOCK_TYPES
     * @param {boolean} emitEvent - Dispatch 'block:place' custom event
     * @returns {boolean} True if block was placed, false if occupied or invalid
     */
    addBlock(x, y, z, blockType, emitEvent = false) {
        x = Math.round(x);
        y = Math.round(y);
        z = Math.round(z);

        // Height limit check
        if (y < -32 || y > BV.WORLD_HEIGHT_LIMIT) return false;

        const key = `${x},${y},${z}`;

        // Occupied?
        if (this.blockMap[key]) return false;

        // Lookup block config
        const config = BV.BLOCK_TYPES[blockType];
        if (!config) {
            console.warn(`[World] Unknown block type: "${blockType}"`);
            return false;
        }

        // --- Create mesh ---
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const matOpts = {
            color: config.color,
        };
        if (config.transparent) {
            matOpts.transparent = true;
            matOpts.opacity = config.opacity || 0.5;
        }
        const mat = new THREE.MeshLambertMaterial(matOpts);

        // Emissive glow (for lava, gold, diamond, obsidian)
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

        // Store in block map
        const blockData = { x, y, z, type: blockType, mesh };
        this.blockMap[key] = blockData;

        // Dispatch event for multiplayer sync
        if (emitEvent) {
            const event = new CustomEvent('block:place', {
                detail: { x, y, z, type: blockType },
            });
            window.dispatchEvent(event);
        }

        return true;
    },

    /**
     * Remove a block at the given integer grid position.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {boolean} emitEvent - Dispatch 'block:remove' custom event
     * @returns {boolean} True if block was removed, false if not found
     */
    removeBlock(x, y, z, emitEvent = false) {
        x = Math.round(x);
        y = Math.round(y);
        z = Math.round(z);

        const key = `${x},${y},${z}`;
        const block = this.blockMap[key];
        if (!block) return false;

        // Remove mesh from scene
        this._blockGroup.remove(block.mesh);
        // Dispose geometry and material to free GPU memory
        block.mesh.geometry.dispose();
        if (block.mesh.material.dispose) block.mesh.material.dispose();

        // Delete from map
        delete this.blockMap[key];

        // Dispatch event
        if (emitEvent) {
            const event = new CustomEvent('block:remove', {
                detail: { x, y, z, type: block.type },
            });
            window.dispatchEvent(event);
        }

        return true;
    },

    /**
     * Get block data at a position, or null.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {object|null}
     */
    getBlock(x, y, z) {
        const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
        return this.blockMap[key] || null;
    },

    /**
     * Return a snapshot of all blocks as a plain array (serializable).
     * @returns {Array<{x:number, y:number, z:number, type:string}>}
     */
    getBlocksSnapshot() {
        const blocks = [];
        for (const key of Object.keys(this.blockMap)) {
            const b = this.blockMap[key];
            blocks.push({ x: b.x, y: b.y, z: b.z, type: b.type });
        }
        return blocks;
    },

    /**
     * Load blocks from a snapshot array (used when joining a game).
     * @param {Array<{x:number, y:number, z:number, type:string}>} blocks
     */
    loadBlocksSnapshot(blocks) {
        this.clearAll();
        if (!Array.isArray(blocks)) return;
        for (const b of blocks) {
            this.addBlock(b.x, b.y, b.z, b.type, false);
        }
    },

    /**
     * Remove all blocks, reset blockMap, clear terrain group.
     */
    clearAll() {
        // Remove all block meshes
        for (const key of Object.keys(this.blockMap)) {
            const b = this.blockMap[key];
            if (b.mesh) {
                this._blockGroup.remove(b.mesh);
                b.mesh.geometry.dispose();
                if (b.mesh.material.dispose) b.mesh.material.dispose();
            }
        }
        this.blockMap = {};

        // Clear ground group
        while (this._groundGroup.children.length > 0) {
            const child = this._groundGroup.children[0];
            this._groundGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                if (child.material.dispose) child.material.dispose();
            }
        }

        // Reset grid visibility
        if (this._gridHelper) this._gridHelper.visible = true;
    },

    // =============================================
    // RAYCASTING
    // =============================================

    /**
     * Cast a ray into the world to find the closest block intersection.
     * @param {THREE.Vector3} origin - Ray origin in world space
     * @param {THREE.Vector3} direction - Normalized ray direction
     * @param {number} maxDist - Maximum distance (default 8)
     * @returns {object|null} { position:{x,y,z}, normal:{nx,ny,nz}, mesh } or null
     */
    getRaycastTarget(origin, direction, maxDist = 8) {
        if (!origin || !direction) return null;

        const raycaster = new THREE.Raycaster();
        raycaster.set(origin, direction.normalize());
        raycaster.far = maxDist;

        // Collect all block meshes for intersection test
        const meshes = [];
        for (const key of Object.keys(this.blockMap)) {
            meshes.push(this.blockMap[key].mesh);
        }

        if (meshes.length === 0) return null;

        const intersections = raycaster.intersectObjects(meshes, false);
        if (intersections.length === 0) return null;

        const hit = intersections[0];
        // Determine the block grid position from mesh position
        const mesh = hit.object;
        const bx = Math.round(mesh.position.x - 0.5);
        const by = Math.round(mesh.position.y - 0.5);
        const bz = Math.round(mesh.position.z - 0.5);

        // Face normal: points outward from the face that was hit
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

    /**
     * Show a wireframe highlight on a block face.
     * @param {object} position - {x, y, z} block position (grid coords)
     * @param {object} normal - {nx, ny, nz} face normal direction
     * @param {string} mode - 'place' | 'delete' | 'paint' | 'grab'
     */
    highlightBlock(position, normal, mode = 'place') {
        if (!this._highlightMesh) return;

        // Set color based on mode
        const colors = {
            place: 0x00ff00,   // Green
            delete: 0xff0000,  // Red
            paint: 0x2196F3,   // Blue
            grab: 0xFFD700,    // Yellow
        };
        this._highlightMesh.material.color.setHex(colors[mode] || colors.place);
        this._highlightMode = mode;

        if (mode === 'place' && normal) {
            // Show highlight on the adjacent face where block would be placed
            this._highlightMesh.position.set(
                position.x + normal.nx + 0.5,
                position.y + normal.ny + 0.5,
                position.z + normal.nz + 0.5
            );
        } else {
            // Show highlight on the block itself
            this._highlightMesh.position.set(
                position.x + 0.5,
                position.y + 0.5,
                position.z + 0.5
            );
        }

        this._highlightMesh.visible = true;
    },

    /**
     * Hide the highlight wireframe.
     */
    removeHighlight() {
        if (this._highlightMesh) {
            this._highlightMesh.visible = false;
        }
        this._highlightMode = null;
    },

    // =============================================
    // GRAVITY HELPER
    // =============================================

    /**
     * Check if a block has support beneath it (simple gravity check).
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {boolean} True if a block exists directly below
     */
    shouldBlockGravity(x, y, z) {
        return !!this.getBlock(x, y - 1, z);
    },
};
