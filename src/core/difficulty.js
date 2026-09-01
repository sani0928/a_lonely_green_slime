import {
  ENDLESS_CAP_MAX,
  ENDLESS_CAP_STEP,
  ENDLESS_CAP_STEP_SEC,
  ENDLESS_START_SEC,
  PHASE2_START_SEC,
  PHASE3_START_SEC,
  PHASE_ENEMY_CAP_P1,
  PHASE_ENEMY_CAP_P2,
  PHASE_ENEMY_CAP_P3,
  PHASE_SPAWN_DELAY_MAX,
  PHASE_SPAWN_DELAY_MIN,
} from "../config/constants.js";

export function phaseAt(elapsedSeconds) {
  if (elapsedSeconds >= PHASE3_START_SEC) return 3;
  if (elapsedSeconds >= PHASE2_START_SEC) return 2;
  return 1;
}

export function maxActiveEnemiesAt(elapsedSeconds) {
  const phase = phaseAt(elapsedSeconds);
  const base = phase === 3 ? PHASE_ENEMY_CAP_P3 : phase === 2 ? PHASE_ENEMY_CAP_P2 : PHASE_ENEMY_CAP_P1;
  if (elapsedSeconds < ENDLESS_START_SEC) return base;
  const bonus = Math.floor((elapsedSeconds - ENDLESS_START_SEC) / Math.max(1, ENDLESS_CAP_STEP_SEC)) * ENDLESS_CAP_STEP;
  return Math.min(ENDLESS_CAP_MAX, base + bonus);
}

export function pickTier(random, kills) {
  const progress = Math.min(1, Math.max(0, kills / 600));
  const weak = 1 - 0.8 * progress;
  const mid = 0.5 * progress;
  const strong = 0.3 * progress;
  let roll = random() * (weak + mid + strong);
  if (roll < weak) return "weak";
  roll -= weak;
  return roll < mid ? "mid" : "strong";
}

/**
 * Pure difficulty values used by both Phaser and the authoritative server.
 * `strength` is the existing 0..1 scene calculation, kept as an argument so
 * this module stays independent from Phaser state.
 */
export function difficultyProfileAt(elapsedSeconds, strength = 0) {
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const phase = phaseAt(elapsed);
  const horizon = Math.max(1, ENDLESS_START_SEC);
  const timeProgress = Math.min(elapsed, horizon) / horizon;
  const endlessMinutes = Math.max(0, elapsed - ENDLESS_START_SEC) / 60;
  const pressure = Math.min(1, Math.max(0, timeProgress * 0.8 + Math.max(0, Math.min(1, strength)) * 0.2 + Math.min(0.08, endlessMinutes * 0.008)));
  const maxDelay = PHASE_SPAWN_DELAY_MAX[phase] ?? PHASE_SPAWN_DELAY_MAX[1];
  const minDelay = PHASE_SPAWN_DELAY_MIN[phase] ?? PHASE_SPAWN_DELAY_MIN[1];
  return {
    phase,
    pressure,
    spawnDelaySeconds: (maxDelay - (maxDelay - minDelay) * pressure) / 1000,
    maxActiveEnemies: maxActiveEnemiesAt(elapsed),
  };
}
