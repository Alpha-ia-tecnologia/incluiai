import { expect, test } from "@playwright/test";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DEMO_STUDENTS } from "../prisma/demo-data.mjs";
import { CONTENT_ID } from "../src/lib/landmarks.ts";

// A moldura no celular: barra de cima que sai ao rolar, barra de salvar no lugar
// da navegação de baixo e o Assistente fora do caminho do conteúdo.
test.describe.configure({ mode: "serial" });

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

async function login(page, role) {
  await page.goto("/login");
  await page.locator("#email").fill(DEMO_ACCOUNTS[role].email);
  await page.locator("#password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function studentPath(page, name) {
  await page.goto(`/estudantes?q=${encodeURIComponent(name)}`);
  const href = await page.locator("main article", { has: page.getByRole("heading", { name }) }).getByRole("link").first().getAttribute("href");
  return href.match(/^\/estudantes\/[^/?#]+/)[0];
}

const box = (locator) => locator.evaluate((element) => {
  const { top, bottom, left, right } = element.getBoundingClientRect();
  return { top, bottom, left, right };
});

// O que está no centro do elemento é ele mesmo (nada fixo por cima).
const onTop = (locator) => locator.evaluate((element) => {
  const { left, top, width, height } = element.getBoundingClientRect();
  const hit = document.elementFromPoint(left + width / 2, top + height / 2);
  return Boolean(hit && (hit === element || element.contains(hit)));
});

const scrollInSteps = async (page, to) => {
  const from = await page.evaluate(() => window.scrollY);
  const step = to > from ? 60 : -60;
  for (let y = from + step; step > 0 ? y < to : y > to; y += step) {
    await page.evaluate((value) => window.scrollTo(0, value), y);
    await page.waitForTimeout(30);
  }
  await page.evaluate((value) => window.scrollTo(0, value), to);
  await page.waitForTimeout(350);
};

test.describe("moldura no celular", () => {
  test.use(PHONE);

  test("registro de aula: com um campo em foco, a navegação sai e o Salvar fica à vista", async ({ page }) => {
    await login(page, "professor_aee");
    await page.goto(`${await studentPath(page, DEMO_STUDENTS.dante.name)}/diario`);
    const form = page.locator(`#${CONTENT_ID} form`).filter({ has: page.getByRole("button", { name: /^Salvar/ }) }).first();
    const field = form.locator("textarea").first();
    await field.scrollIntoViewIfNeeded();
    await field.focus();
    await page.waitForTimeout(400);

    const nav = page.getByRole("navigation", { name: "Navegação no celular" });
    const height = page.viewportSize().height;
    await expect.poll(async () => (await box(nav)).top, { message: "a navegação de baixo sai da tela" }).toBeGreaterThanOrEqual(height);

    const save = form.getByRole("button", { name: /^Salvar/ });
    const saveBox = await box(save);
    expect(saveBox.top, "o Salvar está dentro da tela").toBeGreaterThanOrEqual(0);
    expect(saveBox.bottom, "o Salvar está dentro da tela").toBeLessThanOrEqual(height);
    expect(await onTop(save), "nada cobre o Salvar").toBe(true);
    await expect(field).toBeFocused();
  });

  test("registro de aula: fora do formulário, a navegação volta", async ({ page }) => {
    await login(page, "professor_aee");
    await page.goto(`${await studentPath(page, DEMO_STUDENTS.dante.name)}/diario`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    const nav = page.getByRole("navigation", { name: "Navegação no celular" });
    await expect.poll(async () => (await box(nav)).bottom).toBeLessThanOrEqual(page.viewportSize().height);
  });

  test("barra de cima: sai ao rolar para baixo, volta ao rolar para cima e fica com o foco do teclado", async ({ page }) => {
    await login(page, "professor_aee");
    const header = page.getByRole("banner");
    await scrollInSteps(page, 700);
    expect((await box(header)).bottom, "rolando para baixo, a barra sai").toBeLessThanOrEqual(0);
    await scrollInSteps(page, 560);
    const shown = await box(header);
    expect(shown.top, "rolando para cima, a barra volta presa no topo").toBe(0);
    expect(shown.bottom - shown.top, "≈ 56 px").toBeLessThanOrEqual(60);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const assistant = header.getByRole("button", { name: /assistente/ });
    await expect(assistant, "o Assistente fica na barra de cima").toBeFocused();
    await scrollInSteps(page, 700);
    expect((await box(header)).top, "com o foco do teclado nela, a barra não sai").toBe(0);
  });

  test("Assistente: na barra de cima, e nada fixo cobre o fim do conteúdo", async ({ page }) => {
    await login(page, "familia");
    await expect(page.getByRole("banner").getByRole("button", { name: /Abrir o assistente/ })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);
    const last = page.locator(`#${CONTENT_ID} > *`).last();
    const covered = await last.evaluate((element) => {
      const content = element.getBoundingClientRect();
      const fixed = [...document.querySelectorAll("body *")].filter((item) => getComputedStyle(item).position === "fixed" && item.getBoundingClientRect().height > 0);
      return fixed.map((item) => ({ name: item.getAttribute("aria-label") ?? item.className, box: item.getBoundingClientRect() }))
        .filter(({ box }) => box.top < content.bottom && box.bottom > content.top && box.left < content.right && box.right > content.left)
        .map(({ name }) => String(name));
    });
    expect(covered, "o fim da página reserva o espaço da navegação").toEqual([]);
  });
});

test("computador: o Assistente flutuante não cobre o fim do conteúdo", async ({ page }) => {
  await login(page, "professor_aee");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  const fab = page.locator('button[aria-controls="assistente-painel"]');
  await expect(fab).toBeVisible();
  const fabBox = await box(fab);
  const lastBox = await box(page.locator(`#${CONTENT_ID} > *`).last());
  const overlaps = fabBox.top < lastBox.bottom && fabBox.bottom > lastBox.top && fabBox.left < lastBox.right && fabBox.right > lastBox.left;
  expect(overlaps).toBe(false);
});
