import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class OtherPlayer {
  constructor(scene, playerId, playerData) {
    this.scene = scene;
    this.playerId = playerId;
    this.username = playerData.username || `Player ${playerId}`;
    this.destroyed = false;
    
    this.model = null;
    this.pickaxeModel = null;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    
    this.targetPosition = new THREE.Vector3(
      playerData.position.x,
      playerData.position.y,
      playerData.position.z
    );
    this.targetRotationY = playerData.rotation.y;
    
    this.isMining = false;
    this.currentPickaxe = playerData.current_pickaxe || 'stone';
    this.pickaxeSwingAngle = 0;
    this.pickaxeSwingSpeed = 8;
    
    this.nameTag = null;
    
    this.loadModels();
  }

  async loadModels() {
    const loader = new GLTFLoader();
    
    try {
      const steveGltf = await loader.loadAsync('/models/steve_-_minecraft.glb');
      if (this.destroyed) return;
      this.model = steveGltf.scene;
      this.model.scale.set(0.21, 0.21, 0.21);
      this.model.position.y = -1.35;
      this.model.rotation.y = Math.PI / 2;
      
      this.model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      this.group.add(this.model);
      
      await this.loadPickaxe();
      if (this.destroyed) return;
      this.createNameTag();
      
      this.group.position.copy(this.targetPosition);
      this.group.rotation.y = this.targetRotationY;
      
    } catch (error) {
      if (this.destroyed) return;
      console.error('Error loading Steve model:', error);
      this.createFallbackModel();
    }
  }

  async loadPickaxe() {
    const pickaxeFiles = {
      stone: 'minecraft_stone_pickaxe.glb',
      iron: 'minecraft_iron_pickaxe.glb',
      gold: 'minecraft_golden_pickaxe.glb',
      diamond: 'minecraft_diamond_pickaxe.glb',
      netherite: 'minecraft_netherite_pickaxe.glb'
    };

    const loader = new GLTFLoader();
    const pickaxeFile = pickaxeFiles[this.currentPickaxe] || pickaxeFiles.stone;
    
    try {
      const gltf = await loader.loadAsync(`/models/${pickaxeFile}`);
      if (this.destroyed) return;
      
      if (this.pickaxeModel) {
        this.group.remove(this.pickaxeModel);
      }
      
      this.pickaxeModel = gltf.scene;
      this.pickaxeModel.scale.set(0.04, 0.04, 0.04);
      this.pickaxeModel.position.set(0.075, 0.05, 0);
      this.pickaxeModel.rotation.set(0, Math.PI / 4, 0);
      
      this.pickaxeModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
        }
      });
      
      this.group.add(this.pickaxeModel);
      
    } catch (error) {
      console.error('Error loading pickaxe:', error);
    }
  }

  createFallbackModel() {
    const geometry = new THREE.BoxGeometry(0.15, 0.4, 0.1);
    const material = new THREE.MeshStandardMaterial({ color: 0x0088ff });
    this.model = new THREE.Mesh(geometry, material);
    this.model.position.y = -0.65;
    this.group.add(this.model);
  }

  createNameTag() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.username, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    this.nameTag = new THREE.Sprite(material);
    this.nameTag.scale.set(0.6, 0.15, 1);
    this.nameTag.position.y = 1.0;
    
    this.group.add(this.nameTag);
  }

  updatePosition(position, rotation) {
    this.targetPosition.set(position.x, position.y, position.z);
    this.targetRotationY = rotation.y;
  }

  setMining(isMining) {
    this.isMining = isMining;
    if (!isMining) {
      this.pickaxeSwingAngle = 0;
    }
  }

  async upgradePickaxe(pickaxe) {
    this.currentPickaxe = pickaxe;
    await this.loadPickaxe();
  }

  update(deltaTime, camera) {
    this.group.position.lerp(this.targetPosition, deltaTime * 10);
    
    this.group.rotation.y = THREE.MathUtils.lerp(
      this.group.rotation.y,
      this.targetRotationY,
      deltaTime * 10
    );
    
    if (this.pickaxeModel) {
      if (this.isMining) {
        this.pickaxeSwingAngle += this.pickaxeSwingSpeed * deltaTime;
        const swing = Math.sin(this.pickaxeSwingAngle) * 0.8 - 0.3;
        this.pickaxeModel.rotation.x = swing;
      } else {
        this.pickaxeModel.rotation.x = THREE.MathUtils.lerp(
          this.pickaxeModel.rotation.x,
          0,
          deltaTime * 10
        );
      }
    }
    
    if (this.nameTag && camera) {
      this.nameTag.lookAt(camera.position);
    }
  }

  disposeObject(obj) {
    if (!obj) return;
    obj.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      }
      if (child.isSprite && child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }

  destroy() {
    this.destroyed = true;
    this.disposeObject(this.model);
    this.disposeObject(this.pickaxeModel);
    this.disposeObject(this.nameTag);
    if (this.model) this.group.remove(this.model);
    if (this.pickaxeModel) this.group.remove(this.pickaxeModel);
    if (this.nameTag) this.group.remove(this.nameTag);
    this.scene.remove(this.group);
  }
}

