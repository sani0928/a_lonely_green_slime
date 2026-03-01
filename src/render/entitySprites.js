/** 픽셀 시트 엔티티 인덱스·방향·스케일 매핑. */
// Sheet layout (from assets/sprites/player_and_monsters_sheet_making.py):
// - Sheet size: 1024x1024
// - GRID = 8 → 8 cols x 8 rows
// - Each tile: 128x128 (frameWidth / frameHeight in Phaser)
// - Rows (entityIndex):
//   0: PLAYER_SLIME
//   1: SMALL_IMP
//   2: SMALL_SKULL
//   3: MED_GOBLIN
//   4: MED_CYCLOPS
//   5: LARGE_OGRE
//   6: LARGE_GOLEM
//   7: ARCHER
// - Cols (dirIndex), shared with DIR_VECTORS below:
//   0: N, 1: NE, 2: E, 3: SE, 4: S, 5: SW, 6: W, 7: NW
//
// Phaser frame index rule for this sheet:
//   frameIndex = entityIndex * 8 + dirIndex

export const GRID_SIZE = 8;

// Direction vectors in the same order as DIRS in the generator.
export const DIR_VECTORS = [
  { name: "N", x: 0, y: -1 },
  { name: "NE", x: 1, y: -1 },
  { name: "E", x: 1, y: 0 },
  { name: "SE", x: 1, y: 1 },
  { name: "S", x: 0, y: 1 },
  { name: "SW", x: -1, y: 1 },
  { name: "W", x: -1, y: 0 },
  { name: "NW", x: -1, y: -1 },
];

// Indices into the sheet for each logical entity.
// These must match the order in `characters` from the Python generator.
export const ENTITY_INDEX = {
  PLAYER_SLIME: 0,
  SMALL_IMP: 1,
  SMALL_SKULL: 2,
  MED_GOBLIN: 3,
  MED_CYCLOPS: 4,
  LARGE_OGRE: 5,
  LARGE_GOLEM: 6,
  ARCHER: 7,
};

// Mapping from game enemy type (constants.js ENEMY_TYPES keys)
// to sheet entity index + a coarse size classification.
export const ENEMY_ENTITY_MAPPING = {
  runner: { entityIndex: ENTITY_INDEX.SMALL_IMP, size: "small" },
  mite: { entityIndex: ENTITY_INDEX.SMALL_SKULL, size: "small" },
  grunt: { entityIndex: ENTITY_INDEX.MED_GOBLIN, size: "medium" },
  soldier: { entityIndex: ENTITY_INDEX.MED_CYCLOPS, size: "medium" },
  shooter: { entityIndex: ENTITY_INDEX.ARCHER, size: "medium" },
  brute: { entityIndex: ENTITY_INDEX.LARGE_OGRE, size: "large" },
  titan: { entityIndex: ENTITY_INDEX.LARGE_GOLEM, size: "large" },
};

export function getEntityIndexForPlayer() {
  return ENTITY_INDEX.PLAYER_SLIME;
}

export function getEntityMappingForEnemyType(type) {
  const mapping = ENEMY_ENTITY_MAPPING[type];
  if (mapping) return mapping;
  // Fallback: treat as a medium goblin-like enemy.
  return { entityIndex: ENTITY_INDEX.MED_GOBLIN, size: "medium" };
}

export function getFrameIndex(entityIndex, dirIndex) {
  const clampedEntity = Math.max(0, Math.min(7, entityIndex | 0));
  const clampedDir = Math.max(0, Math.min(7, dirIndex | 0));
  return clampedEntity * GRID_SIZE + clampedDir;
}

// Quantize a movement/vector direction into one of 8 sheet directions.
// If (dx, dy) is (0, 0), falls back to `fallbackDirIndex` (default: facing S).
export function getDirIndexFromVector(dx, dy, fallbackDirIndex = 4) {
  const fx = dx || 0;
  const fy = dy || 0;

  if (fx === 0 && fy === 0) {
    return fallbackDirIndex;
  }

  const len = Math.hypot(fx, fy) || 1;
  const nx = fx / len;
  const ny = fy / len;

  let bestIndex = 0;
  let bestDot = -Infinity;

  for (let i = 0; i < DIR_VECTORS.length; i += 1) {
    const dir = DIR_VECTORS[i];
    const dot = nx * dir.x + ny * dir.y;
    if (dot > bestDot) {
      bestDot = dot;
      bestIndex = i;
    }
  }

  return bestIndex;
}

// World scale for each logical size class.
// These are tuned to keep collision feeling close to the previous
// shape-based visuals while clearly distinguishing weak/mid/strong.
export function getScaleForSize(size) {
  switch (size) {
    case "small":
      return 0.45;
    case "large":
      return 0.65;
    case "player":
      return 0.5;
    case "medium":
    default:
      return 0.55;
  }
}

