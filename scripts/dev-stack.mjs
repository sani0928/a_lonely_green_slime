import { spawn } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const python = isWindows ? "backend\\.venv\\Scripts\\python.exe" : "backend/.venv/bin/python";
let shuttingDown = false;
const processes = [];

const commands = [
  // Spawn Node entry points directly: Windows cannot spawn .cmd shims without a shell.
  { name: "web", command: process.execPath, args: ["node_modules/vite/bin/vite.js"] },
  { name: "api", command: python, args: ["backend/manage.py", "runserver"] },
  { name: "event", command: process.execPath, args: ["server.js"], cwd: "event-server" },
];

for (const { name, command, args, cwd } of commands) {
  const child = spawn(command, args, { cwd, stdio: "inherit", shell: false });
  child.on("exit", (code) => {
    if (code && !shuttingDown) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(code);
    }
  });
  child.on("error", (error) => {
    console.error(`[${name}] failed to start: ${error.message}`);
    shutdown(1);
  });
  processes.push(child);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of processes) child.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
