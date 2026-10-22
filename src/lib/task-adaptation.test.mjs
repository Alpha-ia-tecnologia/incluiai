// Testes da adaptação de atividade e prova: node --test src/lib/task-adaptation.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { adaptByRules, answerFormatOf, commandWords, highlightParts, levelsByRules, normalizeAdapted, oneOrderPerLine, printPages, printSettings, splitTask } from "./task-adaptation.ts";

const PROVA = `Prova de Ciências - 3º ano
1) Leia o texto. Depois, circule os animais que vivem na água.
2. Ligue cada animal ao lugar onde ele vive.
3 - Qual é o alimento da vaca?
a) capim
b) carne
c) peixe
4) Desenhe um animal que você conhece.`;

test("separa as questões numeradas e as alternativas", () => {
  const items = splitTask(PROVA);
  assert.equal(items.length, 5);
  assert.equal(items[0].prompt, "Prova de Ciências - 3º ano");
  assert.equal(items[3].prompt, "Qual é o alimento da vaca?");
  assert.deepEqual(items[3].options, ["capim", "carne", "peixe"]);
  assert.deepEqual(splitTask("Primeiro parágrafo.\n\nSegundo parágrafo\ncontinua.").map((item) => item.prompt), ["Primeiro parágrafo.", "Segundo parágrafo continua."]);
});

test("forma de resposta e comandos", () => {
  assert.equal(answerFormatOf("Circule os animais"), "marcar");
  assert.equal(answerFormatOf("Ligue cada animal"), "ligar");
  assert.equal(answerFormatOf("Desenhe um animal"), "desenhar");
  assert.equal(answerFormatOf("Complete as frases"), "completar");
  assert.equal(answerFormatOf("Qual é o alimento?"), "escrever");
  assert.deepEqual(commandWords("Leia o texto. Depois, circule os animais."), ["leia", "circule"]);
  assert.equal(oneOrderPerLine("Leia o texto. Depois, circule os animais."), "Leia o texto.\nDepois, circule os animais.");
  assert.deepEqual(highlightParts("Leia e circule."), [{ text: "Leia", command: true }, { text: " e ", command: false }, { text: "circule", command: true }, { text: ".", command: false }]);
});

test("adaptação pelas regras muda a apresentação, não a questão", () => {
  const content = adaptByRules({ title: "Prova de Ciências", text: PROVA, kind: "prova" }, ["ordem_por_vez", "apoio_visual", "linguagem_simples"]);
  assert.equal(content.items.length, 5);
  assert.equal(content.items[1].prompt, "Leia o texto.\nDepois, circule os animais que vivem na água.");
  assert.equal(content.items[1].answerFormat, "marcar");
  assert.equal(content.items[3].answerFormat, "marcar");
  assert.deepEqual(content.items[3].options, ["capim", "carne", "peixe"]);
  assert.match(content.preserved, /mesmos da prova da turma/);
  assert.ok(content.teacherNotes.some((note) => note.includes("precisam da IA")));
});

test("o que a IA devolve é conferido", () => {
  const content = normalizeAdapted({ title: "", items: [{ prompt: "Marque a resposta", answerFormat: "inventado", options: ["a", "", "b"], support: "x" }, { prompt: "  " }] }, "Atividade");
  assert.equal(content.title, "Atividade");
  assert.equal(content.items.length, 1);
  assert.equal(content.items[0].answerFormat, "escrever");
  assert.deepEqual(content.items[0].options, ["a", "b"]);
  assert.deepEqual(normalizeAdapted(null, "X").items, []);
});

test("três níveis da mesma atividade e a impressão", () => {
  const base = adaptByRules({ title: "Animais", text: PROVA, kind: "atividade" }, []);
  const levels = levelsByRules(base);
  assert.equal(levels.padrao.items[1].prompt, base.items[1].prompt);
  assert.equal(levels.mais_apoio.items[1].prompt, "Leia o texto.\nDepois, circule os animais que vivem na água.");
  assert.match(levels.desafio.items[0].prompt, /\nAgora, explique como chegou/);
  assert.doesNotMatch(levels.desafio.items[0].prompt, /desafio/i);
  assert.equal(levels.padrao.items.length, levels.desafio.items.length);
  assert.deepEqual(printSettings(["menos_itens"]), { largeText: false, itemsPerPage: 3 });
  assert.deepEqual(printPages([1, 2, 3, 4, 5, 6, 7], 3), [[1, 2, 3], [4, 5, 6], [7]]);
  assert.deepEqual(printPages([1, 2], null), [[1, 2]]);
});
