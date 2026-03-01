/** HUD 생성 및 대시보드(HP/Cells/Attack/Badges/Kills) 갱신 */
import {
  DEV_MODE,
  DEV_MAX_CAP,
  PLAYER_MAX_HP_CAP,
  CELL_MAX_COUNT,
  ATTACK_UPGRADE_MAX,
  GAME_TIME_LIMIT_SEC,
} from "../config/constants.js";
import * as BadgeSystem from "./badgeSystem.js";
import { getNextBadgeSlotUnlockRemaining } from "../ui/badgeSlotsUi.js";
import { t } from "../i18n.js";

const fontStyle = { fontFamily: "Mulmaru", fontSize: "18px" };
const fontStyleSmall = { fontFamily: "Mulmaru", fontSize: "16px" };
const scoreFontStyle = { fontFamily: "Mulmaru", fontSize: "22px" };

/** 코인 등급별 색상 (동/은/금/다이아) */
const COIN_COLORS = {
  copper: "#be7846",
  silver: "#d2d4e1",
  gold: "#f0cd55",
  diamond: "#5ad2ff",
};

function getCoinColorForScore(score) {
  const v = Math.max(0, Math.floor(score || 0));
  if (v >= 100) return COIN_COLORS.diamond;
  if (v >= 50) return COIN_COLORS.gold;
  if (v >= 30) return COIN_COLORS.silver;
  return COIN_COLORS.copper;
}

/**
 * 점수 획득 시 '점수: 0000' 옆에 '+N' 짧은 애니메이션 표시
 * @param {Phaser.Scene} scene
 * @param {number} amount - 획득한 점수 (표시 및 코인 색상 결정에 사용)
 */
export function showScoreGain(scene, amount) {
  if (!scene || typeof amount !== "number" || amount <= 0) return;
  if (!scene.scoreLabelText || !scene.scoreValueText) return;

  const color = getCoinColorForScore(amount);
  const popup = scene.add
    .text(0, 0, `+${amount}`, {
      fontFamily: "Mulmaru",
      fontSize: "20px",
      fill: color,
    })
    .setScrollFactor(0)
    .setDepth(51);

  const x = scene.scoreValueText.x + scene.scoreValueText.width + 6;
  const y = scene.scoreValueText.y;
  popup.setPosition(x, y);

  scene.tweens.add({
    targets: popup,
    y: y - 24,
    alpha: 0,
    duration: 800,
    ease: "Power2.Out",
    onComplete: () => {
      if (popup && popup.destroy) popup.destroy();
    },
  });
}

export function createHud(scene) {
  const { width, height } = scene.scale;

  const bottomY = height - 32;
  scene.scoreLabelText = scene.add
    .text(16, bottomY, t("common.score") + ": ", { ...scoreFontStyle, fill: "#ffffff" })
    .setScrollFactor(0)
    .setDepth(50);
  scene.scoreValueText = scene.add
    .text(
      scene.scoreLabelText.x + scene.scoreLabelText.width,
      bottomY,
      "0",
      { ...scoreFontStyle, fill: "#4caf50" }
    )
    .setScrollFactor(0)
    .setDepth(50);
  scene.scoreText = scene.scoreValueText;

  const fragmentsY = bottomY - 26;
  scene.itemsLabelText = scene.add
    .text(16, fragmentsY, t("common.fragments") + ": ", {
      ...fontStyle,
      fontSize: "16px",
      fill: "#a5d6a7",
    })
    .setScrollFactor(0)
    .setDepth(50);
  scene.itemsValueText = scene.add
    .text(16 + scene.itemsLabelText.width, fragmentsY, "0/3", {
      ...fontStyle,
      fontSize: "16px",
      fill: "#a5d6a7",
    })
    .setScrollFactor(0)
    .setDepth(50);
  scene.itemsText = scene.itemsValueText;

  const panelWidth = 220;
  const panelX = width - panelWidth - 16;
  const panelY = 20;
  const panelLeft = panelX + 12;

  scene.buildPanelBg = scene.add
    .rectangle(
      panelX + panelWidth / 2,
      panelY + 64,
      panelWidth,
      128,
      0x000000,
      0.45
    )
    .setStrokeStyle(1, 0x4caf50, 0.9)
    .setScrollFactor(0)
    .setDepth(1);

  scene.hpLabelText = scene.add
    .text(panelLeft, panelY + 8, t("common.hp") + " ", {
      ...fontStyleSmall,
      fill: "#ffab91",
    })
    .setScrollFactor(0)
    .setDepth(2);
  scene.hpValueText = scene.add
    .text(panelLeft + scene.hpLabelText.width, panelY + 8, `${scene.playerHp ?? 0}/${scene.playerMaxHp ?? 10}`, {
      ...fontStyleSmall,
      fill: "#ffab91",
    })
    .setScrollFactor(0)
    .setDepth(2);
  scene.hpText = scene.hpValueText;

  scene.nextCellLabelText = scene.add
    .text(panelLeft, panelY + 28, t("common.cells") + ": ", {
      ...fontStyleSmall,
      fill: "#ffe082",
    })
    .setScrollFactor(0)
    .setDepth(2);
  scene.nextCellValueText = scene.add
    .text(panelLeft + scene.nextCellLabelText.width, panelY + 28, "2/16", {
      ...fontStyleSmall,
      fill: "#ffe082",
    })
    .setScrollFactor(0)
    .setDepth(2);
  scene.nextCellText = scene.nextCellValueText;

  scene.attackLabelText = scene.add
    .text(panelLeft, panelY + 48, t("common.attack") + ": ", {
      ...fontStyleSmall,
      fill: "#ffe082",
    })
    .setScrollFactor(0)
    .setDepth(2);
  scene.attackValueText = scene.add
    .text(panelLeft + scene.attackLabelText.width, panelY + 48, "+0", {
      ...fontStyleSmall,
      fill: "#ffe082",
    })
    .setScrollFactor(0)
    .setDepth(2);
  scene.attackUpgradeText = scene.attackValueText;

  scene.badgeLabelText = scene.add
    .text(panelLeft, panelY + 68, t("common.badges") + ": ", {
      ...fontStyleSmall,
      fill: "#ffe082",
    })
    .setScrollFactor(0)
    .setDepth(2);
  scene.badgeValueText = scene.add
    .text(panelLeft + scene.badgeLabelText.width, panelY + 68, "0/3", {
      ...fontStyleSmall,
      fill: "#ffe082",
    })
    .setScrollFactor(0)
    .setDepth(2);
  scene.badgeText = scene.badgeValueText;

  scene.killsLabelText = scene.add
    .text(panelLeft, panelY + 88, t("common.kills") + ": ", {
      ...fontStyleSmall,
      fill: "#ffe082",
    })
    .setScrollFactor(0)
    .setDepth(2);
  scene.killsValueText = scene.add
    .text(panelLeft + scene.killsLabelText.width, panelY + 88, "0", {
      ...fontStyleSmall,
      fill: "#ffe082",
    })
    .setScrollFactor(0)
    .setDepth(2);
  scene.killsText = scene.killsValueText;

  scene.timerText = scene.add
    .text(width / 2, 8, "30:00", {
      fontFamily: "Mulmaru",
      fontSize: "28px",
      fill: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    })
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setDepth(5);

  scene.badgeSlotUnlockTimerText = scene.add
    .text(width / 2, 42, "", {
      fontFamily: "Mulmaru",
      fontSize: "12px",
      fill: "#bdbdbd",
    })
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setDepth(5);
}

function playDashboardStatBounce(scene, textObj) {
  if (!scene.tweens || !textObj) return;
  const existing = scene.tweens.getTweensOf(textObj);
  if (existing.length) existing.forEach((t) => t.remove());
  textObj.setScale(1);
  scene.tweens.add({
    targets: textObj,
    scaleX: 1.25,
    scaleY: 1.25,
    yoyo: true,
    duration: 100,
    ease: "Quad.easeOut",
  });
}

function updateStatWithBounce(scene, key, textObj, newStr) {
  if (!scene._lastDashboard) scene._lastDashboard = {};
  if (scene._lastDashboard[key] !== newStr) {
    const isFirstSet = scene._lastDashboard[key] === undefined;
    scene._lastDashboard[key] = newStr;
    if (textObj) {
      textObj.setText(newStr);
      if (!isFirstSet) playDashboardStatBounce(scene, textObj);
    }
  }
}

export function updateDashboard(scene) {
  if (scene.hpValueText) {
    let hpValueStr = "";
    let hpColor = "#ffab91";
    if (DEV_MODE) {
      const cap = DEV_MAX_CAP;
      const hp = Math.min(scene.playerHp ?? 0, cap);
      hpValueStr = `${hp}/${cap}`;
      const ratio = cap > 0 ? hp / cap : 0;
      if (ratio >= 0.7) hpColor = "#81c784";
      else if (ratio < 0.3) hpColor = "#ef5350";
    } else {
      const baseCap = PLAYER_MAX_HP_CAP ?? 10;
      const hpBonus = BadgeSystem.getMaxHpBonus(scene);
      const cap = baseCap + hpBonus;
      const hp = scene.playerHp ?? 0;
      hpValueStr = `${hp}/${cap}`;
      const ratio = cap > 0 ? hp / cap : 0;
      if (ratio >= 0.7) hpColor = "#81c784";
      else if (ratio < 0.3) hpColor = "#ef5350";
    }
    if (scene.hpLabelText) scene.hpLabelText.setColor(hpColor);
    scene.hpValueText.setColor(hpColor);
    updateStatWithBounce(scene, "hp", scene.hpValueText, hpValueStr);
  }

  if (scene.items && scene.itemsValueText) {
    const count = scene.items ? scene.items.countActive(true) : 0;
    const maxF = DEV_MODE ? DEV_MAX_CAP : 3 + (BadgeSystem.getMaxFragmentBonus(scene) || 0);
    const fragmentsValueStr = `${count}/${maxF}`;
    updateStatWithBounce(scene, "fragments", scene.itemsValueText, fragmentsValueStr);
  }

  if (scene.nextCellValueText) {
    const n = scene.cellActiveCount ?? scene.cellBaseCount ?? 1;
    const maxC = DEV_MODE ? DEV_MAX_CAP : (scene.cellMaxCount ?? CELL_MAX_COUNT ?? 16) + (BadgeSystem.getCellMaxBonus(scene) || 0);
    const cellsValueStr = `${n}/${maxC}`;
    updateStatWithBounce(scene, "cells", scene.nextCellValueText, cellsValueStr);
  }

  if (scene.badgeValueText) {
    const equipped = BadgeSystem.getEquippedBadges(scene) || [];
    const equippedCount = equipped.filter((id) => !!id).length;
    const slotCount = scene.badgeSlotCount ?? 3;
    const badgesValueStr = `${equippedCount}/${slotCount}`;
    updateStatWithBounce(scene, "badges", scene.badgeValueText, badgesValueStr);
  }

  if (scene.attackValueText) {
    const n = scene.attackUpgradeCount ?? 0;
    const attackValueStr = `+${n}`;
    updateStatWithBounce(scene, "attack", scene.attackValueText, attackValueStr);
  }

  if (scene.killsValueText) {
    const killsValueStr = String(scene.killCount ?? 0);
    updateStatWithBounce(scene, "kills", scene.killsValueText, killsValueStr);
  }

  if (scene.badgeSlotUnlockTimerText) {
    const { remainingSeconds, allUnlocked } = getNextBadgeSlotUnlockRemaining(scene);
    if (allUnlocked) {
      scene.badgeSlotUnlockTimerText.setVisible(false);
    } else {
      const m = Math.floor(remainingSeconds / 60);
      const s = remainingSeconds % 60;
      const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      scene.badgeSlotUnlockTimerText.setText(t("common.nextBadgeSlotIn", { time: timeStr }));
      scene.badgeSlotUnlockTimerText.setVisible(true);
    }
  }
}

/** 오버레이용 대시보드 스탯 문자열 반환 (Kills 제외). 프래그먼트 오버레이 상단 스탯 바에 사용. HP 색상은 대시보드와 동일 비율 로직. */
export function getDashboardStatsForOverlay(scene) {
  if (!scene) return { hp: "", hpColor: "", cells: "", attack: "", badges: "" };

  let hp = "";
  let hpColor = "#ffab91";
  if (DEV_MODE) {
    const cap = DEV_MAX_CAP;
    const hpVal = Math.min(scene.playerHp ?? 0, cap);
    hp = `${t("common.hp")} ${hpVal} / ${cap}`;
    const ratio = cap > 0 ? hpVal / cap : 0;
    if (ratio >= 0.7) hpColor = "#81c784";
    else if (ratio < 0.3) hpColor = "#ef5350";
  } else {
    const baseCap = PLAYER_MAX_HP_CAP ?? 10;
    const hpBonus = BadgeSystem.getMaxHpBonus(scene);
    const cap = baseCap + hpBonus;
    const hpVal = scene.playerHp ?? 0;
    hp = `${t("common.hp")} ${hpVal} / ${cap}`;
    const ratio = cap > 0 ? hpVal / cap : 0;
    if (ratio >= 0.7) hpColor = "#81c784";
    else if (ratio < 0.3) hpColor = "#ef5350";
  }

  let cells = "";
  const nCell = scene.cellActiveCount ?? scene.cellBaseCount ?? 1;
  if (DEV_MODE) {
    cells = `${t("common.cells")}: ${nCell}/${DEV_MAX_CAP}`;
  } else {
    const baseMax = scene.cellMaxCount ?? CELL_MAX_COUNT ?? 16;
    const cellBonus = BadgeSystem.getCellMaxBonus(scene);
    const max = baseMax + cellBonus;
    cells = `${t("common.cells")}: ${nCell}/${max}`;
  }

  const nAttack = scene.attackUpgradeCount ?? 0;
  const attack = `${t("common.attack")}: +${nAttack}`;

  const equipped = BadgeSystem.getEquippedBadges(scene) || [];
  const equippedCount = equipped.filter((id) => !!id).length;
  const slotCount = scene.badgeSlotCount ?? 3;
  const badges = `${t("common.badges")}: ${equippedCount}/${slotCount}`;

  return { hp, hpColor, cells, attack, badges };
}
