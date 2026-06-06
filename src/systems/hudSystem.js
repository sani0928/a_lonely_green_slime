import {
  PLAYER_MAX_HP_CAP,
  CELL_MAX_COUNT,
  ATTACK_UPGRADE_MAX,
  CLEAR_TIME_SEC,
} from "../config/constants.js";
import * as BadgeSystem from "./badgeSystem.js";
import { getNextBadgeSlotUnlockRemaining, buildSortedSlots } from "../ui/badgeSlotsUi.js";
import { t } from "../i18n.js";

const fontStyle = { fontFamily: "Mulmaru", fontSize: "18px" };
const scoreFontStyle = { fontFamily: "Mulmaru", fontSize: "22px" };

const COIN_COLORS = {
  copper: "#be7846",
  silver: "#d2d4e1",
  gold: "#f0cd55",
  diamond: "#5ad2ff",
};

const HUD_COLORS = {
  panel: 0x050805,
  panelStroke: 0x46d278,
  divider: 0x214832,
  text: "#e8f5e9",
  dimText: "#7d8b82",
  hpSafe: 0x63d878,
  hpWarn: 0xffcf5a,
  hpDanger: 0xef5350,
  slotDark: 0x101812,
  slotStroke: 0x2b4533,
  cellActive: 0x4ce57c,
  cellInactive: 0x17251c,
  starActive: 0xffd95a,
  starInactive: 0x22271c,
  badgeEmpty: 0x1a201e,
  badgeLocked: 0x151515,
  badgeOpen: 0x3f4842,
  badgeNormal: 0xb8b8aa,
  badgeEpic: 0xce93d8,
  badgeUnique: 0xffd54f,
};

function getCoinColorForScore(score) {
  const v = Math.max(0, Math.floor(score || 0));
  if (v >= 100) return COIN_COLORS.diamond;
  if (v >= 50) return COIN_COLORS.gold;
  if (v >= 30) return COIN_COLORS.silver;
  return COIN_COLORS.copper;
}

function createCompatText(scene, text = "") {
  return scene.add
    .text(-9999, -9999, text, {
      fontFamily: "Mulmaru",
      fontSize: "1px",
      fill: "#000000",
    })
    .setScrollFactor(0)
    .setDepth(-100)
    .setVisible(false);
}

function colorToCss(color) {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function getHpColorByRatio(ratio) {
  if (ratio >= 0.7) return HUD_COLORS.hpSafe;
  if (ratio >= 0.3) return HUD_COLORS.hpWarn;
  return HUD_COLORS.hpDanger;
}

function getBadgeColor(rarity) {
  if (rarity === "unique") return HUD_COLORS.badgeUnique;
  if (rarity === "epic") return HUD_COLORS.badgeEpic;
  return HUD_COLORS.badgeNormal;
}

function drawPixelRect(g, x, y, w, h, fill, stroke = HUD_COLORS.slotStroke, strokeAlpha = 1) {
  g.fillStyle(fill, 1);
  g.fillRect(x, y, w, h);
  g.lineStyle(2, stroke, strokeAlpha);
  g.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawCellSlot(g, x, y, size, active) {
  const fill = active ? HUD_COLORS.cellActive : HUD_COLORS.cellInactive;
  const stroke = active ? 0xb9ffd0 : HUD_COLORS.slotStroke;
  g.fillStyle(fill, active ? 0.95 : 0.85);
  g.fillCircle(x + size / 2, y + size / 2, size / 2);
  g.lineStyle(2, stroke, active ? 0.9 : 0.75);
  g.strokeCircle(x + size / 2, y + size / 2, size / 2 - 1);
  if (active) {
    g.fillStyle(0xd9ffe4, 0.9);
    g.fillCircle(x + size * 0.34, y + size * 0.34, Math.max(1, size * 0.12));
  }
}

function drawBadgeSlot(g, x, y, size, state) {
  const locked = state.locked;
  const rarity = state.rarity;
  const soon = state.soon;
  const pulseOn = state.pulseOn;
  const fill = locked
    ? soon && pulseOn
      ? HUD_COLORS.badgeOpen
      : HUD_COLORS.badgeLocked
    : rarity
      ? getBadgeColor(rarity)
      : HUD_COLORS.badgeOpen;
  const stroke = locked
    ? soon
      ? (pulseOn ? 0x8d9a90 : 0x333333)
      : 0x333333
    : rarity
      ? getBadgeColor(rarity)
      : 0x8d9a90;

  g.fillStyle(fill, 1);
  g.fillRect(x, y, size, size);
  g.lineStyle(2, stroke, locked ? (soon ? 1 : 0.8) : 1);
  g.strokeRect(x + 1, y + 1, size - 2, size - 2);

  if (rarity) {
    g.fillStyle(0xffffff, 0.28);
    g.fillRect(x + 4, y + 4, Math.max(3, size * 0.22), 3);
  } else if (!locked) {
    g.fillStyle(0xc9d6cc, 0.32);
    g.fillRect(x + 3, y + 3, Math.max(2, size - 6), Math.max(2, size - 6));
  } else if (locked) {
    g.fillStyle(0x111111, 0.7);
    g.fillRect(x + size * 0.38, y + size * 0.38, size * 0.24, size * 0.24);
    if (soon && pulseOn) {
      g.fillStyle(0xc9d6cc, 0.35);
      g.fillRect(x + 3, y + 3, Math.max(2, size - 6), 2);
    }
  }
}

function drawStatsHud(scene) {
  if (!scene.statsHudGraphics || !scene._statsHudLayout) return;

  const g = scene.statsHudGraphics;
  const layout = scene._statsHudLayout;
  const w = layout.width;
  const h = layout.height;
  const pad = 10;

  const hpBonus = BadgeSystem.getMaxHpBonus(scene);
  const hpMax = Math.max(1, (PLAYER_MAX_HP_CAP ?? 10) + hpBonus);
  const hp = Phaser.Math.Clamp(scene.playerHp ?? 0, 0, hpMax);
  const hpRatio = Phaser.Math.Clamp(hp / hpMax, 0, 1);
  const hpColor = getHpColorByRatio(hpRatio);

  const cellCount = Math.max(0, scene.cellActiveCount ?? scene.cellBaseCount ?? 1);
  const cellMax = Math.max(1, (scene.cellMaxCount ?? CELL_MAX_COUNT) + (BadgeSystem.getCellMaxBonus(scene) || 0));
  const attackCount = Phaser.Math.Clamp(scene.attackUpgradeCount ?? 0, 0, ATTACK_UPGRADE_MAX);
  const badgeSlots = buildSortedSlots(scene);
  const { remainingSeconds, allUnlocked } = getNextBadgeSlotUnlockRemaining(scene);
  const isSlotUnlockSoon = !allUnlocked && remainingSeconds <= 10;
  const pulseOn = isSlotUnlockSoon && Math.floor(((scene.time && scene.time.now) || 0) / 250) % 2 === 0;

  g.clear();

  g.fillStyle(HUD_COLORS.panel, 0.96);
  g.fillRect(0, 0, w, h);
  g.lineStyle(1, HUD_COLORS.panelStroke, 0.55);
  g.strokeRect(0.5, 0.5, w - 1, h - 1);

  const labels = scene.statsHudLabels || {};
  if (labels.hp) labels.hp.setPosition(pad, 8);
  if (labels.hpValue) {
    labels.hpValue
      .setText(`${hp}/${hpMax}`)
      .setColor(colorToCss(hpColor))
      .setPosition(pad + 28, 8);
  }
  const hpBarX = pad;
  const hpBarY = 30;
  const hpBarW = 104;
  const hpBarH = 11;
  drawPixelRect(g, hpBarX, hpBarY, hpBarW, hpBarH, 0x131a15, HUD_COLORS.slotStroke, 0.9);
  g.fillStyle(hpColor, 1);
  g.fillRect(hpBarX + 3, hpBarY + 3, Math.max(0, (hpBarW - 6) * hpRatio), hpBarH - 6);

  const cellX = 148;
  const cellY = 30;
  if (labels.cells) labels.cells.setPosition(cellX, 8);
  const cellSlotSize = Phaser.Math.Clamp(Math.floor(76 / Math.max(1, cellMax)), 6, 10);
  const cellStartX = cellX;
  for (let i = 0; i < cellMax; i += 1) {
    drawCellSlot(g, cellStartX + i * (cellSlotSize + 2), cellY, cellSlotSize, i < cellCount);
  }

  const attackX = 256;
  if (labels.attack) labels.attack.setPosition(attackX, 8);
  if (labels.attackValue) {
    labels.attackValue
      .setText(`+${attackCount}`)
      .setColor("#ffd95a")
      .setPosition(attackX + 34, 8);
  }
  const attackBarX = attackX;
  const attackBarY = 30;
  const attackBarW = 112;
  const attackBarH = 11;
  const attackRatio = Phaser.Math.Clamp(attackCount / Math.max(1, ATTACK_UPGRADE_MAX), 0, 1);
  drawPixelRect(g, attackBarX, attackBarY, attackBarW, attackBarH, 0x17160e, 0x5d4b18, 0.95);
  g.fillStyle(HUD_COLORS.starActive, 1);
  g.fillRect(attackBarX + 3, attackBarY + 3, Math.max(0, (attackBarW - 6) * attackRatio), attackBarH - 6);
  scene.attackStars = [];

  const badgeX = 398;
  const badgeY = 28;
  if (labels.badges) labels.badges.setPosition(badgeX, 8);

  const badgeSize = Phaser.Math.Clamp(Math.floor(72 / Math.max(1, badgeSlots.length)), 7, 9);
  const badgeGap = 2;
  const badgeStartX = badgeX;
  scene.badgeSlotIcons = [];
  badgeSlots.forEach((slot, i) => {
    const state = {
      locked: !!slot.locked,
      rarity: !slot.locked && slot.def ? slot.def.rarity || "normal" : null,
      soon: !!slot.locked && isSlotUnlockSoon,
      pulseOn,
    };
    const x = badgeStartX + i * (badgeSize + badgeGap);
    drawBadgeSlot(g, x, badgeY, badgeSize, state);
    scene.badgeSlotIcons.push({ x, y: badgeY, ...state });
  });

  if (scene.badgeSlotUnlockTimerText) {
    if (allUnlocked) {
      scene.badgeSlotUnlockTimerText.setText("MAX").setColor("#81c784");
    } else {
      const m = Math.floor(remainingSeconds / 60);
      const s = remainingSeconds % 60;
      scene.badgeSlotUnlockTimerText
        .setText(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`)
        .setColor(isSlotUnlockSoon ? (pulseOn ? "#c9d6cc" : "#6f7a72") : "#bdbdbd");
    }
    scene.badgeSlotUnlockTimerText.setPosition(badgeX + 52, 8);
  }
}

function getStatsHudSnapshot(scene) {
  const hpBonus = BadgeSystem.getMaxHpBonus(scene);
  const hpMax = Math.max(1, (PLAYER_MAX_HP_CAP ?? 10) + hpBonus);
  const cellMax = Math.max(1, (scene.cellMaxCount ?? CELL_MAX_COUNT) + (BadgeSystem.getCellMaxBonus(scene) || 0));
  const badgeSlots = buildSortedSlots(scene).map((slot) => ({
    locked: !!slot.locked,
    badgeId: slot.badgeId || null,
    rarity: slot.def ? slot.def.rarity || "normal" : null,
    empty: !!slot.empty,
  }));
  const slotInfo = getNextBadgeSlotUnlockRemaining(scene);
  const remainingBucket = slotInfo.allUnlocked ? "max" : String(slotInfo.remainingSeconds);
  const pulseBucket =
    !slotInfo.allUnlocked && slotInfo.remainingSeconds <= 10
      ? String(Math.floor(((scene.time && scene.time.now) || 0) / 250) % 2)
      : "";
  return JSON.stringify({
    hp: scene.playerHp ?? 0,
    hpMax,
    cells: scene.cellActiveCount ?? scene.cellBaseCount ?? 1,
    cellMax,
    attack: scene.attackUpgradeCount ?? 0,
    slots: scene.badgeSlotCount ?? 3,
    badgeSlots,
    timer: remainingBucket,
    pulse: pulseBucket,
    width: scene._statsHudLayout ? scene._statsHudLayout.width : 0,
  });
}

function redrawStatsHudIfNeeded(scene, force = false) {
  if (!scene || !scene.statsHudGraphics) return;
  const snapshot = getStatsHudSnapshot(scene);
  if (!force && scene._lastStatsHudSnapshot === snapshot) return;
  scene._lastStatsHudSnapshot = snapshot;
  drawStatsHud(scene);
}

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

  scene.scoreLabelText = scene.add
    .text(16, height - 32, t("common.score") + ": ", { ...scoreFontStyle, fill: "#ffffff" })
    .setScrollFactor(0)
    .setDepth(50);
  scene.scoreValueText = scene.add
    .text(scene.scoreLabelText.x + scene.scoreLabelText.width, height - 32, "0", {
      ...scoreFontStyle,
      fill: "#4caf50",
    })
    .setScrollFactor(0)
    .setDepth(50);
  scene.scoreText = scene.scoreValueText;

  scene.itemsLabelText = scene.add
    .text(16, height - 58, t("common.fragments") + ": ", {
      ...fontStyle,
      fontSize: "16px",
      fill: "#a5d6a7",
    })
    .setScrollFactor(0)
    .setDepth(50);
  scene.itemsValueText = scene.add
    .text(16 + scene.itemsLabelText.width, height - 58, "0/3", {
      ...fontStyle,
      fontSize: "16px",
      fill: "#a5d6a7",
    })
    .setScrollFactor(0)
    .setDepth(50);
  scene.itemsText = scene.itemsValueText;

  scene.statsHudContainer = scene.add.container(0, 0).setScrollFactor(0).setDepth(50);
  scene.statsHudGraphics = scene.add.graphics();
  scene.hpBarGraphics = scene.statsHudGraphics;
  scene.cellBarGraphics = scene.statsHudGraphics;
  scene.attackGraphics = scene.statsHudGraphics;
  scene.badgeSlotGraphics = scene.statsHudGraphics;
  scene.statsHudContainer.add(scene.statsHudGraphics);

  scene.statsHudLabels = {
    hp: scene.add.text(0, 0, "HP", {
      fontFamily: "Mulmaru",
      fontSize: "12px",
      fill: HUD_COLORS.text,
    }),
    hpValue: scene.add.text(0, 0, "0/0", {
      fontFamily: "Mulmaru",
      fontSize: "12px",
      fill: "#81c784",
    }),
    cells: scene.add.text(0, 0, "CELL", {
      fontFamily: "Mulmaru",
      fontSize: "11px",
      fill: "#a5d6a7",
    }),
    attack: scene.add.text(0, 0, "ATK", {
      fontFamily: "Mulmaru",
      fontSize: "12px",
      fill: "#ffe082",
    }),
    attackValue: scene.add.text(0, 0, "+0", {
      fontFamily: "Mulmaru",
      fontSize: "12px",
      fill: "#ffd95a",
    }),
    badges: scene.add.text(0, 0, "BADGE", {
      fontFamily: "Mulmaru",
      fontSize: "11px",
      fill: "#ce93d8",
    }),
  };
  Object.values(scene.statsHudLabels).forEach((label) => scene.statsHudContainer.add(label));

  scene.badgeSlotUnlockTimerText = scene.add
    .text(0, 0, "00:00", {
      fontFamily: "Mulmaru",
      fontSize: "12px",
      fill: "#bdbdbd",
      stroke: "#000000",
      strokeThickness: 2,
    })
    .setScrollFactor(0)
    .setDepth(51);
  scene.statsHudContainer.add(scene.badgeSlotUnlockTimerText);

  scene.killCounterText = scene.add
    .text(width - 16, 20, "KILL 0", {
      fontFamily: "Mulmaru",
      fontSize: "18px",
      fill: "#ffe082",
      stroke: "#000000",
      strokeThickness: 4,
    })
    .setOrigin(1, 0)
    .setScrollFactor(0)
    .setDepth(50);

  scene.hpLabelText = createCompatText(scene, t("common.hp"));
  scene.hpValueText = createCompatText(scene, `${scene.playerHp ?? 0}/${scene.playerMaxHp ?? 10}`);
  scene.hpText = scene.hpValueText;
  scene.nextCellLabelText = createCompatText(scene, t("common.cells"));
  scene.nextCellValueText = createCompatText(scene, `2/${CELL_MAX_COUNT}`);
  scene.nextCellText = scene.nextCellValueText;
  scene.attackLabelText = createCompatText(scene, t("common.attack"));
  scene.attackValueText = createCompatText(scene, "+0");
  scene.attackUpgradeText = scene.attackValueText;
  scene.badgeLabelText = createCompatText(scene, t("common.badges"));
  scene.badgeValueText = createCompatText(scene, "0/3");
  scene.badgeText = scene.badgeValueText;
  scene.killsLabelText = createCompatText(scene, t("common.kills"));
  scene.killsValueText = createCompatText(scene, "0");
  scene.killsText = scene.killsValueText;

  scene.timerText = scene.add
    .text(width / 2, 8, "00:00", {
      fontFamily: "Mulmaru",
      fontSize: "28px",
      fill: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    })
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setDepth(5);

  scene.objectiveText = scene.add
    .text(width / 2, 42, "", {
      fontFamily: "Mulmaru",
      fontSize: "13px",
      fill: "#cfd8dc",
      stroke: "#000000",
      strokeThickness: 3,
    })
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setDepth(5);

  relayoutHud(scene);
}

export function relayoutHud(scene) {
  if (!scene || !scene.scale) return;
  const { width, height } = scene.scale;

  const hudWidth = Math.min(520, Math.max(360, width - 32));
  const hudHeight = 54;
  const hudX = Math.floor((width - hudWidth) / 2);
  const hudY = Math.floor(height - hudHeight - 14);
  scene._statsHudLayout = { x: hudX, y: hudY, width: hudWidth, height: hudHeight };

  if (scene.statsHudContainer) {
    scene.statsHudContainer.setPosition(hudX, hudY);
  }

  const overlapLeftHud = width < 900;
  const bottomY = overlapLeftHud ? hudY - 36 : height - 32;
  const fragmentsY = overlapLeftHud ? hudY - 62 : height - 58;

  if (scene._fragmentCapWarningTween) {
    scene._fragmentCapWarningTween.remove();
    scene._fragmentCapWarningTween = null;
  }
  scene._fragmentCapWarningActive = false;

  if (scene.scoreLabelText) {
    scene.scoreLabelText.setPosition(16, bottomY);
  }
  if (scene.scoreValueText) {
    const scoreX = scene.scoreLabelText
      ? scene.scoreLabelText.x + scene.scoreLabelText.width
      : 16;
    scene.scoreValueText.setPosition(scoreX, bottomY);
  }

  if (scene.itemsLabelText) {
    scene.itemsLabelText.setPosition(16, fragmentsY);
    scene.itemsLabelText.setScale(1);
    scene.itemsLabelText.setAngle(0);
    scene.itemsLabelText.setColor("#a5d6a7");
    scene.itemsLabelText.setData("fragmentWarningBaseX", scene.itemsLabelText.x);
    scene.itemsLabelText.setData("fragmentWarningBaseY", scene.itemsLabelText.y);
  }
  if (scene.itemsValueText) {
    const itemsX = scene.itemsLabelText
      ? scene.itemsLabelText.x + scene.itemsLabelText.width
      : 16;
    scene.itemsValueText.setPosition(itemsX, fragmentsY);
    scene.itemsValueText.setScale(1);
    scene.itemsValueText.setAngle(0);
    scene.itemsValueText.setColor("#a5d6a7");
    scene.itemsValueText.setData("fragmentWarningBaseX", scene.itemsValueText.x);
    scene.itemsValueText.setData("fragmentWarningBaseY", scene.itemsValueText.y);
  }

  if (scene.killCounterText) {
    scene.killCounterText.setPosition(width - 16, 20);
  }
  if (scene.timerText) scene.timerText.setPosition(width / 2, 8);
  if (scene.objectiveText) scene.objectiveText.setPosition(width / 2, 42);

  scene._lastStatsHudSnapshot = null;
  redrawStatsHudIfNeeded(scene, true);
}

function playDashboardStatBounce(scene, textObj) {
  if (!scene.tweens || !textObj || !textObj.visible) return;
  const existing = scene.tweens.getTweensOf(textObj);
  if (existing.length) existing.forEach((tween) => tween.remove());
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

function updateFragmentCapWarning(scene, isFull) {
  const targets = [scene.itemsLabelText, scene.itemsValueText].filter(Boolean);
  if (!scene.tweens || targets.length === 0) return;

  if (isFull) {
    if (scene._fragmentCapWarningActive) return;
    scene._fragmentCapWarningActive = true;

    targets.forEach((target) => {
      target.setData("fragmentWarningBaseX", target.x);
      target.setData("fragmentWarningBaseY", target.y);
      target.setColor("#ffcc80");
    });

    scene._fragmentCapWarningTween = scene.tweens.add({
      targets,
      x: "+=4",
      y: "-=1",
      angle: { from: -1.5, to: 1.5 },
      scaleX: 1.08,
      scaleY: 0.94,
      duration: 70,
      ease: "Back.easeInOut",
      yoyo: true,
      repeat: 3,
      repeatDelay: 18,
      loop: -1,
      loopDelay: 520,
    });
    return;
  }

  if (!scene._fragmentCapWarningActive) return;
  scene._fragmentCapWarningActive = false;

  if (scene._fragmentCapWarningTween) {
    scene._fragmentCapWarningTween.remove();
    scene._fragmentCapWarningTween = null;
  }

  targets.forEach((target) => {
    const baseX = target.getData && target.getData("fragmentWarningBaseX");
    const baseY = target.getData && target.getData("fragmentWarningBaseY");
    if (typeof baseX === "number") target.setX(baseX);
    if (typeof baseY === "number") target.setY(baseY);
    target.setScale(1);
    target.setAngle(0);
    target.setColor("#a5d6a7");
  });
}

export function updateDashboard(scene) {
  if (scene.objectiveText) {
    const elapsed = Math.max(0, Math.floor(scene.elapsedTime || 0));
    if (elapsed >= CLEAR_TIME_SEC || scene.isClearAchieved) {
      scene.objectiveText.setText(t("common.endlessObjective"));
      scene.objectiveText.setFill("#66bb6a");
    } else {
      const remaining = Math.max(0, Math.floor(CLEAR_TIME_SEC - elapsed));
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      scene.objectiveText.setText(t("common.clearObjectiveIn", { time: timeStr }));
      scene.objectiveText.setFill("#cfd8dc");
    }
  }

  const hpBonus = BadgeSystem.getMaxHpBonus(scene);
  const hpCap = Math.max(1, (PLAYER_MAX_HP_CAP ?? 10) + hpBonus);
  const hp = scene.playerHp ?? 0;
  updateStatWithBounce(scene, "hp", scene.hpValueText, `${hp}/${hpCap}`);

  if (scene.items && scene.itemsValueText) {
    let count = 0;
    scene.items.children.iterate((item) => {
      if (!item || !item.active) return;
      if (item.getData && item.getData("isFragment")) count += 1;
    });
    const maxF = 3 + (BadgeSystem.getMaxFragmentBonus(scene) || 0);
    updateStatWithBounce(scene, "fragments", scene.itemsValueText, `${count}/${maxF}`);
    updateFragmentCapWarning(scene, count >= maxF && maxF > 0);
  } else {
    updateFragmentCapWarning(scene, false);
  }

  const cellCount = scene.cellActiveCount ?? scene.cellBaseCount ?? 1;
  const cellMax = (scene.cellMaxCount ?? CELL_MAX_COUNT) + (BadgeSystem.getCellMaxBonus(scene) || 0);
  updateStatWithBounce(scene, "cells", scene.nextCellValueText, `${cellCount}/${cellMax}`);

  const equipped = BadgeSystem.getEquippedBadges(scene) || [];
  const equippedCount = equipped.filter((id) => !!id).length;
  const slotCount = scene.badgeSlotCount ?? 3;
  updateStatWithBounce(scene, "badges", scene.badgeValueText, `${equippedCount}/${slotCount}`);

  const attackCount = scene.attackUpgradeCount ?? 0;
  updateStatWithBounce(scene, "attack", scene.attackValueText, `+${attackCount}`);

  const killsValueStr = String(scene.killCount ?? 0);
  updateStatWithBounce(scene, "kills", scene.killsValueText, killsValueStr);
  if (scene.killCounterText) {
    scene.killCounterText.setText(`KILL ${killsValueStr}`);
  }

  redrawStatsHudIfNeeded(scene);
}

export function getDashboardStatsForOverlay(scene) {
  if (!scene) return { hp: "", hpColor: "", cells: "", attack: "", badges: "" };

  let hpColor = "#ffab91";
  const baseCap = PLAYER_MAX_HP_CAP ?? 10;
  const hpBonus = BadgeSystem.getMaxHpBonus(scene);
  const cap = baseCap + hpBonus;
  const hpVal = scene.playerHp ?? 0;
  const hp = `${t("common.hp")} ${hpVal} / ${cap}`;
  const ratio = cap > 0 ? hpVal / cap : 0;
  if (ratio >= 0.7) hpColor = "#81c784";
  else if (ratio < 0.3) hpColor = "#ef5350";

  const nCell = scene.cellActiveCount ?? scene.cellBaseCount ?? 1;
  const baseMax = scene.cellMaxCount ?? CELL_MAX_COUNT;
  const cellBonus = BadgeSystem.getCellMaxBonus(scene);
  const max = baseMax + cellBonus;
  const cells = `${t("common.cells")}: ${nCell}/${max}`;

  const nAttack = scene.attackUpgradeCount ?? 0;
  const attack = `${t("common.attack")}: +${nAttack}`;

  const equipped = BadgeSystem.getEquippedBadges(scene) || [];
  const equippedCount = equipped.filter((id) => !!id).length;
  const slotCount = scene.badgeSlotCount ?? 3;
  const badges = `${t("common.badges")}: ${equippedCount}/${slotCount}`;

  return { hp, hpColor, cells, attack, badges };
}
