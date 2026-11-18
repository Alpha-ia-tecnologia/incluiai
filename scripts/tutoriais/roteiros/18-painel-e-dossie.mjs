async function card(t, title) {
  const heading = await t.find({ text: title, tag: "h2, h3, p", in: "main" });
  return (await heading.evaluateHandle((el) => el.closest(".ui-card, section") ?? el.parentElement)).asElement();
}

// Item do menu lateral: o menu rola sozinho, e o gravador só espera a rolagem da
// página. Rola o menu antes e espera parar, para o clique cair no lugar certo.
async function menu(t, label) {
  const item = await t.find({ text: label, in: "nav" });
  await item.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  await t.pause(800);
  return t.click(item);
}

// Destaque com rolagem antes: o gravador pode medir o elemento antes de a rolagem
// suave começar, e o destaque fica fora do lugar. Rola, espera e só então destaca.
async function show(t, target, hold) {
  const element = await t.find(target);
  await element.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < 90 || rect.bottom > innerHeight - 120) el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  await t.pause(900);
  return t.ring(element, hold);
}

export default {
  id: "18-painel-e-dossie",
  title: "Painel de indicadores e dossiê",
  audience: "Coordenação e gestão",
  roles: ["coordenacao", "gestao"],
  summary: "Ver os números da escola, quem precisa de atenção e o que falta na documentação.",
  async setup(t) {
    await t.quietLogin("coordenacao");
    await t.dismissWelcome();
    await t.goto("/");
  },
  async run(t) {
    await t.intro({ title: "Painel e dossiê", subtitle: "Os números do acompanhamento e o que falta registrar", eyebrow: "Coordenação e gestão" }, "Neste vídeo, você vai acompanhar a escola pelo painel de indicadores e pelo dossiê de evidências.");

    await t.say("No menu, abra o Painel de indicadores.", () => menu(t, "Painel de indicadores"));
    await t.poster();
    await t.say("No alto, escolha o período. Por exemplo, os últimos 90 dias.", () => t.click({ text: "Últimos 90 dias", in: "main" }));
    await t.say("E, se quiser, uma escola só.", () => t.point({ field: "Escola" }, { hold: 1000 }));
    await t.say("As abas levam a cada assunto: estudantes, objetivos, aulas, atividades e família.", async () => {
      for (const tab of ["Estudantes", "Objetivos", "Aulas", "Atividades", "Família"]) await t.point({ text: tab, in: "main", tag: "a", exact: true }, { hold: 300, ring: false });
    });
    await t.say("A jornada do acompanhamento mostra quantos estudantes já passaram por cada etapa.", async () => show(t, await card(t, "Jornada do acompanhamento"), 2400));
    await t.say("O medidor em destaque também mostra a participação nas aulas e o critério de sucesso. É só trocar aqui.", async () => {
      await t.click({ text: "Participação", in: "main", tag: "a", exact: true });
    });
    await t.say("Para ver quem precisa de atenção, clique em Estudantes com avisos.", () => t.click({ text: "Estudantes com avisos", in: "main", tag: "a" }, { wait: false }));
    await t.settleScroll();
    await t.say("A tabela ordena os estudantes pelos avisos, com a situação do plano e o último registro.", async () => show(t, { css: "#atencao table" }, 2600));
    await t.say("Logo abaixo, os avisos somados: sem plano, revisão vencida e estudantes sem registro há mais de uma semana.", async () => show(t, await card(t, "Avisos em toda a rede"), 2600));

    await t.say("Agora, o dossiê. No menu, abra Dossiê de evidências.", () => menu(t, "Dossiê de evidências"));
    await t.say("Ele mostra, para cada estudante, se os registros pedidos pelas normas estão na plataforma.", () => show(t, { text: "Com pendências", tag: "p, h2, h3, div", in: "main" }, 2000));
    await t.say("O que mais falta aparece aqui, somado para a escola.", async () => show(t, await card(t, "O que mais falta"), 2200));
    await t.say("Para ver quem precisa de atenção, clique em Só com pendências.", () => t.click({ text: "Só com pendências", in: "main" }));
    await t.say("E abra um estudante para conferir item por item.", () => t.click({ text: "Ravi Almeida", in: "main", tag: "a" }));
    await t.say("Cada item diz se está em dia, se é para conferir ou se está pendente, e qual norma pede.", () => show(t, { text: "Pendente", in: "main", tag: "span, p, div", exact: true }, 2400));
    await t.say("O link leva direto ao registro, para completar o que falta.", () => t.point({ text: "Ver o registro", in: "main", tag: "a" }, { hold: 1200 }));

    await t.outro({ subtitle: "Os números e a documentação, num só lugar" }, "Pronto! Agora você já sabe ler o painel e usar o dossiê para completar o que falta.");
  },
};
