// Registrar como foi a aula (em três partes) e a frequência do AEE.
const NOTA = "Identificou o nome entre três opções, com pista visual. O tema dos dinossauros ajudou a manter o interesse.";

export default {
  id: "10-registrar-aula",
  title: "Registrar uma aula",
  audience: "Professores e equipe da escola",
  roles: ["professor_sala", "professor_aee", "apoio", "coordenacao"],
  summary: "Registrar como foi a aula e a frequência do AEE.",
  async setup(t) {
    await t.quietLogin("aee@escola.edu.br");
    await t.dismissWelcome();
    t.vars.student = await t.studentId("Dante");
    await t.goto(`/estudantes/${t.vars.student}`);
  },
  async run(t) {
    await t.intro({ title: "Registrar uma aula", subtitle: "Três partes rápidas, logo depois da aula", eyebrow: "Professores e equipe da escola" }, "Neste vídeo, você vai registrar como foi a aula e a frequência no AEE.");

    await t.say("No acompanhamento do estudante, abra a aba Registrar aula.", () => t.click({ text: "Registrar aula", in: "nav[aria-label='Seções do estudante']", tag: "a" }));
    await t.say("Primeiro, o que foi trabalhado: escolha o objetivo do plano, se houver.", async () => {
      const first = await t.page.$eval("#objectiveId", (select) => [...select.options].find((option) => option.value)?.value ?? "");
      if (first) await t.choose("#objectiveId", first);
      else await t.point("#objectiveId");
    });
    await t.poster();
    await t.say("Depois, como o estudante participou.", () => t.click({ text: "Participou de parte da atividade", tag: "label" }, { wait: false }));
    await t.say("E quanto apoio foi necessário.", () => t.choose("#supportLevel", "2"));
    await t.say("Por fim, o que aconteceu: o estudante conseguiu fazer o que se esperava?", () => t.click({ text: "Realizou uma parte", tag: "label" }, { wait: false }));
    await t.say("Conte o que você observou. Se o navegador permitir, você também pode falar em vez de digitar.", async () => {
      await t.point({ text: "Ditar texto", tag: "button" }, { hold: 600 });
      await t.type("#note", NOTA, { delay: 16 });
    });
    await t.say("Informe o seu papel e clique em Salvar registro.", async () => {
      await t.choose({ field: "Seu papel neste registro" }, "professor_aee");
      await t.click({ text: "Salvar registro", tag: "button" });
      await t.waitForText("O tema dos dinossauros ajudou", 20000).catch(() => {});
    });
    await t.say("O registro aparece em Registros anteriores e alimenta a evolução do apoio.", () => t.ring({ text: "Evolução do apoio", tag: "h2, h3", closest: "section" }, 2200));

    await t.say("A frequência no AEE fica na aba Atendimentos AEE, separada da aprendizagem.", () => t.click({ text: "Atendimentos AEE", in: "nav[aria-label='Seções do estudante']", tag: "a" }));
    await t.say("Confira a data e marque a situação: realizado, falta ou cancelamento.", async () => {
      await t.point("#aee-data", { hold: 600 });
      await t.click({ text: "Realizado", tag: "label" }, { wait: false });
    });
    await t.say("Clique em Registrar atendimento.", async () => {
      await t.click({ text: "Registrar atendimento", tag: "button" });
      await t.settle();
    });
    await t.say("O resumo mostra os atendimentos realizados, as faltas e os cancelamentos de cada mês.", () => t.ring({ text: "Atendimentos por mês", tag: "h2, h3", closest: "section, article, div[class*='rounded']" }, 2200));

    await t.outro({ subtitle: "Registrar o que aconteceu, sem relatório longo" }, "Pronto! Com os registros, a equipe acompanha o que está funcionando e ajusta o plano.");
  },
};
