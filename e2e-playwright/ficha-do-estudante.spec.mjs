import { expect, test } from "@playwright/test";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DEMO_STUDENTS } from "../prisma/demo-data.mjs";
import { STUDENT_TABS } from "../src/lib/student-tab-list.ts";
import { TRAIL_STEPS } from "../src/lib/student-journey.ts";
import { CONTENT_ID } from "../src/lib/landmarks.ts";
import { printSelector } from "../src/components/resources/print-marks.ts";
import { activityPrintMaterials } from "../src/lib/resource-print-materials.ts";

test.describe.configure({ mode: "serial" });

const STUDENT = `Teste Playwright ${Date.now().toString(36)}`;
let studentPath = "";

async function login(page, role) {
  await page.goto("/login");
  await page.locator("#email").fill(DEMO_ACCOUNTS[role].email);
  await page.locator("#password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

const content = (page) => page.locator(`#${CONTENT_ID}`);
const tabs = (page) => page.getByRole("navigation", { name: "Seções do estudante" });
const option = (page, group, label) => page.getByRole("group", { name: group }).getByText(label, { exact: true });

test.describe("ficha do estudante", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "professor_aee");
  });

  test("cadastro: a conversa abre a ficha do estudante", async ({ page }) => {
    await page.goto("/estudantes/novo");
    const say = async (question, answer) => {
      await expect(content(page).getByText(question).last()).toBeVisible();
      if (answer.option) {
        // Só dentro da conversa: o menu da conta também tem botões de alternar.
        const choice = typeof answer.option === "string"
          ? content(page).getByRole("button", { name: answer.option, exact: true })
          : content(page).locator("button[aria-pressed]");
        await choice.first().click();
      } else {
        const input = page.locator(answer.date ? 'input[type="date"]' : 'form input:not([type="hidden"])').last();
        await input.fill(answer.date ?? answer.text);
        await input.press("Enter");
      }
    };
    await say("qual é o nome completo do estudante?", { text: STUDENT });
    await say("Qual é a data de nascimento?", { date: "2017-03-15" });
    await say("Em qual escola o estudante está matriculado?", { option: true });
    await say("Qual é a etapa de ensino?", { option: "Anos Iniciais" });
    await say("Em qual ano ou série está?", { option: true });
    await say("Qual é a turma?", { option: true });
    await say("Em qual turno estuda?", { option: true });
    await say("Quem é o responsável pelo estudante?", { text: "Responsável de Teste" });
    await say("Qual é o telefone do responsável?", { option: "Prefiro informar depois" });
    await say("Com qual frequência é atendido?", { option: "Prefiro informar depois" });
    await say("O estudante conta com profissional de apoio?", { option: "Não" });
    await page.getByRole("button", { name: "Não há informação a acrescentar" }).click();
    await page.getByRole("button", { name: "Salvar no prontuário" }).click();
    await page.waitForURL((url) => /^\/estudantes\/(?!novo$|importar$)[^/]+$/.test(url.pathname));
    studentPath = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { level: 1 })).toContainText(STUDENT);
  });

  test("abas: Resumo e os seis passos ficam fixos, na ordem da trilha; o restante no menu Mais", async ({ page }) => {
    await page.goto(studentPath);
    const fixed = ["Resumo", ...TRAIL_STEPS.map((step) => step.label)];
    await expect(tabs(page).getByRole("link")).toHaveText(fixed);
    await tabs(page).getByRole("button", { name: "Mais" }).click();
    await expect(tabs(page).getByRole("list", { name: "Mais seções do estudante" }).getByRole("link")).toHaveText(STUDENT_TABS.filter((tab) => tab.group === "mais").map((tab) => tab.label));
    await tabs(page).getByRole("link", { name: "Sondagem" }).click();
    await page.waitForURL(`**${studentPath}/sondagem`);
    await expect(tabs(page).getByRole("list", { name: "Mais seções do estudante" })).toHaveCount(0);
    // A linha não muda numa seção do Mais: o próprio Mais fica marcado.
    await expect(tabs(page).getByRole("link")).toHaveText(fixed);
    await expect(tabs(page).locator('a[aria-current="page"]')).toHaveCount(0);
    await expect(tabs(page).getByRole("button", { name: /^Mais\W+atual: Sondagem$/ })).toHaveAttribute("data-current", "true");
  });

  test("abas no celular: os seis passos à vista sem rolar de lado; rolada, a página deixa a seção atual, que abre a lista", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/estudantes?q=${encodeURIComponent(DEMO_STUDENTS.dante.name)}`);
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: DEMO_STUDENTS.dante.name }) }).first();
    const dante = await card.getByRole("link", { name: "Ver acompanhamento" }).first().getAttribute("href");
    await page.goto(dante);
    for (const step of TRAIL_STEPS) await expect(tabs(page).getByRole("link", { name: step.label, exact: true })).toBeInViewport({ ratio: 1 });
    const overflow = await tabs(page).evaluate((nav) => ({
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      nav: nav.scrollWidth - nav.clientWidth,
      cut: [...nav.querySelectorAll("a, button")].filter((item) => item.scrollWidth > item.clientWidth + 1).map((item) => item.textContent),
    }));
    expect(overflow).toEqual({ page: 0, nav: 0, cut: [] });

    await page.mouse.wheel(0, 1200);
    const current = tabs(page).getByRole("button", { name: "Seção atual: Resumo" });
    await expect(current).toBeVisible();
    await expect(tabs(page).getByRole("link", { name: "Evolução", exact: true })).toBeHidden();
    await current.click();
    const all = tabs(page).getByRole("list", { name: "Todas as seções do estudante" });
    await expect(all.getByRole("link")).toHaveText(STUDENT_TABS.map((tab) => tab.label));
    await all.getByRole("link", { name: "Evolução" }).click();
    await page.waitForURL(`**${dante}/linha-do-tempo`);
  });

  test("Atividade: duas vistas na mesma aba, e o endereço antigo do DUA chega à vista com DUA", async ({ page }) => {
    await page.goto(`${studentPath}/dua`);
    await page.waitForURL(`**${studentPath}/atividades/dua`);
    const views = page.getByRole("navigation", { name: "Vistas do passo Atividade" });
    await expect(tabs(page).locator('a[aria-current="page"]')).toHaveText("Atividade");
    await expect(views.locator('a[aria-current="page"]')).toHaveText("Planejar com DUA");
    await expect(content(page).getByRole("heading", { name: "Planejar participação em atividade" })).toBeVisible();
    await views.getByRole("link", { name: "Preparar e adaptar" }).click();
    await page.waitForURL(`**${studentPath}/atividades`);
    await expect(tabs(page).locator('a[aria-current="page"]')).toHaveText("Atividade");
    await expect(views.locator('a[aria-current="page"]')).toHaveText("Preparar e adaptar");
  });

  test("trilha: sem estudo de caso, ele é o próximo passo e o Censo pede o registro", async ({ page }) => {
    await page.goto(studentPath);
    const journey = page.getByRole("region", { name: "Próximo passo do acompanhamento" });
    await expect(journey.getByRole("heading")).toHaveText("Próximo passo: Fazer o estudo de caso");
    const steps = journey.getByRole("list", { name: "Etapas do acompanhamento" }).getByRole("link");
    await expect(steps).toHaveText(TRAIL_STEPS.map((step) => new RegExp(`${step.label}$`)));
    await expect(steps.and(page.locator('[aria-current="step"]'))).toHaveText(/Estudo de caso$/);
    await expect(content(page)).toContainText("Falta o registro de referência para declarar este estudante");
    await expect(content(page)).not.toContainText("Sem registro de acompanhamento");
  });

  test("estudo de caso: o Essencial segue o INEP e basta para concluir", async ({ page }) => {
    await page.goto(`${studentPath}/estudo-de-caso`);
    const essential = page.locator("#secao-essencial");
    await expect(essential.locator("fieldset > legend").filter({ hasText: /^\d\./ })).toHaveText([
      "1. Impedimentos, potencialidades e demandas de apoio",
      "2. Barreiras do contexto escolar",
      "3. Estratégias e recursos de acessibilidade",
      "4. Conclusão do estudo",
    ]);
    await expect(page.locator("#aprofundar")).not.toHaveAttribute("open", "");
    await expect(page.locator("#aprofundar [required]")).toHaveCount(0);

    await option(page, /Impedimentos de longo prazo/, "Na fala e na comunicação").click();
    await option(page, /^Potencialidades/, "Boa memória visual").click();
    await option(page, /Necessidades educacionais/, "Comunicação alternativa e aumentativa").click();
    await option(page, /Barreiras observadas/, "Comunicacional").click();
    await option(page, /Recursos e serviços indicados/, "Prancha de comunicação").click();
    await page.getByLabel(/Público da educação especial/).selectOption({ label: "Sim: estudante com deficiência" });
    await page.getByLabel(/Síntese do caso/).fill("Comunica-se por gestos e aprende melhor com apoio visual. Prioridade: ampliar a comunicação.");
    await page.getByRole("button", { name: "Concluir estudo de caso" }).click();

    await page.waitForURL(/estudo-de-caso\?concluido=1/);
    await expect(content(page).getByRole("status")).toContainText("Estudo de caso salvo e concluído.");
    const next = page.getByRole("region", { name: "Próximo passo", exact: true });
    await expect(next.getByRole("heading")).toHaveText("Próximo passo: criar o plano de ensino");
    await expect(next.getByRole("link", { name: /Criar o plano de ensino/ })).toHaveAttribute("href", `${studentPath}/ppi`);
    await expect(page.getByRole("region", { name: "Essencial" })).toContainText("Prancha de comunicação");
    await expect(content(page)).toContainText("Aprofundar o estudo");
  });

  test("Censo: o estudo concluído respalda a declaração, e o próximo passo vira o plano", async ({ page }) => {
    await page.goto(studentPath);
    await expect(content(page)).toContainText("Censo Escolar: com registro de referência (Estudo de caso)");
    await expect(page.getByRole("region", { name: "Próximo passo do acompanhamento" }).getByRole("heading")).toHaveText("Próximo passo: Criar o plano de ensino");
  });

  test("Censo: estudo que ainda avalia se o estudante é público não respalda a declaração", async ({ page }) => {
    const setAnswer = async (label) => {
      await page.goto(`${studentPath}/estudo-de-caso?editar=1`);
      await page.getByLabel(/Público da educação especial/).selectOption({ label });
      await page.getByRole("button", { name: "Salvar alterações" }).click();
      await page.waitForURL(/estudo-de-caso\?concluido=1/);
    };
    await setAnswer("Em avaliação pela equipe");
    await page.goto(studentPath);
    await expect(content(page)).toContainText("a equipe ainda avalia se o estudante é público da educação especial");
    await expect(content(page).getByRole("link", { name: /Rever o estudo de caso/ })).toBeVisible();
    await expect(content(page)).not.toContainText("com registro de referência");
    await setAnswer("Sim: estudante com deficiência");
    await page.goto(studentPath);
    await expect(content(page)).toContainText("Censo Escolar: com registro de referência (Estudo de caso)");
  });

  test("plano: os campos do Censo abrem o formulário, e a falta do tipo de AEE só avisa", async ({ page }) => {
    await page.goto(`${studentPath}/ppi`);
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: /Salvar plano e definir objetivos/ }) });
    // O formulário manual pode estar recolhido quando os agentes de IA estão ligados.
    if (!(await form.isVisible())) await page.locator("details").filter({ has: form }).locator("summary").first().click();
    await expect(form.locator("fieldset > legend").filter({ hasText: /Censo Escolar|PAEE|PEI/ }).first()).toContainText("Declarado no Censo Escolar");
    const census = form.getByRole("group", { name: /Declarado no Censo Escolar/ });
    await expect(census.getByRole("group", { name: /Atendimentos do AEE/ })).toBeVisible();
    await expect(census.getByRole("group", { name: /Recursos na avaliação/ })).toBeVisible();
    await expect(form.getByRole("group", { name: /Tecnologia assistiva e CAA/ }).getByLabel("Prancha de comunicação")).toBeChecked();
    const service = census.getByRole("group", { name: /Atendimentos do AEE/ }).getByLabel("Comunicação alternativa e aumentativa (CAA)");
    await expect(service).toBeChecked();
    await census.getByRole("group", { name: /Atendimentos do AEE/ }).getByText("Comunicação alternativa e aumentativa (CAA)", { exact: true }).click();
    await expect(service).not.toBeChecked();

    await form.getByRole("group", { name: /O que o estudante já consegue fazer/ }).getByText("Identifica cores e formas", { exact: true }).click();
    const review = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await form.getByLabel(/Quando a equipe vai revisar este plano/).fill(review);
    await form.getByRole("button", { name: /Salvar plano e definir objetivos/ }).click();

    await expect(page.locator("#pei")).toBeVisible();
    await expect(page.locator("#pei")).toContainText("Para conferir: sem os atendimentos do AEE no plano");
    await page.goto(studentPath);
    await expect(content(page)).toContainText("com registro de referência (Estudo de caso, PAEE, PEI)");
  });

  test("Como aprende: salvar confirma o perfil, sem erro falso", async ({ page }) => {
    await page.goto(`/estudantes?q=${encodeURIComponent(DEMO_STUDENTS.dante.name)}`);
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: DEMO_STUDENTS.dante.name }) }).first();
    const href = await card.getByRole("link", { name: "Ver acompanhamento" }).first().getAttribute("href");
    await page.goto(`${href}/perfil`);
    await page.getByRole("button", { name: "Salvar perfil educacional" }).click();
    await page.waitForURL(/perfil\?salvo=\d+/);
    await expect(content(page).getByRole("status")).toContainText("Perfil salvo.");
    await expect(content(page)).not.toContainText("Não foi possível salvar o perfil");
  });

  test("banco de recursos: a impressão sai como documento pedagógico", async ({ page }) => {
    await page.goto("/recursos");
    await page.locator('a[href^="/recursos/"]').filter({ hasText: "Configuração de varredura por acionador" }).first().click();
    await page.waitForURL(/\/recursos\/[^/?#]+$/);
    const plan = page.locator(printSelector("plan")).first();
    await expect(plan).toBeHidden();
    await page.emulateMedia({ media: "print" });
    await expect(plan).toBeVisible();
    await expect(plan.locator(printSelector("documentHeader"))).toContainText("Plano de atividade");
    for (const field of ["Escola:", "Turma:", "Data:", "Estudante:", "Professor(a):"]) {
      await expect(plan.locator(printSelector("documentHeader"))).toContainText(field);
    }
    await expect(page.locator(printSelector("plan")).nth(1)).toContainText("Registro da aplicação");
    await expect(page.locator(printSelector("introduction"))).toBeHidden();
    await expect(page.locator(printSelector("instructions")).first()).toBeHidden();
    await expect(page.getByRole("button", { name: /Imprimir/ }).first()).toBeHidden();
    const quiz = page.locator(printSelector("activity")).filter({ has: page.getByRole("heading", { name: "Quiz acessível da turma" }) });
    const [sheet] = activityPrintMaterials("Configuração de varredura por acionador", "Quiz acessível da turma");
    for (const card of sheet.cards) await expect(quiz.locator(printSelector("sheet")).first()).toContainText(card.label);
    await expect(quiz.locator(printSelector("sheet")).first()).toContainText("Orientação ao professor:");
  });
});

test.describe("gestão", () => {
  test("Censo, painel e importação abrem para a coordenação", async ({ page }) => {
    await login(page, "coordenacao");
    await page.goto("/censo");
    await expect(content(page).getByRole("heading").first()).toBeVisible();
    await page.goto("/painel");
    await expect(page.getByTestId("total-estudantes")).toBeVisible();
    await page.goto("/estudantes/importar");
    await expect(content(page)).toContainText("frequencia_aee");
  });
});
