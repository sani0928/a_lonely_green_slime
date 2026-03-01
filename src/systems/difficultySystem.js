import {
  INITIAL_SPAWN_DELAY_MS,
  MIN_SPAWN_DELAY_MS,
  MIN_SPAWN_DELAY_MS_STRONG,
  MIN_SPAWN_DELAY_MS_LATE,
  LATE_SPAWN_DELAY_START_SEC,
  SPAWN_DELAY_DECREASE_PER_SECOND,
  PLAYER_SPEED_CAP,
  PLAYER_SPEED_RAMP_SEC,
  ENEMY_SPEED_FACTOR_MAX,
  ENEMY_SPEED_RAMP_SEC,
  ENEMY_DIFFICULTY_TIME_SCALE,
  ATTACK_UPGRADE_MAX,
  MAX_ACTIVE_ENEMIES_BASE,
  MAX_ACTIVE_ENEMIES_LATE,
  ENEMY_CAP_RAMP_START_SEC,
  ENEMY_CAP_RAMP_END_SEC,
} from "../config/constants.js";

// 플레이어/적 공통 난이도 스케일링 및 티어 계산 로직
// 구간: 초반 0~5분 성장 재미, 중반 5~15분 점점 어려움, 후반 15분~ 실력 의존(30분 한계)

export function isStrongPlayer(scene) {
  const attackCount = scene.attackUpgradeCount ?? 0;
  const cellCount = scene.cellActiveCount ?? scene.cellBaseCount ?? 2;
  const cellMax = scene.cellMaxCount ?? 16;
  return attackCount >= 16 && cellCount >= cellMax - 2;
}

/** 현재 시점의 적 상한 (시간에 따라 BASE → LATE로 완만히 상승, 후반 압박) */
export function getMaxActiveEnemies(scene) {
  const t = scene.elapsedTime ?? 0;
  if (t <= ENEMY_CAP_RAMP_START_SEC) return MAX_ACTIVE_ENEMIES_BASE;
  const ramp =
    (t - ENEMY_CAP_RAMP_START_SEC) /
    (ENEMY_CAP_RAMP_END_SEC - ENEMY_CAP_RAMP_START_SEC);
  const blend = Phaser.Math.Clamp(ramp, 0, 1);
  return Math.round(
    MAX_ACTIVE_ENEMIES_BASE +
      (MAX_ACTIVE_ENEMIES_LATE - MAX_ACTIVE_ENEMIES_BASE) * blend
  );
}

/** 0~1 플레이어 강함 (공격 업그레이드·셀 개수 기반). 스폰 딜레이·슈터 확률 등에 사용 */
export function getPlayerStrength(scene) {
  const attackCount = scene.attackUpgradeCount ?? 0;
  const attackMax = scene.attackUpgradeMax ?? ATTACK_UPGRADE_MAX ?? 10;
  const attackRatio =
    attackMax > 0 ? Phaser.Math.Clamp(attackCount / attackMax, 0, 1) : 0;

  const cellCount = scene.cellActiveCount ?? scene.cellBaseCount ?? 2;
  const cellMax = scene.cellMaxCount ?? 16;
  const cellRatio =
    cellMax > 2
      ? Phaser.Math.Clamp((cellCount - 2) / (cellMax - 2), 0, 1)
      : 0;

  const raw = attackRatio * 0.65 + cellRatio * 0.35;
  return Phaser.Math.Clamp(raw, 0, 1);
}

export function updateDifficultyScaling(scene) {
  const t = scene.elapsedTime;

  // 적 난이도(체력·추가 스폰 수): 시간에 비례, 30분에 고수 한계
  scene.enemyDifficultyFactor =
    1 + t / (ENEMY_DIFFICULTY_TIME_SCALE || 90);

  // 적 속도 배율: 완만한 상한 (후반은 수·체력으로 압박, 속도는 제한)
  const speedRamp = ENEMY_SPEED_RAMP_SEC || 420;
  const speedMax = ENEMY_SPEED_FACTOR_MAX ?? 1.5;
  scene.enemySpeedFactor =
    1 + (speedMax - 1) * (1 - Math.exp(-t / speedRamp));

  // 플레이어 속도: 초반 완만 상승 → 상한 수렴 (조작감 유지, 성장감 확보)
  const base = scene.basePlayerSpeed ?? 220;
  const cap = PLAYER_SPEED_CAP ?? 320;
  const ramp = PLAYER_SPEED_RAMP_SEC ?? 500;
  scene.playerSpeed = base + (cap - base) * (1 - Math.exp(-t / ramp));

  // 스폰 딜레이: 플레이어 강함 기반. 후반(10분~)에는 추가로 단축해 상한 증가분을 빠르게 채움
  const strength = getPlayerStrength(scene);
  let minDelay = isStrongPlayer(scene)
    ? MIN_SPAWN_DELAY_MS_STRONG
    : MIN_SPAWN_DELAY_MS;
  if (t >= LATE_SPAWN_DELAY_START_SEC && MIN_SPAWN_DELAY_MS_LATE != null) {
    minDelay = Math.min(minDelay, MIN_SPAWN_DELAY_MS_LATE);
  }
  const newDelay = Phaser.Math.Clamp(
    INITIAL_SPAWN_DELAY_MS -
      (INITIAL_SPAWN_DELAY_MS - minDelay) * strength,
    minDelay,
    INITIAL_SPAWN_DELAY_MS
  );
  scene.spawnEvent.delay = newDelay;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function getDifficultyProgress(scene) {
  const k = scene.killCount || 0;

  // 티어 비율 진행도는 킬 수만으로 결정 (시간 비의존)
  const killComponent = k / 600; // 600킬 기준으로 0->1
  const raw = killComponent;

  return Phaser.Math.Clamp(raw, 0, 1);
}

/** 진행도(0~1)에 따른 weak/mid/strong 티어 가중치. 킬 기반 진행도와 함께 pickEnemyTier에서 사용 */
export function getTierWeights(progress) {
  const weak = lerp(1.0, 0.2, progress);
  const mid = lerp(0.0, 0.5, progress);
  const strong = lerp(0.0, 0.3, progress);
  return { weak, mid, strong };
}

/** 킬 기반 진행도 + getTierWeights로 weak|mid|strong 중 하나 반환 */
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

