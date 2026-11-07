// Buscar um estudante, abrir o acompanhamento e entender o resumo.
export default {
  id: "02-encontrar-estudante",
  title: "Encontrar um estudante",
  audience: "Professores e equipe da escola",
  roles: ["professor_sala", "professor_aee", "apoio", "coordenacao", "gestao"],
  summary: "Buscar pelo nome, abrir o acompanhamento e ler o próximo passo.",
  async setup(t) {
    await t.quietLogin("professor@escola.edu.br");
    await t.dismissWelcome();
    await t.goto("/");
  },
  async run(t) {
    await t.intro({ title: "Encontrar um estudante", subtitle: "Buscar pelo nome e entender o acompanhamento", eyebrow: "Professores e equipe da escola" }, "Neste vídeo, você vai encontrar um estudante e entender o resumo do acompanhamento.");

    await t.say("No menu, abra Estudantes.", () => t.click({ text: "Estudantes", in: "nav" }));
    await t.say("Digite parte do nome. Não precisa de acento.", () => t.type({ field: "Nome do estudante" }, "dan", { delay: 140 }));
    await t.say("E clique no botão Buscar.", () => t.click({ text: "Buscar", exact: true }));
    await t.say("O resultado mostra o nome, a turma e a escola. Clique em Ver acompanhamento.", () => t.click({ text: "Ver acompanhamento", in: "main" }));

    await t.say("No alto, ficam o nome, a turma e os apoios combinados para o estudante.", () => t.ring({ css: "main h1" }, 2200));
    await t.poster();
    await t.say("O Próximo passo mostra o que fazer agora, a partir do que já foi registrado.", () => t.ring({ text: "Próximo passo", tag: "h2" }, 2200));
    await t.say("As etapas mostram o caminho: estudo de caso, conhecer, planejar, preparar, registrar e ver a evolução. O que já tem registro fica marcado.", async () => {
      for (const step of ["Estudo de caso", "Conhecer", "Planejar", "Preparar", "Registrar", "Ver evolução"]) await t.point({ text: step, in: "ol[aria-label='Etapas do acompanhamento']", tag: "a, li" }, { hold: 350, ring: false });
    });
    await t.say("Mais abaixo, os objetivos que estão sendo trabalhados e como foram as últimas aulas.", async () => {
      await t.ring({ text: "O que estamos trabalhando", tag: "h2, h3, p" }, 1400);
      await t.ring({ text: "Como foram as aulas", tag: "h2, h3" }, 1400);
    });
    await t.scrollTop();
    await t.say("As abas levam a cada parte do acompanhamento: como o estudante aprende, o plano de ensino, as atividades e o registro das aulas.", async () => {
      const tabs = "nav[aria-label='Seções do estudante']";
      await t.point({ text: "Como aprende", in: tabs, tag: "a" }, { hold: 500 });
      await t.point({ text: "Plano de ensino", in: tabs, tag: "a" }, { hold: 500 });
      await t.point({ text: "Atividades", in: tabs, tag: "a", exact: true }, { hold: 500 });
    });

    await t.say("Em Minha jornada, a mesma história aparece em capítulos, com o próximo em destaque.", async () => {
      await t.click({ text: "Minha jornada", in: "nav" });
      await t.ring({ text: "Próximo passo, capítulo", tag: "h2" }, 1800);
    });

    await t.outro({ subtitle: "Buscar, abrir e seguir o próximo passo" }, "Pronto! Agora você já sabe encontrar um estudante e seguir o próximo passo do acompanhamento.");
  },
};
