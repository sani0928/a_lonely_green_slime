// Game version shown in UI.
export const GAME_VERSION = "0.9.3";

// Dev mode flag.
// Enables debug overlays/hotkeys only and must not alter gameplay balance.
export const DEV_MODE = false;

// Rendering mode.
// true: use pixel sprite sheets.
// false: use primitive runtime textures.
export const USE_PIXEL_SPRITES = true;

// World
export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 3200;

// Player
export const PLAYER_BASE_HP = 5;
export const PLAYER_MAX_HP_CAP = 10;
export const PLAYER_BASE_SPEED = 240;
export const PLAYER_SPEED_CAP = 320;
export const PLAYER_SPEED_RAMP_SEC = 500;
export const PLAYER_BASE_ATTACK = 10;

// Attack upgrade progression (20 steps, total +138 => final attack 148)
export const ATTACK_UPGRADE_MAX = 20;
export const ATTACK_UPGRADE_AMOUNTS = [
  5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 7,
];

// Enemies
export const ENEMY_BASE_SPEED_MIN = 50;
export const ENEMY_BASE_SPEED_MAX = 105;
export const ENEMY_SPEED_FACTOR_MAX = 1.5;
export const ENEMY_SPEED_RAMP_SEC = 420;
export const ENEMY_DIFFICULTY_TIME_SCALE = 75;

export const INITIAL_SPAWN_DELAY_MS = 650;
export const MIN_SPAWN_DELAY_MS = 380;
export const MIN_SPAWN_DELAY_MS_STRONG = 280;
export const MIN_SPAWN_DELAY_MS_LATE = 250;
export const LATE_SPAWN_DELAY_START_SEC = 600;
export const SPAWN_DELAY_DECREASE_PER_SECOND = 4;

export const EXTRA_ENEMIES_CAP = 4;
export const EXTRA_ENEMIES_CAP_STRONG = 6;

// Legacy cap-ramp constants kept for compatibility with older systems.
export const MAX_ACTIVE_ENEMIES_BASE = 300;
export const MAX_ACTIVE_ENEMIES_LATE = 700;
export const ENEMY_CAP_RAMP_START_SEC = 360;
export const ENEMY_CAP_RAMP_END_SEC = 24 * 60;

export const ENEMY_CULL_DISTANCE = 2600;
export const ENEMY_SPAWN_MARGIN = 80;
export const ENEMY_BASE_HP = 48;
export const ENEMY_HP_PER_DIFFICULTY = 11;

// Enemy catalog
export const ENEMY_TYPES = {
  runner: { baseHp: 18, score: 10, speedMultiplier: 1.15, tier: "weak" },
  mite: { baseHp: 12, score: 10, speedMultiplier: 1.3, tier: "weak" },
  grunt: { baseHp: 32, score: 20, speedMultiplier: 1, tier: "mid" },
  soldier: { baseHp: 40, score: 20, speedMultiplier: 0.9, tier: "mid" },
  shooter: { baseHp: 34, score: 50, speedMultiplier: 0.85, tier: "mid" },
  brute: { baseHp: 62, score: 30, speedMultiplier: 0.8, tier: "strong" },
  titan: { baseHp: 84, score: 30, speedMultiplier: 0.6, tier: "strong" },
};

// Cells
export const CELL_BASE_COUNT = 2;
export const CELL_MAX_COUNT = 8;
export const CELL_BASE_RADIUS = 60;
export const CELL_BASE_ROTATION_SPEED = 1;
export const CELL_ROTATION_SPEED_INCREASE_PER_SECOND = 1 / 40;

// Fragment drops
export const INITIAL_ITEM_KILL_THRESHOLD = 20;
export const ITEM_SPAWN_MARGIN = 120;

export const DAMAGE_INVINCIBLE_DURATION_MS = 1500;
export const CLEAR_TIME_SEC = 15 * 60;
export const ENDLESS_START_SEC = CLEAR_TIME_SEC;
export const DIFFICULTY_HORIZON_SEC = CLEAR_TIME_SEC;

// 3-phase difficulty system
export const PHASE2_START_SEC = 5 * 60;
export const PHASE3_START_SEC = 10 * 60;

export const PHASE_GRID_TRANSITION_MS = 800;
export const PHASE_GRID_COLOR_P1 = 0x2f7a4b;
export const PHASE_GRID_COLOR_P2 = 0xff8f00;
export const PHASE_GRID_COLOR_P3 = 0xd32f2f;
export const PHASE_GRID_MAJOR_ALPHA_BASE = { 1: 0.40, 2: 0.46, 3: 0.52 };
export const PHASE_GRID_MAJOR_ALPHA_AMPLITUDE = { 1: 0.05, 2: 0.07, 3: 0.09 };
export const PHASE_GRID_MAJOR_WAVE_SPEED_HZ = { 1: 0.22, 2: 0.55, 3: 1.0 };
export const PHASE_GRID_MAJOR_HIGHLIGHT_COLOR = {
  1: 0xd9ffe8,
  2: 0xffe2a8,
  3: 0xffb3b3,
};
export const PHASE_GRID_MAJOR_WAVE_COLOR_BLEND = { 1: 0.28, 2: 0.42, 3: 0.58 };
export const PHASE_GRID_MAJOR_WIDTH_BASE = { 1: 2.0, 2: 2.4, 3: 2.8 };
export const PHASE_GRID_MAJOR_WIDTH_AMPLITUDE = { 1: 0.16, 2: 0.28, 3: 0.40 };

export const PHASE_ENEMY_CAP_P1 = 200;
export const PHASE_ENEMY_CAP_P2 = 400;
export const PHASE_ENEMY_CAP_P3 = 600;

export const PHASE_SPAWN_DELAY_MAX = { 1: 620, 2: 470, 3: 340 };
export const PHASE_SPAWN_DELAY_MIN = { 1: 320, 2: 220, 3: 160 };

export const PHASE_SPAWN_AMOUNT_BONUS = { 1: 1, 2: 2, 3: 3 };

export const PHASE_AGGRO_RADIUS_MULTIPLIER = { 1: 1.0, 2: 1.2, 3: 1.35 };
export const PHASE_AGGRO_CHASE_SPEED_MULTIPLIER = { 1: 1.0, 2: 1.05, 3: 1.15 };

export const SHOOTER_CAP_STEP_SEC = 150;
export const SHOOTER_SPAWN_INTERVAL_SEC = 10;

export const ENDLESS_CAP_STEP_SEC = 120;
export const ENDLESS_CAP_STEP = 40;
export const ENDLESS_CAP_MAX = 700;
export const ENDLESS_CHASE_SPEED_MAX = 1.30;
export const ENDLESS_SHOOTER_INTERVAL_SEC = 8;
