import { preloadGame } from "../loader/assetLoader.js";
import { createEventEntry } from "../api/eventApi.js";
import { getFrameIndex, getScaleForSize } from "../render/entitySprites.js";

export default class EventGameScene extends Phaser.Scene {
  constructor() { super("EventGame"); }
  preload() { preloadGame(this); }
  create(entry) {
    this.entry = entry;
    this.sprites = new Map();
    this.inputState = { up: false, down: false, left: false, right: false };
    this.lastInputSentAt = 0;
    this.retrying = false;
    this.leaving = false;
    this.add.rectangle(0, 0, 3200, 3200, 0x0c1218).setOrigin(0);
    this.player = this.add.sprite(1600, 1600, "entities", getFrameIndex(0, 4)).setScale(getScaleForSize("player"));
    this.scoreText = this.add.text(16, 16, "EVENT 00:00  SCORE 0", { fontFamily: "Mulmaru", fontSize: "20px", color: "#ffffff" }).setScrollFactor(0).setDepth(100);
    this.noticeText = this.add.text(16, 44, "Server-authoritative event run", { fontFamily: "Mulmaru", fontSize: "14px", color: "#9dffb1" }).setScrollFactor(0).setDepth(100);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, 3200, 3200);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ up: "W", down: "S", left: "A", right: "D" });
    this.connect(entry);
    this.events.once("shutdown", () => this.socket?.close());
  }
  connect(entry) {
    if (!entry.ws_url) { this.returnToMenu("Event WebSocket is not configured."); return; }
    this.socket = new WebSocket(entry.ws_url);
    this.socket.onopen = () => this.socket.send(JSON.stringify({ type: "auth", ticket: entry.ticket }));
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "ready" || message.type === "state") this.applyState(message.state);
      if (message.type === "finished") this.returnToMenu(`Event finished. Verified score: ${message.result.score.toLocaleString()}`);
      if (message.type === "error") this.returnToMenu(message.detail);
    };
    this.socket.onclose = () => this.retryConnection();
  }
  async retryConnection() {
    if (this.leaving || this.retrying || !this.scene.isActive("EventGame")) return;
    this.retrying = true;
    this.noticeText.setText("Connection lost. Restoring your one allowed 30-second pause...");
    try { this.connect(await createEventEntry()); } catch (error) { this.returnToMenu(error.message); }
    finally { this.retrying = false; }
  }
  applyState(state) {
    this.player.setPosition(state.player.x, state.player.y);
    this.scoreText.setText(`EVENT ${Math.floor(state.elapsed / 60).toString().padStart(2, "0")}:${Math.floor(state.elapsed % 60).toString().padStart(2, "0")}  SCORE ${state.score.toLocaleString()}`);
    const active = new Set();
    for (const enemy of state.enemies || []) {
      active.add(enemy.id);
      let sprite = this.sprites.get(enemy.id);
      if (!sprite) { sprite = this.add.sprite(enemy.x, enemy.y, "entities", getFrameIndex(3, 4)).setScale(getScaleForSize("medium")); this.sprites.set(enemy.id, sprite); }
      sprite.setPosition(enemy.x, enemy.y);
    }
    for (const [id, sprite] of this.sprites) if (!active.has(id)) { sprite.destroy(); this.sprites.delete(id); }
  }
  update(time) {
    const next = { up: this.cursors.up.isDown || this.wasd.up.isDown, down: this.cursors.down.isDown || this.wasd.down.isDown, left: this.cursors.left.isDown || this.wasd.left.isDown, right: this.cursors.right.isDown || this.wasd.right.isDown };
    const changed = Object.keys(next).some((key) => next[key] !== this.inputState[key]);
    if ((changed || time - this.lastInputSentAt > 250) && this.socket?.readyState === WebSocket.OPEN) {
      this.inputState = next;
      this.lastInputSentAt = time;
      this.socket.send(JSON.stringify({ type: "input", keys: next }));
    }
  }
  returnToMenu(message) {
    this.leaving = true;
    this.socket?.close();
    window.alert(message);
    this.scene.start("MainMenu");
  }
}
