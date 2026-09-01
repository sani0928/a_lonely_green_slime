import { createRunState } from "./runState.js";

/** Framework-free state shape shared by browser and event server. */
export function createCombatState(seed) {
  const run = createRunState();
  return {
    version: 1,
    seed: String(seed ?? ""),
    tick: 0,
    elapsedTime: run.elapsedTime,
    score: run.score,
    killCount: run.killCount,
    player: { ...run.player },
    cells: { ...run.cells },
    enemies: [],
    enemyProjectiles: [],
    bosses: [],
    bossProjectiles: [],
    coins: [],
    items: [],
    pendingChoice: null,
    attackUpgradeCount: 0,
    badgesEquipped: [],
    badgesOwned: [],
    paused: false,
    finished: false,
    nextEntityId: 1,
  };
}

export function createEntity(state, type, fields = {}) {
  const id = state.nextEntityId++;
  return { id, type, ...fields };
}

export function snapshotCombatState(state) {
  return structuredClone(state);
}

export function restoreCombatState(snapshot) {
  if (!snapshot || snapshot.version !== 1) throw new Error("Unsupported combat state.");
  return structuredClone(snapshot);
}
