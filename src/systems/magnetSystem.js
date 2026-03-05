/** Coin magnet effect: pull nearby coins toward the player. */

const BASE_RADIUS = 150;
const PULL_SPEED = 450;

export function applyMagnetEffects(scene, dt) {
  const player = scene.player;
  if (!player || !scene.coins) return;

  const radiusSq = BASE_RADIUS * BASE_RADIUS;

  scene.coins.children.iterate((obj) => {
    if (!obj || !obj.active) return;
    const dx = player.x - obj.x;
    const dy = player.y - obj.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= 0 || distSq > radiusSq) return;

    const dist = Math.sqrt(distSq) || 1;
    const vx = (dx / dist) * PULL_SPEED;
    const vy = (dy / dist) * PULL_SPEED;
    if (obj.body && obj.body.setVelocity) {
      obj.body.setVelocity(vx, vy);
    } else if (obj.setVelocity) {
      obj.setVelocity(vx, vy);
    } else {
      obj.x += vx * dt;
      obj.y += vy * dt;
    }
  });
}
