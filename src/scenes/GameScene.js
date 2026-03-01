import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PLAYER_BASE_HP,
  PLAYER_BASE_SPEED,
  PLAYER_BASE_ATTACK,
  ENEMY_BASE_SPEED_MIN,
  ENEMY_BASE_SPEED_MAX,
  INITIAL_SPAWN_DELAY_MS,
  CELL_BASE_COUNT,
  CELL_MAX_COUNT,
  CELL_BASE_RADIUS,
  CELL_BASE_ROTATION_SPEED,
  INITIAL_ITEM_KILL_THRESHOLD,
  DEV_MODE,
  DEV_MAX_CAP,
  GAME_TIME_LIMIT_SEC,
  USE_PIXEL_SPRITES,
} from "../config/constants.js";
import { preloadGame } from "../loader/assetLoader.js";
import * as PlayerSystem from "../systems/playerSystem.js";
import * as EnemySystem from "../systems/enemySystem.js";
import * as DifficultySystem from "../systems/difficultySystem.js";
import * as CellSystem from "../systems/cellSystem.js";
import * as UpgradeSystem from "../systems/upgradeSystem.js";
import * as BadgeSystem from "../systems/badgeSystem.js";
import * as HudSystem from "../systems/hudSystem.js";
import * as CollisionSystem from "../systems/collisionSystem.js";
import * as PauseSystem from "../systems/pauseSystem.js";
import * as CompassSystem from "../systems/compassSystem.js";
import * as MagnetSystem from "../systems/magnetSystem.js";
import {
  getEntityIndexForPlayer,
  getFrameIndex,
  getScaleForSize,
} from "../render/entitySprites.js";
import { t } from "../i18n.js";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
  }

  preload() {
    preloadGame(this);
  }

  create() {
    const { width, height } = this.scale;
    const cam = this.cameras.main;

    // 메인 메뉴에서 전환 시 페이드 인
    const fadeInCurtain = this.add.graphics().setScrollFactor(0).setDepth(10000);
    fadeInCurtain.fillStyle(0x000000, 1);
    fadeInCurtain.fillRect(0, 0, cam.width, cam.height);
    this.tweens.add({
      targets: fadeInCurtain,
      alpha: 0,
      duration: 350,
      ease: "Power2.Out",
      onComplete: () => fadeInCurtain.destroy(),
    });

    this.score = 0;
    this.killCount = 0;
    this.playerMaxHp = DEV_MODE ? DEV_MAX_CAP : PLAYER_BASE_HP;
    this.playerHp = this.playerMaxHp;
    this.playerAttackPower = PLAYER_BASE_ATTACK;
    this.isGameOver = false;
    this.elapsedTime = 0;

    this.worldWidth = WORLD_WIDTH;
    this.worldHeight = WORLD_HEIGHT;
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // 픽셀 코인 시트가 있을 경우, 코인 프레임 인덱스 맵 구성
    this.coinFrames = null;
    if (USE_PIXEL_SPRITES) {
      const coinsMeta = this.cache.json.get("coins_manifest");
      const tiles = coinsMeta && Array.isArray(coinsMeta.tiles)
        ? coinsMeta.tiles
        : null;
      if (tiles) {
        const frames = {};
        for (let i = 0; i < tiles.length; i += 1) {
          const t = tiles[i];
          if (!t || !t.name) continue;
          if (t.name === "Coin_Copper") {
            frames.copper = typeof t.index === "number" ? t.index : i;
          } else if (t.name === "Coin_Silver") {
            frames.silver = typeof t.index === "number" ? t.index : i;
          } else if (t.name === "Coin_Gold") {
            frames.gold = typeof t.index === "number" ? t.index : i;
          } else if (t.name === "Coin_Diamond") {
            frames.diamond = typeof t.index === "number" ? t.index : i;
          }
        }
        this.coinFrames = frames;
      }
    }

    const playerTextureKey = USE_PIXEL_SPRITES ? "entities" : "player";

    this.player = this.physics.add.sprite(
      this.worldWidth / 2,
      this.worldHeight / 2,
      playerTextureKey
    );
    this.player.setCollideWorldBounds(true);
    this.basePlayerSpeed = PLAYER_BASE_SPEED;
    this.playerSpeed = this.basePlayerSpeed;

    if (USE_PIXEL_SPRITES) {
      const entityIndex = getEntityIndexForPlayer();
      const initialDirIndex = 4; // S (아래 방향)

      this.playerEntityIndex = entityIndex;
      this.lastPlayerDirIndex = initialDirIndex;

      const frame = getFrameIndex(entityIndex, initialDirIndex);
      if (this.player.setFrame) {
        this.player.setFrame(frame);
      }

      const baseScale = getScaleForSize("player");
      this.playerBaseScale = baseScale;
      this.player.setScale(baseScale);

      if (this.player.body && this.player.body.setCircle) {
        const radius = 16;
        const offset = 64 - radius;
        this.player.body.setCircle(radius, offset, offset);
      }
    } else {
      this.playerBaseScale = 1;
    }

    // Fragment 픽셀 애니메이션 정의
    if (
      USE_PIXEL_SPRITES &&
      this.anims &&
      this.textures &&
      this.textures.exists("fragments") &&
      !this.anims.exists("fragment_idle")
    ) {
      this.anims.create({
        key: "fragment_idle",
        frames: this.anims.generateFrameNumbers("fragments", {
          start: 0,
          end: 7,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }

    BadgeSystem.updatePlayerScaleFromBadges(this);

    this.showHpHeal = (amount) => PlayerSystem.showHpHeal(this, amount);
    this.showHpDamage = (amount) => PlayerSystem.showHpDamage(this, amount);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.enemies = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();
    this.items = this.physics.add.group();
    this.coins = this.physics.add.group();

    this.enemyBaseSpeedMin = ENEMY_BASE_SPEED_MIN;
    this.enemyBaseSpeedMax = ENEMY_BASE_SPEED_MAX;
    this.enemyDifficultyFactor = 1;
    this.enemySpeedFactor = 1;

    this.cellBaseCount = DEV_MODE ? 5 : CELL_BASE_COUNT;
    this.cellMaxCount = CELL_MAX_COUNT;
    this.cellBaseRadius = CELL_BASE_RADIUS;
    this.cellAngle = 0;
    this.cellRotationSpeed = CELL_BASE_ROTATION_SPEED;

    this.nextItemKillThreshold = INITIAL_ITEM_KILL_THRESHOLD;
    this.itemSpawnCount = 0; // 보물 스폰 횟수 (다음 보물까지 필요 킬을 증가시키는 데 사용)
    this.attackUpgradeCount = 0;

    // 뱃지 슬롯 시스템: 기본 3개, 최대 8개 (5분마다 +1)
    this.badgeSlotCount = 3;
    this.badgeSlotMax = 8;
    this.nextBadgeSlotUnlockTime = 5 * 60; // 5분 후 첫 슬롯 해금

    this.isPaused = false;
    this.isCountdownRunning = false;

    this.timeRemaining = GAME_TIME_LIMIT_SEC;
    HudSystem.createHud(this);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.worldWidth, this.worldHeight);
    camera.startFollow(this.player, true, 0.1, 0.1);

    PauseSystem.createPauseOverlay(this);
    CompassSystem.createCompass(this);

    // 적 피격/사망 시 사용할 히트 파티클
    this.hitEmitter = this.add.particles(0, 0, "bullet", {
      speed: { min: 80, max: 180 },
      lifespan: 220,
      scale: { start: 1.1, end: 0 },
      alpha: { start: 0.9, end: 0 },
      angle: { min: 0, max: 360 },
      quantity: 0,
      frequency: -1,
    });

    this.spawnEvent = this.time.addEvent({
      delay: INITIAL_SPAWN_DELAY_MS,
      callback: () => EnemySystem.spawnEnemy(this),
      loop: true,
    });

    this.cellActiveCount = this.cellBaseCount;
    CellSystem.initCellProjectiles(this);

    BadgeSystem.initBadgeState(this);

    HudSystem.updateDashboard(this);

    CollisionSystem.registerCollisions(this);

    // ESC 키로 일시정지 토글 (프래그먼트/업그레이드 선택 중에도 가능)
    this.input.keyboard.on("keydown-ESC", () => {
      if (this.isGameOver) return;
      if (this.isCountdownRunning) return;
      if (typeof window.isPauseConfirmVisible === "function" && window.isPauseConfirmVisible()) return;

      if (!this.isPaused) {
        PauseSystem.enterPause(this);
      } else {
        PauseSystem.startResumeCountdown(this);
      }
    });

    // 브라우저 포커스/비가시 상태에 따른 일시정지 처리
    if (this.game && this.game.events) {
      // 탭이 숨겨지거나 포커스를 잃을 때 (프래그먼트/업그레이드 선택 중에도 일시정지)
      this.game.events.on("hidden", () => {
        if (this.isGameOver) return;
        if (!this.isPaused && !this.isCountdownRunning) {
          PauseSystem.enterPause(this);
        }
      });
      this.game.events.on("blur", () => {
        if (this.isGameOver) return;
        if (!this.isPaused && !this.isCountdownRunning) {
          PauseSystem.enterPause(this);
        }
      });

      this.game.events.on("visible", () => {});
      this.game.events.on("focus", () => {});
    }
  }

  update(time, delta) {
    if (this.isGameOver) {
      return;
    }

    const dt = delta / 1000;

    // 일시정지 상태에서는 게임 로직 업데이트 중단 (UI용 타이머는 Phaser Time으로 동작)
    if (this.isPaused) {
      return;
    }

    // 프래그먼트 상자 업그레이드/뱃지 UI가 떠 있는 동안에는 게임 시간·난이도 진행을 멈춘다.
    if (this.isChoosingUpgrade) {
      return;
    }

    this.elapsedTime += dt;

    // 남은 시간 갱신 및 표시 (30:00 → 00:00)
    if (typeof GAME_TIME_LIMIT_SEC === "number" && this.timerText) {
      const total = GAME_TIME_LIMIT_SEC;
      const remaining = Math.max(0, Math.floor(total - this.elapsedTime));
      this.timeRemaining = remaining;
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      const text = `${m.toString().padStart(2, "0")}:${s
        .toString()
        .padStart(2, "0")}`;
      this.timerText.setText(text);

      // 5분(300초) 미만일 때만 노란색, 그 외에는 흰색
      if (remaining < 300) {
        this.timerText.setFill("#ffeb3b");
      } else {
        this.timerText.setFill("#ffffff");
      }

      // 30분이 지나면 자동 종료 (Clear)
      if (remaining <= 0) {
        this.endGame(true);
        return;
      }
    }

    // 5분마다 뱃지 슬롯 +1 (최대 7개)
    if (
      typeof this.badgeSlotCount === "number" &&
      typeof this.badgeSlotMax === "number" &&
      typeof this.nextBadgeSlotUnlockTime === "number" &&
      this.badgeSlotCount < this.badgeSlotMax &&
      this.elapsedTime >= this.nextBadgeSlotUnlockTime
    ) {
      this.badgeSlotCount += 1;
      this.nextBadgeSlotUnlockTime += 5 * 60;

      if (this.sound && this.sound.play) {
        this.sound.play("sfx_alert", { volume: 0.7 });
      }

      const centerX = this.scale ? this.scale.width / 2 : 400;
      const notif = this.add
        .text(centerX, 72, t("upgrade.badgeSlotsPlus1"), {
          fontFamily: "Mulmaru",
          fontSize: "22px",
          fill: "#ffe082",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setScrollFactor(0)
        .setOrigin(0.5, 0)
        .setDepth(20)
        .setAlpha(0);

      this.tweens.add({ targets: notif, alpha: 1, duration: 300 });
      this.time.delayedCall(2400, () => {
        this.tweens.add({
          targets: notif,
          alpha: 0,
          duration: 500,
          onComplete: () => notif.destroy(),
        });
      });
    }

    DifficultySystem.updateDifficultyScaling(this);
    // runner 뱃지: 시간 기반 속도 위에 배율 적용 (updateDifficultyScaling 이후에 적용해야 덮어쓰이지 않음)
    if (!DEV_MODE) {
      this.playerSpeed *= BadgeSystem.getPlayerSpeedMultiplier(this);
    }
    PlayerSystem.handleMovement(this);

    // 플레이어에서 너무 먼 적 제거 (화면 밖 300마리 쌓여 스폰이 막히는 것 방지)
    EnemySystem.cullDistantEnemies(this);

    // 적 그리드 1회 구성 → separation + 셀 타겟팅에서 재사용 (O(n²) → O(n×k))
    const enemyBuilt = EnemySystem.buildEnemyGrid(this, 64);
    this._enemyGrid = enemyBuilt.grid;
    EnemySystem.moveEnemiesTowardsPlayer(this, enemyBuilt);

    MagnetSystem.applyMagnetEffects(this, dt);

    const now = typeof this.elapsedTime === "number" ? this.elapsedTime : 0;

    UpgradeSystem.updateCoinLifetime(this, now);
    EnemySystem.updateEnemyProjectilesExpiry(this, now);

    CellSystem.updateCellProjectiles(this, dt);
    BadgeSystem.update(this, dt);
    BadgeSystem.updateRegenBadge(this, dt);

    CompassSystem.updateCompass(this);

    HudSystem.updateDashboard(this);
  }

  endGame(isClear = false) {
    if (this.isGameOver) {
      return;
    }
    this.isGameOver = true;

    const baseScore = this.score || 0;
    const finalScore = isClear ? Math.round(baseScore * 1.5) : baseScore;
    this.score = finalScore;

    if (this.player) {
      this.player.setVelocity(0, 0);
    }
    if (this.enemies) {
      this.enemies.clear(true, true);
    }

    if (this.sound && this.sound.play) {
      if (isClear) {
        this.sound.play("sfx_clear", { volume: 0.8 });
      } else {
        this.sound.play("sfx_game_over", { volume: 0.8 });
      }
    }

    if (typeof window.showGameOverOverlay === "function") {
      window.showGameOverOverlay(finalScore, isClear, baseScore);
    }
  }
}

