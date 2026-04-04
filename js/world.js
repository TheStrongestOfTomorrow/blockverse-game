// ============================================
// BLOCKVERSE - World Engine (world.js)
// ============================================
// V2.0 — Optimized rendering via BlockRenderer (InstancedMesh),
// DDA voxel raycasting, rebalanced lighting, single render loop.
// ============================================

const World = {
    scene: null,
    camera: null,
    renderer: null,

    blockMap: {},
    blockCount: 0,

    _blockGroup: null,
    _groundGroup: null,
    _skyMesh: null,
    _gridHelper: null,
    _highlightMesh: null,
    _highlightMode: null,
    _animClock: null,

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
        this.renderer.shadowMap.type = THREE.PCFShadowMap; // Faster than PCFSoft
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.85; // Pulled down from 1.0 to prevent washout

        // --- Scene ---
        this.scene = new THREE.Scene();
        const fogColor = 0x87CEEB;
        this.scene.fog = new THREE.Fog(fogColor, 20, BV.RENDER_DISTANCE * BV.CHUNK_SIZE);
        this.scene.background = new THREE.Color(fogColor);

        // --- Camera ---
        this.camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.1,
            500
        );
        this.camera.position.set(5, 7, 5);

        // --- LIGHTING (V2.0 Rebalanced) ---
        // Total nominal light: ~1.7, but with exposure 0.85 + ACESFilmic,
        // screen output is ~1.0-1.1 — clean, contrasty, Roblox-like

        // Ambient: Cool-toned fill for shadows (was 0.6 white — too flat)
        const ambient = new THREE.AmbientLight(0x9090c0, 0.35);
        this.scene.add(ambient);

        // Sun: Warm directional with crisp shadows (was 0.8 warm)
        const sun = new THREE.DirectionalLight(0xfff0d0, 1.0);
        sun.position.set(50, 80, 30);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 1024;  // Down from 2048 — faster, adequate for blocks
        sun.shadow.mapSize.height = 1024;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 60;      // Tighter frustum = sharper shadows
        sun.shadow.camera.left = -25;     // Tighter from ±60
        sun.shadow.camera.right = 25;
        sun.shadow.camera.top = 25;
        sun.shadow.camera.bottom = -25;
        this.scene.add(sun);

        // Fill light: Opposite side prevents pure-black shadows on buildings
        const fill = new THREE.DirectionalLight(0xc0d0ff, 0.15);
        fill.position.set(-30, 40, -20);
        this.scene.add(fill);

        // Hemisphere: Sky/ground bounce (was 0.3 — now subtler)
        const hemi = new THREE.HemisphereLight(0x88bbff, 0x445522, 0.2);
        this.scene.add(hemi);

        // --- Sky ---
        this._createSky();

        // --- Grid helper ---
        this._gridHelper = new THREE.GridHelper(64, 64, 0x444466, 0x333355);
        this._gridHelper.position.y = 0.01;
        this._gridHelper.material.transparent = true;
        this._gridHelper.material.opacity = 0.3;
        this.scene.add(this._gridHelper);

        // --- Groups ---
        this._groundGroup = new THREE.Group();
        this._groundGroup.name = 'terrain';
        this.scene.add(this._groundGroup);

        this.playerGroup = new THREE.Group();
        this.playerGroup.name = 'players';
        this.scene.add(this.playerGroup);

        // --- Block Renderer (InstancedMesh system) ---
        if (typeof BlockRenderer !== 'undefined') {
            BlockRenderer.init(this.scene);
        }

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

        // NO separate render loop — App.startGameLoop() drives updates + rendering
        console.log('[World] Initialized (V2.0 — InstancedMesh + rebalanced lighting)');
    },

    // =============================================
    // FRAME UPDATE & RENDER
    // =============================================

    update(deltaTime) {
        // Fog follows render distance
        const far = BV.RENDER_DISTANCE * BV.CHUNK_SIZE;
        if (this.scene.fog) {
            this.scene.fog.near = far * 0.6;
            this.scene.fog.far = far * 0.95;
        }

        // Highlight pulse animation
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

        // Dispose BlockRenderer
        if (typeof BlockRenderer !== 'undefined') {
            BlockRenderer.dispose();
        }

        window.removeEventListener('resize', this._onResize);
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
            case 'island': this._generateIsland(); break;
            case 'village': this._generateVillage(); break;
            case 'bridge': this._generateBridge(); break;
            case 'castle': this._generateCastle(); break;
            case 'parkour': this._generateParkour(); break;
            case 'pirate': this._generatePirate(); break;
            default:
                console.warn('[World] Unknown terrain template: "' + template + '", using flat.');
                this._generateFlat();
        }

        // Flush all instance matrix updates after terrain generation
        if (typeof BlockRenderer !== 'undefined') {
            for (const type in BlockRenderer._instances) {
                BlockRenderer._instances[type].mesh.instanceMatrix.needsUpdate = true;
            }
        }
    },

    _generateEmpty() {
        const size = 32;
        const half = Math.floor(size / 2);
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'stone', false);
                this.addBlock(x, 0, z, 'grass', false);
            }
        }
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                this.addBlock(x, 1, z, 'gold', false);
            }
        }
    },

    _generateFlat() {
        const size = 40;
        const half = Math.floor(size / 2);
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'dirt', false);
                this.addBlock(x, 0, z, 'grass', false);
            }
        }
        for (let x = -half; x < half; x++) {
            this.addBlock(x, 1, -half, 'stone', false);
            this.addBlock(x, 1, half - 1, 'stone', false);
        }
        for (let z = -half; z < half; z++) {
            this.addBlock(-half, 1, z, 'stone', false);
            this.addBlock(half - 1, 1, z, 'stone', false);
        }
        const corners = [[-half, -half], [-half, half-1], [half-1, -half], [half-1, half-1]];
        for (const [cx, cz] of corners) {
            for (let y = 2; y <= 3; y++) {
                this.addBlock(cx, y, cz, 'cobble', false);
            }
        }
        for (let z = -2; z <= 2; z++) {
            this.addBlock(0, 1, z, 'plank', false);
        }
    },

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
                    if (topY <= 0) {
                        this.addBlock(x, topY, z, 'water', false);
                    } else {
                        this.addBlock(x, topY, z, 'grass', false);
                    }
                }
            }
        }
        const treePositions = [
            [-8, 6], [-12, -4], [5, 10], [10, -8], [-5, -12],
            [15, 5], [-15, 10], [8, -15], [20, -5], [-10, 15],
            [3, -8], [-20, 0], [12, 12], [-8, -18], [18, -12],
        ];
        for (const [tx, tz] of treePositions) {
            const th = Math.round(this._noiseHeight(tx, tz, 0.08, 5));
            if (th > 1) {
                for (let y = th + 1; y <= th + 4; y++) {
                    this.addBlock(tx, y, tz, 'wood', false);
                }
                for (let lx = -1; lx <= 1; lx++) {
                    for (let lz = -1; lz <= 1; lz++) {
                        this.addBlock(tx + lx, th + 5, tz + lz, 'leaf', false);
                    }
                }
                this.addBlock(tx, th + 6, tz, 'leaf', false);
            }
        }
    },

    _generateObby() {
        for (let x = -2; x <= 2; x++) {
            for (let z = 0; z <= 4; z++) {
                this.addBlock(x, 0, z, 'stone', false);
            }
        }
        this.addBlock(0, 1, 0, 'gold', false);

        const stages = [
            { blocks: [[5,0,2,'stone'],[7,0,2,'stone'],[9,0,2,'stone'],[11,0,2,'stone']], checkpoint: [12, 1, 2, 'gold'] },
            { blocks: [[14,1,2,'brick'],[14,2,2,'brick'],[14,3,2,'brick'],[15,3,3,'brick'],[16,3,4,'brick'],[17,4,4,'brick'],[17,5,4,'brick']], checkpoint: [17, 6, 4, 'gold'] },
            { blocks: [[18,5,5,'plank'],[18,5,6,'plank'],[18,5,7,'plank'],[18,5,8,'plank'],[18,5,9,'plank'],[18,5,10,'plank']], checkpoint: [18, 6, 11, 'gold'] },
            { blocks: [[16,4,12,'stone'],[14,3,14,'stone'],[12,2,12,'stone'],[10,1,14,'stone'],[8,0,12,'stone']], checkpoint: [8, 1, 12, 'gold'] },
            { blocks: [[6,0,14,'stone'],[6,0,15,'stone'],[6,0,16,'stone'],[7,0,14,'stone'],[7,0,15,'stone'],[7,0,16,'stone']], checkpoint: [6, 1, 15, 'diamond'] },
        ];

        for (const stage of stages) {
            for (const [bx, by, bz, type] of stage.blocks) {
                this.addBlock(bx, by, bz, type, false);
            }
            if (stage.checkpoint) {
                const [cx, cy, cz, ctype] = stage.checkpoint;
                this.addBlock(cx, cy, cz, ctype, false);
            }
        }
        for (let x = -5; x <= 25; x++) {
            for (let z = -2; z <= 20; z++) {
                this.addBlock(x, -5, z, 'lava', false);
            }
        }
    },

    _generateCity() {
        const size = 48;
        const half = Math.floor(size / 2);
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'stone', false);
                this.addBlock(x, 0, z, 'cobble', false);
            }
        }
        for (let x = -half; x < half; x++) {
            for (let z = -1; z <= 1; z++) {
                this.addBlock(x, 1, z, 'stone', false);
            }
        }
        for (let z = -half; z < half; z++) {
            for (let x = -1; x <= 1; x++) {
                this.addBlock(x, 1, z, 'stone', false);
            }
        }
        const buildings = [
            { x: -12, z: -12, w: 5, d: 5, h: 6, type: 'brick' },
            { x: -5, z: -12, w: 3, d: 4, h: 4, type: 'plank' },
            { x: 4, z: -12, w: 6, d: 5, h: 8, type: 'brick' },
            { x: 13, z: -12, w: 4, d: 4, h: 3, type: 'plank' },
            { x: -12, z: 4, w: 4, d: 6, h: 5, type: 'brick' },
            { x: -5, z: 5, w: 5, d: 5, h: 7, type: 'stone' },
            { x: 4, z: 4, w: 3, d: 3, h: 3, type: 'plank' },
            { x: 8, z: 4, w: 5, d: 6, h: 6, type: 'brick' },
            { x: -12, z: 13, w: 6, d: 5, h: 4, type: 'plank' },
            { x: 4, z: 13, w: 5, d: 5, h: 5, type: 'brick' },
            { x: 13, z: 4, w: 4, d: 4, h: 10, type: 'stone' },
            { x: 13, z: 13, w: 5, d: 5, h: 4, type: 'plank' },
        ];
        for (const b of buildings) {
            for (let wx = 0; wx < b.w; wx++) {
                for (let wz = 0; wz < b.d; wz++) {
                    for (let wy = 1; wy <= b.h; wy++) {
                        const isEdgeX = (wx === 0 || wx === b.w - 1);
                        const isEdgeZ = (wz === 0 || wz === b.d - 1);
                        if (isEdgeX || isEdgeZ) {
                            this.addBlock(b.x + wx, wy, b.z + wz, b.type, false);
                        } else if (wy === b.h) {
                            this.addBlock(b.x + wx, wy, b.z + wz, 'plank', false);
                        }
                    }
                }
            }
            const doorX = b.x + Math.floor(b.w / 2);
            for (let dy = 1; dy <= 2; dy++) {
                this.removeBlock(doorX, dy, b.z, false);
            }
        }
        for (let i = 0; i < 6; i++) {
            const px = -20 + i * 2;
            const pz = 13;
            for (let ty = 1; ty <= 3; ty++) this.addBlock(px, ty, pz, 'wood', false);
            this.addBlock(px, 4, pz, 'leaf', false);
            this.addBlock(px+1, 4, pz, 'leaf', false);
            this.addBlock(px-1, 4, pz, 'leaf', false);
            this.addBlock(px, 4, pz+1, 'leaf', false);
            this.addBlock(px, 4, pz-1, 'leaf', false);
        }
    },

    _generateArena() {
        const size = 24;
        const half = Math.floor(size / 2);
        const wallH = 6;
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'stone', false);
                this.addBlock(x, 0, z, 'sand', false);
            }
        }
        for (let y = 1; y <= wallH; y++) {
            for (let i = -half; i < half; i++) {
                this.addBlock(i, y, -half, 'brick', false);
                this.addBlock(i, y, half - 1, 'brick', false);
                this.addBlock(-half, y, i, 'brick', false);
                this.addBlock(half - 1, y, i, 'brick', false);
            }
        }
        const corners = [[-half, -half], [-half, half-1], [half-1, -half], [half-1, half-1]];
        for (const [cx, cz] of corners) {
            for (let y = wallH + 1; y <= wallH + 3; y++) {
                this.addBlock(cx, y, cz, 'stone', false);
            }
            this.addBlock(cx, wallH + 4, cz, 'gold', false);
        }
        for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
                this.addBlock(x, 1, z, 'stone', false);
            }
        }
        this.addBlock(0, 2, 0, 'diamond', false);
        for (let tier = 1; tier <= 2; tier++) {
            for (let x = -8; x <= 8; x++) {
                this.addBlock(x, tier, -half + 1 + tier, 'plank', false);
                this.addBlock(x, tier, half - 2 - tier, 'plank', false);
            }
        }
    },

    _generateIsland() {
        const radius = 10;
        for (let x = -radius; x <= radius; x++) {
            for (let z = -radius; z <= radius; z++) {
                const dist = Math.sqrt(x*x + z*z);
                if (dist > radius) continue;
                const depth = Math.floor(3 * (1 - dist/radius));
                for (let d = -3; d <= 0; d++) {
                    const dy = depth + d;
                    if (dist < 3) {
                        this.addBlock(x, dy, z, 'stone', false);
                    } else {
                        this.addBlock(x, dy, z, 'dirt', false);
                    }
                }
                this.addBlock(x, depth + 1, z, 'grass', false);
            }
        }
        const treePos = [[-4, -3], [5, 2], [-2, 5], [3, -5], [0, -6]];
        for (const [tx, tz] of treePos) {
            for (let ty = 2; ty <= 5; ty++) this.addBlock(tx, ty, tz, 'wood', false);
            for (let lx = -1; lx <= 1; lx++) {
                for (let lz = -1; lz <= 1; lz++) {
                    this.addBlock(tx+lx, 6, tz+lz, 'leaf', false);
                }
            }
            this.addBlock(tx, 7, tz, 'leaf', false);
        }
        for (let hx = -2; hx <= 2; hx++) {
            for (let hz = 3; hz <= 5; hz++) {
                this.addBlock(hx, 2, hz, 'plank', false);
            }
        }
        this.addBlock(0, 3, 3, 'plank', false);
        this.addBlock(0, 4, 3, 'plank', false);
        for (let x = -radius; x <= radius; x++) {
            for (let z = -radius; z <= radius; z++) {
                const dist = Math.sqrt(x*x + z*z);
                if (dist <= radius + 2) {
                    this.addBlock(x, -4, z, 'water', false);
                }
            }
        }
    },

    _generateVillage() {
        const size = 40;
        const half = Math.floor(size / 2);
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'dirt', false);
                this.addBlock(x, 0, z, 'grass', false);
            }
        }
        for (let z = -half; z < half; z++) {
            this.addBlock(0, 1, z, 'cobble', false);
            this.addBlock(1, 1, z, 'cobble', false);
        }
        const houses = [
            { x: -10, z: -10, w: 5, d: 4, h: 4, wall: 'plank', roof: 'brick' },
            { x: -10, z: -3, w: 4, d: 5, h: 3, wall: 'plank', roof: 'brick' },
            { x: -10, z: 5, w: 5, d: 4, h: 5, wall: 'cobble', roof: 'stone' },
            { x: 4, z: -10, w: 6, d: 5, h: 4, wall: 'plank', roof: 'brick' },
            { x: 4, z: -3, w: 4, d: 4, h: 3, wall: 'cobble', roof: 'stone' },
            { x: 4, z: 5, w: 5, d: 5, h: 4, wall: 'plank', roof: 'brick' },
        ];
        for (const h of houses) {
            for (let wx = 0; wx < h.w; wx++) {
                for (let wz = 0; wz < h.d; wz++) {
                    for (let wy = 1; wy <= h.h; wy++) {
                        const isEdge = wx === 0 || wx === h.w-1 || wz === 0 || wz === h.d-1;
                        if (isEdge) {
                            this.addBlock(h.x+wx, wy, h.z+wz, h.wall, false);
                        } else if (wy === h.h) {
                            this.addBlock(h.x+wx, wy, h.z+wz, h.roof, false);
                        }
                    }
                }
            }
            const dx = h.x + Math.floor(h.w/2);
            this.removeBlock(dx, 1, h.z, false);
            this.removeBlock(dx, 2, h.z, false);
            const wx2 = h.x + (h.w > 4 ? h.w-2 : 1);
            this.addBlock(wx2, 2, h.z, 'glass', false);
        }
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                this.addBlock(x, 1, z, 'stone', false);
            }
        }
        this.addBlock(0, 1, 0, 'water', false);
        for (let x = -3; x <= 3; x++) {
            this.addBlock(x, 1, 12, 'sand', false);
        }
    },

    _generateBridge() {
        const half = 20;
        for (let x = -half; x < -4; x++) {
            for (let z = -6; z < 6; z++) {
                this.addBlock(x, 0, z, 'stone', false);
                this.addBlock(x, 1, z, 'grass', false);
            }
        }
        for (let x = 4; x < half; x++) {
            for (let z = -6; z < 6; z++) {
                this.addBlock(x, 0, z, 'stone', false);
                this.addBlock(x, 1, z, 'grass', false);
            }
        }
        for (let x = -3; x <= 3; x++) {
            for (let z = -1; z <= 1; z++) {
                this.addBlock(x, 1, z, 'plank', false);
            }
            this.addBlock(x, 2, -2, 'wood', false);
            this.addBlock(x, 2, 2, 'wood', false);
        }
        for (let y = -2; y <= 0; y++) {
            this.addBlock(-2, y, -2, 'wood', false);
            this.addBlock(-2, y, 2, 'wood', false);
            this.addBlock(2, y, -2, 'wood', false);
            this.addBlock(2, y, 2, 'wood', false);
        }
        for (let x = -3; x <= 3; x++) {
            for (let z = -4; z < 4; z++) {
                this.addBlock(x, -2, z, 'water', false);
            }
        }
        this.addBlock(-10, 2, 0, 'gold', false);
        this.addBlock(10, 2, 0, 'gold', false);
    },

    _generateCastle() {
        const size = 32;
        const half = Math.floor(size / 2);
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'stone', false);
                this.addBlock(x, 0, z, 'grass', false);
            }
        }
        const cSize = 7;
        for (let y = 1; y <= 5; y++) {
            for (let i = -cSize; i <= cSize; i++) {
                this.addBlock(i, y, -cSize, 'stone', false);
                this.addBlock(i, y, cSize, 'stone', false);
                this.addBlock(-cSize, y, i, 'stone', false);
                this.addBlock(cSize, y, i, 'stone', false);
            }
        }
        for (let i = -cSize; i <= cSize; i += 2) {
            this.addBlock(i, 6, -cSize, 'stone', false);
            this.addBlock(i, 6, cSize, 'stone', false);
            this.addBlock(-cSize, 6, i, 'stone', false);
            this.addBlock(cSize, 6, i, 'stone', false);
        }
        const towers = [[-cSize,-cSize],[-cSize,cSize],[cSize,-cSize],[cSize,cSize]];
        for (const [tx, tz] of towers) {
            for (let y = 6; y <= 9; y++) {
                this.addBlock(tx, y, tz, 'cobble', false);
            }
            this.addBlock(tx, 10, tz, 'gold', false);
        }
        this.removeBlock(0, 1, -cSize, false);
        this.removeBlock(0, 2, -cSize, false);
        this.removeBlock(0, 3, -cSize, false);
        for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
                this.addBlock(x, 1, z, 'plank', false);
            }
        }
        this.addBlock(0, 2, 0, 'diamond', false);
    },

    _generateParkour() {
        const size = 16;
        const half = Math.floor(size / 2);
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'stone', false);
                this.addBlock(x, 0, z, 'stone', false);
            }
        }
        for (let x = -2; x <= 0; x++) {
            for (let z = 0; z <= 2; z++) {
                this.addBlock(x, 1, z, 'plank', false);
            }
        }
        this.addBlock(-1, 2, 1, 'gold', false);
        let px = 2, py = 1, pz = 2;
        const dirs = [[2,0],[0,2],[-2,0],[0,-2]];
        for (let stage = 0; stage < 20; stage++) {
            const dir = dirs[stage % 4];
            px += dir[0]; pz += dir[1];
            if (stage % 3 === 0) py++;
            this.addBlock(px, py, pz, stage % 2 === 0 ? 'brick' : 'stone', false);
            if (stage % 5 === 4) {
                this.addBlock(px, py + 1, pz, 'gold', false);
            }
        }
        for (let x = px - 1; x <= px + 1; x++) {
            for (let z = pz - 1; z <= pz + 1; z++) {
                this.addBlock(x, py, z, 'plank', false);
            }
        }
        this.addBlock(px, py + 1, pz, 'diamond', false);
    },

    _generatePirate() {
        const size = 40;
        const half = Math.floor(size / 2);
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, -1, z, 'stone', false);
                this.addBlock(x, 0, z, 'water', false);
            }
        }
        for (let x = -10; x <= 10; x++) {
            for (let z = -4; z <= 4; z++) {
                const edge = Math.abs(x) > 7 || Math.abs(z) > 2;
                if (edge || x === -10 || x === 10 || z === -4 || z === 4) {
                    this.addBlock(x, 1, z, 'wood', false);
                }
            }
        }
        for (let x = -9; x <= 9; x++) {
            for (let z = -3; z <= 3; z++) {
                this.addBlock(x, 2, z, 'plank', false);
            }
        }
        for (let x = 7; x <= 9; x++) {
            for (let z = -3; z <= 3; z++) {
                this.addBlock(x, 3, z, 'plank', false);
            }
        }
        for (let y = 3; y <= 8; y++) {
            this.addBlock(0, y, 0, 'wood', false);
        }
        for (let x = -2; x <= 2; x++) {
            for (let y = 4; y <= 7; y++) {
                this.addBlock(x, y, 1, 'snow', false);
            }
        }
        this.addBlock(-11, 1, 0, 'wood', false);
        this.addBlock(-12, 1, 0, 'wood', false);
        this.addBlock(8, 3, 0, 'gold', false);
        this.addBlock(8, 3, 1, 'gold', false);
        this.addBlock(8, 3, -1, 'gold', false);
    },

    // =============================================
    // BLOCK MANAGEMENT (Data Layer + InstancedMesh)
    // =============================================

    addBlock(x, y, z, blockType, emitEvent) {
        x = Math.round(x);
        y = Math.round(y);
        z = Math.round(z);

        if (y < -32 || y > BV.WORLD_HEIGHT_LIMIT) return false;

        const key = x + ',' + y + ',' + z;
        if (this.blockMap[key]) return false;

        const config = BV.BLOCK_TYPES[blockType];
        if (!config) {
            console.warn('[World] Unknown block type: "' + blockType + '"');
            return false;
        }

        // Data layer
        this.blockMap[key] = { x, y, z, type: blockType };
        this.blockCount++;

        // Render layer (InstancedMesh)
        if (typeof BlockRenderer !== 'undefined') {
            BlockRenderer.addBlock(x, y, z, blockType);
        }

        if (emitEvent) {
            const event = new CustomEvent('block:place', {
                detail: { x, y, z, type: blockType },
            });
            window.dispatchEvent(event);
        }

        return true;
    },

    removeBlock(x, y, z, emitEvent) {
        x = Math.round(x);
        y = Math.round(y);
        z = Math.round(z);

        const key = x + ',' + y + ',' + z;
        const block = this.blockMap[key];
        if (!block) return false;

        // Render layer
        if (typeof BlockRenderer !== 'undefined') {
            if (block.customColor) {
                BlockRenderer.removeCustomMesh(x, y, z);
            } else {
                BlockRenderer.removeBlock(x, y, z, block.type);
            }
        }

        // Data layer
        delete this.blockMap[key];
        this.blockCount--;

        if (emitEvent) {
            const event = new CustomEvent('block:remove', {
                detail: { x, y, z, type: block.type },
            });
            window.dispatchEvent(event);
        }

        return true;
    },

    getBlock(x, y, z) {
        const key = Math.round(x) + ',' + Math.round(y) + ',' + Math.round(z);
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
        // Data layer
        this.blockMap = {};
        this.blockCount = 0;

        // Render layer
        if (typeof BlockRenderer !== 'undefined') {
            BlockRenderer.clearAll();
        }

        // Ground group cleanup
        while (this._groundGroup && this._groundGroup.children.length > 0) {
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
    // RAYCASTING (DDA Voxel Traversal)
    // =============================================

    getRaycastTarget(origin, direction, maxDist) {
        if (!origin || !direction) return null;

        const hit = BlockRenderer.raycast(origin, direction, maxDist || 8, this.blockMap);
        if (!hit) return null;

        return {
            position: { x: hit.x, y: hit.y, z: hit.z },
            normal: { nx: hit.nx, ny: hit.ny, nz: hit.nz },
            distance: hit.distance,
        };
    },

    // =============================================
    // BLOCK HIGHLIGHTING
    // =============================================

    highlightBlock(position, normal, mode) {
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
