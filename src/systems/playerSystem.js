import {
  DAMAGE_INVINCIBLE_DURATION_MS,
  USE_PIXEL_SPRITES,
} from "../config/constants.js";
import { hasBadge } from "./badgeSystem.js";
import {
  getDirIndexFromVector,
  getEntityIndexForPlayer,
  getFrameIndex,
} from "../render/entitySprites.js";

export function handleMovement(scene) {
  const { cursors, wasd, playerSpeed, player } = scene;
  let vx = 0;
  let vy = 0;

  const up = cursors.up.isDown || wasd.up.isDown;
  const down = cursors.down.isDown || wasd.down.isDown;
  const left = cursors.left.isDown || wasd.left.isDown;
  const right = cursors.right.isDown || wasd.right.isDown;

  if (left) vx -= 1;
  if (right) vx += 1;
  if (up) vy -= 1;
  if (down) vy += 1;

  if (vx !== 0 && vy !== 0) {
    const norm = Math.sqrt(2);
    vx /= norm;
    vy /= norm;
  }

  player.setVelocity(vx * playerSpeed, vy * playerSpeed);

  if (!USE_PIXEL_SPRITES) {
    return;
  }

  const isMoving = vx !== 0 || vy !== 0;
  const prevDir =
    typeof scene.lastPlayerDirIndex === "number"
      ? scene.lastPlayerDirIndex
      : 4;

  let dirIndex = prevDir;
  if (isMoving) {
    dirIndex = getDirIndexFromVector(vx, vy, prevDir);
  }

  scene.lastPlayerDirIndex = dirIndex;

  const entityIndex =
    typeof scene.playerEntityIndex === "number"
      ? scene.playerEntityIndex
      : getEntityIndexForPlayer();

  const frame = getFrameIndex(entityIndex, dirIndex);
  if (player.setFrame) {
    player.setFrame(frame);
  }
}

export function onPlayerHitByEnemy(scene, player, enemy, hitMeta = null) {
  if (scene.isGameOver) {
    enemy.destroy();
    return;
  }
  if (scene.isInvincible) {
    enemy.destroy();
    return;
  }
  if (typeof scene.recordPlayerHit === "function") {
    scene.recordPlayerHit(hitMeta);
  }
  enemy.destroy();

  // 기본 피격 데미지: 1. Blood Hungry +1(총 2). Regen +1(총 2). 둘 다 있으면 3. (Critical은 적 공격 데미지에 적용)
  let damage = 1;
  if (hasBadge(scene, "blood_hungry")) damage += 1;
  if (hasBadge(scene, "regen")) damage += 1;

  scene.playerHp -= damage;
  const maxHp = scene.playerMaxHp ?? scene.playerHp;
  scene.hpText.setText(`${scene.playerHp}/${maxHp}`);

  if (damage > 0) {
    if (scene.sound && scene.sound.play) {
      scene.sound.play("sfx_hit", { volume: 0.8 });
    }
    if (typeof scene.showHpDamage === "function") {
      scene.showHpDamage(damage);
    }
  }

  flashOnHit(scene);

  if (scene.playerHp <= 0) {
    // HP가 0이 되어 사망한 경우: Game Over
    scene.endGame(false);
  }
}

export function flashOnHit(scene) {
  const { player } = scene;
  if (!player) return;

  if (scene.playerHitTween) {
    scene.playerHitTween.remove();
    player.setAlpha(1);
  }

  scene.isInvincible = true;
  scene.invincibleRemainingMs = null;
  scene.invincibleUntil = Date.now() + DAMAGE_INVINCIBLE_DURATION_MS;
  if (scene.invincibleTimer) {
    scene.invincibleTimer.remove(false);
  }
  scene.invincibleTimer = scene.time.delayedCall(
    DAMAGE_INVINCIBLE_DURATION_MS,
    () => {
      scene.isInvincible = false;
      scene.invincibleTimer = null;
      scene.invincibleUntil = null;
    }
  );

  const blinkDuration = 75;
  const repeat = Math.round(
    DAMAGE_INVINCIBLE_DURATION_MS / (blinkDuration * 2) - 1
  );

  scene.playerHitTween = scene.tweens.add({
    targets: player,
    alpha: 0.2,
    duration: blinkDuration,
    yoyo: true,
    repeat,
    onComplete: () => {
      player.setAlpha(1);
      scene.playerHitTween = null;
    },
  });

  if (USE_PIXEL_SPRITES) {
    const prevDir =
      typeof scene.lastPlayerDirIndex === "number"
        ? scene.lastPlayerDirIndex
        : 4;
    const entityIndex =
      typeof scene.playerEntityIndex === "number"
        ? scene.playerEntityIndex
        : getEntityIndexForPlayer();
    const frame = getFrameIndex(entityIndex, prevDir);
    if (player.setFrame) {
      player.setFrame(frame);
    }
  }
}

export function showHpHeal(scene, amount) {
  if (!scene.player || !scene.add || !scene.tweens) return;
  const healValue = Math.round(amount || 0);
  if (!healValue) return;

  if (scene.sound && scene.sound.play) {
    scene.sound.play("sfx_heal", { volume: 0.8 });
  }

  const text = scene.add
    .text(scene.player.x, scene.player.y - 28, `+${healValue}`, {
      fontFamily: "Mulmaru",
      fontSize: "14px",
      fill: "#81c784",
      stroke: "#000000",
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(60);

  scene.tweens.add({
    targets: text,
    y: text.y - 36,
    alpha: 0,
    duration: 2000,
    ease: "Quad.easeOut",
    onComplete: () => text.destroy(),
  });
}

export function showHpDamage(scene, amount) {
  if (!scene.player || !scene.add || !scene.tweens) return;
  const dmgValue = Math.round(amount || 0);
  if (!dmgValue) return;

  const text = scene.add
    .text(scene.player.x, scene.player.y - 32, `-${dmgValue}`, {
      fontFamily: "Mulmaru",
      fontSize: "14px",
      fill: "#ef5350",
      stroke: "#000000",
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(60);

  scene.tweens.add({
    targets: text,
    y: text.y - 24,
    alpha: 0,
    duration: 550,
    ease: "Cubic.easeOut",
    onComplete: () => text.destroy(),
  });
}

/** 일시정지/업그레이드 오버레이 진입 시 무적 타이머와 깜빡임 트윈 정지 */
export function pauseInvincibility(scene) {
  if (!scene.isInvincible || !scene.invincibleTimer) return;
  scene.invincibleTimer.remove(false);
  scene.invincibleTimer = null;
  scene.invincibleRemainingMs = Math.max(
    0,
    (scene.invincibleUntil || 0) - Date.now()
  );
  if (scene.playerHitTween && scene.playerHitTween.pause) {
    scene.playerHitTween.pause();
  }
}

/** 일시정지/업그레이드 오버레이 해제 시 무적 남은 시간으로 타이머·깜빡임 재개 */
export function resumeInvincibility(scene) {
  if (!scene.isInvincible) return;
  const remaining =
    scene.invincibleRemainingMs ??
    Math.max(0, (scene.invincibleUntil || 0) - Date.now());
  scene.invincibleRemainingMs = null;
  if (remaining <= 0) {
    scene.isInvincible = false;
    scene.invincibleUntil = null;
    if (scene.playerHitTween) {
      scene.playerHitTween.remove();
      scene.playerHitTween = null;
      if (scene.player) scene.player.setAlpha(1);
    }
    return;
  }
  scene.invincibleTimer = scene.time.delayedCall(remaining, () => {
    scene.isInvincible = false;
    scene.invincibleTimer = null;
    scene.invincibleUntil = null;
    if (scene.playerHitTween) {
      scene.playerHitTween.remove();
      scene.playerHitTween = null;
    }
    if (scene.player) scene.player.setAlpha(1);
  });
  if (scene.playerHitTween && scene.playerHitTween.resume) {
    scene.playerHitTween.resume();
  }
}

