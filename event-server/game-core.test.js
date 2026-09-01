import assert from "node:assert/strict";
import test from "node:test";

import { EventGameCore } from "./game-core.js";

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
