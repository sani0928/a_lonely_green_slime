/** 게임 에셋 preload (스프라이트, 오디오, 런타임 텍스처) */
import { USE_PIXEL_SPRITES } from "../config/constants.js";

export function preloadGame(scene) {
  if (USE_PIXEL_SPRITES) {
    scene.load.spritesheet(
      "entities",
      "assets/sprites/player_and_monsters.png",
      { frameWidth: 128, frameHeight: 128 }
    );
    scene.load.spritesheet("coins", "assets/sprites/coins.png", {
      frameWidth: 128,
      frameHeight: 128,
    });
    scene.load.json("coins_manifest", "assets/sprites/coins_manifest.json");
    scene.load.spritesheet("fragments", "assets/sprites/fragment.png", {
      frameWidth: 128,
      frameHeight: 128,
    });
    scene.load.json("fragments_manifest", "assets/sprites/fragment_manifest.json");

    const gfx = scene.add.graphics();
    gfx.fillStyle(0xb0bec5, 1);
    gfx.fillRect(0, 0, 6, 6);
    gfx.generateTexture("bullet", 6, 6);
    gfx.destroy();
  } else {
    const gfx = scene.add.graphics();
    gfx.fillStyle(0x4caf50, 1);
    gfx.fillRect(0, 0, 24, 24);
    gfx.generateTexture("player", 24, 24);
    gfx.clear();
    gfx.fillStyle(0xf44336, 1);
    gfx.fillRect(0, 0, 20, 20);
    gfx.generateTexture("enemy", 20, 20);
    gfx.clear();
    gfx.fillStyle(0xffd54f, 1);
    gfx.fillCircle(10, 10, 10);
    gfx.generateTexture("shooter", 20, 20);
    gfx.clear();
    gfx.fillStyle(0xffeb3b, 1);
    gfx.fillRect(0, 0, 8, 8);
    gfx.generateTexture("coin", 8, 8);
    gfx.clear();
    gfx.fillStyle(0xb0bec5, 1);
    gfx.fillRect(0, 0, 6, 6);
    gfx.generateTexture("bullet", 6, 6);
    gfx.destroy();
  }

  scene.load.audio("sfx_attack_1", "assets/audio/attack1.wav");
  scene.load.audio("sfx_attack_2", "assets/audio/attack2.wav");
  scene.load.audio("sfx_attack_3", "assets/audio/attack3.wav");
  scene.load.audio("sfx_pachinko", "assets/audio/Pachinko.m4a");
  scene.load.audio("sfx_tab", "assets/audio/tab.wav");
  scene.load.audio("sfx_select", "assets/audio/select.wav");
  scene.load.audio("sfx_alert", "assets/audio/alert.wav");
  scene.load.audio("sfx_clear", "assets/audio/clear.wav");
  scene.load.audio("sfx_game_over", "assets/audio/game_over.flac");
  scene.load.audio("sfx_pickup", "assets/audio/pickup.mp3");
  scene.load.audio("sfx_pickup_fragment", "assets/audio/pickup_fragment.wav");
  scene.load.audio("sfx_heal", "assets/audio/heal.wav");
  scene.load.audio("sfx_hit", "assets/audio/hit.wav");

  scene.load.audio("bgm_game_phase1", "assets/audio/game_bgm_phase1.mp3");
  scene.load.audio("bgm_game_phase2", "assets/audio/game_bgm_phase2.mp3");
  scene.load.audio("bgm_game_phase3", "assets/audio/game_bgm_phase3.mp3");
}
