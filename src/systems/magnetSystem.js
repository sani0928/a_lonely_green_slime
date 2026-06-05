/** Coin magnet effect: pull nearby coins toward the player. */

import { hasBadge } from "./badgeSystem.js";

const BASE_RADIUS = 80;
const PULL_SPEED = 450;
const STRONG_MAGNET_RADIUS = 300;
const STRONG_MAGNET_PULL_SPEED = 600;

export function applyMagnetEffects(scene, dt) {
  const player = scene.player;
  if (!player || !scene.coins) return;

  const hasStrongMagnet = hasBadge(scene, "strong_magnet");
  const radius = hasStrongMagnet ? STRONG_MAGNET_RADIUS : BASE_RADIUS;
  const pullSpeed = hasStrongMagnet ? STRONG_MAGNET_PULL_SPEED : PULL_SPEED;
  const radiusSq = radius * radius;

  scene.coins.children.iterate((obj) => {
    if (!obj || !obj.active) return;
    const dx = player.x - obj.x;
    const dy = player.y - obj.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= 0 || distSq > radiusSq) return;

    const dist = Math.sqrt(distSq) || 1;
    const vx = (dx / dist) * pullSpeed;
    const vy = (dy / dist) * pullSpeed;
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
