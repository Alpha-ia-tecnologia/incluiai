// Testes dos jogos educativos: node --test src/lib/games/games-core.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMOTION_OPTIONS, MEMORY_PAIRS, OPTION_COUNT, QUANTITY_MAX, ROUNDS, ROUTINES, ROUTINE_KEYS, SITUATIONS, THEME_KEYS,
  emotionRounds, gameNote, memoryDeck, photoLevel, quantityRounds, routineSteps, sessionNote, shuffle, suggestedLevel, suggestedRecord, themeFromInterests, themePics, wordRounds,
} from "./games-core.ts";

// Sorteio repetível (mulberry32).
function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("embaralhar não perde nem repete itens", () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const out = shuffle(items, seeded(1));
  assert.deepEqual([...out].sort((a, b) => a - b), items);
  assert.notDeepEqual(out, items);
});

test("todo tema tem figuras para o desafio da memória (6 pares) e nomes únicos", () => {
  for (const theme of THEME_KEYS) {
    const pics = themePics(theme);
    assert.ok(pics.length >= 6, theme);
    assert.equal(new Set(pics.map((p) => p.key)).size, pics.length, theme);
  }
});

test("memória: dois de cada figura, quantidade pelo nível", () => {
  for (const [level, pairs] of Object.entries(MEMORY_PAIRS)) {
    const deck = memoryDeck("animais", level, seeded(7));
    assert.equal(deck.length, pairs * 2);
    assert.equal(new Set(deck.map((card) => card.id)).size, deck.length);
    const counts = new Map();
    for (const card of deck) counts.set(card.pic.key, (counts.get(card.pic.key) ?? 0) + 1);
    assert.ok([...counts.values()].every((n) => n === 2));
  }
});

test("rotinas: etapas na ordem da rotina, 3 no fácil, 4 no médio, todas no desafio", () => {
  for (const key of ROUTINE_KEYS) {
    const all = ROUTINES[key].steps.map((s) => s.key);
    for (const level of ["facil", "medio", "desafio"]) {
      const steps = routineSteps(key, level).map((s) => s.key);
      const indexes = steps.map((s) => all.indexOf(s));
      assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b), `${key} ${level}`);
      assert.equal(new Set(steps).size, steps.length);
    }
    assert.equal(routineSteps(key, "facil").length, 3);
    assert.equal(routineSteps(key, "medio").length, 4);
    assert.equal(routineSteps(key, "desafio").length, all.length);
  }
});

test("associação por palavra: 5 rodadas, opções pelo nível, a resposta entre elas, sem alvo repetido em seguida", () => {
  for (const level of ["facil", "medio", "desafio"]) {
    const rounds = wordRounds("transportes", level, seeded(3));
    assert.equal(rounds.length, ROUNDS);
    for (const round of rounds) {
      assert.equal(round.options.length, OPTION_COUNT[level]);
      assert.ok(round.options.includes(round.answer));
      assert.equal(new Set(round.options).size, round.options.length);
    }
    rounds.slice(1).forEach((round, i) => assert.notEqual(round.pic.key, rounds[i].pic.key));
  }
});

test("associação por quantidade: número dentro do limite do nível, opções em ordem", () => {
  for (const level of ["facil", "medio", "desafio"]) {
    for (const round of quantityRounds("alimentos", level, seeded(11))) {
      assert.ok(round.count >= 1 && round.count <= QUANTITY_MAX[level]);
      assert.equal(round.answer, String(round.count));
      assert.equal(round.options.length, OPTION_COUNT[level]);
      assert.deepEqual(round.options, [...round.options].sort((a, b) => Number(a) - Number(b)));
    }
  }
});

test("emoções: só situações das emoções do nível, opções sempre na mesma ordem", () => {
  assert.ok(SITUATIONS.every((s) => !/\b(ele|ela|menino|menina)\b/i.test(s.text)));
  for (const level of ["facil", "medio", "desafio"]) {
    const rounds = emotionRounds(level, seeded(5));
    assert.equal(rounds.length, ROUNDS);
    for (const round of rounds) {
      assert.deepEqual(round.options, EMOTION_OPTIONS[level]);
      assert.ok(round.options.includes(round.answer));
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
  assert.equal(sessionNote("memoria", "facil", "Animais", { done: 2, total: 2, hints: 1, retries: 0 }), "Jogo: Memória por temas (fácil, Animais). 2 de 2 pares · 1 dica.");
  assert.equal(sessionNote("emocoes", "medio", null, { done: 5, total: 5, hints: 0, retries: 2 }), "Jogo: Emoções (médio). 5 de 5 rodadas · sem dica · 2 tentativas a mais.");
  assert.equal(gameNote("Vamos contar", "desafio", null, { done: 5, total: 5, hints: 2, retries: 1 }, "rodadas"), "Jogo: Vamos contar (desafio). 5 de 5 rodadas · 2 dicas · 1 tentativa a mais.");
  assert.deepEqual(["facil", "medio", "desafio"].map(photoLevel), [1, 2, 2]);
  assert.deepEqual(suggestedRecord({ done: 5, total: 5, hints: 0, retries: 0 }), { participation: "total", criterionMet: "sim", supportLevel: 1 });
  assert.deepEqual(suggestedRecord({ done: 5, total: 5, hints: 2, retries: 3 }), { participation: "total", criterionMet: "parcial", supportLevel: 2 });
  assert.deepEqual(suggestedRecord({ done: 2, total: 5, hints: 4, retries: 1 }), { participation: "parcial", criterionMet: "nao", supportLevel: 3 });
});
