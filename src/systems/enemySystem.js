import {
  ENEMY_SPAWN_MARGIN,
  ENEMY_BASE_HP,
  ENEMY_HP_PER_DIFFICULTY,
  ENEMY_TYPES,
  EXTRA_ENEMIES_CAP,
  ENEMY_CULL_DISTANCE,
  USE_PIXEL_SPRITES,
  CLEAR_TIME_SEC,
  ENDLESS_START_SEC,
  SHOOTER_CAP_STEP_SEC,
  SHOOTER_SPAWN_INTERVAL_SEC,
  PHASE_SPAWN_AMOUNT_BONUS,
  PHASE_AGGRO_RADIUS_MULTIPLIER,
  PHASE_AGGRO_CHASE_SPEED_MULTIPLIER,
  ENDLESS_CHASE_SPEED_MAX,
  ENDLESS_SHOOTER_INTERVAL_SEC,
} from "../config/constants.js";
import {
  pickEnemyTier,
  getSpawnPressure,
  getMaxActiveEnemies,
  getCurrentPhase,
} from "./difficultySystem.js";
import { getEnemySpawnMultiplier } from "./badgeSystem.js";
import {
  getDirIndexFromVector,
  getEntityMappingForEnemyType,
  getFrameIndex,
  getScaleForSize,
} from "../render/entitySprites.js";

const TIER_TO_TYPES = {
  weak: ["runner", "mite"],
  mid: ["grunt", "soldier"],
  strong: ["brute", "titan"],
};

function getShooterTimeProgress(scene) {
  const elapsed = Math.max(0, scene?.elapsedTime ?? 0);
  const horizon = Math.max(1, CLEAR_TIME_SEC || 900);
  return Phaser.Math.Clamp(elapsed / horizon, 0, 1);
}

function getEndlessMinutes(scene) {
  const elapsed = Math.max(0, scene?.elapsedTime ?? 0);
  if (elapsed < ENDLESS_START_SEC) return 0;
  return (elapsed - ENDLESS_START_SEC) / 60;
}

function pickEnemyType(scene) {
  const tier = pickEnemyTier(scene);
  const pool = TIER_TO_TYPES[tier] || TIER_TO_TYPES.mid || ["grunt"];
  if (!pool.length) {
    return "grunt";
  }
  const index = Phaser.Math.Between(0, pool.length - 1);
  return pool[index];
}

function countEnemiesOfType(scene, type) {
  if (!scene.enemies) return 0;
  let count = 0;
  scene.enemies.children.iterate((enemy) => {
    if (!enemy || !enemy.active) return;
    if (enemy.getData("type") === type) {
      count += 1;
    }
  });
  return count;
}

function getShooterCap(scene) {
  const elapsed = Math.max(0, scene?.elapsedTime ?? 0);
  const step = Math.max(1, SHOOTER_CAP_STEP_SEC || 300);
  return 1 + Math.floor(elapsed / step);
}

/** Pick spawn type with time-based shooter cap and fixed spawn interval. */
function pickSpawnType(scene) {
  const shootersNow = countEnemiesOfType(scene, "shooter");
  const now = scene.elapsedTime || 0;
  const maxShooters = getShooterCap(scene);
  const endlessIntervalStartSec = 20 * 60;
  const spawnIntervalSec =
    now >= endlessIntervalStartSec
      ? ENDLESS_SHOOTER_INTERVAL_SEC || 8
      : SHOOTER_SPAWN_INTERVAL_SEC || 10;

  let enemyType = pickEnemyType(scene);
  if (shootersNow >= maxShooters) {
    return enemyType;
  }

  if (typeof scene.nextShooterSpawnAtSec !== "number") {
    scene.nextShooterSpawnAtSec = now + spawnIntervalSec;
    return enemyType;
  }

  const nextShooterSpawnAtSec = scene.nextShooterSpawnAtSec;

  if (now < nextShooterSpawnAtSec) {
    return enemyType;
  }

  scene.nextShooterSpawnAtSec = now + spawnIntervalSec;
  return "shooter";
}

// Enemy visual tint and scale by type.
const ENEMY_TYPE_VISUALS = {
  runner: { tint: 0x4fc3f7, scale: 0.9 },
  mite: { tint: 0x26a69a, scale: 0.75 },
  grunt: { tint: 0xef5350, scale: 0.95 },
  soldier: { tint: 0xff9800, scale: 1.0 },
  shooter: { tint: 0xff9800, scale: 1.0 },
  brute: { tint: 0xab47bc, scale: 1.08 },
  titan: { tint: 0x5e35b1, scale: 1.2 },
};

function applyTierVisuals(enemy, type) {
  const vis = ENEMY_TYPE_VISUALS[type];
  if (vis) {
    enemy.setTint(vis.tint);
    enemy.setScale(vis.scale);
  } else {
    enemy.setTint(0xef5350);
    enemy.setScale(1.0);
  }
}

/** Shooter fires one projectile toward player; speed scales by difficulty and lasts 2.6s. */
function fireRangedShot(scene, enemy, player) {
  if (!scene.enemyProjectiles || !player) return;

  const proj = scene.enemyProjectiles.create(enemy.x, enemy.y, "bullet");
  if (!proj || !proj.body) return;

  proj.setActive(true);
  proj.setVisible(true);
  proj.body.setAllowGravity(false);
  proj.setCircle(3);
  // Shooter projectile tint.
  proj.setTint(0xf5dc46);

  // remember who fired this projectile to ignore immediate self-collision
  if (proj.setData) {
    proj.setData("sourceEnemy", enemy);
  }

  // Use elapsedTime-based expiry so pause does not consume projectile lifetime.
  if (proj.setData && typeof scene.elapsedTime === "number") {
    const lifeSec = 2.6;
    proj.setData("expireAt", scene.elapsedTime + lifeSec);
  }

  const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
  const progress = getShooterTimeProgress(scene);
  const endlessMinutes = getEndlessMinutes(scene);
  const endlessBonus = Math.min(40, endlessMinutes * 4);
  const speed = 220 + (500 - 220) * progress + endlessBonus;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  proj.setVelocity(vx, vy);
}

function initializeEnemyStats(scene, enemy, type, difficulty) {
  const cfg = ENEMY_TYPES[type] || {};
  const baseHpFromType = cfg.baseHp ?? ENEMY_BASE_HP;
  const elapsed = Math.max(0, scene?.elapsedTime ?? 0);
  const earlyProgress = Phaser.Math.Clamp(elapsed / (CLEAR_TIME_SEC || 900), 0, 1);
  const hpFactor = Phaser.Math.Linear(0.62, 0.82, earlyProgress);
  const endlessHpBonus = Math.floor(getEndlessMinutes(scene) / 5) * 3;
  const rawHp =
    baseHpFromType +
    ENEMY_HP_PER_DIFFICULTY * hpFactor * (Math.max(difficulty, 1) - 1) +
    endlessHpBonus;
  const hp = Math.max(10, Math.round(rawHp));

  enemy.setData("type", type);
  enemy.setData("maxHp", hp);
  enemy.setData("hp", hp);
  enemy.setData("scoreValue", cfg.score ?? 10);
}

/** Cull enemies far away from player so off-screen buildup does not block spawning. */
export function cullDistantEnemies(scene) {
  const player = scene.player;
  if (!player || !scene.enemies) return;
  const limitSq = (ENEMY_CULL_DISTANCE || 1400) ** 2;
  const toCull = [];
  scene.enemies.children.iterate((enemy) => {
    if (!enemy || !enemy.active) return;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    if (dx * dx + dy * dy > limitSq) toCull.push(enemy);
  });
  for (let i = 0; i < toCull.length; i += 1) {
    if (toCull[i].destroy) toCull[i].destroy();
  }
}

/** Return one random position along the camera edge (+margin). */
function getRandomSpawnPosition(view, margin) {
  const side = Phaser.Math.Between(0, 3);
  switch (side) {
    case 0:
      return {
        x: Phaser.Math.Between(view.x, view.x + view.width),
        y: view.y - margin,
      };
    case 1:
      return {
        x: view.x + view.width + margin,
        y: Phaser.Math.Between(view.y, view.y + view.height),
      };
    case 2:
      return {
        x: Phaser.Math.Between(view.x, view.x + view.width),
        y: view.y + view.height + margin,
      };
    case 3:
    default:
      return {
        x: view.x - margin,
        y: Phaser.Math.Between(view.y, view.y + view.height),
      };
  }
}

export function spawnEnemy(scene) {
  const phase = getCurrentPhase(scene);
  const baseCap = getMaxActiveEnemies(scene);
  const cap = Math.round(baseCap * getEnemySpawnMultiplier(scene));
  if (scene.enemies && scene.enemies.countActive(true) >= cap) {
    return;
  }
  const cam = scene.cameras.main;
  const view = cam.worldView;
  const margin = ENEMY_SPAWN_MARGIN;

  const extraCapBase = EXTRA_ENEMIES_CAP;
  const spawnMul = getEnemySpawnMultiplier(scene);
  const extraCap = Math.round(extraCapBase * spawnMul);
  const spawnPressure = getSpawnPressure(scene);
  const extraEnemies = Phaser.Math.Clamp(
    Math.round(extraCap * spawnPressure),
    0,
    extraCap
  );
  const phaseSpawnBonus = PHASE_SPAWN_AMOUNT_BONUS[phase] ?? 0;
  const totalToSpawn = 1 + extraEnemies + phaseSpawnBonus;

  const usePixel =
    USE_PIXEL_SPRITES && scene.textures && scene.textures.exists("entities");
  const difficulty = scene.enemyDifficultyFactor || 1;
  const speedFactor = scene.enemySpeedFactor ?? 1;

  for (let i = 0; i < totalToSpawn; i += 1) {
    if (scene.enemies.countActive(true) >= cap) break;

    const { x, y } = getRandomSpawnPosition(view, margin);
    const enemyType = pickSpawnType(scene);
    const textureKey = usePixel
      ? "entities"
      : enemyType === "shooter"
      ? "shooter"
      : "enemy";

    const enemy = scene.enemies.create(x, y, textureKey);
    enemy.setCollideWorldBounds(false);

    const typeCfg = ENEMY_TYPES[enemyType] || {};
    const speedMultiplier = typeCfg.speedMultiplier ?? 1;
    const baseMin = scene.enemyBaseSpeedMin * speedMultiplier;
    const baseMax = scene.enemyBaseSpeedMax * speedMultiplier;
    const speedMin = baseMin * speedFactor;
    const speedMax = baseMax * speedFactor;

    enemy.setData("speed", Phaser.Math.Between(speedMin, speedMax));
    initializeEnemyStats(scene, enemy, enemyType, difficulty);

    if (usePixel) {
      const mapping = getEntityMappingForEnemyType(enemyType);
      enemy.setData("entityIndex", mapping.entityIndex);
      enemy.setData("dirIndex", 4);
      const baseScale = getScaleForSize(mapping.size);
      enemy.setScale(baseScale);
      if (enemy.body && enemy.body.setCircle) {
        const radius =
          mapping.size === "small"
            ? 12
            : mapping.size === "large"
            ? 20
            : 14;
        const offset = 64 - radius;
        enemy.body.setCircle(radius, offset, offset);
      }
      const frame = getFrameIndex(mapping.entityIndex, 4);
      if (enemy.setFrame) enemy.setFrame(frame);
    } else {
      applyTierVisuals(enemy, enemyType);
    }
    let behavior;
    if (enemyType === "shooter") {
      behavior = "shooter_behavior";
      enemy.setData("nextShotAt", (scene.elapsedTime || 0) + 1.4);
      // Random preferred orbit angle to reduce shooter clustering.
      enemy.setData("preferredAngle", Math.random() * Math.PI * 2);
    } else {
      behavior = "monsters_behavior";
      const baseAggro = 260;
      const variance = 40;
      const aggroRadiusBase = baseAggro + Phaser.Math.Between(-variance, variance);
      const aggroRadiusMul = PHASE_AGGRO_RADIUS_MULTIPLIER[phase] ?? 1;
      enemy.setData("monsters_behaviorRoamAngle", Math.random() * Math.PI * 2);
      enemy.setData("monsters_behaviorAggro", false);
      enemy.setData("monsters_behaviorBaseAggroRadius", aggroRadiusBase);
      enemy.setData("monsters_behaviorAggroRadius", aggroRadiusBase * aggroRadiusMul);
    }
    enemy.setData("behavior", behavior);
  }
}

const GRID_CELL_SIZE = 64;

/**
 * Build a spatial hash grid to reduce neighbor search cost for separation/targeting.
 * @returns {{ grid: Map<string, import("phaser").GameObjects.GameObject[]>, enemies: import("phaser").GameObjects.GameObject[] }}
 */
export function buildEnemyGrid(scene, cellSize = GRID_CELL_SIZE) {
  const grid = new Map();
  const enemies = scene.enemies ? scene.enemies.getChildren() : [];
  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];
    if (!enemy || !enemy.active) continue;
    const cx = Math.floor(enemy.x / cellSize);
    const cy = Math.floor(enemy.y / cellSize);
    const key = `${cx},${cy}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(enemy);
  }
  return { grid, enemies };
}

function getNeighborsForSeparation(enemy, grid, cellSize) {
  const cx = Math.floor(enemy.x / cellSize);
  const cy = Math.floor(enemy.y / cellSize);
  const out = [];
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const key = `${cx + dx},${cy + dy}`;
      const list = grid.get(key);
      if (list) {
        for (let i = 0; i < list.length; i += 1) out.push(list[i]);
      }
    }
  }
  return out;
}

export function moveEnemiesTowardsPlayer(scene, builtOrGrid = null) {
  const player = scene.player;
  if (!player) return;
  const phase = getCurrentPhase(scene);
  const aggroRadiusMul = PHASE_AGGRO_RADIUS_MULTIPLIER[phase] ?? 1;
  const chaseSpeedMul = PHASE_AGGRO_CHASE_SPEED_MULTIPLIER[phase] ?? 1;
  const endlessMinutes = getEndlessMinutes(scene);
  const endlessChaseBonus = Phaser.Math.Clamp(endlessMinutes / 10, 0, 1);
  const endlessChaseMul = Phaser.Math.Linear(
    chaseSpeedMul,
    ENDLESS_CHASE_SPEED_MAX || 1.3,
    endlessChaseBonus
  );

  const cellSize = GRID_CELL_SIZE;
  let grid;
  let enemies;
  if (builtOrGrid && builtOrGrid.grid && Array.isArray(builtOrGrid.enemies)) {
    grid = builtOrGrid.grid;
    enemies = builtOrGrid.enemies;
  } else if (builtOrGrid && typeof builtOrGrid.get === "function") {
    grid = builtOrGrid;
    enemies = scene.enemies ? scene.enemies.getChildren() : [];
  } else {
    const built = buildEnemyGrid(scene, cellSize);
    grid = built.grid;
    enemies = built.enemies;
  }

  for (let idx = 0; idx < enemies.length; idx += 1) {
    const enemy = enemies[idx];
    if (!enemy || !enemy.active) continue;

    const knockUntil = enemy.getData("knockbackUntil") || 0;
    if ((scene.elapsedTime || 0) < knockUntil) {
      const dirX = enemy.getData("knockbackDirX") || 0;
      const dirY = enemy.getData("knockbackDirY") || 0;
      const kbSpeed = enemy.getData("knockbackSpeed") || 140;
      enemy.setVelocity(dirX * kbSpeed, dirY * kbSpeed);
      continue;
    }

    const speed = enemy.getData("speed") || 60;
    let speedScale = 1;
    const type = enemy.getData("type") || "grunt";
    const behaviorRaw = enemy.getData("behavior");
    const behavior =
      behaviorRaw ||
      (type === "shooter" ? "shooter_behavior" : "monsters_behavior");

    const baseAngle = Phaser.Math.Angle.Between(
      enemy.x,
      enemy.y,
      player.x,
      player.y
    );

    // Base movement direction vector.
    let dirX;
    let dirY;

    if (behavior === "shooter_behavior" && type === "shooter") {
      const dist = Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        player.x,
        player.y
      );
      const desiredMin = 220;
      const desiredMax = 320;

      if (dist < desiredMin * 0.85) {
        // too close: back away
        dirX = -Math.cos(baseAngle);
        dirY = -Math.sin(baseAngle);
      } else if (dist > desiredMax * 1.1) {
        // too far: move in
        dirX = Math.cos(baseAngle);
        dirY = Math.sin(baseAngle);
      } else {
        // maintain side-orbit tendency around player
        // keep a side-orbit tendency so shooters don't stack at one angle
        const currentAngle = Phaser.Math.Angle.Wrap(baseAngle + Math.PI);
        const preferred = enemy.getData("preferredAngle") ?? currentAngle;
        let diff = Phaser.Math.Angle.Wrap(preferred - currentAngle);
        const tangentSign = diff > 0 ? 1 : -1;
        const tangentWeight = 0.65;
        dirX = tangentSign * -Math.sin(currentAngle) * tangentWeight;
        dirY = tangentSign * Math.cos(currentAngle) * tangentWeight;
      }

      const now = scene.elapsedTime || 0;
      const nextShotAt = enemy.getData("nextShotAt") || 0;
      if (now >= nextShotAt) {
        fireRangedShot(scene, enemy, player);
        const progress = getShooterTimeProgress(scene);
        const endlessCdBonus = Math.min(0.25, endlessMinutes * 0.015);
        const cd = Math.max(1.6, 3 + (2 - 3) * progress - endlessCdBonus);
        enemy.setData("nextShotAt", now + cd);
      }
    } else {
      if (behavior === "monsters_behavior") {
        const distToPlayer = Phaser.Math.Distance.Between(
          enemy.x,
          enemy.y,
          player.x,
          player.y
        );
        const baseAggroRadius =
          enemy.getData("monsters_behaviorBaseAggroRadius") ||
          enemy.getData("monsters_behaviorAggroRadius") ||
          260;
        const aggroRadius = baseAggroRadius * aggroRadiusMul;
        enemy.setData("monsters_behaviorAggroRadius", aggroRadius);
        let monsters_behaviorAggro = enemy.getData("monsters_behaviorAggro");

        if (!monsters_behaviorAggro && distToPlayer <= aggroRadius) {
          monsters_behaviorAggro = true;
          enemy.setData("monsters_behaviorAggro", true);
        }

        if (monsters_behaviorAggro) {
          // Aggro: move directly toward player.
          dirX = Math.cos(baseAngle);
          dirY = Math.sin(baseAngle);
          speedScale *= endlessChaseMul;
        } else {
          // Roam: slowly wandering direction with jitter.
          let roamAngle = enemy.getData("monsters_behaviorRoamAngle");
          if (typeof roamAngle !== "number") {
            roamAngle = Math.random() * Math.PI * 2;
          }
          const jitter = Phaser.Math.FloatBetween(-0.08, 0.08);
          roamAngle += jitter;
          enemy.setData("monsters_behaviorRoamAngle", roamAngle);

          dirX = Math.cos(roamAngle);
          dirY = Math.sin(roamAngle);

          // Keep roaming slower to soften pressure.
          speedScale = 0.55;
        }
      } else {
        // Fallback: direct chase.
        dirX = Math.cos(baseAngle);
        dirY = Math.sin(baseAngle);
      }
    }

    // Separation: spread nearby enemies to reduce clumping (grid-based O(n*k)).
    let sepX = 0;
    let sepY = 0;
    let sepCount = 0;
    const separationRadius = 72;
    const separationRadiusSq = separationRadius * separationRadius;
    const neighbors = getNeighborsForSeparation(enemy, grid, cellSize);
    for (let i = 0; i < neighbors.length; i += 1) {
      const other = neighbors[i];
      if (!other || other === enemy || !other.active) continue;
      const dx = enemy.x - other.x;
      const dy = enemy.y - other.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > 0 && distSq < separationRadiusSq) {
        const dist = Math.sqrt(distSq) || 1;
        sepX += dx / dist;
        sepY += dy / dist;
        sepCount += 1;
      }
    }

    let finalDirX = dirX;
    let finalDirY = dirY;

    if (sepCount > 0) {
      const lenSep = Math.sqrt(sepX * sepX + sepY * sepY) || 1;
      const normSepX = sepX / lenSep;
      const normSepY = sepY / lenSep;

      // Separation blend weight.
      const w = 0.9;
      finalDirX += normSepX * w;
      finalDirY += normSepY * w;

      const lenFinal = Math.sqrt(
        finalDirX * finalDirX + finalDirY * finalDirY
      ) || 1;
      finalDirX /= lenFinal;
      finalDirY /= lenFinal;
    }

    // extra separation among shooters only
    if (type === "shooter") {
      let shSepX = 0;
      let shSepY = 0;
      let shCount = 0;
      const shooterSepRadius = 96;
      const shooterSepRadiusSq = shooterSepRadius * shooterSepRadius;
      for (let i = 0; i < neighbors.length; i += 1) {
        const other = neighbors[i];
        if (!other || other === enemy || !other.active) continue;
        if (other.getData && other.getData("type") !== "shooter") continue;
        const dx = enemy.x - other.x;
        const dy = enemy.y - other.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 0 && distSq < shooterSepRadiusSq) {
          const dist = Math.sqrt(distSq) || 1;
          shSepX += dx / dist;
          shSepY += dy / dist;
          shCount += 1;
        }
      }
      if (shCount > 0) {
        const lenSh = Math.sqrt(shSepX * shSepX + shSepY * shSepY) || 1;
        const shW = 1.2;
        finalDirX += (shSepX / lenSh) * shW;
        finalDirY += (shSepY / lenSh) * shW;
        const lenFinal = Math.sqrt(
          finalDirX * finalDirX + finalDirY * finalDirY
        ) || 1;
        finalDirX /= lenFinal;
        finalDirY /= lenFinal;
      }
    }

    const effectiveSpeed = speed * speedScale;
    const vx = finalDirX * effectiveSpeed;
    const vy = finalDirY * effectiveSpeed;

    enemy.setVelocity(vx, vy);

    if (USE_PIXEL_SPRITES && enemy.texture && enemy.texture.key === "entities") {
      const isMoving = vx !== 0 || vy !== 0;
      const prevDir =
        typeof enemy.getData("dirIndex") === "number"
          ? enemy.getData("dirIndex")
          : 4;

      let dirIndex = prevDir;
      if (isMoving) {
        dirIndex = getDirIndexFromVector(vx, vy, prevDir);
      }

      enemy.setData("dirIndex", dirIndex);

      const entityIndex = enemy.getData("entityIndex");
      if (typeof entityIndex === "number" && enemy.setFrame) {
        const frame = getFrameIndex(entityIndex, dirIndex);
        enemy.setFrame(frame);
      }
    }
  }
}

export function onEnemyHitByEnemyProjectile(scene, enemy, proj) {
  if (!scene || !enemy || !proj) return;
  if (!enemy.active || !proj.active) return;

  // ignore projectile collision with its source enemy
  if (proj.getData && proj.getData("sourceEnemy") === enemy) {
    return;
  }

  // Projectile disappears on first collision.
  if (proj.destroy) {
    proj.destroy();
  }

  // Ignore extra knockback while already in knockback state.
  const now = scene.elapsedTime || 0;
  const existingUntil = enemy.getData("knockbackUntil") || 0;
  if (now < existingUntil) return;

  let dirX = 0;
  let dirY = 0;

  // Prefer projectile velocity direction for knockback if available.
  const body = proj.body;
  if (body && typeof body.velocity === "object") {
    const vx = body.velocity.x || 0;
    const vy = body.velocity.y || 0;
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    dirX = vx / len;
    dirY = vy / len;
  } else {
    // Fallback: use vector from projectile position to enemy.
    const dx = enemy.x - proj.x;
    const dy = enemy.y - proj.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    dirX = dx / len;
    dirY = dy / len;
  }

  // No HP damage here; only short knockback.
  const kbSpeed = 140;
  const duration = 0.12;
  enemy.setData("knockbackDirX", dirX);
  enemy.setData("knockbackDirY", dirY);
  enemy.setData("knockbackSpeed", kbSpeed);
  enemy.setData("knockbackUntil", now + duration);
}

export function applyDamage(scene, enemy, damage, isCritical = false) {
  if (!enemy || !enemy.active) return false;

  const currentHp =
    enemy.getData("hp") ?? enemy.getData("maxHp") ?? 1;

  const nextHp = currentHp - (damage || 0);
  enemy.setData("hp", nextHp);

  // floating damage text
  if (damage && scene && scene.add && scene.tweens) {
    const dmgValue = Math.round(damage);
    const style = isCritical
      ? {
          fontFamily: "Mulmaru",
          fontSize: "18px",
          fill: "#ff5722",
          stroke: "#bf360c",
          strokeThickness: 3,
        }
      : {
          fontFamily: "Mulmaru",
          fontSize: "14px",
          fill: "#ffeb3b",
          stroke: "#000000",
          strokeThickness: 3,
        };
    const dmgText = scene.add
      .text(enemy.x, enemy.y - 18, `${dmgValue}`, style)
      .setOrigin(0.5)
      .setDepth(50);

    scene.tweens.add({
      targets: dmgText,
      y: dmgText.y - (isCritical ? 32 : 24),
      alpha: 0,
      duration: isCritical ? 650 : 500,
      ease: "Cubic.easeOut",
      onComplete: () => dmgText.destroy(),
    });
  }

  // Hit VFX: small on hit, larger on death.
  if (scene.hitEmitter) {
    const count = nextHp <= 0 ? 14 : 5;
    scene.hitEmitter.explode(count, enemy.x, enemy.y);
  }

  if (nextHp <= 0) {
    enemy.destroy();
    return true;
  }

  return false;
}

/** Remove enemy projectiles when elapsedTime reaches expireAt. */
export function updateEnemyProjectilesExpiry(scene, now) {
  if (!scene.enemyProjectiles) return;
  scene.enemyProjectiles.children.iterate((proj) => {
    if (!proj || !proj.active) return;
    if (!proj.getData) return;
    const expireAt =
      typeof proj.getData("expireAt") === "number"
        ? proj.getData("expireAt")
        : null;
    if (expireAt != null && now >= expireAt && proj.destroy) {
      proj.destroy();
    }
  });
}



