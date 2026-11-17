const STEPS = "nav[aria-label='Etapas do planejamento']";

export default {
  id: "12-planejamento-dua",
  title: "Planejamento com DUA",
  audience: "Professores e equipe da escola",
  roles: ["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao"],
  summary: "Planejar uma atividade da turma em quatro etapas e validar para aplicação.",
  async setup(t) {
    await t.quietLogin("professor@escola.edu.br");
    await t.dismissWelcome();
    await t.goto("/");
  },
  async run(t) {
    await t.intro({ title: "Planejamento com DUA", subtitle: "Uma atividade da turma pensada para todos desde o início", eyebrow: "Professores e equipe da escola" }, "Neste vídeo, você vai planejar uma atividade da turma com o Desenho Universal para a Aprendizagem, o DUA.");

    await t.say("No menu, clique em Planejamento com DUA.", () => t.click({ text: "Planejamento com DUA", in: "nav" }));
    await t.say("Dê um título para a atividade da turma.", () => t.type("#novo-titulo", "Reconto da história dos três porquinhos"));
    await t.say("Escolha a turma, se quiser.", () => t.choose("#novo-turma", "2º ano"));
    await t.say("E clique em Começar o planejamento. Não precisa de estudo de caso nem de laudo.", async () => {
      await t.click("Começar o planejamento");
      await t.page.waitForSelector("#dua-objetivo", { timeout: 30000 });
      await t.settle();
    });
    await t.say("São quatro etapas. Na primeira, o que os estudantes precisam aprender.", () => t.ring({ css: STEPS }, 1800));
    await t.say("Escreva o objetivo de aprendizagem.", () => t.type("#dua-objetivo", "Recontar oralmente um conto lido pela professora, na ordem dos acontecimentos: início, meio e fim.", { delay: 22 }));
    await t.say("Para ligar uma habilidade da BNCC, busque pelo código ou por uma palavra.", async () => {
      await t.type({ css: "input[type=search][placeholder^='Código']" }, "EF15LP19", { delay: 90 });
      await t.find({ text: "EF15LP19", tag: "button" }, { timeout: 15000 });
    });
    await t.say("E clique na habilidade para usá-la no planejamento.", () => t.click({ text: "EF15LP19", tag: "button" }, { wait: false }));
    await t.say("Agora, um critério observável: como você vai perceber que aprenderam.", async () => {
      await t.click("Adicionar critério observável", { wait: false });
      await t.type({ field: "Critério 1" }, "Conta os três momentos da história, por fala, desenho ou apontando as cenas.", { delay: 22 });
    });
    await t.say("Tudo é salvo automaticamente enquanto você escreve.", async () => {
      await t.page.waitForFunction(() => document.body.innerText.includes("Tudo salvo"), { timeout: 20000 });
      await t.ring({ text: "Tudo salvo", tag: "p, span, div", exact: true }, 1500);
    });

    await t.say("Na etapa 2, as barreiras da atividade. Você pode começar por uma barreira comum.", async () => {
      await t.click({ text: "Contexto e barreiras", in: STEPS }, { wait: false });
      await t.click({ text: "Exigência de uma única forma de resposta", tag: "button" }, { wait: false });
    });
    await t.poster();
    await t.say("Na etapa 3, as opções para todos: mais de um jeito de apresentar, de participar e de responder.", async () => {
      await t.click({ text: "Opções e apoios", in: STEPS }, { wait: false });
      await t.click({ text: "Imagens", tag: "button", exact: true }, { wait: false });
      await t.click({ text: "Fala", tag: "button", exact: true }, { wait: false });
    });
    await t.say("Cada opção ganha um cartão, para ligar à barreira que ela reduz.", () => t.ring({ css: "[id^='opcao-']", nth: 0 }, 1600));

    await t.say("Na etapa 4, confira a síntese do planejamento.", async () => {
      await t.click({ text: "Revisão para aplicação", in: STEPS }, { wait: false });
      await t.ring({ css: "section[aria-labelledby='sintese-titulo']" }, 1800);
    });
    await t.say("Tudo certo? Clique em Validar para aplicação. Essa decisão é da equipe.", async () => {
      await t.click("Validar para aplicação", { wait: false });
      await t.waitForText("validada para aplicação", 20000);
    });
    await t.say("A versão validada não muda mais. Se precisar editar, a plataforma abre a versão seguinte.", () => t.ring({ text: "validada para aplicação", tag: "p, div, span" }, 2000));

    await t.say("E na aba Níveis, a mesma atividade sai em três versões: com mais apoio, padrão e com desafio.", async () => {
      await t.click({ text: "Níveis", in: "nav[aria-label='Seções do planejamento']", exact: true });
      await t.ring({ css: "#niveis-titulo" }, 1600);
    });

    await t.outro({ subtitle: "Objetivo, barreiras, opções e validação" }, "Pronto! Agora você já sabe planejar uma atividade da turma com o DUA e validar para aplicação.");
  },
};
