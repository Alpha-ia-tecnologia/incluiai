import { existsSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BASE, afterAction, appears, clickByText, clickExact, emailOf, fill, launchChrome, login, newSession as openSession, report, settle, textOf, totpCodes, until } from "./e2e-support.mjs";
import { DEMO_ACCOUNTS, DEMO_SCHOOL, DEMO_STUDENTS } from "./prisma/demo-data.mjs";
import { RECOVERY_CODE_COUNT, totpAt } from "./src/lib/totp.ts";
import { TEMPORARY_PASSWORD_PATTERN } from "./src/lib/accounts-core.ts";
import { DEFAULT_MONITOR } from "./src/lib/census-core.ts";
import { isoToBr } from "./src/lib/dates.ts";
import { censusFile } from "./src/lib/educacenso.fixture.mjs";
import { firstName } from "./src/lib/format.ts";
import { CARD_TOKEN_PATTERN } from "./src/lib/student-card-core.ts";
import { normalizeName } from "./src/lib/student-identity.ts";
import { IMPORT_TEMPLATE } from "./src/lib/student-import.ts";
import { CONTENT_ID } from "./src/lib/landmarks.ts";
import { VLIBRAS_CHECKED_VERSION, VLIBRAS_ROOT } from "./src/lib/vlibras-core.ts";
import { LOGIN_MAX_FAILURES, SESSION_COOKIE } from "./src/lib/session-core.ts";

const ONLY_WAIT = process.env.E2E_ONLY === "espera";
const PAID = process.env.E2E_PAGO === "1";
const { check, warn, section, finish } = report();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DANTE = DEMO_STUDENTS.dante.name;
const RAVI = DEMO_STUDENTS.ravi.name;
const [DANTE_FIRST, RAVI_FIRST] = [DANTE, RAVI].map(firstName);

const browser = await launchChrome();
const newSession = () => openSession(browser);
const contentText = (page) => page.$eval(`#${CONTENT_ID}`, (main) => main.textContent ?? "").catch(() => "");

async function choose(page, label, value) {
  const handle = await page.evaluateHandle((l) => [...document.querySelectorAll("label")].find((item) => item.textContent.includes(l))?.control ?? null, label);
  const select = handle.asElement();
  if (!select) throw new Error(`campo não encontrado: ${label}`);
  await select.select(value);
  return select;
}
async function chooseOther(page, label, text) {
  const select = await choose(page, label, "__outro__");
  const id = await select.evaluate((element) => element.id);
  await page.waitForSelector(`[id="${id}-outro"]`, { timeout: 5000 });
  await page.type(`[id="${id}-outro"]`, text);
}
async function typeOther(page, legend, text) {
  const opened = await page.evaluate((l) => {
    const fieldset = [...document.querySelectorAll("fieldset")].find((item) => item.querySelector("legend")?.textContent.includes(l));
    const button = fieldset?.querySelector("button[aria-expanded]");
    button?.click();
    return Boolean(button);
  }, legend);
  if (!opened) throw new Error(`grupo não encontrado: ${legend}`);
  const input = await page.waitForFunction((l) => [...document.querySelectorAll("fieldset")].find((item) => item.querySelector("legend")?.textContent.includes(l))?.querySelector('input[id$="-texto"]'), { timeout: 5000 }, legend);
  await input.asElement().type(text);
}

async function activitiesForm(page) {
  return page.evaluate(() => {
    const text = document.body.innerText;
    if (text.includes("Primeiro, registre como o estudante aprende")) return { skip: "o estudante ainda não tem o registro de como aprende" };
    if (text.includes("O plano precisa de pelo menos um objetivo ativo")) return { skip: "o plano não tem objetivo ativo" };
    return {
      button: [...document.querySelectorAll("button")].some((button) => button.textContent.includes("Preparar 3 sugestões")),
      aiOn: text.includes("Três agentes de IA trabalham ao mesmo tempo"),
    };
  });
}

if (!ONLY_WAIT) {
  await section("sem sessão", async () => {
    const { ctx, page } = await newSession();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    check("não autenticado → /login", page.url().includes("/login"));
    await ctx.close();
  });

  await section("sessão", async () => {
    const { ctx, page } = await newSession();
    await login(page, "professor_aee");
    const [session] = (await page.cookies()).filter((cookie) => cookie.name === SESSION_COOKIE);
    check("sessão: cookie httpOnly com código aleatório", Boolean(session?.httpOnly) && !String(session?.value ?? "").includes("."), JSON.stringify({ httpOnly: session?.httpOnly }));
    await clickByText(page, "Sair da plataforma");
    await until(page, () => location.pathname.startsWith("/login"), { timeout: 15000 });
    const other = await newSession();
    if (session) await other.page.setCookie({ name: session.name, value: session.value, domain: session.domain, path: session.path });
    await other.page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    check("sessão: depois de sair, o cookie antigo não vale", other.page.url().includes("/login"), `url=${other.page.url()}`);
    await other.ctx.close();

    await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
    let message = "";
    for (let attempt = 1; attempt <= LOGIN_MAX_FAILURES + 1; attempt++) {
      await fill(page, "#email", "bloqueio@teste.edu.br");
      await fill(page, "#password", `errada-${attempt}`);
      await afterAction(page, () => clickByText(page, "Entrar"));
      await until(page, () => !document.querySelector('form:has(#password) button[type="submit"]')?.disabled && Boolean(document.querySelector('[role="alert"]')));
      message = await textOf(page);
    }
    check(`login: ${LOGIN_MAX_FAILURES + 1}ª tentativa errada seguida é bloqueada`, message.includes("Muitas tentativas"), message.slice(0, 200));
    await ctx.close();
  });

  for (const [role, path, h1part] of [
    ["secretaria", "/", "O que vamos fazer hoje?"],
    ["professor_sala", "/", "O que vamos fazer hoje?"],
    ["terapeuta", "/terapeuta", "Articulação intersetorial"],
    ["familia", "/familia/", "Acompanhamento de"],
  ]) {
    const who = emailOf(role).split("@")[0];
    await section(`login ${who}`, async () => {
      const { ctx, page, errors } = await newSession();
      const url = await login(page, role);
      const h1 = (await page.evaluate(() => document.querySelector("h1")?.textContent)) ?? "";
      check(`login ${who} → ${path}`, url.includes(path) && h1.includes(h1part), `url=${url} h1=${h1}`);
      check(`sem erros de cliente (${who})`, errors.length === 0, errors.join("; "));
      await ctx.close();
    });
  }

  await section("painel do professor", async () => {
    const { ctx, page } = await newSession();
    await login(page, "professor_sala");
    await page.goto(`${BASE}/painel`, { waitUntil: "networkidle2" });
    await settle(page);
    const h1 = await page.evaluate(() => document.querySelector("h1")?.textContent);
    const scoped = await page.evaluate(() => !document.querySelector("#escola") && !document.querySelector("#equipe"));
    check("professor vê só o painel da própria escola", h1 === "Painel de indicadores" && scoped, `h1=${h1}`);
    await ctx.close();
  });
  await section("família e terapeuta bloqueados", async () => {
    const { ctx, page } = await newSession();
    const familyHome = await login(page, "familia");
    const childId = new URL(familyHome).pathname.split("/").pop();
    for (const path of ["/estudantes", "/recursos", "/painel", `/estudantes/${childId}`, `/estudantes/${childId}/diario`, `/estudantes/${childId}/perfil`, `/estudantes/${childId}/atividades`]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
      await settle(page);
      check(`família bloqueada de ${path.replace(childId, ":id")}`, page.url().includes("/familia/"), `url=${page.url()}`);
    }
    await page.goto(`${BASE}/familia/${childId}`, { waitUntil: "networkidle2" });
    const portalText = await page.evaluate(() => document.body.innerText);
    check("família: portal sem seções vazias (materiais e relatórios)", !portalText.includes("Materiais para usar em casa") && !portalText.includes("Relatórios da escola") && portalText.includes("Atividades para fazer em casa"));
    await ctx.close();

    const therapist = await newSession();
    await login(therapist.page, "terapeuta");
    for (const path of [`/estudantes/${childId}/diario`, `/estudantes/${childId}`, `/familia/${childId}`]) {
      await therapist.page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
      await settle(therapist.page);
      check(`terapeuta bloqueado de ${path.replace(childId, ":id")}`, new URL(therapist.page.url()).pathname === "/terapeuta", `url=${therapist.page.url()}`);
    }
    await therapist.ctx.close();
  });
}

let danteHref = "";
await section("acompanhamento de Dante", async () => {
  const { ctx, page, errors } = await newSession();
  await login(page, "professor_aee");
  await page.goto(`${BASE}/estudantes`, { waitUntil: "networkidle2" });
  danteHref = await page.evaluate((name) => {
    const student = [...document.querySelectorAll("article")].find((card) => card.querySelector("h2")?.textContent.includes(name));
    return [...(student?.querySelectorAll("a") ?? [])].find((link) => link.textContent.trim() === "Ver acompanhamento")?.getAttribute("href") ?? "";
  }, DANTE);
  check("lista de estudantes mostra Dante e seu acompanhamento", /^\/estudantes\/[^/]+$/.test(danteHref));
  if (!danteHref) return;
  for (const [tab, heading] of [
    ["", DANTE_FIRST],
    ["/perfil", "Como aprende"],
    ["/ppi", "Plano de ensino (PAEE e PEI)"],
    ["/atividades", "Preparar uma atividade"],
    ["/diario", "Registrar aula ou atendimento"],
    ["/linha-do-tempo", "Evolução"],
    ["/materiais", "Materiais de apoio"],
  ]) {
    await page.goto(`${BASE}${danteHref}${tab}`, { waitUntil: "networkidle2" });
    const hasHeading = await page.evaluate((expected) => [...document.querySelectorAll("h1, h2")].some((title) => title.textContent.includes(expected)), heading);
    check(`seção ${tab || "/resumo"} renderiza`, hasHeading);
  }
  {
    await page.goto(`${BASE}${danteHref}/ppi`, { waitUntil: "networkidle2" });
    const opened = await page.evaluate(() => { const details = document.querySelector("#revisao details"); if (details) details.open = true; return Boolean(details); });
    if (!opened) check("plano: formulário de revisão presente", false);
    else {
      const note = `Teste E2E: objetivos mantidos, apoio reduzido. ${Date.now()}`;
      await page.type("#review-summary", note);
      await clickByText(page, "Registrar revisão");
      await until(page, (text) => document.querySelector("#revisao")?.textContent.includes(text), { timeout: 20000 }, note);
      check("plano: revisão registrada no histórico", await page.evaluate((text) => Boolean(document.querySelector("#revisao")?.textContent.includes(text)), note));
    }
  }
  // PAEE e PEI (Portaria MEC nº 421/2026; orientação do INEP).
  {
    await page.goto(`${BASE}${danteHref}/ppi`, { waitUntil: "networkidle2" });
    const text = await page.evaluate(() => document.body.innerText);
    check("plano: selo de orientação do Governo Federal com o link do INEP", text.includes("Orientação do Governo Federal") && await page.evaluate(() => Boolean(document.querySelector('a[href^="https://www.gov.br/inep/"]'))));
    check("plano: PAEE e PEI com a base na Portaria", Boolean(await page.$("#paee")) && Boolean(await page.$("#pei")) && text.includes("Portaria MEC nº 421/2026, art. 10") && text.includes("Portaria MEC nº 421/2026, art. 11"));
    const opened = await page.evaluate(() => { const details = document.querySelector("#completar-paee-pei"); if (details) details.open = true; return Boolean(details); });
    if (!opened) check("plano: formulário do PAEE e do PEI presente", false);
    else {
      const stamp = String(Date.now()).slice(-5);
      // Atendimentos do AEE e recursos na avaliação com os nomes do Educacenso.
      const form = await page.evaluate(() => {
        const box = document.querySelector("#completar-paee-pei");
        const checked = [...box.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.closest("label")?.textContent.trim());
        return { text: box.textContent, checked };
      });
      check("plano: PEI com os tipos de AEE e os recursos do Censo", form.text.includes("Atendimentos do AEE") && form.text.includes("Ensino do cálculo no Soroban") && form.text.includes("Auxílio ledor") && form.text.includes("Prova superampliada (fonte 24)"));
      check("plano: atendimento do AEE sugerido pelo estudo de caso", form.checked.includes("Comunicação alternativa e aumentativa (CAA)"), form.checked.join(", "));
      await page.evaluate(() => { for (const id of ["#editar-aee-teacher", "#editar-regular-teacher"]) document.querySelector(id).value = ""; });
      await page.type("#editar-aee-teacher", `Ana AEE ${stamp}`);
      await page.type("#editar-regular-teacher", `Bruno Regente ${stamp}`);
      await clickByText(page, "Salvar o PAEE e o PEI");
      await until(page, (value) => document.querySelector("#pei")?.textContent.includes(value), { timeout: 20000 }, `Bruno Regente ${stamp}`);
      check("plano: PAEE e PEI completados com quem elaborou", await page.evaluate((value) => Boolean(document.querySelector("#paee")?.textContent.includes(`Ana AEE ${value}`) && document.querySelector("#pei")?.textContent.includes(`Bruno Regente ${value}`)), stamp));
    }
  }
  check("prontuário sem erros de cliente", errors.length === 0, errors.join("; "));
  await page.goto(`${BASE}${danteHref}/estudo-de-caso`, { waitUntil: "networkidle2" });
  check("estudo de caso: AEE vê os campos clínicos", await page.evaluate(() => document.body.innerText.includes("Diagnóstico informado pela família")));
  await ctx.close();
  const roomTeacher = await newSession();
  await login(roomTeacher.page, "professor_sala");
  await roomTeacher.page.goto(`${BASE}${danteHref}/estudo-de-caso`, { waitUntil: "networkidle2" });
  const roomText = await roomTeacher.page.evaluate(() => document.body.innerText);
  check("estudo de caso: sala comum não vê os campos clínicos", !roomText.includes("Diagnóstico informado pela família") && roomText.includes("ficam visíveis só para o AEE e a coordenação"));
  await roomTeacher.ctx.close();
});
if (!danteHref) {
  console.log("Dante não foi encontrado na lista; os formulários não serão executados.");
  await browser.close();
  process.exit(finish());
}

if (!ONLY_WAIT) {
  await section("atividade, registro e material", async () => {
    const { ctx, page, errors } = await newSession();
    await login(page, "professor_aee");
    const countSuggestions = () => page.evaluate(() => [...document.querySelectorAll("button")].filter((button) => button.textContent.trim() === "Usar esta atividade").length);

    await page.goto(`${BASE}${danteHref}/atividades`, { waitUntil: "networkidle2" });
    const form = await activitiesForm(page);
    if (form.skip) {
      console.log(`SKIP  preparar 3 sugestões: ${form.skip}`);
    } else if (!form.button) {
      check("preparar 3 sugestões: formulário presente", false);
    } else if (form.aiOn && !PAID) {
      console.log("SKIP  preparar 3 sugestões: com a IA ligada usa os agentes pagos (rode com E2E_PAGO=1)");
    } else {
      const suggestionsBefore = await countSuggestions();
      await chooseOther(page, "O que a turma vai estudar", "leitura de nomes na chamada");
      await clickByText(page, "Preparar 3 sugestões");
      await until(page, (before) => [...document.querySelectorAll("button")].filter((button) => button.textContent.trim() === "Usar esta atividade").length === before + 3, { timeout: form.aiOn ? 300000 : 30000 }, suggestionsBefore);
      check("preparar 3 sugestões de atividade", (await countSuggestions()) === suggestionsBefore + 3);
    }

    let acceptedDiaryHref = null;
    if ((await countSuggestions()) === 0) {
      console.log("SKIP  aceitar atividade e registrar a aula: não há sugestão aberta");
    } else {
      const acceptedBefore = await page.$$eval('a[href*="/diario?activityId="]', (links) => links.map((link) => link.getAttribute("href")));
      await clickByText(page, "Usar esta atividade");
      await until(page, (previous) => [...document.querySelectorAll('a[href*="/diario?activityId="]')].some((link) => !previous.includes(link.getAttribute("href"))), { timeout: 20000 }, acceptedBefore);
      acceptedDiaryHref = await page.evaluate((previous) => [...document.querySelectorAll('a[href*="/diario?activityId="]')].find((link) => !previous.includes(link.getAttribute("href")))?.getAttribute("href"), acceptedBefore);
      check("aceitar atividade (sugerida → aceita)", Boolean(acceptedDiaryHref));
    }

    {
      await page.goto(`${BASE}${acceptedDiaryHref ?? `${danteHref}/diario`}`, { waitUntil: "networkidle2" });
      await page.click('input[name="participation"][value="total"]');
      await page.select("#supportLevel", "1");
      await page.click('input[name="criterionMet"][value="sim"]');
      await choose(page, "Seu papel neste registro", "professor_aee");
      const diaryNote = `Teste E2E: identificou o nome com supervisão. ${Date.now()}`;
      await page.type("#note", diaryNote);
      await clickByText(page, "Salvar registro");
      await until(page, (note) => document.querySelector("#historico-registros")?.textContent.includes(note), { timeout: 20000 }, diaryNote);
      check("registro da aula salvo no histórico", await page.evaluate((note) => Boolean(document.querySelector("#historico-registros")?.textContent.includes(note)), diaryNote));
    }

    await page.goto(`${BASE}${danteHref}/materiais`, { waitUntil: "networkidle2" });
    const materialsBefore = await page.$$eval("article[id^='material-']", (items) => items.length);
    await page.$eval("input[name=kind][value=historia_social]", (radio) => radio.click());
    await clickByText(page, "Criar material");
    await until(page, (href) => /^\/[^/]+$/.test(location.pathname.slice(`${href}/materiais`.length)) && location.pathname.startsWith(`${href}/materiais/`) && Boolean(document.querySelector("article[id^='material-'] h2")), { timeout: 180000 }, danteHref);
    const opened = await page.evaluate(() => {
      const articles = document.querySelectorAll("article[id^='material-']");
      const article = articles[0];
      return {
        path: location.pathname,
        id: article?.id ?? "",
        single: articles.length === 1,
        // O título da IA pode não repetir o tipo; o selo do tipo fica no mesmo article.
        kind: Boolean(article?.textContent?.includes("História social")),
        title: Boolean(article?.querySelector("h2")?.textContent?.trim()),
        activities: Boolean(article?.textContent?.includes("Atividades para aplicar")),
        notice: document.body.innerText.includes("Material criado"),
      };
    });
    check("criar material: abre a página do material (história social, com atividades para aplicar)",
      opened.path.startsWith(`${danteHref}/materiais/`) && opened.single && opened.kind && opened.title && opened.activities && opened.notice, JSON.stringify(opened));
    await page.evaluate(() => [...document.querySelectorAll("a")].find((link) => link.textContent.includes("Voltar para os materiais"))?.click());
    await until(page, (before) => document.querySelectorAll("article[id^='material-']").length === before + 1, { timeout: 20000 }, materialsBefore);
    const gallery = await page.evaluate(() => [...document.querySelectorAll("article[id^='material-']")].map((item) => item.id));
    check("galeria de materiais: um cartão a mais, o novo primeiro", gallery.length === materialsBefore + 1 && gallery[0] === opened.id, `${gallery.length} cartões`);
    check("fluxos sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  });

  await section("terapeuta", async () => {
    const { ctx, page, errors } = await newSession();
    await login(page, "terapeuta");
    for (const [legend, txt] of [
      ["Formas de comunicação mais eficazes", "Prancha com apoio visual funciona melhor."],
      ["Recursos de acessibilidade utilizados", "Fone abafador e prancha."],
      ["Fatores que facilitam a participação", "Antecipação e temas de interesse."],
      ["Estratégias que podem ser testadas", "Pareamento com miniaturas."],
      ["Orientações aplicáveis à escola", "Avisar transições 2 minutos antes."],
      ["Objetivos compartilhados escola-família", "Ampliar pedidos espontâneos pela prancha."],
    ]) await typeOther(page, legend, txt);
    await clickByText(page, "Enviar para a equipe escolar");
    await until(page, () => document.body.innerText.includes("Pareamento com miniaturas"), { timeout: 20000 });
    check("relatório de articulação intersetorial", await page.evaluate(() => document.body.innerText.includes("Pareamento com miniaturas")));
    check("terapeuta sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  });

  await section("família", async () => {
    const { ctx, page, errors } = await newSession();
    await login(page, "familia");
    await typeOther(page, "O que aconteceu?", "Teste E2E: pediu água pela prancha no jantar.");
    // O botão do próprio formulário: numa base nova, a pergunta da semana vem antes com "Enviar para a escola".
    await page.evaluate(() => [...document.querySelectorAll("fieldset")].find((item) => item.querySelector("legend")?.textContent.includes("O que aconteceu?")).closest("form").querySelector('button[type="submit"]').click());
    await until(page, () => document.body.innerText.includes("pediu água pela prancha no jantar"), { timeout: 20000 });
    check("família registra conquista de casa", await page.evaluate(() => document.body.innerText.includes("pediu água pela prancha no jantar")));
    check("família vê log de acessos (LGPD)", await page.evaluate(() => document.body.innerText.toLowerCase().includes("quem acessou os dados")));
    check("família vê o nome de quem acessou a ficha", new RegExp(`${firstName(DEMO_ACCOUNTS.professor_aee.name)}[\\s\\S]{0,160}visualizou`).test(await contentText(page)));
    check("família vê as autorizações", await page.evaluate(() => Boolean(document.querySelector("#autorizacoes"))));
    await clickByText(page, "Retirar a autorização: Conexão com o terapeuta");
    await until(page, () => [...document.querySelectorAll("#autorizacoes button")].some((button) => button.textContent.includes("Autorizar: Conexão com o terapeuta")), { timeout: 15000 });
    const therapistWaiting = await newSession();
    await login(therapistWaiting.page, "terapeuta");
    check("terapeuta em espera sem a autorização da família", await therapistWaiting.page.evaluate(() => document.body.innerText.includes("Aguardando a autorização da família")));
    await therapistWaiting.ctx.close();
    await clickByText(page, "Autorizar: Conexão com o terapeuta");
    await until(page, () => [...document.querySelectorAll("#autorizacoes button")].some((button) => button.textContent.includes("Retirar a autorização: Conexão com o terapeuta")), { timeout: 15000 });
    check("família autoriza de novo a conexão com o terapeuta", await page.evaluate(() => [...document.querySelectorAll("#autorizacoes button")].some((button) => button.textContent.includes("Retirar a autorização: Conexão com o terapeuta"))));
    check("família sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  });

  await section("Secretaria", async () => {
    const { ctx, page, errors } = await newSession();
    await login(page, "secretaria");
    await page.goto(`${BASE}/painel-municipal`, { waitUntil: "networkidle2" });
    check("endereço antigo do painel municipal redireciona", page.url().endsWith("/painel"), page.url());
    await page.goto(`${BASE}/painel?periodo=tudo`, { waitUntil: "networkidle2" });
    const body = await page.evaluate(() => document.body.innerText);
    check("painel: indicadores da rede", body.includes("Jornada do acompanhamento") && body.includes("Toda a rede") && Boolean(await page.$('nav[aria-label="Indicador do medidor"]')));
    check("painel: banco de práticas agregado", body.toLowerCase().includes("banco de práticas por perfil"));
    check("secretaria: painel sem nomes, com avisos por escola", body.includes("Avisos por escola") && !body.includes(DANTE));
    await page.goto(`${BASE}/estudantes`, { waitUntil: "networkidle2" });
    check("secretaria: lista de estudantes só com busca", !(await textOf(page)).includes(DANTE));
    await page.goto(`${BASE}/estudantes?q=${encodeURIComponent(DANTE.slice(0, 3))}`, { waitUntil: "networkidle2" });
    check("secretaria: busca com 3 letras encontra o estudante", (await textOf(page)).includes(DANTE));
    await page.goto(`${BASE}${danteHref}`, { waitUntil: "networkidle2" });
    const asked = page.url().includes("/acesso-nominal/");
    const reopened = !asked && (await page.evaluate(() => document.body.innerText.includes("Acesso de leitura com motivo registrado")));
    check("secretaria: ficha com nome pede o motivo", asked || reopened, `url=${page.url()}`);
    if (asked || reopened) {
      if (asked) {
        await choose(page, "Motivo do acesso", "Transferência entre escolas");
        await page.type("#access-detail", "Teste E2E: conferir o plano antes da transferência.");
        await clickByText(page, "Registrar o motivo e abrir a ficha");
        await until(page, () => /\/estudantes\/[^/]+$/.test(location.pathname), { timeout: 20000 });
      }
      const record = await page.evaluate(() => ({
        banner: document.body.innerText.includes("Acesso de leitura com motivo registrado"),
        tabs: [...document.querySelectorAll('nav[aria-label="Seções do estudante"] a')].map((link) => link.textContent.trim()),
      }));
      check("secretaria: ficha aberta só para leitura", record.banner && !record.tabs.includes("Registrar aula") && record.tabs.includes("Plano de ensino"), JSON.stringify(record));
      await page.goto(`${BASE}${danteHref}/diario`, { waitUntil: "networkidle2" });
      check("secretaria: aba de registro volta ao resumo", new URL(page.url()).pathname === danteHref, `url=${page.url()}`);
      const family = await newSession();
      await login(family.page, "familia");
      check("família vê o acesso justificado da Secretaria", (await contentText(family.page)).includes("acesso justificado"));
      await family.ctx.close();
    }
    check("assistente: botão flutuante em todas as telas", Boolean(await page.$(".assistant-fab")));
    await page.goto(`${BASE}/assistente`, { waitUntil: "networkidle2" });
    check("assistente: página própria", (await page.evaluate(() => document.querySelector("h1")?.textContent)) === "Converse com o assistente");
    await page.goto(`${BASE}/recursos`, { waitUntil: "networkidle2" });
    check("banco de recursos renderiza", await page.evaluate(() => document.querySelector("h1")?.textContent === "Recursos para incluir."));
    const bank = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('a[href^="/recursos/"]')];
      return { cards: cards.length, withPhoto: cards.filter((card) => card.querySelector('img[src*="activities"]')).length };
    });
    check("banco: 24 recursos, cada um com fotografia", bank.cards === 24 && bank.withPhoto === 24, JSON.stringify(bank));
    const resourceHref = await page.evaluate(() =>
      [...document.querySelectorAll("a")].find((a) => a.getAttribute("href")?.startsWith("/recursos/"))?.getAttribute("href")
    );
    check("recurso exibe atividades correspondentes", Boolean(resourceHref));
    if (resourceHref) {
      await page.goto(`${BASE}${resourceHref}`, { waitUntil: "networkidle2" });
      const detail = await page.evaluate(() => document.body.innerText);
      const normalizedDetail = detail.toLocaleLowerCase("pt-BR");
      check("atividade traz objetivo, aplicação e evidência", normalizedDetail.includes("como aplicar") && normalizedDetail.includes("evidência a observar"));
      check("recurso traz foto, preparação, modelo, níveis de apoio e continuidade", ["antes de começar", "modelo de apoio", "ajuste o apoio à participação", "para continuar"].every((part) => normalizedDetail.includes(part)) && await page.evaluate(() => Boolean(document.querySelector('figure img[src*="activities"]')?.getAttribute("alt"))));
      await clickByText(page, "Teve boa resposta");
      await until(page, () => document.body.innerText.includes("1 aplicações"), { timeout: 20000 });
      check("resultado da atividade alimenta métrica", await page.evaluate(() => document.body.innerText.includes("boa resposta")));
    }
    check("secretaria sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  });
}

const stubTurn = (page) => page.evaluateOnNewDocument(() => {
  const realFetch = window.fetch.bind(window);
  const encoder = new TextEncoder();
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/assistente/conversas/") && window.__conversation) {
      window.__asked = (window.__asked ?? 0) + 1;
      const body = JSON.stringify({ conversation: window.__conversation });
      return new Promise((resolve) => setTimeout(() => {
        window.__served = (window.__served ?? 0) + 1;
        resolve(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } }));
      }, window.__conversationDelay ?? 0));
    }
    if (!url.includes("/api/assistente/turno")) return realFetch(input, init);
    window.__turns = (window.__turns ?? 0) + 1;
    const stream = new ReadableStream({
      start(controller) {
        window.__sse = (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        window.__sseEnd = () => controller.close();
      },
    });
    return Promise.resolve(new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } }));
  };
});
const GARDEN = '[data-testid="espera-jardim"]';
const counter = (page, name) => page.evaluate((key) => window[key] ?? 0, name);
const counterAbove = (page, name, before) => until(page, (key, count) => (window[key] ?? 0) > count, { timeout: 5000 }, name, before);
const gardenIs = (page, attributes, timeout = 3000) => until(page, (selector, expected) => {
  const garden = document.querySelector(selector);
  return Boolean(garden) && Object.entries(expected).every(([name, value]) => garden.getAttribute(name) === value);
}, { timeout }, GARDEN, attributes);
const statusIs = (page, text, timeout = 3000) => until(page, (expected) => document.querySelector('[data-testid="espera-status"]')?.textContent === expected, { timeout }, text);
const statusHas = (page, text, timeout = 3000) => until(page, (expected) => Boolean(document.querySelector('[data-testid="espera-status"]')?.textContent.includes(expected)), { timeout }, text);
const nextFrames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

await section("espera do assistente", async () => {
  const { ctx, page, errors } = await newSession();
  await stubTurn(page);
  await page.setViewport({ width: 320, height: 568 });
  await login(page, "professor_sala");
  await page.evaluate(() => { document.documentElement.dataset.esperaEscala = "20"; });
  const sse = (event) => page.evaluate((e) => window.__sse(e), event);
  const sseEnd = () => page.evaluate(() => window.__sseEnd());
  const garden = (name) => page.$eval(GARDEN, (el, n) => el.getAttribute(n), name);
  const status = () => page.$eval('[data-testid="espera-status"]', (el) => el.textContent);
  const height = () => page.$eval(GARDEN, (el) => Math.round(el.getBoundingClientRect().height));
  const fab = (name) => page.$eval(".assistant-fab", (el, n) => el.getAttribute(n), name);
  const fabIs = (attributes) => until(page, (expected) => {
    const button = document.querySelector(".assistant-fab");
    return Boolean(button) && Object.entries(expected).every(([name, value]) => button.getAttribute(name) === value);
  }, { timeout: 3000 }, attributes);
  const focused = () => page.evaluate(() => (document.activeElement?.classList.contains("assistant-fab") ? "fab" : document.activeElement?.tagName ?? ""));
  const lastItem = () => page.evaluate(() => [...document.querySelectorAll("#assistente-painel ol > li")].at(-1)?.textContent ?? "");
  const lastItemHas = (parts) => until(page, (wanted) => {
    const text = [...document.querySelectorAll("#assistente-painel ol > li")].at(-1)?.textContent ?? "";
    return wanted.every((part) => text.includes(part));
  }, { timeout: 3000 }, parts);
  const tipRegion = () => page.$eval('#assistente-painel [data-testid="espera-dica"]', (el) => el.textContent);
  const markShape = () => page.$eval(".assistant-fab-mark", (el) => { const style = getComputedStyle(el); return `${el.dataset.activity}|${style.borderRadius}|${style.transform === "none" ? "reto" : "girado"}`; });
  const markIs = (shape) => until(page, (expected) => {
    const mark = document.querySelector(".assistant-fab-mark");
    if (!mark) return false;
    const style = getComputedStyle(mark);
    return `${mark.dataset.activity}|${style.borderRadius}|${style.transform === "none" ? "reto" : "girado"}` === expected;
  }, { timeout: 3000 }, shape);
  const panelOpen = (open = true) => until(page, (wanted) => {
    const panel = document.querySelector("#assistente-painel");
    return Boolean(panel) && panel.hidden !== wanted;
  }, { timeout: 3000 }, open);
  const turnOver = () => until(page, () => document.querySelector("#assistente-painel textarea")?.readOnly === false, { timeout: 5000 });
  const writeAndSend = async (text) => {
    const before = await counter(page, "__turns");
    await page.focus("#assistente-painel textarea");
    await page.keyboard.type(text);
    await page.keyboard.press("Enter");
    await counterAbove(page, "__turns", before);
  };
  const newConversation = async () => {
    await page.click('#assistente-painel button[aria-label="Nova conversa"]');
    await until(page, () => document.querySelectorAll("#assistente-painel ol > li").length === 0, { timeout: 3000 });
  };
  const stamp = () => new Date().toISOString();
  const done = (id, text) => sse({ type: "done", message: { id, role: "assistente", text, steps: [], createdAt: stamp() }, conversation: { id: "e-conv", title: "Teste", updatedAt: stamp() }, long: false });

  await page.click(".assistant-fab");
  await page.waitForSelector(GARDEN, { timeout: 20000 });
  await page.click('#assistente-painel button[aria-label="Nova conversa"]');
  await until(page, () => {
    const panel = document.querySelector("#assistente-painel");
    return Boolean(panel?.textContent.includes("O assistente ainda não está ativo") || panel?.querySelector("ul[aria-label='Sugestões'] button"));
  }, { timeout: 5000 });
  const assistantOff = await page.evaluate(() => Boolean(document.querySelector("#assistente-painel")?.textContent.includes("O assistente ainda não está ativo")));
  const turnsBefore = await counter(page, "__turns");
  const suggestion = assistantOff ? false : await page.evaluate(() => {
    const button = document.querySelector("#assistente-painel ul[aria-label='Sugestões'] button");
    button?.click();
    return Boolean(button);
  });
  if (assistantOff) {
    console.log("SKIP  espera do assistente: assistente desligado nesta instalação");
  } else if (!suggestion) {
    check("espera: conversa nova mostra as sugestões", false);
  } else {
    await counterAbove(page, "__turns", turnsBefore);
    check("espera: pensando logo no envio", await gardenIs(page, { "data-state": "pensando" }, 2000));
    check("espera: popup de 568 px usa a faixa compacta", (await height()) <= 84, String(await height()));
    const field = await page.$eval("#assistente-painel textarea", (el) => [el.readOnly, el.disabled, el.getAttribute("aria-disabled")].join(","));
    check("espera: campo só leitura (não desligado) durante o turno", field === "true,false,true", field);
    check("espera: anúncio fora da conversa", await statusIs(page, "Pensando no seu pedido."), await status());
    check("espera: sem item vazio na conversa enquanto pensa", await page.evaluate(() => [...document.querySelectorAll("#assistente-painel ol > li")].every((item) => item.textContent.trim() !== "")));
    await sse({ type: "tool_start", step: { id: "e1", name: "ver_estudante", label: "Lendo o acompanhamento do estudante" } });
    check("espera: consulta vira raiz e é anunciada", (await gardenIs(page, { "data-scene": "raizes" })) && (await statusIs(page, "Lendo o acompanhamento.")), await status());
    check("espera: legenda legível pelo leitor de tela", await page.$eval('[data-testid="espera-legenda"]', (el) => !el.closest("[aria-hidden=true]") && el.textContent.includes("Lendo o acompanhamento")));
    await sse({ type: "tool_end", step: { id: "e1", name: "ver_estudante", label: "Lendo o acompanhamento do estudante", ok: true } });
    check("espera: passo real = folha nova e amarrilho a menos", await gardenIs(page, { "data-grown": "1", "data-ties": "1" }));
    await sse({ type: "tool_start", step: { id: "e2", name: "propor_plano", label: "Preparando a proposta de plano com os agentes" } });
    await sse({ type: "tool_progress", id: "e2", progress: { agent: "Analista do caso", phase: "start" } });
    const analyst = await until(page, () => document.querySelector('[data-part="degrau"][data-agent="analista"]')?.getAttribute("data-estado") === "ativo", { timeout: 3000 });
    check("espera: só o degrau do agente real acende", analyst && (await gardenIs(page, { "data-stage": "analista" })));
    check("espera: anúncio do agente com tempo habitual", await statusIs(page, "O analista lê o caso. Costuma levar de 1 a 3 minutos."), await status());
    check("espera: aos 20 s, aviso de que a resposta fica salva", (await gardenIs(page, { "data-elapsed": "20" }, 5000)) && (await statusHas(page, "Pode fechar o painel")), await status());
    const urlBefore = page.url();
    await page.click('#assistente-painel a[aria-label="Abrir em página inteira"]');
    await sleep(300);
    check("espera: página inteira espera o fim do turno", (await page.$eval('#assistente-painel a[aria-label="Abrir em página inteira"]', (el) => el.getAttribute("aria-disabled"))) === "true" && page.url() === urlBefore && (await page.$eval("#assistente-painel", (el) => !el.hidden)), page.url());
    await page.keyboard.press("Escape");
    check("espera: painel fechado avisa no botão", (await fabIs({ "aria-label": "Abrir o assistente (resposta em preparo)" })) && (await focused()) === "fab");
    await page.click(".assistant-fab");
    await sse({ type: "tool_end", step: { id: "e2", name: "propor_plano", label: "x", ok: true } });
    await sse({ type: "text", delta: "A proposta está pronta para a sua revisão. " });
    check("espera: texto chegando deixa a faixa compacta e parada", await gardenIs(page, { "data-state": "escrevendo", "data-respira": "false" }));
    await page.click('[data-testid="espera-regar"]');
    const tip = await until(page, () => (document.querySelector('[data-testid="espera-dica"]')?.textContent ?? "").length > 0, { timeout: 3000 });
    check("espera: regar mostra uma dica e não pega o foco do campo", tip && (await focused()) !== "TEXTAREA");
    await done("e-msg", "Proposta pronta.");
    await sseEnd();
    check("espera: final com flor e anúncio de resposta pronta", (await gardenIs(page, { "data-state": "pronto", "data-finale": "true" })) && (await statusIs(page, "Resposta pronta.")));
    const collapsed = (await gardenIs(page, { "data-state": "inativo" }, 6000)) && (await until(page, (selector) => Math.round(document.querySelector(selector).getBoundingClientRect().height) <= 1, { timeout: 3000 }, GARDEN));
    check("espera: depois do final, a faixa recolhe", collapsed);
    check("espera: sem rolagem horizontal a 320 px", (await page.evaluate(() => document.documentElement.scrollWidth)) <= 320);
    check("espera: a dica do turno não volta com a faixa fechada", (await tipRegion()) === "", await tipRegion());

    await writeAndSend("Mais uma pergunta");
    check("espera: envio pelo teclado mantém o foco no campo", (await focused()) === "TEXTAREA");
    await page.keyboard.press("Escape");
    await panelOpen(false);
    await sse({ type: "text", delta: "Segunda " });
    await gardenIs(page, { "data-state": "escrevendo" });
    check("espera: a dica velha não reaparece no turno seguinte", (await tipRegion()) === "" && !(await page.$eval('#assistente-painel [data-testid="espera-legenda"]', (el) => el.textContent)).includes("Dica:"), await tipRegion());
    await done("e-msg2", "Segunda resposta.");
    await sseEnd();
    const announced = await until(page, () => document.querySelector(".assistant-fab + p[role=status]")?.textContent === "A resposta do assistente está pronta.", { timeout: 3000 });
    check("espera: com o foco no botão, o nome fica e o status anuncia", announced && (await fab("aria-label")) === "Abrir o assistente (resposta em preparo)" && (await markIs("pronto|9999px|reto")), await markShape());
    await page.evaluate(() => document.activeElement?.blur());
    check("espera: fora do foco, o nome do botão mostra a resposta pronta", await fabIs({ "aria-label": "Abrir o assistente (resposta pronta)" }));
    const sprout = () => page.evaluate(() => {
      const icon = [...document.querySelectorAll("#assistente-painel ol > li")].at(-1)?.querySelector("p svg.lucide-sprout");
      return icon ? (icon.classList.contains("assistant-sprout-mark") ? "crescendo" : "assentado") : "ausente";
    });
    const sproutIs = (expected) => until(page, (wanted) => {
      const icon = [...document.querySelectorAll("#assistente-painel ol > li")].at(-1)?.querySelector("p svg.lucide-sprout");
      return (icon ? (icon.classList.contains("assistant-sprout-mark") ? "crescendo" : "assentado") : "ausente") === wanted;
    }, { timeout: 3000 }, expected);
    await page.click(".assistant-fab");
    await panelOpen();
    const growing = (await sproutIs("crescendo")) ? "crescendo" : await sprout();
    const settled = (await sproutIs("assentado")) ? "assentado" : await sprout();
    await page.keyboard.press("Escape");
    await panelOpen(false);
    await page.click(".assistant-fab");
    await panelOpen();
    const reopened = await sprout();
    check("espera: broto da resposta nova cresce uma vez só", growing === "crescendo" && settled === "assentado" && reopened === "assentado" && (await lastItem()).includes("Segunda resposta."), `${growing}/${settled}/${reopened}`);

    await writeAndSend("Pergunta com o painel aberto");
    await page.focus(".assistant-fab");
    await done("e-msg2b", "Resposta com o painel aberto.");
    await sseEnd();
    await turnOver();
    await page.keyboard.press("Enter");
    check("espera: fechar pelo botão focado mostra o estado de agora", (await fabIs({ "aria-expanded": "false" })) && (await fab("aria-label")) === "Abrir o assistente", await fab("aria-label"));
    await page.click(".assistant-fab");
    await panelOpen();

    await writeAndSend("Pergunta com erro");
    await sse({ type: "error", message: "Erro de teste." });
    await sseEnd();
    const retry = await lastItemHas(["Erro de teste.", "Usar a mesma mensagem"]);
    const alerts = await page.evaluate(() => document.querySelectorAll("#assistente-painel [role=alert]").length);
    check("espera: erro do turno sem alerta repetido, com reenvio", alerts === 0 && retry, `alertas=${alerts}`);

    const dropTurn = async (text, conversationId) => {
      await newConversation();
      await writeAndSend(text);
      await sse({ type: "conversation", conversation: { id: conversationId, title: text, updatedAt: stamp() } });
      await page.keyboard.press("Escape");
      await sse({ type: "tool_start", step: { id: `${conversationId}-t`, name: "propor_plano", label: "x" } });
      await sleep(1200);
      await sseEnd();
      await gardenIs(page, { "data-state": "interrompida" });
    };
    const savedConversation = (id, text, delay) => page.evaluate((conversation) => {
      window.__conversationDelay = conversation.delay;
      window.__conversation = {
        id: conversation.id, title: conversation.text, updatedAt: conversation.at, long: false, actions: [],
        messages: [
          { id: `${conversation.id}-m1`, role: "usuario", text: conversation.text, steps: [], createdAt: conversation.at },
          { id: `${conversation.id}-m2`, role: "assistente", text: "Resposta salva no servidor.", steps: [], createdAt: conversation.at },
        ],
      };
    }, { id, text, delay, at: stamp() });
    await dropTurn("Pergunta que cai", "e-conv2");
    check("espera: conexão caída não vira falha na faixa", (await garden("data-state")) === "interrompida" && (await page.$eval('[data-testid="espera-legenda"]', (el) => el.textContent)).includes("A conexão caiu."));
    const fell = await until(page, () => document.querySelector(".assistant-fab + p[role=status]")?.textContent.startsWith("A conexão com o assistente caiu."), { timeout: 3000 });
    check("espera: botão avisa a queda com losango", fell && (await markIs("interrompida|2px|girado")), await markShape());
    await page.click(".assistant-fab");
    await panelOpen();
    await lastItemHas(["A conexão caiu antes de a resposta chegar"]);
    const dropped = await lastItem();
    check("espera: queda sem reenvio, com 'Ver se a resposta ficou pronta'", dropped.includes("A conexão caiu antes de a resposta chegar") && dropped.includes("Ver se a resposta ficou pronta") && !dropped.includes("Usar a mesma mensagem"), dropped);
    await writeAndSend("Mandei de novo");
    await sse({ type: "error", message: "Aguarde a resposta anterior terminar." });
    await sseEnd();
    await lastItemHas(["Aguarde a resposta anterior terminar."]);
    const busy = await lastItem();
    check("espera: depois da queda, o erro de ocupado oferece a consulta, não o reenvio", busy.includes("Aguarde a resposta anterior terminar.") && busy.includes("Ver se a resposta ficou pronta") && !busy.includes("Usar a mesma mensagem"), busy);
    await savedConversation("e-conv2", "Pergunta que cai", 800);
    const [asked, served] = [await counter(page, "__asked"), await counter(page, "__served")];
    await page.click("#assistente-painel ol > li:last-child button");
    await counterAbove(page, "__asked", asked);
    await page.click('#assistente-painel button[aria-label="Nova conversa"]');
    await counterAbove(page, "__served", served);
    await nextFrames(page);
    check("espera: consulta atrasada não desfaz 'Nova conversa'", (await page.$$eval("#assistente-painel ol > li", (items) => items.length)) === 0 && (await page.$eval("#assistente-painel header", (el) => el.textContent)).includes("Nova conversa"));
    await dropTurn("Outra pergunta que cai", "e-conv3");
    await page.click(".assistant-fab");
    await panelOpen();
    await page.evaluate(() => { const first = document.querySelector("#assistente-painel ol > li"); if (first) first.dataset.marca = "antes"; });
    await savedConversation("e-conv3", "Outra pergunta que cai", 0);
    await page.focus("#assistente-painel ol > li:last-child button");
    await page.keyboard.press("Enter");
    const answered = (await lastItemHas(["Resposta salva no servidor."])) && (await until(page, () => document.activeElement?.tagName === "TEXTAREA", { timeout: 3000 }));
    check("espera: 'Ver se a resposta ficou pronta' traz a resposta e devolve o foco ao campo", answered, await lastItem());
    check("espera: a consulta não recria (nem reanuncia) a pergunta já na tela", await page.evaluate(() => document.querySelector('#assistente-painel ol > li[data-marca="antes"]')?.textContent.includes("Outra pergunta que cai") ?? false));
  }
  check("espera: sem erros de cliente", errors.length === 0, errors.join("; "));
  await ctx.close();
});

await section("espera na página a 320 px", async () => {
  const { ctx, page, errors } = await newSession();
  await stubTurn(page);
  await page.setViewport({ width: 320, height: 640 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await login(page, "professor_sala");
  await page.goto(`${BASE}/assistente`, { waitUntil: "networkidle2" });
  const assistantOff = await page.evaluate(() => document.body.innerText.includes("O assistente ainda não está ativo"));
  const started = await page.evaluate(() => {
    const button = document.querySelector("ul[aria-label='Sugestões'] button");
    button?.click();
    return Boolean(button);
  });
  if (assistantOff) {
    console.log("SKIP  espera com movimento reduzido: assistente desligado nesta instalação");
  } else if (!started) {
    check("espera: página do assistente mostra as sugestões", false);
  } else {
    await appears(page, '[data-testid="espera-jardim"][data-state="pensando"]', 5000);
    check("espera: movimento reduzido sem animação", (await page.$eval('[data-part="planta"]', (el) => getComputedStyle(el).animationName).catch(() => "?")) === "none");
    check("espera: sem botão de pausa no movimento reduzido", (await page.$eval('[data-testid="espera-pausar"]', (el) => getComputedStyle(el).display).catch(() => "?")) === "none");
    const stage = await page.$eval('[data-testid="espera-regar"]', (el) => Math.round(el.getBoundingClientRect().width)).catch(() => 0);
    check("espera: página a 320 px usa o palco compacto", stage === 44, String(stage));
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
    await until(page, () => getComputedStyle(document.querySelector('[data-testid="espera-pausar"]')).display !== "none", { timeout: 2000 });
    const geometry = await page.$eval(GARDEN, (root) => ({
      badge: getComputedStyle(root.querySelector('[data-testid="espera-regar"] > span')).display,
      clip: getComputedStyle(root.querySelector('[data-testid="espera-regar"] svg')).clipPath,
      caption: Math.round(root.querySelector('[data-testid="espera-legenda"]').getBoundingClientRect().width),
      pause: getComputedStyle(root.querySelector('[data-testid="espera-pausar"]')).display,
    }));
    check("espera: faixa estreita sem gota, arte inteira e legenda de 156 px ou mais", geometry.badge === "none" && geometry.clip === "none" && geometry.caption >= 156 && geometry.pause !== "none", JSON.stringify(geometry));
    const sse = (event) => page.evaluate((e) => window.__sse(e), event);
    const status = () => page.$eval('[data-testid="espera-status"]', (el) => el.textContent);
    await sse({ type: "tool_start", step: { id: "a1", name: "gerar_atividades", label: "Criando as 3 sugestões de atividade com os agentes" } });
    check("espera: atividades sem estimativa antes do primeiro evento", await statusIs(page, "Criando 3 sugestões de atividade."), await status());
    await sse({ type: "tool_progress", id: "a1", progress: { agent: "Ilustração", phase: "queued" } });
    await sse({ type: "tool_progress", id: "a1", progress: { agent: "Agente da sala comum", phase: "start" } });
    check("espera: com imagens, a estimativa anunciada é de 1 a 4 minutos", await statusIs(page, "Três agentes escrevem ao mesmo tempo. Costuma levar de 1 a 4 minutos, com as imagens."), await status());
    await page.evaluate(() => window.__sseEnd());
  }
  check("espera (página a 320 px): sem erros de cliente", errors.length === 0, errors.join("; "));
  await ctx.close();
});

if (danteHref) await section("espera inline", async () => {
  const { ctx, page, errors } = await newSession();
  await login(page, "professor_aee");
  await page.goto(`${BASE}${danteHref}/atividades`, { waitUntil: "networkidle2" });
  await page.evaluate(() => { document.documentElement.dataset.esperaEscala = "20"; });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) return;
    request.continue();
  });
  const form = await activitiesForm(page);
  if (form.skip) {
    console.log(`SKIP  espera inline: ${form.skip}`);
  } else if (!form.button) {
    check("espera inline: formulário de atividades presente", false);
  } else if (!form.aiOn) {
    console.log("SKIP  espera inline: IA desligada nesta instalação");
  } else {
    await clickByText(page, "Preparar 3 sugestões");
    const inline = await appears(page, '[data-testid="espera-jardim"][data-variant="inline"]', 5000);
    check("espera inline aparece com a IA ligada", inline);
    if (inline) {
      const pendingStatus = await page.$eval('[data-testid="pending-status"]', (el) => el.textContent);
      check("espera inline: status com o texto da página e uma estimativa só", pendingStatus === "Os agentes da sala comum, do AEE e da família estão preparando as atividades, e o revisor vai conferir. Costuma levar de 1 a 3 minutos.", pendingStatus);
      await page.click('[data-testid="espera-regar"]');
      const ticked = await until(page, (selector) => document.querySelector(selector)?.getAttribute("data-elapsed") !== "0", { timeout: 5000 }, GARDEN);
      check("espera inline: regar e o relógio não reabrem o botão", ticked && (await page.evaluate(() => [...document.querySelectorAll("button[aria-busy]")].some((b) => b.getAttribute("aria-busy") === "true"))));
      const card = '[data-testid="espera-jardim"][data-variant="inline"]';
      const breath = () => page.$eval(card, (el) => getComputedStyle(el.querySelector('[data-part="planta"]')).animationPlayState);
      const canLeave = await page.$eval(card, (el) => document.documentElement.scrollHeight - window.innerHeight > el.getBoundingClientRect().bottom + window.scrollY);
      if (!canLeave) {
        console.log("SKIP  espera inline fora da tela: a página não rola o bastante");
      } else {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const away = await appears(page, `${card}[data-offscreen="true"]`, 3000);
        const pausedAway = away ? await breath() : "sem aviso do observador";
        await page.$eval(card, (el) => el.scrollIntoView({ block: "center" }));
        const back = await appears(page, `${card}[data-offscreen="false"]`, 3000);
        const runningBack = back ? await breath() : "sem aviso do observador";
        check("espera inline: fora da tela a respiração para e volta ao rolar de volta", pausedAway === "paused" && runningBack === "running", `${pausedAway}/${runningBack}`);
      }
    }
  }
  check("espera inline: sem erros de cliente", errors.length === 0, errors.join("; "));
  await ctx.close();
});

if (danteHref && PAID) await section("espera inline (foco)", async () => {
  const { ctx, page, errors } = await newSession();
  await login(page, "professor_aee");
  await page.goto(`${BASE}${danteHref}/atividades`, { waitUntil: "networkidle2" });
  const form = await activitiesForm(page);
  if (form.skip || !form.button || !form.aiOn) {
    console.log(`SKIP  foco depois da espera inline: ${form.skip ?? "formulário com IA indisponível"}`);
  } else {
    const submit = () => page.evaluateHandle(() => [...document.querySelectorAll("button[type=submit]")].find((button) => button.textContent.includes("Preparar 3 sugestões")));
    const finish = async () => {
      await page.waitForSelector('[data-testid="espera-jardim"][data-variant="inline"]', { hidden: true, timeout: 300000 });
      await nextFrames(page);
      return page.evaluate(() => {
        const active = document.activeElement;
        return active instanceof HTMLButtonElement && active.textContent.includes("Preparar 3 sugestões") ? "botão" : active?.tagName ?? "";
      });
    };
    await (await submit()).asElement().click();
    await page.waitForSelector('[data-testid="espera-jardim"][data-variant="inline"]', { timeout: 10000 });
    await page.click('[data-testid="espera-regar"]');
    const afterMouse = await finish();
    check("espera inline: depois de regar com o mouse, o foco não vai para o botão", afterMouse !== "botão", afterMouse);
    await (await submit()).asElement().focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-testid="espera-jardim"][data-variant="inline"]', { timeout: 10000 });
    await page.keyboard.press("Tab");
    const inCard = await page.evaluate(() => document.activeElement?.closest('[data-testid="espera-jardim"]') !== null && document.activeElement?.matches(":focus-visible"));
    const afterKeyboard = await finish();
    check("espera inline: quem estava no cartão pelo teclado volta ao botão", inCard && afterKeyboard === "botão", `${inCard}/${afterKeyboard}`);
  }
  check("espera inline (foco): sem erros de cliente", errors.length === 0, errors.join("; "));
  await ctx.close();
});

const hasButton = (page, text, exact = false) => until(page, (t, e) => [...document.querySelectorAll("button")].some((b) => (e ? b.textContent.trim() === t : b.textContent.includes(t))), { timeout: 10000 }, text, exact);

if (!ONLY_WAIT) {
  await section("DUA", async () => {
    const { ctx, page, errors } = await newSession();
    await login(page, "professor_sala");
    await page.goto(`${BASE}/planejamento`, { waitUntil: "networkidle2" });
    await settle(page);
    const h1 = await page.evaluate(() => [...document.querySelectorAll("h1")].map((title) => title.textContent).join(" | "));
    check("DUA: professor abre o Planejamento com DUA", h1.includes("Planejamento com DUA"), `h1=${h1}`);

    await page.type("#novo-titulo", `Teste E2E DUA ${Date.now()}`);
    await clickByText(page, "Começar o planejamento");
    const editor = await page.waitForSelector("#dua-objetivo", { timeout: 30000 }).catch(() => null);
    check("DUA: cria a atividade e abre a etapa 1", Boolean(editor) && /\/planejamento\/[^/]+/.test(new URL(page.url()).pathname), page.url());

    if (editor) {
      await page.type("#dua-objetivo", "Identificar dois personagens principais e ordenar três acontecimentos da história.");
      await clickByText(page, "Adicionar critério observável");
      const criterion = await page.waitForFunction(() => [...document.querySelectorAll("label")].find((label) => label.textContent.trim() === "Critério 1")?.control ?? null, { timeout: 5000 }).catch(() => null);
      if (criterion) await criterion.asElement().type("Diz ou aponta os dois personagens principais.");
      const saved = await until(page, () => document.body.innerText.includes("Tudo salvo"), { timeout: 20000 });
      check("DUA: objetivo e critério com salvamento automático", Boolean(criterion) && saved, criterion ? "sem “Tudo salvo”" : "campo Critério 1 não apareceu");

      await clickByText(page, "Sugerir pelo objetivo");
      const suggestion = await page.waitForFunction(() => [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Usar esta habilidade")), { timeout: 15000 }).catch(() => null);
      let picked = "";
      if (suggestion) {
        picked = await suggestion.evaluate((button) => button.querySelector(".font-mono")?.textContent ?? "");
        await suggestion.evaluate((button) => button.click());
      }
      const kept = picked ? await until(page, (code) => [...document.querySelectorAll("li .font-mono")].some((item) => item.textContent === code) && document.body.innerText.includes("Tudo salvo"), { timeout: 20000 }, picked) : false;
      check("DUA: habilidade da BNCC sugerida pelo objetivo e guardada", kept, picked ? `código ${picked}` : "sem sugestão");

      await clickByText(page, "Contexto e barreiras");
      const barrierChip = "Exigência de uma única forma de resposta";
      if (await hasButton(page, barrierChip)) await clickByText(page, barrierChip);
      const barrier = await until(page, (t) => [...document.querySelectorAll("textarea")].some((area) => area.value.includes(t)), { timeout: 5000 }, barrierChip);
      check("DUA: etapa 2 registra a barreira da tarefa", barrier);

      await clickByText(page, "Opções e apoios");
      if (await hasButton(page, "Fala", true)) await clickExact(page, "Fala");
      const option = await until(page, () => [...document.querySelectorAll("textarea")].some((area) => area.id.startsWith("opcao-") && area.value === "Fala"), { timeout: 5000 });
      check("DUA: etapa 3 adiciona a opção “Fala”", option);

      await clickByText(page, "Revisão para aplicação");
      if (await hasButton(page, "Validar para aplicação")) {
        await clickByText(page, "Validar para aplicação");
        const validated = await until(page, () => document.body.innerText.includes("validada para aplicação"), { timeout: 20000 });
        check("DUA: versão validada para aplicação", validated, validated ? "" : (await textOf(page)).match(/Para validar, ainda falta:[\s\S]{0,300}|Não foi possível[^\n]*/)?.[0] ?? "");
      } else {
        check("DUA: botão Validar para aplicação na etapa 4", false);
      }
    }

    await page.goto(`${BASE}/estudantes`, { waitUntil: "networkidle2" });
    const others = await page.evaluate((exclude) => [...document.querySelectorAll("article")]
      .map((card) => ({ name: card.querySelector("h2")?.textContent ?? "", href: [...card.querySelectorAll("a")].find((link) => link.textContent.trim() === "Ver acompanhamento")?.getAttribute("href") ?? "" }))
      .filter((item) => !item.name.includes(exclude) && /^\/estudantes\/[^/]+$/.test(item.href)), DANTE_FIRST);
    let gate = null;
    for (const student of others) {
      await page.goto(`${BASE}${student.href}/ppi`, { waitUntil: "networkidle2" });
      const body = await textOf(page);
      if (body.includes("Conclua o estudo de caso")) { gate = { ...student, ok: true }; break; }
      if (body.includes("Comece o plano do estudante") || body.includes("Preencher o plano do zero")) { gate = { ...student, ok: false }; break; }
    }
    if (gate) check("DUA: Plano de ensino pede o estudo de caso concluído", gate.ok, `${gate.name} (${gate.href}/ppi) mostra o formulário do plano`);
    else console.log(`SKIP  Plano de ensino sem estudo de caso: ${others.length ? "os estudantes sem estudo de caso concluído já têm plano ativo" : "nenhum estudante além de Dante na lista"}`);
    check("DUA: sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  });

  await section("DUA (família)", async () => {
    const { ctx, page } = await newSession();
    await login(page, "familia");
    await page.goto(`${BASE}/planejamento`, { waitUntil: "networkidle2" });
    await settle(page);
    check("DUA: família não abre /planejamento", !new URL(page.url()).pathname.startsWith("/planejamento"), `url=${page.url()}`);
    await ctx.close();
  });
  await section("2FA", async () => {
    const role = "coordenacao";
    const secretFile = join(tmpdir(), "incluiedu-e2e-totp.json");
    const nextCode = totpCodes();
    const logoutFrom = async (page) => {
      await clickByText(page, "Sair da plataforma");
      await until(page, () => location.pathname.startsWith("/login"));
    };
    const disableWith = async (page, code) => {
      await page.goto(`${BASE}/conta/seguranca`, { waitUntil: "networkidle2" });
      await page.evaluate(() => document.querySelectorAll("details").forEach((item) => { item.open = true; }));
      await fill(page, "details:last-of-type input[name=code]", code);
      await clickByText(page, "Desligar");
      await until(page, () => document.body.innerText.includes("Ligar a verificação em duas etapas"), { timeout: 20000 });
    };

    const { ctx, page, errors } = await newSession();
    let url = await login(page, role);
    if (url.includes("/login/duas-etapas") && existsSync(secretFile)) {
      const { secret } = JSON.parse(readFileSync(secretFile, "utf8"));
      await fill(page, "input[name=code]", await nextCode(secret));
      await clickByText(page, "Entrar");
      await until(page, () => !location.pathname.startsWith("/login"));
      await disableWith(page, await nextCode(secret));
      await logoutFrom(page);
      url = await login(page, role);
    }
    check("2FA: sem as duas etapas ligadas, a senha basta", !url.includes("/login"), `url=${url}`);

    await page.goto(`${BASE}/conta/seguranca`, { waitUntil: "networkidle2" });
    await clickByText(page, "Ligar a verificação em duas etapas");
    await appears(page, "#totp-secret", 20000);
    const secret = (await page.$eval("#totp-secret", (item) => item.textContent).catch(() => "")).replace(/\s/g, "");
    const qr = await page.$('[role="img"][aria-label^="QR code"] svg');
    check("2FA: tela de ligar mostra o QR code e o código para digitar", Boolean(qr) && /^[A-Z2-7]{32}$/.test(secret), `segredo=${secret.length}`);
    writeFileSync(secretFile, JSON.stringify({ secret }));
    await fill(page, "input[name=code]", await nextCode(secret));
    await clickByText(page, "Confirmar e ligar");
    await appears(page, 'ul[aria-label="Códigos de recuperação"] li', 20000);
    const codes = await page.$$eval('ul[aria-label="Códigos de recuperação"] li', (items) => items.map((item) => item.textContent.trim()));
    check(`2FA: ao ligar, mostra ${RECOVERY_CODE_COUNT} códigos de recuperação`, codes.length === RECOVERY_CODE_COUNT && codes.every((code) => /^[A-Z2-7]{4}-[A-Z2-7]{4}$/.test(code)), JSON.stringify(codes));
    await clickByText(page, "Já guardei os códigos");
    await until(page, () => document.body.innerText.includes("Ligada desde"), { timeout: 20000 });
    check("2FA: a tela mostra a verificação ligada", (await textOf(page)).includes("Ligada desde"));

    await logoutFrom(page);
    url = await login(page, role);
    check("2FA: depois da senha, pede o código", url.includes("/login/duas-etapas"), `url=${url}`);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    check("2FA: sessão sem o código não abre a plataforma", page.url().includes("/login"), `url=${page.url()}`);

    await page.goto(`${BASE}/login/duas-etapas`, { waitUntil: "networkidle2" });
    const wrong = totpAt(secret, Date.now()) === "000000" ? "111111" : "000000";
    await fill(page, "input[name=code]", wrong);
    await clickByText(page, "Entrar");
    await appears(page, '[role="alert"]', 15000);
    check("2FA: código errado é recusado", page.url().includes("/login/duas-etapas") && (await textOf(page)).includes("Código inválido"));
    const code = await nextCode(secret);
    await fill(page, "input[name=code]", code);
    await clickByText(page, "Entrar");
    await until(page, () => !location.pathname.startsWith("/login"));
    check("2FA: código certo entra na plataforma", !page.url().includes("/login"), `url=${page.url()}`);

    await logoutFrom(page);
    await login(page, role);
    await fill(page, "input[name=code]", code);
    await clickByText(page, "Entrar");
    await appears(page, '[role="alert"]', 15000);
    check("2FA: o mesmo código não entra duas vezes", page.url().includes("/login/duas-etapas"), `url=${page.url()}`);

    await page.evaluate(() => document.querySelectorAll("details").forEach((item) => { item.open = true; }));
    await fill(page, "details input[name=code]", codes[0].toLowerCase());
    await clickByText(page, "Entrar com o código de recuperação");
    await until(page, () => location.pathname.startsWith("/conta/seguranca"));
    await settle(page);
    check("2FA: código de recuperação entra e avisa quantos restam", page.url().includes("aviso=recuperacao") && (await textOf(page)).includes(`Restam ${RECOVERY_CODE_COUNT - 1} códigos`), `url=${page.url()}`);

    await disableWith(page, codes[1]);
    check("2FA: desligar com código de recuperação", (await textOf(page)).includes("Ligar a verificação em duas etapas"));
    if (existsSync(secretFile)) unlinkSync(secretFile);
    await logoutFrom(page);
    url = await login(page, role);
    check("2FA: desligada, a entrada volta a pedir só a senha", !url.includes("/login"), `url=${url}`);
    check("2FA: sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  });
  await section("contas", async () => {
    const childNames = [DEMO_STUDENTS.dante.name, DEMO_STUDENTS.ravi.name];
    const email = `familia.e2e.${Date.now()}@teste.edu.br`;
    const fillPasswords = async (page, password, current) => {
      await page.evaluate(() => document.querySelectorAll("details").forEach((item) => { item.open = true; }));
      if (current) await page.type('input[name="current"]', current);
      for (const name of ["password", "confirm"]) {
        await page.$eval(`input[name="${name}"]`, (input) => { input.value = ""; });
        await page.type(`input[name="${name}"]`, password);
      }
    };
    const { ctx, page, errors } = await newSession();
    await login(page, "coordenacao");
    await page.goto(`${BASE}/usuarios`, { waitUntil: "networkidle2" });
    const list = await textOf(page);
    check("contas: a coordenação vê a equipe e as famílias da própria escola, sem a Secretaria", list.includes(emailOf("professor_aee")) && list.includes(emailOf("familia")) && !list.includes(emailOf("secretaria")));

    await page.goto(`${BASE}/usuarios/nova`, { waitUntil: "networkidle2" });
    await page.type('input[name="name"]', "Família Teste E2E");
    await page.type('input[name="email"]', email);
    await choose(page, "Perfil", "familia");
    await appears(page, 'input[name="studentIds"]', 10000);
    await page.evaluate((names) => {
      for (const label of document.querySelectorAll("label")) {
        if (names.some((name) => label.textContent.includes(name))) label.querySelector('input[name="studentIds"]')?.click();
      }
    }, childNames);
    await clickByText(page, "Criar a conta");
    await appears(page, "#senha-temporaria", 20000);
    const temp = (await page.$eval("#senha-temporaria", (item) => item.textContent).catch(() => "")).trim();
    check("contas: cria a família com senha temporária", TEMPORARY_PASSWORD_PATTERN.test(temp), `senha=${temp}`);
    const accountHref = await page.evaluate(() => [...document.querySelectorAll('main a[href^="/usuarios/"]')].map((link) => link.getAttribute("href")).find((href) => /^\/usuarios\/(?!nova$)[^/?#]+$/.test(href)) ?? "");

    const family = await newSession();
    let url = await login(family.page, email, { password: temp });
    check("contas: senha temporária leva a criar a própria senha", url.includes("/login/nova-senha"), `url=${url}`);
    await family.page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    check("contas: antes de criar a senha, a plataforma não abre", family.page.url().includes("/login"), `url=${family.page.url()}`);
    await family.page.goto(`${BASE}/login/nova-senha`, { waitUntil: "networkidle2" });
    await fillPasswords(family.page, "1234567890");
    await clickByText(family.page, "Salvar a senha e continuar");
    await appears(family.page, '[role="alert"]', 15000);
    check("contas: senha fraca é recusada", (await textOf(family.page)).includes("fácil de adivinhar"));
    await fillPasswords(family.page, "girassol no patio azul");
    await clickByText(family.page, "Salvar a senha e continuar");
    await until(family.page, () => !location.pathname.startsWith("/login"), { timeout: 20000 });
    await settle(family.page);
    const children = await family.page.$$eval('main a[href^="/familia/"]', (links) => links.length).catch(() => 0);
    check("contas: a família entra e escolhe entre os dois filhos", new URL(family.page.url()).pathname === "/familia" && children === 2, `url=${family.page.url()} filhos=${children}`);

    await family.page.goto(`${BASE}/conta/seguranca`, { waitUntil: "networkidle2" });
    await fillPasswords(family.page, "outra frase bem comprida", "senha errada aqui");
    await clickByText(family.page, "Trocar a senha");
    await appears(family.page, '[role="alert"]', 15000);
    const wrongCurrent = (await textOf(family.page)).includes("A senha atual não confere");
    await family.page.goto(`${BASE}/conta/seguranca`, { waitUntil: "networkidle2" });
    await fillPasswords(family.page, "outra frase bem comprida", "girassol no patio azul");
    await clickByText(family.page, "Trocar a senha");
    await until(family.page, () => document.body.innerText.includes("Senha trocada"), { timeout: 15000 });
    check("contas: trocar a própria senha confere a atual", wrongCurrent && (await textOf(family.page)).includes("Senha trocada"));

    await page.goto(`${BASE}${accountHref}`, { waitUntil: "networkidle2" });
    await clickByText(page, "Gerar senha temporária");
    await appears(page, "#senha-temporaria", 20000);
    const temp2 = (await page.$eval("#senha-temporaria", (item) => item.textContent).catch(() => "")).trim();
    await family.page.goto(`${BASE}/familia`, { waitUntil: "networkidle2" });
    check("contas: redefinir a senha encerra a sessão da pessoa", family.page.url().includes("/login") && TEMPORARY_PASSWORD_PATTERN.test(temp2), `url=${family.page.url()}`);
    url = await login(family.page, email, { password: temp2 });
    check("contas: com a senha redefinida, cria outra no acesso", url.includes("/login/nova-senha"), `url=${url}`);

    await page.goto(`${BASE}${accountHref}`, { waitUntil: "networkidle2" });
    await page.evaluate(() => document.querySelectorAll("details").forEach((item) => { item.open = true; }));
    await clickByText(page, "Desativar a conta");
    await until(page, () => document.body.innerText.includes("Reativar a conta"), { timeout: 20000 });
    const history = await textOf(page);
    check("contas: histórico com criar, redefinir e desativar", ["criou a conta", "criou a própria senha", "trocou a senha", "redefiniu a senha", "desativou a conta"].every((item) => history.includes(item)));
    const blocked = await newSession();
    await login(blocked.page, email, { password: temp2 });
    check("contas: conta desativada não entra", (await textOf(blocked.page)).includes("Esta conta está desativada"), `url=${blocked.page.url()}`);
    await blocked.ctx.close();
    check("contas: sem erros de cliente", errors.length === 0 && family.errors.length === 0, [...errors, ...family.errors].join("; "));
    await family.ctx.close();
    await ctx.close();

    const teacher = await newSession();
    await login(teacher.page, "professor_sala");
    await teacher.page.goto(`${BASE}/usuarios`, { waitUntil: "networkidle2" });
    check("contas: professor não abre Pessoas e acessos", !new URL(teacher.page.url()).pathname.startsWith("/usuarios"), `url=${teacher.page.url()}`);
    await teacher.ctx.close();
  });
  await section("planilha", async () => {
    const stamp = Date.now().toString(36);
    const names = [`Importado ${stamp} Um`, `Importado ${stamp} Dois`];
    const csvFile = join(tmpdir(), `incluiedu-importacao-${stamp}.csv`);
    writeFileSync(csvFile, "\uFEFF" + [
      "Nome do estudante;Data de nascimento;Ano;Turma;Turno;Responsável;AEE;Frequência AEE",
      `${names[0]};12/05/2017;3º ano;Turma B;Manhã;Responsável Um;sim;2x por semana`,
      `${names[1]};01/08/2013;7º ano;Turma C;tarde;Responsável Dois;não;`,
      `Linha Com Problema ${stamp};31/02/2016;4º ano;Turma B;manhã;Responsável Três;não;`,
    ].join("\r\n"));
    const upload = async (page) => {
      await page.goto(`${BASE}/estudantes/importar`, { waitUntil: "networkidle2" });
      const input = await page.$('input[type="file"]');
      await input.uploadFile(csvFile);
      await clickByText(page, "Conferir a planilha");
      await until(page, () => document.body.innerText.includes("Nada foi gravado ainda") || document.querySelector('[role="alert"]'), { timeout: 20000 });
      return textOf(page);
    };
    const listed = async (page) => {
      await page.goto(`${BASE}/estudantes?q=${encodeURIComponent(`Importado ${stamp}`)}`, { waitUntil: "networkidle2" });
      const text = await textOf(page);
      return names.filter((name) => text.includes(name)).length;
    };
    const { ctx, page, errors } = await newSession();
    await login(page, "coordenacao");
    const template = await page.evaluate(async () => {
      const response = await fetch("/estudantes/importar/modelo");
      return { type: response.headers.get("content-type"), text: await response.text() };
    });
    check("planilha: modelo para baixar em CSV", String(template.type).startsWith("text/csv") && template.text.includes(IMPORT_TEMPLATE.replace("\uFEFF", "").split("\r\n")[0]), JSON.stringify(template.type));

    let text = await upload(page);
    check("planilha: confere sem gravar (2 prontos, 1 com problema)", text.includes("2 pronto(s) para importar") && text.includes("1 com problema") && text.includes("Linha 4"), text.slice(0, 300));
    check("planilha: a linha com problema diz o motivo", text.includes("nascimento inválido"));
    const before = await listed(page);
    check("planilha: nada entra antes de confirmar", before === 0, `encontrados=${before}`);

    await upload(page);
    await clickByText(page, "Importar 2 estudantes");
    await until(page, () => document.body.innerText.includes("estudantes importados"), { timeout: 30000 });
    check("planilha: importa as linhas prontas", (await textOf(page)).includes("2 estudantes importados"));
    check("planilha: os importados aparecem na lista", (await listed(page)) === 2);

    text = await upload(page);
    check("planilha: na segunda vez, aponta os já cadastrados", text.includes("0 pronto(s) para importar") && text.includes("2 já cadastrado(s)"), text.slice(0, 300));
    check("planilha: sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
    unlinkSync(csvFile);

    const teacher = await newSession();
    await login(teacher.page, "professor_sala");
    await teacher.page.goto(`${BASE}/estudantes/importar`, { waitUntil: "networkidle2" });
    check("planilha: professor não importa", !new URL(teacher.page.url()).pathname.startsWith("/estudantes/importar"), `url=${teacher.page.url()}`);
    await teacher.ctx.close();
  });
  await section("acessibilidade", async () => {
    const { ctx, page, errors } = await newSession();
    await login(page, "familia");
    const hasRead = await page.evaluate(() => [...document.querySelectorAll("button")].some((button) => button.textContent.includes("Ouvir esta página")));
    check("acessibilidade: botão Ouvir no portal da família", hasRead);
    // O botão visível (o do menu com o nome fica fechado); repete até a página ficar interativa.
    const pick = (label) => until(page, (name) => {
      [...document.querySelectorAll(`button[aria-label="${name}"]`)].find((button) => button.checkVisibility())?.click();
      return name === "Texto maior" ? document.documentElement.dataset.textScale === "3" : !document.documentElement.dataset.textScale;
    }, { timeout: 15000, polling: 500 }, label);
    await pick("Texto maior");
    const scaled = await page.evaluate(() => document.documentElement.dataset.textScale);
    await page.reload({ waitUntil: "networkidle2" });
    const kept = await page.evaluate(() => ({ scale: document.documentElement.dataset.textScale, pressed: document.querySelector('button[aria-label="Texto maior"]')?.getAttribute("aria-pressed"), size: getComputedStyle(document.documentElement).fontSize }));
    check("acessibilidade: texto maior vale na hora e depois de recarregar", scaled === "3" && kept.scale === "3" && kept.pressed === "true" && kept.size === "20px", JSON.stringify({ scaled, ...kept }));
    await pick("Texto no tamanho padrão");
    check("acessibilidade: volta ao tamanho padrão", await page.evaluate(() => !document.documentElement.dataset.textScale && getComputedStyle(document.documentElement).fontSize === "16px"));
    // Sem voz em português no Chrome de teste, o botão explica em vez de falhar calado.
    await clickByText(page, "Ouvir esta página");
    const reaction = await until(page, () => ["Parar a leitura", "não tem voz em português", "só tem voz pela internet"].some((text) => document.body.innerText.includes(text)), { timeout: 5000 });
    check("acessibilidade: Ouvir lê, pede confirmação ou explica a falta de voz", reaction);
    check("acessibilidade: sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  });
  await section("BNCC", async () => {
    const { ctx, page, errors } = await newSession();
    await login(page, "professor_aee");
    await page.goto(`${BASE}/estudantes`, { waitUntil: "networkidle2" });
    const students = await page.evaluate(() => [...new Set([...document.querySelectorAll("main article a")].map((link) => link.getAttribute("href")?.match(/^\/estudantes\/[^/?#]+/)?.[0]).filter(Boolean))]);
    let form = null;
    for (const student of students) {
      await page.goto(`${BASE}${student}/ppi`, { waitUntil: "networkidle2" });
      form = await page.$("#novo-objetivo");
      if (form) break;
    }
    if (!form) console.log("SKIP  BNCC no objetivo: nenhum estudante com plano aberto para novos objetivos");
    else {
      await page.type('#novo-objetivo input[type="search"]', "EF01LP");
      const result = await page.waitForFunction(() => [...document.querySelectorAll("#novo-objetivo button")].find((button) => button.textContent.includes("Usar esta habilidade")), { timeout: 15000 }).catch(() => null);
      const code = result ? await result.evaluate((button) => button.querySelector(".font-mono")?.textContent ?? "") : "";
      // Clique direto: na janela de teste (800×600) a barra de navegação do celular cobre a lista.
      if (result) await result.evaluate((button) => button.click());
      check("BNCC: busca pelo código e escolhe a habilidade", /^EF01LP\d{2}$/.test(code) && await page.evaluate((c) => [...document.querySelectorAll('#novo-objetivo input[name="bnccCode"]')].some((input) => input.value === c), code), `código=${code}`);
      for (const label of ["O que o estudante vai fazer", "Com qual apoio ou condição", "Como saberemos que conseguiu"]) {
        const value = await page.evaluate((l) => [...[...document.querySelectorAll("label")].find((item) => item.textContent.includes(l))?.control?.options ?? []].find((option) => option.value && !option.value.startsWith("__"))?.value ?? "", label);
        if (value) await choose(page, label, value);
      }
      await clickByText(page, "Salvar objetivo no plano");
      await until(page, (c) => document.body.innerText.includes(`BNCC ${c} ·`), { timeout: 20000 }, code);
      check("BNCC: o plano mostra o código com o texto da habilidade", await page.evaluate((c) => document.body.innerText.includes(`BNCC ${c} ·`), code));
    }
    check("BNCC: sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();

    const coord = await newSession();
    await login(coord.page, "coordenacao");
    await coord.page.goto(`${BASE}/painel`, { waitUntil: "networkidle2" });
    check("BNCC: painel conta objetivos por componente", (await textOf(coord.page)).includes("Objetivos por componente da BNCC"));
    await coord.ctx.close();
  });
  await section("relatório", async () => {
    const { ctx, page, errors } = await newSession();
    await login(page, "professor_aee");
    await page.goto(`${BASE}${danteHref}/relatorios`, { waitUntil: "networkidle2" });
    await clickByText(page, "Montar o relatório do período");
    await until(page, () => /\/relatorios\/[^/]+$/.test(location.pathname), { timeout: 30000 });
    await settle(page);
    const draft = await page.evaluate(() => ({ text: document.body.innerText, opinion: document.querySelector("#relatorio-parecer-texto")?.value ?? "" }));
    check("relatório: monta o rascunho com os registros do período", draft.text.includes("Rascunho: a família ainda não vê") && draft.text.includes("Objetivos do plano de ensino") && draft.opinion.startsWith("Entre "), draft.text.slice(0, 200));
    check("relatório: sem dados clínicos do estudo de caso", !/diagnóstico|Convulsões|Neurologia/i.test(draft.text));
    await clickByText(page, "Validar e publicar para a família");
    await appears(page, '[role="alert"]', 15000);
    check("relatório: não valida com o trecho a completar", (await textOf(page)).includes("Complete o trecho entre colchetes"));
    const finalText = draft.opinion.replace(/\[complete[^\]]*\]/, "manter a prancha de comunicação e ampliar a leitura de palavras do campo de interesse.");
    await page.$eval("#relatorio-parecer-texto", (area, value) => { area.value = value; }, finalText);
    await clickByText(page, "Validar e publicar para a família");
    await until(page, () => document.body.innerText.includes("Validado por"), { timeout: 20000 });
    check("relatório: o AEE valida e publica", (await textOf(page)).includes("Validado por") && (await textOf(page)).includes("ampliar a leitura de palavras"));
    const print = await page.evaluate(() => [...document.querySelectorAll("a")].find((link) => link.textContent.includes("Imprimir ou salvar em PDF"))?.getAttribute("href"));
    await page.goto(`${BASE}${print}`, { waitUntil: "networkidle2" });
    check("relatório: versão para imprimir ou salvar em PDF", await page.evaluate(() => [...document.querySelectorAll("button")].some((button) => button.textContent.includes("Imprimir ou salvar em PDF")) && document.querySelectorAll("h1").length === 1));
    check("relatório: sem erros de cliente (equipe)", errors.length === 0, errors.join("; "));
    await ctx.close();

    const family = await newSession();
    await login(family.page, "familia");
    const link = await family.page.evaluate(() => [...document.querySelectorAll('#relatorios a')].at(0)?.getAttribute("href"));
    check("relatório: aparece no portal da família", Boolean(link));
    const history = await contentText(family.page);
    check("relatório: a família vê a validação no histórico de acessos", history.includes("validou") && history.includes("Relatório do período"));
    if (link) {
      await family.page.goto(`${BASE}${link}`, { waitUntil: "networkidle2" });
      const body = await textOf(family.page);
      check("relatório: a família lê o relatório e o parecer", body.includes("Relatório da escola") && body.includes("Parecer da equipe") && body.includes("ampliar a leitura de palavras"));
    }
    check("relatório: sem erros de cliente (família)", family.errors.length === 0, family.errors.join("; "));
    await family.ctx.close();
  });
  await section("adaptar", async () => {
    const PROVA = ["1) Leia o texto. Depois, circule os animais que vivem na água.", "2) Ligue cada animal ao lugar onde ele vive.", "3) Qual é o alimento da vaca?", "a) capim", "b) carne", "c) peixe", "4) Desenhe um animal que você conhece."].join("\n");
    const { ctx, page, errors } = await newSession();
    await login(page, "professor_aee");
    await page.goto(`${BASE}${danteHref}/atividades`, { waitUntil: "networkidle2" });
    const entry = await page.evaluate(() => [...document.querySelectorAll("a")].find((link) => link.textContent.includes("Adaptar a atividade da turma"))?.getAttribute("href"));
    check("adaptar: atalho na aba Atividades", Boolean(entry));
    await page.goto(`${BASE}${entry}`, { waitUntil: "networkidle2" });
    await page.click('input[name="kind"][value="prova"]');
    await page.type('input[name="title"]', "Prova de Ciências E2E");
    await page.type('textarea[name="text"]', PROVA);
    await clickByText(page, "Adaptar para o estudante");
    await until(page, () => /\/atividades\/adaptadas\/[^/]+$/.test(location.pathname), { timeout: 30000 });
    await settle(page);
    let body = await textOf(page);
    check("adaptar: prova adaptada em rascunho, com original e versão adaptada", body.includes("Prova adaptada") && body.includes("Rascunho") && body.includes("Original da turma") && body.includes("Versão adaptada"), page.url());
    check("adaptar: mantém as questões e mostra o apoio do professor", body.includes("Qual é o alimento da vaca?") && body.includes("capim") && body.includes("Para o professor:"));
    check("adaptar: a prova continua avaliando o mesmo", body.includes("mesmos da prova da turma"));
    const word = await page.evaluate(async () => {
      const href = [...document.querySelectorAll("a")].find((link) => link.textContent.includes("Baixar em Word"))?.getAttribute("href");
      const response = await fetch(href);
      return { type: response.headers.get("content-type"), size: (await response.arrayBuffer()).byteLength };
    });
    check("adaptar: baixa em Word (.docx)", String(word.type).includes("wordprocessingml") && word.size > 2000, JSON.stringify(word));
    await clickByText(page, "Aprovar para usar");
    await until(page, () => document.body.innerText.includes("Aprovada por"), { timeout: 20000 });
    check("adaptar: o professor aprova", (await textOf(page)).includes("Aprovada por"));
    const print = await page.evaluate(() => [...document.querySelectorAll("a")].find((link) => link.textContent.includes("Imprimir ou salvar em PDF"))?.getAttribute("href"));
    await page.goto(`${BASE}${print}`, { waitUntil: "networkidle2" });
    body = await textOf(page);
    check("adaptar: folha para imprimir sem o apoio do professor", body.includes("Qual é o alimento da vaca?") && !body.includes("Para o professor:"));
    check("adaptar: sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();

    const teacher = await newSession();
    await login(teacher.page, "professor_sala");
    await teacher.page.goto(`${BASE}/planejamento`, { waitUntil: "networkidle2" });
    const planning = await teacher.page.evaluate(() => [...document.querySelectorAll('a[href^="/planejamento/"]')].map((link) => link.getAttribute("href").match(/^\/planejamento\/[^/?#]+/)?.[0]).find(Boolean));
    await teacher.page.goto(`${BASE}${planning}/niveis`, { waitUntil: "networkidle2" });
    await teacher.page.type('input[name="title"]', "Animais e onde vivem");
    await teacher.page.type('textarea[name="text"]', PROVA);
    await clickByText(teacher.page, "Gerar os três níveis");
    await until(teacher.page, () => location.search.includes("lote="), { timeout: 30000 });
    await settle(teacher.page);
    body = await textOf(teacher.page);
    check("níveis: gera com mais apoio, padrão e com desafio", ["Com mais apoio", "Padrão", "Com desafio"].every((label) => body.includes(label)) && body.includes("explique como chegou à resposta"));
    const levelPrint = await teacher.page.evaluate(() => [...document.querySelectorAll("a")].find((link) => link.textContent.includes("Imprimir"))?.getAttribute("href"));
    await teacher.page.goto(`${BASE}${levelPrint}`, { waitUntil: "networkidle2" });
    body = await textOf(teacher.page);
    check("níveis: a folha impressa não diz o nível", !/Com mais apoio|Com desafio/.test(body) && body.includes("Ligue cada animal"));
    check("níveis: sem erros de cliente", teacher.errors.length === 0, teacher.errors.join("; "));
    await teacher.ctx.close();
  });
  await section("sondagem", async () => {
    const { ctx, page, errors } = await newSession();
    await login(page, "professor_aee");
    await page.goto(`${BASE}${danteHref}/sondagem/aplicar`, { waitUntil: "networkidle2" });
    await page.evaluate(() => document.querySelectorAll('select[name^="item-"]').forEach((select) => { select.value = ""; }));
    await clickByText(page, "Salvar a sondagem");
    await appears(page, '[role="alert"]', 15000);
    check("sondagem: pede pelo menos 5 itens observados", (await textOf(page)).includes("Observe pelo menos 5 itens"));
    const levels = { "com-01": "1", "com-02": "3", "com-04": "2", "le-01": "0", "le-02": "1", "le-03": "2", "le-08": "4", "ma-01": "4", "int-03": "5" };
    await page.evaluate((values) => {
      document.querySelectorAll('select[name^="item-"]').forEach((select) => { select.value = ""; });
      for (const [id, value] of Object.entries(values)) document.querySelector(`select[name="item-${id}"]`).value = value;
    }, levels);
    await clickByText(page, "Salvar a sondagem");
    await until(page, () => location.pathname.endsWith("/sondagem"), { timeout: 20000 });
    await settle(page);
    const body = await textOf(page);
    check("sondagem: salva e mostra o apoio por área", body.includes("Apoio por área") && body.includes("Comunicação e linguagem") && /Linha de base em/.test(body));
    check("sondagem: referência na BNCC para planejar", body.includes("Leitura e escrita: habilidades do 1º ano") && body.includes("Matemática: ainda antes das habilidades do 1º ano"));
    check("sondagem: sugestões de objetivo com a habilidade da BNCC", body.includes("Sugestões de objetivo") && body.includes("Espera a sua vez.") && body.includes("BNCC EF01MA02"));
    check("sondagem: sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  });
  await section("avisos", async () => {
    const NOTE = `Foi ao parque com o avô (${Date.now()}).`;
    const family = await newSession();
    await login(family.page, "familia");
    const portal = new URL(family.page.url()).pathname;
    const bell = () => family.page.evaluate(() => document.querySelector('header a[href="/avisos"]')?.getAttribute("aria-label") ?? "");
    const before = await bell();
    check("avisos: o sino mostra os avisos novos da família", /^Avisos: \d+ novos?$/.test(before), before);
    await family.page.click('header a[href="/avisos"]');
    await until(family.page, () => location.pathname === "/avisos", { timeout: 15000 });
    await settle(family.page);
    let body = await textOf(family.page);
    check("avisos: a família vê o relatório validado", body.includes(`O relatório do período de ${DANTE_FIRST} está disponível`));
    check("avisos: abrir a página zera o sino", (await bell()) === "Avisos", await bell());
    const emailOn = await family.page.$eval('input[name="notifyByEmail"]', (box) => !box.disabled).catch(() => false);
    if (emailOn) warn("avisos: sem e-mail configurado, a preferência explica", false, "este servidor tem e-mail (SMTP_URL e EMAIL_FROM); a explicação não se aplica");
    else check("avisos: sem e-mail configurado, a preferência explica", body.includes("o e-mail não está configurado nesta instalação"));

    await family.page.$eval('input[name="weeklyCheckIn"]', (box) => { box.checked = false; });
    await clickByText(family.page, "Salvar as preferências");
    await until(family.page, () => document.body.innerText.includes("Preferências salvas"), { timeout: 15000 });
    await family.page.goto(`${BASE}${portal}`, { waitUntil: "networkidle2" });
    check("pergunta da semana: some quando a família desliga", !(await family.page.$("#pergunta-da-semana")));
    await family.page.goto(`${BASE}/avisos`, { waitUntil: "networkidle2" });
    await family.page.$eval('input[name="weeklyCheckIn"]', (box) => { box.checked = true; });
    await clickByText(family.page, "Salvar as preferências");
    await until(family.page, () => document.body.innerText.includes("Preferências salvas"), { timeout: 15000 });

    await family.page.goto(`${BASE}${portal}`, { waitUntil: "networkidle2" });
    const answered = (await textOf(family.page)).includes("Você já contou como foi esta semana");
    if (answered) await family.page.$eval("#pergunta-da-semana summary", (summary) => summary.click());
    await family.page.evaluate(() => document.querySelectorAll('#pergunta-da-semana input[name="answers"]').forEach((box) => { box.checked = ["Dormiu bem", "Teve uma conquista"].includes(box.value); }));
    await family.page.$eval("#checkin-nota", (area, value) => { area.value = value; }, NOTE);
    await clickByText(family.page, answered ? "Atualizar a resposta" : "Enviar para a escola");
    await until(family.page, () => document.body.innerText.includes("Obrigado! A escola vai ver"), { timeout: 15000 });
    check(`pergunta da semana: a família ${answered ? "muda a resposta" : "responde"}`, (await textOf(family.page)).includes("Obrigado! A escola vai ver"));
    await family.page.goto(`${BASE}${portal}`, { waitUntil: "networkidle2" });
    body = await textOf(family.page);
    check("pergunta da semana: o portal resume a resposta e deixa mudar", body.includes("Você já contou como foi esta semana") && body.includes(NOTE) && body.includes("Mudar a resposta"));
    check("avisos: sem erros de cliente (família)", family.errors.length === 0, family.errors.join("; "));
    await family.ctx.close();

    const { ctx, page, errors } = await newSession();
    await login(page, "professor_aee");
    await page.goto(`${BASE}${danteHref}/diario`, { waitUntil: "networkidle2" });
    body = await textOf(page);
    check("pergunta da semana: o AEE vê a resposta no diário", body.includes("Da família, nesta semana") && body.includes("Dormiu bem, Teve uma conquista") && body.includes(NOTE));
    await page.goto(`${BASE}/avisos`, { waitUntil: "networkidle2" });
    check("avisos: a equipe é avisada da resposta da família", (await textOf(page)).includes(`A família de ${DANTE_FIRST} respondeu a pergunta da semana`));
    check("avisos: sem erros de cliente (equipe)", errors.length === 0, errors.join("; "));
    await ctx.close();
  });
  await section("dossiê", async () => {
    const { ctx, page, errors } = await newSession();
    await login(page, "professor_aee");
    await page.goto(`${BASE}${danteHref}/dossie`, { waitUntil: "networkidle2" });
    let body = await textOf(page);
    check("dossiê: aba com o checklist das normas", body.includes("Dossiê de evidências") && body.includes("Estudo de caso concluído") && body.includes("Decreto, art. 11, § 3º") && body.includes("PEI: devolutivas à família"));
    check("dossiê: a devolutiva validada conta como evidência", /Último relatório do período validado em \d{2}\/\d{2}\/\d{4}/.test(body));
    check("dossiê: sem exigência de laudo", body.includes("Sem exigência de laudo"));
    check("dossiê: registro de referência do Censo, pela orientação do INEP", body.includes("Orientação do Governo Federal") && body.includes("Registro de referência para declarar no Censo Escolar") && body.includes("Respaldo da declaração"));
    check("dossiê: cada item leva ao registro", await page.evaluate(() => [...document.querySelectorAll("a")].some((link) => link.textContent.includes("Ver o registro") && link.getAttribute("href").endsWith("/estudo-de-caso"))));
    await page.goto(`${BASE}${danteHref}/dossie/imprimir`, { waitUntil: "networkidle2" });
    body = await textOf(page);
    check("dossiê: versão para imprimir, sem links", body.includes(`Dossiê de evidências: ${DANTE_FIRST}`) && body.includes("Gerado em") && !body.includes("Ver o registro"));
    check("dossiê: sem erros de cliente (AEE)", errors.length === 0, errors.join("; "));
    await ctx.close();

    const family = await newSession();
    await login(family.page, "familia");
    check("dossiê: a impressão fica no histórico que a família vê", (await contentText(family.page)).includes("Impressão do dossiê de evidências"));
    await family.ctx.close();

    const coord = await newSession();
    await login(coord.page, "coordenacao");
    await coord.page.goto(`${BASE}/dossie?filtro=pendentes`, { waitUntil: "networkidle2" });
    body = await textOf(coord.page);
    check("dossiê da escola: a coordenação vê os estudantes e o que falta", body.includes("O que mais falta") && body.includes("Só com pendências") && await coord.page.evaluate(() => document.querySelectorAll('main a[href$="/dossie"]').length > 0));
    check("dossiê da escola: sem erros de cliente", coord.errors.length === 0, coord.errors.join("; "));
    await coord.ctx.close();

    const network = await newSession();
    await login(network.page, "secretaria");
    await network.page.goto(`${BASE}/dossie`, { waitUntil: "networkidle2" });
    body = await textOf(network.page);
    check("dossiê da rede: a Secretaria vê números por escola, sem nomes", body.includes("Por escola") && !body.includes(DANTE_FIRST) && await network.page.evaluate(() => !document.querySelector('main a[href^="/estudantes/"]')));
    await network.ctx.close();

    const teacher = await newSession();
    await login(teacher.page, "professor_sala");
    await teacher.page.goto(`${BASE}/dossie`, { waitUntil: "networkidle2" });
    check("dossiê da escola: o professor da sala comum não abre", new URL(teacher.page.url()).pathname === "/");
    await teacher.ctx.close();
  });
  await section("pílulas", async () => {
    const { ctx, page, errors } = await newSession();
    await login(page, "professor_aee");
    await page.goto(`${BASE}/ajuda`, { waitUntil: "networkidle2" });
    check("pílulas: seis na Ajuda", (await textOf(page)).includes("Formação em pílulas") && await page.evaluate(() => document.querySelectorAll('#pilulas a[href^="/ajuda/pilulas/"]').length === 6));
    await page.goto(`${BASE}${danteHref}/sondagem`, { waitUntil: "networkidle2" });
    const more = await page.evaluate(() => [...document.querySelectorAll("main a")].find((link) => link.textContent.trim().startsWith("Saiba mais"))?.getAttribute("href"));
    check("pílulas: Saiba mais ao lado da sondagem", more === "/ajuda/pilulas/sondagem", String(more));
    await page.goto(`${BASE}/ajuda/pilulas/sondagem`, { waitUntil: "networkidle2" });
    const body = await textOf(page);
    check("pílulas: por que, como fazer, exemplo e onde fazer", ["Sondagem: linha de base e reavaliação", "Por que importa", "Como fazer", "Um exemplo", "Cuidado com", "Na plataforma"].every((part) => body.includes(part)) && /Leitura de \d min/.test(body));
    check("pílulas: dá para ouvir a pílula", await page.evaluate(() => [...document.querySelectorAll("button")].some((button) => button.textContent.includes("Ouvir esta pílula"))));
    check("pílulas: sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();

    const family = await newSession();
    await login(family.page, "familia");
    await family.page.goto(`${BASE}/ajuda`, { waitUntil: "networkidle2" });
    const familyHelp = await textOf(family.page);
    await family.page.goto(`${BASE}/ajuda/pilulas/dua`, { waitUntil: "networkidle2" });
    check("pílulas: são da equipe (a família não vê)", !familyHelp.includes("Formação em pílulas") && new URL(family.page.url()).pathname === "/ajuda");
    await family.ctx.close();
  });
  await section("censo", async () => {
    const SCHOOL_IN_FILE = normalizeName(DEMO_SCHOOL);
    const inFile = (student) => ({ name: normalizeName(student.name), birth: isoToBr(student.birthDate) });
    const CAA = 9;
    const file = censusFile({
      school: { code: "21000001", name: SCHOOL_IN_FILE },
      classes: [
        { code: "T2B", name: "2 ANO B", kind: "curricular", stage: "302", days: Object.fromEntries([1, 2, 3, 4, 5].map((day) => [day, "07:00-11:00"])) },
        { code: "SRM", name: "SALA DE RECURSOS MULTIFUNCIONAIS", kind: "aee", days: { 1: "13:00-15:00" } },
        { code: "SRM2", name: "AEE MANHA", kind: "aee", days: { 2: "08:00-09:00" } },
      ],
      people: [
        { code: "P1", inepId: "210000000001", ...inFile(DEMO_STUDENTS.dante), types: [9] },
        { code: "P2", inepId: "210000000002", ...inFile(DEMO_STUDENTS.ravi), types: [9] },
        { code: "P3", inepId: "210000000003", name: "ALUNA NOVA DO CENSO", birth: "15/08/2018", types: [9] },
        { code: "P4", ...inFile(DEMO_STUDENTS.livia), types: [9] },
      ],
      enrollments: [
        { person: "P1", klass: "T2B" }, { person: "P1", klass: "SRM", services: [CAA, 1] }, { person: "P2", klass: "SRM" },
        { person: "P3", klass: "T2B" }, { person: "P3", klass: "SRM2", services: [CAA] }, { person: "P4", klass: "T2B" },
      ],
    }).join("\r\n");
    const filePath = join(mkdtempSync(join(tmpdir(), "censo-")), "migracao.txt");
    writeFileSync(filePath, file, "latin1");

    const { ctx, page, errors } = await newSession();
    await login(page, "coordenacao");
    await page.goto(`${BASE}/censo`, { waitUntil: "networkidle2" });
    const schoolHref = await page.evaluate(() => document.querySelector('main a[href^="/censo/escolas/"]')?.getAttribute("href"));
    check("censo: a coordenação abre a própria escola", Boolean(schoolHref));
    await page.goto(`${BASE}${schoolHref}`, { waitUntil: "networkidle2" });
    const upload = await page.$('input[type="file"][name="file"]');
    await upload.uploadFile(filePath);
    await clickByText(page, "Ler o arquivo e ver a prévia");
    await until(page, () => location.pathname.startsWith("/censo/importacoes/"), { timeout: 30000 });
    await settle(page);
    let body = await textOf(page);
    check("censo: prévia do arquivo com a edição do leiaute", body.includes(`Prévia do Censo: ${SCHOOL_IN_FILE}`) && body.includes("leiaute 2025"), body.slice(0, 200));
    check("censo: a prévia diz o que a dependência da escola muda no Fundeb", body.includes("Escola municipal: o AEE oferecido aqui conta para a rede municipal"));
    const preview = await page.evaluate(() => document.body.textContent);
    check("censo: a prévia aponta AEE sem tipo de atendimento e horário coincidente", preview.includes("Vínculo no AEE sem tipo de atendimento") && preview.includes("Horário do AEE coincide com o da classe comum"));
    check("censo: Dante conciliado pelo nome e nascimento (ou pelo ID INEP já gravado)", new RegExp(`${DANTE}[\\s\\S]*(ID INEP: de vazio para 210000000001|Sem mudança)`).test(body) || body.includes("Sem mudança no cadastro"));
    check("censo: a aluna de outra escola da rede pede revisão", body.includes(inFile(DEMO_STUDENTS.livia).name) && body.includes("outra escola da rede"));
    check("censo: aplicar fica bloqueado com revisão pendente", await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Aplicar e guardar"))?.disabled === true));
    await page.evaluate(() => { document.querySelector('input[name="decision"][value="ignore"]').checked = true; });
    await page.$eval('textarea[name="reason"]', (area) => { area.value = "Estuda em outra escola da rede."; });
    await clickByText(page, "Salvar a decisão");
    await until(page, () => document.body.innerText.includes("Ignorados (1)"), { timeout: 20000 });
    check("censo: a revisão registra o motivo", (await textOf(page)).includes("Estuda em outra escola da rede."));
    await until(page, () => [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Aplicar e guardar"))?.disabled === false, { timeout: 10000 });
    await clickByText(page, "Aplicar e guardar como referência");
    await until(page, () => location.pathname.startsWith("/censo/escolas/"), { timeout: 30000 });
    await settle(page);
    body = await textOf(page);
    check("censo: aplicado, com a referência da escola", body.includes("Arquivo aplicado") && body.includes("Conferido com o arquivo aplicado"));
    check("censo: dupla matrícula não confirmada para quem está só no AEE", new RegExp(`Matrícula no AEE sem classe comum[\\s\\S]*${RAVI}[\\s\\S]*sem tipo de atendimento`).test(body));
    check("censo: dupla matrícula com alerta de horário coincidente", /Com dupla matrícula, mas com alerta no vínculo[\s\S]*Aluna Nova do Censo[\s\S]*Horário do AEE coincide/.test(body));
    check("censo: Dante confirmado com classe comum e AEE", await page.evaluate((name) => [...document.querySelectorAll("details")].some((item) => item.textContent.includes("Confirmados") && item.textContent.includes(name)), DANTE));
    check("censo: registro de referência na escola, com o selo federal", body.includes("Registro de referência para declarar no Censo") && body.includes("Orientação do Governo Federal") && await page.evaluate((name) => [...document.querySelectorAll("details")].some((item) => item.textContent.includes("Com registro de referência") && item.textContent.includes(name)), DANTE));
    await page.goto(`${BASE}${danteHref}/ppi`, { waitUntil: "networkidle2" });
    const pei = await page.evaluate(() => document.querySelector("#pei")?.textContent ?? "");
    check("censo: o PEI aponta o tipo de AEE diferente do arquivo", pei.includes("Diferente do último arquivo do Censo") && pei.includes("Desenvolvimento de vida autônoma"), pei.slice(-300));
    await page.goto(`${BASE}/censo`, { waitUntil: "networkidle2" });
    await clickByText(page, "Verificar agora");
    await until(page, () => document.body.innerText.includes("Verificação registrada"), { timeout: 20000 });
    await page.goto(`${BASE}/censo`, { waitUntil: "networkidle2" });
    body = await textOf(page);
    check("censo: verificação manual no histórico", body.includes(`manual, por ${DEMO_ACCOUNTS.coordenacao.name}`));
    check("censo: contagens da escola (educação especial, AEE e dupla matrícula)", body.includes("Educação especial no Censo") && body.includes("Dupla matrícula no arquivo"));
    check("censo: estimativa do AEE considerado, com o que fica de fora", /AEE que o FNDE deve considerar \(estimativa\)\s*2\s*Por etapa: Ensino fundamental 2/.test(body) && body.includes("com vínculo que o Educacenso recusa ou não importa"), body.slice(body.indexOf("AEE que o FNDE"), body.indexOf("AEE que o FNDE") + 300));
    await page.goto(`${BASE}/avisos`, { waitUntil: "networkidle2" });
    check("censo: a coordenação recebe o aviso da pendência", (await textOf(page)).includes("Censo:"));
    check("censo: sem erros de cliente (coordenação)", errors.length === 0, errors.join("; "));
    await ctx.close();

    const network = await newSession();
    await login(network.page, "secretaria");
    await network.page.goto(`${BASE}/censo`, { waitUntil: "networkidle2" });
    body = await textOf(network.page);
    check("censo: a Secretaria vê números, sem nomes", body.includes("Contagens da rede") && ![DANTE_FIRST, RAVI_FIRST, "Aluna Nova"].some((name) => body.includes(name)) && !(await network.page.$('main a[href^="/censo/escolas/"]')));
    await network.page.$eval("#fnde-aee", (input) => { input.value = "136"; });
    await network.page.$eval("#fnde-ano", (input) => { input.value = "2026"; });
    await clickExact(network.page, "Salvar");
    await until(network.page, () => document.body.innerText.includes("Número do FNDE salvo"), { timeout: 20000 });
    await network.page.goto(`${BASE}/censo`, { waitUntil: "networkidle2" });
    check("censo: comparação com o FNDE, sem afirmar perda", /O FNDE considerou \d+ matrículas de AEE a mais/.test(await textOf(network.page)));
    const brasilia = (minutes) => {
      const date = new Date(Date.now() + minutes * 60_000);
      return { day: date.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }), time: date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) };
    };
    const soon = brasilia(2);
    const setWindow = (start, end, times) => network.page.evaluate((values) => {
      document.querySelector("details summary")?.click();
      document.querySelector("#censo-inicio").value = values.start;
      document.querySelector("#censo-fim").value = values.end;
      document.querySelectorAll('input[name="times"]').forEach((input, index) => { input.value = values.times[index] ?? ""; });
      document.querySelector('input[name="enabled"]').checked = true;
    }, { start, end, times });
    await setWindow(soon.day, soon.day, [soon.time]);
    await clickByText(network.page, "Salvar a janela");
    await until(network.page, () => document.body.innerText.includes("Janela salva"), { timeout: 20000 });
    await network.page.goto(`${BASE}/censo`, { waitUntil: "networkidle2" });
    check("censo: monitor ativo com a próxima verificação", (await textOf(network.page)).includes(`Próxima verificação: ${soon.day.split("-").reverse().join("/")} às ${soon.time}`));
    const latestCheck = () => network.page.evaluate(() => document.querySelector('section[aria-labelledby="censo-historico"] li')?.textContent ?? "");
    let scheduled = false;
    for (let attempt = 0; attempt < 24 && !scheduled; attempt += 1) {
      await sleep(10000);
      await network.page.goto(`${BASE}/censo`, { waitUntil: "networkidle2" });
      scheduled = (await latestCheck()).includes("· agendada ·");
    }
    warn("censo: a verificação agendada roda sozinha no horário", scheduled, "nenhuma verificação agendada em 4 minutos (CENSUS_MONITOR=0 ou relógio do servidor)");
    await setWindow(DEFAULT_MONITOR.periodStart, DEFAULT_MONITOR.periodEnd, DEFAULT_MONITOR.times);
    await clickByText(network.page, "Salvar a janela");
    await until(network.page, () => document.body.innerText.includes("Janela salva"), { timeout: 20000 });
    check("censo: sem erros de cliente (Secretaria)", network.errors.length === 0, network.errors.join("; "));
    await network.ctx.close();

    const teacher = await newSession();
    await login(teacher.page, "professor_sala");
    await teacher.page.goto(`${BASE}/censo`, { waitUntil: "networkidle2" });
    check("censo: o professor não abre", new URL(teacher.page.url()).pathname === "/");
    await teacher.ctx.close();
    unlinkSync(filePath);
  });
  // O widget vem do jsDelivr.
  await section("vlibras", async () => {
    const { ctx, page, errors } = await newSession();
    const sent = [];
    const analytics = [];
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST" };
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("traducao2.vlibras.gov.br")) {
        if (request.method() === "POST") sent.push(request.postData() ?? "");
        return request.respond({ status: 200, contentType: "text/plain", headers: cors, body: "ESTUDANTE" });
      }
      if (url.includes("posthog.com")) { analytics.push(url); return request.abort(); }
      return request.continue();
    });
    await login(page, "professor_aee");
    await page.goto(`${BASE}${danteHref}`, { waitUntil: "networkidle2" });
    warn("vlibras: botão de Libras na tela", await appears(page, "#vlibras-access-wrapper", 30000), "o widget vem do servidor do governo (rede, NEXT_PUBLIC_VLIBRAS)");
    const birth = isoToBr(DEMO_STUDENTS.dante.birthDate);
    const reply = await page.evaluate(async (text) => {
      const response = await fetch("https://traducao2.vlibras.gov.br/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      return { status: response.status, text: await response.text() };
    }, `${DANTE} e a mãe, Carla, na ${DEMO_SCHOOL}. CPF 111.222.333-44, nascido em ${birth}.`);
    const body = sent.at(-1) ?? "";
    check("vlibras: o texto chega ao tradutor sem nome, CPF, data e escola", reply.status === 200 && reply.text === "ESTUDANTE" && body.includes("o estudante") && ![...DANTE.split(" "), "Carla", "Maria Firmina", "111.222", birth].some((part) => body.includes(part)), body);
    const statistics = await page.evaluate(async () => (await fetch("https://us.i.posthog.com/e/", { method: "POST", body: "{}" })).status);
    check("vlibras: a estatística de uso (PostHog) não sai", statistics === 204 && analytics.length === 0, `${statistics} ${analytics.length}`);
    const review = await page.evaluate(async () => (await fetch("https://traducao2.vlibras.gov.br/review", { method: "POST", body: "{}" })).status);
    check("vlibras: outros pedidos ao tradutor são bloqueados", review === 403 && sent.length === 1, `${review} ${sent.length}`);
    const elsewhere = await page.evaluate(async () => (await fetch("https://exemplo.com/coleta", { method: "POST", body: "texto" })).status);
    check("vlibras: envio de dados a outro site é bloqueado (fechado por padrão)", elsewhere === 403, String(elsewhere));
    const served = await fetch(`${VLIBRAS_ROOT}/vlibras-plugin.js`, { method: "HEAD", redirect: "manual" }).then((response) => response.headers.get("location") ?? "", () => "sem rede");
    warn(`vlibras: o governo trocou a versão do widget (conferida: ${VLIBRAS_CHECKED_VERSION}); confira de novo src/lib/vlibras-core.ts`, served.includes(`@v${VLIBRAS_CHECKED_VERSION}/`), served);
    check("vlibras: sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();

    const family = await newSession();
    await login(family.page, "familia");
    const familyText = await family.page.evaluate(async (text) => (await (await fetch("/api/libras/anonimizar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })).json()).text, `${DANTE_FIRST} e ${RAVI}`);
    check("vlibras: a família só tem trocados os nomes que já vê", familyText === `o estudante e ${RAVI}`, familyText);
    await family.ctx.close();
    const visitor = await newSession();
    await visitor.page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
    const visitorText = await visitor.page.evaluate(async (text) => (await (await fetch("/api/libras/anonimizar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })).json()).text, `${DANTE}, ${isoToBr(DEMO_STUDENTS.dante.birthDate)}`);
    check("vlibras: sem sessão, troca só documentos, datas e contatos", visitorText === `${DANTE}, (informação omitida)`, visitorText);
    await visitor.ctx.close();
  });

  await section("carteirinha", async () => {
    const family = await newSession();
    const childId = new URL(await login(family.page, "familia")).pathname.split("/").pop();
    const aee = await newSession();
    await login(aee.page, "professor_aee");
    const cardPage = `${BASE}/estudantes/${childId}/carteirinha`;
    await aee.page.goto(cardPage, { waitUntil: "networkidle2" });
    check("carteirinha: sem autorização da família, a equipe não faz", (await textOf(aee.page)).includes("ainda não autorizou a carteirinha"));

    await family.page.goto(`${BASE}/familia/${childId}`, { waitUntil: "networkidle2" });
    await clickByText(family.page, "Autorizar: Carteirinha digital");
    check("carteirinha: autorizar cria a carteirinha no portal", await appears(family.page, "#carteirinha", 15000));
    await family.page.click('input[name="mostrarComoAjudar"]');
    await family.page.click('input[name="mostrarContato"]');
    await family.page.$eval("#contato-telefone", (input) => { input.value = ""; });
    await family.page.type("#contato-telefone", "11987654321");
    await family.page.select("#contato-parentesco", "Mãe");
    await clickByText(family.page, "Salvar a carteirinha");
    await until(family.page, () => document.body.innerText.includes("Carteirinha atualizada"), { timeout: 15000 });
    const familyCard = await family.page.$eval("#carteirinha", (card) => card.innerText);
    check("carteirinha: a família vê o verso e o contato que escolheu", familyCard.includes("Como me ajudar") && familyCard.includes("Em emergência") && familyCard.includes("(11) 98765-4321"), familyCard.slice(0, 300));
    check("carteirinha: sem diagnóstico no cartão", !/autis|TEA|CID|laudo|diagn/i.test(familyCard));
    check("carteirinha: o parentesco salvo continua no formulário", (await family.page.$eval("#contato-parentesco", (select) => select.value)) === "Mãe");

    const photoFile = join(tmpdir(), `carteirinha-${Date.now()}.png`);
    writeFileSync(photoFile, await aee.page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 160, height: 200 } }));
    await aee.page.goto(cardPage, { waitUntil: "networkidle2" });
    await (await aee.page.$("#carteirinha-foto")).uploadFile(photoFile);
    await until(aee.page, () => !document.body.innerText.includes("Preparando a foto"), { timeout: 15000 });
    await clickByText(aee.page, "Enviar a foto");
    await until(aee.page, () => document.body.innerText.includes("Foto salva"), { timeout: 15000 });
    unlinkSync(photoFile);
    await aee.page.goto(cardPage, { waitUntil: "networkidle2" });
    const photo = await aee.page.evaluate(async () => {
      const img = document.querySelector('.id-card img[alt^="Foto de"]');
      if (!img) return null;
      const response = await fetch(img.getAttribute("src"));
      return { status: response.status, type: response.headers.get("content-type"), cache: response.headers.get("cache-control"), loaded: img.naturalWidth > 0 };
    });
    check("carteirinha: a foto aparece, sem cache público", photo?.loaded && photo.status === 200 && photo.type === "image/jpeg" && photo.cache === "private, no-store", JSON.stringify(photo));
    const qrPath = await aee.page.$eval("[data-qr-path]", (el) => el.getAttribute("data-qr-path"));
    check("carteirinha: QR com código aleatório", qrPath?.startsWith("/c/") && CARD_TOKEN_PATTERN.test(qrPath.slice(3)) && await aee.page.$eval("[data-qr-path] svg", (svg) => svg.querySelectorAll("path").length > 0), qrPath);
    const photoPath = await aee.page.$eval('.id-card img[alt^="Foto de"]', (img) => img.getAttribute("src"));
    const therapist = await newSession();
    await login(therapist.page, "terapeuta");
    check("carteirinha: o terapeuta não vê a foto", (await therapist.page.evaluate(async (src) => (await fetch(src)).status, photoPath)) === 404);
    await therapist.ctx.close();

    const reader = await newSession();
    await reader.page.goto(`${BASE}${qrPath}`, { waitUntil: "networkidle2" });
    const gate = await textOf(reader.page);
    check("carteirinha: o QR sem login leva à entrada, sem dados do estudante", reader.page.url().endsWith("/login") && gate.includes("Você leu o código de uma carteirinha") && !gate.includes(DANTE_FIRST), reader.page.url());
    const landed = await login(reader.page, "professor_sala");
    check("carteirinha: depois do login, o professor cai na ficha do estudante", landed.includes(`/estudantes/${childId}`), landed);
    await reader.page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    check("carteirinha: depois de usado, o código não fica guardado", new URL(reader.page.url()).pathname === "/", reader.page.url());
    await aee.page.goto(cardPage, { waitUntil: "networkidle2" });
    await clickByText(aee.page, "Gerar código novo");
    await until(aee.page, (old) => document.querySelector("[data-qr-path]")?.getAttribute("data-qr-path") !== old, { timeout: 15000 }, qrPath);
    await reader.page.goto(`${BASE}${qrPath}`, { waitUntil: "networkidle2" });
    check("carteirinha: código trocado não abre mais", reader.page.url().endsWith("/carteirinha/inativa") && !(await textOf(reader.page)).includes(DANTE_FIRST), reader.page.url());
    await reader.ctx.close();

    await family.page.goto(`${BASE}/familia/${childId}`, { waitUntil: "networkidle2" });
    const history = await family.page.evaluate(() => { document.querySelectorAll("details").forEach((d) => { d.open = true; }); return document.body.innerText; });
    check("carteirinha: a leitura do QR entra no histórico da família", history.includes("visualizou · Código QR da carteirinha") && history.includes("enviou · Foto da carteirinha"));
    await clickByText(family.page, "Retirar a autorização: Carteirinha digital");
    await until(family.page, () => !document.querySelector("#carteirinha"), { timeout: 15000 });
    check("carteirinha: retirar a autorização apaga a carteirinha", !(await family.page.$("#carteirinha")) && (await aee.page.evaluate(async (src) => (await fetch(src)).status, photoPath)) === 404);
    check("carteirinha: sem erros de cliente", [...family.errors, ...aee.errors].length === 0, [...family.errors, ...aee.errors].join("; "));
    await family.ctx.close();
    await aee.ctx.close();
  });

  await section("jogos", async () => {
    const { ctx, page, errors } = await newSession();
    await login(page, "professor_aee");
    await page.goto(`${BASE}/jogos`, { waitUntil: "networkidle2" });
    check("jogos: no menu da equipe", await page.evaluate(() => [...document.querySelectorAll("nav a")].some((a) => a.getAttribute("href") === "/jogos")));
    const studentId = await page.evaluate((name) => [...document.querySelectorAll("#jogo-estudante option")].find((o) => o.textContent.includes(name))?.value, firstName(DANTE));
    await page.select("#jogo-estudante", studentId);
    check("jogos: o estudante escolhido fica no endereço", await until(page, (id) => location.search.includes(`estudante=${id}`), { timeout: 5000 }, studentId), page.url());
    const library = await page.evaluate(() => ({
      games: document.querySelectorAll('button[aria-label^="Jogar "]').length,
      fullScreen: [...document.querySelectorAll('form[action^="/jogar/"]')].map((form) => form.querySelector('input[name="estudante"]')?.value),
      separatePage: [...document.querySelectorAll("a")].some((a) => a.getAttribute("href")?.startsWith("/jogos/explorar")),
    }));
    check("jogos: os 19 jogos juntos, numa página só", library.games === 19 && library.fullScreen.length === 4 && !library.separatePage, JSON.stringify(library));
    check("jogos: os de tela cheia levam o estudante escolhido", library.fullScreen.every((id) => id === studentId), JSON.stringify(library.fullScreen));

    await page.evaluate(() => document.querySelector('input[name="game-level"][value="facil"]').click());
    await page.click("#play-encontre");
    await hasButton(page, "Ver uma pista");
    for (let round = 0; round < 5; round += 1) {
      const last = round === 4;
      await clickByText(page, "Ver uma pista");
      await appears(page, "[data-hint]", 5000);
      if (round === 0) {
        await page.evaluate(() => [...document.querySelectorAll('section[aria-label^="Partida"] button[aria-pressed]')].find((b) => !b.dataset.hint && !b.textContent.includes("pista"))?.click());
        await appears(page, "[data-selected]", 5000);
      }
      await page.click("[data-hint]");
      await hasButton(page, last ? "Concluir partida" : "Próxima descoberta");
      await clickByText(page, last ? "Concluir partida" : "Próxima descoberta");
      if (!last) await hasButton(page, "Ver uma pista");
    }
    const registerLabel = `Registrar a aula de ${firstName(DANTE)}`;
    check("jogos: fotografias com o registro da aula no fim", await until(page, (label) => document.body.innerText.includes(label), { timeout: 10000 }, registerLabel));
    await clickByText(page, "Registrar a aula");
    check("jogos: registra a aula do jogo de fotografias", await until(page, () => document.body.innerText.includes("Aula registrada"), { timeout: 15000 }));

    await page.goto(`${BASE}/jogar/memoria?estudante=${studentId}&nivel=facil&tema=animais`, { waitUntil: "networkidle2" });
    await clickByText(page, "Dica");
    const pics = await page.$$eval("[data-pic]", (cards) => cards.map((card) => card.getAttribute("data-pic")));
    const firstOther = pics.findIndex((pic) => pic !== pics[0]);
    const cards = await page.$$("[data-pic]");
    await cards[0].click();
    await cards[firstOther].click();
    await until(page, (total) => document.querySelectorAll('[data-pic][aria-label^="Carta "]').length === total, { timeout: 5000 }, pics.length);
    for (const pic of [...new Set(pics)]) {
      const [first, second] = await page.$$(`[data-pic="${pic}"]`);
      await first.click();
      await until(page, (key) => !document.querySelector(`[data-pic="${key}"]`)?.getAttribute("aria-label").startsWith("Carta "), { timeout: 5000 }, pic);
      await second.click();
      await until(page, (key) => [...document.querySelectorAll(`[data-pic="${key}"]`)].every((card) => card.getAttribute("aria-label").endsWith("par encontrado")), { timeout: 5000 }, pic);
    }
    await until(page, () => document.body.innerText.includes("Você terminou"), { timeout: 10000 });
    const summary = await textOf(page);
    check("jogos: memória até o fim, com a dica e o erro no resumo", summary.includes("2 de 2 pares") && summary.includes("1 dica") && summary.includes("1 tentativa a mais"), summary.slice(0, 200));
    await clickByText(page, "Registrar a aula");
    check("jogos: registra a aula no fim", await until(page, () => document.body.innerText.includes("Aula registrada"), { timeout: 15000 }));
    await clickByText(page, "Jogar de novo");
    await until(page, () => location.search.includes("partida="), { timeout: 15000 });
    await settle(page);
    check("jogos: jogar de novo abre uma partida nova", page.url().includes("partida=") && (await textOf(page)).includes("0 de 2 pares"), page.url());

    await page.goto(`${BASE}/jogar/sequencia?estudante=${studentId}&nivel=facil&rotina=maos`, { waitUntil: "networkidle2" });
    for (let step = 0; step < 3; step += 1) {
      await page.click(`[data-step="${step}"]`);
      await until(page, (placed) => !document.querySelector(`[data-step="${placed}"]`), { timeout: 5000 }, step);
    }
    check("jogos: sequência da rotina até o fim", await until(page, () => document.body.innerText.includes("Você terminou"), { timeout: 10000 }));

    for (const path of ["associacao?modo=quantidade&nivel=medio", "emocoes?nivel=desafio"]) {
      await page.goto(`${BASE}/jogar/${path.replace("?", `?estudante=${studentId}&`)}`, { waitUntil: "networkidle2" });
      await page.evaluate(() => [...document.querySelectorAll('ul[aria-label="Opções"] button')].find((b) => !b.dataset.answer)?.click());
      await until(page, () => [...document.querySelectorAll('ul[aria-label="Opções"] button')].some((b) => !b.dataset.answer && b.getAttribute("aria-disabled") === "true"), { timeout: 5000 });
      for (let round = 0; round < 5; round += 1) {
        await page.click('[data-answer="sim"]:not([aria-disabled])');
        await until(page, () => document.body.innerText.includes("Você terminou") || Boolean(document.querySelector('[data-answer="sim"]:not([aria-disabled])')), { timeout: 5000 });
      }
      await until(page, () => document.body.innerText.includes("Você terminou"), { timeout: 5000 });
      const end = await textOf(page);
      check(`jogos: ${path.split("?")[0]} com 5 rodadas e o erro contado`, end.includes("5 de 5 rodadas") && end.includes("1 tentativa a mais"), end.slice(0, 160));
    }

    await page.goto(`${BASE}/estudantes/${studentId}/diario`, { waitUntil: "networkidle2" });
    const diary = await textOf(page);
    check("jogos: o registro aparece em Registrar aula", diary.includes("Jogo: Memória por temas (fácil, Animais). 2 de 2 pares · 1 dica · 1 tentativa a mais."));
    check("jogos: o registro do jogo de fotografias também", diary.includes("Jogo: Encontre a imagem (fácil). 5 de 5 rodadas · 5 dicas · 1 tentativa a mais."), diary.slice(0, 300));

    await page.goto(`${BASE}/jogar/emocoes?nivel=facil`, { waitUntil: "networkidle2" });
    const alone = await textOf(page);
    check("jogos: tela cheia sem estudante", page.url().includes("/jogar/emocoes") && alone.includes("Emoções") && ![DANTE_FIRST, RAVI_FIRST].some((name) => alone.includes(`com ${name}`)) && !alone.includes("Registrar a aula"), page.url());
    const family = await newSession();
    await login(family.page, "familia");
    await family.page.goto(`${BASE}/jogar/memoria?estudante=${studentId}`, { waitUntil: "networkidle2" });
    check("jogos: fora do alcance da família", !family.page.url().includes("/jogar/"), family.page.url());
    await family.ctx.close();
    check("jogos: sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  });
}

await browser.close();
process.exit(finish());
