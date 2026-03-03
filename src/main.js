/** Phaser 吏꾩엯, ???깅줉, 濡쒖??셋룹삤踰꾨젅???곕룞 */
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
  const path = (typeof window !== "undefined" && window.location && window.location.pathname) || "/";
  const locale = path.startsWith("/ko/") ? "ko" : detectLocale();
  await setLocale(locale);
  const game = new Phaser.Game(config);
  setupOverlayCallbacks(game);
});

