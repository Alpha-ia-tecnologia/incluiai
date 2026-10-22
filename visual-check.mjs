// Verificação visual de todas as telas: acessibilidade (axe, WCAG 2.2 AA), sem
// rolagem horizontal a 320 px, um único h1 e sem erro de cliente.
// Uso: BASE=http://127.0.0.1:3214 node visual-check.mjs [pasta para capturas]
//   TEXT_SCALE=3   todas as telas com o texto no tamanho maior
//   CHROME_PATH=…  caminho do Chrome (padrão: o do sistema)
// Os endereços com id (estudante, material, planejamento) são achados nas próprias telas.
import puppeteer from "puppeteer-core";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3213";
const OUT = process.argv[2] ?? null;
const SCALE = process.env.TEXT_SCALE ?? null;
const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
if (OUT) mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome"),
  headless: true,
  userDataDir: mkdtempSync(join(tmpdir(), "pptr-visual-")),
  args: ["--no-sandbox", "--disable-gpu", "--disable-extensions"],
});

async function open(width) {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width, height: 900 });
  if (SCALE) await page.evaluateOnNewDocument((value) => localStorage.setItem("incluiedu-texto", value), SCALE);
  page.errors = [];
  page.on("pageerror", (error) => page.errors.push(error.message.slice(0, 160)));
  return page;
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.type("#email", email);
  await page.type("#password", "demo123");
  await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Entrar"))?.click());
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 30000 });
}

// Primeiro link da página atual que casa com o seletor (e, se dado, com o texto).
async function firstLink(page, path, selector, text) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  return page.evaluate((sel, words) => [...document.querySelectorAll(sel)].find((link) => !words || link.textContent.includes(words))?.getAttribute("href") ?? null, selector, text);
}

let problems = 0;
async function check(wide, narrow, label, path) {
  const response = await wide.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  await new Promise((resolve) => setTimeout(resolve, 500));
  // Página muito longa não cabe numa captura inteira: fica só a parte de cima.
  if (OUT) await wide.screenshot({ path: join(OUT, `${label}.png`), fullPage: true }).catch(() => wide.screenshot({ path: join(OUT, `${label}.png`) }));
  await wide.evaluate(() => document.querySelectorAll("details").forEach((item) => { item.open = true; }));
  await wide.addScriptTag({ path: AXE });
  const violations = await wide.evaluate(async (tags) => (await window.axe.run(document, { runOnly: { type: "tag", values: tags } })).violations.map((v) => `${v.id}(${v.nodes.length}) ${v.nodes[0].target.join(" ")}`), TAGS);
  const h1 = await wide.evaluate(() => document.querySelectorAll("h1").length);
  await narrow.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  const overflow = await narrow.evaluate(() => {
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= width) return "";
    return [...document.querySelectorAll("main *")].filter((el) => el.getBoundingClientRect().right > width + 1).slice(0, 2).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`).join(" | ") || "rolagem";
  });
  const status = response?.status() ?? 0;
  const errors = [...wide.errors, ...narrow.errors];
  wide.errors.length = 0;
  narrow.errors.length = 0;
  // As páginas de "não encontrado" respondem 404 de propósito.
  const expected404 = /nao-?existe/.test(path);
  const bad = violations.length || overflow || (status >= 400 && !expected404) || errors.length || h1 !== 1;
  if (bad) problems += 1;
  console.log(`${bad ? "✗" : "✓"} ${label} [${status}] h1=${h1}${violations.length ? ` axe: ${violations.join(" | ")}` : ""}${overflow ? ` 320px: ${overflow}` : ""}${errors.length ? ` erros: ${errors.join(" | ")}` : ""}`);
}

async function account(email, short, paths) {
  const wide = await open(1280);
  const narrow = await open(320);
  await login(wide, email);
  await login(narrow, email);
  for (const item of await paths(wide)) {
    if (!item) continue;
    const [label, path] = item;
    await check(wide, narrow, `${short}_${label}`, path);
  }
  await wide.browserContext().close();
  await narrow.browserContext().close();
}

{
  const wide = await open(1280);
  const narrow = await open(320);
  await check(wide, narrow, "login", "/login");
  await check(wide, narrow, "nao-existe", "/endereco-que-nao-existe");
  await wide.browserContext().close();
  await narrow.browserContext().close();
}

await account("aee@escola.edu.br", "aee", async (page) => {
  const student = await firstLink(page, "/estudantes", 'a[href^="/estudantes/c"]', "Ver acompanhamento");
  const resource = await firstLink(page, "/recursos", 'a[href^="/recursos/c"]');
  const material = student ? await firstLink(page, `${student}/materiais`, `a[href^="${student}/materiais/c"]`) : null;
  const report = student ? await firstLink(page, `${student}/relatorios`, `a[href^="${student}/relatorios/c"]`) : null;
  const adapted = student ? await firstLink(page, `${student}/atividades`, `a[href^="${student}/atividades/adaptadas/c"]`) : null;
  const tabs = student ? ["", "/perfil", "/estudo-de-caso", "/ppi", "/diario", "/linha-do-tempo", "/atividades", "/materiais", "/atendimentos-aee", "/dua", "/relatorios", "/sondagem", "/sondagem/aplicar", "/dossie", "/dossie/imprimir"].map((tab) => [`estudante${tab.replaceAll("/", "_")}`, `${student}${tab}`]) : [];
  return [
    ["inicio", "/"], ["estudantes", "/estudantes"], ["estudantes_novo", "/estudantes/novo"], ["jornada", "/jornada"], ["assistente", "/assistente"],
    ["calendario", "/calendario"], ["ajuda", "/ajuda"], ["recursos", "/recursos"], resource && ["recurso", resource],
    ...tabs, material && ["material", material], material && ["material_imprimir", `${material}/imprimir`],
    report && ["relatorio", report], report && ["relatorio_imprimir", `${report}/imprimir`],
    student && ["adaptar", `${student}/atividades/adaptar`], adapted && ["adaptada", adapted], adapted && ["adaptada_imprimir", `${adapted}/imprimir`],
    ["planejamento", "/planejamento"], ["conta_seguranca", "/conta/seguranca"], ["avisos", "/avisos"], ["dossie", "/dossie"], ["pilula_sondagem", "/ajuda/pilulas/sondagem"], ["pilula_estudo", "/ajuda/pilulas/estudo-de-caso"], ["pilula_prova", "/ajuda/pilulas/adaptar-prova"], ["estudante_naoexiste", "/estudantes/naoexiste"],
  ];
});

await account("professor@escola.edu.br", "professor", async (page) => {
  const planning = await firstLink(page, "/planejamento", 'a[href^="/planejamento/c"]');
  const plan = planning?.match(/^\/planejamento\/[^/?#]+/)?.[0];
  const material = plan ? await firstLink(page, `${plan}/materiais`, `a[href^="${plan}/materiais/c"]`) : null;
  const level = plan ? await firstLink(page, `${plan}/niveis`, `a[href^="${plan}/niveis/c"]`) : null;
  return [["inicio", "/"], level && ["nivel_imprimir", level], ...(plan ? ["", "/apoios", "/aplicacao", "/materiais", "/niveis", "/historico"].map((tab) => [`planejamento${tab.replaceAll("/", "_")}`, `${plan}${tab}`]) : []), material && ["planejamento_material", material]];
});

await account("coordenacao@escola.edu.br", "coordenacao", async (page) => {
  const accountLink = await firstLink(page, "/usuarios", 'a[href^="/usuarios/c"]');
  // Censo: a escola e uma prévia do arquivo de exemplo (fica aberta até a próxima importação).
  const censusSchool = await firstLink(page, "/censo", 'main a[href^="/censo/escolas/"]');
  let censusPreview = null;
  if (censusSchool) {
    await page.goto(`${BASE}${censusSchool}`, { waitUntil: "networkidle2" });
    const sample = join(mkdtempSync(join(tmpdir(), "censo-")), "migracao.txt");
    // O arquivo precisa ter o código INEP que a escola já tem (o E2E grava um).
    const code = (await page.$eval("#escola-inep", (input) => input.value).catch(() => "")) || "12345678";
    writeFileSync(sample, (await import("./src/lib/educacenso.fixture.mjs")).sampleFile(2025).replaceAll("|12345678|", `|${code}|`), "latin1");
    await (await page.$('input[type="file"][name="file"]'))?.uploadFile(sample);
    await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Ler o arquivo"))?.click());
    await page.waitForFunction(() => location.pathname.startsWith("/censo/importacoes/"), { timeout: 30000 }).catch(() => {});
    censusPreview = page.url().includes("/censo/importacoes/") ? new URL(page.url()).pathname : null;
  }
  return [["censo", "/censo"], censusSchool && ["censo_escola", censusSchool], censusPreview && ["censo_previa", censusPreview], ["painel", "/painel"], ["dossie", "/dossie"], ["dossie_pendentes", "/dossie?filtro=pendentes"], ["cadastros", "/cadastros"], ["jornada", "/jornada"], ["estudantes", "/estudantes"], ["estudantes_importar", "/estudantes/importar"], ["usuarios", "/usuarios"], ["usuarios_nova", "/usuarios/nova"], accountLink && ["usuario", accountLink]];
});

await account("secretaria@municipio.gov.br", "secretaria", async (page) => {
  const accountLink = await firstLink(page, "/usuarios", 'a[href^="/usuarios/c"]');
  return [["inicio", "/"], ["painel", "/painel"], ["avisos", "/avisos"], ["dossie", "/dossie"], ["censo", "/censo"], ["estudantes_importar", "/estudantes/importar"], ["usuarios", "/usuarios"], ["usuarios_nova", "/usuarios/nova"], accountLink && ["usuario", accountLink]];
});

await account("familia@email.com", "familia", async (page) => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  const portal = new URL(page.url()).pathname;
  const material = await firstLink(page, portal, 'a[href*="/materiais/"]');
  const report = await firstLink(page, portal, 'a[href*="/relatorios/"]');
  return [["portal", portal], ["jornada", "/jornada"], ["conta_seguranca", "/conta/seguranca"], ["avisos", "/avisos"], material && ["material", material], report && ["relatorio", report]];
});

await account("terapeuta@clinica.com.br", "terapeuta", async () => [["portal", "/terapeuta"], ["jornada", "/jornada"], ["avisos", "/avisos"]]);

await browser.close();
console.log(problems ? `\n${problems} tela(s) com problema` : "\nTodas as telas passaram.");
process.exit(problems ? 1 : 0);
