/** 일시정지 오버레이 및 enterPause / 재개 카운트다운 */
import { t, getSettings } from "../i18n.js";
import { pauseInvincibility, resumeInvincibility } from "./playerSystem.js";

const COUNTDOWN_INTERVAL_NORMAL_MS = 1000;

export function createPauseOverlay(scene) {
  const { width, height } = scene.scale;

  scene.pauseOverlayBg = scene.add
    .rectangle(width / 2, height / 2, width, height, 0x000000, 0.45)
    .setScrollFactor(0)
    .setDepth(90)
    .setVisible(false);

  scene.pauseTitleText = scene.add
    .text(width / 2, height / 2 - 20, t("pause.paused"), {
      fontFamily: "Mulmaru",
      fontSize: "32px",
      fill: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(91)
    .setVisible(false);

  scene.pauseSubText = scene.add
    .text(width / 2, height / 2 + 16, t("pause.pressEscToResume"), {
      fontFamily: "Mulmaru",
      fontSize: "16px",
      fill: "#eeeeee",
      stroke: "#000000",
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(91)
    .setVisible(false);

  scene.countdownText = scene.add
    .text(width / 2, height / 2, "", {
      fontFamily: "Mulmaru",
      fontSize: "64px",
      fill: "#ffe082",
      stroke: "#000000",
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(92)
    .setVisible(false);
}

export function enterPause(scene) {
  if (scene.isPaused || scene.isGameOver) return;

  scene.isPaused = true;

  if (scene.physics && scene.physics.world) {
    scene.physics.world.pause();
  }
  if (scene.spawnEvent) {
    scene.spawnEvent.paused = true;
  }
  pauseInvincibility(scene);

  if (typeof window.showPauseOverlay === "function") {
    window.showPauseOverlay(scene);
  }
  if (scene.pauseOverlayBg) scene.pauseOverlayBg.setVisible(false);
  if (scene.pauseTitleText) scene.pauseTitleText.setVisible(false);
  if (scene.pauseSubText) scene.pauseSubText.setVisible(false);
  if (scene.countdownText) scene.countdownText.setVisible(false);
}

export function startResumeCountdown(scene) {
  if (!scene.isPaused || scene.isCountdownRunning || scene.isGameOver) return;

  scene.isCountdownRunning = true;
  if (typeof window.hidePauseOverlay === "function") {
    window.hidePauseOverlay();
  }

  const countdownIntervalMs =
    getSettings().resume_counting_speed === "fast"
      ? COUNTDOWN_INTERVAL_NORMAL_MS / 2
      : COUNTDOWN_INTERVAL_NORMAL_MS;
  const scaleTweenDuration = Math.max(80, Math.round(200 * (countdownIntervalMs / 1000)));

  let count = 3;
  if (scene.pauseOverlayBg) scene.pauseOverlayBg.setVisible(true);
  if (scene.pauseTitleText) scene.pauseTitleText.setVisible(false);
  if (scene.pauseSubText) scene.pauseSubText.setVisible(false);
  if (scene.countdownText) {
    scene.countdownText.setVisible(true);
    scene.countdownText.setText(String(count));
    scene.countdownText.setScale(1);
  }

  const tick = () => {
    count -= 1;
    if (count > 0) {
      if (scene.countdownText) {
        scene.countdownText.setText(String(count));
        if (scene.tweens) {
          scene.tweens.add({
            targets: scene.countdownText,
            scaleX: 1.2,
            scaleY: 1.2,
            yoyo: true,
            duration: scaleTweenDuration,
            ease: "Quad.easeOut",
          });
        }
      }
      scene.time.delayedCall(countdownIntervalMs, tick);
    } else {
      scene.isPaused = false;
      scene.isCountdownRunning = false;

      if (scene.pauseOverlayBg) scene.pauseOverlayBg.setVisible(false);
      if (scene.pauseTitleText) scene.pauseTitleText.setVisible(false);
      if (scene.pauseSubText) scene.pauseSubText.setVisible(false);
      if (scene.countdownText) scene.countdownText.setVisible(false);

      // 뱃지/업그레이드 선택 중에 일시정지에서 재개한 경우: 월드는 그대로 멈춰 두고 선택 화면만 다시 보이게 함
      if (!scene.isChoosingUpgrade) {
        if (scene.physics && scene.physics.world) {
          scene.physics.world.resume();
        }
        if (scene.spawnEvent) {
          scene.spawnEvent.paused = false;
        }
        resumeInvincibility(scene);
      }
    }
  };

  scene.time.delayedCall(countdownIntervalMs, tick);
}
