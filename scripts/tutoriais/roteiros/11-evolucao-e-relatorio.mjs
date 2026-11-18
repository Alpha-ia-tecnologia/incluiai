const TABS = "nav[aria-label='Seções do estudante']";

// As abas rolam de lado: traz a aba para a vista antes de clicar.
async function openTab(t, name) {
  const tab = await t.find({ text: name, in: TABS, tag: "a", exact: true });
  await t.scrollTop();
  await tab.evaluate((el) => el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }));
  await t.pause(700);
  await t.click(tab);
}

export default {
  id: "11-evolucao-e-relatorio",
  title: "Evolução, relatório e dossiê",
  audience: "Professores do AEE e coordenação",
  roles: ["professor_aee", "coordenacao", "gestao"],
  summary: "Ver a evolução, validar o relatório do período para a família e conferir o dossiê.",
  async setup(t) {
    await t.quietLogin("professor_aee");
    await t.dismissWelcome();
    t.vars.dante = await t.studentId("Dante");
    await t.goto(`/estudantes/${t.vars.dante}`);
  },
  async run(t) {
    await t.intro({ title: "Evolução, relatório e dossiê", subtitle: "Ver o que mudou e prestar contas à família", eyebrow: "Professores do AEE e coordenação" }, "Neste vídeo, você vai ver a evolução do estudante, montar o relatório do período e conferir o dossiê.");

    await t.say("No resumo do estudante, clique em Ver evolução.", () => t.click({ text: "Ver evolução", in: "ol[aria-label='Etapas do acompanhamento']", tag: "a" }));
    await t.say("O gráfico mostra quantos acontecimentos houve em cada mês.", () => t.ring({ css: "section[aria-label='Eventos por mês']" }, 1800));
    await t.say("Mais abaixo, cada acontecimento aparece no seu mês: aulas registradas, reuniões e o plano.", async () => {
      const month = await t.find({ css: "section[aria-labelledby^='mes-'] ol" });
      await t.scrollTo(month, "center");
      await t.ring(month, 2000);
    });

    await t.say("Para a devolutiva à família, abra a aba Relatórios.", () => openTab(t, "Relatórios"));
    await t.say("Escolha o período. O semestre atual já vem preenchido.", () => t.ring({ css: "#relatorio-inicio" }, 1500));
    await t.say("Clique em Montar o relatório do período. A plataforma junta os registros, sem inteligência artificial.", async () => {
      await t.click("Montar o relatório do período");
      await t.waitForText("Parecer da equipe");
    });
    await t.poster();
    await t.say("O relatório traz quem é o estudante, os objetivos do plano e o que funcionou nas aulas.", async () => {
      await t.ring({ text: "Objetivos do plano de ensino", tag: "h3" }, 1300);
      await t.ring({ text: "O que funcionou e o que foi usado", tag: "h3" }, 1300);
    });
    await t.say("No fim, a plataforma escreve um rascunho do parecer. Leia e corrija o que for preciso.", () => t.ring("#relatorio-parecer-texto", 2200));
    await t.say("Complete o trecho entre colchetes com o que a equipe combinou.", async () => {
      const box = await t.click("#relatorio-parecer-texto", { wait: false });
      await box.evaluate((el) => {
        const start = el.value.indexOf("[");
        el.setSelectionRange(start, el.value.indexOf("]", start) + 1);
      });
      await t.pause(700);
      await t.page.keyboard.type("retomar o nome entre três opções e levar a prancha para a sala comum.", { delay: 28 });
    });
    await t.say("Depois, clique em Validar e publicar para a família. Quem valida é o AEE ou a coordenação.", async () => {
      await t.click("Validar e publicar para a família");
      await t.waitForText("Validado por");
    });
    await t.say("Validado, o relatório não muda mais e aparece no portal da família.", () => t.ring({ text: "Validado por", tag: "span" }, 2000));
    await t.say("O botão Imprimir ou salvar em PDF gera a versão para entregar em papel.", () => t.point("Imprimir ou salvar em PDF", { hold: 1200 }));

    await t.say("Agora, abra a aba Dossiê.", () => openTab(t, "Dossiê"));
    await t.say("O dossiê mostra, item por item, o que a legislação pede e onde está cada registro.", () => t.ring({ text: "Dossiê de evidências", tag: "h2" }, 1600));
    await t.say("Cada item aparece como em dia, para conferir, ou pendente.", async () => {
      for (const label of ["Em dia", "Para conferir", "Pendentes"]) await t.point({ text: label, tag: "article", exact: false, in: "main" }, { hold: 500 });
    });
    await t.say("Um item pendente leva direto ao que falta registrar. Aqui, os atendimentos do AEE.", async () => {
      const item = await t.find({ text: "Nenhum atendimento registrado", tag: "li" });
      await t.ring(item, 1400);
      await t.point(await item.$("a"), { hold: 800 });
    });

    await t.outro({ subtitle: "Evolução, relatório validado e dossiê em dia" }, "Pronto! Agora você já sabe acompanhar a evolução, validar o relatório do período e conferir o dossiê.");
  },
};
