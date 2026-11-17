async function option(t, group, label) {
  const handle = await t.page.evaluateHandle((group, label) => {
    const norm = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const title = [...document.querySelectorAll("legend, p, h3, span")].find((el) => norm(el.textContent).startsWith(group));
    const box = title?.closest("fieldset") ?? title?.parentElement;
    return [...(box?.querySelectorAll("label, button") ?? [])].find((el) => norm(el.textContent) === label) ?? null;
  }, group, label);
  const element = handle.asElement();
  if (!element) throw new Error(`Opção não encontrada: ${group} › ${label}`);
  return element;
}

async function pick(t, group, labels) {
  for (const label of labels) await t.click(await option(t, group, label), { wait: false });
}

export default {
  id: "17-orientacoes-do-terapeuta",
  title: "Orientações do terapeuta",
  audience: "Terapeutas da rede de saúde",
  roles: ["terapeuta"],
  summary: "Conhecer o contexto escolar e enviar orientações para a escola.",
  async setup(t) {
    await t.quietLogin("terapeuta@clinica.com.br");
    await t.goto("/terapeuta");
  },
  async run(t) {
    await t.intro({ title: "Orientações para a escola", subtitle: "Compartilhar o que ajuda o estudante a participar", eyebrow: "Terapeutas" }, "Neste vídeo, você vai ver como enviar orientações para a escola do seu paciente.");

    await t.say("Ao entrar, você vê o espaço de orientações para a escola. Os registros clínicos continuam no sistema de saúde.", () => t.ring({ css: "main h1" }, 2200));
    await t.say("Você só acessa o estudante quando a família autoriza a conexão.", () => t.ring({ text: "Boas-vindas", tag: "h2" }, 1800));
    await t.say("Para ver a página inteira, clique em Agora não.", () => t.click({ text: "Agora não", exact: true }));
    await t.say("Aqui está o estudante que você acompanha, com o que a escola compartilhou: comunicação e interesses.", async () => {
      const box = await t.find({ text: "Estudante acompanhado", tag: "h2, h3, p", in: "main" });
      await t.ring((await box.evaluateHandle((el) => el.closest(".ui-card") ?? el.parentElement)).asElement(), 2400);
    });
    await t.poster();

    await t.say("Para enviar orientações, preencha o novo relatório. Os itens com asterisco são obrigatórios.", () => t.ring({ text: "Novo relatório de articulação", tag: "h2, h3, p" }, 1800));
    await t.say("Em cada grupo, clique nas opções que valem para o estudante. Primeiro, como ele se comunica melhor.", () => pick(t, "Formas de comunicação", ["Prancha de comunicação (CAA)", "Gestos e apontar"]));
    await t.say("Os recursos que ajudam.", () => pick(t, "Recursos de acessibilidade", ["Cartões com imagens", "Fone abafador"]));
    await t.say("O que facilita a participação.", () => pick(t, "Fatores que facilitam", ["Rotina previsível", "Tema de interesse"]));
    await t.say("Estratégias que a escola pode testar.", () => pick(t, "Estratégias que podem", ["Antecipar transições com 2 minutos de aviso"]));
    await t.say("Orientações para o dia a dia da escola.", () => pick(t, "Orientações aplicáveis", ["Manter a prancha sempre ao alcance"]));
    await t.say("E os objetivos em comum com a família. Se faltar uma opção, escolha Outro e escreva.", async () => {
      await pick(t, "Objetivos compartilhados", ["Pedir ajuda usando a prancha"]);
      await t.point(await option(t, "Objetivos compartilhados", "Outro"), { hold: 800 });
    });
    await t.say("Confira e clique em Enviar para a equipe escolar.", async () => {
      await t.click({ text: "Enviar para a equipe escolar" });
      await t.settle();
    });
    await t.say("O relatório aparece em Relatórios enviados. A equipe do AEE e a coordenação recebem um aviso.", async () => {
      const sent = await t.find({ text: "Relatórios enviados", tag: "h2, h3, p", in: "main", nth: 1 }).catch(() => t.find({ text: "Relatórios enviados", tag: "h2, h3, p", in: "main" }));
      await t.ring((await sent.evaluateHandle((el) => el.parentElement)).asElement(), 2400);
    });
    await t.scrollTop();
    await t.say("No alto, você também vê quando a escola recebeu.", () => t.ring({ text: "A escola recebeu", tag: "p, h2, h3, span", in: "main" }, 2000));

    await t.outro({ subtitle: "Orientações práticas, com a autorização da família" }, "Pronto! Agora você já sabe enviar orientações para a escola e acompanhar quando elas chegam.");
  },
};
