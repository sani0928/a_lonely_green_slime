import assert from "node:assert/strict";
import test from "node:test";

import { createSeededRandom } from "../src/core/random.js";
import { moveWithinBounds } from "../src/core/movement.js";
import { damagePlayer } from "../src/core/collisionRules.js";
import { nearestTarget } from "../src/core/cellRules.js";
import { applyUpgradeChoice } from "../src/core/upgradeRules.js";
import { createCombatState } from "../src/core/combatState.js";
import { equipBadge, scoreWithBadges } from "../src/core/badgeRules.js";

test("shared random stream is reproducible", () => {
  const first = createSeededRandom("same-seed");
  const second = createSeededRandom("same-seed");
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
});

test("shared movement normalizes diagonal input and clamps bounds", () => {
  const result = moveWithinBounds({ x: 99, y: 99 }, { right: true, down: true }, 0, 1, { width: 100, height: 100 }, 240);
  assert.equal(result.x, 100);
  assert.equal(result.y, 100);
});

test("shared damage observes invincibility", () => {
  const state = { finished: false, player: { hp: 5, invincibleUntil: 0 } };
  assert.equal(damagePlayer(state, 1, 10), true);
  assert.equal(damagePlayer(state, 1, 11), false);
  assert.equal(state.player.hp, 4);
});

test("cells choose the nearest valid target", () => {
  const target = nearestTarget({ x: 0, y: 0 }, [{ id: 1, x: 30, y: 0 }, { id: 2, x: 10, y: 0 }], 100);
  assert.equal(target.id, 2);
});

test("upgrade choices change only server-owned state", () => {
  const state = createCombatState("upgrade");
  assert.equal(applyUpgradeChoice(state, "attack"), true);
  assert.equal(state.player.attack, 17);
  assert.equal(applyUpgradeChoice(state, "unknown"), false);
});

test("badge score modifiers are server-state based", () => {
  const state = createCombatState("badge");
  equipBadge(state, "give_me_more", 0);
  assert.equal(scoreWithBadges(state, 10), 15);
});
