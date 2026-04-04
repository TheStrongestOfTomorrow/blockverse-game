// ============================================
// BLOCKVERSE - Player Engine (player.js)
// ============================================
// Handles local first-person player movement, camera
// controls, pointer lock, collision detection, and
// remote player avatar rendering.
// ============================================

const Player = {
    // --- Camera & DOM ---
    _camera: null,
    _domElement: null,

    // --- State ---
    position: { x: 0, y: 2, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    rotation: { yaw: 0, pitch: 0 },

    // --- Movement ---
    _keys: {},                // Currently pressed keys
    _isGrounded: false,
    _sprinting: false,

    // --- Pointer lock ---
    _isLocked: false,
    _pointerLockRequested: false,

    // --- Collision ---
    _playerWidth: 0.6,       // Bounding box width (X/Z)
    _playerHeight: 1.8,      // Bounding box height
    _eyeOffset: 1.6,         // Camera Y offset from feet
    _fallThreshold: -20,     // Y below which player respawns

    // --- Input handling ---
    _onKeyDown: null,
    _onKeyUp: null,
    _onMouseMove: null,
    _onPointerLockChange: null,
    _onClick: null,

    // =============================================
    // INITIALIZATION
    // =============================================

    /**
     * Initialize the local player with a camera and DOM element for input.
     * @param {THREE.Camera} camera - The Three.js camera to control
     * @param {HTMLElement} domElement - Element to attach pointer lock and events to
     */
    init(camera, domElement) {
        // Auto-detect if not provided
        if (!domElement) domElement = document.getElementById('game-canvas');
        if (!camera && typeof World !== 'undefined' && World.camera) camera = World.camera;
        if (!camera || !domElement) {
            console.warn('[Player] Cannot init without camera or domElement');
            return;
        }

        this._camera = camera;
        this._domElement = domElement;

        // Reset state
        this.position = { x: 0, y: 2, z: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.rotation = { yaw: 0, pitch: 0 };
        this._isGrounded = false;
        this._isLocked = false;
        this._keys = {};

        // --- Key handlers ---
        this._onKeyDown = this._handleKeyDown.bind(this);
        this._onKeyUp = this._handleKeyUp.bind(this);
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);

        // --- Mouse move (for camera when locked) ---
        this._onMouseMove = this._handleMouseMove.bind(this);
        document.addEventListener('mousemove', this._onMouseMove);

        // --- Pointer lock change ---
        this._onPointerLockChange = this._handlePointerLockChange.bind(this);
        document.addEventListener('pointerlockchange', this._onPointerLockChange);

        // --- Click to lock pointer ---
        this._onClick = () => {
            if (!this._isLocked) {
                this.lock();
            }
        };
        domElement.addEventListener('click', this._onClick);

        // Position camera at spawn
        this._syncCamera();
    },

    /**
     * Clean up event listeners.
     */
    destroy() {
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('pointerlockchange', this._onPointerLockChange);
        if (this._domElement) {
            this._domElement.removeEventListener('click', this._onClick);
        }
    },

    // =============================================
    // INPUT HANDLERS
    // =============================================

    _handleKeyDown(e) {
        this._keys[e.code] = true;

        // Prevent default for game keys
        const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'];
        if (gameKeys.includes(e.code) && this._isLocked) {
            e.preventDefault();
        }
    },

    _handleKeyUp(e) {
        this._keys[e.code] = false;
    },

    _handleMouseMove(e) {
        if (!this._isLocked) return;

        const sensitivity = BV.MOUSE_SENSITIVITY;
        const movementX = e.movementX || 0;
        const movementY = e.movementY || 0;

        // Yaw (horizontal rotation)
        this.rotation.yaw -= movementX * sensitivity;

        // Pitch (vertical rotation), clamped to ±89°
        this.rotation.pitch -= movementY * sensitivity;
        this.rotation.pitch = Utils.clamp(this.rotation.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    },

    _handlePointerLockChange() {
        this._isLocked = (document.pointerLockElement === this._domElement);

        // Dispatch event so UI can respond
        window.dispatchEvent(new CustomEvent('player:lockchange', {
            detail: { locked: this._isLocked },
        }));
    },

    // =============================================
    // POINTER LOCK
    // =============================================

    /**
     * Request pointer lock on the DOM element.
     */
    lock() {
        if (this._domElement && !this._isLocked) {
            this._domElement.requestPointerLock();
        }
    },

    /**
     * Release pointer lock.
     */
    unlock() {
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    },

    /**
     * Check if pointer is currently locked.
     * @returns {boolean}
     */
    isLocked() {
        return this._isLocked;
    },

    // =============================================
    // PER-FRAME UPDATE
    // =============================================

    /**
     * Update player physics, movement, and camera each frame.
     * @param {number} deltaTime - Time in seconds since last frame
     * @param {object} blockMap - World.blockMap for collision detection
     */
    update(deltaTime, blockMap) {
        if (!this._isLocked) return;

        // Clamp delta to prevent physics explosions on tab-switch
        const dt = Math.min(deltaTime, 0.1);

        // --- Sprint state ---
        this._sprinting = !!(this._keys['ShiftLeft'] || this._keys['ShiftRight']);
        const speed = this._sprinting ? BV.PLAYER_SPRINT_SPEED : BV.PLAYER_SPEED;

        // --- Calculate movement direction from yaw ---
        const forward = new THREE.Vector3(
            -Math.sin(this.rotation.yaw),
            0,
            -Math.cos(this.rotation.yaw)
        );
        const right = new THREE.Vector3(
            Math.cos(this.rotation.yaw),
            0,
            -Math.sin(this.rotation.yaw)
        );

        // --- Input -> target velocity ---
        let inputX = 0;
        let inputZ = 0;
        if (this._keys['KeyW']) { inputX += forward.x; inputZ += forward.z; }
        if (this._keys['KeyS']) { inputX -= forward.x; inputZ -= forward.z; }
        if (this._keys['KeyA']) { inputX -= right.x; inputZ -= right.z; }
        if (this._keys['KeyD']) { inputX += right.x; inputZ += right.z; }

        // Normalize diagonal movement
        const inputLen = Math.sqrt(inputX * inputX + inputZ * inputZ);
        if (inputLen > 0) {
            inputX = (inputX / inputLen) * speed;
            inputZ = (inputZ / inputLen) * speed;
        }

        // --- Gravity ---
        this.velocity.y += BV.GRAVITY * dt;

        // --- Jump ---
        if ((this._keys['Space']) && this._isGrounded) {
            this.velocity.y = BV.JUMP_FORCE;
            this._isGrounded = false;
        }

        // --- Horizontal movement with damping ---
        const damping = this._isGrounded ? 12 : 4; // Less control in air
        this.velocity.x = Utils.lerp(this.velocity.x, inputX, damping * dt);
        this.velocity.z = Utils.lerp(this.velocity.z, inputZ, damping * dt);

        // --- Apply velocity to position with collision ---
        // Move on each axis separately for clean sliding collisions
        this._moveAxis('x', this.velocity.x * dt, blockMap);
        this._moveAxis('y', this.velocity.y * dt, blockMap);
        this._moveAxis('z', this.velocity.z * dt, blockMap);

        // --- Fall threshold / respawn ---
        if (this.position.y < this._fallThreshold) {
            window.dispatchEvent(new CustomEvent('player:respawn', {
                detail: { reason: 'fell' },
            }));
        }

        // --- Sync camera ---
        this._syncCamera();
    },

    /**
     * Move the player along one axis with collision detection.
     * @param {string} axis - 'x' | 'y' | 'z'
     * @param {number} delta - Movement amount
     * @param {object} blockMap - World.blockMap
     */
    _moveAxis(axis, delta, blockMap) {
        if (Math.abs(delta) < 0.0001) return;

        // Tentative new position
        const newPos = { x: this.position.x, y: this.position.y, z: this.position.z };
        newPos[axis] += delta;

        // Check for collision
        if (this._checkCollision(newPos, blockMap)) {
            // Collision occurred — stop movement on this axis
            this.velocity[axis] = 0;

            // If moving downward and collided, we're grounded
            if (axis === 'y' && delta < 0) {
                this._isGrounded = true;
                // Snap to top of the block
                const snapY = this._findGroundY(newPos, blockMap);
                if (snapY !== null) {
                    this.position.y = snapY;
                }
            }
        } else {
            // No collision — apply movement
            this.position[axis] = newPos[axis];

            // If moving down without collision, we're airborne
            if (axis === 'y' && delta < 0) {
                this._isGrounded = false;
            }
        }
    },

    /**
     * Check if the player's bounding box at `pos` collides with any blocks.
     * @param {object} pos - {x, y, z} player feet position
     * @param {object} blockMap - World.blockMap
     * @returns {boolean} True if collision detected
     */
    _checkCollision(pos, blockMap) {
        const hw = this._playerWidth / 2; // Half-width
        const ph = this._playerHeight;

        // Bounding box ranges (block grid coords to check)
        const minBX = Math.floor(pos.x - hw);
        const maxBX = Math.floor(pos.x + hw);
        const minBY = Math.floor(pos.y);
        const maxBY = Math.floor(pos.y + ph);
        const minBZ = Math.floor(pos.z - hw);
        const maxBZ = Math.floor(pos.z + hw);

        for (let bx = minBX; bx <= maxBX; bx++) {
            for (let by = minBY; by <= maxBY; by++) {
                for (let bz = minBZ; bz <= maxBZ; bz++) {
                    const key = `${bx},${by},${bz}`;
                    if (blockMap[key]) {
                        // AABB overlap check
                        const blockMinX = bx;
                        const blockMaxX = bx + 1;
                        const blockMinY = by;
                        const blockMaxY = by + 1;
                        const blockMinZ = bz;
                        const blockMaxZ = bz + 1;

                        const pMinX = pos.x - hw;
                        const pMaxX = pos.x + hw;
                        const pMinY = pos.y;
                        const pMaxY = pos.y + ph;
                        const pMinZ = pos.z - hw;
                        const pMaxZ = pos.z + hw;

                        if (
                            pMinX < blockMaxX && pMaxX > blockMinX &&
                            pMinY < blockMaxY && pMaxY > blockMinY &&
                            pMinZ < blockMaxZ && pMaxZ > blockMinZ
                        ) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    },

    /**
     * Find the ground Y position (top of highest block below player) for snapping.
     * @param {object} pos - {x, y, z}
     * @param {object} blockMap
     * @returns {number|null} Y position to snap to, or null
     */
    _findGroundY(pos, blockMap) {
        const hw = this._playerWidth / 2;
        const checkX = [Math.floor(pos.x - hw), Math.floor(pos.x + hw)];
        const checkZ = [Math.floor(pos.z - hw), Math.floor(pos.z + hw)];

        let highestY = null;

        for (const cx of checkX) {
            for (const cz of checkZ) {
                // Check blocks below player's current feet
                for (let by = Math.floor(pos.y); by >= Math.floor(pos.y) - 2; by--) {
                    const key = `${cx},${by},${cz}`;
                    if (blockMap[key]) {
                        const topY = by + 1; // Top of block
                        if (highestY === null || topY > highestY) {
                            highestY = topY;
                        }
                        break; // Only need highest block per column
                    }
                }
            }
        }

        return highestY;
    },

    /**
     * Sync camera position and rotation to player state.
     */
    _syncCamera() {
        if (!this._camera) return;

        this._camera.position.set(
            this.position.x,
            this.position.y + this._eyeOffset,
            this.position.z
        );

        // Apply rotation (yaw around Y, pitch around X)
        this._camera.rotation.order = 'YXZ';
        this._camera.rotation.set(this.rotation.pitch, this.rotation.yaw, 0);
    },

    // =============================================
    // STATE ACCESSORS
    // =============================================

    /**
     * Set player position (used for respawning or loading).
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setPosition(x, y, z) {
        this.position.x = x;
        this.position.y = y;
        this.position.z = z;
        this.velocity = { x: 0, y: 0, z: 0 };
        this._syncCamera();
    },

    /**
     * Get player position.
     * @returns {{x:number, y:number, z:number}}
     */
    getPosition() {
        return { x: this.position.x, y: this.position.y, z: this.position.z };
    },

    /**
     * Get player rotation.
     * @returns {{yaw:number, pitch:number}}
     */
    getRotation() {
        return { yaw: this.rotation.yaw, pitch: this.rotation.pitch };
    },

    /**
     * Get full player state (for network sync).
     * @returns {{position:{x,y,z}, rotation:{yaw,pitch}, velocity:{x,y,z}}}
     */
    getState() {
        return {
            position: { x: this.position.x, y: this.position.y, z: this.position.z },
            rotation: { yaw: this.rotation.yaw, pitch: this.rotation.pitch },
            velocity: { x: this.velocity.x, y: this.velocity.y, z: this.velocity.z },
        };
    },

    /**
     * Set player position/rotation from a network state (with interpolation).
     * @param {object} state - { position:{x,y,z}, rotation:{yaw,pitch} }
     * @param {number} t - Interpolation factor (0-1), default 1 (instant)
     */
    setPositionFromState(state, t = 1) {
        if (state.position) {
            this.position.x = Utils.lerp(this.position.x, state.position.x, t);
            this.position.y = Utils.lerp(this.position.y, state.position.y, t);
            this.position.z = Utils.lerp(this.position.z, state.position.z, t);
        }
        if (state.rotation) {
            this.rotation.yaw = Utils.lerp(this.rotation.yaw, state.rotation.yaw, t);
            this.rotation.pitch = Utils.lerp(this.rotation.pitch, state.rotation.pitch, t);
        }
        this._syncCamera();
    },

    /**
     * Check if the player is standing on the ground.
     * @returns {boolean}
     */
    isGrounded() {
        return this._isGrounded;
    },

    /**
     * Update camera aspect ratio on resize.
     */
    handleResize() {
        if (!this._camera) return;
        this._camera.aspect = window.innerWidth / window.innerHeight;
        this._camera.updateProjectionMatrix();
    },
};

// Backward-compatible getters used by main.js and other modules
Object.defineProperty(Player, 'camera', { get() { return Player._camera; }, configurable: true });
Object.defineProperty(Player, 'yaw', { get() { return Player.rotation ? Player.rotation.yaw : 0; }, configurable: true });
Object.defineProperty(Player, 'pitch', { get() { return Player.rotation ? Player.rotation.pitch : 0; }, configurable: true });



// =============================================
// REMOTE PLAYERS
// =============================================
// Manages blocky Roblox-like avatars for other
// players connected to the same game world.
// =============================================

const RemotePlayers = {
    /** @type {Map<string, object>} Map of player id -> avatar data */
    players: new Map(),

    /** @type {THREE.Scene|null} Reference to the world scene */
    _scene: null,

    /** Interpolation speed factor */
    _lerpSpeed: 10,

    /** Name tag height offset above head */
    _nameTagOffset: 0.55,

    // =============================================
    // INIT
    // =============================================

    /**
     * Initialize the remote players system.
     * @param {THREE.Scene} scene - The Three.js scene to add avatars to
     */
    init(scene) {
        this._scene = scene;
        this.players.clear();
    },

    // =============================================
    // ADD / REMOVE PLAYERS
    // =============================================

    /**
     * Add a remote player to the scene with a blocky avatar.
     * @param {string} id - Unique player identifier
     * @param {string} username - Display name
     * @param {object} avatarConfig - { bodyColor, headColor, headShape, bodyType, accessory }
     */
    addPlayer(id, username, avatarConfig = {}) {
        // Don't add duplicates
        if (this.players.has(id)) {
            this.removePlayer(id);
        }

        const group = new THREE.Group();
        group.name = `remotePlayer_${id}`;

        // Default colors if not provided
        const bodyColor = avatarConfig.bodyColor || BV.AVATAR_COLORS[Math.floor(Math.random() * BV.AVATAR_COLORS.length)];
        const headColor = avatarConfig.headColor || '#FFCC99'; // Skin tone
        const legColor = avatarConfig.legColor || '#3F51B5'; // Dark pants default

        // Body material (shared per avatar)
        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const headMat = new THREE.MeshLambertMaterial({ color: headColor });
        const legMat = new THREE.MeshLambertMaterial({ color: legColor });

        // --- HEAD ---
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const headMesh = new THREE.Mesh(headGeo, headMat);
        headMesh.position.set(0, 1.65, 0);
        headMesh.castShadow = true;
        headMesh.name = 'head';
        group.add(headMesh);

        // Head shape variations
        const headShape = avatarConfig.headShape || 'default';
        if (headShape === 'round') {
            headMesh.scale.set(1, 1, 1);
            // Round effect: just scale slightly
        } else if (headShape === 'square') {
            headMesh.scale.set(1.1, 0.9, 1.1);
        } else if (headShape === 'pointy') {
            // Add a small cone on top
            const coneGeo = new THREE.ConeGeometry(0.2, 0.3, 4);
            const coneMat = new THREE.MeshLambertMaterial({ color: bodyColor });
            const cone = new THREE.Mesh(coneGeo, coneMat);
            cone.position.set(0, 2.05, 0);
            cone.castShadow = true;
            group.add(cone);
        }

        // --- EYES (simple dark squares) ---
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 1.7, 0.26);
        group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 1.7, 0.26);
        group.add(rightEye);

        // --- BODY (torso) ---
        const bodyType = avatarConfig.bodyType || 'default';
        let bodyW = 0.5, bodyH = 0.7, bodyD = 0.3;
        if (bodyType === 'slim') { bodyW = 0.4; bodyD = 0.25; }
        else if (bodyType === 'wide') { bodyW = 0.6; bodyD = 0.35; }
        else if (bodyType === 'tall') { bodyH = 0.9; }

        const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.set(0, 1.05, 0);
        bodyMesh.castShadow = true;
        bodyMesh.name = 'body';
        group.add(bodyMesh);

        // --- ARMS ---
        const armType = avatarConfig.armType || 'default';
        let armW = 0.25, armH = 0.7, armD = 0.25;
        if (armType === 'short') { armH = 0.5; }
        else if (armType === 'long') { armH = 0.8; }
        else if (armType === 'thick') { armW = 0.3; armD = 0.3; }

        const armGeo = new THREE.BoxGeometry(armW, armH, armD);

        const leftArm = new THREE.Mesh(armGeo, bodyMat.clone());
        leftArm.position.set(-(bodyW / 2 + armW / 2), 1.05, 0);
        leftArm.castShadow = true;
        leftArm.name = 'leftArm';
        group.add(leftArm);

        const rightArm = new THREE.Mesh(armGeo, bodyMat.clone());
        rightArm.position.set(bodyW / 2 + armW / 2, 1.05, 0);
        rightArm.castShadow = true;
        rightArm.name = 'rightArm';
        group.add(rightArm);

        // --- LEGS ---
        const legType = avatarConfig.legType || 'default';
        let legH = 0.7;
        if (legType === 'short') { legH = 0.5; }
        else if (legType === 'long') { legH = 0.85; }

        const legGeo = new THREE.BoxGeometry(0.22, legH, 0.22);

        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-0.13, legH / 2, 0);
        leftLeg.castShadow = true;
        leftLeg.name = 'leftLeg';
        group.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(0.13, legH / 2, 0);
        rightLeg.castShadow = true;
        rightLeg.name = 'rightLeg';
        group.add(rightLeg);

        // --- ACCESSORY ---
        const accessory = avatarConfig.accessory || 'none';
        this._addAccessory(group, accessory, bodyColor);

        // --- NAME TAG ---
        const nameSprite = this._createNameTag(username);
        nameSprite.position.set(0, 2.2 + this._nameTagOffset, 0);
        nameSprite.name = 'nameTag';
        group.add(nameSprite);

        // Position group in scene
        group.position.set(0, 0, 0);
        if (this._scene) {
            this._scene.add(group);
        }

        // Store reference
        this.players.set(id, {
            id,
            username,
            group,
            state: {
                position: { x: 0, y: 0, z: 0 },
                rotation: 0, // Yaw only for body facing
            },
            targetState: {
                position: { x: 0, y: 0, z: 0 },
                rotation: 0,
            },
            animation: 'idle',
            animTime: 0,
            // Part references for animation
            parts: {
                head: headMesh,
                body: bodyMesh,
                leftArm,
                rightArm,
                leftLeg,
                rightLeg,
            },
            armDefaultY: 1.05,
            legDefaultY: legH / 2,
        });
    },

    /**
     * Add an accessory to the avatar group.
     * @param {THREE.Group} group
     * @param {string} type - 'none'|'hat'|'crown'|'wings'|'cape'|'horns'
     * @param {string} color - Hex color string
     */
    _addAccessory(group, type, color) {
        if (type === 'none') return;

        const mat = new THREE.MeshLambertMaterial({ color });

        switch (type) {
            case 'hat': {
                const brim = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.35, 0.35, 0.04, 8),
                    mat
                );
                brim.position.set(0, 1.92, 0);
                group.add(brim);
                const top = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.2, 0.22, 0.2, 8),
                    mat
                );
                top.position.set(0, 2.03, 0);
                group.add(top);
                break;
            }
            case 'crown': {
                const crownMat = new THREE.MeshLambertMaterial({ color: '#FFD700', emissive: '#FFA000', emissiveIntensity: 0.3 });
                const crown = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.22, 0.28, 0.18, 5),
                    crownMat
                );
                crown.position.set(0, 2.0, 0);
                group.add(crown);
                break;
            }
            case 'wings': {
                const wingMat = new THREE.MeshLambertMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.7, side: THREE.DoubleSide });
                const wingGeo = new THREE.PlaneGeometry(0.6, 0.8);
                const leftWing = new THREE.Mesh(wingGeo, wingMat);
                leftWing.position.set(-0.4, 1.3, 0);
                leftWing.rotation.z = 0.3;
                leftWing.name = 'leftWing';
                group.add(leftWing);
                const rightWing = new THREE.Mesh(wingGeo, wingMat);
                rightWing.position.set(0.4, 1.3, 0);
                rightWing.rotation.z = -0.3;
                rightWing.name = 'rightWing';
                group.add(rightWing);
                break;
            }
            case 'cape': {
                const capeMat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
                const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8), capeMat);
                cape.position.set(0, 1.0, -0.2);
                cape.name = 'cape';
                group.add(cape);
                break;
            }
            case 'horns': {
                const hornMat = new THREE.MeshLambertMaterial({ color: '#795548' });
                const hornGeo = new THREE.ConeGeometry(0.05, 0.2, 6);
                const leftHorn = new THREE.Mesh(hornGeo, hornMat);
                leftHorn.position.set(-0.15, 1.95, 0);
                leftHorn.rotation.z = 0.3;
                group.add(leftHorn);
                const rightHorn = new THREE.Mesh(hornGeo, hornMat);
                rightHorn.position.set(0.15, 1.95, 0);
                rightHorn.rotation.z = -0.3;
                group.add(rightHorn);
                break;
            }
        }
    },

    /**
     * Create a name tag sprite with canvas texture.
     * @param {string} username
     * @returns {THREE.Sprite}
     */
    _createNameTag(username) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Background pill
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        const textWidth = ctx.measureText(username).width;
        const padding = 40;
        const pillWidth = Math.max(200, ctx.measureText(username).width + padding * 2);
        const pillX = (512 - pillWidth) / 2;

        // Rounded rect
        const radius = 32;
        ctx.beginPath();
        ctx.moveTo(pillX + radius, 10);
        ctx.lineTo(pillX + pillWidth - radius, 10);
        ctx.quadraticCurveTo(pillX + pillWidth, 10, pillX + pillWidth, 10 + radius);
        ctx.lineTo(pillX + pillWidth, 118 - radius);
        ctx.quadraticCurveTo(pillX + pillWidth, 118, pillX + pillWidth - radius, 118);
        ctx.lineTo(pillX + radius, 118);
        ctx.quadraticCurveTo(pillX, 118, pillX, 118 - radius);
        ctx.lineTo(pillX, 10 + radius);
        ctx.quadraticCurveTo(pillX, 10, pillX + radius, 10);
        ctx.closePath();
        ctx.fill();

        // Text
        ctx.font = 'bold 48px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(username, 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(2, 0.5, 1);
        return sprite;
    },

    /**
     * Remove a remote player's avatar from the scene.
     * @param {string} id - Player id
     */
    removePlayer(id) {
        const data = this.players.get(id);
        if (!data) return;

        // Remove group from scene and dispose resources
        if (this._scene && data.group.parent === this._scene) {
            this._scene.remove(data.group);
        }

        // Dispose all meshes in the group
        data.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                if (child.material.dispose) child.material.dispose();
            }
        });

        this.players.delete(id);
    },

    // =============================================
    // UPDATE REMOTE PLAYER
    // =============================================

    /**
     * Update a remote player's target state (called from network).
     * Actual position is interpolated each frame.
     * @param {string} id - Player id
     * @param {object} state - { position:{x,y,z}, rotation:number(yaw) }
     */
    updatePlayer(id, state) {
        const data = this.players.get(id);
        if (!data) return;

        if (state.position) {
            data.targetState.position.x = state.position.x;
            data.targetState.position.y = state.position.y;
            data.targetState.position.z = state.position.z;
        }
        if (state.rotation !== undefined) {
            data.targetState.rotation = state.rotation;
        }
    },

    /**
     * Per-frame update for all remote players (interpolation + animation).
     * Call this in the main game loop.
     * @param {number} deltaTime - Time in seconds
     */
    updateAll(deltaTime) {
        const dt = Math.min(deltaTime, 0.1);
        const lerpFactor = Utils.clamp(this._lerpSpeed * dt, 0, 1);

        for (const [id, data] of this.players) {
            // Interpolate position
            data.state.position.x = Utils.lerp(data.state.position.x, data.targetState.position.x, lerpFactor);
            data.state.position.y = Utils.lerp(data.state.position.y, data.targetState.position.y, lerpFactor);
            data.state.position.z = Utils.lerp(data.state.position.z, data.targetState.position.z, lerpFactor);

            // Interpolate rotation
            data.state.rotation = Utils.lerp(data.state.rotation, data.targetState.rotation, lerpFactor);

            // Apply to group
            data.group.position.set(
                data.state.position.x,
                data.state.position.y,
                data.state.position.z
            );
            data.group.rotation.y = data.state.rotation;

            // Run animation
            data.animTime += dt;
            this._animateAvatar(data, dt);
        }
    },

    /**
     * Set a specific animation for a remote player.
     * @param {string} id - Player id
     * @param {string} animation - 'idle' | 'walk' | 'jump'
     */
    animatePlayer(id, animation) {
        const data = this.players.get(id);
        if (!data) return;
        data.animation = animation;
    },

    // =============================================
    // ANIMATION
    // =============================================

    /**
     * Run the current animation on an avatar.
     * @param {object} data - Player data from this.players
     * @param {number} dt - Delta time
     */
    _animateAvatar(data, dt) {
        const { parts, animation, animTime } = data;
        const t = animTime;
        const armY = data.armDefaultY;
        const legY = data.legDefaultY;

        switch (animation) {
            case 'idle': {
                // Subtle breathing / bobbing
                const bob = Math.sin(t * 2) * 0.02;
                parts.body.position.y = 1.05 + bob;
                parts.head.position.y = 1.65 + bob;
                // Arms at rest
                parts.leftArm.rotation.x = 0;
                parts.rightArm.rotation.x = 0;
                parts.leftLeg.rotation.x = 0;
                parts.rightLeg.rotation.x = 0;
                break;
            }
            case 'walk': {
                // Swing arms and legs in opposition
                const swing = Math.sin(t * 8) * 0.5;
                parts.leftArm.rotation.x = swing;
                parts.rightArm.rotation.x = -swing;
                parts.leftLeg.rotation.x = -swing;
                parts.rightLeg.rotation.x = swing;
                // Slight body bob
                const walkBob = Math.abs(Math.sin(t * 8)) * 0.03;
                parts.body.position.y = 1.05 + walkBob;
                parts.head.position.y = 1.65 + walkBob;
                break;
            }
            case 'jump': {
                // Legs together, arms up
                parts.leftArm.rotation.x = -0.8;
                parts.rightArm.rotation.x = -0.8;
                parts.leftLeg.rotation.x = 0.2;
                parts.rightLeg.rotation.x = 0.2;
                parts.body.position.y = 1.05;
                parts.head.position.y = 1.65;
                break;
            }
            default: {
                // Reset to idle
                parts.leftArm.rotation.x = 0;
                parts.rightArm.rotation.x = 0;
                parts.leftLeg.rotation.x = 0;
                parts.rightLeg.rotation.x = 0;
                parts.body.position.y = 1.05;
                parts.head.position.y = 1.65;
            }
        }
    },
};
