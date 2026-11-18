import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "./prisma/demo-data.mjs";
import { TOTP_STEP_SECONDS, totpAt, totpStep } from "./src/lib/totp.ts";

export const BASE = (process.env.BASE ?? "http://localhost:3214").replace(/\/+$/, "");

export const chromePath = () => process.env.CHROME_PATH ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome");

export async function launchChrome({ args = [], ...options } = {}) {
  const { default: puppeteer } = await import("puppeteer-core");
  return puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    userDataDir: mkdtempSync(join(tmpdir(), "pptr-")),
    ...options,
    args: ["--no-sandbox", "--disable-gpu", "--disable-extensions", ...args],
  });
}

export async function newSession(browser, viewport) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  if (viewport) await page.setViewport(viewport);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message.slice(0, 200)));
  return { ctx, page, errors };
}

export const until = (page, condition, { timeout = 20000, polling } = {}, ...args) =>
  page.waitForFunction(condition, { timeout, ...(polling ? { polling } : {}) }, ...args).then(() => true, () => false);

export const appears = (page, selector, timeout = 20000) => page.waitForSelector(selector, { timeout }).then(Boolean, () => false);

export async function settle(page, timeout = 20000) {
  const idle = await page.waitForNetworkIdle({ idleTime: 500, concurrency: 2, timeout }).then(() => true, () => false);
  const ready = await until(page, () => document.readyState === "complete" && Boolean(document.querySelector("h1")?.textContent), { timeout });
  return idle && ready;
}

export const textOf = (page) => page.evaluate(() => document.body.innerText);

export async function fill(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.$eval(selector, (input) => { input.value = ""; });
  await page.type(selector, value);
}

export async function clickByText(page, text, selector = "button") {
  const clicked = await page.evaluate((wanted, sel) => {
    const element = [...document.querySelectorAll(sel)].find((item) => item.textContent.includes(wanted));
    element?.click();
    return Boolean(element);
  }, text, selector);
  if (!clicked) throw new Error(`não encontrado: ${text}`);
}

export async function clickExact(page, text) {
  const clicked = await page.evaluate((wanted) => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === wanted);
    button?.click();
    return Boolean(button);
  }, text);
  if (!clicked) throw new Error(`botão não encontrado: ${text}`);
}

export const isServerAction = (response) => response.request().method() === "POST" && Boolean(response.request().headers()["next-action"]);

export async function afterAction(page, click, timeout = 30000) {
  const answered = page.waitForResponse(isServerAction, { timeout }).then(() => true, () => false);
  await click();
  return answered;
}

export const emailOf = (who) => DEMO_ACCOUNTS[who]?.email ?? who;

export async function login(page, who, { base = BASE, password = DEMO_PASSWORD } = {}) {
  await page.goto(`${base}/login`, { waitUntil: "networkidle2", timeout: 45000 });
  await fill(page, "#email", emailOf(who));
  await fill(page, "#password", password);
  await page.click('form:has(#password) button[type="submit"]');
  await until(page, () => location.pathname !== "/login" || Boolean(document.querySelector('[role="alert"]')), { timeout: 30000 });
  await settle(page);
  return page.url();
}

export async function studentHref(page, name, { base = BASE } = {}) {
  await page.goto(`${base}/estudantes?q=${encodeURIComponent(name)}`, { waitUntil: "networkidle2" });
  return page.evaluate((wanted) => {
    const card = [...document.querySelectorAll("main article")].find((item) => item.querySelector("h2")?.textContent.includes(wanted));
    return [...(card?.querySelectorAll("a") ?? [])].map((link) => link.getAttribute("href")?.match(/^\/estudantes\/[^/?#]+/)?.[0]).find(Boolean) ?? "";
  }, name);
}

export function totpCodes() {
  const stepMs = TOTP_STEP_SECONDS * 1000;
  let used = -1;
  return async (secret) => {
    if (totpStep(Date.now()) + 1 <= used) await new Promise((resolve) => setTimeout(resolve, used * stepMs - Date.now() + 50));
    used = totpStep(Date.now()) + 1;
    return totpAt(secret, used * stepMs);
  };
}

export function report() {
  const results = [];
  const warnings = [];
  const check = (name, ok, detail = "") => {
    results.push({ name, ok });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? " — " + detail : ""}`);
  };
  return {
    check,
    warn(name, ok, detail = "") {
      if (ok) return;
      warnings.push(`${name} — ${detail}`);
      console.log(`AVISO ${name} — ${detail}`);
    },
    async section(name, run) {
      try {
        await run();
      } catch (error) {
        check(`${name}: a seção chegou ao fim`, false, error instanceof Error ? error.message : String(error));
      }
    },
    finish() {
      const failed = results.filter((result) => !result.ok);
      for (const warning of warnings) console.log(`AVISO ${warning}`);
      console.log(`\n===== ${results.length - failed.length}/${results.length} testes passaram =====`);
      return failed.length ? 1 : 0;
    },
  };
}
