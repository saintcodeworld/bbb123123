import * as THREE from 'three';
import { GameConfig } from './config.js';

const SHARED_GEO = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const MAX_PARTICLES = 30;

export class ParticleEffects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.materialCache = {};
  }

  getMaterial(color) {
    if (!this.materialCache[color]) {
      this.materialCache[color] = new THREE.MeshBasicMaterial({ color, transparent: true });
    }
    return this.materialCache[color];
  }

  createBlockBreakParticles(position, blockType) {
    if (!GameConfig.performance.enableParticles) return;

    const colorMap = {
      stone: 0x808080, coalOre: 0x2a2a2a, ironOre: 0xd8af93,
      goldOre: 0xfcee4b, diamondOre: 0x4aedd9, emeraldOre: 0x17dd62
    };

    const color = colorMap[blockType] || 0x888888;
    const count = Math.min(GameConfig.performance.particleCount || 4, 4);

    while (this.particles.length + count > MAX_PARTICLES && this.particles.length > 0) {
      const old = this.particles.shift();
      this.scene.remove(old);
    }

    for (let i = 0; i < count; i++) {
      const mat = this.getMaterial(color).clone();
      const particle = new THREE.Mesh(SHARED_GEO, mat);

      particle.position.set(
        position.x + (Math.random() - 0.5) * 0.5,
        position.y + (Math.random() - 0.5) * 0.5,
        position.z + (Math.random() - 0.5) * 0.5
      );

      particle.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.15,
        Math.random() * 0.15,
        (Math.random() - 0.5) * 0.15
      );

      particle.lifetime = 0.6;
      particle.gravity = -0.3;

      this.scene.add(particle);
      this.particles.push(particle);
    }
  }

  update(deltaTime) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.velocity.y += p.gravity * deltaTime;
      p.position.add(p.velocity);
      p.lifetime -= deltaTime;
      p.material.opacity = Math.max(0, p.lifetime / 0.6);

      if (p.lifetime <= 0) {
        this.scene.remove(p);
        p.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }
}
