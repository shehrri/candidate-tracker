import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const out = new URL("../artifacts/", import.meta.url);
await fs.mkdir(out, { recursive: true });
const proc = spawn("./CandidateTracker/launch-macos.command", [], {
  env: { ...process.env, CANDIDATE_TRACKER_NO_OPEN: "1" },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
let log = "";
proc.stdout.on("data", (d) => (log += d));
proc.stderr.on("data", (d) => (log += d));
let ready = false;
for (let n = 0; n < 100; n++) {
  try {
    const r = await fetch("http://127.0.0.1:47831/__candidate_tracker_health");
    if ((await r.text()) === "candidate-tracker-offline-v1") {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
assert(ready, "Packaged launcher failed");
try {
  const root = await fetch("http://127.0.0.1:47831");
  assert(root.ok);
  assert(
    root.headers.get("content-security-policy").includes("connect-src 'self'"),
  );
  assert.equal(
    (await fetch("http://127.0.0.1:47831", { method: "POST" })).status,
    405,
  );
  assert.equal((await fetch("http://127.0.0.1:47831/server.cjs")).status, 404);
  assert.equal(
    (await fetch("http://127.0.0.1:47831/%2e%2e%2fserver.cjs")).status,
    403,
  );
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:47831");
  await page
    .getByRole("heading", { name: "Your recruiting overview" })
    .waitFor();
  await page.screenshot({
    path: fileURLToPath(new URL("dashboard-light.png", out)),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.locator("html[data-theme=dark]").waitFor();
  await page.getByRole("status").waitFor({ state: "hidden" });
  await page.screenshot({
    path: fileURLToPath(new URL("dashboard-dark.png", out)),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: fileURLToPath(new URL("mobile.png", out)),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    "Mobile horizontal overflow",
  );
  assert.deepEqual(errors, []);
  await browser.close();
  await fs.writeFile(
    new URL("launcher-check.json", out),
    JSON.stringify(
      {
        platform: process.platform,
        arch: process.arch,
        packagedLauncher: true,
        csp: true,
        postRejected: true,
        traversalRejected: true,
        privateServerFileRejected: true,
        mobileOverflow: false,
        pageErrors: errors,
        log,
      },
      null,
      2,
    ),
  );
  console.log(
    "Packaged Mac launcher, security headers, routes, and screenshots verified.",
  );
} finally {
  process.kill(-proc.pid, "SIGTERM");
}
