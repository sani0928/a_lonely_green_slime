import { distanceSquared } from "./collisionRules.js";

export function cellPosition(player, cells, index) {
  const count = Math.max(1, cells.activeCount);
  const angle = cells.angle + (index / count) * Math.PI * 2;
  return {
    x: player.x + Math.cos(angle) * cells.radius,
    y: player.y + Math.sin(angle) * cells.radius,
  };
}

export function nearestTarget(origin, targets, radius, preferredType = null) {
  const preferred = preferredType ? targets.filter((target) => target.enemyType === preferredType || target.type === preferredType) : [];
  const pool = preferred.length ? preferred : targets;
  let nearest = null;
  let nearestDistance = radius * radius;
  for (const target of pool) {
    const distance = distanceSquared(origin, target);
    if (distance < nearestDistance) {
      nearest = target;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function advanceCellAngle(cells, dt) {
  cells.angle = (cells.angle ?? 0) + cells.rotationSpeed * dt;
}
