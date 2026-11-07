// Preparar uma atividade: três sugestões (sala comum, AEE e casa), decidir e imprimir.
export default {
  id: "07-preparar-atividade",
  title: "Preparar uma atividade",
  audience: "Professores e equipe da escola",
  roles: ["professor_sala", "professor_aee", "apoio", "coordenacao"],
  summary: "Pedir três sugestões, escolher a atividade e imprimir.",
  async setup(t) {
    await t.quietLogin("professor@escola.edu.br");
    await t.dismissWelcome();
    t.vars.student = await t.studentId("Dante");
    await t.goto(`/estudantes/${t.vars.student}`);
  },
  async run(t) {
    await t.intro({ title: "Preparar uma atividade", subtitle: "Sugestões para a sala comum, o AEE e a casa", eyebrow: "Professores e equipe da escola" }, "Neste vídeo, você vai preparar uma atividade para o estudante participar junto com a turma.");

    await t.say("No acompanhamento do estudante, abra a aba Atividades.", () => t.click({ text: "Atividades", in: "nav[aria-label='Seções do estudante']", tag: "a", exact: true }));
    await t.say("Primeiro, escolha o objetivo do plano que a atividade vai trabalhar.", async () => {
      await t.scrollTo({ text: "O que vamos trabalhar?", tag: "h2, h3, p" }, "start");
      await t.point("#objectiveId", { hold: 900 });
    });
    await t.say("Depois, escreva o que a turma vai estudar. Assim, o estudante participa da mesma aula que os colegas.", () => t.choose({ field: "O que a turma vai estudar" }, "Chamada e nomes da turma"));
    await t.say("Clique em Preparar 3 sugestões.", async () => {
      await t.click({ text: "Preparar 3 sugestões", tag: "button" }, { wait: false });
      await t.find({ text: "Usar esta atividade", tag: "button" }, { timeout: 30000 });
      await t.settle();
    });

    await t.say("Chegam três sugestões: uma para a sala comum, uma para o atendimento especializado e uma para fazer em casa.", async () => {
      const card = await t.find({ text: "Usar esta atividade", tag: "button", closest: "article, li" });
      await t.scrollTo(card, "start");
      await t.ring(card, 1800);
    });
    await t.poster();
    await t.say("Cada cartão traz os materiais, o passo a passo, a forma de responder e as adaptações.", () => t.scrollBy(320));
    await t.say("Toda sugestão é uma proposta. A decisão é sua: se servir, clique em Usar esta atividade.", async () => {
      await t.click({ text: "Usar esta atividade", tag: "button" });
    });
    await t.say("Se uma sugestão não servir, abra a pergunta logo abaixo dela. Conte o motivo e rejeite a sugestão.", async () => {
      await t.click({ text: "Esta sugestão não serve para a aula?", tag: "summary" }, { wait: false });
      await t.pause(500);
      await t.point({ text: "Rejeitar sugestão", tag: "button" }, { hold: 1000 });
      await t.click({ text: "Esta sugestão não serve para a aula?", tag: "summary" }, { wait: false });
    });
    await t.say("Com a atividade aceita, o próximo passo passa a ser registrar como foi a aula.", () => t.point({ text: "Registrar como foi a aula", tag: "a" }, { hold: 1400 }));
    await t.scrollTop();
    await t.say("E o botão Imprimir atividades gera a versão em papel, para levar para a sala.", () => t.point("Imprimir atividades", { hold: 1400 }));

    await t.outro({ subtitle: "A plataforma sugere. Você decide." }, "Pronto! Depois da aula, use o atalho para registrar como foi.");
  },
};
