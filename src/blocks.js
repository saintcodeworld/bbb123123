import * as THREE from 'three';

export class BlockManager {
  constructor(scene) {
    this.scene = scene;
    this.blocks = [];

    this.textureLoader = new THREE.TextureLoader();
    this.textures = this.loadTextures();

    this.blockTypes = {
      stone: {
        material: new THREE.MeshLambertMaterial({ map: this.textures.stone }),
        points: 50
      },
      grass: {
        material: [
          new THREE.MeshLambertMaterial({ map: this.textures.grassSide }),
          new THREE.MeshLambertMaterial({ map: this.textures.grassSide }),
          new THREE.MeshLambertMaterial({ map: this.textures.grass }),
          new THREE.MeshLambertMaterial({ map: this.textures.dirt }),
          new THREE.MeshLambertMaterial({ map: this.textures.grassSide }),
          new THREE.MeshLambertMaterial({ map: this.textures.grassSide })
        ],
        points: 50
      },
      iron: {
        material: new THREE.MeshLambertMaterial({ map: this.textures.ironOre }),
        points: 300
      },
      diamond: {
        material: new THREE.MeshLambertMaterial({ color: 0x00ffff }),
        points: 1000
      }
    };
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

  spawnBlock(playerPosition) {
    const types = Object.keys(this.blockTypes);
    const weights = [50, 30, 15, 5];
    const randomType = this.weightedRandom(types, weights);

    const blockData = this.blockTypes[randomType];

    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const block = new THREE.Mesh(geometry, blockData.material);

    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    block.add(wireframe);

    const spawnDistance = 15;
    const angle = Math.random() * Math.PI * 2;
    const height = (Math.random() - 0.5) * 10;

    block.position.set(
      playerPosition.x + Math.cos(angle) * spawnDistance,
      playerPosition.y + height,
      playerPosition.z + Math.sin(angle) * spawnDistance
    );

    block.userData = {
      type: randomType,
      points: blockData.points
    };

    this.scene.add(block);
    this.blocks.push(block);
  }

  weightedRandom(items, weights) {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }

    return items[items.length - 1];
  }

  mineBlock(block) {
    const points = block.userData.points;

    this.scene.remove(block);
    const index = this.blocks.indexOf(block);
    if (index > -1) {
      this.blocks.splice(index, 1);
    }

    block.geometry.dispose();
    block.material.dispose();

    return points;
  }

  update(playerPosition) {
    if (this.blocks.length === 0) {
      this.spawnBlock(playerPosition);
    }

    this.blocks.forEach(block => {
      block.rotation.y += 0.01;
      block.rotation.x += 0.005;
    });
  }
}
