export default {
  id: "03-estudo-de-caso",
  title: "Estudo de caso",
  audience: "Professores do AEE e coordenação",
  roles: ["professor_aee", "coordenacao"],
  summary: "As sete partes do estudo, como editar, salvar e imprimir.",
  async setup(t) {
    await t.quietLogin("aee@escola.edu.br");
    await t.dismissWelcome();
    t.vars.student = await t.studentId("Dante");
    await t.goto(`/estudantes/${t.vars.student}`);
  },
  async run(t) {
    await t.intro({ title: "Estudo de caso", subtitle: "O ponto de partida do AEE, sem depender de laudo", eyebrow: "Professores do AEE e coordenação" }, "Neste vídeo, você vai ver como registrar e atualizar o estudo de caso de um estudante.");

    await t.say("No acompanhamento do estudante, abra a aba Estudo de caso.", () => t.click({ text: "Estudo de caso", in: "nav[aria-label='Seções do estudante']", tag: "a" }));
    await t.say("Com o estudo concluído, a síntese do caso aparece logo no início.", () => t.ring({ text: "Síntese do caso", tag: "p, h2, h3", closest: "section, article, [class*='rounded-2xl']" }, 2000));
    await t.say("Para registrar ou atualizar, clique em Editar estudo de caso.", () => t.click("Editar estudo de caso"));
    await t.poster();

    await t.say("O estudo tem sete partes. O quadro ao lado mostra quanto de cada parte já foi respondido.", () => t.ring({ text: "Partes do estudo", tag: "h2, h3, p", closest: "aside, nav, section, div:has(> ol)" }, 2400));
    await t.say("Em cada parte, marque as opções que combinam com o estudante. Escreva só o que as opções não cobrem.", async () => {
      await t.scrollTo({ text: "Motivos do encaminhamento", tag: "legend, h2, h3" }, "start");
      await t.point({ text: "Dificuldade de comunicação", tag: "label" }, { hold: 700 });
      await t.point({ text: "Outro", tag: "button" }, { hold: 700 });
    });
    await t.say("A escuta do estudante registra o que ele mesmo conta, do jeito que se comunica.", async () => {
      await t.scrollTo({ text: "O que mais gosta na escola", tag: "legend, h2, h3" }, "center");
      await t.click({ text: "Ouvir histórias", tag: "label" }, { wait: false });
    });
    await t.say("Diagnóstico e saúde são opcionais. Esses dados ficam visíveis só para o AEE e a coordenação.", () => t.ring({ text: "Diagnóstico informado pela família", tag: "legend, h2, h3" }, 2200));
    await t.say("No fim, escreva a síntese do caso e combine quando reavaliar.", async () => {
      await t.ring("#sintese", 1600);
      await t.point({ field: "Quando reavaliar o caso" }, { hold: 600 });
    });
    await t.say("Clique em Salvar alterações. Você pode salvar e continuar depois.", async () => {
      await t.click({ text: "Salvar alterações", exact: true });
      await t.waitForText("Editar estudo de caso");
      await t.settle();
    });
    await t.scrollTop();
    await t.say("O botão Imprimir relatório gera o documento para a reunião com a equipe e a família.", () => t.point("Imprimir relatório", { hold: 1000 }));
    await t.say("Se a família entregar um laudo, você pode anexá-lo aqui. É opcional: o AEE não depende de laudo.", () => t.point("Anexar laudo", { hold: 1200 }));

    await t.outro({ subtitle: "Ouvir, observar e decidir os apoios" }, "Pronto! Com o estudo de caso feito, o próximo passo é registrar como o estudante aprende.");
  },
};
