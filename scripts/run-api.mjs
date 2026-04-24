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

// Default 8787 avoids colliding with another uvicorn/other app often left on :8000.
const port = process.env.SENTILX_API_PORT || process.env.API_PORT || "8787";
console.error(
  `[sentilx-api] uvicorn port ${port} (set SENTILX_API_PORT to override; web needs NEXT_PUBLIC_API_URL to match)`,
);

const child = spawn(
  venvPython,
  ["-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", port],
  {
    cwd: apiDir,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      ...(isWin ? { PYTHONUTF8: "1" } : {}),
    },
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
