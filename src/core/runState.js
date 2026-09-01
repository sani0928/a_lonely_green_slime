import {
  CELL_BASE_COUNT,
  CELL_BASE_RADIUS,
  CELL_BASE_ROTATION_SPEED,
  CLEAR_TIME_SEC,
  PLAYER_BASE_ATTACK,
  PLAYER_BASE_HP,
  PLAYER_BASE_SPEED,
  PLAYER_MAX_HP_CAP,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../config/constants.js";

// Plain data only: this module is safe to import from Node as well as Phaser.
export function createRunState() {
  return {
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    elapsedTime: 0,
    score: 0,
    killCount: 0,
    player: {
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      hp: PLAYER_BASE_HP,
      maxHp: PLAYER_MAX_HP_CAP,
      attack: PLAYER_BASE_ATTACK,
      speed: PLAYER_BASE_SPEED,
      invincibleUntil: 0,
    },
    cells: {
      activeCount: CELL_BASE_COUNT,
      radius: CELL_BASE_RADIUS,
      rotationSpeed: CELL_BASE_ROTATION_SPEED,
      angle: 0,
    },
    clearTimeSeconds: CLEAR_TIME_SEC,
  };
}
