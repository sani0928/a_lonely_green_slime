// 게임 전체에서 사용하는 튜닝 상수들

// --- 개발 모드 플래그 ---
// true로 두면 밸런스 무시하고 테스트용 극단 값(HP/탄환/보물 상한 99, 10킬마다 보물 등)을 사용한다.
export const DEV_MODE = false;
export const DEV_MAX_CAP = 20;
export const DEV_CHEST_KILL_INTERVAL = 10;

// --- 그래픽 모드 플래그 ---
// true: assets/sprites/player_and_monsters.png 픽셀 스프라이트 시트를 사용.
// false: 기존 도형 기반 runtime 텍스처를 사용.
export const USE_PIXEL_SPRITES = true;

// 월드
export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 3200;

// 플레이어
export const PLAYER_BASE_HP = 7;
export const PLAYER_MAX_HP_CAP = 10;
export const PLAYER_BASE_SPEED = 240;
/** 30분 기준 밸런스: 속도 상한(초반 성장감, 후반은 실력 의존) */
export const PLAYER_SPEED_CAP = 320;
/** 플레이어 속도가 상한에 수렴하는 시간 상수(초). 작을수록 빨리 상한 근처 도달 */
export const PLAYER_SPEED_RAMP_SEC = 500;
export const PLAYER_BASE_ATTACK = 10;
/** 공격력 업그레이드 최대 횟수 (1~20강) */
export const ATTACK_UPGRADE_MAX = 20;
/** 1~20강 차등 상승량 (합계 90 → 최종 공격력 100) */
export const ATTACK_UPGRADE_AMOUNTS = [
  7, 6, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3,
];

// 적
export const ENEMY_BASE_SPEED_MIN = 50;
export const ENEMY_BASE_SPEED_MAX = 105;
/** 적 속도 배율 상한(난이도는 수·체력으로, 속도는 완만하게) */
export const ENEMY_SPEED_FACTOR_MAX = 1.5;
/** 적 속도 배율이 상한에 수렴하는 시간 상수(초) */
export const ENEMY_SPEED_RAMP_SEC = 420;
/** 적 체력/추가 스폰 수용 난이도: 1 + t / ENEMY_DIFFICULTY_TIME_SCALE */
export const ENEMY_DIFFICULTY_TIME_SCALE = 90;
export const INITIAL_SPAWN_DELAY_MS = 650;
export const MIN_SPAWN_DELAY_MS = 380;
/** 플레이어가 매우 강할 때(탄환/공격력 상한 근접) 압박 유지용 최소 스폰 간격 */
export const MIN_SPAWN_DELAY_MS_STRONG = 280;
/** 후반(10분~) 난이도 상승용 추가 최소 간격 단축 */
export const MIN_SPAWN_DELAY_MS_LATE = 250;
export const LATE_SPAWN_DELAY_START_SEC = 600;
export const SPAWN_DELAY_DECREASE_PER_SECOND = 4;
/** 스폰 시 추가 등장 적 기본 상한 */
export const EXTRA_ENEMIES_CAP = 4;
/** 플레이어가 매우 강할 때 추가 등장 적 상한 */
export const EXTRA_ENEMIES_CAP_STRONG = 6;
/** 필드에 동시 존재 가능한 적 상한 (초반, 렉 방지) */
export const MAX_ACTIVE_ENEMIES_BASE = 300;
/** 후반(30분 근처)까지 올라가는 적 상한 (난이도 곡선용) */
export const MAX_ACTIVE_ENEMIES_LATE = 600;
/** 적 상한이 BASE→LATE로 올라가기 시작하는 시간(초). 이전까지는 BASE 유지 */
export const ENEMY_CAP_RAMP_START_SEC = 360;
/** 적 상한이 LATE에 도달하는 시간(초). 이후에는 LATE 유지 */
export const ENEMY_CAP_RAMP_END_SEC = 24 * 60;
/** 플레이어에서 이 거리보다 먼 적은 제거 (화면 밖에 쌓여 스폰이 막히는 것 방지) */
export const ENEMY_CULL_DISTANCE = 1800;
export const ENEMY_SPAWN_MARGIN = 80;
export const ENEMY_BASE_HP = 42;
export const ENEMY_HP_PER_DIFFICULTY = 18;

// 30분(고수 기준 최대 플레이) 밸런스: weak/mid/strong 각 2종, 다양성·타수 조절
export const ENEMY_TYPES = {
  // --- weak (초반 다수, 후반에도 소량) ---
  runner: {
    baseHp: 16,
    score: 10,
    speedMultiplier: 1.35,
    tier: "weak",
  },
  mite: {
    baseHp: 10,
    score: 10,
    speedMultiplier: 1.6,
    tier: "weak",
  },
  // --- mid (중반 주력) ---
  grunt: {
    baseHp: 28,
    score: 20,
    speedMultiplier: 1,
    tier: "mid",
  },
  soldier: {
    baseHp: 36,
    score: 20,
    speedMultiplier: 0.9,
    tier: "mid",
  },
  // --- shooter (원거리 mid) ---
  shooter: {
    baseHp: 30,
    score: 50,
    speedMultiplier: 0.85,
    tier: "mid",
  },
  // --- strong (후반 압박, 30분 구간 탱커) ---
  brute: {
    baseHp: 52,
    score: 30,
    speedMultiplier: 0.8,
    tier: "strong",
  },
  titan: {
    baseHp: 72,
    score: 30,
    speedMultiplier: 0.6,
    tier: "strong",
  },
};

// 셀(탄환)
export const CELL_BASE_COUNT = 2;
export const CELL_MAX_COUNT = 8;
export const CELL_BASE_RADIUS = 60;
export const CELL_BASE_ROTATION_SPEED = 1;
export const CELL_ROTATION_SPEED_INCREASE_PER_SECOND = 1 / 40;

// 프래그먼트(첫 20킬, 이후 누적)
export const INITIAL_ITEM_KILL_THRESHOLD = 20;
export const ITEM_SPAWN_MARGIN = 120;

export const DAMAGE_INVINCIBLE_DURATION_MS = 1500;
export const GAME_TIME_LIMIT_SEC = 30 * 60;

