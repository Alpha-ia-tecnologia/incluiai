import { rolesWith } from "../../../src/lib/roles.ts";

// A janela de impressão do navegador não aparece na gravação.
async function printPreview(t, button, narration) {
  await t.page.evaluate(() => { window.print = () => {}; });
  await t.say(narration, async () => {
    await t.click(button, { wait: false });
    await t.pause(700);
    await t.page.emulateMediaType("print");
    await t.page.evaluate(() => window.scrollTo(0, 0));
    await t.pause(2600);
  });
  await t.page.emulateMediaType("screen");
  await t.page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await t.pause(300);
}

async function sectionOf(t, title) {
  const handle = await t.page.evaluateHandle((title) => [...document.querySelectorAll("main h2, main h3")].find((h) => h.textContent.includes(title))?.parentElement ?? null, title);
  const element = handle.asElement();
  if (!element) throw new Error(`Seção não encontrada: ${title}`);
  return element;
}

export default {
  id: "14-recursos-e-calendario",
  title: "Banco de recursos e calendário",
  audience: "Professores e equipe da escola",
  roles: rolesWith("pedagogical"),
  summary: "Achar uma proposta pronta, imprimir o material e ver as datas inclusivas.",
  async setup(t) {
    await t.quietLogin("professor_sala");
    await t.dismissWelcome();
    await t.goto("/");
  },
  async run(t) {
    await t.intro({ title: "Banco de recursos e calendário", subtitle: "Propostas prontas e datas para a turma", eyebrow: "Professores e equipe da escola" }, "Neste vídeo, você vai encontrar uma proposta pronta no banco de recursos e conhecer o calendário inclusivo.");

    await t.say("No menu, abra Atividades e recursos.", () => t.click({ text: "Atividades e recursos", in: "nav" }));
    await t.say("Busque por título, habilidade ou acessibilidade. Também dá para filtrar por etapa e tipo.", async () => {
      await t.type("#q", "rotina", { delay: 110 });
      await t.point("#etapa", { hold: 500, ring: false });
      await t.point("#tipo", { hold: 500, ring: false });
    });
    await t.say("Clique em Filtrar.", () => t.click({ text: "Filtrar", exact: true }));
    await t.say("Clique no recurso para abrir.", () => t.click({ text: "Rotina visual de chegada", in: "main", tag: "a" }));

    await t.say("Cada recurso mostra uma fotografia dos materiais e o que preparar antes de começar.", () => t.ring({ text: "Antes de começar", tag: "h2, h3, p, div" }, 2000));
    await t.poster();
    await t.say("Mais abaixo, ajuste o apoio à participação. São três níveis: do apoio mais próximo até mais autonomia.", async () => {
      await t.ring(await sectionOf(t, "Ajuste o apoio à participação"), 2200);
    });
    await t.say("Logo abaixo, as atividades prontas: objetivo, materiais, como aplicar e o que observar.", async () => {
      await t.scrollTo({ text: "Atividades correspondentes", tag: "h2, h3" }, "start");
      await t.pause(800);
      await t.scrollBy(260);
    });
    await printPreview(t, { text: "Imprimir atividade completa", nth: 0 }, "Para imprimir, escolha a atividade completa ou só o material. A folha sai pronta para a aula.");
    await t.say("Depois de aplicar, conte se a atividade teve boa resposta. Isso ajuda toda a rede.", () => t.point({ text: "Teve boa resposta", nth: 0 }, { hold: 1200 }));

    await t.say("Agora, no menu, abra o Calendário inclusivo.", () => t.click({ text: "Calendário inclusivo", in: "nav" }));
    await t.say("Ele mostra as datas da educação inclusiva de cada mês.", () => t.ring({ css: "main table" }, 1800));
    await t.say("Clique numa data para ver o que ela lembra.", () => t.click({ css: "main a[href^='#evento-']" }, { wait: false }));
    await t.say("Cada data traz uma ideia de atividade para toda a turma, e a referência da lei.", async () => t.ring(await t.page.evaluateHandle(() => [...document.querySelectorAll("main p")].find((p) => p.textContent.includes("Ideia para a turma")).parentElement), 2200));
    await t.say("Use as setas para ver os outros meses. Também dá para escolher um tema.", async () => {
      await t.click({ css: "main a[aria-label^='Próximo mês']" });
      await t.point({ text: "Deficiência visual", in: "main", tag: "a" }, { hold: 900 });
    });

    await t.outro({ subtitle: "Propostas prontas e datas para toda a turma" }, "Pronto! Agora você já sabe usar o banco de recursos e o calendário inclusivo.");
  },
};
