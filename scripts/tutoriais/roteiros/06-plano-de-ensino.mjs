// Plano de ensino (PPI): objetivos observáveis ligados à BNCC e a revisão do plano.
const OBJETIVO = "Definir um objetivo de aprendizagem";

export default {
  id: "06-plano-de-ensino",
  title: "Plano de ensino",
  audience: "Professores e equipe da escola",
  roles: ["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao"],
  summary: "Criar um objetivo observável, ligar à BNCC e registrar a revisão.",
  async setup(t) {
    await t.quietLogin("aee@escola.edu.br");
    await t.dismissWelcome();
    t.vars.student = await t.studentId("Dante");
    await t.goto(`/estudantes/${t.vars.student}`);
  },
  async run(t) {
    await t.intro({ title: "Plano de ensino", subtitle: "Objetivos observáveis, ligados à BNCC", eyebrow: "Professores e equipe da escola" }, "Neste vídeo, você vai incluir um objetivo no plano de ensino e registrar a revisão com a equipe.");

    await t.say("No acompanhamento do estudante, abra a aba Plano de ensino.", () => t.click({ text: "Plano de ensino", in: "nav[aria-label='Seções do estudante']", tag: "a" }));
    await t.say("No alto, o andamento do plano mostra os objetivos e quanto falta para a revisão.", () => t.ring({ text: "Andamento do plano", tag: "h2", closest: "section" }, 2200));
    await t.say("Cada objetivo mostra o apoio de hoje e o apoio que se quer alcançar.", async () => {
      await t.scrollTo({ text: "Objetivos de aprendizagem", tag: "h2" }, "start");
      await t.pause(600);
    });
    await t.say("Quando a equipe decidir, marque o objetivo como alcançado ou para revisão.", () => t.point({ text: "Marcar como alcançado", tag: "button" }, { hold: 1000 }));

    await t.say("Para incluir um objetivo, desça até Definir um objetivo de aprendizagem. Depois, escolha a área.", async () => {
      await t.scrollTo({ text: OBJETIVO, tag: "h2" }, "start");
      await t.choose({ field: "Área de desenvolvimento" }, "comunicacao");
    });
    await t.poster();
    await t.say("Depois, escolha o que o estudante vai fazer: uma ação que dê para observar.", () => t.choose({ field: "O que o estudante vai fazer" }, "solicitará ajuda ou pausa"));
    await t.say("Para ligar o objetivo à BNCC, clique em Sugerir pelo objetivo e escolha a habilidade.", async () => {
      await t.click("Sugerir pelo objetivo", { wait: false });
      await t.pause(900);
      await t.click({ text: "EF15LP13", tag: "button, [role=option], li, label" }, { wait: false });
    });
    await t.say("Diga com qual apoio, e como a equipe vai saber que o estudante conseguiu.", async () => {
      await t.choose({ field: "Com qual apoio" }, "usando prancha de comunicação");
      await t.choose({ field: "Como saberemos" }, "3 situações diferentes");
    });
    await t.say("Por fim, o prazo e o apoio de hoje, comparado ao apoio que se quer alcançar.", async () => {
      await t.choose({ field: "Prazo para acompanhar" }, "8");
      await t.choose("#currentSupport", "3");
      await t.choose("#targetSupport", "2");
    });
    await t.say("Clique em Salvar objetivo no plano.", async () => {
      await t.click({ text: "Salvar objetivo no plano", tag: "button" });
      await t.settle();
    });
    await t.say("O objetivo entra na lista do plano, com a frase completa e a habilidade da BNCC.", async () => {
      await t.scrollTo({ text: "Objetivos de aprendizagem", tag: "h2" }, "start");
      await t.ring({ text: "solicitará ajuda ou pausa", tag: "p, h3, h4, span, li", closest: "li, article" }, 2200);
    });

    await t.say("Na data combinada, registre a revisão feita com a equipe.", async () => {
      await t.scrollTo("#revisao", "start");
      await t.click({ text: "Registrar a revisão feita com a equipe", tag: "summary" }, { wait: false });
    });
    await t.say("Escreva o que a equipe decidiu, confira a próxima data e clique em Registrar revisão.", async () => {
      await t.type("#review-summary", "Objetivos mantidos. A prancha passa a ser usada também no recreio.", { delay: 22 });
      await t.point("#next-review", { hold: 600 });
      await t.click({ text: "Registrar revisão", tag: "button" });
      await t.waitForText("Objetivos mantidos").catch(() => {});
    });
    await t.say("A revisão fica no histórico do plano, e a família recebe um aviso.", () => t.ring("#revisao", 2000));

    await t.outro({ subtitle: "Um objetivo por vez, com evidência e prazo" }, "Pronto! Com o objetivo no plano, o próximo passo é preparar uma atividade.");
  },
};
