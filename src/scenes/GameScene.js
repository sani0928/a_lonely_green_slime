import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PLAYER_BASE_HP,
  PLAYER_BASE_SPEED,
  PLAYER_BASE_ATTACK,
  PLAYER_MAX_HP_CAP,
  ENEMY_BASE_SPEED_MIN,
  ENEMY_BASE_SPEED_MAX,
  INITIAL_SPAWN_DELAY_MS,
  CELL_BASE_COUNT,
  CELL_MAX_COUNT,
  CELL_BASE_RADIUS,
  CELL_BASE_ROTATION_SPEED,
  INITIAL_ITEM_KILL_THRESHOLD,
  DEV_MODE,
  CLEAR_TIME_SEC,
  USE_PIXEL_SPRITES,
  PHASE_GRID_TRANSITION_MS,
  PHASE_GRID_COLOR_P1,
  PHASE_GRID_COLOR_P2,
  PHASE_GRID_COLOR_P3,
  PHASE_GRID_MAJOR_ALPHA_BASE,
  PHASE_GRID_MAJOR_ALPHA_AMPLITUDE,
  PHASE_GRID_MAJOR_WAVE_SPEED_HZ,
  PHASE_GRID_MAJOR_HIGHLIGHT_COLOR,
  PHASE_GRID_MAJOR_WAVE_COLOR_BLEND,
  PHASE_GRID_MAJOR_WIDTH_BASE,
  PHASE_GRID_MAJOR_WIDTH_AMPLITUDE,
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
import {
  getOrCreateAnonymousId,
  getNextRunId,
  submitPlayLog,
} from "../api/scoreApi.js";
import { t } from "../i18n.js";
import {
  playSceneBgm,
  stopSceneBgm,
  switchSceneBgm,
} from "../systems/bgmSystem.js";

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
    // Fade in when entering from the main menu.
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
    this.playerMaxHp = PLAYER_MAX_HP_CAP;
    this.playerHp = PLAYER_BASE_HP;
    this.playerAttackPower = PLAYER_BASE_ATTACK;
    this.isGameOver = false;
    this.isClearAchieved = false;
    this.clearAchievedAtSec = null;
    this.clearAchievedAnnounced = false;
    this.elapsedTime = 0;
    this.playLogSent = false;
    this.playLogStartedAt = new Date().toISOString();
    this.playLogAnonymousId = getOrCreateAnonymousId();
    this.playLogRunId = getNextRunId();
    this.playLogStats = {
      contactHits: 0,
      projectileHits: 0,
      shooterContactHits: 0,
      shooterProjectileHits: 0,
    };
    this.playLogSnapshots = [];
    this.playLogNextSnapshotAtSec = 60;
    this.recordPlayerHit = (hitMeta) => {
      if (!this.playLogStats) return;
      const source =
        hitMeta && typeof hitMeta.source === "string"
          ? hitMeta.source
          : "contact";
      const isShooter = !!(hitMeta && hitMeta.isShooter);

      if (source === "projectile") {
        this.playLogStats.projectileHits += 1;
        if (isShooter) this.playLogStats.shooterProjectileHits += 1;
      } else {
        this.playLogStats.contactHits += 1;
        if (isShooter) this.playLogStats.shooterContactHits += 1;
      }
    };
    this.capturePlaySnapshot = (snapshotSec = this.elapsedTime || 0) => {
      const sec = Math.max(0, Math.floor(snapshotSec));
      const minute = Math.floor(sec / 60);
      const equippedBadges =
        typeof BadgeSystem.getEquippedBadges === "function"
          ? BadgeSystem.getEquippedBadges(this) || []
          : [];
      const badges = equippedBadges.filter((id) => typeof id === "string");

      this.playLogSnapshots.push({
        t_sec: sec,
        minute,
        hp: Math.max(0, Math.round(this.playerHp || 0)),
        max_hp: Math.max(0, Math.round(this.playerMaxHp || 0)),
        cells: Math.max(0, Math.round(this.cellActiveCount || 0)),
        attack: Math.max(0, Math.round(this.playerAttackPower || 0)),
        badges,
        kills: Math.max(0, Math.round(this.killCount || 0)),
      });
    };

    this.worldWidth = WORLD_WIDTH;
    this.worldHeight = WORLD_HEIGHT;
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.bgFill = this.add
      .rectangle(0, 0, this.worldWidth, this.worldHeight, 0x0c1218)
      .setOrigin(0, 0)
      .setDepth(-200);
    this.bgGrid = this.add.graphics().setDepth(-190);
    this.bgGridTransitionTween = null;
    this.currentVisualPhase = DifficultySystem.getCurrentPhase(this);
    this.currentGridColor = this.getGridColorForPhase(this.currentVisualPhase);
    this.currentMajorGridWave = this.getMajorGridWaveState(this.currentGridColor);
    this.bgGridWaveLastDrawAt = 0;
    this.drawBackgroundGrid(
      this.currentGridColor,
      this.currentMajorGridWave.alpha,
      this.currentMajorGridWave.color,
      this.currentMajorGridWave.width
    );
    playSceneBgm(this, "bgm_game_phase1");
    // Build coin frame indices when pixel coin sheet exists.
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
      const initialDirIndex = 4; // S (down)

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
    // Define fragment idle animation when sprite assets are available.
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

    this.cellBaseCount = CELL_BASE_COUNT;
    this.cellMaxCount = CELL_MAX_COUNT;
    this.cellBaseRadius = CELL_BASE_RADIUS;
    this.cellAngle = 0;
    this.cellRotationSpeed = CELL_BASE_ROTATION_SPEED;

    this.nextItemKillThreshold = INITIAL_ITEM_KILL_THRESHOLD;
    this.itemSpawnCount = 0; // Number of spawned fragment chests, used for progressive kill thresholds.
    this.attackUpgradeCount = 0;
    // Badge slots: start at 3, increase every 5 minutes, capped at 8.
    this.badgeSlotCount = 3;
    this.badgeSlotMax = 8;
    this.nextBadgeSlotUnlockTime = 5 * 60; // First slot unlock at 5 minutes.

    this.isPaused = false;
    this.isCountdownRunning = false;

    this.timeRemaining = 0;
    HudSystem.createHud(this);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.worldWidth, this.worldHeight);
    camera.startFollow(this.player, true, 0.1, 0.1);

    PauseSystem.createPauseOverlay(this);
    CompassSystem.createCompass(this);

    // Hit effect particles for contact/projectile collisions.
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
    if (DEV_MODE) {
      this.setupDevDebugTools();
    }

    this.events.once("shutdown", () => {
      stopSceneBgm(this, 0);
    });
    this.events.once("destroy", () => {
      stopSceneBgm(this, 0);
    });
    // Toggle pause with ESC (also available during upgrade selection).
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

    // Auto-pause when the tab loses visibility or focus.
    if (this.game && this.game.events) {
      // Pause when hidden or blurred (also while upgrade UI is open).
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

  getGridColorForPhase(phase) {
    if (phase === 2) return PHASE_GRID_COLOR_P2;
    if (phase === 3) return PHASE_GRID_COLOR_P3;
    return PHASE_GRID_COLOR_P1;
  }

  blendColor(fromColor, toColor, t) {
    const clamped = Phaser.Math.Clamp(t, 0, 1);
    const fr = (fromColor >> 16) & 0xff;
    const fg = (fromColor >> 8) & 0xff;
    const fb = fromColor & 0xff;
    const tr = (toColor >> 16) & 0xff;
    const tg = (toColor >> 8) & 0xff;
    const tb = toColor & 0xff;
    const r = Math.round(fr + (tr - fr) * clamped);
    const g = Math.round(fg + (tg - fg) * clamped);
    const b = Math.round(fb + (tb - fb) * clamped);
    return (r << 16) | (g << 8) | b;
  }

  getMajorGridWaveState(baseColor) {
    const phase = DifficultySystem.getCurrentPhase(this);
    const base = PHASE_GRID_MAJOR_ALPHA_BASE[phase] ?? 0.42;
    const amp = PHASE_GRID_MAJOR_ALPHA_AMPLITUDE[phase] ?? 0.06;
    const hz = PHASE_GRID_MAJOR_WAVE_SPEED_HZ[phase] ?? 0.22;
    const highlightColor = PHASE_GRID_MAJOR_HIGHLIGHT_COLOR[phase] ?? 0xffffff;
    const blendMax = PHASE_GRID_MAJOR_WAVE_COLOR_BLEND[phase] ?? 0.2;
    const widthBase = PHASE_GRID_MAJOR_WIDTH_BASE[phase] ?? 2;
    const widthAmp = PHASE_GRID_MAJOR_WIDTH_AMPLITUDE[phase] ?? 0.2;
    const elapsed = typeof this.elapsedTime === "number" ? this.elapsedTime : 0;
    const wave = Math.sin(elapsed * Math.PI * 2 * hz);
    const wave01 = (wave + 1) * 0.5;
    const alpha = Phaser.Math.Clamp(base + amp * wave, 0, 1);
    const color = this.blendColor(baseColor, highlightColor, wave01 * blendMax);
    const width = widthBase + widthAmp * wave01;
    return { alpha, color, width };
  }

  drawBackgroundGrid(color, majorAlpha = 0.42, majorColor = color, majorWidth = 2) {
    if (!this.bgGrid) return;
    this.bgGrid.clear();
    this.bgGrid.lineStyle(1, color, 0.28);

    const majorSpacing = 256;
    const minorSpacing = 64;

    for (let x = 0; x <= this.worldWidth; x += minorSpacing) {
      this.bgGrid.lineBetween(x, 0, x, this.worldHeight);
    }
    for (let y = 0; y <= this.worldHeight; y += minorSpacing) {
      this.bgGrid.lineBetween(0, y, this.worldWidth, y);
    }

    this.bgGrid.lineStyle(majorWidth, majorColor, majorAlpha);
    for (let x = 0; x <= this.worldWidth; x += majorSpacing) {
      this.bgGrid.lineBetween(x, 0, x, this.worldHeight);
    }
    for (let y = 0; y <= this.worldHeight; y += majorSpacing) {
      this.bgGrid.lineBetween(0, y, this.worldWidth, y);
    }
  }

  updateVisualPhase() {
    const nextPhase = DifficultySystem.getCurrentPhase(this);
    if (nextPhase === this.currentVisualPhase) return;

    const fromColor = this.currentGridColor;
    const toColor = this.getGridColorForPhase(nextPhase);
    this.currentVisualPhase = nextPhase;

    if (nextPhase === 2) {
      this.showPhaseAlert(t("phaseAlert.phase2"));
      switchSceneBgm(this, "bgm_game_phase2", 800);
    } else if (nextPhase === 3) {
      this.showPhaseAlert(t("phaseAlert.phase3"));
      switchSceneBgm(this, "bgm_game_phase3", 800);
    }

    if (this.bgGridTransitionTween) {
      this.bgGridTransitionTween.stop();
      this.bgGridTransitionTween = null;
    }

    this.bgGridTransitionTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: PHASE_GRID_TRANSITION_MS,
      ease: "Sine.easeInOut",
      onUpdate: (tween) => {
        const value = tween.getValue();
        const color = this.blendColor(fromColor, toColor, value);
        this.currentGridColor = color;
        this.currentMajorGridWave = this.getMajorGridWaveState(color);
        this.drawBackgroundGrid(
          color,
          this.currentMajorGridWave.alpha,
          this.currentMajorGridWave.color,
          this.currentMajorGridWave.width
        );
      },
      onComplete: () => {
        this.currentGridColor = toColor;
        this.currentMajorGridWave = this.getMajorGridWaveState(toColor);
        this.drawBackgroundGrid(
          toColor,
          this.currentMajorGridWave.alpha,
          this.currentMajorGridWave.color,
          this.currentMajorGridWave.width
        );
        this.bgGridTransitionTween = null;
      },
    });
  }

  showPhaseAlert(message, styleOverride = null, options = null) {
    if (!message) return;
    if (this.phaseAlertText && this.phaseAlertText.destroy) {
      this.phaseAlertText.destroy();
      this.phaseAlertText = null;
    }
    if (this.phaseAlertSubText && this.phaseAlertSubText.destroy) {
      this.phaseAlertSubText.destroy();
      this.phaseAlertSubText = null;
    }

    const resolvedStyle = {
      fill: "#ffeb3b",
      stroke: "#000000",
      strokeThickness: 6,
      ...(styleOverride || {}),
    };
    const centerX = this.scale ? this.scale.width / 2 : 480;
    const centerY = this.scale ? this.scale.height / 2 : 270;
    const text = this.add
      .text(centerX, centerY, message, {
        fontFamily: "Mulmaru",
        fontSize: "40px",
        fill: resolvedStyle.fill,
        stroke: resolvedStyle.stroke,
        strokeThickness: resolvedStyle.strokeThickness,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3000)
      .setAlpha(0);

    this.phaseAlertText = text;
    const subMessage =
      options && typeof options.subMessage === "string" ? options.subMessage : "";
    let subText = null;
    if (subMessage) {
      subText = this.add
        .text(centerX, centerY + 42, subMessage, {
          fontFamily: "Mulmaru",
          fontSize: "18px",
          fill: "#d7ffd9",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(2999)
        .setAlpha(0);
      this.phaseAlertSubText = subText;
    }

    const blink = !!(options && options.blink);
    if (blink) {
      if (subText) {
        subText.setAlpha(1);
      }
      this.tweens.add({
        targets: text,
        alpha: { from: 0, to: 1 },
        duration: 120,
        ease: "Linear",
        yoyo: true,
        repeat: 5,
        hold: 30,
        onComplete: () => {
          if (text && text.destroy) text.destroy();
          if (this.phaseAlertText === text) this.phaseAlertText = null;
          if (subText && subText.destroy) subText.destroy();
          if (this.phaseAlertSubText === subText) this.phaseAlertSubText = null;
        },
      });
      return;
    }

    this.tweens.add({
      targets: text,
      alpha: 1,
      duration: 220,
      ease: "Quad.easeOut",
      yoyo: true,
      hold: 900,
      onComplete: () => {
        if (text && text.destroy) text.destroy();
        if (this.phaseAlertText === text) this.phaseAlertText = null;
        if (subText && subText.destroy) subText.destroy();
        if (this.phaseAlertSubText === subText) this.phaseAlertSubText = null;
      },
    });
    if (subText) {
      this.tweens.add({
        targets: subText,
        alpha: 1,
        duration: 220,
        ease: "Quad.easeOut",
        yoyo: true,
        hold: 900,
      });
    }
  }

  setupDevDebugTools() {
    this.devDebugLastUpdateAt = 0;
    this.devDebugText = this.add
      .text(12, 12, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#7CFFB2",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setDepth(2000);

    this.input.keyboard.on("keydown-F2", () => {
      if (this.isGameOver) return;
      this.elapsedTime = Math.max(0, (this.elapsedTime || 0) + 60);
      this.updateVisualPhase();
      DifficultySystem.updateDifficultyScaling(this);
      this.updateDevDebugOverlay(true);
    });

    this.input.keyboard.on("keydown-F4", () => {
      if (this.isGameOver) return;
      if (this.isPaused || this.isCountdownRunning || this.isChoosingUpgrade) return;
      const debugFragmentItem = { active: true, destroy: () => {} };
      UpgradeSystem.onPlayerPickupItem(this, this.player, debugFragmentItem);
      this.updateDevDebugOverlay(true);
    });
  }

  updateDevDebugOverlay(force = false) {
    if (!DEV_MODE || !this.devDebugText) return;
    const nowMs = this.time?.now ?? 0;
    if (!force && nowMs - this.devDebugLastUpdateAt < 200) return;
    this.devDebugLastUpdateAt = nowMs;

    const phase = DifficultySystem.getCurrentPhase(this);
    const cap = DifficultySystem.getMaxActiveEnemies(this);
    const active = this.enemies ? this.enemies.countActive(true) : 0;
    let shooters = 0;
    if (this.enemies) {
      this.enemies.children.iterate((enemy) => {
        if (!enemy || !enemy.active) return;
        if (enemy.getData("type") === "shooter") shooters += 1;
      });
    }

    const fps = this.game?.loop?.actualFps ?? 0;
    const delayMs = this.spawnEvent?.delay ?? 0;
    const elapsed = this.elapsedTime || 0;

    this.devDebugText.setText(
      [
        `[DEV] t=${elapsed.toFixed(1)}s phase=${phase}`,
        `enemies=${active}/${cap} shooters=${shooters}`,
        `spawnDelay=${Math.round(delayMs)}ms fps=${Math.round(fps)}`,
        "F2:+60s F4:openUpgrade",
      ].join("\n")
    );
  }

  update(time, delta) {
    if (this.isGameOver) {
      return;
    }

    const dt = delta / 1000;

    // Stop gameplay updates while paused (UI timers still run via Phaser Time).
    if (this.isPaused) {
      return;
    }

    // Freeze game-time progression while upgrade/badge selection UI is open.
    if (this.isChoosingUpgrade) {
      return;
    }

    this.elapsedTime += dt;
    while (this.elapsedTime >= this.playLogNextSnapshotAtSec) {
      this.capturePlaySnapshot(this.playLogNextSnapshotAtSec);
      this.playLogNextSnapshotAtSec += 60;
    }
    this.updateVisualPhase();
    if (!this.bgGridTransitionTween) {
      const nowMs = this.time?.now ?? 0;
      if (nowMs - this.bgGridWaveLastDrawAt >= 50) {
        this.currentMajorGridWave = this.getMajorGridWaveState(this.currentGridColor);
        this.drawBackgroundGrid(
          this.currentGridColor,
          this.currentMajorGridWave.alpha,
          this.currentMajorGridWave.color,
          this.currentMajorGridWave.width
        );
        this.bgGridWaveLastDrawAt = nowMs;
      }
    }
    this.updateDevDebugOverlay();

    // Update elapsed timer (00:00 -> death time).
    if (this.timerText) {
      const elapsed = Math.max(0, Math.floor(this.elapsedTime));
      this.timeRemaining = elapsed;
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      const text = `${m.toString().padStart(2, "0")}:${s
        .toString()
        .padStart(2, "0")}`;
      this.timerText.setText(text);

      if (elapsed >= CLEAR_TIME_SEC) {
        this.timerText.setFill("#66bb6a");
      } else {
        this.timerText.setFill("#ffffff");
      }

      if (!this.isClearAchieved && this.elapsedTime >= CLEAR_TIME_SEC) {
        this.isClearAchieved = true;
        this.clearAchievedAtSec = this.elapsedTime;
      }
    }
    if (this.isClearAchieved && !this.clearAchievedAnnounced) {
      this.clearAchievedAnnounced = true;
      this.showPhaseAlert(t("overlay.clear"), { fill: "#66bb6a" }, {
        blink: true,
        subMessage: t("overlay.clearAfterBonusHint"),
      });
      if (this.sound && this.sound.play) {
        this.sound.play("sfx_clear", { volume: 0.75 });
      }
    }

    // Increase badge slots by +1 every 5 minutes (up to the max).
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
    // Apply runner badge multiplier after base difficulty scaling.
    this.playerSpeed *= BadgeSystem.getPlayerSpeedMultiplier(this);
    PlayerSystem.handleMovement(this);

    // Cull enemies far from the player to prevent off-screen buildup.
    EnemySystem.cullDistantEnemies(this);

    // Build one enemy grid and reuse it for separation and cell targeting (O(n^2) -> O(n*k)).
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

    const clearAchieved = this.isClearAchieved || isClear;
    const baseScore = this.score || 0;
    const finalScore = clearAchieved ? Math.round(baseScore * 1.5) : baseScore;
    this.score = finalScore;

    if (!this.playLogSent) {
      this.playLogSent = true;
      submitPlayLog({
        anonymous_id: this.playLogAnonymousId,
        run_id: this.playLogRunId,
        started_at: this.playLogStartedAt,
        ended_at: new Date().toISOString(),
        play_seconds: Number((this.elapsedTime || 0).toFixed(2)),
        contact_hits: this.playLogStats?.contactHits || 0,
        projectile_hits: this.playLogStats?.projectileHits || 0,
        shooter_contact_hits: this.playLogStats?.shooterContactHits || 0,
        shooter_projectile_hits: this.playLogStats?.shooterProjectileHits || 0,
        kills_total: this.killCount || 0,
        final_score: finalScore,
        is_clear: !!clearAchieved,
        snapshots: this.playLogSnapshots || [],
      }).catch(() => {});
    }

    if (this.player) {
      this.player.setVelocity(0, 0);
    }
    stopSceneBgm(this, 250);
    if (this.enemies) {
      this.enemies.clear(true, true);
    }

    if (this.sound && this.sound.play) {
      if (clearAchieved) {
        this.sound.play("sfx_clear_ending", { volume: 0.8 });
      } else {
        this.sound.play("sfx_game_over_ending", { volume: 0.8 });
      }
    }

    if (typeof window.showGameOverOverlay === "function") {
      window.showGameOverOverlay(finalScore, clearAchieved, baseScore);
    }
  }
}

