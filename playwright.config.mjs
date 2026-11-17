import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-playwright",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE ?? "http://localhost:3213",
    channel: "chrome",
    locale: "pt-BR",
    viewport: { width: 1400, height: 1000 },
    navigationTimeout: 90_000,
    actionTimeout: 20_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
