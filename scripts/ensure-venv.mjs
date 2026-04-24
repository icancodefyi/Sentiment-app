/**
 * Creates apps/api/.venv if missing and installs requirements.txt (idempotent).
 */
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const apiDir = join(root, "apps", "api");
const venvDir = join(apiDir, ".venv");
const isWin = process.platform === "win32";
const venvPython = isWin
  ? join(venvDir, "Scripts", "python.exe")
  : join(venvDir, "bin", "python");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: apiDir,
    shell: isWin,
    ...opts,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function tryVenvCommand(cmd, prefixArgs) {
  const args = [...prefixArgs, "-m", "venv", venvDir];
  const r = spawnSync(cmd, args, { cwd: apiDir, stdio: "inherit", shell: isWin });
  return r.status === 0;
}

if (!existsSync(venvPython)) {
  console.log("Creating Python venv at apps/api/.venv …");
  const ok =
    tryVenvCommand("python", []) ||
    tryVenvCommand("py", ["-3"]) ||
    tryVenvCommand("python3", []);
  if (!ok) {
    console.error(
      "Could not create a venv. Install Python 3.11+ and ensure `python`, `py -3`, or `python3` works, then retry.",
    );
    process.exit(1);
  }
}

if (!existsSync(venvPython)) {
  console.error("venv python not found after creation:", venvPython);
  process.exit(1);
}

console.log("Installing / syncing API dependencies …");
run(venvPython, [
  "-m",
  "pip",
  "install",
  "-q",
  "--disable-pip-version-check",
  "-r",
  "requirements.txt",
]);
