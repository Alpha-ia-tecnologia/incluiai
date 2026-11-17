export default {
  id: "09-materiais-de-apoio",
  title: "Materiais de apoio",
  audience: "Professores e equipe da escola",
  roles: ["professor_sala", "professor_aee", "apoio", "coordenacao"],
  summary: "Criar uma rotina visual ou história social, aprovar e imprimir.",
  async setup(t) {
    await t.quietLogin("aee@escola.edu.br");
    await t.dismissWelcome();
    t.vars.student = await t.studentId("Dante");
    await t.goto(`/estudantes/${t.vars.student}`);
  },
  async run(t) {
    await t.intro({ title: "Materiais de apoio", subtitle: "Rotinas visuais, histórias sociais e pranchas de comunicação", eyebrow: "Professores e equipe da escola" }, "Neste vídeo, você vai criar um material de apoio para o estudante e prepará-lo para imprimir.");

    await t.say("No acompanhamento do estudante, abra a aba Materiais de apoio.", async () => {
      await t.click({ css: "nav[aria-label='Seções do estudante'] a[href$='/materiais']" });
    });
    await t.say("Escolha o tipo de material: rotina visual, passo a passo, história social, prancha de comunicação e outros.", async () => {
      await t.scrollTo({ text: "Que material você quer criar?", tag: "legend" }, "start");
      await t.click({ text: "História social", tag: "label" }, { wait: false });
    });
    await t.say("Diga para qual situação ele vai servir.", () => t.choose({ field: "Para qual situação ou conteúdo" }, "Troca de sala ou de atividade"));
    await t.say("E onde o material será mais usado.", () => t.click({ text: "Sala comum", tag: "label" }, { wait: false }));
    await t.say("Clique em Criar material.", async () => {
      await t.click({ text: "Criar material", tag: "button" }, { wait: false });
      await t.waitForText("Material criado", 60000);
      await t.settle();
    });
    await t.poster();

    await t.say("O material abre inteiro: cada cartão com o texto e a descrição da imagem.", () => t.scrollBy(380));
    await t.say("Traz também atividades para aplicar, como usar e o porquê de cada adaptação.", async () => {
      await t.point({ text: "Atividades para aplicar", tag: "summary, h2, h3" }, { hold: 700 });
      await t.ring({ text: "Como usar", tag: "h3", closest: "section, article, div[class*='rounded']" }, 1400);
    });
    await t.say("O material fica como sugestão até você conferir e clicar em Aprovar para uso.", async () => {
      await t.click({ text: "Aprovar para uso", tag: "button" });
    });
    await t.say("Depois de aprovado, ele aparece no portal da família. E o botão Imprimir gera os cartões em papel.", () => t.point({ text: "Imprimir", tag: "a, button" }, { hold: 1400 }));

    await t.outro({ subtitle: "Materiais prontos para a sala, o AEE e a casa" }, "Pronto! Todos os materiais do estudante ficam guardados na aba Materiais de apoio.");
  },
};
