import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { createClient } from "redis";
import { WebSocketServer } from "ws";
import { EventGameCore } from "./game-core.js";

function loadLocalEnv(filename, inheritedKeys) {
  if (!fs.existsSync(filename)) return;
  for (const rawLine of fs.readFileSync(filename, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && !inheritedKeys.has(key)) process.env[key] = value;
  }
}

const inheritedEnvironment = new Set(Object.keys(process.env));
loadLocalEnv(".env.local", inheritedEnvironment);

const port = Number(process.env.PORT || 8081);
const redisUrl = process.env.EVENT_REDIS_URL || process.env.REDIS_URL;
const finalizeUrl = process.env.EVENT_FINALIZE_URL;
const internalSecret = process.env.EVENT_INTERNAL_SECRET;
const tickMs = 50;
const snapshotMs = 100;
const stateSaveMs = 1000;
const reconnectMs = 30_000;
const maxPlayMs = 60 * 60 * 1000;
const allowedOrigin = process.env.EVENT_ALLOWED_ORIGIN || "";

if (!redisUrl || !finalizeUrl || !internalSecret) throw new Error("EVENT_REDIS_URL, EVENT_FINALIZE_URL, and EVENT_INTERNAL_SECRET are required.");

const redis = createClient({ url: redisUrl });
await redis.connect();
const games = new Map();

async function consumeTicket(ticket) {
  const key = `event:ticket:${ticket}`;
  const raw = await redis.sendCommand(["GETDEL", key]);
  return raw ? JSON.parse(raw) : null;
}

async function persistGame(game) {
  await redis.set(`event:run:${game.runId}`, JSON.stringify({
    seed: game.core.seed,
    state: game.core.snapshot(),
    pauseUsed: game.pauseUsed,
    startedAt: game.startedAt,
    lastInputSequence: game.lastInputSequence,
  }), { EX: 3_900 });
}

async function finishGame(game) {
  if (game.finalizing) return;
  game.finalizing = true;
  clearInterval(game.timer);
  clearTimeout(game.reconnectTimer);
  const result = { run_id: game.runId, ...game.core.result(), pause_used: game.pauseUsed };
  const body = JSON.stringify(result);
  const signature = crypto.createHmac("sha256", internalSecret).update(body).digest("hex");
  const response = await fetch(finalizeUrl, { method: "POST", headers: { "Content-Type": "application/json", "X-Event-Signature": signature }, body });
  if (!response.ok) throw new Error(`Finalize failed: ${response.status}`);
  await redis.del(`event:run:${game.runId}`);
  games.delete(game.runId);
  for (const socket of game.sockets) if (socket.readyState === 1) socket.send(JSON.stringify({ type: "finished", result }));
}

async function loadGame(ticket) {
  let game = games.get(ticket.run_id);
  if (game) return game;
  const saved = await redis.get(`event:run:${ticket.run_id}`);
  const restored = saved ? JSON.parse(saved) : null;
  const core = new EventGameCore(restored?.seed || ticket.seed, restored?.state || null);
  game = {
    runId: ticket.run_id,
    userId: ticket.user_id,
    core,
    pauseUsed: Boolean(restored?.pauseUsed),
    startedAt: Number(restored?.startedAt) || Date.now(),
    lastInputSequence: Number(restored?.lastInputSequence) || 0,
    sockets: new Set(),
    paused: false,
    lastSavedAt: 0,
    lastSnapshotAt: 0,
  };
  game.timer = setInterval(async () => {
    const now = Date.now();
    // Event timing is wall-clock based. UI pauses and reconnect grace periods
    // freeze simulation only; they must not extend the eligible run window.
    if (now - game.startedAt >= maxPlayMs) {
      game.core.finished = true;
      await finishGame(game);
      return;
    }
    if (!game.paused) game.core.tick(tickMs / 1000);
    if (now - game.lastSnapshotAt >= snapshotMs) {
      game.lastSnapshotAt = now;
      const message = JSON.stringify({ type: "state", state: game.core.snapshot() });
      for (const socket of game.sockets) if (socket.readyState === 1) socket.send(message);
    }
    if (now - game.lastSavedAt >= stateSaveMs) {
      game.lastSavedAt = now;
      await persistGame(game);
    }
    if (game.core.finished) await finishGame(game);
  }, tickMs);
  games.set(ticket.run_id, game);
  return game;
}

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, games: games.size }));
    return;
  }
  response.writeHead(404).end();
});
const wss = new WebSocketServer({ server });

wss.on("connection", (socket, request) => {
  if (allowedOrigin && request.headers.origin !== allowedOrigin) {
    socket.close(4003, "Origin denied");
    return;
  }
  let game = null;
  let authenticated = false;
  socket.once("message", async (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type !== "auth" || typeof message.ticket !== "string") throw new Error("Authentication required.");
      const ticket = await consumeTicket(message.ticket);
      if (!ticket) throw new Error("Expired event ticket.");
      game = await loadGame(ticket);
      if (game.sockets.size > 0) throw new Error("This event run is already connected on another device.");
      authenticated = true;
      clearTimeout(game.reconnectTimer);
      game.paused = false;
      game.sockets.add(socket);
      socket.send(JSON.stringify({
        type: "ready",
        run_id: game.runId,
        state: game.core.snapshot(),
        max_play_seconds: 3600,
        deadline_at: game.startedAt + maxPlayMs,
      }));
      socket.on("message", (inputRaw) => {
        try {
          const input = JSON.parse(inputRaw.toString());
          const now = Date.now();
          if (input.type === "input" && now - (game.lastInputAt || 0) >= 20) {
            if (!Number.isSafeInteger(input.sequence) || input.sequence <= game.lastInputSequence) return;
            if (!input.keys || Object.keys(input.keys).some((key) => !["up", "down", "left", "right"].includes(key) || typeof input.keys[key] !== "boolean")) return;
            game.lastInputAt = now;
            game.lastInputSequence = input.sequence;
            game.core.setInput(input.keys);
          }
          if (input.type === "choice" && typeof input.choice === "string") {
            game.core.choose(input.choice);
          }
          if (input.type === "pause") {
            game.paused = true;
          }
          if (input.type === "resume") {
            game.paused = false;
          }
        } catch (_) {}
      });
    } catch (error) {
      socket.send(JSON.stringify({ type: "error", detail: error.message }));
      socket.close(4001, "Authentication failed");
    }
  });
  socket.on("close", () => {
    if (!authenticated || !game) return;
    game.sockets.delete(socket);
    if (game.sockets.size > 0) return;
    if (game.pauseUsed) return void finishGame(game);
    game.pauseUsed = true;
    game.paused = true;
    persistGame(game).catch(() => {});
    game.reconnectTimer = setTimeout(() => finishGame(game).catch(() => {}), reconnectMs);
  });
});

server.listen(port, () => console.log(`Event server listening on ${port}`));
