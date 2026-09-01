export function hasBadge(state, id) {
  return state.badgesEquipped.includes(id);
}

export function equipBadge(state, id, slot) {
  const index = Math.max(0, Math.min(7, slot | 0));
  while (state.badgesEquipped.length <= index) state.badgesEquipped.push(null);
  state.badgesEquipped[index] = id;
  if (!state.badgesOwned.includes(id)) state.badgesOwned.push(id);
}

export function scoreWithBadges(state, score) {
  if (hasBadge(state, "give_me_more_plus")) return Math.round(score * 2);
  if (hasBadge(state, "give_me_more")) return Math.round(score * 1.5);
  return score;
}
