import { PLAYER_SPEED_CAP, PLAYER_SPEED_RAMP_SEC } from "../config/constants.js";

export function movementVector(input = {}) {
  let x = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let y = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (x && y) {
    const inverse = 1 / Math.sqrt(2);
    x *= inverse;
    y *= inverse;
  }
  return { x, y };
}

export function playerSpeedAt(elapsedSeconds, baseSpeed) {
  const cap = PLAYER_SPEED_CAP ?? 320;
  const ramp = PLAYER_SPEED_RAMP_SEC ?? 500;
  return baseSpeed + (cap - baseSpeed) * (1 - Math.exp(-Math.max(0, elapsedSeconds) / ramp));
}

export function moveWithinBounds(player, input, elapsedSeconds, dt, bounds, baseSpeed) {
  const vector = movementVector(input);
  const speed = playerSpeedAt(elapsedSeconds, baseSpeed);
  return {
    x: Math.min(bounds.width, Math.max(0, player.x + vector.x * speed * dt)),
    y: Math.min(bounds.height, Math.max(0, player.y + vector.y * speed * dt)),
    speed,
    vector,
  };
}
