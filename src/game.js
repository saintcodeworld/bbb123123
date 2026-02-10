import * as THREE from 'three';
import { PlayerControls } from './controls.js';
import { BlockManager } from './blocks.js';
import { Pickaxe } from './pickaxe.js';
import { WorldGenerator } from './worldGenerator.js';
import { ParticleEffects } from './particleEffects.js';
import { GameConfig } from './config.js';
import { SettingsMenu } from './settingsMenu.js';
import { MiningSystem } from './miningSystem.js';
import { InventoryMenu } from './inventoryMenu.js';
import { loadState, saveState as persistState } from './gameState.js';
import { NetworkManager } from './networkManager.js';
import { OtherPlayer } from './otherPlayer.js';
import { VoiceChat } from './voiceChat.js';

export class Game {
  constructor(wallet) {
    this.wallet = wallet;
    this.gameState = loadState();
    this.score = this.gameState.score;
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fpsTime = performance.now();
    this.saveTimer = 0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    document.getElementById('canvas-container').appendChild(this.renderer.domElement);

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 8;
    this._zeroVec = new THREE.Vector2(0, 0);
    this._blockMeshCache = null;
    this._blockMeshCacheFrame = -1;

    this.setupScene();
    this.setupLighting();
    this.scene.add(this.camera);

    this.worldGenerator = new WorldGenerator(this.scene);
    this.controls = new PlayerControls(this.camera, this.renderer.domElement, this.worldGenerator);
    this.blockManager = new BlockManager(this.scene);
    this.pickaxe = new Pickaxe(this.camera);
    this.particleEffects = new ParticleEffects(this.scene);
    this.miningSystem = new MiningSystem(this.scene, this.worldGenerator, this.particleEffects);
    this.settingsMenu = new SettingsMenu(this);
    this.inventoryMenu = new InventoryMenu(this);

    this.isHoldingMine = false;
    this.lastMiningState = false;

    // Block mining/breaking sound
    this.miningSoundSrc = '/sounds/Stone_dig1.ogg';
    this.miningSound = null;
    this.isMiningAudioPlaying = false;

    this.otherPlayers = new Map();
    this.networkManager = new NetworkManager(this);
    this.voiceChat = new VoiceChat(this.networkManager);
    this.positionUpdateTimer = 0;
    this.positionUpdateInterval = 0.05;
    this.worldInitialized = false;

    if (this.gameState.currentPickaxe !== 'stone') {
      this.miningSystem.upgradeTo(this.gameState.currentPickaxe);
      this.pickaxe.switchTier(this.gameState.currentPickaxe);
    }

    this.setupEventListeners();
    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupScene() {
    const skyColor = 0xadd8e6;
    this.scene.background = new THREE.Color(skyColor);
    if (GameConfig.performance.enableFog) {
      this.scene.fog = new THREE.FogExp2(skyColor, GameConfig.performance.fogDensity);
    }
    this.createClouds();
    this.camera.position.set(0, 1.7, 0);
  }

  createClouds() {
    if (!GameConfig.performance.enableClouds) return;
    const cloudGroup = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const cloudGeo = new THREE.BoxGeometry(Math.random() * 3 + 2, Math.random() * 1 + 0.5, Math.random() * 3 + 2);
      const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      cloud.position.set((Math.random() - 0.5) * 40, Math.random() * 15 + 15, (Math.random() - 0.5) * 40);
      cloudGroup.add(cloud);
    }
    this.scene.add(cloudGroup);
    this.clouds = cloudGroup;
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = false;
    this.scene.add(directionalLight);
  }

  setupEventListeners() {
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      if (document.pointerLockElement === this.renderer.domElement && event.button === 0) {
        this.isHoldingMine = true;
        this.pickaxe.swing();
      }
    });
    this.renderer.domElement.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.isHoldingMine = false;
    });
  }

  getBlockMeshes() {
    if (this._blockMeshCache && this._blockMeshCacheFrame === this.frameCount) {
      return this._blockMeshCache;
    }
    const meshes = [];
    this.worldGenerator.chunks.forEach(chunk => {
      chunk.group.children.forEach(child => {
        if (child.isMesh && child.userData.blockType) meshes.push(child);
      });
    });
    this._blockMeshCache = meshes;
    this._blockMeshCacheFrame = this.frameCount;
    return meshes;
  }

  getTargetBlock() {
    this.raycaster.setFromCamera(this._zeroVec, this.camera);
    const intersects = this.raycaster.intersectObjects(this.getBlockMeshes());
    if (intersects.length > 0 && intersects[0].distance < 6) {
      const hitPoint = intersects[0].point.clone();
      const faceNormal = intersects[0].face.normal;
      hitPoint.addScaledVector(faceNormal, -0.01);
      return this.worldGenerator.getBlockAt(Math.floor(hitPoint.x), Math.floor(hitPoint.y), Math.floor(hitPoint.z));
    }
    return null;
  }

  handleMiningUpdate(deltaTime) {
    const targetBlock = this.getTargetBlock();
    if (this.isHoldingMine && this.miningSystem.isMining) this.pickaxe.swing();

    const brokenBlock = this.miningSystem.update(deltaTime, this.isHoldingMine, targetBlock);

    const currentMiningState = this.miningSystem.isMining;
    if (currentMiningState !== this.lastMiningState) {
      this.networkManager.sendMiningState(currentMiningState, this.miningSystem.currentTarget);
      this.lastMiningState = currentMiningState;

      // Start/stop mining sound loop based on mining state
      if (currentMiningState) {
        this.startMiningSound();
      } else {
        this.stopMiningSound();
      }
    }

    if (brokenBlock) {
      this.stopMiningSound();
      this.playBlockBreakSound();
      this.particleEffects.createBlockBreakParticles(
        new THREE.Vector3(brokenBlock.x + 0.5, brokenBlock.y + 0.5, brokenBlock.z + 0.5),
        brokenBlock.type
      );
      const removed = this.worldGenerator.removeBlock(brokenBlock.x, brokenBlock.y, brokenBlock.z);
      if (removed) {
        const pts = GameConfig.mining.points[brokenBlock.type] || 5;
        this.addScore(pts, brokenBlock.type);
        this.networkManager.sendBlockBroken(brokenBlock);
      }
    }
  }

  addScore(points, blockType) {
    this.score += points;
    this.gameState.score = this.score;
    this.gameState.totalBlocksMined++;
    if (blockType && this.gameState.blocksMined[blockType] !== undefined) {
      this.gameState.blocksMined[blockType]++;
    }
    document.getElementById('score').textContent = `Tokens: ${this.score}`;
    this.updatePickaxeUI();
  }

  syncServerScore(serverScore) {
    // Local score (based on actual block counts × point values) is the source of truth
    // Only use server score if player has no local score (fresh start)
    if (this.score === 0 && serverScore > 0) {
      this.score = serverScore;
      this.gameState.score = serverScore;
      document.getElementById('score').textContent = `Tokens: ${this.score}`;
      this.saveState();
    }
    if (this.inventoryMenu) {
      this.inventoryMenu.refreshWithdrawSection();
    }
  }

  handleWithdrawResult(data) {
    if (data.success) {
      this.score = data.new_score;
      this.gameState.score = this.score;
      document.getElementById('score').textContent = `Tokens: ${this.score}`;
      this.saveState();
    }
    if (this.inventoryMenu) {
      this.inventoryMenu.handleWithdrawResult(data);
    }
  }

  updatePickaxeUI() {
    const tier = this.gameState.currentPickaxe;
    const info = GameConfig.mining.pickaxeTiers[tier];
    const el = document.getElementById('pickaxe-info');
    el.textContent = `⛏ ${info.name} Pickaxe (${info.speed}x speed)`;
  }

  saveState() {
    this.gameState.score = this.score;
    const pos = this.camera.position;
    this.gameState.playerPos = { x: pos.x, y: pos.y, z: pos.z };
    persistState(this.gameState);
  }

  updateCrosshairTarget() {
    const targetBlock = this.getTargetBlock();
    const targetEl = document.getElementById('target-block');
    const progressBar = document.getElementById('break-progress-bar');
    const progressFill = document.getElementById('break-fill');

    if (this.miningSystem.isMining && this.miningSystem.currentTarget) {
      progressBar.style.display = 'block';
      progressFill.style.width = `${Math.min(this.miningSystem.breakProgress * 100, 100)}%`;
    } else {
      progressBar.style.display = 'none';
    }

    if (targetBlock) {
      const breakTime = this.miningSystem.getBreakTime(targetBlock.type);
      targetEl.textContent = `Target: ${targetBlock.type} [${targetBlock.x}, ${targetBlock.y}, ${targetBlock.z}] (${breakTime.toFixed(1)}s)`;
      targetEl.style.color = '#00ff00';
    } else {
      targetEl.textContent = 'Target: none';
      targetEl.style.color = '#888';
    }
  }

  addOtherPlayer(playerId, playerData) {
    if (!this.otherPlayers.has(playerId)) {
      const otherPlayer = new OtherPlayer(this.scene, playerId, playerData);
      this.otherPlayers.set(playerId, otherPlayer);

      this.voiceChat.addPlayerIndicator(playerId, playerData.username);
      this.voiceChat.connectToPeer(playerId);
    }
  }

  removeOtherPlayer(playerId) {
    const player = this.otherPlayers.get(playerId);
    if (player) {
      player.destroy();
      this.otherPlayers.delete(playerId);
    }
    this.voiceChat.disconnectPeer(playerId);
    this.voiceChat.removePlayerIndicator(playerId);
  }

  updateOtherPlayer(playerId, data) {
    const player = this.otherPlayers.get(playerId);
    if (player) {
      player.updatePosition(data.position, data.rotation);
    }
  }

  updateOtherPlayerMining(playerId, isMining, block) {
    const player = this.otherPlayers.get(playerId);
    if (player) {
      player.setMining(isMining);
    }
  }

  handleRemoteBlockBreak(playerId, block) {
    if (block) {
      this.playBlockBreakSound();
      this.particleEffects.createBlockBreakParticles(
        new THREE.Vector3(block.x + 0.5, block.y + 0.5, block.z + 0.5),
        block.type
      );
      this.worldGenerator.removeBlock(block.x, block.y, block.z);
    }
  }

  startMiningSound() {
    if (this.isMiningAudioPlaying) return;
    this.isMiningAudioPlaying = true;

    const playLoop = () => {
      if (!this.isMiningAudioPlaying) return;
      const sound = new Audio(this.miningSoundSrc);
      sound.volume = 0.45;
      // Random pitch variation like Minecraft (0.8x to 1.2x)
      sound.playbackRate = 0.8 + Math.random() * 0.4;
      sound.play().catch(() => { });
      this.miningSound = sound;
      // When this clip ends, play again with a new random pitch
      sound.onended = () => playLoop();
    };
    playLoop();
  }

  stopMiningSound() {
    this.isMiningAudioPlaying = false;
    if (this.miningSound) {
      this.miningSound.onended = null;
      this.miningSound.pause();
      this.miningSound.currentTime = 0;
      this.miningSound = null;
    }
  }

  playBlockBreakSound() {
    const sound = new Audio(this.miningSoundSrc);
    sound.volume = 0.6;
    // Slightly lower pitch for the final break hit
    sound.playbackRate = 0.7 + Math.random() * 0.3;
    sound.play().catch(() => { });
  }

  updateOtherPlayerPickaxe(playerId, pickaxe) {
    const player = this.otherPlayers.get(playerId);
    if (player) {
      player.upgradePickaxe(pickaxe);
    }
  }

  initializeSharedWorld(seed, brokenBlocks) {
    if (this.worldInitialized) return;

    console.log(`Initializing shared world with seed: ${seed}`);
    console.log(`Applying ${brokenBlocks.length} broken blocks`);

    this.worldGenerator.setSeed(seed);
    this.worldGenerator.applyBrokenBlocks(brokenBlocks);
    this.worldInitialized = true;

    const initDist = Math.min(GameConfig.world.renderDistance, 2);
    for (let x = -initDist; x <= initDist; x++) {
      for (let z = -initDist; z <= initDist; z++) {
        this.worldGenerator.generateChunk(x, z);
      }
    }

    const spawnPos = this.worldGenerator.getSpawnPosition();

    if (this.gameState.playerPos) {
      const p = this.gameState.playerPos;
      this.clearArea(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
      this.camera.position.set(p.x, p.y + 2, p.z);
    } else {
      this.camera.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
    }
  }

  clearArea(x, y, z) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dy = -2; dy <= 3; dy++) {
          this.worldGenerator.removeBlock(x + dx, y + dy, z + dz);
        }
      }
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    this.frameCount++;
    if (currentTime - this.fpsTime >= 500) {
      const fps = Math.round((this.frameCount * 1000) / (currentTime - this.fpsTime));
      const info = this.renderer.info;
      document.getElementById('fps-counter').textContent = `FPS: ${fps} | Chunks: ${this.worldGenerator.chunks.size} | Tris: ${(info.render.triangles / 1000).toFixed(1)}k`;
      const pos = this.camera.position;
      document.getElementById('position').textContent = `X: ${Math.floor(pos.x)} Y: ${Math.floor(pos.y)} Z: ${Math.floor(pos.z)}`;
      this.frameCount = 0;
      this.fpsTime = currentTime;
    }

    this.saveTimer += deltaTime;
    if (this.saveTimer > 10) {
      this.saveState();
      this.saveTimer = 0;
    }

    if (!this.settingsMenu.isOpen && !this.inventoryMenu.isOpen) {
      this.controls.update(deltaTime);
      this.worldGenerator.updateChunks(this.camera.position);
      this._blockMeshCache = null;
      this.handleMiningUpdate(deltaTime);
      this.pickaxe.update(deltaTime);
      this.particleEffects.update(deltaTime);
      this.updateCrosshairTarget();

      this.positionUpdateTimer += deltaTime;
      if (this.positionUpdateTimer >= this.positionUpdateInterval) {
        this.networkManager.sendPosition(
          this.camera.position,
          { x: this.controls.euler.x, y: this.controls.euler.y }
        );
        this.positionUpdateTimer = 0;
      }

      this.otherPlayers.forEach(player => {
        player.update(deltaTime, this.camera);
      });

      this.voiceChat.updateProximity(this.camera.position, this.otherPlayers);

      if (this.clouds) {
        this.clouds.children.forEach((cloud, index) => {
          cloud.position.x += Math.sin(Date.now() * 0.0001 + index) * 0.01 * deltaTime;
        });
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  start() {
    document.getElementById('score').textContent = `Tokens: ${this.score}`;
    this.updatePickaxeUI();

    console.log('Game starting, waiting for server...');

    this.voiceChat.init();
    this.networkManager.connect();

    this.animate();
  }
}
