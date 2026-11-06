import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/browser-tests.json" }],
  ],
  workers: 1,
  timeout: 45000,
  use: { baseURL: "http://127.0.0.1:47831", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "CANDIDATE_TRACKER_NO_OPEN=1 node server.cjs",
    url: "http://127.0.0.1:47831",
    reuseExistingServer: true,
  },
});
