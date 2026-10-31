import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function findChromium(): string | undefined {
  if (process.env.PATCHPOOL_E2E_CHROMIUM) return process.env.PATCHPOOL_E2E_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(os.homedir(), ".cache/ms-playwright");
  if (!fs.existsSync(root)) return undefined;
  const browserDirs = fs.readdirSync(root).filter((entry) => /^chromium/.test(entry)).sort().reverse();
  for (const directory of browserDirs) {
    for (const relative of [
      "chrome-headless-shell-linux64/chrome-headless-shell",
      "chrome-linux/chrome",
      "chrome-linux64/chrome",
    ]) {
      const candidate = path.join(root, directory, relative);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

export default defineConfig({
  testDir: ".",
  testMatch: "lifecycle.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3017",
    headless: true,
    launchOptions: {
      executablePath: findChromium(),
      args: ["--no-sandbox"],
    },
  },
  timeout: 90_000,
  expect: { timeout: 15_000 },
});
