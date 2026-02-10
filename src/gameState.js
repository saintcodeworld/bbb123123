const STORAGE_KEY = 'blockmine_save';

export function createDefaultState() {
  return {
    score: 0,
    totalBlocksMined: 0,
    blocksMined: {
      stone: 0,
      coalOre: 0,
      ironOre: 0,
      goldOre: 0,
      diamondOre: 0,
      emeraldOre: 0
    },
    currentPickaxe: 'stone',
    ownedPickaxes: ['stone'],
    playerPos: null
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const saved = JSON.parse(raw);
    const def = createDefaultState();
    return { ...def, ...saved, blocksMined: { ...def.blocksMined, ...(saved.blocksMined || {}) } };
  } catch (e) {
    console.warn('Failed to load save:', e);
    return createDefaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save:', e);
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
