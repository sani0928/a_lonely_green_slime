/**
 * Framework-free event simulation. The browser only renders snapshots; this
 * module is the source of truth for time, movement, spawns, damage, and score.
 */
import { createRunState } from "../src/core/runState.js";
import { createSeededRandom } from "../src/core/random.js";
import { difficultyProfileAt } from "../src/core/difficulty.js";
import { moveWithinBounds } from "../src/core/movement.js";
import { applyEnemyDamage, createEnemy, moveEnemies } from "../src/core/enemyRules.js";
import { damagePlayer, overlaps } from "../src/core/collisionRules.js";
import { advanceCellAngle, cellPosition, nearestTarget } from "../src/core/cellRules.js";
import { applyUpgradeChoice } from "../src/core/upgradeRules.js";
const WORLD_SIZE = 3200;
const MAX_SECONDS = 60 * 60;
const CLEAR_SECONDS = 15 * 60;
const TICK_SECONDS = 1 / 20;

export class EventGameCore {
  constructor(seed, restored = null) {
    this.random = createSeededRandom(seed);
    this.seed = seed;
    const runState = createRunState();
    this.elapsed = runState.elapsedTime;
    this.score = runState.score;
    this.killCount = runState.killCount;
    this.player = { ...runState.player };
    this.cells = { ...runState.cells };
    this.input = { up: false, down: false, left: false, right: false };
    this.enemies = [];
    this.enemyProjectiles = [];
    this.cellProjectiles = [];
    this.coins = [];
    this.items = [];
    this.nextItemKillThreshold = 20;
    this.nextEnemyId = 1;
    this.nextEntityId = 1;
    this.spawnAccumulator = 0;
    this.finished = false;
    this.pendingChoice = null;
    this.attackUpgradeCount = 0;
    if (restored) this.restore(restored);
  }

  setInput(input) {
    for (const key of Object.keys(this.input)) this.input[key] = input?.[key] === true;
  }

  choose(choice) {
    if (!this.pendingChoice || !this.pendingChoice.includes(choice)) return false;
    const applied = applyUpgradeChoice(this, choice);
    if (applied) this.pendingChoice = null;
    return applied;
  }

  tick(dt = TICK_SECONDS) {
    if (this.finished) return;
    const step = Math.min(Math.max(0, Number(dt) || 0), 0.25);
    this.elapsed += step;
    this.movePlayer(step);
    advanceCellAngle(this.cells, step);
    this.spawnAccumulator += step;
    const profile = difficultyProfileAt(this.elapsed, this.playerStrength());
    const spawnDelay = profile.spawnDelaySeconds;
    const cap = profile.maxActiveEnemies;
    while (this.spawnAccumulator >= spawnDelay && this.enemies.length < cap) {
      this.spawnAccumulator -= spawnDelay;
      const amount = 1 + Math.round(4 * profile.pressure) + (profile.phase === 3 ? 3 : profile.phase === 2 ? 2 : 1);
      for (let count = 0; count < amount && this.enemies.length < cap; count += 1) this.spawnEnemy();
    }
    this.moveAndResolveEnemies(step);
    this.updateRewards(step);
    if (this.elapsed >= MAX_SECONDS || this.player.hp <= 0) this.finished = true;
  }

  playerStrength() {
    const extraCells = Math.max(0, this.cells.activeCount - 3);
    return Math.min(1, ((this.attackUpgradeCount || 0) + extraCells * 2) / 30);
  }

  movePlayer(dt) {
    const next = moveWithinBounds(
      this.player,
      this.input,
      this.elapsed,
      dt,
      { width: WORLD_SIZE, height: WORLD_SIZE },
      this.player.speed
    );
    this.player.x = next.x;
    this.player.y = next.y;
  }

  spawnEnemy() {
    const angle = this.random() * Math.PI * 2;
    const distance = 820 + this.random() * 420;
    const x = Math.min(WORLD_SIZE, Math.max(0, this.player.x + Math.cos(angle) * distance));
    const y = Math.min(WORLD_SIZE, Math.max(0, this.player.y + Math.sin(angle) * distance));
    const enemy = createEnemy(this, this.random, { x, y }, 1 + this.elapsed / 75);
    enemy.id = this.nextEnemyId++;
    this.enemies.push(enemy);
  }

  moveAndResolveEnemies(dt) {
    const profile = difficultyProfileAt(this.elapsed, this.playerStrength());
    moveEnemies(this, dt, profile.phase, this.random);
    this.enemyProjectiles = (this.enemyProjectiles || []).filter((projectile) => {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      if (this.elapsed >= projectile.expiresAt) return false;
      if (overlaps(projectile, this.player, 20)) {
        damagePlayer(this, 1, this.elapsed);
        return false;
      }
      return true;
    });
    this.enemies = this.enemies.filter((enemy) => {
      if (overlaps(enemy, this.player, 28)) damagePlayer(this, 1, this.elapsed);
      return enemy.hp > 0;
    });
    this.updateCellProjectiles(dt);
  }

  updateCellProjectiles(dt) {
    const activeIds = new Set(this.enemies.map((enemy) => enemy.id));
    for (let index = 0; index < this.cells.activeCount; index += 1) {
      let projectile = this.cellProjectiles[index];
      const orbit = cellPosition(this.player, this.cells, index);
      if (!projectile) {
        projectile = { id: index + 1, x: orbit.x, y: orbit.y, homing: false, returning: false, targetId: null, chainCount: 0 };
        this.cellProjectiles[index] = projectile;
      }
      const target = projectile.targetId ? this.enemies.find((enemy) => enemy.id === projectile.targetId) : null;
      if (projectile.homing && (!target || !activeIds.has(projectile.targetId))) {
        projectile.homing = false;
        projectile.returning = true;
        projectile.targetId = null;
      }
      if (projectile.returning) {
        const dx = orbit.x - projectile.x;
        const dy = orbit.y - projectile.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= 24) {
          projectile.x = orbit.x;
          projectile.y = orbit.y;
          projectile.returning = false;
        } else {
          const speed = Math.min(Math.max(440, this.player.speed * 1.6), distance * 8);
          projectile.x += (dx / distance) * speed * dt;
          projectile.y += (dy / distance) * speed * dt;
        }
        continue;
      }
      if (projectile.homing && target) {
        const dx = target.x - projectile.x;
        const dy = target.y - projectile.y;
        const distance = Math.hypot(dx, dy) || 1;
        projectile.x += (dx / distance) * 320 * dt;
        projectile.y += (dy / distance) * 320 * dt;
        if (distance <= 22) {
          const damage = Math.max(1, Math.round(this.player.attack * (0.8 + this.random() * 0.4)));
          if (applyEnemyDamage(this, target, damage)) {
            // The regular mode awards score when this coin is collected, not
            // when the enemy is destroyed.
            this.score -= target.scoreValue;
            this.spawnCoin(target.x, target.y, target.scoreValue);
            this.onEnemyKilled();
            this.enemies = this.enemies.filter((enemy) => enemy.id !== target.id);
          }
          projectile.homing = false;
          projectile.returning = true;
          projectile.targetId = null;
        }
        continue;
      }
      const nextTarget = nearestTarget(orbit, this.enemies, 280);
      if (nextTarget) {
        projectile.x = orbit.x;
        projectile.y = orbit.y;
        projectile.homing = true;
        projectile.targetId = nextTarget.id;
      } else {
        projectile.x = orbit.x;
        projectile.y = orbit.y;
      }
    }
    this.cellProjectiles.length = this.cells.activeCount;
  }

  spawnCoin(x, y, value) {
    this.coins.push({ id: this.nextEntityId++, x, y, value });
  }

  onEnemyKilled() {
    if (this.killCount < this.nextItemKillThreshold) return;
    this.items.push({
      id: this.nextEntityId++, kind: "fragment",
      x: 120 + this.random() * (WORLD_SIZE - 240),
      y: 120 + this.random() * (WORLD_SIZE - 240),
    });
    const add = 24 + Math.floor(this.killCount / 120) * 6;
    this.nextItemKillThreshold = this.killCount + Math.max(8, Math.round(add));
  }

  updateRewards(dt) {
    this.coins = this.coins.filter((coin) => {
      const dx = this.player.x - coin.x;
      const dy = this.player.y - coin.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && distance <= 80) {
        coin.x += (dx / distance) * 450 * dt;
        coin.y += (dy / distance) * 450 * dt;
      }
      if (Math.hypot(this.player.x - coin.x, this.player.y - coin.y) <= 28) {
        this.score += coin.value;
        return false;
      }
      return true;
    });
    for (const item of this.items) {
      if (this.pendingChoice || Math.hypot(this.player.x - item.x, this.player.y - item.y) > 36) continue;
      this.pendingChoice = ["cell_count", "attack", "hp"];
      item.picked = true;
    }
    this.items = this.items.filter((item) => !item.picked);
  }

  result() {
    const isClear = this.elapsed >= CLEAR_SECONDS;
    const score = isClear ? Math.round(this.score * 1.5) : this.score;
    return { score, play_seconds: Math.min(MAX_SECONDS, Number(this.elapsed.toFixed(2))), is_clear: isClear, state: this.snapshot() };
  }

  snapshot() {
    return {
      elapsed: Number(this.elapsed.toFixed(2)), score: this.score, kills: this.killCount, pendingChoice: this.pendingChoice, attackUpgradeCount: this.attackUpgradeCount, nextItemKillThreshold: this.nextItemKillThreshold,
      player: { ...this.player }, cells: { ...this.cells }, enemies: this.enemies.slice(0, 120).map(({ id, enemyType, x, y, hp, maxHp, speed, scoreValue }) => ({ id, type: enemyType, enemyType, x: Math.round(x), y: Math.round(y), hp: Math.round(hp), maxHp, speed, scoreValue })),
      cellProjectiles: this.cellProjectiles.map(({ id, x, y, homing, returning, targetId }) => ({ id, x: Math.round(x), y: Math.round(y), homing, returning, targetId })),
      coins: this.coins.slice(0, 180).map(({ id, x, y, value }) => ({ id, x: Math.round(x), y: Math.round(y), value })),
      items: this.items.slice(0, 8).map(({ id, kind, x, y }) => ({ id, kind, x: Math.round(x), y: Math.round(y) })),
      enemyProjectiles: this.enemyProjectiles.slice(0, 80).map(({ id, x, y, vx, vy, expiresAt, sourceEnemyId }) => ({ id, x: Math.round(x), y: Math.round(y), vx, vy, expiresAt, sourceEnemyId })),
      finished: this.finished,
    };
  }

  restore(state) {
    this.elapsed = Number(state.elapsed) || 0;
    this.score = Number(state.score) || 0;
    this.killCount = Number(state.kills) || 0;
    this.player = { ...this.player, ...(state.player || {}) };
    this.cells = { ...this.cells, ...(state.cells || {}) };
    this.enemies = Array.isArray(state.enemies)
      ? state.enemies.map((enemy) => ({ ...enemy, enemyType: enemy.enemyType || enemy.type }))
      : [];
    this.enemyProjectiles = Array.isArray(state.enemyProjectiles) ? state.enemyProjectiles.map((projectile) => ({ ...projectile })) : [];
    this.cellProjectiles = Array.isArray(state.cellProjectiles) ? state.cellProjectiles.map((projectile) => ({ ...projectile })) : [];
    this.coins = Array.isArray(state.coins) ? state.coins.map((coin) => ({ ...coin })) : [];
    this.items = Array.isArray(state.items) ? state.items.map((item) => ({ ...item })) : [];
    this.nextEnemyId = this.enemies.reduce((max, enemy) => Math.max(max, enemy.id || 0), 0) + 1;
    this.nextEntityId = Math.max(this.nextEnemyId, this.enemyProjectiles.reduce((max, projectile) => Math.max(max, projectile.id || 0), 0) + 1);
    this.finished = Boolean(state.finished);
    this.pendingChoice = Array.isArray(state.pendingChoice) ? state.pendingChoice : null;
    this.attackUpgradeCount = Number(state.attackUpgradeCount) || 0;
    this.nextItemKillThreshold = Number(state.nextItemKillThreshold) || this.nextItemKillThreshold;
  }
}
