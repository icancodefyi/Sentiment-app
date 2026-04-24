import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const apiDir = join(root, "apps", "api");
const isWin = process.platform === "win32";
const venvPython = isWin
  ? join(apiDir, ".venv", "Scripts", "python.exe")
  : join(apiDir, ".venv", "bin", "python");

if (!existsSync(venvPython)) {
  console.error("Missing venv. Run `pnpm setup` or `pnpm dev` from the repo root.");
  process.exit(1);
}

const child = spawn(
  venvPython,
  ["-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"],
  { cwd: apiDir, stdio: "inherit", shell: false },
);

child.on("exit", (code) => process.exit(code ?? 0));
