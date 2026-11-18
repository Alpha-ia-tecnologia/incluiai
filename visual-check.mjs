import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, launchChrome, login, newSession, settle, until } from "./e2e-support.mjs";
import { getNavigation } from "./src/lib/navigation.ts";
import { STUDENT_TABS } from "./src/lib/student-tab-list.ts";
import { TEXT_SCALE_KEY } from "./src/lib/text-scale.ts";
import { parseTutorials, tutorialsForRole } from "./src/lib/tutorials-core.ts";
import { sampleFile } from "./src/lib/educacenso.fixture.mjs";

const OUT = process.argv[2] ?? null;
const SCALE = process.env.TEXT_SCALE ?? null;
const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const TUTORIALS_FILE = fileURLToPath(new URL("./public/tutoriais/tutoriais.json", import.meta.url));
const TUTORIALS = existsSync(TUTORIALS_FILE) ? parseTutorials(JSON.parse(readFileSync(TUTORIALS_FILE, "utf8"))) : [];
const tutorialFor = (role) => tutorialsForRole(TUTORIALS, role)[0]?.id ?? null;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
if (OUT) mkdirSync(OUT, { recursive: true });

const browser = await launchChrome();

async function open(width) {
  const { page, errors } = await newSession(browser, { width, height: 900 });
  if (SCALE) await page.evaluateOnNewDocument((key, value) => localStorage.setItem(key, value), TEXT_SCALE_KEY, SCALE);
  return { page, errors };
}

async function firstLink(page, path, selector, text) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  return page.evaluate((sel, words) => [...document.querySelectorAll(sel)].find((link) => !words || link.textContent.includes(words))?.getAttribute("href") ?? null, selector, text);
}

async function firstMatching(page, path, pattern) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  return page.evaluate((source) => [...document.querySelectorAll("a[href]")].map((link) => link.getAttribute("href")).find((href) => new RegExp(source).test(href)) ?? null, pattern.source);
}

let problems = 0;
const checked = new Set();
async function check(wide, narrow, label, path, expectedStatus = 200) {
  checked.add(path.split("?")[0]);
  const response = await wide.page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  await settle(wide.page);
  // Página muito longa não cabe numa captura inteira: fica só a parte de cima.
  if (OUT) await wide.page.screenshot({ path: join(OUT, `${label}.png`), fullPage: true }).catch(() => wide.page.screenshot({ path: join(OUT, `${label}.png`) }));
  await wide.page.evaluate(() => document.querySelectorAll("details").forEach((item) => { item.open = true; }));
  await wide.page.addScriptTag({ path: AXE });
  const violations = await wide.page.evaluate(async (tags) => (await window.axe.run(document, { runOnly: { type: "tag", values: tags } })).violations.map((v) => `${v.id}(${v.nodes.length}) ${v.nodes[0].target.join(" ")}`), TAGS);
  const h1 = await wide.page.evaluate(() => document.querySelectorAll("h1").length);
  await narrow.page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  const overflow = await narrow.page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= width) return "";
    return [...document.querySelectorAll("main *")].filter((el) => el.getBoundingClientRect().right > width + 1).slice(0, 2).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`).join(" | ") || "rolagem";
  });
  const status = response?.status() ?? 0;
  const errors = [...wide.errors, ...narrow.errors];
  wide.errors.length = 0;
  narrow.errors.length = 0;
  const bad = violations.length || overflow || (status >= 400 && status !== expectedStatus) || errors.length || h1 !== 1;
  if (bad) problems += 1;
  console.log(`${bad ? "✗" : "✓"} ${label} [${status}] h1=${h1}${violations.length ? ` axe: ${violations.join(" | ")}` : ""}${overflow ? ` 320px: ${overflow}` : ""}${errors.length ? ` erros: ${errors.join(" | ")}` : ""}`);
}

async function signedIn(role) {
  const wide = await open(1280);
  const narrow = await open(320);
  await login(wide.page, role);
  await login(narrow.page, role);
  return { wide, narrow, close: async () => { await wide.page.browserContext().close(); await narrow.page.browserContext().close(); } };
}

const visited = [];
async function account(role, short, paths) {
  const session = await signedIn(role);
  visited.push([role, short]);
  for (const item of await paths(session.wide.page)) {
    if (!item) continue;
    const [label, path, expectedStatus] = item;
    await check(session.wide, session.narrow, `${short}_${label}`, path, expectedStatus);
  }
  await session.close();
}

{
  const wide = await open(1280);
  const narrow = await open(320);
  await check(wide, narrow, "login", "/login");
  await check(wide, narrow, "nao-existe", "/endereco-que-nao-existe", 404);
  await wide.page.browserContext().close();
  await narrow.page.browserContext().close();
}

await account("professor_aee", "aee", async (page) => {
  const student = await firstLink(page, "/estudantes", 'a[href^="/estudantes/"]', "Ver acompanhamento");
  const resource = await firstLink(page, "/recursos", 'a[href^="/recursos/"]');
  const material = student ? await firstLink(page, `${student}/materiais`, `a[href^="${student}/materiais/"]`) : null;
  const report = student ? await firstLink(page, `${student}/relatorios`, `a[href^="${student}/relatorios/"]`) : null;
  const adapted = student ? await firstLink(page, `${student}/atividades`, `a[href^="${student}/atividades/adaptadas/"]`) : null;
  const tabs = student ? [...STUDENT_TABS.map((tab) => tab.slug), "sondagem/aplicar", "dossie/imprimir"].map((slug) => [`estudante${slug ? `_${slug.replaceAll("/", "_")}` : ""}`, `${student}${slug ? `/${slug}` : ""}`]) : [];
  return [
    ["inicio", "/"], ["estudantes", "/estudantes"], ["estudantes_novo", "/estudantes/novo"], ["jornada", "/jornada"], ["assistente", "/assistente"],
    ["calendario", "/calendario"], ["ajuda", "/ajuda"], ["recursos", "/recursos"], resource && ["recurso", resource],
    ...tabs, material && ["material", material], material && ["material_imprimir", `${material}/imprimir`],
    report && ["relatorio", report], report && ["relatorio_imprimir", `${report}/imprimir`],
    student && ["adaptar", `${student}/atividades/adaptar`], adapted && ["adaptada", adapted], adapted && ["adaptada_imprimir", `${adapted}/imprimir`],
    ["jogos", "/jogos"], ...(student ? [["jogos_estudante", `/jogos?estudante=${student.split("/")[2]}`], ...["memoria", "sequencia", "associacao", "emocoes"].map((game) => [`jogar_${game}`, `/jogar/${game}?estudante=${student.split("/")[2]}&nivel=desafio`])] : []),
    ["planejamento", "/planejamento"], ["conta_seguranca", "/conta/seguranca"], ["avisos", "/avisos"], ["dossie", "/dossie"], ["pilula_sondagem", "/ajuda/pilulas/sondagem"], ["pilula_estudo", "/ajuda/pilulas/estudo-de-caso"], ["pilula_prova", "/ajuda/pilulas/adaptar-prova"], ["estudante_naoexiste", "/estudantes/naoexiste", 404],
    tutorialFor("professor_aee") && ["ajuda_videos", "/ajuda/videos"], tutorialFor("professor_aee") && ["ajuda_video", `/ajuda/videos/${tutorialFor("professor_aee")}`],
  ];
});

await account("professor_sala", "professor", async (page) => {
  const plan = await firstMatching(page, "/planejamento", /^\/planejamento\/[^/?#]+/).then((href) => href?.match(/^\/planejamento\/[^/?#]+/)?.[0]);
  const material = plan ? await firstLink(page, `${plan}/materiais`, `a[href^="${plan}/materiais/"]`) : null;
  const level = plan ? await firstLink(page, `${plan}/niveis`, `a[href^="${plan}/niveis/"]`) : null;
  return [["inicio", "/"], level && ["nivel_imprimir", level], ...(plan ? ["", "/apoios", "/aplicacao", "/materiais", "/niveis", "/historico"].map((tab) => [`planejamento${tab.replaceAll("/", "_")}`, `${plan}${tab}`]) : []), material && ["planejamento_material", material]];
});

await account("coordenacao", "coordenacao", async (page) => {
  const accountLink = await firstMatching(page, "/usuarios", /^\/usuarios\/(?!nova$)[^/?#]+$/);
  const censusSchool = await firstLink(page, "/censo", 'main a[href^="/censo/escolas/"]');
  let censusPreview = null;
  if (censusSchool) {
    await page.goto(`${BASE}${censusSchool}`, { waitUntil: "networkidle2" });
    const sample = join(mkdtempSync(join(tmpdir(), "censo-")), "migracao.txt");
    const code = await page.$eval("#escola-inep", (input) => input.value).catch(() => "");
    writeFileSync(sample, code ? sampleFile(2025, { code }) : sampleFile(2025), "latin1");
    await (await page.$('input[type="file"][name="file"]'))?.uploadFile(sample);
    await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Ler o arquivo"))?.click());
    if (await until(page, () => location.pathname.startsWith("/censo/importacoes/"), { timeout: 30000 })) censusPreview = new URL(page.url()).pathname;
  }
  return [["censo", "/censo"], censusSchool && ["censo_escola", censusSchool], censusPreview && ["censo_previa", censusPreview], ["painel", "/painel"], ["dossie", "/dossie"], ["dossie_pendentes", "/dossie?filtro=pendentes"], ["cadastros", "/cadastros"], ["jornada", "/jornada"], ["estudantes", "/estudantes"], ["estudantes_importar", "/estudantes/importar"], ["usuarios", "/usuarios"], ["usuarios_nova", "/usuarios/nova"], accountLink && ["usuario", accountLink]];
});

await account("secretaria", "secretaria", async (page) => {
  const accountLink = await firstMatching(page, "/usuarios", /^\/usuarios\/(?!nova$)[^/?#]+$/);
  return [["inicio", "/"], ["painel", "/painel"], ["avisos", "/avisos"], ["dossie", "/dossie"], ["censo", "/censo"], ["estudantes_importar", "/estudantes/importar"], ["usuarios", "/usuarios"], ["usuarios_nova", "/usuarios/nova"], accountLink && ["usuario", accountLink]];
});

await account("familia", "familia", async (page) => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  const portal = new URL(page.url()).pathname;
  const material = await firstLink(page, portal, 'a[href*="/materiais/"]');
  const report = await firstLink(page, portal, 'a[href*="/relatorios/"]');
  return [["portal", portal], ["jornada", "/jornada"], ["conta_seguranca", "/conta/seguranca"], ["avisos", "/avisos"], material && ["material", material], report && ["relatorio", report]];
});

await account("terapeuta", "terapeuta", async () => [["portal", "/terapeuta"], ["jornada", "/jornada"], ["avisos", "/avisos"]]);

for (const [role, short] of visited) {
  const missing = getNavigation(role, ["_"]).filter((item) => !item.href.startsWith("/familia/") && !checked.has(item.href));
  if (!missing.length) continue;
  const session = await signedIn(role);
  for (const item of missing) await check(session.wide, session.narrow, `${short}_${item.href.slice(1).replaceAll("/", "_")}`, item.href);
  await session.close();
}

await browser.close();
console.log(problems ? `\n${problems} tela(s) com problema` : "\nTodas as telas passaram.");
process.exit(problems ? 1 : 0);
