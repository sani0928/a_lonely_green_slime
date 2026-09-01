import {
  BOSS_HP_EARLY_COUNT,
  BOSS_HP_EARLY_STEP,
  BOSS_HP_FIRST,
  BOSS_HP_LATE_STEP,
  BOSS_REWARD_BASE,
  BOSS_REWARD_PER_SPAWN,
  BOSS_SCALING_GROUP_SIZE,
} from "../config/constants.js";

export function bossHpAt(spawnOrdinal) {
  const ordinal = Math.max(1, spawnOrdinal | 0);
  if (ordinal <= BOSS_HP_EARLY_COUNT) return BOSS_HP_FIRST + (ordinal - 1) * BOSS_HP_EARLY_STEP;
  return BOSS_HP_FIRST + (BOSS_HP_EARLY_COUNT - 1) * BOSS_HP_EARLY_STEP + (ordinal - BOSS_HP_EARLY_COUNT) * BOSS_HP_LATE_STEP;
}

export function bossRewardAt(spawnOrdinal) {
  return BOSS_REWARD_BASE + Math.max(1, spawnOrdinal | 0) * BOSS_REWARD_PER_SPAWN;
}

export function bossScalingStep(spawnOrdinal) {
  return Math.floor((Math.max(1, spawnOrdinal | 0) - 1) / Math.max(1, BOSS_SCALING_GROUP_SIZE));
}
