import { test } from "node:test";
import assert from "node:assert/strict";
import { GAME_CATALOG, GAME_CATEGORIES, GAME_OBJECTS, classificationGroupFor, generateRound, initialLetter, isCorrectAnswer, isCorrectClassification, isGameId, memoryCardsMatch, objectById, shuffle } from "./games.ts";

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test("catálogo tem quinze propostas, categorias válidas e somente objetos reconhecidos", () => {
  assert.equal(GAME_CATALOG.length, 15);
  assert.equal(new Set(GAME_CATALOG.map((game) => game.id)).size, 15);
  assert.equal(isGameId("rotina"), true);
  assert.equal(isGameId("letras"), true);
  assert.equal(isGameId("somar"), true);
  assert.equal(isGameId("classificar"), true);
  assert.equal(isGameId("silabas"), true);
  assert.equal(isGameId("inexistente"), false);
  for (const game of GAME_CATALOG) {
    assert.ok(game.instructions && game.skill && game.description);
    assert.ok(game.categories.length > 0);
    assert.equal(new Set(game.categories).size, game.categories.length);
    assert.ok(game.categories.every((category) => category !== "Todos" && GAME_CATEGORIES.includes(category)));
    assert.ok(GAME_OBJECTS.some((object) => object.image === game.cover));
  }
  assert.deepEqual(GAME_CATALOG.filter((game) => game.categories.includes("Alfabetização")).map((game) => game.id), ["letras", "palavras", "silabas"]);
});

test("embaralhar preserva origem e elementos e permite reprodução", () => {
  const source = Object.freeze([1, 2, 3, 4, 5, 6]);
  const shuffled = shuffle(source, seededRandom(42));
  assert.deepEqual(source, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...shuffled].sort(), source);
  assert.deepEqual(shuffled, shuffle(source, seededRandom(42)));
  assert.notDeepEqual(shuffled, source);
});

test("memória tem exatamente dois exemplares por foto e nunca aceita a mesma carta", () => {
  for (const level of [1, 2]) {
    const round = generateRound("memoria", level, seededRandom(8));
    assert.equal(round.cards.length, level === 1 ? 6 : 12);
    assert.equal(new Set(round.cards.map((card) => card.id)).size, round.cards.length);
    const counts = new Map();
    for (const card of round.cards) counts.set(card.objectId, (counts.get(card.objectId) ?? 0) + 1);
    assert.equal(counts.size, round.pairCount);
    assert.ok([...counts.values()].every((count) => count === 2));
    const first = round.cards[0];
    const pair = round.cards.find((card) => card.id !== first.id && card.objectId === first.objectId);
    assert.equal(memoryCardsMatch(first, pair), true);
    assert.equal(memoryCardsMatch(first, first), false);
    assert.equal(memoryCardsMatch(first, round.cards.find((card) => card.objectId !== first.objectId)), false);
  }
});

test("toda escolha tem uma única resposta e rejeita respostas desconhecidas", () => {
  for (let seed = 0; seed < 100; seed += 1) {
    for (const level of [1, 2]) {
      for (const id of ["encontre", "contar", "sequencia", "cores", "letras", "palavras", "somar", "usos", "subtrair", "numeros"]) {
        const round = generateRound(id, level, seededRandom(seed));
        assert.equal(round.options.length, level === 1 ? 3 : 4);
        assert.equal(new Set(round.options.map((option) => option.id)).size, round.options.length);
        assert.equal(round.options.filter((option) => isCorrectAnswer(round, option.id)).length, 1);
        assert.equal(isCorrectAnswer(round, "inexistente"), false);
        assert.equal(isCorrectAnswer(round, [round.answerId]), false);
      }
    }
  }
});

test("cores exclui distratores da mesma cor, incluindo livro e maçã vermelhos", () => {
  for (let seed = 0; seed < 100; seed += 1) {
    const round = generateRound("cores", 2, seededRandom(seed));
    const matching = round.options.filter((option) => objectById(option.objectId).colorLabel === round.target.colorLabel);
    assert.equal(matching.length, 1);
    assert.equal(matching[0].id, round.answerId);
    assert.ok(round.prompt.includes(round.target.colorLabel.toLocaleLowerCase("pt-BR")));
  }
});

test("contagem mantém resposta igual à quantidade e respeita o nível", () => {
  const seen = new Set();
  for (let seed = 0; seed < 100; seed += 1) {
    for (const level of [1, 2]) {
      const round = generateRound("contar", level, seededRandom(seed));
      assert.ok(round.quantity >= 1 && round.quantity <= (level === 1 ? 5 : 8));
      assert.equal(Number(round.answerId), round.quantity);
      assert.ok(round.options.every((option) => Number(option.id) >= 1 && Number(option.id) <= (level === 1 ? 5 : 8)));
      if (level === 2) seen.add(round.quantity);
    }
  }
  assert.equal(seen.size, 8);
});

test("sequências continuam o padrão e variam entre dois ou três objetos", () => {
  for (const level of [1, 2]) {
    const round = generateRound("sequencia", level, seededRandom(40));
    const patternLength = level === 1 ? 2 : 3;
    assert.equal(new Set(round.sequence.map((object) => object.id)).size, patternLength);
    assert.equal(round.answerId, round.sequence[round.sequence.length % patternLength].id);
    round.sequence.forEach((object, index) => assert.equal(object.id, round.sequence[index % patternLength].id));
  }
});

test("rotina exige todos os passos na ordem anunciada e permite reconstrução", () => {
  let seenOrders = new Set();
  for (let seed = 0; seed < 50; seed += 1) {
    const round = generateRound("rotina", 2, seededRandom(seed));
    const answer = round.correctOrder;
    seenOrders.add(answer.join(","));
    assert.equal(round.options.length, 3);
    assert.deepEqual([...round.options.map((option) => option.id)].sort(), [...answer].sort());
    assert.equal(isCorrectAnswer(round, answer), true);
    assert.equal(isCorrectAnswer(round, answer.slice(0, 2)), false);
    assert.equal(isCorrectAnswer(round, [...answer].reverse()), false);
    assert.equal(isCorrectAnswer(round, [...answer, answer[0]]), false);
    assert.equal(isCorrectAnswer(round, answer.join(",")), false);
    const firstObject = answer[0] === "livro" ? "o livro" : "o lanche";
    assert.ok(round.story.includes(`Primeiro, guarde ${firstObject}.`));
  }
  assert.equal(seenOrders.size, 2);
});

test("primeira letra acompanha o nome do objeto e não confunde iniciais repetidas", () => {
  assert.equal(initialLetter(" maçã "), "M");
  assert.equal(initialLetter("Árvore"), "A");
  assert.equal(initialLetter("bola"), "B");
  const seen = new Set();
  for (let seed = 0; seed < 100; seed += 1) {
    for (const level of [1, 2]) {
      const round = generateRound("letras", level, seededRandom(seed * 104729));
      seen.add(round.target.id);
      assert.equal(round.answerId, initialLetter(round.target.label));
      assert.ok(round.options.every((option) => /^[A-Z]$/.test(option.label) && option.label === option.id && !option.image));
      assert.equal(round.options.filter((option) => option.id === initialLetter(round.target.label)).length, 1);
    }
  }
  assert.equal(seen.size, GAME_OBJECTS.length);
});

test("imagem e palavra usa nomes escritos em maiúsculas, com uma única correspondência", () => {
  const seen = new Set();
  for (let seed = 0; seed < 100; seed += 1) {
    for (const level of [1, 2]) {
      const round = generateRound("palavras", level, seededRandom(seed * 104729));
      seen.add(round.target.id);
      assert.equal(round.answerId, round.target.id);
      for (const option of round.options) {
        assert.equal(option.label, objectById(option.objectId).label.toLocaleUpperCase("pt-BR"));
        assert.equal(option.image, undefined);
      }
      assert.equal(round.options.filter((option) => option.label === round.target.label.toLocaleUpperCase("pt-BR")).length, 1);
    }
  }
  assert.equal(seen.size, GAME_OBJECTS.length);
});

test("adição reúne duas parcelas positivas e mantém total e opções nos limites do nível", () => {
  const seen = { 1: new Set(), 2: new Set() };
  for (let seed = 0; seed < 200; seed += 1) {
    for (const level of [1, 2]) {
      const round = generateRound("somar", level, seededRandom(seed * 104729));
      const max = level === 1 ? 5 : 10;
      const [first, second] = round.addends;
      assert.ok(first >= 1 && second >= 1);
      assert.ok(Number.isInteger(first) && Number.isInteger(second));
      assert.equal(round.quantity, first + second);
      assert.ok(round.quantity >= 2 && round.quantity <= max);
      assert.equal(Number(round.answerId), round.quantity);
      assert.ok(round.options.every((option) => Number(option.id) >= 1 && Number(option.id) <= max && !option.image));
      seen[level].add(round.quantity);
    }
  }
  assert.deepEqual([...seen[1]].sort((a, b) => a - b), [2, 3, 4, 5]);
  assert.deepEqual([...seen[2]].sort((a, b) => a - b), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("uso funcional escolhe objetos com demandas específicas e nunca frutas ambíguas", () => {
  const seen = new Set();
  for (let seed = 0; seed < 100; seed += 1) {
    for (const level of [1, 2]) {
      const round = generateRound("usos", level, seededRandom(seed * 104729));
      const id = round.target.id;
      assert.ok(["book", "ball", "backpack"].includes(id));
      assert.equal(round.answerId, id);
      if (id === "book") assert.ok(round.prompt.includes("páginas"));
      if (id === "ball") assert.ok(round.prompt.includes("chutar e rolar"));
      if (id === "backpack") assert.ok(round.prompt.includes("costas"));
      assert.ok(round.options.every((option) => option.image && option.objectId));
      assert.equal(round.options.filter((option) => option.objectId === id).length, 1);
      seen.add(id);
    }
  }
  assert.deepEqual([...seen].sort(), ["backpack", "ball", "book"]);
});

test("classificação sempre oferece os dois grupos e só aceita objetos da proposta", () => {
  const fruits = new Set(["apple", "banana", "orange"]);
  for (let seed = 0; seed < 100; seed += 1) {
    for (const level of [1, 2]) {
      const round = generateRound("classificar", level, seededRandom(seed * 104729));
      assert.equal(round.items.length, level === 1 ? 3 : 6);
      assert.equal(new Set(round.items.map((item) => item.id)).size, round.items.length);
      assert.deepEqual(round.groups, [{ id: "frutas", label: "É fruta" }, { id: "outros", label: "Não é fruta" }]);
      assert.equal(new Set(round.items.map((item) => round.assignments[item.id])).size, 2);
      for (const item of round.items) {
        const expected = fruits.has(item.id) ? "frutas" : "outros";
        assert.equal(round.assignments[item.id], expected);
        assert.equal(classificationGroupFor(item.id), expected);
        assert.equal(isCorrectClassification(round, item.id, expected), true);
        assert.equal(isCorrectClassification(round, item.id, expected === "frutas" ? "outros" : "frutas"), false);
        assert.equal(isCorrectClassification(round, item.id, "desconhecido"), false);
      }
      const absent = GAME_OBJECTS.find((object) => !round.items.some((item) => item.id === object.id));
      if (absent) assert.equal(isCorrectClassification(round, absent.id, classificationGroupFor(absent.id)), false);
      assert.equal(isCorrectClassification(round, "desconhecido", "outros"), false);
      assert.equal(isCorrectAnswer(round, "frutas"), false);
    }
  }
});

test("comparação apresenta dois grupos distintos e alterna mais e menos no desafio", () => {
  const seen = new Set();
  for (let seed = 0; seed < 150; seed += 1) {
    for (const level of [1, 2]) {
      const round = generateRound("comparar", level, seededRandom(seed * 104729));
      assert.equal(round.options.length, 2);
      assert.equal(new Set(round.options.map((option) => option.id)).size, 2);
      const quantities = round.options.map((option) => option.quantity);
      assert.notEqual(quantities[0], quantities[1]);
      assert.ok(quantities.every((quantity) => Number.isInteger(quantity) && quantity >= 1 && quantity <= (level === 1 ? 5 : 8)));
      assert.ok(round.options.every((option) => option.image === round.target.image && option.objectId === round.target.id));
      const expected = round.comparison === "mais" ? Math.max(...quantities) : Math.min(...quantities);
      assert.equal(round.options.find((option) => option.id === round.answerId).quantity, expected);
      assert.equal(round.options.filter((option) => isCorrectAnswer(round, option.id)).length, 1);
      assert.equal(isCorrectAnswer(round, "desconhecido"), false);
      assert.equal(isCorrectAnswer(round, [round.answerId]), false);
      assert.ok(round.prompt.includes(`${round.comparison} ${round.target.plural}`));
      if (level === 1) assert.equal(round.comparison, "mais");
      else seen.add(round.comparison);
    }
  }
  assert.deepEqual([...seen].sort(), ["mais", "menos"]);
});

function syllableAnswer(round) {
  const available = [...round.pieces];
  return round.syllables.map((syllable) => {
    const index = available.findIndex((piece) => piece.label === syllable);
    assert.ok(index >= 0);
    return available.splice(index, 1)[0].id;
  });
}

test("sílabas reconstroem nomes completos com peças únicas e apoio ajustado", () => {
  const seen = { 1: new Set(), 2: new Set() };
  for (let seed = 0; seed < 100; seed += 1) {
    for (const level of [1, 2]) {
      const round = generateRound("silabas", level, seededRandom(seed * 104729));
      seen[level].add(round.target.id);
      assert.equal(round.syllables.join(""), round.target.label.toLocaleUpperCase("pt-BR"));
      assert.equal(round.pieces.length, round.syllables.length);
      assert.equal(new Set(round.pieces.map((piece) => piece.id)).size, round.pieces.length);
      assert.deepEqual(round.pieces.map((piece) => piece.label).sort(), [...round.syllables].sort());
      if (level === 1) assert.equal(round.syllables.length, 2);
      const answer = syllableAnswer(round);
      assert.equal(isCorrectAnswer(round, answer), true);
      assert.equal(isCorrectAnswer(round, answer.slice(0, -1)), false);
      assert.equal(isCorrectAnswer(round, [...answer, answer[0]]), false);
      assert.equal(isCorrectAnswer(round, answer.join(",")), false);
      assert.equal(isCorrectAnswer(round, ["desconhecido", ...answer.slice(1)]), false);
      assert.equal(isCorrectAnswer(round, [answer[1], answer[0], ...answer.slice(2)]), false);
    }
  }
  assert.deepEqual([...seen[1]].sort(), ["apple", "ball", "book"]);
  assert.equal(seen[2].size, GAME_OBJECTS.length);
});

test("sílabas iguais de BANANA podem trocar de lugar sem reutilizar a mesma peça", () => {
  const round = Array.from({ length: 100 }, (_, seed) => generateRound("silabas", 2, seededRandom(seed * 104729))).find((item) => item.target.id === "banana");
  assert.ok(round);
  assert.deepEqual(round.syllables, ["BA", "NA", "NA"]);
  const answer = syllableAnswer(round);
  assert.equal(isCorrectAnswer(round, [answer[0], answer[2], answer[1]]), true);
  assert.equal(isCorrectAnswer(round, [answer[0], answer[1], answer[1]]), false);
  assert.equal(isCorrectAnswer(round, [answer[1], answer[0], answer[2]]), false);
});

test("subtração mantém retirada concreta e representa inclusive nenhum objeto restante", () => {
  const remaining = { 1: new Set(), 2: new Set() };
  const initial = { 1: new Set(), 2: new Set() };
  for (let seed = 0; seed < 300; seed += 1) {
    for (const level of [1, 2]) {
      const round = generateRound("subtrair", level, seededRandom(seed * 104729));
      const max = level === 1 ? 5 : 10;
      assert.ok(Number.isInteger(round.initialQuantity) && round.initialQuantity >= 2 && round.initialQuantity <= max);
      assert.ok(Number.isInteger(round.removedQuantity) && round.removedQuantity >= 1 && round.removedQuantity <= round.initialQuantity);
      assert.equal(round.quantity, round.initialQuantity - round.removedQuantity);
      assert.equal(Number(round.answerId), round.quantity);
      assert.ok(round.options.every((option) => Number.isInteger(Number(option.id)) && Number(option.id) >= 0 && Number(option.id) <= max));
      assert.equal(round.options.filter((option) => isCorrectAnswer(round, option.id)).length, 1);
      if (round.initialQuantity === round.removedQuantity) {
        assert.equal(round.quantity, 0);
        assert.ok(round.options.some((option) => option.id === "0" && option.label === "0"));
      }
      remaining[level].add(round.quantity);
      initial[level].add(round.initialQuantity);
    }
  }
  assert.deepEqual([...remaining[1]].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
  assert.deepEqual([...remaining[2]].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(initial[1].size, 4);
  assert.equal(initial[2].size, 9);
});

test("número ausente é uma lacuna interna de progressão consistente e limitada ao nível", () => {
  const steps = new Set();
  for (let seed = 0; seed < 150; seed += 1) {
    for (const level of [1, 2]) {
      const round = generateRound("numeros", level, seededRandom(seed * 104729));
      const max = level === 1 ? 5 : 10;
      assert.equal(round.sequence.length, level === 1 ? 4 : 5);
      assert.ok(round.missingIndex > 0 && round.missingIndex < round.sequence.length - 1);
      assert.equal(round.sequence.filter((value) => value === null).length, 1);
      assert.equal(round.sequence[round.missingIndex], null);
      const completed = round.sequence.map((value) => value === null ? Number(round.answerId) : value);
      assert.ok(completed.every((value) => Number.isInteger(value) && value >= 0 && value <= max));
      const step = completed[1] - completed[0];
      assert.ok(step === 1 || (level === 2 && step === 2));
      assert.ok(completed.slice(1).every((value, index) => value - completed[index] === step));
      assert.equal(round.options.filter((option) => isCorrectAnswer(round, option.id)).length, 1);
      assert.ok(round.options.every((option) => Number(option.id) >= 0 && Number(option.id) <= max));
      if (level === 2) steps.add(step);
    }
  }
  assert.deepEqual([...steps].sort(), [1, 2]);
});
