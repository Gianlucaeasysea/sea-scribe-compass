#!/usr/bin/env node
/**
 * SSR smoke test — boots `vite dev` and fetches every public route,
 * failing if any route:
 *   1. returns a non-2xx/3xx status,
 *   2. contains an SSR-crash marker in the HTML,
 *   3. is non-deterministic (two back-to-back SSRs produce different markup,
 *      which is the #1 cause of React hydration mismatches).
 *
 * Also runs a static scan for risky render-path patterns that produce
 * different output on the server vs the browser.
 *
 * Usage: node scripts/ssr-smoke.mjs
 */
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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

// --- Static scan for hydration-mismatch risks --------------------------------
//
// Locale-dependent formatters and non-deterministic values produce different
// output on the Cloudflare Workers SSR pass vs the user's browser. Forbid
// them in render paths; use src/lib/format.ts instead.
const RENDER_DIRS = ["src/routes", "src/components"];
const RISKY_PATTERNS = [
  { re: /\.toLocaleDateString\(\s*\)/g, why: "use formatDate() from @/lib/format" },
  { re: /\.toLocaleTimeString\(\s*\)/g, why: "use a fixed-locale formatter from @/lib/format" },
  { re: /\.toLocaleString\(\s*\)/g,     why: "use formatNumber() / formatEuro() from @/lib/format" },
  { re: /Math\.random\(/g,              why: "non-deterministic — compute server-side or in useEffect" },
  { re: /Date\.now\(/g,                 why: "non-deterministic — compute in useEffect" },
];
// Files allowed to use these (event handlers, hooks, server-only modules,
// or vendored shadcn primitives whose risky calls run only in client effects).
const ALLOWED_FILES = new Set([
  "src/components/client-error-reporter.tsx",
  "src/lib/format.ts",
]);
const ALLOWED_DIRS = ["src/components/ui/"]; // shadcn primitives — vendored

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else if (/\.(tsx?|jsx?)$/.test(name)) yield p;
  }
}

function staticScan() {
  const hits = [];
  for (const dir of RENDER_DIRS) {
    for (const file of walk(dir)) {
      if (ALLOWED_FILES.has(file)) continue;
      if (ALLOWED_DIRS.some((d) => file.startsWith(d))) continue;
      // Strip lines clearly inside event handlers / effects to reduce noise.
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        // Skip obvious safe contexts
        if (/useEffect|onClick|onSubmit|onChange|handler\s*[:=]|async\s+\(/.test(line)) return;
        for (const { re, why } of RISKY_PATTERNS) {
          re.lastIndex = 0;
          if (re.test(line)) {
            hits.push({ file, line: i + 1, code: line.trim(), why });
          }
        }
      });
    }
  }
  return hits;
}

// --- Boot dev server ---------------------------------------------------------
const server = spawn(
  "npx",
  ["vite", "dev", "--port", PORT, "--host", "127.0.0.1", "--strictPort"],
  { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "development" } },
);

let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d.toString()));
server.stderr.on("data", (d) => (serverLog += d.toString()));

const cleanup = () => { try { server.kill("SIGTERM"); } catch {} };
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

// Strip values that legitimately vary across requests (Vite HMR nonces,
// React SSR insertion-effect comments) before comparing.
function normalize(html) {
  return html
    .replace(/data-vite-dev-id="[^"]*"/g, "")
    .replace(/\?t=\d+/g, "")
    .replace(/<!--\$\?-->|<!--\/\$-->/g, "")
    .replace(/nonce="[^"]*"/g, "");
}

function diffSnippet(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      const start = Math.max(0, i - 60);
      return { at: i, a: a.slice(start, i + 60), b: b.slice(start, i + 60) };
    }
  }
  return { at: Math.min(a.length, b.length), a: "(length differs)", b: "" };
}

// --- Run ---------------------------------------------------------------------
const failures = [];

const scanHits = staticScan();
if (scanHits.length) {
  for (const h of scanHits) {
    failures.push({ kind: "static-scan", ...h });
  }
}

try {
  await waitForReady();
  for (const path of ROUTES) {
    const r1 = await fetch(BASE + path, { redirect: "manual" });
    const b1 = await r1.text();
    const ok = r1.status >= 200 && r1.status < 400;
    const crash = CRASH_MARKERS.find((m) => b1.includes(m));
    if (!ok || crash) {
      failures.push({ kind: "render", path, status: r1.status, crash, snippet: b1.slice(0, 400) });
      continue;
    }

    // Determinism probe: second SSR must produce byte-identical HTML.
    const r2 = await fetch(BASE + path, { redirect: "manual" });
    const b2 = await r2.text();
    const n1 = normalize(b1);
    const n2 = normalize(b2);
    if (n1 !== n2) {
      failures.push({ kind: "non-deterministic", path, ...diffSnippet(n1, n2) });
    } else {
      console.log(`✓ ${path} → ${r1.status} (deterministic)`);
    }
  }
} catch (err) {
  failures.push({ kind: "fatal", error: String(err) });
} finally {
  cleanup();
}

if (failures.length) {
  console.error("\n✗ SSR smoke test FAILED");
  for (const f of failures) console.error(JSON.stringify(f, null, 2));
  process.exit(1);
}
console.log("\n✓ All routes rendered cleanly and deterministically");
process.exit(0);
