import {
  PLAYER_SPEED_CAP,
  PLAYER_SPEED_RAMP_SEC,
  ENEMY_SPEED_FACTOR_MAX,
  ENEMY_SPEED_RAMP_SEC,
  ENEMY_DIFFICULTY_TIME_SCALE,
  ATTACK_UPGRADE_MAX,
  CELL_MAX_COUNT,
  CLEAR_TIME_SEC,
  ENDLESS_START_SEC,
  DIFFICULTY_HORIZON_SEC,
  PHASE2_START_SEC,
  PHASE3_START_SEC,
  PHASE_ENEMY_CAP_P1,
  PHASE_ENEMY_CAP_P2,
  PHASE_ENEMY_CAP_P3,
  PHASE_SPAWN_DELAY_MAX,
  PHASE_SPAWN_DELAY_MIN,
  ENDLESS_CAP_STEP_SEC,
  ENDLESS_CAP_STEP,
  ENDLESS_CAP_MAX,
} from "../config/constants.js";

export function getCurrentPhase(scene) {
  const t = scene?.elapsedTime ?? 0;
  if (t >= PHASE3_START_SEC) return 3;
  if (t >= PHASE2_START_SEC) return 2;
  return 1;
}

export function getPhaseProgress(scene) {
  const t = Math.max(0, scene?.elapsedTime ?? 0);
  const phase = getCurrentPhase(scene);
  if (phase === 1) {
    return Phaser.Math.Clamp(t / PHASE2_START_SEC, 0, 1);
  }
  if (phase === 2) {
    return Phaser.Math.Clamp(
      (t - PHASE2_START_SEC) / (PHASE3_START_SEC - PHASE2_START_SEC),
      0,
      1
    );
  }
  const phase3Duration = Math.max(1, (CLEAR_TIME_SEC || 900) - PHASE3_START_SEC);
  return Phaser.Math.Clamp((t - PHASE3_START_SEC) / phase3Duration, 0, 1);
}

export function getMaxActiveEnemies(scene) {
  const elapsed = Math.max(0, scene?.elapsedTime ?? 0);
  const phase = getCurrentPhase(scene);
  let baseCap = PHASE_ENEMY_CAP_P1;
  if (phase === 2) baseCap = PHASE_ENEMY_CAP_P2;
  if (phase === 3) baseCap = PHASE_ENEMY_CAP_P3;
  if (elapsed < ENDLESS_START_SEC) return baseCap;

  const endlessElapsed = elapsed - ENDLESS_START_SEC;
  const step = Math.max(1, ENDLESS_CAP_STEP_SEC || 120);
  const endlessBonus = Math.floor(endlessElapsed / step) * (ENDLESS_CAP_STEP || 40);
  return Math.min(ENDLESS_CAP_MAX || 700, baseCap + endlessBonus);
}

// Player strength in 0..1.
// Assumption: +1 cell ~= +2 attack upgrades.
export function getPlayerStrength(scene) {
  const attackCount = scene.attackUpgradeCount ?? 0;
  const attackMax = scene.attackUpgradeMax ?? ATTACK_UPGRADE_MAX ?? 20;

  const baseCellCount = scene.cellBaseCount ?? 2;
  const cellCount = scene.cellActiveCount ?? baseCellCount;
  const cellMax = scene.cellMaxCount ?? CELL_MAX_COUNT;

  const extraCells = Math.max(0, cellCount - baseCellCount);
  const extraCellsMax = Math.max(0, cellMax - baseCellCount);

  const equivalentCurrent = attackCount + extraCells * 2;
  const equivalentMax = Math.max(1, attackMax + extraCellsMax * 2);

  return Phaser.Math.Clamp(equivalentCurrent / equivalentMax, 0, 1);
}

// Spawn pressure in 0..1 based on time(80%) + player strength(20%).
export function getSpawnPressure(scene) {
  const elapsed = Math.max(0, scene?.elapsedTime ?? 0);
  const horizon = Math.max(1, DIFFICULTY_HORIZON_SEC || 900);
  const timeProgress = Phaser.Math.Clamp(Math.min(elapsed, horizon) / horizon, 0, 1);
  const strength = getPlayerStrength(scene);
  const basePressure = timeProgress * 0.8 + strength * 0.2;
  if (elapsed < ENDLESS_START_SEC) {
    return Phaser.Math.Clamp(basePressure, 0, 1);
  }
  const endlessMinutes = (elapsed - ENDLESS_START_SEC) / 60;
  const endlessBonus = Math.min(0.08, endlessMinutes * 0.008);
  return Phaser.Math.Clamp(basePressure + endlessBonus, 0, 1);
}

export function updateDifficultyScaling(scene) {
  const t = scene.elapsedTime;

  scene.enemyDifficultyFactor =
    1 + t / (ENEMY_DIFFICULTY_TIME_SCALE || 90);

  const speedRamp = ENEMY_SPEED_RAMP_SEC || 420;
  const speedMax = ENEMY_SPEED_FACTOR_MAX ?? 1.5;
  scene.enemySpeedFactor =
    1 + (speedMax - 1) * (1 - Math.exp(-t / speedRamp));

  const base = scene.basePlayerSpeed ?? 220;
  const cap = PLAYER_SPEED_CAP ?? 320;
  const ramp = PLAYER_SPEED_RAMP_SEC ?? 500;
  scene.playerSpeed = base + (cap - base) * (1 - Math.exp(-t / ramp));

  const phase = getCurrentPhase(scene);
  const spawnPressure = getSpawnPressure(scene);
  const maxDelay = PHASE_SPAWN_DELAY_MAX[phase] ?? PHASE_SPAWN_DELAY_MAX[1];
  const minDelay = PHASE_SPAWN_DELAY_MIN[phase] ?? PHASE_SPAWN_DELAY_MIN[1];

  const newDelay = Phaser.Math.Clamp(
    maxDelay - (maxDelay - minDelay) * spawnPressure,
    minDelay,
    maxDelay
  );

  scene.spawnEvent.delay = newDelay;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function getDifficultyProgress(scene) {
  const k = scene.killCount || 0;
  const killComponent = k / 600;
  return Phaser.Math.Clamp(killComponent, 0, 1);
}

export function getTierWeights(progress) {
  const weak = lerp(1.0, 0.2, progress);
  const mid = lerp(0.0, 0.5, progress);
  const strong = lerp(0.0, 0.3, progress);
  return { weak, mid, strong };
}

export function pickEnemyTier(scene) {
  const progress = getDifficultyProgress(scene);
  const { weak, mid, strong } = getTierWeights(progress);

  const total = weak + mid + strong;
  if (total <= 0) {
    return "mid";
  }

  let r = Math.random() * total;
  if (r < weak) return "weak";
  r -= weak;
  if (r < mid) return "mid";
  return "strong";
}
