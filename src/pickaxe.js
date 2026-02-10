import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PICKAXE_MODELS = {
  stone: '/models/minecraft_stone_pickaxe.glb',
  iron: '/models/minecraft_iron_pickaxe.glb',
  gold: '/models/minecraft_golden_pickaxe.glb',
  diamond: '/models/minecraft_diamond_pickaxe.glb',
  netherite: '/models/minecraft_netherite_pickaxe.glb'
};

const REST_X = 0.43;
const REST_Y = -0.55;
const REST_Z = -0.40;
const REST_RX = 0.17;
const REST_RY = 1.21;
const REST_RZ = -0.29;
const SCALE = 0.47;

export class Pickaxe {
  constructor(camera) {
    this.camera = camera;
    this.pickaxe = null;
    this.isSwinging = false;
    this.swingProgress = 0;
    this.currentTier = 'stone';
    this.loadedModels = {};
    this.loader = new GLTFLoader();
    this.loadModel('stone');
  }

  loadModel(tier) {
    const path = PICKAXE_MODELS[tier];
    if (!path) return;

    if (this.loadedModels[tier]) {
      this.setModel(tier);
      return;
    }

    this.loader.load(
      path,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
            child.frustumCulled = false;
          }
        });
        model.frustumCulled = false;
        this.loadedModels[tier] = model;
        if (this.currentTier === tier) this.setModel(tier);
      },
      undefined,
      (error) => console.warn(`Failed to load ${tier} pickaxe:`, error)
    );
  }

  setModel(tier) {
    if (this.pickaxe) this.camera.remove(this.pickaxe);

    const model = this.loadedModels[tier];
    if (!model) return;

    this.pickaxe = model.clone();
    this.pickaxe.traverse((child) => {
      if (child.isMesh) child.frustumCulled = false;
    });
    this.pickaxe.frustumCulled = false;
    this.pickaxe.scale.set(SCALE, SCALE, SCALE);
    this.pickaxe.position.set(REST_X, REST_Y, REST_Z);
    this.pickaxe.rotation.set(REST_RX, REST_RY, REST_RZ);
    this.camera.add(this.pickaxe);
  }

  switchTier(tier) {
    this.currentTier = tier;
    if (this.loadedModels[tier]) this.setModel(tier);
    else this.loadModel(tier);
  }

  updateColor() {}

  swing() {
    if (!this.isSwinging) {
      this.isSwinging = true;
      this.swingProgress = 0;
    }
  }

  update(deltaTime = 1/60) {
    if (!this.pickaxe) return;
    const time = Date.now() * 0.001;

    if (this.isSwinging) {
      this.swingProgress += 3.6 * deltaTime;
      const t = Math.sin(this.swingProgress * Math.PI);

      this.pickaxe.position.set(REST_X + t * 0.04, REST_Y - t * 0.08, REST_Z);
      this.pickaxe.rotation.set(REST_RX, REST_RY, REST_RZ + t * 0.6);

      if (this.swingProgress >= 1) {
        this.isSwinging = false;
        this.swingProgress = 0;
      }
    } else {
      this.pickaxe.position.set(REST_X, REST_Y + Math.sin(time * 2) * 0.008, REST_Z);
      this.pickaxe.rotation.set(REST_RX, REST_RY, REST_RZ + Math.sin(time * 1.5) * 0.02);
    }
  }
}
