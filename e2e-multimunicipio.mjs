// Suite E2E de vários municípios — Chrome instalado via puppeteer-core.
// Roda contra um build com PLATFORM_DOMAIN (padrão: localhost) na porta 3214,
// com o banco da plataforma preparado por `npm run db:plataforma` (conta
// plataforma@incluiedu.test e o município "demo" com os dados de demonstração):
//   PLATFORM_DOMAIN=localhost DATABASE_URL="file:./e2e-plataforma.db" MUNICIPIO_DATABASE_URL="file:./{banco}.db" \
//     SESSION_COOKIE_SECURE=0 npx next start -p 3214
//   node e2e-multimunicipio.mjs
// Variáveis: E2E_DOMAIN (localhost), E2E_PORT (3214), CHROME_PATH.
import puppeteer from "puppeteer-core";
import { createRequire } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DOMAIN = process.env.E2E_DOMAIN ?? "localhost";
const PORT = process.env.E2E_PORT ?? "3214";
const origin = (label) => `http://${label ? `${label}.` : ""}${DOMAIN}:${PORT}`;
const ADMIN = origin("admin");
const DEMO = origin("demo");
const STAMP = Date.now().toString(36).slice(-6);
const SLUG = `e2e-${STAMP}`;
const CITY = origin(SLUG);
const CITY_NAME = `Vila Teste ${STAMP.toUpperCase()}`;
const ADMIN_EMAIL = `secretaria@${SLUG}.test`;
const PRIMARY = "#1d5f3a";
const MENU = "#2a1650";
const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? " — " + detail : ""}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome"),
  headless: true,
  userDataDir: mkdtempSync(join(tmpdir(), "pptr-municipios-")),
  args: ["--no-sandbox", "--disable-gpu", "--disable-extensions", `--host-resolver-rules=MAP *.${DOMAIN} 127.0.0.1, MAP ${DOMAIN} 127.0.0.1`],
});

async function newSession() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message.slice(0, 200)));
  return { ctx, page, errors };
}

const textOf = (page) => page.evaluate(() => document.body.innerText);
const pathOf = (page) => new URL(page.url()).pathname;

async function clickByText(page, text, selector = "button") {
  const ok = await page.evaluate((t, sel) => {
    const element = [...document.querySelectorAll(sel)].find((item) => item.textContent.includes(t));
    element?.click();
    return Boolean(element);
  }, text, selector);
  if (!ok) throw new Error(`não encontrado: ${text}`);
}

async function typeInto(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.$eval(selector, (input) => { input.value = ""; });
  await page.type(selector, value);
}

async function login(page, base, email, password = "demo123") {
  await page.goto(`${base}/login`, { waitUntil: "networkidle2", timeout: 45000 });
  await typeInto(page, "#email", email);
  await typeInto(page, "#password", password);
  await clickByText(page, "Entrar");
  await page.waitForFunction((path) => location.pathname !== path || document.querySelector('[role="alert"]'), { timeout: 20000 }, "/login").catch(() => {});
  await sleep(500);
}

// Regras do visual-check: axe (WCAG 2.2 AA), um h1, sem rolagem horizontal a 320 px.
async function audit(label, url, cookies = []) {
  const wide = await newSession();
  const narrow = await newSession();
  if (cookies.length) {
    await wide.page.setCookie(...cookies);
    await narrow.page.setCookie(...cookies);
  }
  await narrow.page.setViewport({ width: 320, height: 800 });
  await wide.page.goto(url, { waitUntil: "networkidle2" });
  await wide.page.evaluate(() => document.querySelectorAll("details").forEach((item) => { item.open = true; }));
  await wide.page.addScriptTag({ path: AXE });
  const violations = await wide.page.evaluate(async (tags) => (await window.axe.run(document, { runOnly: { type: "tag", values: tags } })).violations.map((v) => `${v.id}(${v.nodes.length}) ${v.nodes[0].target.join(" ")}`), TAGS);
  const h1 = await wide.page.evaluate(() => document.querySelectorAll("h1").length);
  await narrow.page.goto(url, { waitUntil: "networkidle2" });
  const overflow = await narrow.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const errors = [...wide.errors, ...narrow.errors];
  check(`acessibilidade: ${label}`, !violations.length && h1 === 1 && !overflow && !errors.length, JSON.stringify({ url: wide.page.url(), violations, h1, overflow, errors }));
  await wide.ctx.close();
  await narrow.ctx.close();
}

let adminCookies = [];
let cityTemp = "";

// ---------- 1. Endereços fora dos municípios ----------
{
  const { ctx, page } = await newSession();
  for (const base of [origin(""), origin("www")]) {
    await page.goto(`${base}/login`, { waitUntil: "networkidle2" });
    check(`página neutra em ${new URL(base).host}`, (await textOf(page)).includes("Entre pelo endereço do seu município") && !(await page.$("#email")));
  }
  await page.goto(`${origin("nao-existe")}/login`, { waitUntil: "networkidle2" });
  check("município não cadastrado: aviso, sem formulário", (await textOf(page)).includes("Nenhum município usa este endereço") && !(await page.$("#email")));
  const api = await page.evaluate(async () => (await fetch("/api/bncc")).status);
  check("município não cadastrado: rota da API responde 404", api === 404, `status=${api}`);
  await ctx.close();
}

// ---------- 2. Área da plataforma: só o painel e o login ----------
{
  const { ctx, page } = await newSession();
  await page.goto(`${ADMIN}/`, { waitUntil: "networkidle2" });
  check("admin: / leva ao login do painel", pathOf(page) === "/login" && (await textOf(page)).includes("Administração da plataforma"), page.url());
  await page.goto(`${ADMIN}/estudantes`, { waitUntil: "networkidle2" });
  check("admin: telas do município não abrem", !pathOf(page).startsWith("/estudantes"), page.url());
  await login(page, ADMIN, "secretaria@municipio.gov.br");
  check("admin: conta de município não entra", pathOf(page) === "/login" && (await textOf(page)).includes("E-mail ou senha inválidos"), page.url());
  await ctx.close();
}

// ---------- 3. Login da plataforma: e-mail e senha abrem o painel ----------
{
  const { ctx, page, errors } = await newSession();
  await login(page, ADMIN, "plataforma@incluiedu.test");
  await page.waitForFunction(() => location.pathname === "/plataforma", { timeout: 20000 }).catch(() => {});
  check("plataforma: a senha abre o painel, sem as duas etapas", pathOf(page) === "/plataforma" && (await textOf(page)).includes("Municípios"), page.url());
  check("plataforma: o município demo aparece na lista", (await textOf(page)).includes(`demo.${DOMAIN}`));
  adminCookies = (await page.cookies()).filter((cookie) => cookie.name === "incluiedu_session");

  // ---------- 4. Novo município com logo ----------
  await page.goto(`${ADMIN}/plataforma/novo`, { waitUntil: "networkidle2" });
  await page.type('input[name="name"]', CITY_NAME);
  const suggested = await page.$eval('input[name="slug"]', (input) => input.value);
  check("novo município: endereço sugerido pelo nome", suggested === `vila-teste-${STAMP}`, suggested);
  await typeInto(page, 'input[name="slug"]', SLUG);
  const network = await page.$eval('input[name="networkName"]', (input) => input.value);
  check("novo município: nome da rede sugerido", network === `Secretaria Municipal de Educação de ${CITY_NAME}`, network);
  await page.select('select[name="uf"]', "MG");
  const file = await page.$('input[type="file"][name="logo"]');
  await file.uploadFile(join(process.cwd(), "e2e-fixtures", "logo-municipio.png"));
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Sugerir cores pelo logo") && !b.disabled), { timeout: 10000 }).catch(() => {});
  await clickByText(page, "Sugerir cores pelo logo");
  await page.waitForFunction(() => /Sugestão (da IA|pela regra)/.test(document.body.innerText), { timeout: 90000 }).catch(() => {});
  check("novo município: sugere as cores pelo logo", /Sugestão (da IA|pela regra)/.test(await textOf(page)));
  await typeInto(page, 'input[aria-label="Cor principal, código hexadecimal"]', PRIMARY);
  await typeInto(page, 'input[aria-label="Cor do menu, código hexadecimal"]', MENU);
  const chosen = await page.evaluate(() => ({ primary: document.querySelector('input[name="primaryColor"]')?.value, menu: document.querySelector('input[name="menuColor"]')?.value, source: document.querySelector('input[name="colorSource"]')?.value }));
  check("novo município: cores escolhidas à mão", chosen.primary === PRIMARY && chosen.menu === MENU && chosen.source === "manual", JSON.stringify(chosen));
  await page.type('input[name="adminName"]', "Secretaria de Teste");
  await page.type('input[name="adminEmail"]', ADMIN_EMAIL);
  await clickByText(page, "Cadastrar e preparar o ambiente");
  await page.waitForSelector("#senha-temporaria", { timeout: 180000 }).catch(() => {});
  const temp = (await page.$eval("#senha-temporaria", (item) => item.textContent).catch(() => "")).trim();
  const address = await page.$eval("#endereco-municipio", (link) => link.getAttribute("href")).catch(() => "");
  check("novo município: ambiente pronto com senha temporária", /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/.test(temp), `senha=${temp} ${(await textOf(page)).slice(0, 300)}`);
  check("novo município: mostra o endereço", address === CITY, address);
  await page.goto(`${ADMIN}/plataforma`, { waitUntil: "networkidle2" });
  const card = await page.evaluate((name) => [...document.querySelectorAll("li")].find((item) => item.textContent.includes(name))?.innerText ?? "", CITY_NAME);
  check("novo município: na lista, ativo, com as cores", card.includes("Ativo") && card.includes(PRIMARY) && card.includes(MENU), card);
  check("plataforma: sem erros de cliente", errors.length === 0, errors.join("; "));
  cityTemp = temp;
  await ctx.close();
}

// ---------- 5. A Secretaria entra no endereço novo, com a marca do município ----------
let cityCookies = [];
{
  const { ctx, page, errors } = await newSession();
  await login(page, CITY, ADMIN_EMAIL, cityTemp);
  check("município novo: senha temporária leva a criar a própria", pathOf(page) === "/login/nova-senha", page.url());
  for (const name of ["password", "confirm"]) await typeInto(page, `input[name="${name}"]`, "girassol na varanda azul");
  await clickByText(page, "Salvar a senha e continuar");
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
  await page.waitForSelector("h1", { timeout: 20000 }).catch(() => {});
  check("município novo: a Secretaria entra no início", pathOf(page) === "/" && (await textOf(page)).includes("O que vamos fazer hoje?"), page.url());
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return { brand: style.getPropertyValue("--brand").trim().toLowerCase(), navy: style.getPropertyValue("--navy").trim().toLowerCase() };
  });
  check("município novo: --brand e --navy são as cores escolhidas", tokens.brand === PRIMARY && tokens.navy === MENU, JSON.stringify(tokens));
  const logo = await page.$eval('aside img[src^="/marca/logo"]', (img) => ({ src: img.getAttribute("src"), ok: img.complete && img.naturalWidth > 0 })).catch(() => null);
  check("município novo: logo no menu", Boolean(logo?.ok), JSON.stringify(logo));
  const served = logo ? await page.evaluate(async (src) => { const response = await fetch(src); return { status: response.status, type: response.headers.get("content-type") }; }, logo.src) : null;
  check("município novo: logo servido pelo endereço do município", served?.status === 200 && served.type === "image/png", JSON.stringify(served));
  check("município novo: nome do município e IncluiEdu no menu", await page.evaluate((name) => { const rail = document.querySelector("aside")?.innerText ?? ""; return rail.includes(name) && rail.includes("IncluiEdu"); }, CITY_NAME));
  check("município novo: título com o nome do município", (await page.title()) === `IncluiEdu — ${CITY_NAME}`, await page.title());
  await page.goto(`${CITY}/estudantes?q=Dan`, { waitUntil: "networkidle2" });
  check("isolamento: os estudantes do demo não aparecem no município novo", !(await textOf(page)).includes("Dante Oliveira"));
  cityCookies = (await page.cookies()).filter((cookie) => cookie.name === "incluiedu_session");
  check("município novo: sem erros de cliente", errors.length === 0, errors.join("; "));
  await ctx.close();
}

// ---------- 6. Isolamento entre endereços ----------
{
  const demo = await newSession();
  await login(demo.page, DEMO, "secretaria@municipio.gov.br");
  check("demo: a Secretaria de demonstração entra", pathOf(demo.page) === "/", demo.page.url());
  check("demo: marca padrão, sem logo", (await demo.page.title()) === "IncluiEdu — Município Demonstração" && !(await demo.page.$('img[src^="/marca/logo"]')), await demo.page.title());
  await demo.page.goto(`${DEMO}/estudantes?q=Dan`, { waitUntil: "networkidle2" });
  check("demo: os estudantes do demo aparecem no demo", (await textOf(demo.page)).includes("Dante Oliveira"));
  const danteHref = await demo.page.evaluate(() => [...document.querySelectorAll("main a")].map((link) => link.getAttribute("href") ?? "").find((href) => /^\/estudantes\/c[a-z0-9]{20,}$/.test(href)) ?? "");
  const [demoCookie] = (await demo.page.cookies()).filter((cookie) => cookie.name === "incluiedu_session");

  const thief = await newSession();
  if (demoCookie) await thief.page.setCookie({ name: demoCookie.name, value: demoCookie.value, domain: `${SLUG}.${DOMAIN}`, path: "/" });
  await thief.page.goto(`${CITY}/`, { waitUntil: "networkidle2" });
  check("isolamento: o cookie do demo não vale no município novo", Boolean(demoCookie) && pathOf(thief.page) === "/login", thief.page.url());
  if (demoCookie) await thief.page.setCookie({ name: demoCookie.name, value: demoCookie.value, domain: `admin.${DOMAIN}`, path: "/" });
  await thief.page.goto(`${ADMIN}/plataforma`, { waitUntil: "networkidle2" });
  check("isolamento: o cookie do demo não abre o painel", pathOf(thief.page) === "/login", thief.page.url());
  await thief.ctx.close();

  const city = await newSession();
  await city.page.setCookie(...cityCookies);
  if (danteHref) {
    await city.page.goto(`${CITY}${danteHref}`, { waitUntil: "networkidle2" });
    check("isolamento: a ficha de um estudante do demo não existe no município novo", (await textOf(city.page)).includes("Não encontramos o que você procurava"), city.page.url());
  } else check("isolamento: achou um estudante do demo para comparar", false);
  await city.page.goto(`${CITY}/plataforma`, { waitUntil: "networkidle2" });
  check("isolamento: /plataforma bloqueado no endereço do município", !pathOf(city.page).startsWith("/plataforma") && !(await textOf(city.page)).includes("Novo município"), city.page.url());
  await city.page.setExtraHTTPHeaders({ "x-municipio": "demo" });
  await city.page.goto(`${CITY}/`, { waitUntil: "networkidle2" });
  check("isolamento: o cabeçalho x-municipio do navegador não troca o município", (await city.page.title()) === `IncluiEdu — ${CITY_NAME}` && pathOf(city.page) === "/", `${await city.page.title()} ${city.page.url()}`);
  await city.ctx.close();

  const admin = await newSession();
  await admin.page.setCookie(...adminCookies);
  for (const path of ["/", "/estudantes", "/conta/seguranca", "/marca/logo"]) {
    await admin.page.goto(`${ADMIN}${path}`, { waitUntil: "networkidle2" });
    check(`isolamento: ${path} no admin volta ao painel`, pathOf(admin.page) === "/plataforma", admin.page.url());
  }
  const apiStatus = await admin.page.evaluate(async () => { const response = await fetch("/api/bncc", { redirect: "manual" }); return response.type === "opaqueredirect" ? "redirect" : response.status; });
  check("isolamento: API do município não responde no admin", apiStatus === "redirect", String(apiStatus));
  await admin.ctx.close();
  await demo.ctx.close();
}

// ---------- 7. Acessibilidade das telas da plataforma ----------
await audit("login do admin", `${ADMIN}/login`);
await audit("lista de municípios", `${ADMIN}/plataforma`, adminCookies);
await audit("novo município", `${ADMIN}/plataforma/novo`, adminCookies);
await audit("página do município", `${ADMIN}/plataforma/municipios/${SLUG}`, adminCookies);
await audit("página neutra", `${origin("")}/`);
await audit("login com a marca do município", `${CITY}/login`);

// ---------- 8. Suspender e reativar ----------
{
  const { ctx, page, errors } = await newSession();
  await page.setCookie(...adminCookies);
  await page.goto(`${ADMIN}/plataforma/municipios/${SLUG}`, { waitUntil: "networkidle2" });
  await page.type("#motivo-suspensao", "Teste automático");
  await clickByText(page, "Suspender o acesso");
  await page.waitForFunction(() => document.body.innerText.includes("Reativar o acesso"), { timeout: 20000 }).catch(() => {});
  check("suspender: o painel mostra Suspenso e o histórico", (await textOf(page)).includes("Suspenso") && (await textOf(page)).includes("suspendeu o acesso"));

  const visitor = await newSession();
  await visitor.page.setCookie(...cityCookies);
  await visitor.page.goto(`${CITY}/`, { waitUntil: "networkidle2" });
  check("suspender: o endereço leva à página de suspenso", pathOf(visitor.page) === "/indisponivel" && (await textOf(visitor.page)).includes("O acesso está suspenso") && !(await visitor.page.$("#email")), visitor.page.url());
  const api = await visitor.page.evaluate(async () => (await fetch("/api/bncc")).status);
  check("suspender: rotas da API respondem 503", api === 503, `status=${api}`);
  await audit("página de suspenso", `${CITY}/login`);

  await clickByText(page, "Reativar o acesso");
  await page.waitForFunction(() => document.body.innerText.includes("Suspender o acesso"), { timeout: 20000 }).catch(() => {});
  // Aba nova da mesma sessão: na mesma aba, carregar o início logo depois de uma página
  // fora do grupo (app) dispara um erro de hidratação que já existia antes do recurso
  // (reproduz com /jogar/memoria → / no modo de um município).
  const back = await visitor.ctx.newPage();
  back.on("pageerror", (error) => visitor.errors.push(error.message.slice(0, 200)));
  await back.goto(`${CITY}/indisponivel`, { waitUntil: "networkidle2" });
  check("reativar: a página de aviso volta ao início", pathOf(back) === "/", back.url());
  check("reativar: a sessão de antes volta a valer", (await textOf(back)).includes("O que vamos fazer hoje?"), back.url());
  check("suspender e reativar: sem erros de cliente", [...errors, ...visitor.errors].length === 0, [...errors, ...visitor.errors].join("; "));
  await visitor.ctx.close();
  await ctx.close();
}

await browser.close();
const failed = results.filter((result) => !result.ok);
console.log(`\n===== ${results.length - failed.length}/${results.length} testes passaram =====`);
process.exit(failed.length ? 1 : 0);
