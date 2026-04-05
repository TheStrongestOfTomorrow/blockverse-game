// ============================================
// BLOCKVERSE - Player Engine (Third-Person)
// ============================================
// Roblox-style third-person player:
// - Orbit camera: right-click drag to rotate
// - Zoom: I/O keys + scroll wheel
// - WASD movement relative to camera direction
// - Body ONLY rotates when moving (faces movement dir)
// - When stationary, body keeps last movement facing
// - Jump: Space bar with gravity
// - No pointer lock required
// ============================================

const Player = {
    // --- Camera & DOM ---
    _camera: null,
    _domElement: null,

    // --- State ---
    position: { x: 0, y: 5, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    rotation: { yaw: 0, pitch: 0 },

    // --- Movement ---
    _keys: {},
    _isGrounded: false,
    _sprinting: false,
    _lastMovementYaw: 0,    // Body remembers last movement direction
    _hasMovedOnce: false,    // Track if player has ever moved

    // --- Mouse tracking for cursor-based raycasting ---
    _mouseNDC: { x: 0, y: 0 },  // Normalized device coords (-1 to 1)
    _mouseScreenX: 0,
    _mouseScreenY: 0,

    // --- Camera orbit & Smoothing ---
    _cameraDistance: 6,
    _cameraMinDistance: 2,
    _cameraMaxDistance: 25,
    _cameraHeightOffset: 2.5,
    _cameraPitch: 0.35,       // Radians: slight downward angle
    _cameraYaw: 0,            // Orbit yaw around player
    _targetCameraYaw: 0,
    _targetCameraPitch: 0.35,
    _currentCameraPos: new THREE.Vector3(),
    _currentLookTarget: new THREE.Vector3(),
    _cameraLerpSpeed: 10,     // Speed of camera position smoothing
    _rotationLerpSpeed: 15,   // Speed of rotation smoothing
    _rightMouseDown: false,
    _lastMouseX: 0,
    _lastMouseY: 0,

    // --- Collision ---
    _playerWidth: 0.6,
    _playerHeight: 1.8,
    _eyeOffset: 1.6,
    _fallThreshold: -30,

    // --- Avatar ---
    _avatarGroup: null,
    _avatarParts: {},
    _avatarVisible: true,
    _walkAnimTime: 0,

    // --- Active state ---
    _isActive: false,
    _gameCanvasHovered: false,

    // --- Input handling ---
    _onKeyDown: null,
    _onKeyUp: null,
    _onMouseMove: null,
    _onMouseDown: null,
    _onMouseUp: null,
    _onContextMenu: null,
    _onWheel: null,

    // --- Mobile Input ---
    _isMobile: false,
    _joystickInput: { x: 0, y: 0 },
    _touchActive: false,

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
        this.position = { x: 0, y: 5, z: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.rotation = { yaw: 0, pitch: 0 };
        this._cameraYaw = 0;
        this._cameraPitch = 0.35;
        this._targetCameraYaw = 0;
        this._targetCameraPitch = 0.35;
        this._cameraDistance = 6;
        this._isGrounded = false;
        this._isActive = true;
        this._keys = {};
        this._lastMovementYaw = 0;
        this._hasMovedOnce = false;
        this._mouseNDC = { x: 0, y: 0 };

        // Initialize smoothing vectors
        this._currentCameraPos.set(0, 7.5, 6);
        this._currentLookTarget.set(0, 1.2, 0);

        // Build avatar mesh
        this._buildAvatar();

        // --- Key handlers ---
        this._onKeyDown = this._handleKeyDown.bind(this);
        this._onKeyUp = this._handleKeyUp.bind(this);
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);

        // --- Mouse move (on document so dragging outside canvas works) ---
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

        // --- Mobile Controls ---
        this._initMobileControls();

        this._syncCamera();
    },

    _initMobileControls() {
        this._isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        const mobileContainer = document.getElementById('mobile-controls');
        if (!mobileContainer) return;

        if (this._isMobile) {
            mobileContainer.classList.remove('hidden');

            const joystickBase = document.getElementById('joystick-base');
            const joystickThumb = document.getElementById('joystick-thumb');
            const jumpBtn = document.getElementById('mobile-jump-btn');

            if (joystickBase && joystickThumb) {
                const handleJoystick = (e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const rect = joystickBase.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const maxDist = rect.width / 2;

                    let dx = touch.clientX - centerX;
                    let dy = touch.clientY - centerY;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > maxDist) {
                        dx *= maxDist / dist;
                        dy *= maxDist / dist;
                    }

                    joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                    this._joystickInput.x = dx / maxDist;
                    this._joystickInput.y = dy / maxDist;
                };

                joystickBase.addEventListener('touchstart', handleJoystick);
                joystickBase.addEventListener('touchmove', handleJoystick);
                joystickBase.addEventListener('touchend', () => {
                    joystickThumb.style.transform = 'translate(-50%, -50%)';
                    this._joystickInput.x = 0;
                    this._joystickInput.y = 0;
                });
            }

            if (jumpBtn) {
                jumpBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this._keys['Space'] = true;
                });
                jumpBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    this._keys['Space'] = false;
                });
            }

            // Touch-based camera rotation
            this._onTouchStart = (e) => {
                // If not touching a control, start rotation
                if (e.target === this._domElement) {
                    this._touchActive = true;
                    const touch = e.touches[0];
                    this._lastMouseX = touch.clientX;
                    this._lastMouseY = touch.clientY;
                }
            };

            this._onTouchMove = (e) => {
                if (this._touchActive) {
                    const touch = e.touches[0];
                    const dx = touch.clientX - this._lastMouseX;
                    const dy = touch.clientY - this._lastMouseY;
                    const sensitivity = BV.MOUSE_SENSITIVITY * 1.5;

                    this._targetCameraYaw -= dx * sensitivity;
                    this._targetCameraPitch -= dy * sensitivity * 0.6;
                    this._targetCameraPitch = Utils.clamp(this._targetCameraPitch, -0.5, 1.4);

                    this._lastMouseX = touch.clientX;
                    this._lastMouseY = touch.clientY;
                }
            };

            this._onTouchEnd = () => {
                this._touchActive = false;
            };

            this._domElement.addEventListener('touchstart', this._onTouchStart, { passive: false });
            this._domElement.addEventListener('touchmove', this._onTouchMove, { passive: false });
            this._domElement.addEventListener('touchend', this._onTouchEnd);
        }
    },

    destroy() {
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('mousemove', this._onMouseMove);
        if (this._domElement) {
            this._domElement.removeEventListener('mousedown', this._onMouseDown);
            this._domElement.removeEventListener('contextmenu', this._onContextMenu);
            this._domElement.removeEventListener('wheel', this._onWheel);

            // Mobile listeners
            this._domElement.removeEventListener('touchstart', this._onTouchStart);
            this._domElement.removeEventListener('touchmove', this._onTouchMove);
            this._domElement.removeEventListener('touchend', this._onTouchEnd);
        }
        document.removeEventListener('mouseup', this._onMouseUp);

        if (this._avatarGroup && this._avatarGroup.parent) {
            this._avatarGroup.parent.remove(this._avatarGroup);
        }
    },

    // =============================================
    // AVATAR CONSTRUCTION
    // =============================================

    _buildAvatar() {
        if (this._avatarGroup && this._avatarGroup.parent) {
            this._avatarGroup.parent.remove(this._avatarGroup);
        }

        this._avatarGroup = new THREE.Group();
        this._avatarGroup.name = 'localPlayer';

        let bodyColor = '#3F51B5';
        let headColor = '#FFCC99';
        let legColor = '#333366';
        if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
            const userData = Auth.getUserData(Auth.getCurrentUser());
            if (userData && userData.avatar) {
                bodyColor = userData.avatar.bodyColor || bodyColor;
            }
        }

        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const headMat = new THREE.MeshLambertMaterial({ color: headColor });
        const legMat = new THREE.MeshLambertMaterial({ color: legColor });

        // --- HEAD (eyes face -Z direction = into the screen when yaw=0) ---
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const headMesh = new THREE.Mesh(headGeo, headMat);
        headMesh.position.set(0, 1.65, 0);
        headMesh.castShadow = true;
        this._avatarGroup.add(headMesh);

        // --- EYES (facing -Z = forward direction) ---
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 1.7, -0.26);  // -Z = forward
        this._avatarGroup.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 1.7, -0.26);   // -Z = forward
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

        this._avatarParts = { headMesh, bodyMesh, leftArm, rightArm, leftLeg, rightLeg };

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
        if (typeof Chat !== 'undefined' && Chat.isVisible()) return;

        this._keys[e.code] = true;

        // Prevent default for game keys
        const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyI', 'KeyO'];
        if (gameKeys.includes(e.code)) {
            e.preventDefault();
        }

        // Zoom keys
        if (e.code === 'KeyI') {
            this._cameraDistance = Math.max(this._cameraMinDistance, this._cameraDistance - 0.8);
        }
        if (e.code === 'KeyO') {
            this._cameraDistance = Math.min(this._cameraMaxDistance, this._cameraDistance + 0.8);
        }
    },

    _handleKeyUp(e) {
        this._keys[e.code] = false;
    },

    _handleMouseMove(e) {
        if (!this._isActive) return;

        // Always track mouse position for cursor-based raycasting
        this._mouseScreenX = e.clientX;
        this._mouseScreenY = e.clientY;

        // Calculate NDC (normalized device coordinates) relative to the canvas
        const rect = this._domElement.getBoundingClientRect();
        this._mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this._mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        // Only orbit camera when right mouse button is held
        if (!this._rightMouseDown) return;

        const sensitivity = BV.MOUSE_SENSITIVITY;
        const dx = e.clientX - this._lastMouseX;
        const dy = e.clientY - this._lastMouseY;

        // Update target rotation, which _syncCamera will smoothly lerp towards
        this._targetCameraYaw -= dx * sensitivity;
        this._targetCameraPitch -= dy * sensitivity * 0.6;

        // Clamp pitch: allow from below-horizontal to nearly top-down
        this._targetCameraPitch = Utils.clamp(this._targetCameraPitch, -0.5, 1.4);

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
            e.preventDefault();
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

    lock() { this._isActive = true; },
    unlock() {},
    isLocked() { return this._isActive; },

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
    // MOUSE NDC (for Tools raycasting)
    // =============================================

    getMouseNDC() {
        return { x: this._mouseNDC.x, y: this._mouseNDC.y };
    },

    // =============================================
    // PER-FRAME UPDATE
    // =============================================

    update(deltaTime, blockMap) {
        if (!this._isActive) return;

        const dt = Math.min(deltaTime, 0.05); // Cap at 50ms to prevent physics tunneling

        // --- Sprint ---
        this._sprinting = !!(this._keys['ShiftLeft'] || this._keys['ShiftRight']);
        const speed = this._sprinting ? BV.PLAYER_SPRINT_SPEED : BV.PLAYER_SPEED;

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

        // Keyboard input
        if (this._keys['KeyW']) { inputX += forward.x; inputZ += forward.z; }
        if (this._keys['KeyS']) { inputX -= forward.x; inputZ -= forward.z; }
        if (this._keys['KeyA']) { inputX -= right.x; inputZ -= right.z; }
        if (this._keys['KeyD']) { inputX += right.x; inputZ += right.z; }

        // Mobile joystick input
        if (this._isMobile) {
            inputX += forward.x * -this._joystickInput.y + right.x * this._joystickInput.x;
            inputZ += forward.z * -this._joystickInput.y + right.z * this._joystickInput.x;
        }

        // Normalize diagonal movement
        const inputLen = Math.sqrt(inputX * inputX + inputZ * inputZ);
        const isMoving = inputLen > 0.01;
        if (isMoving) {
            inputX = (inputX / inputLen) * speed;
            inputZ = (inputZ / inputLen) * speed;

            // === KEY FIX: Body ONLY faces movement direction when actually moving ===
            // Calculate the angle the player is moving in
            this._lastMovementYaw = Math.atan2(inputX, inputZ);
            this._hasMovedOnce = true;
        }

        // Body rotation: use last movement direction (NOT camera yaw)
        // When stationary, body stays facing last movement direction
        if (this._hasMovedOnce) {
            this.rotation.yaw = this._lastMovementYaw;
        } else {
            // Before first movement, face away from camera (into the screen)
            this.rotation.yaw = this._cameraYaw;
        }

        // --- Gravity ---
        this.velocity.y += BV.GRAVITY * dt;

        // --- Jump ---
        if (this._keys['Space'] && this._isGrounded) {
            this.velocity.y = BV.JUMP_FORCE;
            this._isGrounded = false;
        }

        // --- Horizontal movement with smooth damping ---
        const damping = this._isGrounded ? 12 : 5;
        this.velocity.x = Utils.lerp(this.velocity.x, inputX, damping * dt);
        this.velocity.z = Utils.lerp(this.velocity.z, inputZ, damping * dt);

        // --- Apply velocity with collision (step by step for better accuracy) ---
        this._moveAxis('x', this.velocity.x * dt, blockMap);
        this._moveAxis('y', this.velocity.y * dt, blockMap);
        this._moveAxis('z', this.velocity.z * dt, blockMap);

        // --- Safety: invisible ground at y = -0.5 if nothing below ---
        if (blockMap && !this._isGrounded) {
            const hw = this._playerWidth / 2;
            const feetY = this.position.y;
            let hasGroundBelow = false;
            for (let by = Math.floor(feetY) - 1; by >= Math.floor(feetY) - 3; by--) {
                for (let cx = Math.floor(this.position.x - hw); cx <= Math.floor(this.position.x + hw); cx++) {
                    for (let cz = Math.floor(this.position.z - hw); cz <= Math.floor(this.position.z + hw); cz++) {
                        if (blockMap.get && blockMap.get(blockKey(cx, by, cz))) {
                            hasGroundBelow = true;
                            break;
                        }
                    }
                    if (hasGroundBelow) break;
                }
                if (hasGroundBelow) break;
            }
            if (!hasGroundBelow && feetY < 0.5) {
                this.position.y = 0.5;
                this.velocity.y = 0;
                this._isGrounded = true;
            }
        }

        // --- Fall threshold / respawn ---
        if (this.position.y < this._fallThreshold) {
            this.position = { x: 0, y: 5, z: 0 };
            this.velocity = { x: 0, y: 0, z: 0 };
        }

        // --- Animate avatar ---
        this._animateAvatar(dt, isMoving);

        // --- Sync camera and avatar position ---
        this._syncCamera(dt);
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
            parts.leftArm.rotation.x = -0.8;
            parts.rightArm.rotation.x = -0.8;
            parts.leftLeg.rotation.x = 0.2;
            parts.rightLeg.rotation.x = 0.2;
            parts.bodyMesh.position.y = 1.05;
            parts.headMesh.position.y = 1.65;
        } else {
            this._walkAnimTime = 0;
            const bob = Math.sin(performance.now() * 0.002) * 0.015;
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
        // Avatar faces the movement direction (already stored in this.rotation.yaw)
        // No PI offset needed since the model faces -Z and atan2 gives the correct angle
        this._avatarGroup.rotation.y = this.rotation.yaw;
    },

    _syncCamera(dt = 0.016) {
        if (!this._camera) return;

        // Smoothen rotation angles
        const rotLerp = Utils.clamp(this._rotationLerpSpeed * dt, 0, 1);
        this._cameraYaw = Utils.lerp(this._cameraYaw, this._targetCameraYaw, rotLerp);
        this._cameraPitch = Utils.lerp(this._cameraPitch, this._targetCameraPitch, rotLerp);

        // Calculate target camera position
        const targetCamX = this.position.x + Math.sin(this._cameraYaw) * this._cameraDistance * Math.cos(this._cameraPitch);
        const targetCamY = this.position.y + this._cameraHeightOffset + Math.sin(this._cameraPitch) * this._cameraDistance;
        const targetCamZ = this.position.z + Math.cos(this._cameraYaw) * this._cameraDistance * Math.cos(this._cameraPitch);

        // Calculate target look point (upper body)
        const targetLookX = this.position.x;
        const targetLookY = this.position.y + 1.2;
        const targetLookZ = this.position.z;

        // Apply linear interpolation to camera position and look target
        const posLerp = Utils.clamp(this._cameraLerpSpeed * dt, 0, 1);

        this._currentCameraPos.x = Utils.lerp(this._currentCameraPos.x, targetCamX, posLerp);
        this._currentCameraPos.y = Utils.lerp(this._currentCameraPos.y, targetCamY, posLerp);
        this._currentCameraPos.z = Utils.lerp(this._currentCameraPos.z, targetCamZ, posLerp);

        this._currentLookTarget.x = Utils.lerp(this._currentLookTarget.x, targetLookX, posLerp);
        this._currentLookTarget.y = Utils.lerp(this._currentLookTarget.y, targetLookY, posLerp);
        this._currentLookTarget.z = Utils.lerp(this._currentLookTarget.z, targetLookZ, posLerp);

        this._camera.position.copy(this._currentCameraPos);
        this._camera.lookAt(this._currentLookTarget);
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

            if (axis === 'y') {
                if (delta < 0) {
                    // Moving down and hit something = landing
                    this._isGrounded = true;
                    const snapY = this._findGroundY(newPos, blockMap);
                    if (snapY !== null) {
                        this.position.y = snapY;
                    }
                } else if (delta > 0) {
                    // Moving up and hit something = bonked head
                    this.velocity.y = 0;
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

        const mapGet = blockMap.get ? (k) => blockMap.get(k) : (k) => blockMap[k];

        for (let bx = minBX; bx <= maxBX; bx++) {
            for (let by = minBY; by <= maxBY; by++) {
                for (let bz = minBZ; bz <= maxBZ; bz++) {
                    if (mapGet(blockKey(bx, by, bz))) {
                        const eps = 0.001;
                        if (
                            pos.x - hw < bx + 1 - eps &&
                            pos.x + hw > bx + eps &&
                            pos.y < by + 1 - eps &&
                            pos.y + ph > by + eps &&
                            pos.z - hw < bz + 1 - eps &&
                            pos.z + hw > bz + eps
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

        const mapGet = blockMap.get ? (k) => blockMap.get(k) : (k) => blockMap[k];
        let highestY = null;

        for (const cx of checkX) {
            for (const cz of checkZ) {
                const startY = Math.floor(pos.y + 0.5);
                for (let by = startY; by >= startY - 3; by--) {
                    if (mapGet(blockKey(cx, by, cz))) {
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

    /**
     * Respawn the player at the spawn point.
     * Resets position, velocity, and camera to defaults.
     */
    respawn() {
        this.position = { x: 0, y: 5, z: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.rotation = { yaw: 0, pitch: 0 };
        this._cameraYaw = 0;
        this._cameraPitch = 0.3;
        this._cameraDistance = 8;
        this._isGrounded = false;
        this._syncCamera();
        this._syncAvatar();
    },

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

        // EYES (facing -Z = forward)
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 1.7, -0.26);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 1.7, -0.26);
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

    updatePosition(id, position, rotation) {
        const data = this.players.get(id);
        if (!data) return;
        if (position) {
            data.targetState.position.x = position.x;
            data.targetState.position.y = position.y;
            data.targetState.position.z = position.z;
        }
        if (rotation) {
            data.targetState.rotation = rotation.yaw || rotation;
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

            const dx = Math.abs(data.targetState.position.x - data.state.position.x);
            const dz = Math.abs(data.targetState.position.z - data.state.position.z);
            if (dx > 0.05 || dz > 0.05) {
                data.animation = 'walk';
            } else {
                data.animation = 'idle';
            }

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
