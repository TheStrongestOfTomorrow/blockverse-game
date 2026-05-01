// BlockVerse - Player Engine (Third-Person)
// Roblox-style third-person player with orbit camera

import * as THREE from 'three';
import { BV, Utils } from '@/lib/constants';
import type { ThreeScene } from './three-scene';

export class PlayerController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private scene: THREE.Scene;

  position = { x: 0, y: 5, z: 0 };
  velocity = { x: 0, y: 0, z: 0 };
  rotation = { yaw: 0, pitch: 0 };

  private keys: Record<string, boolean> = {};
  private isGrounded = false;
  private sprinting = false;
  private lastMovementYaw = 0;
  private hasMovedOnce = false;

  private mouseNDC = { x: 0, y: 0 };

  private cameraDistance = 6;
  private cameraMinDistance = 2;
  private cameraMaxDistance = 25;
  private cameraHeightOffset = 2.5;
  private cameraPitch = 0.35;
  private cameraYaw = 0;
  private targetCameraYaw = 0;
  private targetCameraPitch = 0.35;
  private currentCameraPos = new THREE.Vector3(0, 7.5, 6);
  private currentLookTarget = new THREE.Vector3(0, 1.2, 0);
  private cameraLerpSpeed = 10;
  private rotationLerpSpeed = 15;
  private rightMouseDown = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  private playerWidth = 0.6;
  private playerHeight = 1.8;
  private fallThreshold = -30;

  private avatarGroup: THREE.Group | null = null;
  private avatarParts: Record<string, THREE.Mesh> = {};
  private walkAnimTime = 0;
  private isActive = false;

  private boundHandlers: Record<string, EventListener> = {};

  bodyColor = '#3F51B5';

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, scene: THREE.Scene) {
    this.camera = camera;
    this.domElement = domElement;
    this.scene = scene;
  }

  init() {
    this.position = { x: 0, y: 5, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.rotation = { yaw: 0, pitch: 0 };
    this.cameraYaw = 0;
    this.cameraPitch = 0.35;
    this.targetCameraYaw = 0;
    this.targetCameraPitch = 0.35;
    this.cameraDistance = 6;
    this.isGrounded = false;
    this.isActive = true;
    this.keys = {};
    this.hasMovedOnce = false;

    this.currentCameraPos.set(0, 7.5, 6);
    this.currentLookTarget.set(0, 1.2, 0);

    this.buildAvatar();
    this.bindEvents();
    this.syncCamera(0.016);
  }

  setBodyColor(color: string) {
    this.bodyColor = color;
    if (this.avatarParts.bodyMesh) {
      (this.avatarParts.bodyMesh.material as THREE.MeshLambertMaterial).color.set(color);
    }
    if (this.avatarParts.leftArm) {
      (this.avatarParts.leftArm.material as THREE.MeshLambertMaterial).color.set(color);
    }
    if (this.avatarParts.rightArm) {
      (this.avatarParts.rightArm.material as THREE.MeshLambertMaterial).color.set(color);
    }
  }

  private buildAvatar() {
    if (this.avatarGroup && this.avatarGroup.parent) {
      this.avatarGroup.parent.remove(this.avatarGroup);
    }

    this.avatarGroup = new THREE.Group();
    this.avatarGroup.name = 'localPlayer';

    const bodyMat = new THREE.MeshLambertMaterial({ color: this.bodyColor });
    const headMat = new THREE.MeshLambertMaterial({ color: '#FFCC99' });
    const legMat = new THREE.MeshLambertMaterial({ color: '#333366' });

    // Head
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
    headMesh.position.set(0, 1.65, 0);
    headMesh.castShadow = true;
    this.avatarGroup.add(headMesh);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 1.7, -0.26);
    this.avatarGroup.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, 1.7, -0.26);
    this.avatarGroup.add(rightEye);

    // Body
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), bodyMat);
    bodyMesh.position.set(0, 1.05, 0);
    bodyMesh.castShadow = true;
    this.avatarGroup.add(bodyMesh);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);
    const leftArm = new THREE.Mesh(armGeo, bodyMat.clone());
    leftArm.position.set(-0.375, 1.05, 0);
    leftArm.castShadow = true;
    this.avatarGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, bodyMat.clone());
    rightArm.position.set(0.375, 1.05, 0);
    rightArm.castShadow = true;
    this.avatarGroup.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.22);
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.13, 0.35, 0);
    leftLeg.castShadow = true;
    this.avatarGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.13, 0.35, 0);
    rightLeg.castShadow = true;
    this.avatarGroup.add(rightLeg);

    this.avatarParts = { headMesh, bodyMesh, leftArm, rightArm, leftLeg, rightLeg };
    this.scene.add(this.avatarGroup);
  }

  private bindEvents() {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.isActive) return;
      const tag = (e.target as HTMLElement).tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      this.keys[e.code] = true;
      const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyI', 'KeyO'];
      if (gameKeys.includes(e.code)) e.preventDefault();
      if (e.code === 'KeyI') this.cameraDistance = Math.max(this.cameraMinDistance, this.cameraDistance - 0.8);
      if (e.code === 'KeyO') this.cameraDistance = Math.min(this.cameraMaxDistance, this.cameraDistance + 0.8);
    };

    const onKeyUp = (e: KeyboardEvent) => { this.keys[e.code] = false; };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isActive) return;
      const rect = this.domElement.getBoundingClientRect();
      this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      if (!this.rightMouseDown) return;
      const sensitivity = BV.MOUSE_SENSITIVITY;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.targetCameraYaw -= dx * sensitivity;
      this.targetCameraPitch -= dy * sensitivity * 0.6;
      this.targetCameraPitch = Utils.clamp(this.targetCameraPitch, -0.5, 1.4);
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!this.isActive) return;
      if (e.button === 2) {
        this.rightMouseDown = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        e.preventDefault();
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) this.rightMouseDown = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (!this.isActive) return;
      e.preventDefault();
      const zoomSpeed = 0.8;
      if (e.deltaY > 0) this.cameraDistance = Math.min(this.cameraMaxDistance, this.cameraDistance + zoomSpeed);
      else this.cameraDistance = Math.max(this.cameraMinDistance, this.cameraDistance - zoomSpeed);
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    this.domElement.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    this.domElement.addEventListener('wheel', onWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', onContextMenu);

    this.boundHandlers = {
      keydown: onKeyDown, keyup: onKeyUp, mousemove: onMouseMove,
      mousedown: onMouseDown, mouseup: onMouseUp, wheel: onWheel, contextmenu: onContextMenu,
    };
  }

  getMouseNDC() { return { x: this.mouseNDC.x, y: this.mouseNDC.y }; }

  update(deltaTime: number, blockMap: Map<string, unknown>) {
    if (!this.isActive) return;

    const dt = Math.min(deltaTime, 0.05);
    this.sprinting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const speed = this.sprinting ? BV.PLAYER_SPRINT_SPEED : BV.PLAYER_SPEED;

    const forward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));

    let inputX = 0, inputZ = 0;
    if (this.keys['KeyW']) { inputX += forward.x; inputZ += forward.z; }
    if (this.keys['KeyS']) { inputX -= forward.x; inputZ -= forward.z; }
    if (this.keys['KeyA']) { inputX -= right.x; inputZ -= right.z; }
    if (this.keys['KeyD']) { inputX += right.x; inputZ += right.z; }

    const inputLen = Math.sqrt(inputX * inputX + inputZ * inputZ);
    const isMoving = inputLen > 0.01;
    if (isMoving) {
      inputX = (inputX / inputLen) * speed;
      inputZ = (inputZ / inputLen) * speed;
      this.lastMovementYaw = Math.atan2(inputX, inputZ);
      this.hasMovedOnce = true;
    }

    if (this.hasMovedOnce) this.rotation.yaw = this.lastMovementYaw;

    // Gravity
    this.velocity.y += BV.GRAVITY * dt;

    // Jump
    if (this.keys['Space'] && this.isGrounded) {
      this.velocity.y = BV.JUMP_FORCE;
      this.isGrounded = false;
    }

    const damping = this.isGrounded ? 12 : 5;
    this.velocity.x = Utils.lerp(this.velocity.x, inputX, damping * dt);
    this.velocity.z = Utils.lerp(this.velocity.z, inputZ, damping * dt);

    this.moveAxis('x', this.velocity.x * dt, blockMap);
    this.moveAxis('y', this.velocity.y * dt, blockMap);
    this.moveAxis('z', this.velocity.z * dt, blockMap);

    if (this.position.y < this.fallThreshold) {
      this.position = { x: 0, y: 5, z: 0 };
      this.velocity = { x: 0, y: 0, z: 0 };
    }

    this.animateAvatar(dt, isMoving);
    this.syncCamera(dt);
    this.syncAvatar();
  }

  private animateAvatar(dt: number, isMoving: boolean) {
    const parts = this.avatarParts;
    if (!parts || !this.avatarGroup) return;

    if (isMoving && this.isGrounded) {
      this.walkAnimTime += dt;
      const swing = Math.sin(this.walkAnimTime * 8) * 0.5;
      parts.leftArm.rotation.x = swing;
      parts.rightArm.rotation.x = -swing;
      parts.leftLeg.rotation.x = -swing;
      parts.rightLeg.rotation.x = swing;
    } else if (!this.isGrounded) {
      parts.leftArm.rotation.x = -0.8;
      parts.rightArm.rotation.x = -0.8;
    } else {
      this.walkAnimTime = 0;
      const bob = Math.sin(performance.now() * 0.002) * 0.015;
      parts.leftArm.rotation.x = 0;
      parts.rightArm.rotation.x = 0;
      parts.leftLeg.rotation.x = 0;
      parts.rightLeg.rotation.x = 0;
      parts.bodyMesh.position.y = 1.05 + bob;
      parts.headMesh.position.y = 1.65 + bob;
    }
  }

  private syncAvatar() {
    if (!this.avatarGroup) return;
    this.avatarGroup.position.set(this.position.x, this.position.y, this.position.z);
    this.avatarGroup.rotation.y = this.rotation.yaw;
  }

  private syncCamera(dt = 0.016) {
    const rotLerp = Utils.clamp(this.rotationLerpSpeed * dt, 0, 1);
    this.cameraYaw = Utils.lerp(this.cameraYaw, this.targetCameraYaw, rotLerp);
    this.cameraPitch = Utils.lerp(this.cameraPitch, this.targetCameraPitch, rotLerp);

    const targetCamX = this.position.x + Math.sin(this.cameraYaw) * this.cameraDistance * Math.cos(this.cameraPitch);
    const targetCamY = this.position.y + this.cameraHeightOffset + Math.sin(this.cameraPitch) * this.cameraDistance;
    const targetCamZ = this.position.z + Math.cos(this.cameraYaw) * this.cameraDistance * Math.cos(this.cameraPitch);

    const posLerp = Utils.clamp(this.cameraLerpSpeed * dt, 0, 1);
    this.currentCameraPos.x = Utils.lerp(this.currentCameraPos.x, targetCamX, posLerp);
    this.currentCameraPos.y = Utils.lerp(this.currentCameraPos.y, targetCamY, posLerp);
    this.currentCameraPos.z = Utils.lerp(this.currentCameraPos.z, targetCamZ, posLerp);

    this.currentLookTarget.x = Utils.lerp(this.currentLookTarget.x, this.position.x, posLerp);
    this.currentLookTarget.y = Utils.lerp(this.currentLookTarget.y, this.position.y + 1.2, posLerp);
    this.currentLookTarget.z = Utils.lerp(this.currentLookTarget.z, this.position.z, posLerp);

    this.camera.position.copy(this.currentCameraPos);
    this.camera.lookAt(this.currentLookTarget);
  }

  private moveAxis(axis: 'x' | 'y' | 'z', delta: number, blockMap: Map<string, unknown>) {
    if (Math.abs(delta) < 0.0001) return;
    const newPos = { x: this.position.x, y: this.position.y, z: this.position.z };
    newPos[axis] += delta;

    if (this.checkCollision(newPos, blockMap)) {
      this.velocity[axis] = 0;
      if (axis === 'y' && delta < 0) {
        this.isGrounded = true;
        const snapY = this.findGroundY(newPos, blockMap);
        if (snapY !== null) this.position.y = snapY;
      }
    } else {
      this.position[axis] = newPos[axis];
      if (axis === 'y' && delta < 0) this.isGrounded = false;
    }
  }

  private checkCollision(pos: { x: number; y: number; z: number }, blockMap: Map<string, unknown>): boolean {
    if (!blockMap) return false;
    const hw = this.playerWidth / 2;
    const ph = this.playerHeight;
    const minBX = Math.floor(pos.x - hw);
    const maxBX = Math.floor(pos.x + hw);
    const minBY = Math.floor(pos.y);
    const maxBY = Math.floor(pos.y + ph);
    const minBZ = Math.floor(pos.z - hw);
    const maxBZ = Math.floor(pos.z + hw);
    const eps = 0.001;

    for (let bx = minBX; bx <= maxBX; bx++) {
      for (let by = minBY; by <= maxBY; by++) {
        for (let bz = minBZ; bz <= maxBZ; bz++) {
          if (blockMap.has(`${bx},${by},${bz}`)) {
            if (
              pos.x - hw < bx + 1 - eps && pos.x + hw > bx + eps &&
              pos.y < by + 1 - eps && pos.y + ph > by + eps &&
              pos.z - hw < bz + 1 - eps && pos.z + hw > bz + eps
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  private findGroundY(pos: { x: number; y: number; z: number }, blockMap: Map<string, unknown>): number | null {
    if (!blockMap) return null;
    const hw = this.playerWidth / 2;
    const checkX = [Math.floor(pos.x - hw), Math.floor(pos.x + hw)];
    const checkZ = [Math.floor(pos.z - hw), Math.floor(pos.z + hw)];
    let highestY: number | null = null;

    for (const cx of checkX) {
      for (const cz of checkZ) {
        const startY = Math.floor(pos.y + 0.5);
        for (let by = startY; by >= startY - 3; by--) {
          if (blockMap.has(`${cx},${by},${cz}`)) {
            const topY = by + 1;
            if (highestY === null || topY > highestY) highestY = topY;
            break;
          }
        }
      }
    }
    return highestY;
  }

  setPosition(x: number, y: number, z: number) {
    this.position = { x, y, z };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.syncCamera(0.016);
    this.syncAvatar();
  }

  getPosition() { return { ...this.position }; }
  getIsActive() { return this.isActive; }
  setActive(active: boolean) { this.isActive = active; }

  destroy() {
    for (const [event, handler] of Object.entries(this.boundHandlers)) {
      if (event === 'mousedown' || event === 'wheel' || event === 'contextmenu') {
        this.domElement.removeEventListener(event, handler);
      } else {
        document.removeEventListener(event, handler);
      }
    }
    if (this.avatarGroup && this.avatarGroup.parent) {
      this.avatarGroup.parent.remove(this.avatarGroup);
    }
  }
}
