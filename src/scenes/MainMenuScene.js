import { USE_PIXEL_SPRITES } from "../config/constants.js";
import {
  getFrameIndex,
  getScaleForSize,
  getDirIndexFromVector,
} from "../render/entitySprites.js";
import { t, getSfxAttackKey } from "../i18n.js";
import { showSettingsOverlay } from "../ui/settingsOverlay.js";
import { showGuideOverlay } from "../ui/guideOverlay.js";
import { showLeaderboardOverlay } from "../ui/leaderboardOverlay.js";
import { showNicknameOverlay } from "../ui/nicknameOverlay.js";
import { showEventOverlay } from "../ui/eventOverlay.js";
import {
  applyBgmEnabled,
  getBgmEnabled,
  getBgmToggleLabel,
  playSceneBgm,
  resumeAudioContext,
  stopSceneBgm,
} from "../systems/bgmSystem.js";

const WANDER_SPEED = 28;
const FLEE_SPEED = 160;
const FLEE_RADIUS = 140;
const MARGIN = 50;
const PLAYER_ENTITY_INDEX = 0;
const MONSTER_CAP = 200;
const CELL_HOMING_SPEED = 900;
const CELL_HIT_RADIUS = 20;
const CELL_AFTERIMAGE_INTERVAL_MS = 16;
const SPAWN_MARGIN = 40;

// Retro pixel palette for the main menu.
const PIXEL = {
  borderLight: 0x4a4a4a,
  borderDark: 0x1a1a1a,
  titleFill: 0xffe135,
  titleStroke: 0x1a0a2e,
  btnStartFill: 0x228b22,
  btnStartBorder: 0x32cd32,
  btnStartHighlight: 0x7cfc00,
  btnStartText: 0xe0ffe0,
  btnSubFill: 0x2d2d44,
  btnSubBorder: 0x4a4a6a,
  btnSubHighlight: 0x6a6a8a,
  btnSubText: 0xb8b8d0,
};

const SIZE_BY_ENTITY_INDEX = [
  "player",
  "small",
  "small",
  "medium",
  "medium",
  "large",
  "large",
  "medium",
];

/** Pick a random position along the menu bounds edge. */
function randomEdgePosition(b) {
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) return { x: b.left + Math.random() * (b.right - b.left), y: b.top };
  if (edge === 1) return { x: b.right, y: b.top + Math.random() * (b.bottom - b.top) };
  if (edge === 2) return { x: b.left + Math.random() * (b.right - b.left), y: b.bottom };
  return { x: b.left, y: b.top + Math.random() * (b.bottom - b.top) };
}

/** Spawn outside the menu bounds, similar to gameplay edge spawns. */
function spawnEdgePosition(b, margin = SPAWN_MARGIN) {
  const side = Math.floor(Math.random() * 4);
  switch (side) {
    case 0:
      return { x: b.left + Math.random() * (b.right - b.left), y: b.top - margin };
    case 1:
      return { x: b.right + margin, y: b.top + Math.random() * (b.bottom - b.top) };
    case 2:
      return { x: b.left + Math.random() * (b.right - b.left), y: b.bottom + margin };
    default:
      return { x: b.left - margin, y: b.top + Math.random() * (b.bottom - b.top) };
  }
}

/** Draw an NES-style pixel button box. */
function drawPixelButton(graphics, x, y, w, h, fill, borderLight, borderDark, borderWidth = 3) {
  const bw = borderWidth;
  graphics.fillStyle(fill, 1);
  graphics.fillRect(x + bw, y + bw, w - bw * 2, h - bw * 2);
  graphics.fillStyle(borderLight, 1);
  graphics.fillRect(x, y, w, bw);
  graphics.fillRect(x, y, bw, h);
  graphics.fillStyle(borderDark, 1);
  graphics.fillRect(x, y + h - bw, w, bw);
  graphics.fillRect(x + w - bw, y, bw, h);
}

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenu");
  }

  preload() {
    if (USE_PIXEL_SPRITES) {
      this.load.spritesheet(
        "entities",
        "assets/sprites/player_and_monsters.png",
        { frameWidth: 128, frameHeight: 128 }
      );
    }
    this.load.audio("sfx_attack_1", "assets/audio/attack1.wav");
    this.load.audio("sfx_attack_2", "assets/audio/attack2.wav");
    this.load.audio("sfx_attack_3", "assets/audio/attack3.wav");
    this.load.audio("sfx_play", "assets/audio/play.wav");
    this.load.audio("bgm_menu", "assets/audio/mainmenu_bgm.mp3");
  }

  create() {
    const { width, height } = this.cameras.main;
    const cam = this.cameras.main;
    if (cam.setRoundPixels) cam.setRoundPixels(true);

    // CRT-style scanlines for the main menu.
    const scanlines = this.add.graphics();
    this.scanlines = scanlines;
    scanlines.lineStyle(1, 0x000000, 0.08);
    for (let sy = 0; sy < height; sy += 4) {
      scanlines.lineBetween(0, sy, width, sy);
    }
    scanlines.strokePath();
    scanlines.setScrollFactor(0).setDepth(100);

    // Title text with a thick outline.
    const titleY = Math.floor(height * 0.22);
    const title = this.add
      .text(width / 2, titleY, t("menu.title"), {
        fontFamily: "Mulmaru",
        fontSize: "48px",
        color: "#329e39",
      })
      .setOrigin(0.5)
      .setStroke("#0a0a0a", 6)
      .setDepth(2);
    title.setShadow(2, 2, "#000000", 4, true);
    this.titleText = title;

    this.menuBgmToggleText = this.add
      .text(width - 14, height - 14, getBgmToggleLabel(), {
        fontFamily: "Mulmaru",
        fontSize: "18px",
        color: "#f5f5f5",
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        padding: { left: 10, right: 10, top: 6, bottom: 6 },
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(110)
      .setInteractive({ useHandCursor: true });

    this.menuBgmToggleText.on("pointerdown", async (pointer) => {
      pointer?.event?.stopPropagation?.();
      await resumeAudioContext(this);
      const next = !getBgmEnabled();
      applyBgmEnabled(this, next);
      this.updateMenuBgmToggleText();
    });

    playSceneBgm(this, "bgm_menu");
    this.bindBgmGestureUnlock();

    // Main menu buttons.
    const btnW = 200;
    const btnH = 44;
    const btnGap = 10;
    const startX = (width - btnW) / 2;
    const startY = Math.floor(height * 0.4);
    const rankingY = startY + btnH + btnGap;
    const setY = rankingY + btnH + btnGap;
    const guideY = setY + btnH + btnGap;
    const eventY = guideY + btnH + btnGap;

    // Start button opens the nickname overlay first.
    const startBg = this.add.graphics().setDepth(2);
    this.menuBtn = {
      startX,
      startY,
      rankingY,
      setX: (width - btnW) / 2,
      setY,
      guideY,
      eventY,
      btnW,
      btnH,
      startBg: null,
      rankingBg: null,
      setBg: null,
      guideBg: null,
      eventBg: null,
    };
    drawPixelButton(
      startBg,
      startX,
      startY,
      btnW,
      btnH,
      PIXEL.btnStartFill,
      PIXEL.btnStartHighlight,
      PIXEL.borderDark,
      3
    );
    this.startText = this.add
      .text(width / 2, startY + btnH / 2, t("menu.start"), {
        fontFamily: "Mulmaru",
        fontSize: "22px",
        color: "#e0ffe0",
      })
      .setOrigin(0.5)
      .setDepth(3);
    const startHit = this.add
      .zone(width / 2, startY + btnH / 2, btnW, btnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.startHit = startHit;
    startHit.on("pointerdown", () => {
      // Ask for a nickname before starting the game.
      showNicknameOverlay(this);
    });
    startHit.on("pointerover", () => {
      this.drawMenuButtonState("start", true);
    });
    startHit.on("pointerout", () => {
      this.drawMenuButtonState("start", false);
    });
    this.menuBtn.startBg = startBg;

    const rankingBg = this.add.graphics().setDepth(2);
    drawPixelButton(
      rankingBg,
      (width - btnW) / 2,
      rankingY,
      btnW,
      btnH,
      PIXEL.btnSubFill,
      PIXEL.btnSubHighlight,
      PIXEL.borderDark,
      2
    );
    this.rankingText = this.add
      .text(width / 2, rankingY + btnH / 2, t("menu.leaderboard"), {
        fontFamily: "Mulmaru",
        fontSize: "20px",
        color: "#b8b8d0",
      })
      .setOrigin(0.5)
      .setDepth(3);
    const rankingHit = this.add
      .zone(width / 2, rankingY + btnH / 2, btnW, btnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.rankingHit = rankingHit;
    rankingHit.on("pointerdown", () => showLeaderboardOverlay(this));
    rankingHit.on("pointerover", () => {
      this.drawMenuButtonState("ranking", true);
    });
    rankingHit.on("pointerout", () => {
      this.drawMenuButtonState("ranking", false);
    });
    this.menuBtn.rankingBg = rankingBg;

    // Settings button.
    const setX = this.menuBtn.setX;
    const setBg = this.add.graphics().setDepth(2);
    drawPixelButton(setBg, setX, setY, btnW, btnH, PIXEL.btnSubFill, PIXEL.btnSubHighlight, PIXEL.borderDark, 2);
    this.settingsText = this.add
      .text(width / 2, setY + btnH / 2, t("menu.settings"), {
        fontFamily: "Mulmaru",
        fontSize: "20px",
        color: "#b8b8d0",
      })
      .setOrigin(0.5)
      .setDepth(3);
    const setHit = this.add.zone(width / 2, setY + btnH / 2, btnW, btnH).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.setHit = setHit;
    setHit.on("pointerdown", () => showSettingsOverlay(this));
    setHit.on("pointerover", () => {
      this.drawMenuButtonState("settings", true);
    });
    setHit.on("pointerout", () => {
      this.drawMenuButtonState("settings", false);
    });
    this.menuBtn.setBg = setBg;

    // How-to-play guide button.
    const guideBg = this.add.graphics().setDepth(2);
    drawPixelButton(guideBg, (width - btnW) / 2, guideY, btnW, btnH, PIXEL.btnSubFill, PIXEL.btnSubHighlight, PIXEL.borderDark, 2);
    this.guideText = this.add
      .text(width / 2, guideY + btnH / 2, t("menu.howToPlay"), {
        fontFamily: "Mulmaru",
        fontSize: "20px",
        color: "#b8b8d0",
      })
      .setOrigin(0.5)
      .setDepth(3);
    const guideHit = this.add.zone(width / 2, guideY + btnH / 2, btnW, btnH).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.guideHit = guideHit;
    guideHit.on("pointerdown", () => showGuideOverlay(this));
    guideHit.on("pointerover", () => {
      this.drawMenuButtonState("guide", true);
    });
    guideHit.on("pointerout", () => {
      this.drawMenuButtonState("guide", false);
    });
    this.menuBtn.guideBg = guideBg;

    const eventBg = this.add.graphics().setDepth(2);
    drawPixelButton(eventBg, (width - btnW) / 2, eventY, btnW, btnH, 0x6b4f1d, 0xffc857, PIXEL.borderDark, 2);
    this.eventText = this.add
      .text(width / 2, eventY + btnH / 2, t("menu.weeklyEvent"), {
        fontFamily: "Mulmaru", fontSize: "20px", color: "#fff1c1",
      })
      .setOrigin(0.5)
      .setDepth(3);
    const eventHit = this.add.zone(width / 2, eventY + btnH / 2, btnW, btnH).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.eventHit = eventHit;
    eventHit.on("pointerdown", () => showEventOverlay(this));
    eventHit.on("pointerover", () => this.drawMenuButtonState("event", true));
    eventHit.on("pointerout", () => this.drawMenuButtonState("event", false));
    this.menuBtn.eventBg = eventBg;

    this.paradeSprites = [];
    const b = {
      left: MARGIN,
      right: width - MARGIN,
      top: MARGIN,
      bottom: height - MARGIN,
    };
    this.menuBounds = b;

    if (!this.textures.exists("bullet")) {
      const gfx = this.add.graphics();
      gfx.fillStyle(0xb0bec5, 1);
      gfx.fillRect(0, 0, 6, 6);
      gfx.generateTexture("bullet", 6, 6);
      gfx.destroy();
    }
    if (this.textures.exists("bullet")) {
      this.hitEmitter = this.add.particles(0, 0, "bullet", {
        speed: { min: 80, max: 180 },
        lifespan: 220,
        scale: { start: 1.1, end: 0 },
        alpha: { start: 0.9, end: 0 },
        angle: { min: 0, max: 360 },
        quantity: 0,
        frequency: -1,
      });
      this.cellEmitter = this.add.particles(0, 0, "bullet", {
        speed: 0,
        scale: { start: 1, end: 0 },
        alpha: { start: 0.4, end: 0 },
        lifespan: 180,
        quantity: 1,
        frequency: -1,
        tint: { start: 0x46d278, end: 0x46d278 },
      });
    }

    if (USE_PIXEL_SPRITES && this.textures.exists("entities")) {

      for (let i = 0; i <= 7; i += 1) {
        const entityIndex = i;
        const size = SIZE_BY_ENTITY_INDEX[entityIndex];
        const scale = getScaleForSize(size);
        const x = b.left + Math.random() * (b.right - b.left);
        const y = b.top + Math.random() * (b.bottom - b.top);
        const angle = Math.random() * Math.PI * 2;
        const vx = Math.cos(angle) * WANDER_SPEED;
        const vy = Math.sin(angle) * WANDER_SPEED;

        const sprite = this.add.sprite(
          x,
          y,
          "entities",
          getFrameIndex(entityIndex, 4)
        );
        sprite.setScale(scale);
        sprite.setOrigin(0.5, 1);
        sprite.setDepth(5);
        sprite.setData("entityIndex", entityIndex);
        sprite.setData("vx", vx);
        sprite.setData("vy", vy);
        this.paradeSprites.push(sprite);

        if (entityIndex !== PLAYER_ENTITY_INDEX) {
          sprite.setInteractive({ useHandCursor: true });
          sprite.on("pointerdown", () => this.onMonsterClicked(sprite));
        }
      }
    }

    this.scale.on("resize", this.handleResize, this);
    this.handleResize();

    this.events.once("shutdown", () => {
      this.scale.off("resize", this.handleResize, this);
      stopSceneBgm(this, 0);
    });
    this.events.once("destroy", () => {
      this.scale.off("resize", this.handleResize, this);
      stopSceneBgm(this, 0);
    });
  }

  getMenuLayout() {
    const width = this.scale ? this.scale.width : this.cameras.main.width;
    const height = this.scale ? this.scale.height : this.cameras.main.height;
    const btnW = 200;
    const btnH = 44;
    const btnGap = 10;
    const x = (width - btnW) / 2;
    const startY = Math.floor(height * 0.4);
    const rankingY = startY + btnH + btnGap;
    const setY = rankingY + btnH + btnGap;
    const guideY = setY + btnH + btnGap;
    const eventY = guideY + btnH + btnGap;
    return { width, height, btnW, btnH, x, startY, rankingY, setY, guideY, eventY };
  }

  redrawScanlines(width, height) {
    if (!this.scanlines) return;
    this.scanlines.clear();
    this.scanlines.lineStyle(1, 0x000000, 0.08);
    for (let sy = 0; sy < height; sy += 4) {
      this.scanlines.lineBetween(0, sy, width, sy);
    }
    this.scanlines.strokePath();
  }

  drawMenuButtonState(kind, isHover = false) {
    const { btnW, btnH, x, startY, rankingY, setY, guideY, eventY } = this.getMenuLayout();
    if (kind === "start" && this.menuBtn?.startBg) {
      this.menuBtn.startBg.clear();
      drawPixelButton(
        this.menuBtn.startBg,
        x,
        startY,
        btnW,
        btnH,
        isHover ? 0x2e8b2e : PIXEL.btnStartFill,
        PIXEL.btnStartHighlight,
        isHover ? 0x1a5f1a : PIXEL.borderDark,
        3
      );
      return;
    }

    if (kind === "event" && this.menuBtn?.eventBg) {
      this.menuBtn.eventBg.clear();
      drawPixelButton(this.menuBtn.eventBg, x, eventY, btnW, btnH, isHover ? 0x806126 : 0x6b4f1d, 0xffc857, PIXEL.borderDark, 2);
      return;
    }
    const graphics =
      kind === "ranking"
        ? this.menuBtn?.rankingBg
        : kind === "settings"
          ? this.menuBtn?.setBg
          : this.menuBtn?.guideBg;
    const y = kind === "ranking" ? rankingY : kind === "settings" ? setY : guideY;
    if (!graphics) return;
    graphics.clear();
    drawPixelButton(
      graphics,
      x,
      y,
      btnW,
      btnH,
      isHover ? 0x3d3d5c : PIXEL.btnSubFill,
      PIXEL.btnSubHighlight,
      isHover ? 0x2a2a40 : PIXEL.borderDark,
      2
    );
  }

  handleResize() {
    const { width, height, btnW, btnH, startY, rankingY, setY, guideY, eventY } = this.getMenuLayout();

    this.redrawScanlines(width, height);
    if (this.titleText) {
      this.titleText.setPosition(width / 2, Math.floor(height * 0.22));
    }
    if (this.menuBgmToggleText) {
      this.menuBgmToggleText.setPosition(width - 14, height - 14);
    }

    this.drawMenuButtonState("start", false);
    this.drawMenuButtonState("ranking", false);
    this.drawMenuButtonState("settings", false);
    this.drawMenuButtonState("guide", false);
    this.drawMenuButtonState("event", false);

    if (this.startText) this.startText.setPosition(width / 2, startY + btnH / 2);
    if (this.rankingText) this.rankingText.setPosition(width / 2, rankingY + btnH / 2);
    if (this.settingsText) this.settingsText.setPosition(width / 2, setY + btnH / 2);
    if (this.guideText) this.guideText.setPosition(width / 2, guideY + btnH / 2);
    if (this.eventText) this.eventText.setPosition(width / 2, eventY + btnH / 2);

    if (this.startHit) this.startHit.setPosition(width / 2, startY + btnH / 2).setSize(btnW, btnH);
    if (this.rankingHit) this.rankingHit.setPosition(width / 2, rankingY + btnH / 2).setSize(btnW, btnH);
    if (this.setHit) this.setHit.setPosition(width / 2, setY + btnH / 2).setSize(btnW, btnH);
    if (this.guideHit) this.guideHit.setPosition(width / 2, guideY + btnH / 2).setSize(btnW, btnH);
    if (this.eventHit) this.eventHit.setPosition(width / 2, eventY + btnH / 2).setSize(btnW, btnH);

    this.menuBounds = {
      left: MARGIN,
      right: width - MARGIN,
      top: MARGIN,
      bottom: height - MARGIN,
    };
  }

  /**
   * Fire a menu cell at a clicked monster, then respawn extra monsters.
   */
  onMonsterClicked(monster) {
    if (!monster.active || !this.menuBounds || !this.paradeSprites) return;
    if (monster.getData("targeted")) return;
    const entityIndex = monster.getData("entityIndex");
    if (entityIndex === PLAYER_ENTITY_INDEX) return;
    if (!this.textures.exists("bullet") || !this.cellEmitter || !this.hitEmitter) return;

    if (!this.flyingCells) this.flyingCells = [];
    monster.setData("targeted", true);
    const b = this.menuBounds;
    const start = randomEdgePosition(b);
    const cell = this.add.sprite(start.x, start.y, "bullet");
    cell.setTint(0x46d278);
    cell.setScale(1);
    cell.setDepth(6);

    this.flyingCells.push({
      cell,
      monster,
      lastEmitAt: 0,
    });
  }

  /** Move flying menu cells toward their target monsters. */
  applyFlyingCell(dt) {
    if (!this.flyingCells || !this.flyingCells.length) return;
    const b = this.menuBounds;
    const now = this.time.now || 0;

    for (let i = this.flyingCells.length - 1; i >= 0; i -= 1) {
      const fc = this.flyingCells[i];
      if (!fc.cell.active || !fc.monster.active) {
        if (fc.cell.active) fc.cell.destroy();
        if (fc.monster.active) fc.monster.setData("targeted", false);
        this.flyingCells.splice(i, 1);
        continue;
      }
      const cell = fc.cell;
      const monster = fc.monster;
      const dx = monster.x - cell.x;
      const dy = monster.y - cell.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (dist <= CELL_HIT_RADIUS) {
        const hitX = monster.x;
        const hitY = monster.y;
        const entityIndex = monster.getData("entityIndex");
        cell.destroy();
        this.flyingCells.splice(i, 1);
        this.cellEmitter.emitParticleAt(hitX, hitY);
        this.hitEmitter.explode(14, hitX, hitY);
        if (this.sound && this.sound.play) {
          try {
            this.sound.play(getSfxAttackKey(), { volume: 0.7 });
          } catch (_) {}
        }
        monster.destroy();
        this.paradeSprites = this.paradeSprites.filter((s) => s !== monster);

        const monsterCount = this.paradeSprites.filter(
          (s) => s.active && s.getData("entityIndex") !== PLAYER_ENTITY_INDEX
        ).length;
        const spawnCount = monsterCount >= MONSTER_CAP ? 1 : 2;

        for (let j = 0; j < spawnCount; j += 1) {
          const pos = spawnEdgePosition(b);
          const angle = Math.random() * Math.PI * 2;
          const vx = Math.cos(angle) * WANDER_SPEED;
          const vy = Math.sin(angle) * WANDER_SPEED;
          const scale = getScaleForSize(SIZE_BY_ENTITY_INDEX[entityIndex]);
          const newMonster = this.add.sprite(
            pos.x,
            pos.y,
            "entities",
            getFrameIndex(entityIndex, 4)
          );
          newMonster.setScale(0);
          newMonster.setOrigin(0.5, 1);
          newMonster.setDepth(5);
          newMonster.setData("entityIndex", entityIndex);
          newMonster.setData("vx", vx);
          newMonster.setData("vy", vy);
          newMonster.setInteractive({ useHandCursor: true });
          newMonster.on("pointerdown", () => this.onMonsterClicked(newMonster));
          this.paradeSprites.push(newMonster);

          this.tweens.add({
            targets: newMonster,
            scaleX: scale,
            scaleY: scale,
            duration: 520,
            ease: "Elastic.easeOut",
            easeParams: [0.35, 0.6],
          });
        }
        continue;
      }

      const move = Math.min(CELL_HOMING_SPEED * dt, dist);
      cell.x += (dx / dist) * move;
      cell.y += (dy / dist) * move;

      if (now - fc.lastEmitAt >= CELL_AFTERIMAGE_INTERVAL_MS) {
        fc.lastEmitAt = now;
        this.cellEmitter.emitParticleAt(cell.x, cell.y);
      }
    }
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.applyFlyingCell(dt);
    if (!this.paradeSprites?.length || !this.menuBounds) return;
    const pointer = this.input.activePointer;
    const px = pointer.worldX ?? pointer.x;
    const py = pointer.worldY ?? pointer.y;
    const b = this.menuBounds;

    for (let i = 0; i < this.paradeSprites.length; i += 1) {
      const s = this.paradeSprites[i];
      let vx = s.getData("vx");
      let vy = s.getData("vy");
      const entityIndex = s.getData("entityIndex");
      const isPlayer = entityIndex === PLAYER_ENTITY_INDEX;

      if (isPlayer) {
        let fx = 0;
        let fy = 0;
        const pdx = px - s.x;
        const pdy = py - s.y;
        const pdist = Math.hypot(pdx, pdy);
        if (pdist < FLEE_RADIUS && pdist > 0) {
          fx += -pdx / pdist;
          fy += -pdy / pdist;
        }
        for (let j = 0; j < this.paradeSprites.length; j += 1) {
          if (i === j) continue;
          const other = this.paradeSprites[j];
          if (!other.active) continue;
          const odx = other.x - s.x;
          const ody = other.y - s.y;
          const odist = Math.hypot(odx, ody);
          if (odist < FLEE_RADIUS && odist > 0) {
            fx += -odx / odist;
            fy += -ody / odist;
          }
        }
        const flen = Math.hypot(fx, fy);
        if (flen > 0) {
          vx = (fx / flen) * FLEE_SPEED;
          vy = (fy / flen) * FLEE_SPEED;
        } else if (Math.random() < 0.002) {
          const angle = Math.random() * Math.PI * 2;
          vx = Math.cos(angle) * WANDER_SPEED;
          vy = Math.sin(angle) * WANDER_SPEED;
        }
      } else {
        const dx = px - s.x;
        const dy = py - s.y;
        const dist = Math.hypot(dx, dy);
        if (dist < FLEE_RADIUS && dist > 0) {
          const nx = -dx / dist;
          const ny = -dy / dist;
          vx = nx * FLEE_SPEED;
          vy = ny * FLEE_SPEED;
        } else if (dist >= FLEE_RADIUS) {
          if (Math.random() < 0.002) {
            const angle = Math.random() * Math.PI * 2;
            vx = Math.cos(angle) * WANDER_SPEED;
            vy = Math.sin(angle) * WANDER_SPEED;
          }
        }
      }

      s.x += vx * dt;
      s.y += vy * dt;

      if (s.x < b.left) {
        s.x = b.left;
        vx = Math.abs(vx) || WANDER_SPEED * 0.5;
      }
      if (s.x > b.right) {
        s.x = b.right;
        vx = -Math.abs(vx) || -WANDER_SPEED * 0.5;
      }
      if (s.y < b.top) {
        s.y = b.top;
        vy = Math.abs(vy) || WANDER_SPEED * 0.5;
      }
      if (s.y > b.bottom) {
        s.y = b.bottom;
        vy = -Math.abs(vy) || -WANDER_SPEED * 0.5;
      }

      s.setData("vx", vx);
      s.setData("vy", vy);

      const dir = getDirIndexFromVector(vx, vy, 4);
      s.setFrame(getFrameIndex(entityIndex, dir));
    }
  }

  /** Disable menu interactions while DOM overlays are open. */
  disableMenuButtons() {
    this.startHit?.disableInteractive();
    this.rankingHit?.disableInteractive();
    this.setHit?.disableInteractive();
    this.guideHit?.disableInteractive();
    this.eventHit?.disableInteractive();
    if (this.paradeSprites) {
      this.paradeSprites.forEach((s) => {
        if (s.active && s.getData("entityIndex") !== PLAYER_ENTITY_INDEX) {
          s.disableInteractive();
        }
      });
    }
  }

  /** Re-enable menu interactions after DOM overlays close. */
  enableMenuButtons() {
    const opt = { useHandCursor: true };

    const safeSetInteractive = (obj) => {
      // Avoid setInteractive after the scene has already shut down.
      if (obj && obj.scene && obj.scene.sys && obj.scene.sys.input) {
        obj.setInteractive(opt);
      }
    };

    safeSetInteractive(this.startHit);
    safeSetInteractive(this.rankingHit);
    safeSetInteractive(this.setHit);
    safeSetInteractive(this.guideHit);
    safeSetInteractive(this.eventHit);

    if (this.paradeSprites) {
      this.paradeSprites.forEach((s) => {
        if (
          s.active &&
          s.getData("entityIndex") !== PLAYER_ENTITY_INDEX &&
          s.scene &&
          s.scene.sys &&
          s.scene.sys.input
        ) {
          s.setInteractive(opt);
        }
      });
    }
    // Reset hover styles because pointerout may not fire while overlays are open.
    const m = this.menuBtn;
    if (m?.startBg) {
      m.startBg.clear();
      drawPixelButton(m.startBg, m.startX, m.startY, m.btnW, m.btnH, PIXEL.btnStartFill, PIXEL.btnStartHighlight, PIXEL.borderDark, 3);
    }
    if (m?.rankingBg) {
      m.rankingBg.clear();
      drawPixelButton(m.rankingBg, m.setX, m.rankingY, m.btnW, m.btnH, PIXEL.btnSubFill, PIXEL.btnSubHighlight, PIXEL.borderDark, 2);
    }
    if (m?.setBg) {
      m.setBg.clear();
      drawPixelButton(m.setBg, m.setX, m.setY, m.btnW, m.btnH, PIXEL.btnSubFill, PIXEL.btnSubHighlight, PIXEL.borderDark, 2);
    }
    if (m?.guideBg) {
      m.guideBg.clear();
      drawPixelButton(m.guideBg, m.setX, m.guideY, m.btnW, m.btnH, PIXEL.btnSubFill, PIXEL.btnSubHighlight, PIXEL.borderDark, 2);
    }
    if (m?.eventBg) {
      m.eventBg.clear();
      drawPixelButton(m.eventBg, m.setX, m.eventY, m.btnW, m.btnH, 0x6b4f1d, 0xffc857, PIXEL.borderDark, 2);
    }
  }

  updateMenuBgmToggleText() {
    if (!this.menuBgmToggleText) return;
    this.menuBgmToggleText.setText(getBgmToggleLabel());
  }

  bindBgmGestureUnlock() {
    if (this._bgmGestureBound) return;
    this._bgmGestureBound = true;

    const ensurePlayback = async () => {
      await resumeAudioContext(this);
      playSceneBgm(this, "bgm_menu");
    };

    this.input.once("pointerdown", ensurePlayback);
    this.input.keyboard.once("keydown", ensurePlayback);
  }

  startGameWithMenuFade(data = {}) {
    stopSceneBgm(this, 300);
    this.time.delayedCall(320, () => {
      this.scene.start("MainScene", data);
    });
  }

  startEventGame(entry) {
    stopSceneBgm(this, 300);
    this.time.delayedCall(320, () => this.scene.start("EventGame", entry));
  }
}
