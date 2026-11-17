async function card(t, title) {
  const heading = await t.find({ text: title, tag: "h2, h3, p", in: "main" });
  return (await heading.evaluateHandle((el) => el.closest(".ui-card, section") ?? el.parentElement)).asElement();
}

// Item do menu lateral: rola o menu antes e espera parar (o gravador só espera a rolagem da página).
async function menu(t, label) {
  const item = await t.find({ text: label, in: "nav" });
  await item.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  await t.pause(800);
  return t.click(item);
}

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
  id: "20-secretaria-rede",
  title: "A rede em números",
  audience: "Secretaria de Educação",
  roles: ["secretaria"],
  summary: "Acompanhar a rede pelo painel, abrir a ficha de um estudante com motivo e conferir o Censo Escolar.",
  async setup(t) {
    await t.quietLogin("secretaria@municipio.gov.br");
    await t.dismissWelcome();
    await t.goto("/");
  },
  async run(t) {
    await t.intro({ title: "A rede em números", subtitle: "Painel da rede, ficha com motivo e Censo Escolar", eyebrow: "Secretaria de Educação" }, "Neste vídeo, você vai acompanhar a rede pelo painel, abrir a ficha de um estudante e conferir o Censo Escolar.");

    await t.say("O Início da Secretaria mostra a rede: estudantes, registros recentes e onde há avisos.", async () => show(t, await card(t, "Seu acompanhamento"), 2400));
    await t.say("No menu, abra o Painel de indicadores.", () => menu(t, "Painel de indicadores"));
    await t.poster();
    await t.say("O painel mostra a rede em números, sem nomes de estudantes.", () => show(t, { css: "main h1" }, 1800));
    await t.say("Para olhar uma escola, escolha a escola no campo e clique em Ver, ao lado.", async () => {
      await t.choose({ field: "Escola" }, "Paulo Freire");
      await t.click({ text: "Ver", in: "main", tag: "button", exact: true });
    });
    await t.say("Para voltar à rede inteira, escolha Toda a rede.", async () => {
      await t.choose({ field: "Escola" }, "Toda a rede");
      await t.click({ text: "Ver", in: "main", tag: "button", exact: true });
    });
    await t.say("Em Avisos por escola, você vê onde a rede precisa de apoio.", async () => {
      await t.click({ text: "Estudantes com avisos", in: "main", tag: "a" }, { wait: false });
      await t.settleScroll();
      await show(t, await card(t, "Avisos por escola"), 2400);
    });

    await t.say("Para consultar um estudante, abra Estudantes e digite pelo menos três letras do nome.", async () => {
      await menu(t, "Estudantes");
      await t.type({ field: "Nome do estudante" }, "rav", { delay: 140 });
    });
    await t.say("Clique no botão Buscar, e depois em Ver acompanhamento.", async () => {
      await t.click({ text: "Buscar", exact: true });
      await t.click({ text: "Ver acompanhamento", in: "main" });
      await t.waitForText("Motivo do acesso");
    });
    await t.say("Para abrir a ficha com nome, a Secretaria informa o motivo. O acesso vale por 8 horas, só para leitura.", async () => {
      const box = await t.find({ text: "O acesso vale por 8 horas", tag: "p", in: "main" });
      await show(t, (await box.evaluateHandle((el) => el.closest("div.rounded-2xl, section, aside") ?? el.parentElement)).asElement(), 2200);
    });
    await t.say("Escolha o motivo.", () => t.choose({ field: "Motivo do acesso" }, "Transferência entre escolas"));
    await t.say("E escreva o que precisa ver, e por quê. A família vê este texto no histórico de acessos.", () => t.type({ field: "O que você precisa ver" }, "Conferir o plano de ensino para a transferência de escola.", { delay: 30 }));
    await t.say("Clique em Registrar o motivo e abrir a ficha.", async () => {
      await t.click({ text: "Registrar o motivo e abrir a ficha" });
      await t.page.waitForFunction(() => location.pathname.startsWith("/estudantes/"), { timeout: 15000 });
      await t.settle();
    });
    await t.say("A ficha abre só para leitura, e o acesso fica registrado.", () => show(t, { css: "main h1" }, 2000));

    await t.say("Por fim, o Censo Escolar.", () => menu(t, "Censo Escolar"));
    await t.say("A escola exporta o arquivo do Educacenso e envia aqui. A plataforma concilia o cadastro e confere a dupla matrícula.", async () => {
      for (const step of ["Escola exporta do Educacenso", "Envia o arquivo aqui", "Plataforma concilia o cadastro", "Confere a dupla matrícula"]) await t.point({ text: step, in: "main", tag: "li, span, div, p" }, { hold: 500 });
    });
    await t.say("Na janela do Censo, a plataforma verifica as escolas sozinha. A Secretaria ajusta as datas aqui.", () => t.point({ text: "Configurar a janela do Censo", in: "main" }, { hold: 1200 }));
    await t.say("Mais abaixo, as contagens da rede e a situação de cada escola.", async () => {
      await show(t, await card(t, "Contagens da rede"), 1600);
      await t.scrollTo({ text: "Escolas", tag: "h2, h3", in: "main", exact: true }, "start");
      await t.pause(1200);
    });

    await t.outro({ subtitle: "Números da rede, acesso com motivo e Censo" }, "Pronto! Agora você já sabe acompanhar a rede, abrir uma ficha com motivo e conferir o Censo Escolar.");
  },
};
