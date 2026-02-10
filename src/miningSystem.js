import * as THREE from 'three';
import { GameConfig } from './config.js';

export class MiningSystem {
  constructor(scene, worldGenerator, particleEffects) {
    this.scene = scene;
    this.worldGenerator = worldGenerator;
    this.particleEffects = particleEffects;
    
    this.currentPickaxe = 'stone';
    this.currentTarget = null;
    this.breakProgress = 0;
    this.isMining = false;
    this.currentStage = -1;
    
    this.crackTextures = this.generateCrackTextures();
    this.breakOverlay = null;
    this.createBreakOverlay();
  }

  generateCrackTextures() {
    const textures = [];
    
    const rng = (i) => {
      const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };

    const allCracks = [];
    for (let i = 0; i < 12; i++) {
      const startX = rng(i * 3) * 16;
      const startY = rng(i * 3 + 1) * 16;
      const segments = [];
      let cx = startX;
      let cy = startY;
      segments.push({ x: cx, y: cy });
      const numSegs = 3 + Math.floor(rng(i * 3 + 2) * 4);
      for (let s = 0; s < numSegs; s++) {
        cx += (rng(i * 11 + s * 3 + 100) - 0.5) * 7;
        cy += (rng(i * 11 + s * 3 + 101) - 0.5) * 7;
        segments.push({ x: cx, y: cy });
      }
      allCracks.push(segments);
    }

    const allChunks = [];
    for (let c = 0; c < 8; c++) {
      allChunks.push({
        x: rng(c * 5 + 200) * 14,
        y: rng(c * 5 + 201) * 14,
        w: 1 + rng(c * 5 + 202) * 3,
        h: 1 + rng(c * 5 + 203) * 3
      });
    }

    for (let stage = 0; stage < 10; stage++) {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 16, 16);

      const cracksToShow = Math.floor(2 + (stage / 9) * 10);
      const alpha = 0.4 + (stage / 9) * 0.6;

      ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.lineWidth = 1;

      for (let i = 0; i < Math.min(cracksToShow, allCracks.length); i++) {
        const crack = allCracks[i];
        ctx.beginPath();
        ctx.moveTo(crack[0].x, crack[0].y);
        for (let s = 1; s < crack.length; s++) {
          ctx.lineTo(crack[s].x, crack[s].y);
        }
        ctx.stroke();
      }

      if (stage > 5) {
        const chunksToShow = Math.floor((stage - 5) * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + (stage - 5) * 0.1})`;
        for (let c = 0; c < Math.min(chunksToShow, allChunks.length); c++) {
          const ch = allChunks[c];
          ctx.fillRect(ch.x, ch.y, ch.w, ch.h);
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      textures.push(texture);
    }

    return textures;
  }

  createBreakOverlay() {
    const geometry = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const material = new THREE.MeshBasicMaterial({
      map: this.crackTextures[0],
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    this.breakOverlay = new THREE.Mesh(geometry, material);
    this.breakOverlay.visible = false;
    this.breakOverlay.renderOrder = 999;
    this.scene.add(this.breakOverlay);
  }

  getPickaxeSpeed() {
    return GameConfig.mining.pickaxeTiers[this.currentPickaxe].speed;
  }

  getBlockHardness(blockType) {
    return GameConfig.mining.hardness[blockType] || 1.5;
  }

  getBreakTime(blockType) {
    return this.getBlockHardness(blockType) / this.getPickaxeSpeed();
  }

  startMining(block) {
    if (!block) return;
    
    if (this.currentTarget && 
        this.currentTarget.x === block.x && 
        this.currentTarget.y === block.y && 
        this.currentTarget.z === block.z) {
      return;
    }

    this.currentTarget = block;
    this.breakProgress = 0;
    this.isMining = true;
    this.updateOverlay();
  }

  stopMining() {
    this.isMining = false;
    this.currentTarget = null;
    this.breakProgress = 0;
    this.hideOverlay();
  }

  update(deltaTime, isHolding, targetBlock) {
    if (!isHolding) {
      if (this.currentTarget) {
        this.stopMining();
      }
      return null;
    }

    if (!targetBlock) {
      if (this.currentTarget) {
        this.stopMining();
      }
      return null;
    }

    if (this.currentTarget && 
        (this.currentTarget.x !== targetBlock.x || 
         this.currentTarget.y !== targetBlock.y || 
         this.currentTarget.z !== targetBlock.z)) {
      this.stopMining();
    }

    if (!this.currentTarget) {
      this.startMining(targetBlock);
    }

    if (this.isMining && this.currentTarget) {
      const breakTime = this.getBreakTime(this.currentTarget.type);
      this.breakProgress += deltaTime / breakTime;
      this.updateOverlay();

      if (this.breakProgress >= 1.0) {
        const brokenBlock = { ...this.currentTarget };
        this.stopMining();
        return brokenBlock;
      }
    }

    return null;
  }

  updateOverlay() {
    if (!this.currentTarget) return;
    
    const pos = new THREE.Vector3(
      this.currentTarget.x + 0.5,
      this.currentTarget.y + 0.5,
      this.currentTarget.z + 0.5
    );

    this.breakOverlay.position.copy(pos);
    this.breakOverlay.visible = true;
    
    const stage = Math.min(Math.floor(this.breakProgress * 10), 9);
    
    if (stage !== this.currentStage) {
      this.currentStage = stage;
      this.breakOverlay.material.map = this.crackTextures[stage];
      this.breakOverlay.material.needsUpdate = true;
    }
  }

  hideOverlay() {
    this.breakOverlay.visible = false;
    this.currentStage = -1;
  }

  upgradeTo(tier) {
    if (GameConfig.mining.pickaxeTiers[tier]) {
      this.currentPickaxe = tier;
      return true;
    }
    return false;
  }

  getUpgradeCost(tier) {
    return GameConfig.mining.pickaxeTiers[tier]?.cost || 0;
  }

  canAfford(tier, score) {
    return score >= this.getUpgradeCost(tier);
  }
}
