/**
 * Framework-free event simulation. The browser only renders snapshots; this
 * module is the source of truth for time, movement, spawns, damage, and score.
 */
const WORLD_SIZE = 3200;
const MAX_SECONDS = 60 * 60;
const CLEAR_SECONDS = 15 * 60;
const TICK_SECONDS = 1 / 20;

function seededRandom(seed) {
  let value = 0;
  for (const char of String(seed)) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return ((value >>> 0) % 1_000_000) / 1_000_000;
  };
}

export class EventGameCore {
  constructor(seed, restored = null) {
    this.random = seededRandom(seed);
    this.seed = seed;
    this.elapsed = 0;
    this.score = 0;
    this.kills = 0;
    this.player = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, hp: 5, maxHp: 10, attack: 12 };
    this.input = { up: false, down: false, left: false, right: false };
    this.enemies = [];
    this.nextEnemyId = 1;
    this.spawnAccumulator = 0;
    this.finished = false;
    if (restored) this.restore(restored);
  }

  setInput(input) {
    for (const key of Object.keys(this.input)) this.input[key] = input?.[key] === true;
  }

  tick(dt = TICK_SECONDS) {
    if (this.finished) return;
    const step = Math.min(Math.max(0, Number(dt) || 0), 0.25);
    this.elapsed += step;
    this.movePlayer(step);
    this.spawnAccumulator += step;
    const phase = this.elapsed >= 600 ? 3 : this.elapsed >= 300 ? 2 : 1;
    const spawnDelay = phase === 1 ? 0.62 : phase === 2 ? 0.42 : 0.28;
    const cap = this.elapsed >= CLEAR_SECONDS ? 700 : phase === 1 ? 200 : phase === 2 ? 400 : 600;
    while (this.spawnAccumulator >= spawnDelay && this.enemies.length < cap) {
      this.spawnAccumulator -= spawnDelay;
      this.spawnEnemy();
    }
    this.moveAndResolveEnemies(step);
    if (this.elapsed >= MAX_SECONDS || this.player.hp <= 0) this.finished = true;
  }

  movePlayer(dt) {
    const dx = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const dy = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
    const length = Math.hypot(dx, dy) || 1;
    const speed = 240 + (320 - 240) * (1 - Math.exp(-this.elapsed / 500));
    this.player.x = Math.min(WORLD_SIZE, Math.max(0, this.player.x + (dx / length) * speed * dt));
    this.player.y = Math.min(WORLD_SIZE, Math.max(0, this.player.y + (dy / length) * speed * dt));
  }

  spawnEnemy() {
    const edge = Math.floor(this.random() * 4);
    const offset = this.random() * WORLD_SIZE;
    const position = edge === 0 ? { x: offset, y: 0 } : edge === 1 ? { x: WORLD_SIZE, y: offset } : edge === 2 ? { x: offset, y: WORLD_SIZE } : { x: 0, y: offset };
    const tier = this.random();
    const score = tier < 0.4 ? 10 : tier < 0.8 ? 20 : 30;
    this.enemies.push({ id: this.nextEnemyId++, ...position, hp: score === 10 ? 23 : score === 20 ? 40 : 70, speed: 50 + this.random() * 55, score });
  }

  moveAndResolveEnemies(dt) {
    const difficulty = 1 + this.elapsed / 75;
    const survivors = [];
    for (const enemy of this.enemies) {
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      enemy.x += (dx / distance) * enemy.speed * Math.min(1.5, 1 + this.elapsed / 420) * dt;
      enemy.y += (dy / distance) * enemy.speed * Math.min(1.5, 1 + this.elapsed / 420) * dt;
      // Cells are server-side auto attacks. The range and cadence preserve the
      // current game's automatic-combat model without trusting client hits.
      if (distance < 120) enemy.hp -= this.player.attack * dt * 2.4;
      if (enemy.hp <= 0) {
        this.kills += 1;
        this.score += enemy.score;
      } else if (distance < 28) {
        this.player.hp = Math.max(0, this.player.hp - Math.ceil(difficulty * dt * 0.35));
        survivors.push(enemy);
      } else {
        survivors.push(enemy);
      }
    }
    this.enemies = survivors;
  }

  result() {
    const isClear = this.elapsed >= CLEAR_SECONDS;
    const score = isClear ? Math.round(this.score * 1.5) : this.score;
    return { score, play_seconds: Math.min(MAX_SECONDS, Number(this.elapsed.toFixed(2))), is_clear: isClear, state: this.snapshot() };
  }

  snapshot() {
    return {
      elapsed: Number(this.elapsed.toFixed(2)), score: this.score, kills: this.kills,
      player: { ...this.player }, enemies: this.enemies.slice(0, 120).map(({ id, x, y, hp }) => ({ id, x: Math.round(x), y: Math.round(y), hp: Math.round(hp) })),
      finished: this.finished,
    };
  }

  restore(state) {
    this.elapsed = Number(state.elapsed) || 0;
    this.score = Number(state.score) || 0;
    this.kills = Number(state.kills) || 0;
    this.player = { ...this.player, ...(state.player || {}) };
    this.enemies = Array.isArray(state.enemies) ? state.enemies : [];
    this.nextEnemyId = this.enemies.reduce((max, enemy) => Math.max(max, enemy.id || 0), 0) + 1;
    this.finished = Boolean(state.finished);
  }
}
