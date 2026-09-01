import {
  ENEMY_BASE_HP,
  ENEMY_BASE_SPEED_MAX,
  ENEMY_BASE_SPEED_MIN,
  ENEMY_HP_PER_DIFFICULTY,
  ENEMY_TYPES,
} from "../config/constants.js";
import { createEntity } from "./combatState.js";
import { pickTier } from "./difficulty.js";

const TYPES_BY_TIER = {
  weak: ["runner", "mite"],
  mid: ["grunt", "soldier"],
  strong: ["brute", "titan"],
};

function elapsedOf(state) {
  return Number(state?.elapsed ?? state?.elapsedTime ?? 0);
}

export function createEnemy(state, random, position, difficultyFactor) {
  const tier = pickTier(random, state.killCount);
  const names = TYPES_BY_TIER[tier];
  const type = names[Math.floor(random() * names.length)];
  const config = ENEMY_TYPES[type] || {};
  const progress = Math.min(1, elapsedOf(state) / 900);
  const hp = Math.max(10, Math.round((config.baseHp ?? ENEMY_BASE_HP) + ENEMY_HP_PER_DIFFICULTY * (0.62 + progress * 0.2) * (difficultyFactor - 1)));
  const speedMultiplier = config.speedMultiplier ?? 1;
  const isShooter = type === "shooter";
  return createEntity(state, "enemy", {
    enemyType: type,
    x: position.x,
    y: position.y,
    hp,
    maxHp: hp,
    scoreValue: config.score ?? 10,
    speed: (ENEMY_BASE_SPEED_MIN + random() * (ENEMY_BASE_SPEED_MAX - ENEMY_BASE_SPEED_MIN)) * speedMultiplier,
    behavior: isShooter ? "shooter_behavior" : "monsters_behavior",
    nextShotAt: isShooter ? elapsedOf(state) + 1.4 : null,
    preferredAngle: isShooter ? random() * Math.PI * 2 : null,
    roamAngle: isShooter ? null : random() * Math.PI * 2,
    aggro: false,
    baseAggroRadius: isShooter ? null : 260 + Math.floor(random() * 81) - 40,
    knockbackUntil: 0,
  });
}

export function moveEnemyToward(enemy, player, dt, speedFactor = 1) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  enemy.x += (dx / distance) * enemy.speed * speedFactor * dt;
  enemy.y += (dy / distance) * enemy.speed * speedFactor * dt;
  return distance;
}

export function applyEnemyDamage(state, enemy, damage) {
  enemy.hp -= Math.max(1, Math.round(damage));
  if (enemy.hp > 0) return false;
  state.killCount += 1;
  state.score += enemy.scoreValue;
  return true;
}

export function enemySpeedFactorAt(elapsedSeconds) {
  return 1 + 0.5 * (1 - Math.exp(-Math.max(0, elapsedSeconds) / 420));
}

export function enemyChaseFactorAt(elapsedSeconds, phase) {
  const phaseFactor = phase === 3 ? 1.15 : phase === 2 ? 1.05 : 1;
  const endlessMinutes = Math.max(0, elapsedSeconds - 900) / 60;
  return phaseFactor + (1.3 - phaseFactor) * Math.min(1, endlessMinutes / 10);
}

function normalized(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

/** Framework-free counterpart of the regular enemy steering implementation. */
export function moveEnemies(state, dt, phase, random) {
  const enemies = state.enemies;
  const speedFactor = enemySpeedFactorAt(state.elapsed);
  const chaseFactor = enemyChaseFactorAt(state.elapsed, phase);
  const elapsed = elapsedOf(state);
  const nextProjectiles = [];

  for (const enemy of enemies) {
    if (elapsed < (enemy.knockbackUntil || 0)) {
      enemy.x += (enemy.knockbackX || 0) * 140 * dt;
      enemy.y += (enemy.knockbackY || 0) * 140 * dt;
      continue;
    }

    const toPlayer = normalized(state.player.x - enemy.x, state.player.y - enemy.y);
    const distance = Math.hypot(state.player.x - enemy.x, state.player.y - enemy.y);
    let direction = toPlayer;
    let speedScale = 1;
    if (enemy.enemyType === "shooter") {
      if (distance < 187) direction = { x: -toPlayer.x, y: -toPlayer.y };
      else if (distance >= 352) direction = toPlayer;
      else {
        const angle = Math.atan2(enemy.y - state.player.y, enemy.x - state.player.x);
        const difference = (enemy.preferredAngle ?? angle) - angle;
        const tangent = difference > 0 ? 1 : -1;
        direction = normalized(-Math.sin(angle) * tangent * 0.65, Math.cos(angle) * tangent * 0.65);
      }
      if (elapsed >= (enemy.nextShotAt || 0)) {
        const progress = Math.min(1, elapsed / 900);
        const endlessBonus = Math.min(40, Math.max(0, elapsed - 1200) / 60 * 4);
        nextProjectiles.push(createEntity(state, "enemyProjectile", {
          x: enemy.x, y: enemy.y, vx: toPlayer.x * (220 + (500 - 220) * progress + endlessBonus), vy: toPlayer.y * (220 + (500 - 220) * progress + endlessBonus), radius: 5, sourceEnemyId: enemy.id, expiresAt: elapsed + 2.6,
        }));
        const cd = Math.max(1.6, 3 - progress - Math.min(0.25, Math.max(0, elapsed - 900) / 60 * 0.015));
        enemy.nextShotAt = elapsed + cd;
      }
    } else {
      const aggroRadius = (enemy.baseAggroRadius || 260) * (phase === 3 ? 1.35 : phase === 2 ? 1.2 : 1);
      if (!enemy.aggro && distance <= aggroRadius) enemy.aggro = true;
      if (enemy.aggro) speedScale = chaseFactor;
      else {
        enemy.roamAngle = (enemy.roamAngle ?? random() * Math.PI * 2) + random() * 0.16 - 0.08;
        direction = { x: Math.cos(enemy.roamAngle), y: Math.sin(enemy.roamAngle) };
        speedScale = 0.55;
      }
    }

    let separationX = 0;
    let separationY = 0;
    for (const other of enemies) {
      if (other === enemy) continue;
      const dx = enemy.x - other.x;
      const dy = enemy.y - other.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > 0 && distanceSquared < 72 * 72) {
        const separation = normalized(dx, dy);
        separationX += separation.x;
        separationY += separation.y;
      }
    }
    if (separationX || separationY) {
      const separation = normalized(separationX, separationY);
      direction = normalized(direction.x + separation.x * 0.9, direction.y + separation.y * 0.9);
    }
    enemy.x += direction.x * enemy.speed * speedFactor * speedScale * dt;
    enemy.y += direction.y * enemy.speed * speedFactor * speedScale * dt;
  }
  state.enemyProjectiles.push(...nextProjectiles);
}
