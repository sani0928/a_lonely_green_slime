import { spawn } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";
const python = isWindows ? "backend\\.venv\\Scripts\\python.exe" : "backend/.venv/bin/python";

const processes = [
  { name: "web", command: npm, args: ["run", "dev:web"] },
  { name: "api", command: python, args: ["backend/manage.py", "runserver"] },
  { name: "event", command: npm, args: ["--prefix", "event-server", "start"] },
].map(({ name, command, args }) => {
  const child = spawn(command, args, { stdio: "inherit", shell: false });
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
  return child;
});

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of processes) child.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
