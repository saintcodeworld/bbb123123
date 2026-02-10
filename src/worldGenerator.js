import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GameConfig } from './config.js';

export class WorldGenerator {
  constructor(scene, seed = null) {
    this.scene = scene;
    this.seed = seed || Math.random();
    this.noise = new SimplexNoise();
    this.seededRandom = this.createSeededRandom(this.seed);
    this.chunks = new Map();
    this.chunkSize = GameConfig.world.chunkSize;
    this.renderDistance = GameConfig.world.renderDistance;
    this.verticalLayers = GameConfig.world.verticalLayers;
    this.groundLevel = GameConfig.world.groundLevel;
    this.brokenBlocks = new Set();
    
    this.textureLoader = new THREE.TextureLoader();
    this.textures = this.loadTextures();
    this.materials = this.createMaterials();

    this.faceVertices = this.buildFaceTemplates();
  }

  createSeededRandom(seed) {
    let s = seed;
    return function() {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  }

  setSeed(seed) {
    this.seed = seed;
    this.seededRandom = this.createSeededRandom(seed);
    this.noise = new SimplexNoise();
    this.chunks.forEach(chunk => {
      if (chunk.group) {
        this.scene.remove(chunk.group);
      }
    });
    this.chunks.clear();
  }

  applyBrokenBlocks(brokenBlocksList) {
    brokenBlocksList.forEach(block => {
      const key = `${block.x},${block.y},${block.z}`;
      this.brokenBlocks.add(key);
    });
  }

  isBlockBroken(x, y, z) {
    const key = `${x},${y},${z}`;
    return this.brokenBlocks.has(key);
  }

  loadTextures() {
    const loadTexture = (path) => {
      const texture = this.textureLoader.load(path);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      return texture;
    };
    return {
      dirt: loadTexture('/textures/dirt.png'),
      grass: loadTexture('/textures/grass.png'),
      grassSide: loadTexture('/textures/grass_side.png'),
      stone: loadTexture('/textures/stone.png'),
      ironOre: loadTexture('/textures/iron_ore.png'),
      coalOre: loadTexture('/textures/coal_ore.png')
    };
  }

  generateOreTexture(baseTexture, oreColor, spotCount) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.src = '/textures/stone.png';

    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 16, 16);

        const rng = (i) => {
          const x = Math.sin(i * 127.1 + oreColor) * 43758.5453;
          return x - Math.floor(x);
        };

        const r = (oreColor >> 16) & 0xFF;
        const g = (oreColor >> 8) & 0xFF;
        const b = oreColor & 0xFF;

        for (let i = 0; i < spotCount; i++) {
          const sx = Math.floor(rng(i * 3) * 14) + 1;
          const sy = Math.floor(rng(i * 3 + 1) * 14) + 1;
          const size = 1 + Math.floor(rng(i * 3 + 2) * 2);

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(sx, sy, size, size);

          ctx.fillStyle = `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)})`;
          ctx.fillRect(sx, sy, 1, 1);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        resolve(texture);
      };

      img.onerror = () => {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, 16, 16);
        const r = (oreColor >> 16) & 0xFF;
        const g = (oreColor >> 8) & 0xFF;
        const b = oreColor & 0xFF;
        for (let i = 0; i < spotCount; i++) {
          const sx = Math.floor(Math.random() * 14) + 1;
          const sy = Math.floor(Math.random() * 14) + 1;
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(sx, sy, 2, 2);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        resolve(texture);
      };
    });
  }

  createMaterials() {
    const mats = {
      stone: new THREE.MeshLambertMaterial({ map: this.textures.stone }),
      ironOre: new THREE.MeshLambertMaterial({ map: this.textures.ironOre }),
      coalOre: new THREE.MeshLambertMaterial({ map: this.textures.coalOre }),
      diamondOre: new THREE.MeshLambertMaterial({ color: 0x4aedd9 }),
      goldOre: new THREE.MeshLambertMaterial({ color: 0xfcee4b }),
      emeraldOre: new THREE.MeshLambertMaterial({ color: 0x17dd62 })
    };

    this.generateOreTexture(null, 0x4aedd9, 6).then(tex => { mats.diamondOre.map = tex; mats.diamondOre.color.set(0xffffff); mats.diamondOre.needsUpdate = true; });
    this.generateOreTexture(null, 0xfcee4b, 7).then(tex => { mats.goldOre.map = tex; mats.goldOre.color.set(0xffffff); mats.goldOre.needsUpdate = true; });
    this.generateOreTexture(null, 0x17dd62, 5).then(tex => { mats.emeraldOre.map = tex; mats.emeraldOre.color.set(0xffffff); mats.emeraldOre.needsUpdate = true; });

    return mats;
  }

  buildFaceTemplates() {
    return {
      px: { dir: [1,0,0], verts: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], normal: [1,0,0] },
      nx: { dir: [-1,0,0], verts: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], normal: [-1,0,0] },
      py: { dir: [0,1,0], verts: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], normal: [0,1,0] },
      ny: { dir: [0,-1,0], verts: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], normal: [0,-1,0] },
      pz: { dir: [0,0,1], verts: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], normal: [0,0,1] },
      nz: { dir: [0,0,-1], verts: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], normal: [0,0,-1] }
    };
  }

  isCave(x, y, z) {
    const caves = GameConfig.generation.caves;
    const n1 = this.noise.noise3d(x * caves.frequency, y * caves.frequency, z * caves.frequency);
    const n2 = this.noise.noise3d(x * caves.frequency + 50, y * caves.frequency + 50, z * caves.frequency + 50);
    if ((n1 * n1 + n2 * n2) < caves.threshold * 0.5) return true;
    const wx = this.noise.noise3d(x * caves.wormFrequency, y * caves.wormFrequency * 0.5, z * caves.wormFrequency);
    const wz = this.noise.noise3d(x * caves.wormFrequency + 200, y * caves.wormFrequency * 0.5 + 200, z * caves.wormFrequency + 200);
    if ((wx * wx + wz * wz) < caves.wormThreshold * 0.15) return true;
    return false;
  }

  getBlockType(x, y, z, yMin) {
    if (y > this.groundLevel) return null;
    
    if (yMin !== undefined && y <= yMin + 2) return 'stone';
    
    if (y < this.groundLevel && this.isCave(x, y, z)) {
      if (!this.isCave(x, y - 1, z)) return 'stone';
      return null;
    }

    let blockType = 'stone';

    const n1 = this.noise.noise(x * 0.12, y * 0.12 + z * 0.12);
    if (n1 > 0.55) blockType = 'coalOre';
    if (n1 > 0.72) blockType = 'ironOre';

    const n2 = this.noise.noise(x * 0.15 + 50, y * 0.15 + z * 0.15 + 50);
    if (n2 > 0.78 && y < -4) blockType = 'goldOre';

    const n3 = this.noise.noise(x * 0.2 + 100, y * 0.2 + z * 0.2 + 100);
    if (n3 > 0.895 && y < -8) blockType = 'diamondOre';

    const n4 = this.noise.noise(x * 0.18 + 200, y * 0.18 + z * 0.18 + 200);
    if (n4 > 0.916 && y < -6) blockType = 'emeraldOre';

    return blockType;
  }

  generateTerrain(chunkX, chunkZ, yMin, yMax) {
    const blocks = [];
    const worldX = chunkX * this.chunkSize;
    const worldZ = chunkZ * this.chunkSize;

    for (let x = 0; x < this.chunkSize; x++) {
      for (let z = 0; z < this.chunkSize; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;
        for (let y = yMin; y <= yMax; y++) {
          if (!this.isBlockBroken(wx, y, wz)) {
            const type = this.getBlockType(wx, y, wz, yMin);
            if (type) {
              blocks.push({ x: wx, y, z: wz, type });
            }
          }
        }
      }
    }
    return blocks;
  }

  generateChunk(chunkX, chunkZ) {
    const playerY = Math.floor(this.scene.getObjectByProperty('type', 'PerspectiveCamera')?.position.y || 0);
    const layerMin = Math.min(this.groundLevel - this.verticalLayers, playerY - this.verticalLayers);
    const layerMax = this.groundLevel;

    const chunkKey = `${chunkX},${chunkZ}`;
    if (this.chunks.has(chunkKey)) {
      const existing = this.chunks.get(chunkKey);
      if (existing.yMin <= layerMin && existing.yMax >= layerMax) {
        return existing;
      }
      const newMin = Math.min(existing.yMin, layerMin);
      if (newMin < existing.yMin) {
        const extraBlocks = this.generateTerrain(chunkX, chunkZ, newMin, existing.yMin - 1);
        existing.blocks.push(...extraBlocks);
        existing.yMin = newMin;
        this.rebuildChunkMesh(existing);
      }
      return existing;
    }

    const chunk = new THREE.Group();
    chunk.matrixAutoUpdate = false;
    const blocks = this.generateTerrain(chunkX, chunkZ, layerMin, layerMax);

    this.createChunkMesh(chunk, blocks);
    chunk.position.set(0, 0, 0);
    chunk.updateMatrix();
    this.scene.add(chunk);

    const data = { group: chunk, blocks, yMin: layerMin, yMax: layerMax };
    this.chunks.set(chunkKey, data);
    return data;
  }

  hasBlockInData(blocks, x, y, z) {
    return blocks.some(b => b.x === x && b.y === y && b.z === z);
  }

  isBlockSolid(x, y, z) {
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    const chunkKey = `${chunkX},${chunkZ}`;
    const chunk = this.chunks.get(chunkKey);
    if (chunk) return this.hasBlockInData(chunk.blocks, x, y, z);
    return this.getBlockType(x, y, z) !== null;
  }

  createChunkMesh(chunk, blocks) {
    const types = ['stone', 'ironOre', 'coalOre', 'diamondOre', 'goldOre', 'emeraldOre'];
    const positions = {}; const normals = {}; const uvs = {}; const indices = {}; const vertCounts = {};
    types.forEach(t => { positions[t] = []; normals[t] = []; uvs[t] = []; indices[t] = []; vertCounts[t] = 0; });

    const blockSet = new Set();
    blocks.forEach(b => blockSet.add(`${b.x},${b.y},${b.z}`));

    const faces = Object.values(this.faceVertices);

    blocks.forEach(block => {
      const { x, y, z, type } = block;
      if (!positions[type]) return;

      for (const face of faces) {
        const nx = x + face.dir[0];
        const ny = y + face.dir[1];
        const nz = z + face.dir[2];

        if (blockSet.has(`${nx},${ny},${nz}`)) continue;

        const base = vertCounts[type];
        for (const v of face.verts) {
          positions[type].push(x + v[0], y + v[1], z + v[2]);
          normals[type].push(face.normal[0], face.normal[1], face.normal[2]);
        }
        uvs[type].push(0, 0, 1, 0, 1, 1, 0, 1);
        indices[type].push(base, base + 1, base + 2, base, base + 2, base + 3);
        vertCounts[type] += 4;
      }
    });

    Object.keys(positions).forEach(type => {
      if (positions[type].length === 0 || !this.materials[type]) return;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions[type], 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals[type], 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs[type], 2));
      geometry.setIndex(indices[type]);

      const mesh = new THREE.Mesh(geometry, this.materials[type]);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.blockType = type;
      mesh.frustumCulled = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      chunk.add(mesh);
    });
  }

  rebuildChunkMesh(chunkData) {
    const toDispose = [];
    chunkData.group.traverse((child) => {
      if (child.geometry) toDispose.push(child.geometry);
    });
    chunkData.group.clear();
    toDispose.forEach(g => g.dispose());
    this.createChunkMesh(chunkData.group, chunkData.blocks);
  }

  getSpawnPosition() {
    const spawnX = 0.5;
    const spawnZ = 0.5;
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        for (let y = this.groundLevel + 1; y <= this.groundLevel + 3; y++) {
          this.removeBlock(Math.floor(spawnX) + x, y, Math.floor(spawnZ) + z);
        }
      }
    }
    return { x: spawnX, y: this.groundLevel + 5, z: spawnZ };
  }

  updateChunks(playerPosition) {
    const playerChunkX = Math.floor(playerPosition.x / this.chunkSize);
    const playerChunkZ = Math.floor(playerPosition.z / this.chunkSize);

    const neededChunks = [];
    for (let x = playerChunkX - this.renderDistance; x <= playerChunkX + this.renderDistance; x++) {
      for (let z = playerChunkZ - this.renderDistance; z <= playerChunkZ + this.renderDistance; z++) {
        const chunkKey = `${x},${z}`;
        if (!this.chunks.has(chunkKey)) {
          neededChunks.push({ x, z, key: chunkKey });
        }
      }
    }

    neededChunks.sort((a, b) => {
      const distA = Math.abs(a.x - playerChunkX) + Math.abs(a.z - playerChunkZ);
      const distB = Math.abs(b.x - playerChunkX) + Math.abs(b.z - playerChunkZ);
      return distA - distB;
    });

    neededChunks.slice(0, GameConfig.performance.maxChunksPerFrame).forEach(c => {
      this.generateChunk(c.x, c.z);
    });

    this.chunks.forEach((chunk, key) => {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.max(Math.abs(cx - playerChunkX), Math.abs(cz - playerChunkZ)) > this.renderDistance + 1) {
        this.removeChunk(key);
      }
    });

    this.expandDepthIfNeeded(playerPosition);
  }

  expandDepthIfNeeded(playerPosition) {
    const playerY = Math.floor(playerPosition.y);
    const playerChunkX = Math.floor(playerPosition.x / this.chunkSize);
    const playerChunkZ = Math.floor(playerPosition.z / this.chunkSize);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${playerChunkX + dx},${playerChunkZ + dz}`;
        const chunk = this.chunks.get(key);
        if (chunk && playerY - 4 < chunk.yMin) {
          const newMin = chunk.yMin - this.verticalLayers;
          const extraBlocks = this.generateTerrain(playerChunkX + dx, playerChunkZ + dz, newMin, chunk.yMin - 1);
          chunk.blocks.push(...extraBlocks);
          chunk.yMin = newMin;
          this.rebuildChunkMesh(chunk);
        }
      }
    }
  }

  removeChunk(key) {
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    this.scene.remove(chunk.group);
    chunk.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
    chunk.group.clear();
    this.chunks.delete(key);
  }

  getBlockAt(x, y, z) {
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    const chunk = this.chunks.get(`${chunkX},${chunkZ}`);
    if (!chunk) return null;
    return chunk.blocks.find(b => b.x === x && b.y === y && b.z === z) || null;
  }

  removeBlock(x, y, z) {
    const key = `${x},${y},${z}`;
    this.brokenBlocks.add(key);
    
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    const chunkKey = `${chunkX},${chunkZ}`;
    const chunk = this.chunks.get(chunkKey);
    if (!chunk) return false;

    const idx = chunk.blocks.findIndex(b => b.x === x && b.y === y && b.z === z);
    if (idx !== -1) {
      chunk.blocks.splice(idx, 1);
      this.rebuildChunkMesh(chunk);
      return true;
    }
    return false;
  }
}
