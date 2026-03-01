/** 뱃지 슬롯 렌더링·다음 슬롯 해금 남은 시간 */
import { BADGES } from "../badges/badgeDefinitions.js";
import { t, formatBold } from "../i18n.js";

const RARITY_ORDER = { normal: 0, epic: 1, unique: 2 };
const BASE_BADGE_SLOTS = 3;
const MAX_BADGE_SLOTS = 8;
const SLOT_UNLOCK_INTERVAL_SEC = 5 * 60; // 5분마다 +1

/**
 * 다음 뱃지 슬롯 개방까지 남은 시간(초). HUD 타이머·슬롯 UI 잠금 표시 공용.
 * @param {object} scene - scene.badgeSlotCount, scene.badgeSlotMax, scene.elapsedTime
 * @returns {{ remainingSeconds: number, allUnlocked: boolean }}
 */
export function getNextBadgeSlotUnlockRemaining(scene) {
  const slotMax = (scene && scene.badgeSlotMax) ?? MAX_BADGE_SLOTS;
  const slotCount = (scene && typeof scene.badgeSlotCount === "number"
    ? scene.badgeSlotCount
    : BASE_BADGE_SLOTS) | 0;
  if (slotCount >= slotMax) {
    return { remainingSeconds: 0, allUnlocked: true };
  }
  const elapsed = (scene && typeof scene.elapsedTime === "number") ? scene.elapsedTime : 0;
  const nextSlotNumber = slotCount + 1;
  const unlockAtSeconds = (nextSlotNumber - BASE_BADGE_SLOTS) * SLOT_UNLOCK_INTERVAL_SEC;
  const remaining = Math.max(0, Math.floor(unlockAtSeconds - elapsed));
  return { remainingSeconds: remaining, allUnlocked: false };
}

/**
 * Build sorted slot list:
 *  - 실제 사용 가능한 슬롯 수(scene.badgeSlotCount)만큼은 장착/빈 슬롯을 등급/획득순으로 정렬
 *  - 그 뒤에 "개방 예정 슬롯"을 최대 1개 추가 (잠금 상태, 클릭 불가)
 * @param {object} scene - scene.badgeSlotCount, scene.badgesEquipped, scene.elapsedTime
 * @returns {{ slotIndex: number, badgeId?: string, def?: object, empty?: boolean, locked?: boolean, unlockInSeconds?: number }[]}
 */
export function buildSortedSlots(scene) {
  const rawCount = (scene && typeof scene.badgeSlotCount === "number"
    ? scene.badgeSlotCount
    : BASE_BADGE_SLOTS) | 0;
  const slotCount = Math.max(0, Math.min(rawCount, MAX_BADGE_SLOTS));

  const equipped = (scene && scene.badgesEquipped) || [];
  const filled = [];
  const empty = [];

  for (let i = 0; i < slotCount; i += 1) {
    const badgeId = equipped[i];
    const def = badgeId ? BADGES.find((b) => b.id === badgeId) || null : null;
    if (def) {
      filled.push({ slotIndex: i, badgeId, def });
    } else {
      empty.push({ slotIndex: i, empty: true });
    }
  }

  filled.sort((a, b) => {
    const ra = RARITY_ORDER[a.def.rarity] ?? 0;
    const rb = RARITY_ORDER[b.def.rarity] ?? 0;
    if (ra !== rb) return ra - rb;
    return a.slotIndex - b.slotIndex;
  });
  empty.sort((a, b) => a.slotIndex - b.slotIndex);

  const result = [...filled, ...empty];

  // "개방 예정" 잠금 슬롯은 최대 1개만 표시
  if (slotCount < MAX_BADGE_SLOTS) {
    const { remainingSeconds } = getNextBadgeSlotUnlockRemaining(scene);
    result.push({
      slotIndex: slotCount,
      locked: true,
      unlockInSeconds: remainingSeconds,
    });
  }

  return result;
}

/**
 * Render badge slots into a container. Pixel-art cards: name (rarity color) + description.
 * @param {HTMLElement} container - parent element (e.g. #upgrade-badge-slots or #pause-badge-slots)
 * @param {object} scene - scene.badgeSlotCount, scene.badgesEquipped
 * @param {object} options
 * @param {'display'|'acquisition'|'replace'|'unified'} options.mode
 * @param {object} [options.newBadge] - for acquisition/replace context
 * @param {(slotIndex: number) => void} [options.onSlotClick]
 * @param {() => void} [options.onSkip]
 */
export function renderBadgeSlots(container, scene, options = {}) {
  const { mode = "display", newBadge, onSlotClick } = options;
  if (!container) return;

  container.innerHTML = "";
  const slots = buildSortedSlots(scene);

  const wrap = document.createElement("div");
  wrap.className = "badge-slots-wrap";

  slots.forEach((item) => {
    const card = document.createElement("div");
    card.className = "badge-slot-card";
    card.dataset.slotIndex = String(item.slotIndex);

    const nameEl = document.createElement("div");
    nameEl.className = "badge-slot-name";
    const descEl = document.createElement("div");
    descEl.className = "badge-slot-desc";

    if (item.locked) {
      card.classList.add("locked");
      nameEl.textContent = t("common.lockedSlot");
      const seconds = Math.max(
        0,
        typeof item.unlockInSeconds === "number" ? Math.floor(item.unlockInSeconds) : 0
      );
      const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
      const ss = String(seconds % 60).padStart(2, "0");
      descEl.textContent = t("upgrade.openAfter", { time: `${mm}:${ss}` });
    } else if (item.empty) {
      card.classList.add("empty");
      nameEl.textContent = t("common.emptySlot");
      descEl.textContent =
        mode === "acquisition" || mode === "unified" ? t("upgrade.clickToEquip") : "";
      if (mode === "acquisition" || mode === "unified") {
        card.classList.add("clickable");
        card.setAttribute("tabindex", "0");
        card.setAttribute("role", "button");
      }
    } else {
      const rarity = item.def.rarity || "normal";
      nameEl.textContent = t(`badge.${item.def.id}.name`);
      nameEl.classList.add(`badge-rarity-${rarity}`);
      card.classList.add(`badge-slot-border-${rarity}`);
      descEl.innerHTML = formatBold(t(`badge.${item.def.id}.description`) || "");
      if (mode === "replace" || mode === "unified") {
        card.classList.add("clickable");
        card.setAttribute("tabindex", "0");
        card.setAttribute("role", "button");
      }
    }

    card.appendChild(nameEl);
    card.appendChild(descEl);

    const isClickable =
      !item.locked &&
      (mode === "unified" ||
      (mode === "acquisition" && item.empty) ||
      (mode === "replace" && !item.empty));
    if (isClickable && typeof onSlotClick === "function") {
      card.addEventListener("click", () => onSlotClick(item.slotIndex));
    }

    wrap.appendChild(card);
  });

  container.appendChild(wrap);
}
