import assert from "node:assert/strict";
import test from "node:test";

import { EventGameCore } from "./game-core.js";
import { createSeededRandom } from "../src/core/random.js";

test("event core uses only server input to move the player", () => {
  const core = new EventGameCore("test-seed");
  const before = core.snapshot().player.x;
  core.setInput({ right: true });
  core.tick(1);
  assert.ok(core.snapshot().player.x > before);
});

test("15-minute clear bonus is applied to the final score", () => {
  const core = new EventGameCore("bonus-seed");
  core.elapsed = 15 * 60;
  core.score = 101;
  assert.equal(core.result().score, 152);
  assert.equal(core.result().is_clear, true);
});

test("a run cannot advance beyond the 60-minute server cap", () => {
  const core = new EventGameCore("cap-seed");
  core.elapsed = 3599.9;
  core.tick(0.25);
  assert.equal(core.finished, true);
  assert.equal(core.result().play_seconds, 3600);
});

test("a restored run preserves server-owned cell and choice state", () => {
  const first = new EventGameCore("restore-seed");
  first.cells.angle = 3.14;
  first.pendingChoice = ["attack", "hp"];
  const restored = new EventGameCore("ignored", first.snapshot());
  assert.equal(restored.cells.angle, 3.14);
  assert.deepEqual(restored.pendingChoice, ["attack", "hp"]);
});

test("enemy kills advance the authoritative difficulty counter", () => {
  const core = new EventGameCore("kill-seed");
  core.enemies.push({ id: 1, enemyType: "runner", x: core.player.x + 50, y: core.player.y, hp: 1, maxHp: 1, speed: 0, scoreValue: 10 });
  core.moveAndResolveEnemies(0.25);
  core.moveAndResolveEnemies(0.25);
  assert.equal(core.killCount, 1);
  assert.equal(core.score, 0);
  assert.equal(core.coins.length, 1);
});

test("event core consumes the same seeded random stream as the shared client core", () => {
  const core = new EventGameCore("shared-seed");
  const random = createSeededRandom("shared-seed");
  assert.equal(core.random(), random());
  assert.equal(core.random(), random());
});

test("server-owned shooter projectiles are created and restored", () => {
  const core = new EventGameCore("shooter-seed");
  core.enemies.push({
    id: 1, enemyType: "shooter", x: core.player.x + 300, y: core.player.y,
    hp: 10, maxHp: 10, speed: 0, scoreValue: 50, preferredAngle: 0,
    nextShotAt: 0, baseAggroRadius: null,
  });
  core.moveAndResolveEnemies(0.1);
  assert.equal(core.enemyProjectiles.length, 1);
  const restored = new EventGameCore("ignored", core.snapshot());
  assert.equal(restored.enemyProjectiles.length, 1);
});

test("score is awarded only when a server-owned coin reaches the player", () => {
  const core = new EventGameCore("coin-seed");
  core.spawnCoin(core.player.x + 40, core.player.y, 20);
  assert.equal(core.score, 0);
  core.updateRewards(0.1);
  assert.equal(core.score, 20);
  assert.equal(core.coins.length, 0);
});
