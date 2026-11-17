export default {
  id: "05-sondagem",
  title: "Sondagem",
  audience: "Professores e equipe da escola",
  roles: ["professor_sala", "professor_aee", "coordenacao"],
  summary: "Aplicar a linha de base e ler o apoio por área.",
  async setup(t) {
    await t.quietLogin("aee@escola.edu.br");
    await t.dismissWelcome();
    t.vars.student = await t.studentId("Dante");
    await t.goto(`/estudantes/${t.vars.student}`);
  },
  async run(t) {
    await t.intro({ title: "Sondagem", subtitle: "Linha de base e reavaliação, item por item", eyebrow: "Professores e equipe da escola" }, "Neste vídeo, você vai aplicar a sondagem e entender o resultado.");

    await t.say("No acompanhamento do estudante, abra a aba Sondagem.", () => t.click({ text: "Sondagem", in: "nav[aria-label='Seções do estudante']", tag: "a" }));
    await t.say("A primeira aplicação é a linha de base. Clique em Aplicar a linha de base.", () => t.click("Aplicar a linha de base"));

    await t.say("São itens que dá para observar, em seis áreas: da comunicação e linguagem até motor e sensorial.", () => t.ring({ text: "Comunicação e linguagem", tag: "h2, h3, legend" }, 1800));
    await t.say("Para cada item, escolha quanto apoio o estudante precisou. Zero é independente, e cinco é apoio físico total.", () => t.choose("#item-com-01", "2"));
    await t.say("Continue, item por item.", async () => {
      await t.choose("#item-com-02", "3");
      await t.choose("#item-com-04", "3");
    });
    await t.say("O que você ainda não viu, deixe como não observado. Não precisa responder tudo de uma vez.", () => t.point("#item-com-06", { hold: 1400 }));
    await t.say("Em leitura, escrita e matemática, o resultado aponta onde começar a planejar.", async () => {
      await t.choose("#item-le-01", "2");
      await t.choose("#item-le-04", "4");
      await t.choose("#item-ma-01", "3");
    });
    await t.say("No fim, registre uma observação, se quiser, e clique em Salvar a sondagem.", async () => {
      await t.type("#sondagem-notas", "Observado na sala comum e no AEE, ao longo de duas semanas.", { delay: 22 });
      await t.click({ text: "Salvar a sondagem", tag: "button" });
      await t.waitForText("Apoio por área");
    });
    await t.poster();

    await t.say("O resultado mostra o apoio médio em cada área.", () => t.ring({ text: "Apoio por área", tag: "h2, h3", closest: "section" }, 2000));
    await t.say("Mostra também a referência na BNCC para planejar, em leitura, escrita e matemática.", () => t.ring({ text: "Referência na BNCC para planejar", tag: "h2, h3", closest: "section" }, 2000));
    await t.say("E sugere objetivos com os itens que ainda pedem mais apoio. Daqui, você leva a sugestão para o plano.", async () => {
      await t.ring({ text: "Sugestões de objetivo", tag: "h2, h3", closest: "section" }, 1600);
      await t.point("Definir um objetivo no plano", { hold: 900 });
    });
    await t.say("A reavaliação acontece a cada revisão do plano e já começa com as respostas anteriores. Avançar é precisar de menos apoio.", () => t.point({ text: "Aplicações", tag: "h2, h3" }, { hold: 1200 }));

    await t.outro({ subtitle: "A sondagem não classifica o estudante: mostra o apoio" }, "Pronto! Agora você sabe aplicar a sondagem e usar o resultado para planejar.");
  },
};
