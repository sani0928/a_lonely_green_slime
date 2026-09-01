import { ATTACK_UPGRADE_AMOUNTS, ATTACK_UPGRADE_MAX, CELL_MAX_COUNT } from "../config/constants.js";

export function upgradeChoices(state) {
  return [
    { id: "cell_count", disabled: state.cells.activeCount >= CELL_MAX_COUNT },
    { id: "attack", disabled: (state.attackUpgradeCount ?? 0) >= ATTACK_UPGRADE_MAX },
    { id: "hp", disabled: state.player.hp >= state.player.maxHp },
  ];
}

export function applyUpgradeChoice(state, choice) {
  if (!upgradeChoices(state).some((item) => item.id === choice && !item.disabled)) return false;
  if (choice === "cell_count") state.cells.activeCount += 1;
  if (choice === "attack") {
    const count = state.attackUpgradeCount ?? 0;
    state.player.attack += ATTACK_UPGRADE_AMOUNTS[count] ?? 0;
    state.attackUpgradeCount = count + 1;
  }
  if (choice === "hp") state.player.hp = Math.min(state.player.maxHp, state.player.hp + 2);
  return true;
}
