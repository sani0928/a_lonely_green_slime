import { BADGES } from "../badges/badgeDefinitions.js";
import { applyDamage } from "./enemySystem.js";
import {
  PLAYER_MAX_HP_CAP,
  CELL_MAX_COUNT,
  DEV_MODE,
  DEV_MAX_CAP,
  USE_PIXEL_SPRITES,
} from "../config/constants.js";

// 이론상 장착 가능한 최대 뱃지 슬롯 수 (실제 사용 슬롯 수는 scene.badgeSlotCount로 제한)
const MAX_EQUIPPED = 7;

// rarity weights for badge draw rolls
export const RARITY_WEIGHTS = {
  normal: 0.5,
  epic: 0.4,
  unique: 0.1,
};

function ensureState(scene) {
  if (!scene.badgesEquipped) {
    scene.badgesEquipped = [];
  }
  if (!scene.badgesOwned) {
    scene.badgesOwned = [];
  }
  if (typeof scene.lifestealKillCounter !== "number") {
    scene.lifestealKillCounter = 0;
  }
  if (typeof scene.bloodHungryKillCounter !== "number") {
    scene.bloodHungryKillCounter = 0;
  }
  if (typeof scene.regenLastHealTime !== "number") {
    scene.regenLastHealTime = 0;
  }
}

export function hasBadge(scene, id) {
  ensureState(scene);
  return scene.badgesEquipped.includes(id);
}

export function initBadgeState(scene) {
  // 새 게임 시작 시 항상 뱃지 상태 초기화 (재시작 시 이전 장착이 남지 않도록)
  scene.badgesEquipped = [];
  scene.badgesOwned = [];
  scene.lifestealKillCounter = 0;
  scene.bloodHungryKillCounter = 0;
  scene.regenLastHealTime = 0;
  recalcCapsFromBadges(scene);
  updatePlayerScaleFromBadges(scene);
}

export function getEquippedBadges(scene) {
  ensureState(scene);
  return scene.badgesEquipped;
}

export function getEquippedBadgeNames(scene) {
  ensureState(scene);
  return scene.badgesEquipped
    .map((id) => BADGES.find((b) => b.id === id))
    .filter((b) => !!b)
    .map((b) => b.name);
}

export function equipBadgeAtSlot(scene, badgeId, slotIndex) {
  ensureState(scene);
  const equipped = scene.badgesEquipped;
  const index = Math.max(0, Math.min(slotIndex ?? 0, MAX_EQUIPPED - 1));

  while (equipped.length <= index) {
    equipped.push(null);
  }
  equipped[index] = badgeId;

  if (!scene.badgesOwned.includes(badgeId)) {
    scene.badgesOwned.push(badgeId);
  }

  // 장착/교체 후, 배지 보너스에 따라 HP/탄환 최대 한도 재계산
  recalcCapsFromBadges(scene);
  updatePlayerScaleFromBadges(scene);
  // HUD HP 표시 동기화 (장착만 하고 현재 HP는 변경하지 않았음을 화면에 반영)
  if (scene.hpText && typeof scene.hpText.setText === "function") {
    scene.hpText.setText(`${scene.playerHp ?? 0}/${scene.playerMaxHp ?? 0}`);
  }
}

export function getBadgesByRarity(rarity) {
  return BADGES.filter((b) => b.rarity === rarity);
}

export function rollBadgeDraw() {
  const entries = Object.entries(RARITY_WEIGHTS);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return null;

  let r = Math.random() * total;
  let selectedRarity = entries[0][0];
  for (let i = 0; i < entries.length; i += 1) {
    const [rarity, weight] = entries[i];
    if (r < weight) {
      selectedRarity = rarity;
      break;
    }
    r -= weight;
  }

  const pool = BADGES.filter((b) => b.rarity === selectedRarity);
  if (!pool.length) return null;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

export function getAvailableBadges(scene, maxCount = 2) {
  ensureState(scene);
  const equipped = new Set(scene.badgesEquipped);
  const candidates = BADGES.filter((b) => !equipped.has(b.id));

  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, maxCount);
}

export function modifyKillScore(scene, baseScore) {
  let multiplier = 1.0;
  if (hasBadge(scene, "give_me_more")) {
    multiplier *= 1.5;
  }
  if (hasBadge(scene, "give_me_more_plus")) {
    multiplier *= 2.0;
  }
  return Math.round(baseScore * multiplier);
}

export function onEnemyHit(scene, enemy) {
  if (!enemy || !enemy.active) return;
  // 현재 설계된 새 뱃지 효과는 on-hit에서 처리할 로직이 없음 (확장용 훅).
}

export function onEnemyKilled(scene, enemy) {
  if (!enemy) return;

  // Blood Hungry: 300킬마다 HP +2 (not at full health)
  if (hasBadge(scene, "blood_hungry")) {
    scene.bloodHungryKillCounter = (scene.bloodHungryKillCounter || 0) + 1;
    if (scene.bloodHungryKillCounter >= 300) {
      scene.bloodHungryKillCounter -= 300;
      if (scene.playerHp < scene.playerMaxHp) {
        const beforeHp = scene.playerHp || 0;
        scene.playerHp = Math.min((scene.playerHp || 0) + 2, scene.playerMaxHp ?? 0);
        const healed = scene.playerHp - beforeHp;
        if (scene.hpText) {
          scene.hpText.setText(`${scene.playerHp}/${scene.playerMaxHp}`);
        }
        if (healed > 0 && typeof scene.showHpHeal === "function") {
          scene.showHpHeal(healed);
        }
      }
    }
  }
}

export function update(scene, dt) {
  // 현재 활성화된 새 뱃지 효과는 프레임 기반 업데이트가 필요 없음.
}

export function updateRegenBadge(scene, dt) {
  if (!hasBadge(scene, "regen")) return;
  ensureState(scene);
  const elapsed = typeof scene.elapsedTime === "number" ? scene.elapsedTime : 0;
  const last = scene.regenLastHealTime ?? 0;
  if (elapsed - last < 60) return;
  scene.regenLastHealTime = last + 60;
  const hp = scene.playerHp ?? 0;
  const maxHp = scene.playerMaxHp ?? hp;
  if (hp >= maxHp) return;
  const healAmount = 2;
  scene.playerHp = Math.min(hp + healAmount, maxHp);
  if (scene.hpText) {
    scene.hpText.setText(`${scene.playerHp}/${scene.playerMaxHp}`);
  }
  if (typeof scene.showHpHeal === "function") {
    scene.showHpHeal(healAmount);
  }
}

export function getCellMaxBonus(scene) {
  let bonus = 0;
  if (hasBadge(scene, "cell_limit")) {
    bonus += 1;
  }
  if (hasBadge(scene, "cell_limit_plus")) {
    bonus += 2;
  }
  return bonus;
}

export function getMaxHpBonus(scene) {
  let bonus = 0;
  if (hasBadge(scene, "additional_heart_limit")) {
    bonus += 2;
  }
  if (hasBadge(scene, "extra_heart_limit_plus")) {
    bonus += 4;
  }
  return bonus;
}

// 필드 내 동시에 존재 가능한 프래그먼트 상자 최대 수 보너스
export function getMaxFragmentBonus(scene) {
  let bonus = 0;
  if (hasBadge(scene, "extra_fragments")) {
    bonus += 1;
  }
  return bonus;
}

// 플레이어 이동 속도 배율 (runner)
export function getPlayerSpeedMultiplier(scene) {
  let mul = 1.0;
  if (hasBadge(scene, "runner")) {
    mul *= 1.5;
  }
  return mul;
}

// 적 스폰 양/동시 적 수 배율 (I am Legend)
export function getEnemySpawnMultiplier(scene) {
  let mul = 1.0;
  if (hasBadge(scene, "i_am_legend")) {
    mul *= 1.5;
  }
  return mul;
}

// 프래그먼트 상자 스폰 간격 배율 (fragment hunter)
export function getFragmentSpawnIntervalMultiplier(scene) {
  let mul = 1.0;
  if (hasBadge(scene, "fragment_collector")) {
    mul *= 0.7; // 간격 30% 감소 → 더 자주 스폰
  }
  return mul;
}

// 플레이어 시각/충돌 크기 배율 (smaller)
export function getPlayerScaleMultiplier(scene) {
  let mul = 1.0;
  if (hasBadge(scene, "smaller")) {
    mul *= 0.85;
  }
   if (hasBadge(scene, "smaller_plus")) {
    mul *= 0.8;
  }
  return mul;
}

export function updatePlayerScaleFromBadges(scene) {
  if (!scene.player) return;
  const baseScale =
    typeof scene.playerBaseScale === "number" ? scene.playerBaseScale : 1;
  const scaleMul = getPlayerScaleMultiplier(scene) || 1;
  const finalScale = baseScale * scaleMul;
  scene.player.setScale(finalScale);

  if (scene.player.body && scene.player.body.setCircle) {
    const baseRadius = 16;
    const radius = baseRadius * scaleMul;
    if (USE_PIXEL_SPRITES) {
      const offset = 64 - radius;
      scene.player.body.setCircle(radius, offset, offset);
    } else {
      scene.player.body.setCircle(radius, 0, 0);
    }
  }
}

// 현재 장착된 뱃지를 기준으로 HP/탄환 최대 한도를 재계산하고,
// 이미 최대 한도를 초과한 값이 있다면 새 캡에 맞춰 잘라낸다.
// 의도: 뱃지 장착 시 현재 HP는 절대 회복하지 않음(캡 초과 시에만 상한으로 자름).
function recalcCapsFromBadges(scene) {
  ensureState(scene);

  // --- HP 캡 재계산 ---
  const baseHpCap = DEV_MODE ? DEV_MAX_CAP : PLAYER_MAX_HP_CAP ?? 10;
  const hpBonus = DEV_MODE ? 0 : getMaxHpBonus(scene);
  const hpCap = baseHpCap + hpBonus;

  // HUD 표시(cap)와 실제 최대 체력 동기화: 허용 상한(hpCap)으로 설정 (PLAYER_BASE_HP만 쓰면 max가 8로 남아 HP+2/비활성화 버그 발생)
  scene.playerMaxHp = hpCap;

  // 캡 초과 시에만 자름. 현재 HP를 올리거나 풀피로 채우지 않음.
  if (typeof scene.playerHp === "number" && scene.playerHp > hpCap) {
    scene.playerHp = hpCap;
  }

  // --- 탄환(Cells) 캡 재계산 ---
  const baseCellMax = DEV_MODE
    ? DEV_MAX_CAP
    : scene.cellMaxCount ?? CELL_MAX_COUNT;
  const cellBonus = DEV_MODE ? 0 : getCellMaxBonus(scene);
  const cellCap = baseCellMax + cellBonus;

  if (typeof scene.cellActiveCount === "number") {
    if (scene.cellActiveCount > cellCap) {
      scene.cellActiveCount = cellCap;
    }
  }
}
