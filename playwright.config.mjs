import { defineConfig } from "@playwright/test";
import { BASE, chromePath } from "./e2e-support.mjs";

export default defineConfig({
  testDir: "./e2e-playwright",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    launchOptions: { executablePath: chromePath() },
    locale: "pt-BR",
    viewport: { width: 1400, height: 1000 },
    navigationTimeout: 90_000,
    actionTimeout: 20_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
