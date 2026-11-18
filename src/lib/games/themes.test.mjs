import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUTINES, ROUTINE_KEYS, THEME_KEYS, fullScreenSession, suggestedLevel, themeFromInterests, themePics } from "./themes.ts";
import { LEVELS, gameById, gameNote, suggestedRecord } from "./registry.ts";

function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("todo tema tem figuras para o desafio da memória (6 pares) e nomes únicos", () => {
  for (const theme of THEME_KEYS) {
    const pics = themePics(theme);
    assert.ok(pics.length >= 6, theme);
    assert.equal(new Set(pics.map((p) => p.key)).size, pics.length, theme);
  }
});

const session = (game, choices, seed) => fullScreenSession(game, { theme: "animais", ...choices }, seeded(seed)).data;

test("memória: dois de cada figura; 2, 4 e 6 pares por nível", () => {
  for (const [level, pairs] of Object.entries({ facil: 2, medio: 4, desafio: 6 })) {
    const { deck } = session("memoria", { level }, 7);
    assert.equal(deck.length, pairs * 2);
    assert.equal(new Set(deck.map((card) => card.id)).size, deck.length);
    const counts = new Map();
    for (const card of deck) counts.set(card.key, (counts.get(card.key) ?? 0) + 1);
    assert.ok([...counts.values()].every((n) => n === 2));
  }
});

test("rotinas: etapas na ordem da rotina, 3 no fácil, 4 no médio, todas no desafio, e a ordem do jogo vem embaralhada", () => {
  for (const key of ROUTINE_KEYS) {
    const all = ROUTINES[key].steps.map((s) => s.key);
    for (const [level, count] of Object.entries({ facil: 3, medio: 4, desafio: all.length })) {
      const { steps, order } = session("sequencia", { level, routine: key }, 9);
      const indexes = steps.map((s) => all.indexOf(s.key));
      assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b), `${key} ${level}`);
      assert.equal(new Set(indexes).size, count, `${key} ${level}`);
      assert.deepEqual([...order].sort((a, b) => a - b), steps.map((_, index) => index));
      assert.ok(order.some((value, index) => value !== index), `${key} ${level}: já na ordem`);
    }
  }
});

test("associação por palavra: 5 rodadas, 2, 3 e 4 opções por nível, a resposta entre elas, sem alvo repetido em seguida", () => {
  for (const [level, options] of Object.entries({ facil: 2, medio: 3, desafio: 4 })) {
    const { rounds } = session("associacao", { level, theme: "transportes", mode: "palavra" }, 3);
    assert.equal(rounds.length, 5);
    for (const round of rounds) {
      assert.equal(round.options.length, options);
      assert.ok(round.options.includes(round.answer));
      assert.equal(new Set(round.options).size, round.options.length);
    }
    rounds.slice(1).forEach((round, i) => assert.notEqual(round.pic.key, rounds[i].pic.key));
  }
});

test("associação por quantidade: até 3, 5 e 9 por nível, opções em ordem", () => {
  for (const [level, [max, options]] of Object.entries({ facil: [3, 2], medio: [5, 3], desafio: [9, 4] })) {
    const { rounds } = session("associacao", { level, theme: "alimentos", mode: "quantidade" }, 11);
    assert.equal(rounds.length, 5);
    for (const round of rounds) {
      assert.ok(round.count >= 1 && round.count <= max);
      assert.equal(round.answer, String(round.count));
      assert.equal(round.options.length, options);
      assert.deepEqual(round.options, [...round.options].sort((a, b) => Number(a) - Number(b)));
    }
  }
});

test("emoções: só situações das emoções do nível, opções sempre na mesma ordem, sem dizer quem é a criança", () => {
  const OPTIONS = { facil: ["feliz", "triste"], medio: ["feliz", "triste", "bravo"], desafio: ["feliz", "triste", "bravo", "medo"] };
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { rounds } = session("emocoes", { level }, seed);
      assert.equal(rounds.length, 5);
      for (const round of rounds) {
        assert.deepEqual(round.options, OPTIONS[level]);
        assert.ok(round.options.includes(round.answer));
        assert.doesNotMatch(round.text, /\b(ele|ela|menino|menina)\b/i);
      }
    }
  }
});

test("tema pelos interesses e nível pelo apoio", () => {
  assert.equal(themeFromInterests(["dinossauros", "quebra-cabeças"]), "animais");
  assert.equal(themeFromInterests(["Ônibus e trens"]), "transportes");
  assert.equal(themeFromInterests(["vídeos de vulcões"]), "natureza");
  assert.equal(themeFromInterests(["dinossauros", "quebra-cabeças", "vídeos de vulcões"]), "animais");
  assert.equal(themeFromInterests([]), "animais");
  assert.equal(suggestedLevel(null), "facil");
  assert.equal(suggestedLevel({ readingSupport: 4, mathSupport: 4, organization: 3 }), "facil");
  assert.equal(suggestedLevel({ readingSupport: 2, mathSupport: 3, organization: 2 }), "medio");
  assert.equal(suggestedLevel({ readingSupport: 0, mathSupport: 1, organization: 1 }), "desafio");
});

test("fim do jogo: nota curta e registro sugerido para o professor conferir", () => {
  assert.equal(gameNote(gameById("memoria"), "facil", "Animais", { done: 2, total: 2, hints: 1, retries: 0 }), "Jogo: Memória por temas (fácil, Animais). 2 de 2 pares · 1 dica.");
  assert.equal(gameNote(gameById("emocoes"), "medio", null, { done: 5, total: 5, hints: 0, retries: 2 }), "Jogo: Emoções (médio). 5 de 5 rodadas · sem dica · 2 tentativas a mais.");
  assert.equal(gameNote(gameById("contar"), "desafio", null, { done: 5, total: 5, hints: 2, retries: 1 }), "Jogo: Vamos contar (desafio). 5 de 5 rodadas · 2 dicas · 1 tentativa a mais.");
  assert.equal(gameNote(gameById("rotina"), "facil", null, { done: 3, total: 3, hints: 0, retries: 0 }), "Jogo: Minha rotina em passos (fácil). 3 de 3 passos · sem dica.");
  assert.deepEqual(suggestedRecord({ done: 5, total: 5, hints: 0, retries: 0 }), { participation: "total", criterionMet: "sim", supportLevel: 1 });
  assert.deepEqual(suggestedRecord({ done: 5, total: 5, hints: 2, retries: 3 }), { participation: "total", criterionMet: "parcial", supportLevel: 2 });
  assert.deepEqual(suggestedRecord({ done: 2, total: 5, hints: 4, retries: 1 }), { participation: "parcial", criterionMet: "nao", supportLevel: 3 });
});
