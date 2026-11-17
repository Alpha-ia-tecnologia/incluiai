import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const PASSWORD = "demo123";
const STUDENT = `Teste Playwright ${Date.now().toString(36)}`;
let studentPath = "";

async function login(page, email) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

const content = (page) => page.locator("#conteudo");
const tabs = (page) => page.getByRole("navigation", { name: "Seções do estudante" });
const option = (page, group, label) => page.getByRole("group", { name: group }).getByText(label, { exact: true });

test.describe("ficha do estudante", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "aee@escola.edu.br");
  });

  test("cadastro: não pergunta se recebe AEE e abre a ficha do estudante", async ({ page }) => {
    await page.goto("/estudantes/novo");
    const say = async (question, answer) => {
      await expect(content(page).getByText(question).last()).toBeVisible();
      await expect(content(page)).not.toContainText("matriculado no AEE");
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
    await page.waitForURL((url) => /^\/estudantes\/(?!novo$)[a-z0-9]+$/.test(url.pathname));
    studentPath = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { level: 1 })).toContainText(STUDENT);
  });

  test("abas: o caminho essencial fica na linha e o restante no menu Mais", async ({ page }) => {
    await page.goto(studentPath);
    await expect(tabs(page).locator(".tab-strip a")).toHaveText(["Resumo", "Estudo de caso", "Plano de ensino", "Registrar aula", "Dossiê"]);
    await tabs(page).getByRole("button", { name: "Mais" }).click();
    await expect(tabs(page).getByRole("list", { name: "Mais seções do estudante" }).getByRole("link")).toHaveText([
      "Sondagem", "Como aprende", "Atividades", "Atividades com DUA", "Atendimentos AEE", "Evolução", "Materiais de apoio", "Relatórios", "Carteirinha",
    ]);
    await tabs(page).getByRole("link", { name: "Sondagem" }).click();
    await page.waitForURL(`**${studentPath}/sondagem`);
    await expect(tabs(page).locator('.tab-strip a[aria-current="page"]')).toHaveText("Sondagem");
    await expect(tabs(page).getByRole("list", { name: "Mais seções do estudante" })).toHaveCount(0);
  });

  test("trilha: sem estudo de caso, ele é o próximo passo e o Censo pede o registro", async ({ page }) => {
    await page.goto(studentPath);
    const journey = page.getByRole("region", { name: "Próximo passo do acompanhamento" });
    await expect(journey.getByRole("heading")).toHaveText("Próximo passo: Fazer o estudo de caso");
    await expect(journey.getByRole("list", { name: "Etapas do acompanhamento" }).getByRole("link")).toHaveText([
      /Estudo de caso/, /Planejar/, /Conhecer/, /Preparar/, /Registrar/, /Ver evolução/,
    ]);
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
    for (const removed of ["Histórico escolar", "Frequência escolar", "Reprovações", "Quando começou a andar", "Frequência sugerida para o AEE"]) {
      await expect(content(page)).not.toContainText(removed);
    }

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
    await expect(content(page)).not.toContainText("perguntas respondidas");
    await expect(content(page)).not.toContainText("Nenhuma informação registrada");
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
    await page.goto("/estudantes?q=Dante");
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: /Dante/ }) }).first();
    const href = await card.getByRole("link", { name: "Ver acompanhamento" }).first().getAttribute("href");
    await page.goto(`${href}/perfil`);
    await page.getByRole("button", { name: "Salvar perfil educacional" }).click();
    await page.waitForURL(/perfil\?salvo=\d+/);
    await expect(content(page).getByRole("status")).toContainText("Perfil salvo.");
    await expect(content(page)).not.toContainText("Não foi possível salvar o perfil");
  });

  test("banco de recursos: a impressão sai como documento pedagógico", async ({ page }) => {
    await page.goto("/recursos");
    await page.locator('a[href^="/recursos/c"]').filter({ hasText: "Configuração de varredura por acionador" }).first().click();
    await page.waitForURL(/\/recursos\/c/);
    const plan = page.locator("[data-resource-plan]").first();
    await expect(plan).toBeHidden();
    await page.emulateMedia({ media: "print" });
    await expect(plan).toBeVisible();
    await expect(plan.locator("[data-print-document-header]")).toContainText("Plano de atividade");
    for (const field of ["Escola:", "Turma:", "Data:", "Estudante:", "Professor(a):"]) {
      await expect(plan.locator("[data-print-document-header]")).toContainText(field);
    }
    await expect(page.locator("[data-resource-plan]").nth(1)).toContainText("Registro da aplicação");
    await expect(page.locator("[data-resource-introduction]")).toBeHidden();
    await expect(page.locator("[data-resource-instructions]").first()).toBeHidden();
    await expect(page.getByRole("button", { name: /Imprimir/ }).first()).toBeHidden();
    const quiz = page.locator("[data-resource-activity]").filter({ has: page.getByRole("heading", { name: "Quiz acessível da turma" }) });
    await expect(quiz.locator("[data-resource-sheet]").first().locator("ol > li")).toHaveCount(4);
    await expect(quiz.locator("[data-resource-sheet]").first()).toContainText("Orientação ao professor:");
  });
});

test.describe("gestão", () => {
  test("Censo, painel e importação abrem sem separar quem recebe AEE", async ({ page }) => {
    await login(page, "coordenacao@escola.edu.br");
    await page.goto("/censo");
    await expect(content(page).getByRole("heading").first()).toBeVisible();
    await page.goto("/painel");
    await expect(page.getByTestId("total-estudantes")).toBeVisible();
    await expect(content(page)).not.toContainText(/\d+ no AEE\)/);
    await page.goto("/estudantes/importar");
    await expect(content(page)).toContainText("frequencia_aee");
    await expect(content(page).getByText("aee", { exact: true })).toHaveCount(0);
  });
});
