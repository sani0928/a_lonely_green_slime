import GameScene from "./GameScene.js";
import { createEventEntry } from "../api/eventApi.js";
import * as HudSystem from "../systems/hudSystem.js";
import { cellPosition } from "../core/cellRules.js";
import {
  getDirIndexFromVector,
  getEntityMappingForEnemyType,
  getFrameIndex,
  getScaleForSize,
} from "../render/entitySprites.js";
import { getLocale, t } from "../i18n.js";

/** Renders validated server snapshots with the exact regular GameScene UI. */
export default class EventGameScene extends GameScene {
  constructor() {
    super("EventGame");
  }

  create(entry) {
    super.create({ serverControlled: true });
    this.entry = entry;
    this.inputState = { up: false, down: false, left: false, right: false };
    this.inputSequence = 0;
    this.lastInputSentAt = 0;
    this.retrying = false;
    this.leaving = false;
    this.hasServerSnapshot = false;
    this.serverEnemySprites = new Map();
    this.serverProjectileSprites = new Map();
    this.serverCoinSprites = new Map();
    this.serverItemSprites = new Map();
    this.serverTargets = new Map();
    this.serverPlayerTarget = { x: this.player.x, y: this.player.y };
    this.eventNoticeText = this.add.text(16, 16, t("event.serverAuthoritative"), {
      fontFamily: "Mulmaru", fontSize: "14px", color: "#9dffb1",
    }).setScrollFactor(0).setDepth(100);
    this.connect(entry);
    this.events.once("shutdown", () => this.socket?.close());
  }

  connect(entry) {
    if (!entry?.ws_url) return this.returnToMenu(t("event.webSocketNotConfigured"));
    this.socket = new WebSocket(entry.ws_url);
    this.socket.onopen = () => this.socket.send(JSON.stringify({ type: "auth", ticket: entry.ticket }));
    this.socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.type === "ready" || message.type === "state") this.applyServerState(message.state);
      if (message.type === "finished") this.returnToMenu(t("event.finished", { score: message.result.score.toLocaleString(getLocale()) }));
      if (message.type === "error") this.returnToMenu(t("event.runEnded"));
    };
    this.socket.onclose = () => this.retryConnection();
  }

  async retryConnection() {
    if (this.leaving || this.retrying || !this.scene.isActive("EventGame")) return;
    this.retrying = true;
    this.eventNoticeText?.setText(t("event.reconnecting"));
    try { this.connect(await createEventEntry()); }
    catch { this.returnToMenu(t("event.reconnectFailed")); }
    finally { this.retrying = false; }
  }

  applyServerState(state) {
    if (!state?.player) return;
    this.elapsedTime = Number(state.elapsed) || 0;
    this.score = Number(state.score) || 0;
    this.killCount = Number(state.kills) || 0;
    this.playerHp = Number(state.player.hp) || 0;
    this.playerMaxHp = Number(state.player.maxHp) || this.playerMaxHp;
    this.playerAttackPower = Number(state.player.attack) || this.playerAttackPower;
    this.attackUpgradeCount = Number(state.attackUpgradeCount) || 0;
    this.cellActiveCount = Number(state.cells?.activeCount) || this.cellBaseCount;
    this.cellAngle = Number(state.cells?.angle) || 0;
    this.cellBaseRadius = Number(state.cells?.radius) || this.cellBaseRadius;
    this.serverPlayerTarget = { x: state.player.x, y: state.player.y };
    if (!this.hasServerSnapshot) {
      this.player.setPosition(state.player.x, state.player.y);
      this.hasServerSnapshot = true;
    }
    this.syncEnemies(state.enemies || []);
    this.syncProjectiles(state.enemyProjectiles || []);
    this.syncRewards(this.coins, this.serverCoinSprites, state.coins || [], "coin");
    this.syncRewards(this.items, this.serverItemSprites, state.items || [], "fragments");
    this.serverCellProjectiles = state.cellProjectiles || [];
    HudSystem.updateDashboard(this);
  }

  syncEnemies(enemies) {
    const activeIds = new Set();
    for (const enemy of enemies) {
      activeIds.add(enemy.id);
      let sprite = this.serverEnemySprites.get(enemy.id);
      if (!sprite) {
        const mapping = getEntityMappingForEnemyType(enemy.type);
        sprite = this.enemies.create(enemy.x, enemy.y, "entities", getFrameIndex(mapping.entityIndex, 4));
        sprite.setScale(getScaleForSize(mapping.size));
        sprite.setData("entityIndex", mapping.entityIndex);
        this.serverEnemySprites.set(enemy.id, sprite);
      }
      this.serverTargets.set(enemy.id, { x: enemy.x, y: enemy.y });
    }
    for (const [id, sprite] of this.serverEnemySprites) {
      if (activeIds.has(id)) continue;
      sprite.destroy();
      this.serverEnemySprites.delete(id);
      this.serverTargets.delete(id);
    }
  }

  syncProjectiles(projectiles) {
    const activeIds = new Set();
    for (const projectile of projectiles) {
      activeIds.add(projectile.id);
      let sprite = this.serverProjectileSprites.get(projectile.id);
      if (!sprite) {
        sprite = this.enemyProjectiles.create(projectile.x, projectile.y, "bullet");
        sprite.setTint(0xf5dc46).setScale(1.35);
        this.serverProjectileSprites.set(projectile.id, sprite);
      }
      sprite.setData("targetX", projectile.x);
      sprite.setData("targetY", projectile.y);
    }
    for (const [id, sprite] of this.serverProjectileSprites) {
      if (activeIds.has(id)) continue;
      sprite.destroy();
      this.serverProjectileSprites.delete(id);
    }
  }

  syncRewards(group, sprites, rewards, texture) {
    const activeIds = new Set();
    for (const reward of rewards) {
      activeIds.add(reward.id);
      let sprite = sprites.get(reward.id);
      if (!sprite) {
        sprite = group.create(reward.x, reward.y, texture, texture === "fragments" ? 0 : undefined);
        if (texture === "fragments") sprite.setScale(0.55);
        sprites.set(reward.id, sprite);
      }
      sprite.setPosition(reward.x, reward.y);
    }
    for (const [id, sprite] of sprites) {
      if (activeIds.has(id)) continue;
      sprite.destroy();
      sprites.delete(id);
    }
  }

  updateServerPresentation(time, delta) {
    if (!this.hasServerSnapshot) return;
    const factor = 1 - Math.exp(-Math.max(0, delta) / 55);
    const dx = this.serverPlayerTarget.x - this.player.x;
    const dy = this.serverPlayerTarget.y - this.player.y;
    this.player.x += dx * factor;
    this.player.y += dy * factor;
    if (dx || dy) this.player.setFrame(getFrameIndex(this.playerEntityIndex, getDirIndexFromVector(dx, dy, this.lastPlayerDirIndex || 4)));
    for (const [id, sprite] of this.serverEnemySprites) {
      const target = this.serverTargets.get(id);
      if (!target) continue;
      const x = target.x - sprite.x;
      const y = target.y - sprite.y;
      sprite.x += x * factor;
      sprite.y += y * factor;
      sprite.setFrame(getFrameIndex(sprite.getData("entityIndex"), getDirIndexFromVector(x, y, 4)));
    }
    for (const sprite of this.serverProjectileSprites.values()) {
      sprite.x += (sprite.getData("targetX") - sprite.x) * factor;
      sprite.y += (sprite.getData("targetY") - sprite.y) * factor;
    }
    this.renderAuthoritativeCells();
    this.sendInput(time);
  }

  renderAuthoritativeCells() {
    const bullets = this.bullets?.getChildren?.() || [];
    for (let index = 0; index < bullets.length; index += 1) {
      const bullet = bullets[index];
      const active = index < this.cellActiveCount;
      bullet.setVisible(active).setActive(active);
      if (active) {
        const authoritative = this.serverCellProjectiles?.[index];
        const position = authoritative || cellPosition(this.player, { activeCount: this.cellActiveCount, radius: this.cellBaseRadius, angle: this.cellAngle }, index);
        bullet.setPosition(position.x, position.y);
      }
    }
  }

  sendInput(time) {
    const next = {
      up: this.cursors.up.isDown || this.wasd.up.isDown,
      down: this.cursors.down.isDown || this.wasd.down.isDown,
      left: this.cursors.left.isDown || this.wasd.left.isDown,
      right: this.cursors.right.isDown || this.wasd.right.isDown,
    };
    const changed = Object.keys(next).some((key) => next[key] !== this.inputState[key]);
    if ((changed || time - this.lastInputSentAt > 250) && this.socket?.readyState === WebSocket.OPEN) {
      this.inputState = next;
      this.lastInputSentAt = time;
      this.socket.send(JSON.stringify({ type: "input", sequence: ++this.inputSequence, keys: next }));
    }
  }

  endGame() {
    // Event results are finalized exclusively by the server.
  }

  returnToMenu(message) {
    if (this.leaving) return;
    this.leaving = true;
    this.socket?.close();
    window.alert(message);
    this.scene.start("MainMenu");
  }
}
