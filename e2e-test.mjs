// Suite E2E da IncluiEdu — Chrome instalado via puppeteer-core.
// Uso: node e2e-test.mjs  (BASE=http://localhost:3213 por padrão)
//   CHROME_PATH=...    caminho do Chrome (padrão: o do sistema)
//   E2E_ONLY=espera    só o prontuário (seção 4) e a espera dos agentes (seção 7)
//   E2E_PAGO=1         com a IA ligada, roda também "Preparar 3 sugestões" (agentes pagos)
import puppeteer from "puppeteer-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3213";
const ONLY_WAIT = process.env.E2E_ONLY === "espera";
const PAID = process.env.E2E_PAGO === "1";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? " — " + detail : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome"),
  headless: true,
  userDataDir: mkdtempSync(join(tmpdir(), "pptr-")),
  args: ["--no-sandbox", "--disable-gpu", "--disable-extensions"],
});

async function newSession() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  return { ctx, page, errors };
}

// Clica no botão cujo texto contém `text` (evita colidir com o botão Sair da sidebar).
async function clickByText(page, text) {
  const ok = await page.evaluate((t) => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes(t));
    if (!btn) return false;
    btn.click();
    return true;
  }, text);
  if (!ok) throw new Error(`botão não encontrado: ${text}`);
}

// ChoiceField: o <select> tem id gerado (useId); é achado pelo rótulo.
async function choose(page, label, value) {
  const handle = await page.evaluateHandle((l) => [...document.querySelectorAll("label")].find((item) => item.textContent.includes(l))?.control ?? null, label);
  const select = handle.asElement();
  if (!select) throw new Error(`campo não encontrado: ${label}`);
  await select.select(value);
  return select;
}
// ChoiceField com "Outro": escolhe a opção e digita no campo que se abre.
async function chooseOther(page, label, text) {
  const select = await choose(page, label, "__outro__");
  const id = await select.evaluate((element) => element.id);
  await page.waitForSelector(`[id="${id}-outro"]`, { timeout: 5000 });
  await page.type(`[id="${id}-outro"]`, text);
}
// MultiChoiceField: abre "Outro" do grupo (pela legenda) e digita o item
// (o texto digitado conta mesmo sem tocar em Adicionar).
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

// Formulário "Preparar 3 sugestões": o motivo de não estar disponível vem da própria página.
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

async function settle(page) {
  await page.waitForFunction(() => Boolean(document.querySelector("h1")?.textContent), { timeout: 20000 }).catch(() => {});
  await sleep(600);
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 45000 });
  await page.type("#email", email);
  await page.type("#password", "demo123");
  await clickByText(page, "Entrar");
  await sleep(1500);
  await settle(page);
  return page.url();
}

if (!ONLY_WAIT) {
  // ---------- 1. Não autenticado ----------
  {
    const { ctx, page } = await newSession();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    check("não autenticado → /login", page.url().includes("/login"));
    await ctx.close();
  }

  // ---------- 2. Login e roteamento por perfil ----------
  for (const [email, path, h1part] of [
    ["secretaria@municipio.gov.br", "/", "O que vamos fazer hoje?"],
    ["professor@escola.edu.br", "/", "O que vamos fazer hoje?"],
    ["terapeuta@clinica.com.br", "/terapeuta", "Articulação intersetorial"],
    ["familia@email.com", "/familia/", "Acompanhamento de"],
  ]) {
    const { ctx, page, errors } = await newSession();
    const url = await login(page, email);
    const h1 = (await page.evaluate(() => document.querySelector("h1")?.textContent)) ?? "";
    check(`login ${email.split("@")[0]} → ${path}`, url.includes(path) && h1.includes(h1part), `url=${url} h1=${h1}`);
    check(`sem erros de cliente (${email.split("@")[0]})`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }

  // ---------- 3. Controle de acesso ----------
  {
    const { ctx, page } = await newSession();
    await login(page, "professor@escola.edu.br");
    await page.goto(`${BASE}/painel`, { waitUntil: "networkidle2" });
    await settle(page);
    const h1 = await page.evaluate(() => document.querySelector("h1")?.textContent);
    const scoped = await page.evaluate(() => !document.querySelector("#escola") && !document.querySelector("#equipe"));
    check("professor vê só o painel da própria escola", h1 === "Painel de indicadores" && scoped, `h1=${h1}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await newSession();
    const familyHome = await login(page, "familia@email.com");
    const childId = new URL(familyHome).pathname.split("/").pop();
    // A ficha é da equipe: pelo endereço, a família volta para o portal dela.
    for (const path of ["/estudantes", "/recursos", "/painel", `/estudantes/${childId}`, `/estudantes/${childId}/diario`, `/estudantes/${childId}/perfil`, `/estudantes/${childId}/atividades`]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
      await settle(page);
      check(`família bloqueada de ${path.replace(childId, ":id")}`, page.url().includes("/familia/"), `url=${page.url()}`);
    }
    await page.goto(`${BASE}/familia/${childId}`, { waitUntil: "networkidle2" });
    check("família vê os materiais aprovados no portal", await page.evaluate(() => document.body.innerText.includes("Materiais para usar em casa")));
    await ctx.close();

    // Terapeuta: só o espaço de orientações (sem diário, notas da família ou ficha).
    const therapist = await newSession();
    await login(therapist.page, "terapeuta@clinica.com.br");
    for (const path of [`/estudantes/${childId}/diario`, `/estudantes/${childId}`, `/familia/${childId}`]) {
      await therapist.page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
      await settle(therapist.page);
      check(`terapeuta bloqueado de ${path.replace(childId, ":id")}`, new URL(therapist.page.url()).pathname === "/terapeuta", `url=${therapist.page.url()}`);
    }
    await therapist.ctx.close();
  }
}

// ---------- 4. Prontuário: todas as abas ----------
let danteHref = "";
{
  const { ctx, page, errors } = await newSession();
  await login(page, "aee@escola.edu.br");
  await page.goto(`${BASE}/estudantes`, { waitUntil: "networkidle2" });
  danteHref = await page.evaluate(() => {
    const student = [...document.querySelectorAll("article")].find((card) => card.querySelector("h2")?.textContent.includes("Dante"));
    return [...(student?.querySelectorAll("a") ?? [])].find((link) => link.textContent.trim() === "Ver acompanhamento")?.getAttribute("href") ?? "";
  });
  check("lista de estudantes mostra Dante e seu acompanhamento", /^\/estudantes\/[^/]+$/.test(danteHref));
  if (!danteHref) throw new Error("Dante não foi encontrado na lista; os formulários não serão executados.");
  for (const [tab, heading] of [
    ["", "Dante"],
    ["/perfil", "Como aprende"],
    ["/ppi", "Plano de ensino (PPI)"],
    ["/atividades", "Preparar uma atividade"],
    ["/diario", "Registrar aula ou atendimento"],
    ["/linha-do-tempo", "Evolução"],
    ["/materiais", "Materiais de apoio"],
  ]) {
    await page.goto(`${BASE}${danteHref}${tab}`, { waitUntil: "networkidle2" });
    // A ficha tem um h1 (o nome do estudante); o título de cada aba é h2.
    const hasHeading = await page.evaluate((expected) => [...document.querySelectorAll("h1, h2")].some((title) => title.textContent.includes(expected)), heading);
    check(`seção ${tab || "/resumo"} renderiza`, hasHeading);
  }
  check("prontuário sem erros de cliente", errors.length === 0, errors.join("; "));
  await ctx.close();
}

if (!ONLY_WAIT) {
  // ---------- 5. Fluxos de formulário ----------
  {
    const { ctx, page, errors } = await newSession();
    await login(page, "aee@escola.edu.br");
    const countSuggestions = () => page.evaluate(() => [...document.querySelectorAll("button")].filter((button) => button.textContent.trim() === "Usar esta atividade").length);

    // 5a. Preparar 3 sugestões: aguarda três novos cartões, mesmo com sugestões anteriores.
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
      await page.waitForFunction((before) => [...document.querySelectorAll("button")].filter((button) => button.textContent.trim() === "Usar esta atividade").length === before + 3, { timeout: form.aiOn ? 300000 : 30000 }, suggestionsBefore).catch(() => {});
      check("preparar 3 sugestões de atividade", (await countSuggestions()) === suggestionsBefore + 3);
    }

    // 5b. Aceitar a primeira sugestão e localizar seu link para registrar a aula.
    let acceptedDiaryHref = null;
    if ((await countSuggestions()) === 0) {
      console.log("SKIP  aceitar atividade e registrar a aula: não há sugestão aberta");
    } else {
      const acceptedBefore = await page.$$eval('a[href*="/diario?activityId="]', (links) => links.map((link) => link.getAttribute("href")));
      await clickByText(page, "Usar esta atividade");
      await page.waitForFunction((previous) => [...document.querySelectorAll('a[href*="/diario?activityId="]')].some((link) => !previous.includes(link.getAttribute("href"))), { timeout: 20000 }, acceptedBefore).catch(() => {});
      acceptedDiaryHref = await page.evaluate((previous) => [...document.querySelectorAll('a[href*="/diario?activityId="]')].find((link) => !previous.includes(link.getAttribute("href")))?.getAttribute("href"), acceptedBefore);
      check("aceitar atividade (sugerida → aceita)", Boolean(acceptedDiaryHref));
    }

    // 5c. Registrar a aula em três partes, preenchendo as escolhas obrigatórias
    // (pela atividade aceita ou, sem ela, direto no diário).
    {
      await page.goto(`${BASE}${acceptedDiaryHref ?? `${danteHref}/diario`}`, { waitUntil: "networkidle2" });
      await page.click('input[name="participation"][value="total"]');
      await page.select("#supportLevel", "1");
      await page.click('input[name="criterionMet"][value="sim"]');
      await choose(page, "Seu papel neste registro", "professor_aee");
      const diaryNote = `Teste E2E: identificou o nome com supervisão. ${Date.now()}`;
      await page.type("#note", diaryNote);
      await clickByText(page, "Salvar registro");
      await page.waitForFunction((note) => document.querySelector("#historico-registros")?.textContent.includes(note), { timeout: 20000 }, diaryNote).catch(() => {});
      check("registro da aula salvo no histórico", await page.evaluate((note) => Boolean(document.querySelector("#historico-registros")?.textContent.includes(note)), diaryNote));
    }

    // 5d. Criar material de apoio (IA ou regras): ao criar, abre a página do material novo;
    // de volta à galeria, há um cartão a mais, e é o primeiro.
    await page.goto(`${BASE}${danteHref}/materiais`, { waitUntil: "networkidle2" });
    const materialsBefore = await page.$$eval("article[id^='material-']", (items) => items.length);
    await page.$eval("input[name=kind][value=historia_social]", (radio) => radio.click());
    await clickByText(page, "Criar material");
    await page.waitForFunction((href) => /^\/[^/]+$/.test(location.pathname.slice(`${href}/materiais`.length)) && location.pathname.startsWith(`${href}/materiais/`) && Boolean(document.querySelector("article[id^='material-'] h2")), { timeout: 180000 }, danteHref).catch(() => {});
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
    await page.waitForFunction((before) => document.querySelectorAll("article[id^='material-']").length === before + 1, { timeout: 20000 }, materialsBefore).catch(() => {});
    const gallery = await page.evaluate(() => [...document.querySelectorAll("article[id^='material-']")].map((item) => item.id));
    check("galeria de materiais: um cartão a mais, o novo primeiro", gallery.length === materialsBefore + 1 && gallery[0] === opened.id, `${gallery.length} cartões`);
    check("fluxos sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  }

  // 5e. Relatório do terapeuta
  {
    const { ctx, page, errors } = await newSession();
    await login(page, "terapeuta@clinica.com.br");
    for (const [legend, txt] of [
      ["Formas de comunicação mais eficazes", "Prancha com apoio visual funciona melhor."],
      ["Recursos de acessibilidade utilizados", "Fone abafador e prancha."],
      ["Fatores que facilitam a participação", "Antecipação e temas de interesse."],
      ["Estratégias que podem ser testadas", "Pareamento com miniaturas."],
      ["Orientações aplicáveis à escola", "Avisar transições 2 minutos antes."],
      ["Objetivos compartilhados escola-família", "Ampliar pedidos espontâneos pela prancha."],
    ]) await typeOther(page, legend, txt);
    await clickByText(page, "Enviar para a equipe escolar");
    await page.waitForFunction(() => document.body.innerText.includes("Pareamento com miniaturas"), { timeout: 20000 }).catch(() => {});
    check("relatório de articulação intersetorial", await page.evaluate(() => document.body.innerText.includes("Pareamento com miniaturas")));
    check("terapeuta sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  }

  // 5f. Família registra conquista + log de acessos
  {
    const { ctx, page, errors } = await newSession();
    await login(page, "familia@email.com");
    await typeOther(page, "O que aconteceu?", "Teste E2E: pediu água pela prancha no jantar.");
    await clickByText(page, "Enviar");
    await page.waitForFunction(() => document.body.innerText.includes("pediu água pela prancha no jantar"), { timeout: 20000 }).catch(() => {});
    check("família registra conquista de casa", await page.evaluate(() => document.body.innerText.includes("pediu água pela prancha no jantar")));
    check("família vê log de acessos (LGPD)", await page.evaluate(() => document.body.innerText.toLowerCase().includes("quem acessou os dados")));
    check("família sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  }

  // ---------- 6. Painel de indicadores (secretaria) ----------
  {
    const { ctx, page, errors } = await newSession();
    await login(page, "secretaria@municipio.gov.br");
    await page.goto(`${BASE}/painel-municipal`, { waitUntil: "networkidle2" });
    check("endereço antigo do painel municipal redireciona", page.url().endsWith("/painel"), page.url());
    await page.goto(`${BASE}/painel?periodo=tudo`, { waitUntil: "networkidle2" });
    const body = await page.evaluate(() => document.body.innerText);
    check("painel: indicadores da rede", body.includes("Jornada do acompanhamento") && body.includes("Toda a rede") && Boolean(await page.$('nav[aria-label="Indicador do medidor"]')));
    check("painel: banco de práticas agregado", body.toLowerCase().includes("banco de práticas por perfil"));
    check("assistente: botão flutuante em todas as telas", Boolean(await page.$(".assistant-fab")));
    await page.goto(`${BASE}/assistente`, { waitUntil: "networkidle2" });
    check("assistente: página própria", (await page.evaluate(() => document.querySelector("h1")?.textContent)) === "Converse com o assistente");
    await page.goto(`${BASE}/recursos`, { waitUntil: "networkidle2" });
    check("banco de recursos renderiza", await page.evaluate(() => document.querySelector("h1")?.textContent === "Recursos para incluir."));
    const resourceHref = await page.evaluate(() =>
      [...document.querySelectorAll("a")].find((a) => a.getAttribute("href")?.startsWith("/recursos/"))?.getAttribute("href")
    );
    check("recurso exibe atividades correspondentes", Boolean(resourceHref));
    if (resourceHref) {
      await page.goto(`${BASE}${resourceHref}`, { waitUntil: "networkidle2" });
      const detail = await page.evaluate(() => document.body.innerText);
      const normalizedDetail = detail.toLocaleLowerCase("pt-BR");
      check("atividade traz objetivo, aplicação e evidência", normalizedDetail.includes("como aplicar") && normalizedDetail.includes("evidência a observar"));
      await clickByText(page, "Teve boa resposta");
      await page.waitForFunction(() => document.body.innerText.includes("1 aplicações"), { timeout: 20000 }).catch(() => {});
      check("resultado da atividade alimenta métrica", await page.evaluate(() => document.body.innerText.includes("boa resposta")));
    }
    check("secretaria sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}

// ---------- 7. Espera do assistente (canteiro vivo) ----------
// O fluxo SSE do turno é simulado no navegador (só a interface é testada; nada
// chega à IA) e <html data-espera-escala="20"> acelera os relógios: 20 s viram 1 s.
// window.__conversation, quando definido, responde à leitura de uma conversa
// (com window.__conversationDelay ms de atraso, para testar corridas).
const stubTurn = (page) => page.evaluateOnNewDocument(() => {
  const realFetch = window.fetch.bind(window);
  const encoder = new TextEncoder();
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/assistente/conversas/") && window.__conversation) {
      const body = JSON.stringify({ conversation: window.__conversation });
      return new Promise((resolve) => setTimeout(() => resolve(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })), window.__conversationDelay ?? 0));
    }
    if (!url.includes("/api/assistente/turno")) return realFetch(input, init);
    const stream = new ReadableStream({
      start(controller) {
        window.__sse = (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        window.__sseEnd = () => controller.close();
      },
    });
    return Promise.resolve(new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } }));
  };
});
{
  const { ctx, page, errors } = await newSession();
  await stubTurn(page);
  await page.setViewport({ width: 320, height: 568 });
  await login(page, "professor@escola.edu.br");
  await page.evaluate(() => { document.documentElement.dataset.esperaEscala = "20"; });
  const sse = (event) => page.evaluate((e) => window.__sse(e), event);
  const sseEnd = () => page.evaluate(() => window.__sseEnd());
  const garden = (name) => page.$eval('[data-testid="espera-jardim"]', (el, n) => el.getAttribute(n), name);
  const status = () => page.$eval('[data-testid="espera-status"]', (el) => el.textContent);
  const height = () => page.$eval('[data-testid="espera-jardim"]', (el) => Math.round(el.getBoundingClientRect().height));
  const fab = (name) => page.$eval(".assistant-fab", (el, n) => el.getAttribute(n), name);
  const fabStatus = () => page.$eval(".assistant-fab + p[role=status]", (el) => el.textContent);
  const focused = () => page.evaluate(() => (document.activeElement?.classList.contains("assistant-fab") ? "fab" : document.activeElement?.tagName ?? ""));
  const lastItem = () => page.evaluate(() => [...document.querySelectorAll("#assistente-painel ol > li")].at(-1)?.textContent ?? "");
  const tipRegion = () => page.$eval('#assistente-painel [data-testid="espera-dica"]', (el) => el.textContent);
  // Forma do sinal no botão flutuante (não só a cor): ponto redondo ou losango girado.
  const markShape = () => page.$eval(".assistant-fab-mark", (el) => { const style = getComputedStyle(el); return `${el.dataset.activity}|${style.borderRadius}|${style.transform === "none" ? "reto" : "girado"}`; });
  const writeAndSend = async (text) => {
    await page.focus("#assistente-painel textarea");
    await page.keyboard.type(text);
    await page.keyboard.press("Enter");
    await sleep(150);
  };
  const stamp = () => new Date().toISOString();
  const done = (id, text) => sse({ type: "done", message: { id, role: "assistente", text, steps: [], createdAt: stamp() }, conversation: { id: "e-conv", title: "Teste", updatedAt: stamp() }, long: false });

  await page.click(".assistant-fab");
  await page.waitForSelector('[data-testid="espera-jardim"]', { timeout: 20000 });
  // O popup abre a última conversa salva da pessoa: começa de uma vazia.
  await page.click('#assistente-painel button[aria-label="Nova conversa"]');
  await sleep(150);
  const assistantOff = await page.evaluate(() => Boolean(document.querySelector("#assistente-painel")?.textContent.includes("O assistente ainda não está ativo")));
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
    await sleep(200);
    check("espera: pensando logo no envio", (await garden("data-state")) === "pensando");
    check("espera: popup de 568 px usa a faixa compacta", (await height()) <= 84, String(await height()));
    const field = await page.$eval("#assistente-painel textarea", (el) => [el.readOnly, el.disabled, el.getAttribute("aria-disabled")].join(","));
    check("espera: campo só leitura (não desligado) durante o turno", field === "true,false,true", field);
    await sleep(700);
    check("espera: anúncio fora da conversa", (await status()) === "Pensando no seu pedido.", await status());
    check("espera: sem item vazio na conversa enquanto pensa", await page.evaluate(() => [...document.querySelectorAll("#assistente-painel ol > li")].every((item) => item.textContent.trim() !== "")));
    await sse({ type: "tool_start", step: { id: "e1", name: "ver_estudante", label: "Lendo o acompanhamento do estudante" } });
    await sleep(800);
    check("espera: consulta vira raiz e é anunciada", (await garden("data-scene")) === "raizes" && (await status()) === "Lendo o acompanhamento.", await status());
    check("espera: legenda legível pelo leitor de tela", await page.$eval('[data-testid="espera-legenda"]', (el) => !el.closest("[aria-hidden=true]") && el.textContent.includes("Lendo o acompanhamento")));
    await sse({ type: "tool_end", step: { id: "e1", name: "ver_estudante", label: "Lendo o acompanhamento do estudante", ok: true } });
    await sleep(100);
    check("espera: passo real = folha nova e amarrilho a menos", (await garden("data-grown")) === "1" && (await garden("data-ties")) === "1");
    await sse({ type: "tool_start", step: { id: "e2", name: "propor_plano", label: "Preparando a proposta de plano com os agentes" } });
    await sse({ type: "tool_progress", id: "e2", progress: { agent: "Analista do caso", phase: "start" } });
    await sleep(800);
    check("espera: só o degrau do agente real acende", (await page.$eval('[data-part="degrau"][data-agent="analista"]', (el) => el.getAttribute("data-estado"))) === "ativo" && (await garden("data-stage")) === "analista");
    check("espera: anúncio do agente com tempo habitual", (await status()) === "O analista lê o caso. Costuma levar de 1 a 3 minutos.", await status());
    await sleep(1200);
    check("espera: aos 20 s, aviso de que a resposta fica salva", (await garden("data-elapsed")) === "20" && (await status()).includes("Pode fechar o painel"), await status());
    // O link de página inteira fica desligado durante o turno: clicar não navega nem fecha o painel.
    const urlBefore = page.url();
    await page.click('#assistente-painel a[aria-label="Abrir em página inteira"]');
    await sleep(300);
    check("espera: página inteira espera o fim do turno", (await page.$eval('#assistente-painel a[aria-label="Abrir em página inteira"]', (el) => el.getAttribute("aria-disabled"))) === "true" && page.url() === urlBefore && (await page.$eval("#assistente-painel", (el) => !el.hidden)), page.url());
    await page.keyboard.press("Escape");
    await sleep(100);
    check("espera: painel fechado avisa no botão", (await fab("aria-label")) === "Abrir o assistente (resposta em preparo)" && (await focused()) === "fab");
    await page.click(".assistant-fab");
    await sse({ type: "tool_end", step: { id: "e2", name: "propor_plano", label: "x", ok: true } });
    await sse({ type: "text", delta: "A proposta está pronta para a sua revisão. " });
    await sleep(150);
    check("espera: texto chegando deixa a faixa compacta e parada", (await garden("data-state")) === "escrevendo" && (await garden("data-respira")) === "false");
    await page.click('[data-testid="espera-regar"]');
    await sleep(100);
    check("espera: regar mostra uma dica e não pega o foco do campo", (await page.$eval('[data-testid="espera-dica"]', (el) => el.textContent)).length > 0 && (await focused()) !== "TEXTAREA");
    await done("e-msg", "Proposta pronta.");
    await sseEnd();
    await sleep(150);
    check("espera: final com flor e anúncio de resposta pronta", (await garden("data-state")) === "pronto" && (await garden("data-finale")) === "true" && (await status()) === "Resposta pronta.");
    await sleep(2300);
    check("espera: depois do final, a faixa recolhe", (await garden("data-state")) === "inativo" && (await height()) <= 1);
    check("espera: sem rolagem horizontal a 320 px", (await page.evaluate(() => document.documentElement.scrollWidth)) <= 320);
    check("espera: a dica do turno não volta com a faixa fechada", (await tipRegion()) === "", await tipRegion());

    // Turno 2, enviado pelo teclado com o painel fechado depois: o foco fica no
    // campo durante o turno, e o botão focado não troca de nome (o status anuncia).
    await writeAndSend("Mais uma pergunta");
    check("espera: envio pelo teclado mantém o foco no campo", (await focused()) === "TEXTAREA");
    await page.keyboard.press("Escape");
    await sleep(100);
    // Mesma fase em que a dica do turno 1 apareceu (texto chegando): ela não reaparece.
    await sse({ type: "text", delta: "Segunda " });
    await sleep(200);
    check("espera: a dica velha não reaparece no turno seguinte", (await tipRegion()) === "" && !(await page.$eval('#assistente-painel [data-testid="espera-legenda"]', (el) => el.textContent)).includes("Dica:"), await tipRegion());
    await done("e-msg2", "Segunda resposta.");
    await sseEnd();
    await sleep(200);
    check("espera: com o foco no botão, o nome fica e o status anuncia", (await fab("aria-label")) === "Abrir o assistente (resposta em preparo)" && (await fabStatus()) === "A resposta do assistente está pronta." && (await markShape()) === "pronto|9999px|reto", await markShape());
    await page.evaluate(() => document.activeElement?.blur());
    await sleep(100);
    check("espera: fora do foco, o nome do botão mostra a resposta pronta", (await fab("aria-label")) === "Abrir o assistente (resposta pronta)");
    await page.click(".assistant-fab");
    await sleep(150);
    // O broto ao lado do horário cresce ao aparecer e não repete ao reabrir o popup.
    const sprout = () => page.evaluate(() => {
      const icon = [...document.querySelectorAll("#assistente-painel ol > li")].at(-1)?.querySelector("p svg.lucide-sprout");
      return icon ? (icon.classList.contains("assistant-sprout-mark") ? "crescendo" : "assentado") : "ausente";
    });
    const growing = await sprout();
    await sleep(1200);
    const settled = await sprout();
    await page.keyboard.press("Escape");
    await sleep(100);
    await page.click(".assistant-fab");
    await sleep(100);
    const reopened = await sprout();
    check("espera: broto da resposta nova cresce uma vez só", growing === "crescendo" && settled === "assentado" && reopened === "assentado" && (await lastItem()).includes("Segunda resposta."), `${growing}/${settled}/${reopened}`);

    // Turno 2b: com o painel aberto e o foco no botão flutuante, o turno acaba;
    // fechar pelo próprio botão dá o nome do estado de agora, não o guardado.
    await writeAndSend("Pergunta com o painel aberto");
    await page.focus(".assistant-fab");
    await done("e-msg2b", "Resposta com o painel aberto.");
    await sseEnd();
    await sleep(200);
    await page.keyboard.press("Enter");
    await sleep(200);
    check("espera: fechar pelo botão focado mostra o estado de agora", (await fab("aria-expanded")) === "false" && (await fab("aria-label")) === "Abrir o assistente", await fab("aria-label"));
    await page.click(".assistant-fab");
    await sleep(200);

    // Turno 3: erro do turno anunciado uma vez só (na conversa, sem alerta).
    await writeAndSend("Pergunta com erro");
    await sse({ type: "error", message: "Erro de teste." });
    await sseEnd();
    await sleep(200);
    const alerts = await page.evaluate(() => document.querySelectorAll("#assistente-painel [role=alert]").length);
    check("espera: erro do turno sem alerta repetido, com reenvio", alerts === 0 && (await lastItem()).includes("Erro de teste.") && (await lastItem()).includes("Usar a mesma mensagem"), `alertas=${alerts}`);

    // Turno 4: a conexão cai depois que o servidor começou (painel fechado),
    // numa conversa nova. O servidor avisa a conversa antes de tudo.
    const dropTurn = async (text, conversationId) => {
      await page.click('#assistente-painel button[aria-label="Nova conversa"]');
      await sleep(150);
      await writeAndSend(text);
      await sse({ type: "conversation", conversation: { id: conversationId, title: text, updatedAt: stamp() } });
      await page.keyboard.press("Escape");
      await sse({ type: "tool_start", step: { id: `${conversationId}-t`, name: "propor_plano", label: "x" } });
      await sleep(1200);
      await sseEnd();
      await sleep(200);
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
    check("espera: botão avisa a queda com losango", (await markShape()) === "interrompida|2px|girado" && (await fabStatus()).startsWith("A conexão com o assistente caiu."), await markShape());
    await page.click(".assistant-fab");
    await sleep(200);
    const dropped = await lastItem();
    check("espera: queda sem reenvio, com 'Ver se a resposta ficou pronta'", dropped.includes("A conexão caiu antes de a resposta chegar") && dropped.includes("Ver se a resposta ficou pronta") && !dropped.includes("Usar a mesma mensagem"), dropped);
    // Outra mensagem antes de a primeira terminar: o servidor recusa (ocupado), e
    // a bolha oferece a consulta, não o reenvio (repetiria os agentes).
    await writeAndSend("Mandei de novo");
    await sse({ type: "error", message: "Aguarde a resposta anterior terminar." });
    await sseEnd();
    await sleep(200);
    const busy = await lastItem();
    check("espera: depois da queda, o erro de ocupado oferece a consulta, não o reenvio", busy.includes("Aguarde a resposta anterior terminar.") && busy.includes("Ver se a resposta ficou pronta") && !busy.includes("Usar a mesma mensagem"), busy);
    // Consulta lenta e "Nova conversa" no meio: o resultado velho é descartado.
    await savedConversation("e-conv2", "Pergunta que cai", 800);
    await page.click("#assistente-painel ol > li:last-child button");
    await sleep(100);
    await page.click('#assistente-painel button[aria-label="Nova conversa"]');
    await sleep(1100);
    check("espera: consulta atrasada não desfaz 'Nova conversa'", (await page.$$eval("#assistente-painel ol > li", (items) => items.length)) === 0 && (await page.$eval("#assistente-painel header", (el) => el.textContent)).includes("Nova conversa"));
    // Nova queda; a consulta (pelo teclado) traz a resposta salva, sem recriar
    // as mensagens que já estavam na tela, e devolve o foco ao campo.
    await dropTurn("Outra pergunta que cai", "e-conv3");
    await page.click(".assistant-fab");
    await sleep(200);
    await page.evaluate(() => { const first = document.querySelector("#assistente-painel ol > li"); if (first) first.dataset.marca = "antes"; });
    await savedConversation("e-conv3", "Outra pergunta que cai", 0);
    await page.focus("#assistente-painel ol > li:last-child button");
    await page.keyboard.press("Enter");
    await sleep(400);
    check("espera: 'Ver se a resposta ficou pronta' traz a resposta e devolve o foco ao campo", (await lastItem()).includes("Resposta salva no servidor.") && (await focused()) === "TEXTAREA", await lastItem());
    check("espera: a consulta não recria (nem reanuncia) a pergunta já na tela", await page.evaluate(() => document.querySelector('#assistente-painel ol > li[data-marca="antes"]')?.textContent.includes("Outra pergunta que cai") ?? false));
  }
  check("espera: sem erros de cliente", errors.length === 0, errors.join("; "));
  await ctx.close();
}

// Movimento reduzido na página do assistente a 320 px: composição parada,
// sem botão de pausa, e o palco compacto pela largura da faixa. Depois, com
// movimento normal, a geometria da faixa estreita e os anúncios das atividades.
{
  const { ctx, page, errors } = await newSession();
  await stubTurn(page);
  await page.setViewport({ width: 320, height: 640 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await login(page, "professor@escola.edu.br");
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
    await page.waitForSelector('[data-testid="espera-jardim"][data-state="pensando"]', { timeout: 5000 }).catch(() => {});
    check("espera: movimento reduzido sem animação", (await page.$eval('[data-part="planta"]', (el) => getComputedStyle(el).animationName).catch(() => "?")) === "none");
    check("espera: sem botão de pausa no movimento reduzido", (await page.$eval('[data-testid="espera-pausar"]', (el) => getComputedStyle(el).display).catch(() => "?")) === "none");
    const stage = await page.$eval('[data-testid="espera-regar"]', (el) => Math.round(el.getBoundingClientRect().width)).catch(() => 0);
    check("espera: página a 320 px usa o palco compacto", stage === 44, String(stage));
    // Movimento normal (com o botão de pausa): a legenda tem largura para 2 linhas,
    // e o palco de 44 px não mostra a gota nem corta a arte em círculo.
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
    await sleep(150);
    const geometry = await page.$eval('[data-testid="espera-jardim"]', (root) => ({
      badge: getComputedStyle(root.querySelector('[data-testid="espera-regar"] > span')).display,
      clip: getComputedStyle(root.querySelector('[data-testid="espera-regar"] svg')).clipPath,
      caption: Math.round(root.querySelector('[data-testid="espera-legenda"]').getBoundingClientRect().width),
      pause: getComputedStyle(root.querySelector('[data-testid="espera-pausar"]')).display,
    }));
    check("espera: faixa estreita sem gota, arte inteira e legenda de 156 px ou mais", geometry.badge === "none" && geometry.clip === "none" && geometry.caption >= 156 && geometry.pause !== "none", JSON.stringify(geometry));
    // Atividades: sem estimativa antes do primeiro evento; com o "queued" das
    // imagens, a estimativa já vem certa (1 a 4 minutos).
    const sse = (event) => page.evaluate((e) => window.__sse(e), event);
    const status = () => page.$eval('[data-testid="espera-status"]', (el) => el.textContent);
    await sse({ type: "tool_start", step: { id: "a1", name: "gerar_atividades", label: "Criando as 3 sugestões de atividade com os agentes" } });
    await sleep(900);
    check("espera: atividades sem estimativa antes do primeiro evento", (await status()) === "Criando 3 sugestões de atividade.", await status());
    await sse({ type: "tool_progress", id: "a1", progress: { agent: "Ilustração", phase: "queued" } });
    await sse({ type: "tool_progress", id: "a1", progress: { agent: "Agente da sala comum", phase: "start" } });
    await sleep(900);
    check("espera: com imagens, a estimativa anunciada é de 1 a 4 minutos", (await status()) === "Três agentes escrevem ao mesmo tempo. Costuma levar de 1 a 4 minutos, com as imagens.", await status());
    await page.evaluate(() => window.__sseEnd());
  }
  check("espera (página a 320 px): sem erros de cliente", errors.length === 0, errors.join("; "));
  await ctx.close();
}

// Formulário de atividades: a ação de servidor fica pendente (interceptada,
// nada chega aos agentes) e a espera inline não pode reabrir o botão.
if (danteHref) {
  const { ctx, page, errors } = await newSession();
  await login(page, "aee@escola.edu.br");
  await page.goto(`${BASE}${danteHref}/atividades`, { waitUntil: "networkidle2" });
  await page.evaluate(() => { document.documentElement.dataset.esperaEscala = "20"; });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) return; // sem resposta: fica pendente
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
    const inline = await page.waitForSelector('[data-testid="espera-jardim"][data-variant="inline"]', { timeout: 5000 }).catch(() => null);
    check("espera inline aparece com a IA ligada", Boolean(inline));
    if (inline) {
      const pendingStatus = await page.$eval('[data-testid="pending-status"]', (el) => el.textContent);
      check("espera inline: status com o texto da página e uma estimativa só", pendingStatus === "Os agentes da sala comum, do AEE e da família estão preparando as atividades, e o revisor vai conferir. Costuma levar de 1 a 3 minutos.", pendingStatus);
      await page.click('[data-testid="espera-regar"]');
      await sleep(1500);
      check("espera inline: regar e o relógio não reabrem o botão", (await page.evaluate(() => [...document.querySelectorAll("button[aria-busy]")].some((b) => b.getAttribute("aria-busy") === "true"))) && (await page.$eval('[data-testid="espera-jardim"]', (el) => el.getAttribute("data-elapsed"))) !== "0");
      // Rolando até o cartão sair da tela, o IntersectionObserver pausa a respiração; voltando, ela segue.
      const card = '[data-testid="espera-jardim"][data-variant="inline"]';
      const breath = () => page.$eval(card, (el) => getComputedStyle(el.querySelector('[data-part="planta"]')).animationPlayState);
      const canLeave = await page.$eval(card, (el) => document.documentElement.scrollHeight - window.innerHeight > el.getBoundingClientRect().bottom + window.scrollY);
      if (!canLeave) {
        console.log("SKIP  espera inline fora da tela: a página não rola o bastante");
      } else {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const away = await page.waitForSelector(`${card}[data-offscreen="true"]`, { timeout: 3000 }).catch(() => null);
        const pausedAway = away ? await breath() : "sem aviso do observador";
        await page.$eval(card, (el) => el.scrollIntoView({ block: "center" }));
        const back = await page.waitForSelector(`${card}[data-offscreen="false"]`, { timeout: 3000 }).catch(() => null);
        const runningBack = back ? await breath() : "sem aviso do observador";
        check("espera inline: fora da tela a respiração para e volta ao rolar de volta", pausedAway === "paused" && runningBack === "running", `${pausedAway}/${runningBack}`);
      }
    }
  }
  check("espera inline: sem erros de cliente", errors.length === 0, errors.join("; "));
  await ctx.close();
}

// Com E2E_PAGO=1 a ação de atividades termina de verdade (agentes pagos, ou
// simulados num servidor de teste): quando o cartão some, o foco volta ao
// botão só para quem estava nele pelo teclado. Quem regou com o mouse não
// recebe o foco no botão, para o Espaço seguinte não reenviar a ação.
if (danteHref && PAID) {
  const { ctx, page, errors } = await newSession();
  await login(page, "aee@escola.edu.br");
  await page.goto(`${BASE}${danteHref}/atividades`, { waitUntil: "networkidle2" });
  const form = await activitiesForm(page);
  if (form.skip || !form.button || !form.aiOn) {
    console.log(`SKIP  foco depois da espera inline: ${form.skip ?? "formulário com IA indisponível"}`);
  } else {
    const submit = () => page.evaluateHandle(() => [...document.querySelectorAll("button[type=submit]")].find((button) => button.textContent.includes("Preparar 3 sugestões")));
    const finish = async () => {
      await page.waitForSelector('[data-testid="espera-jardim"][data-variant="inline"]', { hidden: true, timeout: 300000 });
      await sleep(300);
      return page.evaluate(() => {
        const active = document.activeElement;
        return active instanceof HTMLButtonElement && active.textContent.includes("Preparar 3 sugestões") ? "botão" : active?.tagName ?? "";
      });
    };
    // Mouse: clica no botão e rega com o mouse.
    await (await submit()).asElement().click();
    await page.waitForSelector('[data-testid="espera-jardim"][data-variant="inline"]', { timeout: 10000 });
    await page.click('[data-testid="espera-regar"]');
    const afterMouse = await finish();
    check("espera inline: depois de regar com o mouse, o foco não vai para o botão", afterMouse !== "botão", afterMouse);
    // Teclado: Enter no botão e Tab até a regadora.
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
}

// ---------- 8. Planejamento com DUA ----------
// Cria uma atividade da turma a cada execução e a leva até "validada para aplicação".
// Sem IA: as opções vêm dos exemplos da tela. Depois, família fora do planejamento e
// Plano de ensino barrado sem estudo de caso concluído (CA02).
const textOf = (page) => page.evaluate(() => document.body.innerText);
// Botão pelo texto exato (o chip "Fala" não pode colidir com outros botões).
async function clickExact(page, text) {
  const ok = await page.evaluate((t) => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === t);
    btn?.click();
    return Boolean(btn);
  }, text);
  if (!ok) throw new Error(`botão não encontrado: ${text}`);
}
const hasButton = (page, text, exact = false) => page.waitForFunction((t, e) => [...document.querySelectorAll("button")].some((b) => (e ? b.textContent.trim() === t : b.textContent.includes(t))), { timeout: 10000 }, text, exact).then(() => true, () => false);

if (!ONLY_WAIT) {
  {
    const { ctx, page, errors } = await newSession();
    await login(page, "professor@escola.edu.br");
    await page.goto(`${BASE}/planejamento`, { waitUntil: "networkidle2" });
    await settle(page);
    const h1 = await page.evaluate(() => [...document.querySelectorAll("h1")].map((title) => title.textContent).join(" | "));
    check("DUA: professor abre o Planejamento com DUA", h1.includes("Planejamento com DUA"), `h1=${h1}`);

    // 8a. Nova atividade: abre o editor na etapa 1.
    await page.type("#novo-titulo", `Teste E2E DUA ${Date.now()}`);
    await clickByText(page, "Começar o planejamento");
    const editor = await page.waitForSelector("#dua-objetivo", { timeout: 30000 }).catch(() => null);
    check("DUA: cria a atividade e abre a etapa 1", Boolean(editor) && /\/planejamento\/[^/]+/.test(new URL(page.url()).pathname), page.url());

    if (editor) {
      // 8b. Objetivo e um critério observável; o salvamento automático confirma.
      await page.type("#dua-objetivo", "Identificar dois personagens principais e ordenar três acontecimentos da história.");
      await clickByText(page, "Adicionar critério observável");
      const criterion = await page.waitForFunction(() => [...document.querySelectorAll("label")].find((label) => label.textContent.trim() === "Critério 1")?.control ?? null, { timeout: 5000 }).catch(() => null);
      if (criterion) await criterion.asElement().type("Diz ou aponta os dois personagens principais.");
      // Logo depois de digitar a tela mostra "Alterações ainda não salvas"; "Tudo salvo" só volta depois da gravação.
      const saved = await page.waitForFunction(() => document.body.innerText.includes("Tudo salvo"), { timeout: 20000 }).then(() => true, () => false);
      check("DUA: objetivo e critério com salvamento automático", Boolean(criterion) && saved, criterion ? "sem “Tudo salvo”" : "campo Critério 1 não apareceu");

      // 8c. Etapa 2: barreira pela sugestão de barreira comum.
      await clickByText(page, "Contexto e barreiras");
      const barrierChip = "Exigência de uma única forma de resposta";
      if (await hasButton(page, barrierChip)) await clickByText(page, barrierChip);
      const barrier = await page.waitForFunction((t) => [...document.querySelectorAll("textarea")].some((area) => area.value.includes(t)), { timeout: 5000 }, barrierChip).then(() => true, () => false);
      check("DUA: etapa 2 registra a barreira da tarefa", barrier);

      // 8d. Etapa 3: opção pelo exemplo "Fala" (ação e expressão).
      await clickByText(page, "Opções e apoios");
      if (await hasButton(page, "Fala", true)) await clickExact(page, "Fala");
      const option = await page.waitForFunction(() => [...document.querySelectorAll("textarea")].some((area) => area.id.startsWith("opcao-") && area.value === "Fala"), { timeout: 5000 }).then(() => true, () => false);
      check("DUA: etapa 3 adiciona a opção “Fala”", option);

      // 8e. Etapa 4: validar para aplicação (decisão registrada; a versão deixa de mudar).
      await clickByText(page, "Revisão para aplicação");
      if (await hasButton(page, "Validar para aplicação")) {
        await clickByText(page, "Validar para aplicação");
        const validated = await page.waitForFunction(() => document.body.innerText.includes("validada para aplicação"), { timeout: 20000 }).then(() => true, () => false);
        check("DUA: versão validada para aplicação", validated, validated ? "" : (await textOf(page)).match(/Para validar, ainda falta:[\s\S]{0,300}|Não foi possível[^\n]*/)?.[0] ?? "");
      } else {
        check("DUA: botão Validar para aplicação na etapa 4", false);
      }
    }

    // 8f. Plano de ensino (PPI) sem estudo de caso concluído. No seed, só Dante tem o
    // estudo concluído; o aviso só aparece para estudante ainda sem plano ativo.
    await page.goto(`${BASE}/estudantes`, { waitUntil: "networkidle2" });
    const others = await page.evaluate(() => [...document.querySelectorAll("article")]
      .map((card) => ({ name: card.querySelector("h2")?.textContent ?? "", href: [...card.querySelectorAll("a")].find((link) => link.textContent.trim() === "Ver acompanhamento")?.getAttribute("href") ?? "" }))
      .filter((item) => !item.name.includes("Dante") && /^\/estudantes\/[^/]+$/.test(item.href)));
    let gate = null;
    for (const student of others) {
      await page.goto(`${BASE}${student.href}/ppi`, { waitUntil: "networkidle2" });
      const body = await textOf(page);
      if (body.includes("Conclua o estudo de caso")) { gate = { ...student, ok: true }; break; }
      // Formulário de plano aberto sem estudo de caso concluído: a regra falhou.
      if (body.includes("Comece o plano do estudante") || body.includes("Preencher o plano do zero")) { gate = { ...student, ok: false }; break; }
    }
    if (gate) check("DUA: Plano de ensino pede o estudo de caso concluído", gate.ok, `${gate.name} (${gate.href}/ppi) mostra o formulário do plano`);
    else console.log(`SKIP  Plano de ensino sem estudo de caso: ${others.length ? "os estudantes sem estudo de caso concluído já têm plano ativo" : "nenhum estudante além de Dante na lista"}`);
    check("DUA: sem erros de cliente", errors.length === 0, errors.join("; "));
    await ctx.close();
  }

  // 8g. Família não entra no planejamento com DUA.
  {
    const { ctx, page } = await newSession();
    await login(page, "familia@email.com");
    await page.goto(`${BASE}/planejamento`, { waitUntil: "networkidle2" });
    await settle(page);
    check("DUA: família não abre /planejamento", !new URL(page.url()).pathname.startsWith("/planejamento"), `url=${page.url()}`);
    await ctx.close();
  }
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n===== ${results.length - failed.length}/${results.length} testes passaram =====`);
process.exit(failed.length ? 1 : 0);
