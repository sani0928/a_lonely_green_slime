import {
  BOSS_COIN_MAX,
  BOSS_COIN_MIN,
  BOSS_CELL_HIT_COOLDOWN_SEC,
  BOSS_CLOSE_PATTERN_COOLDOWN_MULTIPLIER,
  BOSS_CLOSE_PATTERN_DISTANCE,
  BOSS_CONTACT_DAMAGE,
  BOSS_FIRST_SPAWN_KILLS,
  BOSS_HEALTH_BAR_HEIGHT,
  BOSS_HEALTH_BAR_WIDTH,
  BOSS_HP_EARLY_STEP,
  BOSS_HP_FIRST,
  BOSS_HP_LATE_STEP,
  BOSS_PATTERN_DAMAGE,
  BOSS_REWARD_BASE,
  BOSS_REWARD_PER_SPAWN,
  BOSS_SPAWN_KILL_STEP_FIRST,
  BOSS_SPAWN_KILL_STEP_INCREMENT,
  USE_PIXEL_SPRITES,
} from "../config/constants.js";
import { getSfxAttackKey } from "../i18n.js";
import { getDirIndexFromVector } from "../render/entitySprites.js";
import { hasBadge, modifyKillScore } from "./badgeSystem.js";
import { returnBulletToCell } from "./cellSystem.js";
import { applyPlayerDamage } from "./playerSystem.js";

const BOSS_TYPES = [
  {
    id: "boss1",
    row: 0,
    scale: 1.1,
    speedMin: 52,
    speedMax: 66,
    tint: 0xff5252,
  },
  {
    id: "boss2",
    row: 1,
    scale: 1.06,
    speedMin: 45,
    speedMax: 58,
    tint: 0x8bc34a,
  },
  {
    id: "boss3",
    row: 2,
    scale: 1.0,
    speedMin: 50,
    speedMax: 62,
    tint: 0xba68c8,
  },
];

const BOSS_PATTERN_POOL = [
  { id: "charge", cooldown: 5.0 },
  { id: "bomb", cooldown: 6.0 },
  { id: "needle", cooldown: 5.5 },
];
const NEEDLE_BULLET_DIRECTIONS = 16;
const BOMB_RADIUS = 78;

function getBossFrame(row, dirIndex) {
  return row * 8 + Phaser.Math.Clamp(dirIndex | 0, 0, 7);
}

function getBossTypeById(id) {
  return BOSS_TYPES.find((boss) => boss.id === id) || BOSS_TYPES[0];
}

function getBossHp(spawnOrdinal) {
  const ordinal = Math.max(1, spawnOrdinal | 0);
  if (ordinal <= 3) {
    return BOSS_HP_FIRST + (ordinal - 1) * BOSS_HP_EARLY_STEP;
  }
  return BOSS_HP_FIRST + 2 * BOSS_HP_EARLY_STEP + (ordinal - 3) * BOSS_HP_LATE_STEP;
}

function getBossReward(spawnOrdinal) {
  return BOSS_REWARD_BASE + Math.max(1, spawnOrdinal | 0) * BOSS_REWARD_PER_SPAWN;
}

function getBossDistanceToPlayer(boss, player) {
  if (!boss || !player) return Number.POSITIVE_INFINITY;
  const dx = (player.x || 0) - (boss.x || 0);
  const dy = (player.y || 0) - (boss.y || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

function getBossPatternCooldown(scene, boss, player) {
  const baseCooldown = boss.getData("lastPatternCooldown") || 5.5;
  const closeDistance = Math.max(1, BOSS_CLOSE_PATTERN_DISTANCE || 220);
  const isClose = getBossDistanceToPlayer(boss, player) <= closeDistance;
  if (!isClose) return baseCooldown;
  return baseCooldown * (BOSS_CLOSE_PATTERN_COOLDOWN_MULTIPLIER || 0.5);
}

function scheduleNextBossPattern(scene, boss, player) {
  const now = scene.elapsedTime || 0;
  boss.setData("lastPatternCompletedAt", now);
  boss.setData("nextPatternAt", now + getBossPatternCooldown(scene, boss, player));
}

function clampToWorld(scene, x, y) {
  return {
    x: Phaser.Math.Clamp(x, 80, (scene.worldWidth || 3200) - 80),
    y: Phaser.Math.Clamp(y, 80, (scene.worldHeight || 3200) - 80),
  };
}

function getBossSpawnPosition(scene) {
  const cam = scene.cameras.main;
  const view = cam.worldView;
  const margin = 180;
  const side = Phaser.Math.Between(0, 3);
  let x;
  let y;

  if (side === 0) {
    x = Phaser.Math.Between(view.left, view.right);
    y = view.top - margin;
  } else if (side === 1) {
    x = Phaser.Math.Between(view.left, view.right);
    y = view.bottom + margin;
  } else if (side === 2) {
    x = view.left - margin;
    y = Phaser.Math.Between(view.top, view.bottom);
  } else {
    x = view.right + margin;
    y = Phaser.Math.Between(view.top, view.bottom);
  }

  return clampToWorld(scene, x, y);
}

function createBossHealthBar(scene, boss) {
  const width = BOSS_HEALTH_BAR_WIDTH;
  const height = BOSS_HEALTH_BAR_HEIGHT;
  const bg = scene.add
    .rectangle(boss.x, boss.y - 72, width + 4, height + 4, 0x000000, 0.75)
    .setDepth(80);
  const fill = scene.add
    .rectangle(boss.x - width / 2, boss.y - 72, width, height, 0x66bb6a, 1)
    .setOrigin(0, 0.5)
    .setDepth(81);

  boss.setData("hpBarBg", bg);
  boss.setData("hpBarFill", fill);
}

function destroyBossHealthBar(boss) {
  const bg = boss.getData("hpBarBg");
  const fill = boss.getData("hpBarFill");
  if (bg && bg.destroy) bg.destroy();
  if (fill && fill.destroy) fill.destroy();
}

function createWarningGraphics(scene, depth = 70) {
  return scene.add.graphics().setDepth(depth).setAlpha(0.45);
}

function drawPixelLineWarning(graphics, x, y, dirX, dirY, range) {
  const step = 44;
  const size = 26;
  for (let d = 36; d <= range; d += step) {
    const cx = x + dirX * d;
    const cy = y + dirY * d;
    graphics.fillStyle(0x2b0000, 0.72);
    graphics.fillRect(cx - size / 2 - 2, cy - size / 2 - 2, size + 4, size + 4);
    graphics.fillStyle(0xff1744, 0.62);
    graphics.fillRect(cx - size / 2, cy - size / 2, size, size);
    graphics.fillStyle(0xff8a80, 0.78);
    graphics.fillRect(cx - size / 2 + 5, cy - size / 2 + 5, size - 10, size - 10);
  }
}

function drawPixelCircleWarning(graphics, x, y, radius) {
  const step = 12;
  graphics.fillStyle(0xff1744, 0.16);
  for (let yy = -radius; yy <= radius; yy += step) {
    for (let xx = -radius; xx <= radius; xx += step) {
      const distSq = xx * xx + yy * yy;
      if (distSq <= radius * radius) {
        graphics.fillRect(x + xx - 4, y + yy - 4, 8, 8);
      }
    }
  }
  graphics.fillStyle(0xff8a80, 0.75);
  const circumferenceSteps = Math.max(16, Math.round(radius / 3));
  for (let i = 0; i < circumferenceSteps; i += 1) {
    const a = (i / circumferenceSteps) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    graphics.fillRect(px - 4, py - 4, 8, 8);
  }
}

function addTimedHazard(scene, hazard) {
  if (!scene.bossHazards) {
    scene.bossHazards = [];
  }
  scene.bossHazards.push(hazard);
}

function playPixelExplosion(scene, x, y, radius) {
  if (!scene.add || !scene.tweens) return;

  const burst = scene.add.graphics().setDepth(75).setPosition(x, y);
  burst.fillStyle(0xfff176, 0.95);
  burst.fillRect(-18, -18, 36, 36);
  burst.fillStyle(0xff7043, 0.9);
  burst.fillRect(-34, -10, 68, 20);
  burst.fillRect(-10, -34, 20, 68);
  burst.fillStyle(0xff1744, 0.75);

  const block = 10;
  const ringSteps = 20;
  for (let i = 0; i < ringSteps; i += 1) {
    const angle = (i / ringSteps) * Math.PI * 2;
    const px = Math.cos(angle) * radius * 0.65;
    const py = Math.sin(angle) * radius * 0.65;
    burst.fillRect(px - block / 2, py - block / 2, block, block);
  }

  scene.tweens.add({
    targets: burst,
    alpha: 0,
    scaleX: 1.35,
    scaleY: 1.35,
    duration: 320,
    ease: "Quad.easeOut",
    onComplete: () => burst.destroy(),
  });

  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.12, 0.12);
    const dist = Phaser.Math.Between(28, 78);
    const shard = scene.add
      .rectangle(x, y, 8, 8, i % 2 === 0 ? 0xfff176 : 0xff7043, 1)
      .setDepth(76);
    scene.tweens.add({
      targets: shard,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scaleX: 0.4,
      scaleY: 0.4,
      duration: 360,
      ease: "Cubic.easeOut",
      onComplete: () => shard.destroy(),
    });
  }
}

function startChargePattern(scene, boss) {
  const player = scene.player;
  if (!player) return;

  const angle = Phaser.Math.Angle.Between(boss.x, boss.y, player.x, player.y);
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const range = 720;
  const warning = createWarningGraphics(scene);
  drawPixelLineWarning(warning, boss.x, boss.y, dirX, dirY, range);
  scene.tweens.add({
    targets: warning,
    alpha: 0.12,
    duration: 120,
    yoyo: true,
    repeat: 5,
  });
  scene.tweens.add({
    targets: boss,
    x: boss.x + dirX * 10,
    y: boss.y + dirY * 10,
    duration: 80,
    yoyo: true,
    repeat: 5,
  });

  const now = scene.elapsedTime || 0;
  boss.setData("bossState", "charge_windup");
  boss.setData("stateUntil", now + 0.8);
  boss.setData("chargeDirX", dirX);
  boss.setData("chargeDirY", dirY);
  boss.setData("chargeRange", range);
  boss.setData("chargeWarning", warning);
}

function startBombPattern(scene, boss) {
  const player = scene.player;
  if (!player) return;

  const now = scene.elapsedTime || 0;
  const count = Phaser.Math.Between(3, 5);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Phaser.Math.Between(70, 230);
    const pos = clampToWorld(
      scene,
      player.x + Math.cos(angle) * dist,
      player.y + Math.sin(angle) * dist
    );
    const radius = BOMB_RADIUS;
    const warning = createWarningGraphics(scene);
    drawPixelCircleWarning(warning, pos.x, pos.y, radius);
    scene.tweens.add({
      targets: warning,
      alpha: 0.08,
      duration: 140,
      yoyo: true,
      repeat: 7,
    });
    addTimedHazard(scene, {
      type: "circle",
      x: pos.x,
      y: pos.y,
      radius,
      triggerAt: now + 1.1,
      warning,
    });
  }

  boss.setData("bossState", "pattern_lock");
  boss.setData("stateUntil", now + 0.7);
}

function startNeedlePattern(scene, boss) {
  const now = scene.elapsedTime || 0;
  boss.setData("bossState", "needle_windup");
  boss.setData("stateUntil", now + 0.7);

  scene.tweens.add({
    targets: boss,
    alpha: 0.35,
    duration: 110,
    yoyo: true,
    repeat: 5,
  });
}

function fireNeedlePattern(scene, boss) {
  if (!scene.bossProjectiles) return;

  const speed = 260;
  for (let i = 0; i < NEEDLE_BULLET_DIRECTIONS; i += 1) {
    const angle = -Math.PI / 2 + i * (Math.PI * 2 / NEEDLE_BULLET_DIRECTIONS);
    const proj = scene.bossProjectiles.create(boss.x, boss.y, "bullet");
    if (!proj || !proj.body) continue;
    proj.setActive(true);
    proj.setVisible(true);
    proj.body.setAllowGravity(false);
    proj.setScale(2.2);
    proj.setCircle(8);
    proj.setTint(0xff3366);
    proj.setDepth(35);
    proj.setData("sourceBoss", boss);
    proj.setData("expireAt", (scene.elapsedTime || 0) + 3);
    proj.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }
}

function startBossPattern(scene, boss) {
  const pattern = BOSS_PATTERN_POOL[Phaser.Math.Between(0, BOSS_PATTERN_POOL.length - 1)];
  boss.setData("lastPatternCooldown", pattern.cooldown);

  if (pattern.id === "charge") {
    startChargePattern(scene, boss);
  } else if (pattern.id === "bomb") {
    startBombPattern(scene, boss);
  } else {
    startNeedlePattern(scene, boss);
  }
}

function updateBossHazards(scene) {
  if (!scene.bossHazards || !scene.bossHazards.length) return;
  const now = scene.elapsedTime || 0;
  const player = scene.player;
  const remaining = [];

  for (let i = 0; i < scene.bossHazards.length; i += 1) {
    const hazard = scene.bossHazards[i];
    if (!hazard || now < hazard.triggerAt) {
      remaining.push(hazard);
      continue;
    }

    if (hazard.warning && hazard.warning.destroy) {
      hazard.warning.destroy();
    }
    playPixelExplosion(scene, hazard.x, hazard.y, hazard.radius);

    if (player && player.active) {
      const dist = Phaser.Math.Distance.Between(player.x, player.y, hazard.x, hazard.y);
      if (dist <= hazard.radius) {
        applyPlayerDamage(scene, { source: "projectile", isBoss: true }, BOSS_PATTERN_DAMAGE);
      }
    }

    if (scene.hitEmitter) {
      scene.hitEmitter.explode(34, hazard.x, hazard.y);
    }
  }

  scene.bossHazards = remaining;
}

function updateBossProjectiles(scene) {
  if (!scene.bossProjectiles) return;
  const now = scene.elapsedTime || 0;
  scene.bossProjectiles.children.iterate((proj) => {
    if (!proj || !proj.active) return;
    const expireAt = proj.getData("expireAt");
    if (typeof expireAt === "number" && now >= expireAt) {
      proj.destroy();
    }
  });
}

function updateBossDirection(boss, vx, vy) {
  if (!USE_PIXEL_SPRITES || !boss.texture || boss.texture.key !== "bosses") return;
  const previous = typeof boss.getData("dirIndex") === "number" ? boss.getData("dirIndex") : 4;
  const dirIndex = vx || vy ? getDirIndexFromVector(vx, vy, previous) : previous;
  const type = getBossTypeById(boss.getData("bossType"));
  boss.setData("dirIndex", dirIndex);
  boss.setFrame(getBossFrame(type.row, dirIndex));
}

function updateOneBoss(scene, boss, dt) {
  if (!boss || !boss.active) return;
  const player = scene.player;
  if (!player) return;

  const now = scene.elapsedTime || 0;
  const state = boss.getData("bossState") || "idle";
  const stateUntil = boss.getData("stateUntil") || 0;

  if (state === "charge_windup") {
    boss.setVelocity(0, 0);
    if (now >= stateUntil) {
      const warning = boss.getData("chargeWarning");
      if (warning && warning.destroy) warning.destroy();
      boss.setData("bossState", "charging");
      const chargeRange = boss.getData("chargeRange") || 720;
      const chargeSpeed = 520;
      boss.setData("stateUntil", now + chargeRange / chargeSpeed);
      const dirX = boss.getData("chargeDirX") || 0;
      const dirY = boss.getData("chargeDirY") || 0;
      boss.setVelocity(dirX * chargeSpeed, dirY * chargeSpeed);
      updateBossDirection(boss, dirX, dirY);
    }
    return;
  }

  if (state === "charging") {
    const dirX = boss.getData("chargeDirX") || 0;
    const dirY = boss.getData("chargeDirY") || 0;
    boss.setVelocity(dirX * 520, dirY * 520);
    if (now >= stateUntil) {
      boss.setData("bossState", "idle");
      scheduleNextBossPattern(scene, boss, player);
      boss.setVelocity(0, 0);
    }
    return;
  }

  if (state === "needle_windup") {
    boss.setVelocity(0, 0);
    if (now >= stateUntil) {
      fireNeedlePattern(scene, boss);
      boss.setAlpha(1);
      boss.setData("bossState", "idle");
      scheduleNextBossPattern(scene, boss, player);
    }
    return;
  }

  if (state === "pattern_lock") {
    boss.setVelocity(0, 0);
    if (now >= stateUntil) {
      boss.setData("bossState", "idle");
      scheduleNextBossPattern(scene, boss, player);
    }
    return;
  }

  const completedAt = boss.getData("lastPatternCompletedAt");
  const dynamicReadyAt =
    typeof completedAt === "number"
      ? completedAt + getBossPatternCooldown(scene, boss, player)
      : boss.getData("nextPatternAt") || 0;
  if (now >= Math.min(boss.getData("nextPatternAt") || dynamicReadyAt, dynamicReadyAt)) {
    startBossPattern(scene, boss);
    return;
  }

  const angle = Phaser.Math.Angle.Between(boss.x, boss.y, player.x, player.y);
  const speed = boss.getData("speed") || 52;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  boss.setVelocity(vx, vy);
  updateBossDirection(boss, vx, vy);
}

function spawnBoss(scene) {
  if (!scene.bosses) return;
  const bossType = BOSS_TYPES[Phaser.Math.Between(0, BOSS_TYPES.length - 1)];
  const pos = getBossSpawnPosition(scene);
  const spawnOrdinal = (scene.bossSpawnCount || 0) + 1;
  scene.bossSpawnCount = spawnOrdinal;

  const textureKey =
    USE_PIXEL_SPRITES && scene.textures && scene.textures.exists("bosses")
      ? "bosses"
      : "enemy";
  const boss = scene.bosses.create(pos.x, pos.y, textureKey);
  if (!boss || !boss.body) return;

  boss.setActive(true);
  boss.setVisible(true);
  boss.setDepth(25);
  boss.setCollideWorldBounds(false);
  boss.body.setAllowGravity(false);
  boss.setData("isBoss", true);
  boss.setData("bossType", bossType.id);
  boss.setData("spawnOrdinal", spawnOrdinal);
  boss.setData("maxHp", getBossHp(spawnOrdinal));
  boss.setData("hp", getBossHp(spawnOrdinal));
  boss.setData("rewardValue", getBossReward(spawnOrdinal));
  boss.setData("speed", Phaser.Math.Between(bossType.speedMin, bossType.speedMax));
  boss.setData("bossState", "idle");
  boss.setData("nextPatternAt", (scene.elapsedTime || 0) + 2.0);
  boss.setData("dirIndex", 4);

  if (textureKey === "bosses") {
    boss.setFrame(getBossFrame(bossType.row, 4));
    boss.setScale(bossType.scale);
    if (boss.body.setCircle) {
      const radius = 34;
      const offset = 64 - radius;
      boss.body.setCircle(radius, offset, offset);
    }
  } else {
    boss.setTint(bossType.tint);
    boss.setScale(2.4);
    if (boss.body.setCircle) {
      boss.body.setCircle(28);
    }
  }

  createBossHealthBar(scene, boss);

  if (scene.sound && scene.sound.play) {
    scene.sound.play("sfx_boss_alert", { volume: 0.8 });
  }
}

export function initBossState(scene) {
  scene.nextBossSpawnKillCount = BOSS_FIRST_SPAWN_KILLS;
  scene.nextBossSpawnKillStep = BOSS_SPAWN_KILL_STEP_FIRST;
  scene.bossSpawnCount = 0;
  scene.bossHazards = [];
}

export function updateBosses(scene, dt) {
  const kills = Math.max(0, scene.killCount || 0);
  const timeKills = Math.max(0, Math.floor(scene.elapsedTime || 0));
  const effectiveKills = kills + timeKills;

  while (effectiveKills >= (scene.nextBossSpawnKillCount ?? BOSS_FIRST_SPAWN_KILLS)) {
    spawnBoss(scene);
    const currentStep = Math.max(1, scene.nextBossSpawnKillStep || BOSS_SPAWN_KILL_STEP_FIRST);
    scene.nextBossSpawnKillCount =
      (scene.nextBossSpawnKillCount ?? BOSS_FIRST_SPAWN_KILLS) + currentStep;
    scene.nextBossSpawnKillStep =
      currentStep + Math.max(0, BOSS_SPAWN_KILL_STEP_INCREMENT || 0);
    if (typeof scene.showPhaseAlert === "function") {
      scene.showPhaseAlert(scene.bossSpawnMessage || "Something huge has appeared!!", {
        fill: "#ff7043",
        stroke: "#2b0000",
        strokeThickness: 6,
      });
    }
  }

  if (scene.bosses) {
    scene.bosses.children.iterate((boss) => updateOneBoss(scene, boss, dt));
  }

  updateBossHazards(scene);
  updateBossProjectiles(scene);
  updateBossHealthBars(scene);
}

export function updateBossHealthBars(scene) {
  if (!scene.bosses) return;
  const width = BOSS_HEALTH_BAR_WIDTH;
  scene.bosses.children.iterate((boss) => {
    if (!boss || !boss.active) return;
    const bg = boss.getData("hpBarBg");
    const fill = boss.getData("hpBarFill");
    if (!bg || !fill) return;

    const hp = Math.max(0, boss.getData("hp") || 0);
    const maxHp = Math.max(1, boss.getData("maxHp") || 1);
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    bg.setPosition(boss.x, boss.y - 72);
    fill.setPosition(boss.x - width / 2, boss.y - 72);
    fill.setSize(Math.max(1, width * ratio), BOSS_HEALTH_BAR_HEIGHT);
    if (ratio > 0.5) {
      fill.setFillStyle(0x66bb6a, 1);
    } else if (ratio > 0.2) {
      fill.setFillStyle(0xffca28, 1);
    } else {
      fill.setFillStyle(0xef5350, 1);
    }
  });
}

export function onPlayerHitByBoss(scene, player, boss) {
  if (!boss || !boss.active) return;
  applyPlayerDamage(scene, { source: "contact", isBoss: true }, BOSS_CONTACT_DAMAGE);
}

export function onPlayerHitByBossProjectile(scene, player, proj) {
  if (!proj || !proj.active) return;
  applyPlayerDamage(scene, { source: "projectile", isBoss: true }, BOSS_PATTERN_DAMAGE);
  proj.destroy();
}

export function onBulletHitBoss(scene, bullet, boss) {
  if (!boss || !boss.active) return;

  const isHoming = bullet && bullet.getData && bullet.getData("homing");
  if (isHoming) {
    returnBulletToCell(scene, bullet);
  }

  const now = scene.elapsedTime || 0;
  const nextDamageAt = boss.getData("nextCellDamageAt") || 0;
  if (now < nextDamageAt) return;
  boss.setData("nextCellDamageAt", now + BOSS_CELL_HIT_COOLDOWN_SEC);

  let damage = Math.max(1, Math.round((scene.playerAttackPower || 1) * Phaser.Math.FloatBetween(0.8, 1.2)));
  const isCritical = hasBadge(scene, "critical") && Math.random() < 0.2;
  if (isCritical) damage *= 2;
  if (hasBadge(scene, "boss_hunter")) damage *= 2;

  const currentHp = boss.getData("hp") ?? boss.getData("maxHp") ?? 1;
  const nextHp = currentHp - damage;
  boss.setData("hp", nextHp);

  if (scene.sound && scene.sound.play) {
    scene.sound.play(getSfxAttackKey(), { volume: 0.7 });
  }

  if (scene.add && scene.tweens) {
    const dmgText = scene.add
      .text(boss.x, boss.y - 64, `${Math.round(damage)}`, {
        fontFamily: "Mulmaru",
        fontSize: isCritical ? "22px" : "16px",
        fill: isCritical ? "#ff5722" : "#ffeb3b",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(90);
    scene.tweens.add({
      targets: dmgText,
      y: dmgText.y - 28,
      alpha: 0,
      duration: 520,
      ease: "Cubic.easeOut",
      onComplete: () => dmgText.destroy(),
    });
  }

  if (scene.hitEmitter) {
    scene.hitEmitter.explode(nextHp <= 0 ? 28 : 8, boss.x, boss.y);
  }

  updateBossHealthBars(scene);

  if (nextHp > 0) return;

  let reward = boss.getData("rewardValue") || BOSS_REWARD_BASE;
  if (hasBadge(scene, "a_rich_boss")) reward *= 3;
  const coinCount = Phaser.Math.Clamp(
    BOSS_COIN_MIN + (boss.getData("spawnOrdinal") || 1) * 4,
    BOSS_COIN_MIN,
    BOSS_COIN_MAX
  );
  spawnBossCoinBurst(scene, boss.x, boss.y, reward, coinCount);
  destroyBossHealthBar(boss);
  boss.destroy();
}

export function spawnBossCoinBurst(scene, x, y, totalValue, coinCount) {
  if (!scene || !scene.coins || !scene.coins.create) return;
  const count = Math.max(1, coinCount | 0);
  const baseValue = Math.max(1, Math.round((totalValue || 0) / count));

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Phaser.Math.Between(8, 42);
    const spawnX = x + Math.cos(angle) * dist;
    const spawnY = y + Math.sin(angle) * dist;
    let coin;

    const canUsePixelCoins =
      USE_PIXEL_SPRITES &&
      scene.textures &&
      scene.textures.exists("coins") &&
      scene.coinFrames;

    if (canUsePixelCoins) {
      const effectiveScore = modifyKillScore(scene, baseValue);
      const frames = scene.coinFrames || {};
      const kind =
        effectiveScore >= 100
          ? "diamond"
          : effectiveScore >= 50
          ? "gold"
          : effectiveScore >= 30
          ? "silver"
          : "copper";
      const frameIndex = frames[kind];
      coin =
        typeof frameIndex === "number"
          ? scene.coins.create(spawnX, spawnY, "coins", frameIndex)
          : scene.coins.create(spawnX, spawnY, "coins");
      if (coin && coin.setScale) coin.setScale(0.5);
    } else {
      coin = scene.coins.create(spawnX, spawnY, "coin");
    }

    if (!coin || !coin.body) continue;
    coin.setActive(true);
    coin.setVisible(true);
    coin.setDepth(0);
    coin.body.setAllowGravity(false);
    if (coin.body.setCircle) {
      if (canUsePixelCoins && coin.texture && coin.texture.key === "coins") {
        const radius = 42;
        const offset = 64 - radius;
        coin.body.setCircle(radius, offset, offset);
      } else {
        coin.body.setCircle(14);
      }
    }
    coin.setData("coinValue", baseValue);
    coin.setData("spawnTime", scene.elapsedTime || 0);
    coin.setData("burstStopAt", (scene.elapsedTime || 0) + 0.45);
    const speed = Phaser.Math.Between(140, 300);
    coin.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }
}

export function cleanupBossObjects(scene) {
  if (scene.bossHazards) {
    scene.bossHazards.forEach((hazard) => {
      if (hazard && hazard.warning && hazard.warning.destroy) {
        hazard.warning.destroy();
      }
    });
    scene.bossHazards = [];
  }
  if (scene.bosses) {
    scene.bosses.children.iterate((boss) => {
      if (boss) destroyBossHealthBar(boss);
    });
    scene.bosses.clear(true, true);
  }
  if (scene.bossProjectiles) {
    scene.bossProjectiles.clear(true, true);
  }
}
