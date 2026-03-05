/** Compass arrow: points toward a fragment chest. */

const COMPASS_FADE_MS = 120;
const COMPASS_ALPHA = 0.9;
const COMPASS_SCALE_SHOWN = 1.6;
const COMPASS_SCALE_HIDDEN = 1.25;

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
  scene.compassArrow.setAlpha(0);
  scene.compassArrow.setVisible(false);
  scene.compassArrow.setScale(COMPASS_SCALE_HIDDEN);
  scene.compassVisibleTarget = false;
  scene.compassFadeTween = null;
}

const HIDE_RADIUS = 300;

function setCompassVisible(scene, shouldShow) {
  if (!scene.compassArrow) return;
  const arrow = scene.compassArrow;
  const target = !!shouldShow;
  if (scene.compassVisibleTarget === target) return;
  scene.compassVisibleTarget = target;

  if (scene.compassFadeTween) {
    scene.compassFadeTween.stop();
    scene.compassFadeTween = null;
  }

  if (!scene.tweens) {
    arrow.setVisible(target);
    arrow.setAlpha(target ? COMPASS_ALPHA : 0);
    arrow.setScale(target ? COMPASS_SCALE_SHOWN : COMPASS_SCALE_HIDDEN);
    return;
  }

  if (target) {
    arrow.setVisible(true);
    arrow.setScale(COMPASS_SCALE_HIDDEN);
    arrow.setAlpha(0);
    scene.compassFadeTween = scene.tweens.add({
      targets: arrow,
      alpha: COMPASS_ALPHA,
      scaleX: COMPASS_SCALE_SHOWN,
      scaleY: COMPASS_SCALE_SHOWN,
      duration: COMPASS_FADE_MS,
      ease: "Sine.easeOut",
      onComplete: () => {
        scene.compassFadeTween = null;
      },
    });
  } else {
    scene.compassFadeTween = scene.tweens.add({
      targets: arrow,
      alpha: 0,
      scaleX: COMPASS_SCALE_HIDDEN,
      scaleY: COMPASS_SCALE_HIDDEN,
      duration: COMPASS_FADE_MS,
      ease: "Sine.easeIn",
      onComplete: () => {
        arrow.setVisible(false);
        scene.compassFadeTween = null;
      },
    });
  }
}

export function updateCompass(scene) {
  if (!scene.compassArrow) return;

  if (
    scene.isPaused ||
    !scene.player ||
    !scene.items
  ) {
    setCompassVisible(scene, false);
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
      setCompassVisible(scene, false);
      return;
    }
    const idx = Math.floor(Math.random() * candidates.length);
    target = candidates[idx];
    scene.compassTargetFragment = target;
  }

  if (!target) {
    setCompassVisible(scene, false);
    return;
  }

  const px = scene.player.x;
  const py = scene.player.y;
  const dx = target.x - px;
  const dy = target.y - py;
  const distSq = dx * dx + dy * dy;
  if (distSq < HIDE_RADIUS * HIDE_RADIUS) {
    setCompassVisible(scene, false);
    return;
  }

  const angle = Math.atan2(dy, dx) + Math.PI / 2;
  scene.compassArrow.setRotation(angle);
  setCompassVisible(scene, true);
}
