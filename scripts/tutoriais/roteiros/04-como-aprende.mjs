export default {
  id: "04-como-aprende",
  title: "Como aprende",
  audience: "Professores e equipe da escola",
  roles: ["professor_sala", "professor_aee", "apoio", "coordenacao"],
  summary: "Registrar como o estudante se comunica, aprende e participa.",
  async setup(t) {
    await t.quietLogin("aee@escola.edu.br");
    await t.dismissWelcome();
    t.vars.student = await t.studentId("Dante");
    await t.goto(`/estudantes/${t.vars.student}`);
  },
  async run(t) {
    await t.intro({ title: "Como aprende", subtitle: "Comunicação, interesses e apoios de cada estudante", eyebrow: "Professores e equipe da escola" }, "Neste vídeo, você vai ver como registrar e atualizar como o estudante aprende.");

    await t.say("No acompanhamento do estudante, abra a aba Como aprende.", () => t.click({ text: "Como aprende", in: "nav[aria-label='Seções do estudante']", tag: "a" }));
    await t.say("Este perfil não pede diagnóstico. Ele mostra como o estudante se comunica, aprende, interage e se regula.", () => t.ring({ text: "Sem informações de diagnóstico", tag: "span, p, div" }, 2200));
    await t.say("O perfil é uma conversa guiada, com uma pergunta por vez. As respostas ficam reunidas por área.", () => t.ring({ text: "Comunicação", tag: "h2, h3", closest: "section, article, li, div:has(> h3)" }, 2200));
    await t.poster();

    await t.say("Para atualizar uma resposta, clique em Editar, ao lado dela.", () => t.click({ text: "Editar Canal expressivo", tag: "button" }));
    await t.say("Escolha a opção que descreve o estudante na maior parte das situações.", () => t.click({ text: "Gestos", tag: "button", exact: true }));
    await t.say("A resposta volta para o resumo, já atualizada.", () => t.ring({ text: "Comunicação", tag: "h2, h3", closest: "section, article, li, div:has(> h3)" }, 1800));
    await t.say("Os níveis de apoio usam uma escala única, de independente até apoio físico total.", () => t.ring({ text: "Aprendizagem", tag: "h2, h3", closest: "section, article, li, div:has(> h3)" }, 2000));
    await t.say("Interesses e potencialidades ajudam a planejar atividades que fazem sentido para o estudante.", () => t.ring({ text: "Potencialidades", tag: "h2, h3", closest: "section, article, li, div:has(> h3)" }, 2000));
    await t.say("Confira as respostas e clique em Salvar perfil educacional.", async () => {
      await t.click({ text: "Salvar perfil educacional", tag: "button" });
      await t.settle();
    });
    await t.scrollTop();
    await t.say("Prefere ver todas as perguntas numa página só? Clique em Abrir formulário completo.", () => t.point("Abrir formulário completo", { hold: 1200 }));

    await t.outro({ subtitle: "O perfil orienta o plano e as atividades" }, "Pronto! Com o perfil salvo, o plano e as sugestões de atividades passam a considerar como o estudante aprende.");
  },
};
