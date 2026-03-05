import {
  ITEM_SPAWN_MARGIN,
  ATTACK_UPGRADE_MAX,
  ATTACK_UPGRADE_AMOUNTS,
  PLAYER_BASE_ATTACK,
  PLAYER_MAX_HP_CAP,
  CELL_MAX_COUNT,
  ENEMY_TYPES,
  DEV_MODE,
  USE_PIXEL_SPRITES,
} from "../config/constants.js";
import { getSfxAttackKey } from "../i18n.js";
import * as CellSystem from "./cellSystem.js";
import { applyDamage } from "./enemySystem.js";
import { pauseInvincibility, resumeInvincibility } from "./playerSystem.js";
import {
  onEnemyHit,
  modifyKillScore,
  onEnemyKilled,
  equipBadgeAtSlot,
  rollBadgeDraw,
  getEquippedBadges,
  getEquippedBadgeNames,
  getCellMaxBonus,
  getMaxHpBonus,
  getMaxFragmentBonus,
  getFragmentSpawnIntervalMultiplier,
  hasBadge,
} from "./badgeSystem.js";
import { showScoreGain } from "./hudSystem.js";
import { BADGES } from "../badges/badgeDefinitions.js";
import { t } from "../i18n.js";

/** Skip reward score when skipping a badge draw result, by rarity. */
const SKIP_SCORE_BY_RARITY = { normal: 500, epic: 1000, unique: 3000 };

function getSkipScoreForBadge(badge) {
  const r = badge && badge.rarity ? badge.rarity : "normal";
  return SKIP_SCORE_BY_RARITY[r] ?? SKIP_SCORE_BY_RARITY.normal;
}

export function spawnUpgradeItem(scene) {
  if (!scene.worldWidth || !scene.worldHeight) return false;

  const baseMaxActive = 3;
  const maxActive = baseMaxActive + getMaxFragmentBonus(scene);
  if (scene.items && scene.items.countActive(true) >= maxActive) {
    return false;
  }

  const margin = ITEM_SPAWN_MARGIN;
  const x = Phaser.Math.Between(margin, scene.worldWidth - margin);
  const y = Phaser.Math.Between(margin, scene.worldHeight - margin);

  let item;

  if (
    USE_PIXEL_SPRITES &&
    scene.textures &&
    scene.textures.exists("fragments")
  ) {
    item = scene.items.create(x, y, "fragments", 0);

    if (
      item.anims &&
      scene.anims &&
      typeof scene.anims.exists === "function" &&
      scene.anims.exists("fragment_idle")
    ) {
      item.play("fragment_idle");
    }

    if (item.setScale) {
      item.setScale(0.55);
    }

    if (item.body) {
      if (item.body.setAllowGravity) {
        item.body.setAllowGravity(false);
      }
      if (item.body.setCircle) {
        const radius = 28;
        const offset = 64 - radius;
        item.body.setCircle(radius, offset, offset);
      }
    }
  } else {
    item = scene.items.create(x, y, "bullet");
    if (item.setScale) {
      item.setScale(1.4);
    }
    if (item.setTint) {
      item.setTint(0x81c784);
    }
    if (item.body) {
      if (item.body.setAllowGravity) {
        item.body.setAllowGravity(false);
      }
      if (item.setCircle) {
        item.setCircle(4);
      }
    }
  }

  if (item && item.setDepth) {
    item.setDepth(10);
  }

  if (item && item.setData) {
    item.setData("isFragment", true);
  }

  if (scene.sound && scene.sound.play) {
    scene.sound.play("sfx_alert", { volume: 0.7 });
  }

  const centerX = scene.scale ? scene.scale.width / 2 : 400;
  const notif = scene.add
    .text(centerX, 72, t("upgrade.newFragmentAppeared"), {
      fontFamily: "Mulmaru",
      fontSize: "22px",
      fill: "#ffe082",
    })
    .setScrollFactor(0)
    .setOrigin(0.5, 0)
    .setDepth(20)
    .setAlpha(0);
  scene.tweens.add({ targets: notif, alpha: 1, duration: 350 });
  scene.time.delayedCall(2400, () => {
    scene.tweens.add({
      targets: notif,
      alpha: 0,
      duration: 500,
      onComplete: () => notif.destroy(),
    });
  });

  return true;
}

const CHAIN_ATTACK_RADIUS = 220;
const CHAIN_ATTACK_MAX_HOPS = 2;

function findChainTarget(scene, sourceEnemy, bullet) {
  if (!scene.enemies) return null;
  let nearest = null;
  let nearestDistSq = CHAIN_ATTACK_RADIUS * CHAIN_ATTACK_RADIUS;
  const sx = sourceEnemy.x;
  const sy = sourceEnemy.y;

  scene.enemies.children.iterate((e) => {
    if (!e || !e.active) return;
    if (e === sourceEnemy) return;
    const dx = e.x - sx;
    const dy = e.y - sy;
    const distSq = dx * dx + dy * dy;
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = e;
    }
  });

  return nearest;
}

/** Base kill score source order: enemy scoreValue -> ENEMY_TYPES[type].score -> default 10. */
function getBaseKillScore(enemy) {
  if (!enemy || !enemy.getData) return 10;

  const scoreFromData = enemy.getData("scoreValue");
  if (typeof scoreFromData === "number" && scoreFromData > 0) {
    return scoreFromData;
  }

  const type =
    typeof enemy.getData("type") === "string" ? enemy.getData("type") : null;
  if (type && ENEMY_TYPES[type] && typeof ENEMY_TYPES[type].score === "number") {
    return ENEMY_TYPES[type].score;
  }

  return 10;
}

/** Coin tier by score value: 100+ diamond, 50+ gold, 30+ silver, otherwise copper. */
function getCoinKindForValue(value) {
  const v = Math.max(0, Math.floor(value || 0));
  if (v >= 100) return "diamond";
  if (v >= 50) return "gold";
  if (v >= 30) return "silver";
  return "copper";
}

function spawnCoinsForEnemy(scene, enemy, baseScore) {
  if (!scene || !enemy) return;
  if (!scene.coins || !scene.coins.create) return;

  if (typeof baseScore !== "number" || baseScore <= 0) return;

  const x =
    enemy.x + Phaser.Math.Between(-4, 4);
  const y =
    enemy.y + Phaser.Math.Between(-4, 4);

  let coin;

  const canUsePixelCoins =
    USE_PIXEL_SPRITES &&
    scene.textures &&
    scene.textures.exists("coins") &&
    scene.coinFrames;

  if (canUsePixelCoins) {
    const effectiveScore = modifyKillScore(scene, baseScore);
    const kind = getCoinKindForValue(effectiveScore);
    const frames = scene.coinFrames || {};
    const frameIndex = frames[kind];
    if (typeof frameIndex === "number") {
      coin = scene.coins.create(x, y, "coins", frameIndex);
    } else {
      coin = scene.coins.create(x, y, "coins");
    }
    if (coin && coin.setScale) {
      coin.setScale(0.5);
    }
  } else {
    coin = scene.coins.create(x, y, "coin");
  }

  if (!coin || !coin.body) return;

  // Keep coins below HUD layers so they stay visible in the field.
  if (coin.setDepth) {
    coin.setDepth(0);
  }
  coin.setActive(true);
  coin.setVisible(true);
  if (coin.body.setAllowGravity) {
    coin.body.setAllowGravity(false);
  }
  if (coin.body.setCircle) {
    if (canUsePixelCoins && coin.texture && coin.texture.key === "coins") {
      const radius = 42;
      const offset = 64 - radius;
      coin.body.setCircle(radius, offset, offset);
    } else {
      coin.body.setCircle(14);
    }
  }

  if (coin.setData) {
    coin.setData("coinValue", baseScore);
    // Store coin spawn time in gameplay elapsed seconds.
    // Lifetime/flicker handling is processed in GameScene.update using elapsedTime.
    if (typeof scene.elapsedTime === "number") {
      coin.setData("spawnTime", scene.elapsedTime);
    }
  }
}

export function onBulletHitEnemy(scene, bullet, enemy) {
  if (!enemy.active) return;

  const hasChain = hasBadge(scene, "chain_attack");
  const isHoming = bullet.getData && bullet.getData("homing");
  let chainConsumed = false;

  // Chain Attack: after hitting one target, bounce to nearby targets (up to max hops).
  if (hasChain && isHoming && bullet.getData) {
    const currentChains = bullet.getData("chainCount") || 0;
    if (currentChains < CHAIN_ATTACK_MAX_HOPS) {
      const nextTarget = findChainTarget(scene, enemy, bullet);
      if (nextTarget) {
        const dx = nextTarget.x - bullet.x;
        const dy = nextTarget.y - bullet.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        bullet.setData("chainCount", currentChains + 1);
        bullet.setData("homing", true);
        bullet.setData("targetRef", nextTarget);
        bullet.setVelocity((dx / len) * 320, (dy / len) * 320);
        if (scene.cellEmitter) {
          scene.cellEmitter.emitParticleAt(bullet.x, bullet.y);
        }
        chainConsumed = true;
      }
    }
  }

  // If chain does not continue, return the homing bullet to its cell as usual.
  if (isHoming && !chainConsumed && bullet.getData) {
    CellSystem.returnBulletToCell(scene, bullet);
  }

  // Apply badge-related on-hit effects.
  onEnemyHit(scene, enemy);

  // Base damage with per-hit variance (~80% to 120%).
  const baseDamage = scene.playerAttackPower || 1;
  const factor = Phaser.Math.FloatBetween(0.8, 1.2);
  let damage = Math.max(1, Math.round(baseDamage * factor));
  const isCritical = hasBadge(scene, "critical") && Math.random() < 0.2;
  if (isCritical) damage *= 2;

  // Capture base score before destroy; score metadata may be unavailable afterward.
  // This prevents incorrect fallback scoring after enemy destruction.
  const baseScoreForKill = getBaseKillScore(enemy);

  const killed = applyDamage(scene, enemy, damage, isCritical);

  // Attack SFX from current settings (sfx_attack 1|2|3).
  if (scene.sound && scene.sound.play) {
    scene.sound.play(getSfxAttackKey(), { volume: 0.7 });
  }

  if (!killed) {
    // On hit but not kill, apply brief knockback away from the player.
    const player = scene.player;
    if (player) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      enemy.setData("knockbackDirX", dx / len);
      enemy.setData("knockbackDirY", dy / len);
      enemy.setData("knockbackSpeed", 140);
      enemy.setData("knockbackUntil", (scene.elapsedTime || 0) + 0.12);
    }
    return;
  }

  // On kill, do not add score directly.
  // Spawn a coin and add score when the player actually picks it up.
  spawnCoinsForEnemy(scene, enemy, baseScoreForKill);

  scene.killCount += 1;
  scene.killsText.setText(String(scene.killCount));

  onEnemyKilled(scene, enemy);

  // Spawn fragment item when kill threshold is reached.
  if (
    typeof scene.nextItemKillThreshold === "number" &&
    scene.killCount >= scene.nextItemKillThreshold
  ) {
    const spawned = spawnUpgradeItem(scene);
    const k = scene.killCount || 0;
    const baseAdd = 24 + Math.floor(k / 120) * 6;
    const intervalMul = getFragmentSpawnIntervalMultiplier(scene);
    const add = Math.max(8, Math.round(baseAdd * intervalMul));

    if (spawned) {
      scene.nextItemKillThreshold += add;
    } else {
      // If spawn fails because max active fragments is reached,
      // move threshold forward so the next attempt happens after additional kills.
      scene.nextItemKillThreshold = k + add;
    }
  }
}

export function onPlayerPickupCoin(scene, player, coin) {
  if (!coin || !coin.active) return;

  // Coin carries the base score captured at enemy death time.
  let baseValue = 0;
  if (coin.getData) {
    const stored = coin.getData("coinValue");
    if (typeof stored === "number") {
      baseValue = stored;
    }
  }

  // Ignore invalid or non-positive values (no fallback score injection).
  if (!Number.isFinite(baseValue) || baseValue <= 0) {
    if (coin.destroy) {
      coin.destroy();
    }
    return;
  }

  if (coin.destroy) {
    coin.destroy();
  }
  const finalScore = modifyKillScore(scene, baseValue);

  scene.score = (scene.score || 0) + finalScore;

  if (scene.scoreLabelText && scene.scoreValueText) {
    scene.scoreValueText.setText(String(scene.score));
    scene.scoreValueText.x =
      scene.scoreLabelText.x + scene.scoreLabelText.width;

    showScoreGain(scene, finalScore);

    if (scene.tweens) {
      if (scene.scoreTween) {
        scene.scoreTween.remove();
      }
      scene.scoreValueText.setScale(1);
      scene.scoreTween = scene.tweens.add({
        targets: scene.scoreValueText,
        scaleX: 1.25,
        scaleY: 1.25,
        yoyo: true,
        duration: 100,
        ease: "Quad.easeOut",
      });
    }
  } else if (scene.scoreText) {
    scene.scoreText.setText(`${t("common.score")}: ${scene.score}`);
  }

  if (scene.sound && scene.sound.play) {
    scene.sound.play("sfx_pickup", { volume: 0.2 });
  }
}

/** Fragment pickup flow: pause world, show upgrade/badge UI, resume via resumeGame(). */
export function onPlayerPickupItem(scene, player, item) {
  if (!item.active) return;
  item.destroy();

  if (scene.sound && scene.sound.play) {
    scene.sound.play("sfx_pickup_fragment", { volume: 0.8 });
  }

  if (scene.isGameOver || scene.isChoosingUpgrade) return;

  scene.isChoosingUpgrade = true;

  scene.physics.world.pause();
  if (scene.spawnEvent) {
    scene.spawnEvent.paused = true;
  }
  pauseInvincibility(scene);

  const resumeGame = () => {
    scene.isChoosingUpgrade = false;
    scene.physics.world.resume();
    if (scene.spawnEvent) {
      scene.spawnEvent.paused = false;
    }
    resumeInvincibility(scene);
  };

  const showDevBadgeSelectStep = (showOneMoreButton = true) => {
    if (typeof window.showUpgradeOverlay !== "function") {
      resumeGame();
      return;
    }

    const choices = [
      {
        id: "dev_badge_header",
        type: "info",
        label: t("common.badgeDraw"),
        description: t("upgrade.chooseWhatYouWant"),
      },
    ];

    for (let i = 0; i < BADGES.length; i += 1) {
      const badge = BADGES[i];
      choices.push({
        id: `dev_badge_${badge.id}`,
        type: "dev_badge_pick",
        badgeId: badge.id,
        label: t(`badge.${badge.id}.name`),
        description: t(`badge.${badge.id}.description`) || "",
        rarity: badge.rarity,
      });
    }

    choices.push({
      id: "dev_badge_cancel",
      type: "cancel",
      label: t("common.skip"),
      description: "",
    });

    window.showUpgradeOverlay(
      choices,
      (choice) => {
        if (!choice) {
          resumeGame();
          return;
        }
        if (choice.type === "dev_badge_pick" && choice.badgeId) {
          const picked = BADGES.find((b) => b.id === choice.badgeId);
          if (!picked) {
            resumeGame();
            return;
          }
          showBadgeEquipStep(picked, {
            showOneMoreButton: hasBadge(scene, "one_more") && showOneMoreButton,
          });
          return;
        }
        resumeGame();
      },
      { scene }
    );
  };

  const showBadgeEquipStep = (badge, options = {}) => {
    const equippedIds = getEquippedBadges(scene) || [];
    const showOneMoreButton = options.showOneMoreButton === true && hasBadge(scene, "one_more");

    // Check whether this badge is already equipped in any slot.
    const alreadyInSlot = equippedIds.includes(badge.id);

    // Unified step: badge info + slot UI + optional Again/Skip actions.
    const rarityLabelMap = {
      normal: t("rarity.normal"),
      epic: t("rarity.epic"),
      unique: t("rarity.unique"),
    };
    const rarityTitle = t("badge.rarityBadge", {
      rarity: rarityLabelMap[badge.rarity] || badge.rarity,
    });

    const headerChoice = {
      id: `info_${badge.id}`,
      type: "info",
      label: t(`badge.${badge.id}.name`),
      description: alreadyInSlot
        ? t("upgrade.alreadyEquippedDud")
        : (t(`badge.${badge.id}.description`) || ""),
      rarity: alreadyInSlot ? null : badge.rarity,
      descriptionIsDud: alreadyInSlot,
    };

    const equipChoices = [headerChoice];

    if (showOneMoreButton) {
      equipChoices.push({
        id: "one_more",
        type: "one_more",
        label: t("common.again"),
        description: t("upgrade.spinOnceMore"),
      });
    }

    const skipScore = getSkipScoreForBadge(badge);
    equipChoices.push({
      id: "skip_badge",
      type: "skip",
      label: t("common.skip"),
      description: t("upgrade.scorePlus", { value: skipScore }),
      rarity: badge.rarity,
      skipScore,
    });

    const overlayContext = {
      scene,
      badge,
      badgeMode: "unified",
      canEquip: !alreadyInSlot,
    };

    if (typeof window.showUpgradeOverlay === "function") {
      window.showUpgradeOverlay(equipChoices, (choice) => {
        if (!choice) {
          resumeGame();
          return;
        }
        if (choice.type === "one_more") {
          if (DEV_MODE) {
            showDevBadgeSelectStep(false);
          } else {
            showBadgeDrawStep(false);
          }
          return;
        }
        if (choice.type === "skip") {
          const addScore = typeof choice.skipScore === "number" ? choice.skipScore : getSkipScoreForBadge(badge);
          scene.score = (scene.score || 0) + addScore;
          if (scene.scoreValueText) {
            scene.scoreValueText.setText(String(scene.score));
            if (scene.scoreLabelText) {
              scene.scoreValueText.x = scene.scoreLabelText.x + scene.scoreLabelText.width;
            }
          }
          if (scene.scoreText) {
            scene.scoreText.setText(`${t("common.score")}: ${scene.score}`);
          }
          resumeGame();
          return;
        }
        if (choice.type === "equip_badge" && choice.badgeId != null) {
          equipBadgeAtSlot(scene, choice.badgeId, choice.slotIndex ?? 0);
          resumeGame();
          return;
        }
        resumeGame();
      }, overlayContext);
    } else {
      resumeGame();
    }
  };

  const showBadgeDrawStep = (showOneMoreButton = true) => {
    const badge = rollBadgeDraw();
    if (!badge) {
      resumeGame();
      return;
    }

    const { width, height } = scene.scale || { width: 800, height: 600 };
    const centerX = width / 2;
    const centerY = height / 2;
    const labelStyle = {
      fontFamily: "Mulmaru",
      fontSize: "26px",
      fill: "#ffe082",
      stroke: "#000000",
      strokeThickness: 3,
    };

    const applyBadgeRarityStyle = (textObj, badgeLike) => {
      if (!textObj || !badgeLike) return;
      const rarity = badgeLike.rarity;
      if (rarity === "unique") {
        textObj.setColor("#ffd54f");
      } else if (rarity === "epic") {
        textObj.setColor("#ba68c8");
      } else {
        textObj.setColor("#616161");
      }
    };

    const rollText = scene.add
      .text(centerX, centerY - 10, t("upgrade.rollingBadge"), labelStyle)
      .setScrollFactor(0)
      .setOrigin(0.5, 0)
      .setDepth(30);

    const BadgeDrawForStep = () =>
      BADGES[Math.floor(Math.random() * BADGES.length)] || badge;

    const fastSpins = 5;
    const slowSpins = 7;
    const fastInterval = 70;
    const slowBase = 110;
    const slowIncrement = 55;

    let currentTime = 0;

    // Play pachinko draw SFX.
    if (scene.sound && scene.sound.play) {
      scene.sound.play("sfx_pachinko", { volume: 0.8 });
    }

    // Phase 1: fast rolling.
    for (let i = 0; i < fastSpins; i += 1) {
      const stepBadge = BadgeDrawForStep();
      scene.time.delayedCall(currentTime, () => {
        rollText.setText(t(`badge.${stepBadge.id}.name`));
        applyBadgeRarityStyle(rollText, stepBadge);
      });
      currentTime += fastInterval;
    }

    // Phase 2: slowing roll and final fixed result.
    for (let i = 0; i < slowSpins; i += 1) {
      const isLast = i === slowSpins - 1;
      const stepDelay = slowBase + i * slowIncrement;
      const stepBadge = isLast ? badge : BadgeDrawForStep();

      scene.time.delayedCall(currentTime, () => {
        rollText.setText(t(`badge.${stepBadge.id}.name`));
        applyBadgeRarityStyle(rollText, stepBadge);

        if (isLast) {
          const equippedIds = getEquippedBadges(scene) || [];
          const alreadyInSlot = equippedIds.includes(badge.id);
          const descRaw = alreadyInSlot
            ? t("upgrade.alreadyEquippedDud")
            : t(`badge.${badge.id}.description`);
          const descPlain = descRaw.replace(/\*\*([^*]+)\*\*/g, "$1");
          const descFill = alreadyInSlot ? "#bdbdbd" : labelStyle.fill;
          const descText = scene.add
            .text(centerX, centerY + 30, descPlain, {
              ...labelStyle,
              fontSize: "18px",
              fill: descFill,
            })
            .setScrollFactor(0)
            .setOrigin(0.5, 0)
            .setDepth(30)
            .setAlpha(0);

          // Fade in description text.
          if (scene.tweens) {
            scene.tweens.add({
              targets: descText,
              alpha: 1,
              duration: 260,
              ease: "Quad.easeOut",
            });
          }

          // Rarity-based highlight scale animation.
          if (scene.tweens) {
            let toScale = 1.18;
            if (badge.rarity === "epic") {
              toScale = 1.24;
            } else if (badge.rarity === "unique") {
              toScale = 1.3;
            }
            rollText.setScale(1);
            scene.tweens.add({
              targets: rollText,
              scaleX: toScale,
              scaleY: toScale,
              yoyo: true,
              duration: 230,
              ease: "Back.easeOut",
            });
          }

          // Leave a short delay after reveal for readability.
          // Total wait before equip UI: 1.825s after final reveal.
          // (With prior roll duration, this keeps overall pacing around 4.1s.)
          scene.time.delayedCall(1825, () => {
            showBadgeEquipStep(badge, {
              showOneMoreButton: hasBadge(scene, "one_more") && showOneMoreButton,
            });
          });

          scene.time.delayedCall(2200, () => {
            if (rollText && rollText.destroy) {
              rollText.destroy();
            }
            if (descText && descText.destroy) {
              descText.destroy();
            }
          });
        }
      });

      currentTime += stepDelay;
    }
  };

  const attackCount = scene.attackUpgradeCount ?? 0;
  const maxAttack = ATTACK_UPGRADE_MAX ?? 10;
  const cellCount = scene.cellActiveCount ?? scene.cellBaseCount ?? 1;
  const cellBaseMax = scene.cellMaxCount ?? CELL_MAX_COUNT;
  const cellMax = cellBaseMax + getCellMaxBonus(scene);
  const currentHp = scene.playerHp ?? 0;
  const currentMaxHp = scene.playerMaxHp ?? (PLAYER_MAX_HP_CAP ?? 10);

  const firstStepChoices = [
    {
      id: "hp",
      type: "stat",
      label: t("upgrade.hpPlus2"),
      // Disable HP option at full health (+2 only heals current HP, does not raise max HP).
      disabled: currentHp >= currentMaxHp,
    },
    {
      id: "cell_count",
      type: "stat",
      label: t("upgrade.cellsPlus1"),
      disabled: cellCount >= cellMax,
    },
    {
      id: "attack",
      type: "stat",
      label: t("upgrade.attackUp"),
      disabled: attackCount >= maxAttack,
    },
    {
      id: "badge_draw",
      type: "draw",
      label: t("common.badgeDraw"),
    },
  ];

  if (typeof window.showUpgradeOverlay === "function") {
    window.showUpgradeOverlay(firstStepChoices, (choice) => {
      if (!choice) {
        resumeGame();
        return;
      }
      if (choice.type === "stat") {
        applyUpgrade(scene, choice.id);
        resumeGame();
        return;
      }
      if (choice.id === "badge_draw") {
        if (DEV_MODE) {
          showDevBadgeSelectStep(true);
        } else {
          showBadgeDrawStep(true);
        }
        return;
      }
      resumeGame();
    }, { scene });
  } else {
    resumeGame();
  }
}

export function applyUpgrade(scene, choice) {
  switch (choice) {
    case "cell_count": {
      const current = scene.cellActiveCount ?? scene.cellBaseCount ?? 1;
      const baseMax = scene.cellMaxCount ?? CELL_MAX_COUNT;
      const cellCap = baseMax + getCellMaxBonus(scene);
      scene.cellActiveCount = Math.min(current + 1, cellCap);
      break;
    }
    case "attack": {
      const count = scene.attackUpgradeCount ?? 0;
      if (count >= (ATTACK_UPGRADE_MAX ?? 20)) break;
      const amount = ATTACK_UPGRADE_AMOUNTS[count] ?? 3;
      scene.attackUpgradeCount = count + 1;
      scene.playerAttackPower =
        (scene.playerAttackPower ?? PLAYER_BASE_ATTACK) + amount;
      break;
    }
    case "hp": {
      // Heal current HP by +2, capped at current max HP (does not change max HP).
      const maxHp = scene.playerMaxHp ?? (PLAYER_MAX_HP_CAP ?? 10);
      const beforeHp = scene.playerHp ?? 0;
      scene.playerHp = Math.min(beforeHp + 2, maxHp);
      scene.hpText.setText(`${scene.playerHp}/${scene.playerMaxHp}`);
      const healed = scene.playerHp - beforeHp;
      if (healed > 0 && typeof scene.showHpHeal === "function") {
        scene.showHpHeal(healed);
      }
      break;
    }
    default:
      break;
  }
}

/** Coin lifetime: expire at 30s, flicker in 20-25s and 25-30s windows. */
export function updateCoinLifetime(scene, now) {
  if (!scene.coins) return;
  scene.coins.children.iterate((coin) => {
    if (!coin || !coin.active) return;
    if (!coin.getData) return;

    let spawnTime =
      typeof coin.getData("spawnTime") === "number"
        ? coin.getData("spawnTime")
        : now;
    if (typeof coin.getData("spawnTime") !== "number") {
      coin.setData("spawnTime", spawnTime);
    }

    const age = now - spawnTime;
    if (age >= 30) {
      if (coin.destroy) coin.destroy();
      return;
    }

    if (age >= 20 && age < 25) {
      const t = age - 20;
      const phase = t * Math.PI * 2 * 0.8;
      let alpha = 0.7 + 0.3 * Math.sin(phase);
      if (alpha < 0.35) alpha = 0.35;
      if (alpha > 1) alpha = 1;
      if (coin.setAlpha) coin.setAlpha(alpha);
    } else if (age >= 25) {
      const t = age - 25;
      const phase = t * Math.PI * 2 * 2;
      let alpha = 0.6 + 0.4 * Math.sin(phase);
      if (alpha < 0.2) alpha = 0.2;
      if (alpha > 1) alpha = 1;
      if (coin.setAlpha) coin.setAlpha(alpha);
    } else if (coin.alpha !== 1 && coin.setAlpha) {
      coin.setAlpha(1);
    }
  });
}


