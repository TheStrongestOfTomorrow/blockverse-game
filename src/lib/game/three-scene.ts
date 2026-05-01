// BlockVerse - Three.js Scene Engine
// High-performance block rendering with InstancedMesh, DDA voxel raycasting,
// rebalanced lighting, and terrain generation.

import * as THREE from 'three';
import { BV, blockKey, isOpaque, type BlockData, type BlockTypeConfig } from '@/lib/constants';

const INITIAL_INSTANCES = 1000;
const GROW_FACTOR = 2;

interface InstanceData {
  mesh: THREE.InstancedMesh;
  count: number;
  capacity: number;
  data: Map<string, number>; // key -> index
  indexToKey: Map<number, string>; // index -> key
}

export class ThreeScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  blockMap: Map<string, BlockData> = new Map();
  blockCount = 0;
  template = 'flat';

  private instances: Record<string, InstanceData> = {};
  private materials: Record<string, THREE.MeshLambertMaterial> = {};
  private customMeshes: Map<string, THREE.Mesh> = new Map();
  private customGroup: THREE.Group;
  private geo: THREE.BoxGeometry;
  private tempMatrix = new THREE.Matrix4();
  private highlightMesh: THREE.Mesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private animClock = new THREE.Clock();
  private playerGroup: THREE.Group;
  private onResize: (() => void) | null = null;
  private animationFrameId: number | null = null;
  private sun: THREE.DirectionalLight | null = null;

  // Callbacks
  onBlockPlace: ((x: number, y: number, z: number, type: string) => void) | null = null;
  onBlockRemove: ((x: number, y: number, z: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;

    // Scene
    this.scene = new THREE.Scene();
    const fogColor = 0x87CEEB;
    this.scene.fog = new THREE.Fog(fogColor, 20, BV.RENDER_DISTANCE * BV.CHUNK_SIZE);
    this.scene.background = new THREE.Color(fogColor);

    // Camera
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(5, 7, 5);

    // Lighting
    const ambient = new THREE.AmbientLight(0x9090c0, 0.35);
    this.scene.add(ambient);

    this.sun = new THREE.DirectionalLight(0xfff0d0, 1.0);
    this.sun.position.set(50, 80, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = 1024;
    this.sun.shadow.mapSize.height = 1024;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 60;
    this.sun.shadow.camera.left = -25;
    this.sun.shadow.camera.right = 25;
    this.sun.shadow.camera.top = 25;
    this.sun.shadow.camera.bottom = -25;
    this.scene.add(this.sun);

    const fill = new THREE.DirectionalLight(0xc0d0ff, 0.15);
    fill.position.set(-30, 40, -20);
    this.scene.add(fill);

    const hemi = new THREE.HemisphereLight(0x88bbff, 0x445522, 0.2);
    this.scene.add(hemi);

    // Sky
    this.createSky();

    // Grid
    this.gridHelper = new THREE.GridHelper(64, 64, 0x444466, 0x333355);
    this.gridHelper.position.y = 0.01;
    if (this.gridHelper.material instanceof THREE.Material) {
      this.gridHelper.material.transparent = true;
      this.gridHelper.material.opacity = 0.3;
    }
    this.scene.add(this.gridHelper);

    // Groups
    this.customGroup = new THREE.Group();
    this.customGroup.name = 'custom-blocks';
    this.scene.add(this.customGroup);

    this.playerGroup = new THREE.Group();
    this.playerGroup.name = 'players';
    this.scene.add(this.playerGroup);

    // Shared geometry
    this.geo = new THREE.BoxGeometry(1, 1, 1);

    // Create InstancedMesh for each block type
    this.initBlockRenderer();

    // Highlight wireframe
    const hlGeo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
    const hlMat = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
      depthTest: true,
    });
    this.highlightMesh = new THREE.Mesh(hlGeo, hlMat);
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);

    // Resize
    this.onResize = this.resize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  private createSky() {
    const skyGeo = new THREE.SphereGeometry(400, 32, 15);
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#1a237e');
    gradient.addColorStop(0.3, '#42a5f5');
    gradient.addColorStop(0.6, '#87CEEB');
    gradient.addColorStop(1.0, '#B3E5FC');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);
    const skyTex = new THREE.CanvasTexture(canvas);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skyMesh);
  }

  private initBlockRenderer() {
    for (const [type, config] of Object.entries(BV.BLOCK_TYPES)) {
      const mat = this.createMaterial(type, config);
      this.materials[type] = mat;

      const mesh = new THREE.InstancedMesh(this.geo, mat, INITIAL_INSTANCES);
      mesh.name = 'blocks_' + type;
      mesh.castShadow = config.castShadow !== undefined ? config.castShadow : !config.transparent;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;

      this.scene.add(mesh);

      this.instances[type] = {
        mesh,
        count: 0,
        capacity: INITIAL_INSTANCES,
        data: new Map(),
        indexToKey: new Map(),
      };
    }
  }

  private createMaterial(type: string, config: BlockTypeConfig): THREE.MeshLambertMaterial {
    const opts: Record<string, unknown> = { color: config.color };
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

  private growInstances(type: string) {
    const inst = this.instances[type];
    if (!inst) return;

    const newCapacity = inst.capacity * GROW_FACTOR;
    const newMesh = new THREE.InstancedMesh(this.geo, this.materials[type], newCapacity);
    newMesh.name = 'blocks_' + type;
    newMesh.castShadow = inst.mesh.castShadow;
    newMesh.receiveShadow = true;
    newMesh.frustumCulled = false;

    // Copy existing matrices
    const oldArr = inst.mesh.instanceMatrix.array;
    const newArr = newMesh.instanceMatrix.array;
    for (let i = 0; i < inst.count * 16; i++) {
      newArr[i] = oldArr[i];
    }
    newMesh.count = inst.count;
    newMesh.instanceMatrix.needsUpdate = true;

    this.scene.remove(inst.mesh);
    inst.mesh.dispose();
    this.scene.add(newMesh);

    inst.mesh = newMesh;
    inst.capacity = newCapacity;
  }

  addBlock(x: number, y: number, z: number, blockType: string, emitEvent = false): boolean {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (y < -32 || y > BV.WORLD_HEIGHT_LIMIT) return false;

    const key = blockKey(x, y, z);
    if (this.blockMap.has(key)) return false;

    const config = BV.BLOCK_TYPES[blockType];
    if (!config) return false;

    this.blockMap.set(key, { x, y, z, type: blockType });
    this.blockCount++;

    this.addBlockToRenderer(x, y, z, blockType);

    if (emitEvent) {
      this.onBlockPlace?.(x, y, z, blockType);
    }
    return true;
  }

  private addBlockToRenderer(x: number, y: number, z: number, type: string) {
    const inst = this.instances[type];
    if (!inst) return;

    const key = blockKey(x, y, z);
    if (inst.data.has(key)) return;

    if (inst.count >= inst.capacity) {
      this.growInstances(type);
    }

    const idx = inst.count;
    this.tempMatrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
    inst.mesh.setMatrixAt(idx, this.tempMatrix);
    inst.data.set(key, idx);
    inst.indexToKey.set(idx, key);
    inst.count++;
    inst.mesh.count = inst.count;
    inst.mesh.instanceMatrix.needsUpdate = true;
  }

  removeBlock(x: number, y: number, z: number, emitEvent = false): boolean {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    const key = blockKey(x, y, z);
    const block = this.blockMap.get(key);
    if (!block) return false;

    const oldType = block.type;
    this.removeBlockFromRenderer(x, y, z, oldType);
    this.removeCustomMesh(x, y, z);

    this.blockMap.delete(key);
    this.blockCount--;

    if (emitEvent) {
      this.onBlockRemove?.(x, y, z);
    }
    return true;
  }

  private removeBlockFromRenderer(x: number, y: number, z: number, type: string) {
    const inst = this.instances[type];
    if (!inst) return;

    const key = blockKey(x, y, z);
    const idx = inst.data.get(key);
    if (idx === undefined) return;

    const lastIdx = inst.count - 1;
    if (idx !== lastIdx) {
      // Swap with last
      const lastKey = inst.indexToKey.get(lastIdx);
      if (lastKey) {
        const arr = inst.mesh.instanceMatrix.array;
        const srcOff = lastIdx * 16;
        const dstOff = idx * 16;
        for (let i = 0; i < 16; i++) {
          arr[dstOff + i] = arr[srcOff + i];
        }
        inst.data.set(lastKey, idx);
        inst.indexToKey.set(idx, lastKey);
      }
    }

    inst.data.delete(key);
    inst.indexToKey.delete(lastIdx);
    inst.count--;
    inst.mesh.count = inst.count;
    inst.mesh.instanceMatrix.needsUpdate = true;
  }

  private removeCustomMesh(x: number, y: number, z: number) {
    const key = blockKey(x, y, z);
    const mesh = this.customMeshes.get(key);
    if (mesh) {
      this.customGroup.remove(mesh);
      mesh.material.dispose();
      this.customMeshes.delete(key);
    }
  }

  addCustomMesh(x: number, y: number, z: number, material: THREE.Material) {
    const key = blockKey(x, y, z);
    const existing = this.customMeshes.get(key);
    if (existing) {
      this.customGroup.remove(existing);
      existing.material.dispose();
    }
    const mesh = new THREE.Mesh(this.geo, material);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.customGroup.add(mesh);
    this.customMeshes.set(key, mesh);
  }

  getBlock(x: number, y: number, z: number): BlockData | null {
    return this.blockMap.get(blockKey(Math.round(x), Math.round(y), Math.round(z))) || null;
  }

  // DDA Voxel Raycasting
  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDist = 10): { x: number; y: number; z: number; nx: number; ny: number; nz: number; distance: number } | null {
    if (!origin || !direction) return null;

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

    let tMaxX = dx > 0 ? ((x + 1) - origin.x) / dx : dx < 0 ? (x - origin.x) / dx : 1e30;
    let tMaxY = dy > 0 ? ((y + 1) - origin.y) / dy : dy < 0 ? (y - origin.y) / dy : 1e30;
    let tMaxZ = dz > 0 ? ((z + 1) - origin.z) / dz : dz < 0 ? (z - origin.z) / dz : 1e30;

    let nx = 0, ny = 0, nz = 0;
    let t = 0;

    for (let step = 0; step < 200; step++) {
      const key = blockKey(x, y, z);
      if (this.blockMap.has(key) && t > 0.01) {
        return { x, y, z, nx, ny, nz, distance: t };
      }

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

  getRaycastTarget(origin: THREE.Vector3, direction: THREE.Vector3, maxDist = 8) {
    const hit = this.raycast(origin, direction, maxDist);
    if (!hit) return null;
    return {
      position: { x: hit.x, y: hit.y, z: hit.z },
      normal: { nx: hit.nx, ny: hit.ny, nz: hit.nz },
      distance: hit.distance,
    };
  }

  highlightBlock(position: { x: number; y: number; z: number }, normal: { nx: number; ny: number; nz: number } | null, mode: string) {
    if (!this.highlightMesh) return;

    const colors: Record<string, number> = {
      place: 0x00ff00,
      delete: 0xff0000,
      paint: 0x6c5ce7,
      grab: 0xffc107,
    };
    this.highlightMesh.material.color.setHex(colors[mode] || 0x00ff00);

    if (mode === 'place' && normal) {
      this.highlightMesh.position.set(
        position.x + normal.nx + 0.5,
        position.y + normal.ny + 0.5,
        position.z + normal.nz + 0.5
      );
    } else {
      this.highlightMesh.position.set(position.x + 0.5, position.y + 0.5, position.z + 0.5);
    }
    this.highlightMesh.visible = true;
  }

  removeHighlight() {
    if (this.highlightMesh) this.highlightMesh.visible = false;
  }

  // Terrain generation
  generateTerrain(template: string) {
    this.clearAll();
    this.template = template;

    switch (template) {
      case 'flat': this.generateFlat(); break;
      case 'hills': this.generateHills(); break;
      case 'obby': this.generateObby(); break;
      case 'city': this.generateCity(); break;
      case 'arena': this.generateArena(); break;
      case 'island': this.generateIsland(); break;
      case 'village': this.generateVillage(); break;
      case 'castle': this.generateCastle(); break;
      case 'pirate': this.generatePirate(); break;
      default: this.generateFlat();
    }
  }

  private generateFlat() {
    const size = 40;
    const half = Math.floor(size / 2);
    for (let x = -half; x < half; x++) {
      for (let z = -half; z < half; z++) {
        this.addBlock(x, -1, z, 'dirt');
        this.addBlock(x, 0, z, 'grass');
      }
    }
    for (let x = -half; x < half; x++) {
      this.addBlock(x, 1, -half, 'stone');
      this.addBlock(x, 1, half - 1, 'stone');
    }
    for (let z = -half; z < half; z++) {
      this.addBlock(-half, 1, z, 'stone');
      this.addBlock(half - 1, 1, z, 'stone');
    }
    for (let z = -2; z <= 2; z++) {
      this.addBlock(0, 1, z, 'plank');
    }
  }

  private noiseHeight(x: number, z: number, scale = 0.08, amplitude = 6) {
    let h = 0;
    h += Math.sin(x * scale + 1.3) * Math.cos(z * scale + 0.7) * amplitude;
    h += Math.sin(x * scale * 2.1 + 4.0) * Math.cos(z * scale * 2.3 + 2.5) * amplitude * 0.4;
    h += Math.sin(x * scale * 0.5 + 0.2) * Math.cos(z * scale * 0.6 + 3.0) * amplitude * 0.6;
    return h;
  }

  private generateHills() {
    const size = 48;
    const half = Math.floor(size / 2);
    for (let x = -half; x < half; x++) {
      for (let z = -half; z < half; z++) {
        const h = this.noiseHeight(x, z, 0.08, 5);
        const topY = Math.round(h);
        this.addBlock(x, topY - 2, z, 'stone');
        this.addBlock(x, topY - 1, z, 'dirt');
        if (topY >= -1) {
          this.addBlock(x, topY, z, topY <= 0 ? 'water' : 'grass');
        }
      }
    }
    const treePositions = [[-8, 6], [-12, -4], [5, 10], [10, -8], [-5, -12], [15, 5], [-15, 10], [8, -15]];
    for (const [tx, tz] of treePositions) {
      const th = Math.round(this.noiseHeight(tx, tz, 0.08, 5));
      if (th > 1) {
        for (let y = th + 1; y <= th + 4; y++) this.addBlock(tx, y, tz, 'wood');
        for (let lx = -1; lx <= 1; lx++)
          for (let lz = -1; lz <= 1; lz++)
            this.addBlock(tx + lx, th + 5, tz + lz, 'leaf');
        this.addBlock(tx, th + 6, tz, 'leaf');
      }
    }
  }

  private generateObby() {
    for (let x = -3; x <= 3; x++)
      for (let z = -3; z <= 3; z++)
        this.addBlock(x, 0, z, 'stone');
    this.addBlock(0, 1, 0, 'gold');

    const stages = [
      { blocks: [[6,0,0,'stone'],[9,1,0,'stone'],[12,2,0,'stone'],[15,1,0,'stone']], checkpoint: [18,1,0,'gold'] },
      { blocks: [[18,2,3,'brick'],[18,5,6,'brick'],[18,8,9,'brick']], checkpoint: [18,11,12,'gold'] },
      { blocks: [[15,11,15,'plank'],[12,11,12,'plank'],[9,11,15,'plank'],[6,11,12,'plank']], checkpoint: [0,11,12,'gold'] },
    ];
    for (const stage of stages) {
      for (const [bx, by, bz, type] of stage.blocks) {
        this.addBlock(bx as number, by as number, bz as number, type as string);
      }
      if (stage.checkpoint) {
        const [cx, cy, cz, ctype] = stage.checkpoint;
        this.addBlock(cx, cy, cz, ctype);
      }
    }
    for (let x = -20; x <= 25; x++)
      for (let z = -10; z <= 20; z++)
        this.addBlock(x, -10, z, 'lava');
  }

  private generateCity() {
    const size = 64;
    const half = Math.floor(size / 2);
    for (let x = -half; x < half; x++) {
      for (let z = -half; z < half; z++) {
        this.addBlock(x, -1, z, 'stone');
        if (Math.abs(x) % 16 <= 1 || Math.abs(z) % 16 <= 1) {
          this.addBlock(x, 0, z, 'stone');
        } else {
          this.addBlock(x, 0, z, 'grass');
        }
      }
    }
    // Simple buildings
    const buildings = [[-20,-20], [-8,-20], [8,-20], [20,-20], [-20,-8], [8,-8], [20,-8], [-20,8], [-8,8], [20,8], [-20,20], [8,20], [20,20]];
    for (const [bx, bz] of buildings) {
      const h = 5 + Math.floor(Math.random() * 10);
      const w = 5;
      for (let wx = 0; wx < w; wx++) {
        for (let wz = 0; wz < w; wz++) {
          for (let wy = 1; wy <= h; wy++) {
            const isEdge = wx === 0 || wx === w - 1 || wz === 0 || wz === w - 1;
            if (isEdge) {
              this.addBlock(bx + wx, wy, bz + wz, wy > 10 ? 'glass' : 'brick');
            }
          }
        }
      }
    }
  }

  private generateArena() {
    const size = 24;
    const half = Math.floor(size / 2);
    for (let x = -half; x < half; x++)
      for (let z = -half; z < half; z++) {
        this.addBlock(x, -1, z, 'stone');
        this.addBlock(x, 0, z, 'sand');
      }
    for (let y = 1; y <= 6; y++)
      for (let i = -half; i < half; i++) {
        this.addBlock(i, y, -half, 'brick');
        this.addBlock(i, y, half - 1, 'brick');
        this.addBlock(-half, y, i, 'brick');
        this.addBlock(half - 1, y, i, 'brick');
      }
    this.addBlock(0, 2, 0, 'diamond');
  }

  private generateIsland() {
    const radius = 10;
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        const dist = Math.sqrt(x * x + z * z);
        if (dist > radius) continue;
        const depth = Math.floor(3 * (1 - dist / radius));
        for (let d = -3; d <= 0; d++) {
          this.addBlock(x, depth + d, z, dist < 3 ? 'stone' : 'dirt');
        }
        this.addBlock(x, depth + 1, z, 'grass');
      }
    }
    const treePos = [[-4, -3], [5, 2], [-2, 5], [3, -5], [0, -6]];
    for (const [tx, tz] of treePos) {
      for (let ty = 2; ty <= 5; ty++) this.addBlock(tx, ty, tz, 'wood');
      for (let lx = -1; lx <= 1; lx++)
        for (let lz = -1; lz <= 1; lz++)
          this.addBlock(tx + lx, 6, tz + lz, 'leaf');
    }
    for (let x = -radius; x <= radius; x++)
      for (let z = -radius; z <= radius; z++)
        if (Math.sqrt(x * x + z * z) <= radius + 2)
          this.addBlock(x, -4, z, 'water');
  }

  private generateVillage() {
    const size = 40;
    const half = Math.floor(size / 2);
    for (let x = -half; x < half; x++)
      for (let z = -half; z < half; z++) {
        this.addBlock(x, -1, z, 'dirt');
        this.addBlock(x, 0, z, 'grass');
      }
    for (let z = -half; z < half; z++) {
      this.addBlock(0, 1, z, 'cobble');
      this.addBlock(1, 1, z, 'cobble');
    }
    const houses = [
      { x: -10, z: -10, w: 5, d: 4, h: 4, wall: 'plank' },
      { x: -10, z: 5, w: 5, d: 4, h: 5, wall: 'cobble' },
      { x: 4, z: -10, w: 6, d: 5, h: 4, wall: 'plank' },
      { x: 4, z: 5, w: 5, d: 5, h: 4, wall: 'plank' },
    ];
    for (const house of houses) {
      for (let wx = 0; wx < house.w; wx++) {
        for (let wz = 0; wz < house.d; wz++) {
          for (let wy = 1; wy <= house.h; wy++) {
            const isEdge = wx === 0 || wx === house.w - 1 || wz === 0 || wz === house.d - 1;
            if (isEdge) this.addBlock(house.x + wx, wy, house.z + wz, house.wall);
          }
        }
      }
    }
  }

  private generateCastle() {
    const size = 32;
    const half = Math.floor(size / 2);
    for (let x = -half; x < half; x++)
      for (let z = -half; z < half; z++) {
        this.addBlock(x, -1, z, 'stone');
        this.addBlock(x, 0, z, 'grass');
      }
    const cSize = 7;
    for (let y = 1; y <= 5; y++)
      for (let i = -cSize; i <= cSize; i++) {
        this.addBlock(i, y, -cSize, 'stone');
        this.addBlock(i, y, cSize, 'stone');
        this.addBlock(-cSize, y, i, 'stone');
        this.addBlock(cSize, y, i, 'stone');
      }
    const towers = [[-cSize, -cSize], [-cSize, cSize], [cSize, -cSize], [cSize, cSize]];
    for (const [tx, tz] of towers) {
      for (let y = 6; y <= 9; y++) this.addBlock(tx, y, tz, 'cobble');
      this.addBlock(tx, 10, tz, 'gold');
    }
    this.addBlock(0, 2, 0, 'diamond');
  }

  private generatePirate() {
    const size = 40;
    const half = Math.floor(size / 2);
    for (let x = -half; x < half; x++)
      for (let z = -half; z < half; z++) {
        this.addBlock(x, -1, z, 'stone');
        this.addBlock(x, 0, z, 'water');
      }
    for (let x = -10; x <= 10; x++)
      for (let z = -4; z <= 4; z++)
        this.addBlock(x, 1, z, 'wood');
    for (let x = -9; x <= 9; x++)
      for (let z = -3; z <= 3; z++)
        this.addBlock(x, 2, z, 'plank');
    for (let y = 3; y <= 8; y++) this.addBlock(0, y, 0, 'wood');
    for (let x = -2; x <= 2; x++)
      for (let y = 4; y <= 7; y++)
        this.addBlock(x, y, 1, 'snow');
    this.addBlock(8, 3, 0, 'gold');
  }

  clearAll() {
    this.blockMap.clear();
    this.blockCount = 0;
    for (const type in this.instances) {
      const inst = this.instances[type];
      inst.count = 0;
      inst.mesh.count = 0;
      inst.data.clear();
      inst.indexToKey.clear();
      inst.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const [, mesh] of this.customMeshes) {
      this.customGroup.remove(mesh);
      mesh.material.dispose();
    }
    this.customMeshes.clear();
  }

  getBlocksSnapshot(): BlockData[] {
    const blocks: BlockData[] = [];
    this.blockMap.forEach((b) => {
      blocks.push({ x: b.x, y: b.y, z: b.z, type: b.type, customColor: b.customColor });
    });
    return blocks;
  }

  loadBlocksSnapshot(blocks: BlockData[]) {
    this.clearAll();
    for (const b of blocks) {
      this.addBlock(b.x, b.y, b.z, b.type);
    }
  }

  update(_deltaTime: number) {
    // Highlight pulse
    if (this.highlightMesh && this.highlightMesh.visible) {
      const pulse = 0.5 + 0.3 * Math.sin(performance.now() * 0.006);
      this.highlightMesh.material.opacity = pulse;
    }
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  resize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    this.clearAll();
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    for (const type in this.instances) {
      const inst = this.instances[type];
      inst.mesh.dispose();
      this.materials[type].dispose();
    }

    this.geo.dispose();
    this.renderer.dispose();
  }

  getPlayerGroup() { return this.playerGroup; }
}
