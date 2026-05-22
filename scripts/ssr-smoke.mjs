#!/usr/bin/env node
/**
 * SSR smoke test — boots `vite dev` and fetches every public route,
 * failing if any route returns a non-2xx/3xx status or contains an
 * SSR-crash marker in the HTML. Catches the "blank screen / SSR
 * rendering failed" class of regressions before they reach deploy.
 *
 * Usage: node scripts/ssr-smoke.mjs
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const ROUTES = ["/", "/login"]; // public routes; authed routes redirect → still must SSR cleanly
const CRASH_MARKERS = [
  "SSR rendering failed",
  "ReferenceError",
  "is not defined",
  "Cannot read properties of undefined",
  "Internal Server Error",
];
const PORT = process.env.SMOKE_PORT || "5199";
const BASE = `http://localhost:${PORT}`;

const server = spawn(
  "npx",
  ["vite", "dev", "--port", PORT, "--host", "127.0.0.1", "--strictPort"],
  { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "development" } },
);

let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d.toString()));
server.stderr.on("data", (d) => (serverLog += d.toString()));

const cleanup = () => {
  try { server.kill("SIGTERM"); } catch {}
};
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(130); });

async function waitForReady(timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(BASE + "/");
      if (r.status < 500) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`Dev server didn't become ready in ${timeoutMs}ms\n--- server log ---\n${serverLog}`);
}

const failures = [];
try {
  await waitForReady();
  for (const path of ROUTES) {
    const res = await fetch(BASE + path, { redirect: "manual" });
    const body = await res.text();
    const ok = res.status >= 200 && res.status < 400;
    const crash = CRASH_MARKERS.find((m) => body.includes(m));
    if (!ok || crash) {
      failures.push({ path, status: res.status, crash, snippet: body.slice(0, 400) });
    } else {
      console.log(`✓ ${path} → ${res.status}`);
    }
  }
} catch (err) {
  failures.push({ fatal: String(err) });
} finally {
  cleanup();
}

if (failures.length) {
  console.error("\n✗ SSR smoke test FAILED");
  for (const f of failures) console.error(JSON.stringify(f, null, 2));
  process.exit(1);
}
console.log("\n✓ All routes rendered cleanly");
process.exit(0);
