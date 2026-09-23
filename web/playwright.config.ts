import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 15000 },
  reporter: "line",
  outputDir: join(tmpdir(), "patch-ui-playwright"),
  use: {
    baseURL: "http://localhost:3000",
    browserName: "chromium",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/sign-in",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
