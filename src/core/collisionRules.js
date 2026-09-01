export function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function overlaps(a, b, radius) {
  return distanceSquared(a, b) <= radius * radius;
}

export function damagePlayer(state, amount, now) {
  if (state.player.invincibleUntil > now || state.finished) return false;
  state.player.hp = Math.max(0, state.player.hp - Math.max(1, Math.round(amount)));
  state.player.invincibleUntil = now + 1.5;
  if (state.player.hp === 0) state.finished = true;
  return true;
}
