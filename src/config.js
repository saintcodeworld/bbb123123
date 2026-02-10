export const GameConfig = {
  world: {
    chunkSize: 12,
    renderDistance: 2,
    verticalLayers: 8,
    groundLevel: 0
  },

  performance: {
    maxChunksPerFrame: 1,
    enableFog: true,
    fogDensity: 0.02,
    enableClouds: false,
    enableParticles: true,
    particleCount: 4,
    simplifiedGeometry: true
  },

  player: {
    moveSpeed: 5,
    flySpeed: 7.5,
    jumpSpeed: 18,
    gravity: -50,
    height: 1.7,
    radius: 0.3,
    stepHeight: 0.5,
    doubleJumpThreshold: 350
  },

  mining: {
    points: {
      stone: 50,
      coalOre: 150,
      ironOre: 300,
      goldOre: 600,
      diamondOre: 1000,
      emeraldOre: 8000
    },
    hardness: {
      stone: 1.5,
      coalOre: 2.0,
      ironOre: 3.0,
      goldOre: 3.5,
      diamondOre: 5.0,
      emeraldOre: 4.0
    },
    pickaxeTiers: {
      stone: { name: 'Stone', speed: 1.0, cost: 0 },
      iron: { name: 'Iron', speed: 1.8, cost: 200 },
      gold: { name: 'Gold', speed: 2.5, cost: 500 },
      diamond: { name: 'Diamond', speed: 4.0, cost: 1500 },
      netherite: { name: 'Netherite', speed: 5.0, cost: 5000 }
    }
  },

  generation: {
    oreFrequency: 0.15,
    coalThreshold: 0.8,
    ironThreshold: 0.88,
    diamondThreshold: 0.92,
    diamondDepth: -12,
    caves: {
      frequency: 0.08,
      threshold: 0.3,
      wormFrequency: 0.05,
      wormThreshold: 0.35
    }
  }
};
