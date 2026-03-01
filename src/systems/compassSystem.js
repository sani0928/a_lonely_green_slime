/** 나침반(Compass) 뱃지: 프래그먼트 상자 방향 화살표 */
import * as BadgeSystem from "./badgeSystem.js";

export function createCompass(scene) {
  const { width } = scene.scale;

  scene.compassArrow = scene.add.graphics();
  scene.compassArrow.fillStyle(0xffeb3b, 1);
  scene.compassArrow.fillTriangle(0, -12, -8, 10, 8, 10);
  scene.compassArrow.lineStyle(4, 0x000000);
  scene.compassArrow.lineBetween(0, -12, -8, 10);
  scene.compassArrow.lineBetween(-8, 10, 8, 10);
  scene.compassArrow.lineBetween(8, 10, 0, -12);
  scene.compassArrow.setPosition(width / 2, 160);
  scene.compassArrow.setScrollFactor(0);
  scene.compassArrow.setDepth(15);
  scene.compassArrow.setAlpha(0.9);
  scene.compassArrow.setVisible(false);
  scene.compassArrow.setScale(1.6);
}

const HIDE_RADIUS = 300;

export function updateCompass(scene) {
  if (!scene.compassArrow) return;

  if (
    scene.isPaused ||
    !BadgeSystem.hasBadge(scene, "compass") ||
    !scene.player ||
    !scene.items
  ) {
    scene.compassArrow.setVisible(false);
    scene.compassTargetFragment = null;
    return;
  }

  let target = scene.compassTargetFragment;
  if (
    !target ||
    !target.active ||
    (target.getData && !target.getData("isFragment"))
  ) {
    const candidates = [];
    scene.items.children.iterate((item) => {
      if (!item || !item.active) return;
      if (item.getData && !item.getData("isFragment")) return;
      candidates.push(item);
    });
    if (candidates.length === 0) {
      scene.compassTargetFragment = null;
      scene.compassArrow.setVisible(false);
      return;
    }
    const idx = Math.floor(Math.random() * candidates.length);
    target = candidates[idx];
    scene.compassTargetFragment = target;
  }

  if (!target) {
    scene.compassArrow.setVisible(false);
    return;
  }

  const px = scene.player.x;
  const py = scene.player.y;
  const dx = target.x - px;
  const dy = target.y - py;
  const distSq = dx * dx + dy * dy;
  if (distSq < HIDE_RADIUS * HIDE_RADIUS) {
    scene.compassArrow.setVisible(false);
    return;
  }

  const angle = Math.atan2(dy, dx) + Math.PI / 2;
  scene.compassArrow.setRotation(angle);
  scene.compassArrow.setVisible(true);
}
