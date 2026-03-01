/** Phaser 진입, 씬 등록, 로케일·오버레이 연동 */
import MainMenuScene from "./scenes/MainMenuScene.js";
import GameScene from "./scenes/GameScene.js";
import { setupOverlayCallbacks } from "./ui/overlayUi.js";
import { detectLocale, setLocale } from "./i18n.js";

const config = {
  type: Phaser.AUTO,
  transparent: true,
  parent: "game-container",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540,
  },
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
      gravity: { y: 0 },
    },
  },
  scene: [MainMenuScene, GameScene],
};

window.addEventListener("load", async () => {
  const locale = detectLocale();
  await setLocale(locale);
  const game = new Phaser.Game(config);
  setupOverlayCallbacks(game);
});

