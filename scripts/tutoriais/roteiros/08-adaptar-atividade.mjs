const TEXTO = [
  "1) Leia o texto e circule os animais que vivem na fazenda.",
  "2) Ligue cada animal ao lugar onde ele vive.",
  "3) Qual é o alimento da vaca?",
  "a) capim",
  "b) carne",
].join("\n");

export default {
  id: "08-adaptar-atividade",
  title: "Adaptar a atividade da turma",
  audience: "Professores e equipe da escola",
  roles: ["professor_sala", "professor_aee", "apoio", "coordenacao"],
  summary: "Adaptar a folha ou a prova da turma e imprimir.",
  async setup(t) {
    await t.quietLogin("professor_sala");
    await t.dismissWelcome();
    t.vars.student = await t.studentId("Dante");
    await t.goto(`/estudantes/${t.vars.student}/atividades`);
  },
  async run(t) {
    await t.intro({ title: "Adaptar a atividade da turma", subtitle: "A mesma folha, com acesso para o estudante", eyebrow: "Professores e equipe da escola" }, "Neste vídeo, você vai adaptar uma atividade da turma ao jeito como o estudante aprende.");

    await t.say("Na aba Atividades do estudante, clique em Adaptar a atividade da turma.", () => t.click({ text: "Adaptar a atividade da turma", tag: "a" }));
    await t.say("Diga se é uma atividade ou uma prova. Na prova, muda a forma, não o que é avaliado.", () => t.point({ text: "Prova", tag: "label", exact: true }, { hold: 1200 }));
    await t.say("Dê um título.", () => t.type({ field: "Título" }, "Os animais e onde vivem"));
    await t.say("Envie a foto ou o PDF da folha, ou cole o texto da atividade.", async () => {
      const box = await t.find({ css: "textarea[name=text]" });
      await t.type(box, TEXTO, { delay: 12 });
    });
    await t.poster();
    await t.say("Marque o que adaptar: linguagem simples, uma ordem por linha, comando em destaque e outras opções.", () => t.ring({ text: "O que adaptar", tag: "legend", closest: "fieldset" }, 2400));
    await t.say("Se quiser, ligue a adaptação a um objetivo do plano. Depois, clique em Adaptar.", async () => {
      await t.point({ field: "Objetivo do plano" }, { hold: 600 });
      await t.click({ css: "main form button[type=submit]" });
      await t.waitForUrl("/atividades/adaptadas/");
    });

    await t.say("O original e a versão adaptada aparecem lado a lado.", () => t.pause(1800));
    await t.say("Confira cada questão. Você pode ajustar o enunciado, a forma de responder e o apoio.", async () => {
      await t.scrollTo({ text: "Enunciado", tag: "label" }, "center");
      await t.pause(900);
    });
    await t.say("Quando estiver bom, aprove a versão adaptada.", async () => {
      await t.click({ css: "button[name=intent][value=aprovar]" });
      await t.settle();
    });
    await t.scrollTop();
    await t.say("A folha aprovada sai para imprimir, salvar em PDF ou abrir no Word.", async () => {
      await t.point({ text: "Imprimir", tag: "a, button" }, { hold: 900 });
      await t.point({ text: "Word", tag: "a, button" }, { hold: 900 });
    });

    await t.outro({ subtitle: "Adaptar a forma, sem mudar o que é avaliado" }, "Pronto! A versão adaptada fica guardada na aba Atividades do estudante.");
  },
};
