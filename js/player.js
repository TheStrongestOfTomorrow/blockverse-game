// ============================================
// BLOCKVERSE - Player Engine (Third-Person)
// ============================================
// Third-person player with visible blocky avatar,
// orbit camera (right-click drag), zoom (I/O keys),
// WASD movement, jump, collision detection.
// No pointer lock required.
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
    _keys: {},
    _isGrounded: false,
    _sprinting: false,

    // --- Camera orbit ---
    _cameraDistance: 6,         // Distance from player to camera
    _cameraMinDistance: 2,      // Minimum zoom
    _cameraMaxDistance: 20,     // Maximum zoom
    _cameraHeightOffset: 2.5,  // Camera height relative to player feet
    _cameraPitch: 0.4,         // Camera pitch angle (radians, 0 = horizontal)
    _cameraYaw: 0,             // Camera orbit yaw
    _rightMouseDown: false,
    _lastMouseX: 0,
    _lastMouseY: 0,

    // --- Collision ---
    _playerWidth: 0.6,
    _playerHeight: 1.8,
    _eyeOffset: 1.6,
    _fallThreshold: -20,

    // --- Avatar ---
    _avatarGroup: null,
    _avatarParts: {},
    _avatarVisible: true,
    _walkAnimTime: 0,

    // --- Active state ---
    _isActive: false,           // True when game screen is visible
    _gameCanvasHovered: false,

    // --- Input handling ---
    _onKeyDown: null,
    _onKeyUp: null,
    _onMouseMove: null,
    _onMouseDown: null,
    _onMouseUp: null,
    _onContextMenu: null,
    _onWheel: null,

    // =============================================
    // INITIALIZATION
    // =============================================

    init(camera, domElement) {
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
        this._cameraYaw = 0;
        this._cameraPitch = 0.4;
        this._cameraDistance = 6;
        this._isGrounded = false;
        this._isActive = true;
        this._keys = {};

        // Build avatar mesh
        this._buildAvatar();

        // --- Key handlers ---
        this._onKeyDown = this._handleKeyDown.bind(this);
        this._onKeyUp = this._handleKeyUp.bind(this);
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);

        // --- Mouse move ---
        this._onMouseMove = this._handleMouseMove.bind(this);
        document.addEventListener('mousemove', this._onMouseMove);

        // --- Mouse buttons ---
        this._onMouseDown = this._handleMouseDown.bind(this);
        this._onMouseUp = this._handleMouseUp.bind(this);
        this._domElement.addEventListener('mousedown', this._onMouseDown);
        document.addEventListener('mouseup', this._onMouseUp);

        // --- Context menu (right-click) ---
        this._onContextMenu = (e) => e.preventDefault();
        this._domElement.addEventListener('contextmenu', this._onContextMenu);

        // --- Scroll wheel for zoom ---
        this._onWheel = this._handleWheel.bind(this);
        this._domElement.addEventListener('wheel', this._onWheel, { passive: false });

        // --- Mouse enter/leave canvas ---
        this._domElement.addEventListener('mouseenter', () => { this._gameCanvasHovered = true; });
        this._domElement.addEventListener('mouseleave', () => { this._gameCanvasHovered = false; this._rightMouseDown = false; });

        this._syncCamera();
    },

    destroy() {
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('mousemove', this._onMouseMove);
        if (this._domElement) {
            this._domElement.removeEventListener('mousedown', this._onMouseDown);
            this._domElement.removeEventListener('contextmenu', this._onContextMenu);
            this._domElement.removeEventListener('wheel', this._onWheel);
        }
        document.removeEventListener('mouseup', this._onMouseUp);

        // Remove avatar from scene
        if (this._avatarGroup && this._avatarGroup.parent) {
            this._avatarGroup.parent.remove(this._avatarGroup);
        }
    },

    // =============================================
    // AVATAR CONSTRUCTION
    // =============================================

    _buildAvatar() {
        // Remove old avatar if exists
        if (this._avatarGroup && this._avatarGroup.parent) {
            this._avatarGroup.parent.remove(this._avatarGroup);
        }

        this._avatarGroup = new THREE.Group();
        this._avatarGroup.name = 'localPlayer';

        // Load avatar config from Auth if available
        let bodyColor = '#3F51B5';
        let headColor = '#FFCC99';
        let legColor = '#333366';
        if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
            const userData = Auth.getUserData(Auth.getCurrentUser());
            if (userData && userData.avatar) {
                bodyColor = userData.avatar.bodyColor || bodyColor;
                legColor = '#333366';
            }
        }

        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const headMat = new THREE.MeshLambertMaterial({ color: headColor });
        const legMat = new THREE.MeshLambertMaterial({ color: legColor });

        // --- HEAD ---
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const headMesh = new THREE.Mesh(headGeo, headMat);
        headMesh.position.set(0, 1.65, 0);
        headMesh.castShadow = true;
        this._avatarGroup.add(headMesh);

        // --- EYES ---
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 1.7, 0.26);
        this._avatarGroup.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 1.7, 0.26);
        this._avatarGroup.add(rightEye);

        // --- BODY ---
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.set(0, 1.05, 0);
        bodyMesh.castShadow = true;
        this._avatarGroup.add(bodyMesh);

        // --- ARMS ---
        const armGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);
        const leftArm = new THREE.Mesh(armGeo, bodyMat.clone());
        leftArm.position.set(-0.375, 1.05, 0);
        leftArm.castShadow = true;
        this._avatarGroup.add(leftArm);

        const rightArm = new THREE.Mesh(armGeo, bodyMat.clone());
        rightArm.position.set(0.375, 1.05, 0);
        rightArm.castShadow = true;
        this._avatarGroup.add(rightArm);

        // --- LEGS ---
        const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.22);
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-0.13, 0.35, 0);
        leftLeg.castShadow = true;
        this._avatarGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(0.13, 0.35, 0);
        rightLeg.castShadow = true;
        this._avatarGroup.add(rightLeg);

        // Store part references for animation
        this._avatarParts = { headMesh, bodyMesh, leftArm, rightArm, leftLeg, rightLeg };

        // Add to world scene
        if (typeof World !== 'undefined' && World.scene) {
            World.scene.add(this._avatarGroup);
        }
    },

    // =============================================
    // INPUT HANDLERS
    // =============================================

    _handleKeyDown(e) {
        if (!this._isActive) return;

        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;

        // Don't capture if chat is open
        if (typeof Chat !== 'undefined' && Chat.isVisible()) return;

        this._keys[e.code] = true;

        // Prevent default for game keys
        const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'];
        if (gameKeys.includes(e.code)) {
            e.preventDefault();
        }

        // Zoom keys
        if (e.code === 'KeyI') {
            this._cameraDistance = Math.max(this._cameraMinDistance, this._cameraDistance - 0.5);
        }
        if (e.code === 'KeyO') {
            this._cameraDistance = Math.min(this._cameraMaxDistance, this._cameraDistance + 0.5);
        }
    },

    _handleKeyUp(e) {
        this._keys[e.code] = false;
    },

    _handleMouseMove(e) {
        if (!this._isActive || !this._rightMouseDown) return;

        const sensitivity = BV.MOUSE_SENSITIVITY;
        const dx = e.clientX - this._lastMouseX;
        const dy = e.clientY - this._lastMouseY;

        // Orbit camera
        this._cameraYaw -= dx * sensitivity;
        this._cameraPitch -= dy * sensitivity * 0.6;
        this._cameraPitch = Utils.clamp(this._cameraPitch, -0.2, 1.2);

        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
    },

    _handleMouseDown(e) {
        if (!this._isActive) return;

        if (e.button === 2) {
            // Right click = orbit camera
            this._rightMouseDown = true;
            this._lastMouseX = e.clientX;
            this._lastMouseY = e.clientY;
        }
    },

    _handleMouseUp(e) {
        if (e.button === 2) {
            this._rightMouseDown = false;
        }
    },

    _handleWheel(e) {
        if (!this._isActive) return;
        e.preventDefault();

        const zoomSpeed = 0.8;
        if (e.deltaY > 0) {
            this._cameraDistance = Math.min(this._cameraMaxDistance, this._cameraDistance + zoomSpeed);
        } else {
            this._cameraDistance = Math.max(this._cameraMinDistance, this._cameraDistance - zoomSpeed);
        }
    },

    // =============================================
    // POINTER LOCK (compatibility stubs)
    // =============================================

    lock() {
        // In third-person, we don't use pointer lock
        // Just mark as active
        this._isActive = true;
    },

    unlock() {
        // Nothing to unlock in third-person
    },

    isLocked() {
        // Always return true in third-person mode when game is active
        return this._isActive;
    },

    // =============================================
    // ACTIVE STATE
    // =============================================

    setActive(active) {
        this._isActive = active;
        if (this._avatarGroup) {
            this._avatarGroup.visible = active;
        }
    },

    isActive() {
        return this._isActive;
    },

    // =============================================
    // PER-FRAME UPDATE
    // =============================================

    update(deltaTime, blockMap) {
        if (!this._isActive) return;

        const dt = Math.min(deltaTime, 0.1);

        // --- Sprint state ---
        this._sprinting = !!(this._keys['ShiftLeft'] || this._keys['ShiftRight']);
        const speed = this._sprinting ? BV.PLAYER_SPRINT_SPEED : BV.PLAYER_SPEED;

        // --- Player faces camera direction (yaw only) ---
        this.rotation.yaw = this._cameraYaw;

        // --- Calculate movement direction from camera yaw ---
        const forward = new THREE.Vector3(
            -Math.sin(this._cameraYaw),
            0,
            -Math.cos(this._cameraYaw)
        );
        const right = new THREE.Vector3(
            Math.cos(this._cameraYaw),
            0,
            -Math.sin(this._cameraYaw)
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
        const isMoving = inputLen > 0;
        if (isMoving) {
            inputX = (inputX / inputLen) * speed;
            inputZ = (inputZ / inputLen) * speed;
        }

        // --- Gravity ---
        this.velocity.y += BV.GRAVITY * dt;

        // --- Jump ---
        if (this._keys['Space'] && this._isGrounded) {
            this.velocity.y = BV.JUMP_FORCE;
            this._isGrounded = false;
        }

        // --- Horizontal movement with damping ---
        const damping = this._isGrounded ? 12 : 4;
        this.velocity.x = Utils.lerp(this.velocity.x, inputX, damping * dt);
        this.velocity.z = Utils.lerp(this.velocity.z, inputZ, damping * dt);

        // --- Apply velocity with collision ---
        this._moveAxis('x', this.velocity.x * dt, blockMap);
        this._moveAxis('y', this.velocity.y * dt, blockMap);
        this._moveAxis('z', this.velocity.z * dt, blockMap);

        // --- Fall threshold / respawn ---
        if (this.position.y < this._fallThreshold) {
            this.position = { x: 0, y: 5, z: 0 };
            this.velocity = { x: 0, y: 0, z: 0 };
        }

        // --- Animate avatar ---
        this._animateAvatar(dt, isMoving);

        // --- Sync camera and avatar position ---
        this._syncCamera();
        this._syncAvatar();
    },

    _animateAvatar(dt, isMoving) {
        const parts = this._avatarParts;
        if (!parts || !this._avatarGroup) return;

        if (isMoving && this._isGrounded) {
            this._walkAnimTime += dt;
            const swing = Math.sin(this._walkAnimTime * 8) * 0.5;
            parts.leftArm.rotation.x = swing;
            parts.rightArm.rotation.x = -swing;
            parts.leftLeg.rotation.x = -swing;
            parts.rightLeg.rotation.x = swing;
            const bob = Math.abs(Math.sin(this._walkAnimTime * 8)) * 0.03;
            parts.bodyMesh.position.y = 1.05 + bob;
            parts.headMesh.position.y = 1.65 + bob;
        } else if (!this._isGrounded) {
            // Jumping - arms up
            parts.leftArm.rotation.x = -0.8;
            parts.rightArm.rotation.x = -0.8;
            parts.leftLeg.rotation.x = 0.2;
            parts.rightLeg.rotation.x = 0.2;
            parts.bodyMesh.position.y = 1.05;
            parts.headMesh.position.y = 1.65;
        } else {
            // Idle - subtle breathing
            this._walkAnimTime = 0;
            const bob = Math.sin(performance.now() * 0.002) * 0.02;
            parts.leftArm.rotation.x = 0;
            parts.rightArm.rotation.x = 0;
            parts.leftLeg.rotation.x = 0;
            parts.rightLeg.rotation.x = 0;
            parts.bodyMesh.position.y = 1.05 + bob;
            parts.headMesh.position.y = 1.65 + bob;
        }
    },

    _syncAvatar() {
        if (!this._avatarGroup) return;
        this._avatarGroup.position.set(this.position.x, this.position.y, this.position.z);
        this._avatarGroup.rotation.y = this.rotation.yaw;
    },

    _syncCamera() {
        if (!this._camera) return;

        // Calculate camera position based on orbit angles
        const camX = this.position.x + Math.sin(this._cameraYaw) * this._cameraDistance * Math.cos(this._cameraPitch);
        const camY = this.position.y + this._cameraHeightOffset + Math.sin(this._cameraPitch) * this._cameraDistance;
        const camZ = this.position.z + Math.cos(this._cameraYaw) * this._cameraDistance * Math.cos(this._cameraPitch);

        this._camera.position.set(camX, camY, camZ);

        // Look at player's upper body
        const lookTarget = new THREE.Vector3(
            this.position.x,
            this.position.y + 1.2,
            this.position.z
        );
        this._camera.lookAt(lookTarget);
    },

    // =============================================
    // COLLISION DETECTION
    // =============================================

    _moveAxis(axis, delta, blockMap) {
        if (Math.abs(delta) < 0.0001) return;

        const newPos = { x: this.position.x, y: this.position.y, z: this.position.z };
        newPos[axis] += delta;

        if (this._checkCollision(newPos, blockMap)) {
            this.velocity[axis] = 0;

            if (axis === 'y' && delta < 0) {
                this._isGrounded = true;
                const snapY = this._findGroundY(newPos, blockMap);
                if (snapY !== null) {
                    this.position.y = snapY;
                }
            }
        } else {
            this.position[axis] = newPos[axis];
            if (axis === 'y' && delta < 0) {
                this._isGrounded = false;
            }
        }
    },

    _checkCollision(pos, blockMap) {
        if (!blockMap) return false;
        const hw = this._playerWidth / 2;
        const ph = this._playerHeight;

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
                        if (
                            pos.x - hw < bx + 1 && pos.x + hw > bx &&
                            pos.y < by + 1 && pos.y + ph > by &&
                            pos.z - hw < bz + 1 && pos.z + hw > bz
                        ) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    },

    _findGroundY(pos, blockMap) {
        if (!blockMap) return null;
        const hw = this._playerWidth / 2;
        const checkX = [Math.floor(pos.x - hw), Math.floor(pos.x + hw)];
        const checkZ = [Math.floor(pos.z - hw), Math.floor(pos.z + hw)];

        let highestY = null;

        for (const cx of checkX) {
            for (const cz of checkZ) {
                for (let by = Math.floor(pos.y); by >= Math.floor(pos.y) - 2; by--) {
                    const key = `${cx},${by},${cz}`;
                    if (blockMap[key]) {
                        const topY = by + 1;
                        if (highestY === null || topY > highestY) {
                            highestY = topY;
                        }
                        break;
                    }
                }
            }
        }
        return highestY;
    },

    // =============================================
    // STATE ACCESSORS
    // =============================================

    setPosition(x, y, z) {
        this.position.x = x;
        this.position.y = y;
        this.position.z = z;
        this.velocity = { x: 0, y: 0, z: 0 };
        this._syncCamera();
        this._syncAvatar();
    },

    getPosition() {
        return { x: this.position.x, y: this.position.y, z: this.position.z };
    },

    getRotation() {
        return { yaw: this.rotation.yaw, pitch: this.rotation.pitch };
    },

    getState() {
        return {
            position: { x: this.position.x, y: this.position.y, z: this.position.z },
            rotation: { yaw: this.rotation.yaw, pitch: this.rotation.pitch },
            velocity: { x: this.velocity.x, y: this.velocity.y, z: this.velocity.z },
        };
    },

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
        this._syncAvatar();
    },

    isGrounded() {
        return this._isGrounded;
    },

    handleResize() {
        if (!this._camera) return;
        this._camera.aspect = window.innerWidth / window.innerHeight;
        this._camera.updateProjectionMatrix();
    },

    /** Get the forward direction the player is facing (for raycasting tools) */
    getForwardDirection() {
        return new THREE.Vector3(
            -Math.sin(this._cameraYaw),
            0,
            -Math.cos(this._cameraYaw)
        ).normalize();
    },
};

// Backward-compatible getters
Object.defineProperty(Player, 'camera', { get() { return Player._camera; }, configurable: true });
Object.defineProperty(Player, 'yaw', { get() { return Player.rotation ? Player.rotation.yaw : 0; }, configurable: true });
Object.defineProperty(Player, 'pitch', { get() { return Player.rotation ? Player.rotation.pitch : 0; }, configurable: true });


// =============================================
// REMOTE PLAYERS
// =============================================

const RemotePlayers = {
    players: new Map(),
    _scene: null,
    _lerpSpeed: 10,
    _nameTagOffset: 0.55,

    init(scene) {
        this._scene = scene;
        this.players.clear();
    },

    addPlayer(id, username, avatarConfig = {}) {
        if (this.players.has(id)) {
            this.removePlayer(id);
        }

        const group = new THREE.Group();
        group.name = `remotePlayer_${id}`;

        const bodyColor = avatarConfig.bodyColor || BV.AVATAR_COLORS[Math.floor(Math.random() * BV.AVATAR_COLORS.length)];
        const headColor = avatarConfig.headColor || '#FFCC99';
        const legColor = avatarConfig.legColor || '#333366';

        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const headMat = new THREE.MeshLambertMaterial({ color: headColor });
        const legMat = new THREE.MeshLambertMaterial({ color: legColor });

        // HEAD
        const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
        headMesh.position.set(0, 1.65, 0);
        headMesh.castShadow = true;
        group.add(headMesh);

        // EYES
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 1.7, 0.26);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 1.7, 0.26);
        group.add(rightEye);

        // BODY
        const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), bodyMat);
        bodyMesh.position.set(0, 1.05, 0);
        bodyMesh.castShadow = true;
        group.add(bodyMesh);

        // ARMS
        const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), bodyMat.clone());
        leftArm.position.set(-0.375, 1.05, 0);
        leftArm.castShadow = true;
        group.add(leftArm);

        const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), bodyMat.clone());
        rightArm.position.set(0.375, 1.05, 0);
        rightArm.castShadow = true;
        group.add(rightArm);

        // LEGS
        const legH = 0.7;
        const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, legH, 0.22), legMat);
        leftLeg.position.set(-0.13, legH / 2, 0);
        leftLeg.castShadow = true;
        group.add(leftLeg);

        const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, legH, 0.22), legMat);
        rightLeg.position.set(0.13, legH / 2, 0);
        rightLeg.castShadow = true;
        group.add(rightLeg);

        // NAME TAG
        const nameSprite = this._createNameTag(username);
        nameSprite.position.set(0, 2.3, 0);
        group.add(nameSprite);

        group.position.set(0, 0, 0);
        if (this._scene) {
            this._scene.add(group);
        }

        this.players.set(id, {
            id, username, group,
            state: { position: { x: 0, y: 0, z: 0 }, rotation: 0 },
            targetState: { position: { x: 0, y: 0, z: 0 }, rotation: 0 },
            animation: 'idle',
            animTime: 0,
            parts: { headMesh, bodyMesh, leftArm, rightArm, leftLeg, rightLeg },
        });
    },

    _createNameTag(username) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        ctx.font = 'bold 48px Arial, sans-serif';
        const textWidth = ctx.measureText(username).width;
        const pillWidth = Math.max(200, textWidth + 80);
        const pillX = (512 - pillWidth) / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
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

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(username, 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(2, 0.5, 1);
        return sprite;
    },

    removePlayer(id) {
        const data = this.players.get(id);
        if (!data) return;

        if (this._scene && data.group.parent === this._scene) {
            this._scene.remove(data.group);
        }
        data.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                if (child.material.dispose) child.material.dispose();
            }
        });
        this.players.delete(id);
    },

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

    updateAll(deltaTime) {
        const dt = Math.min(deltaTime, 0.1);
        const lerpFactor = Utils.clamp(this._lerpSpeed * dt, 0, 1);

        for (const [id, data] of this.players) {
            data.state.position.x = Utils.lerp(data.state.position.x, data.targetState.position.x, lerpFactor);
            data.state.position.y = Utils.lerp(data.state.position.y, data.targetState.position.y, lerpFactor);
            data.state.position.z = Utils.lerp(data.state.position.z, data.targetState.position.z, lerpFactor);
            data.state.rotation = Utils.lerp(data.state.rotation, data.targetState.rotation, lerpFactor);

            data.group.position.set(
                data.state.position.x,
                data.state.position.y,
                data.state.position.z
            );
            data.group.rotation.y = data.state.rotation;

            data.animTime += dt;
            this._animateAvatar(data, dt);
        }
    },

    animatePlayer(id, animation) {
        const data = this.players.get(id);
        if (!data) return;
        data.animation = animation;
    },

    _animateAvatar(data, dt) {
        const { parts, animTime } = data;
        const t = animTime;

        switch (data.animation) {
            case 'idle': {
                const bob = Math.sin(t * 2) * 0.02;
                parts.bodyMesh.position.y = 1.05 + bob;
                parts.headMesh.position.y = 1.65 + bob;
                parts.leftArm.rotation.x = 0;
                parts.rightArm.rotation.x = 0;
                parts.leftLeg.rotation.x = 0;
                parts.rightLeg.rotation.x = 0;
                break;
            }
            case 'walk': {
                const swing = Math.sin(t * 8) * 0.5;
                parts.leftArm.rotation.x = swing;
                parts.rightArm.rotation.x = -swing;
                parts.leftLeg.rotation.x = -swing;
                parts.rightLeg.rotation.x = swing;
                const walkBob = Math.abs(Math.sin(t * 8)) * 0.03;
                parts.bodyMesh.position.y = 1.05 + walkBob;
                parts.headMesh.position.y = 1.65 + walkBob;
                break;
            }
            case 'jump': {
                parts.leftArm.rotation.x = -0.8;
                parts.rightArm.rotation.x = -0.8;
                parts.leftLeg.rotation.x = 0.2;
                parts.rightLeg.rotation.x = 0.2;
                parts.bodyMesh.position.y = 1.05;
                parts.headMesh.position.y = 1.65;
                break;
            }
            default: {
                parts.leftArm.rotation.x = 0;
                parts.rightArm.rotation.x = 0;
                parts.leftLeg.rotation.x = 0;
                parts.rightLeg.rotation.x = 0;
                parts.bodyMesh.position.y = 1.05;
                parts.headMesh.position.y = 1.65;
            }
        }
    },
};
