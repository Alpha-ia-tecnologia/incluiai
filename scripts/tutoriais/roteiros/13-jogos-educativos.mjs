const MEMORY_CARDS = "section[aria-label^='Partida'] button[aria-label^='Carta ']";

async function readCards(t) {
  return t.page.$$eval(MEMORY_CARDS, (cards) => cards.map((card, index) => ({ index, label: card.getAttribute("aria-label").replace(/^Carta \d+, /, "").replace(/, par encontrado$/, "") })));
}

export default {
  id: "13-jogos-educativos",
  title: "Jogos educativos",
  audience: "Professores e AEE",
  roles: ["professor_sala", "professor_aee", "apoio", "coordenacao"],
  summary: "Jogar com o estudante e registrar a aula no fim do jogo.",
  async setup(t) {
    await t.quietLogin("aee@escola.edu.br");
    await t.dismissWelcome();
    await t.goto("/jogos");
  },
  async run(t) {
    await t.intro({ title: "Jogos educativos", subtitle: "Jogar com o estudante e registrar a aula", eyebrow: "Professores e AEE" }, "Neste vídeo, você vai jogar com um estudante e registrar a aula no fim do jogo.");

    await t.say("Em Jogos educativos, escolha com quem vai jogar.", () => t.choose("#jogo-estudante", "Dante Oliveira"));
    await t.say("O nível já vem sugerido pelo jeito como o estudante aprende. Você pode trocar quando quiser.", async () => {
      await t.ring({ css: "fieldset" }, 1600);
      await t.click({ text: "Fácil", in: "fieldset", tag: "label" }, { wait: false });
    });
    await t.poster();

    await t.say("Os filtros mostram os jogos de cada habilidade.", async () => {
      await t.scrollTo({ css: "[aria-label='Filtrar jogos por habilidade']" }, "start");
      await t.click({ text: "Memória", in: "[aria-label='Filtrar jogos por habilidade']", exact: true }, { wait: false });
    });
    await t.say("Escolha um jogo e clique em Vamos jogar.", () => t.click({ css: "#play-memoria" }, { wait: false }));
    await t.pause(500);

    await t.say("A instrução aparece na tela, e também pode ser ouvida.", () => t.point("Ouvir instrução", { hold: 900 }));
    let cards = [];
    await t.say("Se o estudante precisar, use uma pista: as cartas aparecem por um instante.", async () => {
      await t.click("Ver uma pista", { wait: false });
      cards = await readCards(t);
      await t.pause(1500);
      await t.click("Esconder pista", { wait: false });
    });

    const pairs = new Map();
    for (const card of cards) pairs.set(card.label, [...(pairs.get(card.label) ?? []), card.index]);
    await t.say("Agora é a vez do estudante: duas cartas por vez, até achar todos os pares.", async () => {
      for (const [first, second] of pairs.values()) {
        await t.click({ css: MEMORY_CARDS, nth: first }, { wait: false });
        await t.pause(350);
        await t.click({ css: MEMORY_CARDS, nth: second }, { wait: false });
        await t.pause(700);
      }
    });
    await t.say("Errar não diminui os pontos. Quando terminar, clique em Concluir partida.", () => t.click("Concluir partida", { wait: false }));
    await t.pause(500);

    await t.say("No fim, o registro da aula já vem com as pistas e as tentativas anotadas.", async () => {
      await t.scrollTo({ text: "Registrar a aula de", tag: "h2" }, "start");
      await t.ring({ css: "#jogo-nota" }, 1800);
    });
    await t.say("Confira a participação e o apoio, e clique em Registrar a aula.", () => t.click({ text: "Registrar a aula", tag: "button", exact: true }));
    await t.say("A aula já aparece nos registros e na evolução do estudante.", async () => {
      await t.waitForText("Aula registrada");
      await t.ring({ text: "Aula registrada", tag: "p" }, 1800);
    });

    await t.say("Mais abaixo, na página dos jogos, fica a prancha de comunicação.", async () => {
      await t.click("Escolher outro jogo", { wait: false });
      await t.pause(400);
      await t.scrollTo("#open-communication");
      await t.click("#open-communication", { wait: false });
    });
    await t.say("O estudante escolhe o começo da frase e uma imagem para completar.", async () => {
      await t.click({ text: "Eu gosto de", in: "[aria-label='Começo da frase']" }, { wait: false });
      await t.click({ css: "button[aria-label='Escolher Bola']" }, { wait: false });
      await t.scrollTo("#communication-phrase");
      await t.ring("#communication-phrase", 1500);
    });

    await t.outro({ subtitle: "Jogar, conferir e registrar a aula" }, "Pronto! Agora você já sabe jogar com o estudante e registrar a aula no fim do jogo.");
  },
};
