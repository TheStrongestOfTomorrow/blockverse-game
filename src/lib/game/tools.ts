// BlockVerse - Tools Engine
// Build, Delete, Paint, Grab tools with DDA voxel raycasting

import * as THREE from 'three';
import { BV, blockKey } from '@/lib/constants';
import type { ThreeScene } from './three-scene';
import type { PlayerController } from './player';

export class ToolsEngine {
  private currentTool = 'build';
  private currentBlockType = 'grass';
  private currentPaintColor = '#4CAF50';
  private activeSlot = 0;
  private toolbarSlots = [...BV.DEFAULT_TOOLBAR];

  private grabbedBlock: {
    key: string; x: number; y: number; z: number;
    type: string; mesh: THREE.Mesh; customColor: string | null;
  } | null = null;
  private isGrabbing = false;

  private sharedRaycaster = new THREE.Raycaster();
  private scene: ThreeScene;
  private player: PlayerController;
  private canvas: HTMLElement;

  private onMouseDown: ((e: MouseEvent) => void) | null = null;
  private onMouseUp: ((e: MouseEvent) => void) | null = null;
  private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

  onToolAction: ((action: string, data: Record<string, unknown>) => void) | null = null;

  constructor(scene: ThreeScene, player: PlayerController, canvas: HTMLElement) {
    this.scene = scene;
    this.player = player;
    this.canvas = canvas;
  }

  init() {
    this.currentTool = 'build';
    this.currentBlockType = 'grass';
    this.activeSlot = 0;
    this.toolbarSlots = [...BV.DEFAULT_TOOLBAR];

    this.onMouseDown = (e: MouseEvent) => {
      if (!this.player.getIsActive()) return;
      if (e.button !== 0) return;
      this.performPrimaryAction();
    };

    this.onMouseUp = (e: MouseEvent) => {
      if (e.button === 0 && this.isGrabbing) this.placeGrabbedBlock();
    };

    this.onKeyDown = (e: KeyboardEvent) => {
      if (!this.player.getIsActive()) return;
      const tag = (e.target as HTMLElement).tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        const slot = parseInt(e.code.charAt(5)) - 1;
        if (slot < BV.TOOLBAR_SIZE) this.setToolbarSlot(slot);
        return;
      }

      switch (e.code) {
        case 'KeyB': this.setTool('build'); break;
        case 'KeyX': this.setTool('delete'); break;
        case 'KeyP': this.setTool('paint'); break;
        case 'KeyG': this.setTool('grab'); break;
      }
    };

    this.canvas.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('keydown', this.onKeyDown);
  }

  setTool(tool: string) {
    const valid = ['build', 'delete', 'paint', 'grab'];
    if (!valid.includes(tool)) return;
    this.currentTool = tool;
  }

  getTool() { return this.currentTool; }
  getBlockType() { return this.currentBlockType; }
  setBlockType(type: string) {
    if (!BV.BLOCK_TYPES[type]) return;
    this.currentBlockType = type;
    if (!this.toolbarSlots.includes(type)) {
      this.toolbarSlots[this.activeSlot] = type;
    }
  }

  setToolbarSlot(index: number) {
    if (index < 0 || index >= BV.TOOLBAR_SIZE) return;
    this.activeSlot = index;
    this.currentBlockType = this.toolbarSlots[index];
  }

  getActiveSlot() { return this.activeSlot; }
  getToolbarSlots() { return [...this.toolbarSlots]; }

  setPaintColor(color: string) { this.currentPaintColor = color; }
  getPaintColor() { return this.currentPaintColor; }

  private cursorRaycast() {
    const ndc = this.player.getMouseNDC();
    this.sharedRaycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.scene.camera);
    this.sharedRaycaster.far = 10;
    return this.scene.getRaycastTarget(
      this.sharedRaycaster.ray.origin,
      this.sharedRaycaster.ray.direction,
      10
    );
  }

  private performPrimaryAction() {
    if (this.isGrabbing) {
      this.placeGrabbedBlock();
      return;
    }

    const hit = this.cursorRaycast();
    if (!hit) return;

    switch (this.currentTool) {
      case 'build': this.buildAction(hit); break;
      case 'delete': this.deleteAction(hit); break;
      case 'paint': this.paintAction(hit); break;
      case 'grab': this.grabAction(hit); break;
    }
  }

  private buildAction(hit: { position: { x: number; y: number; z: number }; normal: { nx: number; ny: number; nz: number } }) {
    const placeX = hit.position.x + hit.normal.nx;
    const placeY = hit.position.y + hit.normal.ny;
    const placeZ = hit.position.z + hit.normal.nz;

    // Don't place on player
    const pPos = this.player.getPosition();
    if (
      placeX + 1 > pPos.x - 0.3 && placeX < pPos.x + 0.3 &&
      placeY + 1 > pPos.y && placeY < pPos.y + 1.8 &&
      placeZ + 1 > pPos.z - 0.3 && placeZ < pPos.z + 0.3
    ) return;

    const success = this.scene.addBlock(placeX, placeY, placeZ, this.currentBlockType, true);
    if (success) {
      this.onToolAction?.('place', { x: placeX, y: placeY, z: placeZ, type: this.currentBlockType });
    }
  }

  private deleteAction(hit: { position: { x: number; y: number; z: number } }) {
    const success = this.scene.removeBlock(hit.position.x, hit.position.y, hit.position.z, true);
    if (success) {
      this.onToolAction?.('remove', { x: hit.position.x, y: hit.position.y, z: hit.position.z });
    }
  }

  private paintAction(hit: { position: { x: number; y: number; z: number } }) {
    const block = this.scene.getBlock(hit.position.x, hit.position.y, hit.position.z);
    if (!block) return;

    if (block.customColor === this.currentPaintColor) return;

    // Remove from instanced mesh and add as custom
    const key = blockKey(hit.position.x, hit.position.y, hit.position.z);
    // Simple paint: use custom mesh
    const mat = new THREE.MeshLambertMaterial({ color: this.currentPaintColor });
    this.scene.addCustomMesh(hit.position.x, hit.position.y, hit.position.z, mat);
    block.customColor = this.currentPaintColor;

    this.onToolAction?.('paint', { x: hit.position.x, y: hit.position.y, z: hit.position.z, color: this.currentPaintColor });
  }

  private grabAction(hit: { position: { x: number; y: number; z: number } }) {
    const block = this.scene.getBlock(hit.position.x, hit.position.y, hit.position.z);
    if (!block) return;

    const key = blockKey(hit.position.x, hit.position.y, hit.position.z);

    const config = BV.BLOCK_TYPES[block.type] || {};
    const color = block.customColor || config.color || '#ffffff';
    const mat = new THREE.MeshLambertMaterial({ color });
    mat.emissive = new THREE.Color('#FFA000');
    mat.emissiveIntensity = 0.5;

    const grabMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    grabMesh.position.set(hit.position.x + 0.5, hit.position.y + 0.5, hit.position.z + 0.5);
    this.scene.scene.add(grabMesh);

    this.grabbedBlock = {
      key, x: hit.position.x, y: hit.position.y, z: hit.position.z,
      type: block.type, mesh: grabMesh, customColor: block.customColor || null,
    };

    this.isGrabbing = true;
    this.scene.removeBlock(hit.position.x, hit.position.y, hit.position.z, false);
  }

  private placeGrabbedBlock() {
    if (!this.grabbedBlock) return;

    const hit = this.cursorRaycast();
    if (!hit) { this.cancelGrab(); return; }

    const placeX = hit.position.x + hit.normal.nx;
    const placeY = hit.position.y + hit.normal.ny;
    const placeZ = hit.position.z + hit.normal.nz;

    if (this.grabbedBlock.mesh.parent) {
      this.grabbedBlock.mesh.parent.remove(this.grabbedBlock.mesh);
    }
    this.grabbedBlock.mesh.material.dispose();

    this.scene.addBlock(placeX, placeY, placeZ, this.grabbedBlock.type, true);
    if (this.grabbedBlock.customColor) {
      const mat = new THREE.MeshLambertMaterial({ color: this.grabbedBlock.customColor });
      this.scene.addCustomMesh(placeX, placeY, placeZ, mat);
    }

    this.onToolAction?.('place', { x: placeX, y: placeY, z: placeZ, type: this.grabbedBlock.type });
    this.grabbedBlock = null;
    this.isGrabbing = false;
  }

  private cancelGrab() {
    if (!this.grabbedBlock) return;

    if (this.grabbedBlock.mesh.parent) {
      this.grabbedBlock.mesh.parent.remove(this.grabbedBlock.mesh);
    }
    this.grabbedBlock.mesh.material.dispose();

    this.scene.addBlock(this.grabbedBlock.x, this.grabbedBlock.y, this.grabbedBlock.z, this.grabbedBlock.type, false);
    this.grabbedBlock = null;
    this.isGrabbing = false;
  }

  updateHighlight() {
    if (!this.player.getIsActive()) {
      this.scene.removeHighlight();
      return;
    }

    const hit = this.cursorRaycast();
    if (!hit) {
      this.scene.removeHighlight();
      return;
    }

    switch (this.currentTool) {
      case 'build': this.scene.highlightBlock(hit.position, hit.normal, 'place'); break;
      case 'delete': this.scene.highlightBlock(hit.position, null, 'delete'); break;
      case 'paint': this.scene.highlightBlock(hit.position, null, 'paint'); break;
      case 'grab': this.scene.highlightBlock(hit.position, null, 'grab'); break;
      default: this.scene.removeHighlight();
    }
  }

  destroy() {
    if (this.onMouseDown) this.canvas.removeEventListener('mousedown', this.onMouseDown);
    if (this.onMouseUp) document.removeEventListener('mouseup', this.onMouseUp);
    if (this.onKeyDown) document.removeEventListener('keydown', this.onKeyDown);
  }
}
