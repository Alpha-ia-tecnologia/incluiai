// Testes de ponta a ponta com Playwright (e2e-playwright/). Como o e2e-test.mjs,
// rodam contra a plataforma já no ar, com o banco de exemplo (npm run db:setup):
//   BASE=http://localhost:3213 npm run test:e2e:playwright
// Usam o Chrome instalado no sistema: não é preciso baixar navegador.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-playwright",
  // Os testes de um arquivo contam uma história só (cadastrar, estudar, planejar):
  // rodam em ordem, num único processo, sobre o mesmo banco.
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
    // Um seletor que não aparece falha logo, com a tela registrada.
    actionTimeout: 20_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
