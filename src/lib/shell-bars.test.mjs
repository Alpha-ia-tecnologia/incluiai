import { test } from "node:test";
import assert from "node:assert/strict";
import { TOP_BAR_START, isFormField, isStuckAtBottom, keyboardInset, nextTopBar } from "./shell-bars.ts";

const run = (positions, state = TOP_BAR_START) => positions.reduce((current, y) => nextTopBar(current, y), state);

test("barra de cima: some depois de rolar para baixo e volta ao rolar para cima", () => {
  assert.equal(run([0, 100, 200]).hidden, true);
  assert.equal(run([0, 100, 200, 190]).hidden, true, "10 px para cima ainda não bastam");
  assert.equal(run([0, 100, 200, 180]).hidden, false);
  assert.equal(run([0, 100, 200, 180, 300]).hidden, true);
});

test("barra de cima: perto do topo fica sempre à vista", () => {
  assert.equal(run([0, 40, 64]).hidden, false);
  assert.equal(run([0, 300, 600, 50]).hidden, false);
});

test("barra de cima: tremida pequena não troca o estado", () => {
  assert.equal(run([0, 200, 180, 188, 184, 190]).hidden, false, "aberta: precisa de 12 px seguidos para baixo");
  assert.equal(run([0, 300, 295, 299, 292, 297]).hidden, true, "fechada: precisa de 12 px seguidos para cima");
});

test("barra de cima: sem mudança, o mesmo objeto (nada para redesenhar)", () => {
  const hidden = run([0, 300]);
  assert.equal(nextTopBar(hidden, 295), hidden);
  const shown = run([0, 300, 250]);
  assert.equal(nextTopBar(shown, 255), shown);
});

test("teclado na tela: o quanto cobre do fim da página", () => {
  assert.equal(keyboardInset({ layoutHeight: 844, visualHeight: 844, visualTop: 0 }), 0);
  assert.equal(keyboardInset({ layoutHeight: 844, visualHeight: 508, visualTop: 0 }), 336);
  assert.equal(keyboardInset({ layoutHeight: 844, visualHeight: 508, visualTop: 120 }), 216, "iOS rola a área visível até o campo");
  assert.equal(keyboardInset({ layoutHeight: 800, visualHeight: 844, visualTop: 0 }), 0, "barra do navegador recolhida: nunca negativo");
});

test("campo de formulário: o que conta como preencher", () => {
  for (const [tag, type] of [["textarea"], ["SELECT"], ["input", "text"], ["INPUT", "radio"], ["input", "checkbox"], ["input", "date"], ["input"]]) assert.equal(isFormField(tag, type), true, `${tag} ${type ?? ""}`);
  for (const [tag, type] of [["button"], ["input", "submit"], ["input", "HIDDEN"], ["input", "button"], ["input", "reset"], ["a"], ["summary"]]) assert.equal(isFormField(tag, type), false, `${tag} ${type ?? ""}`);
});

test("barra de salvar presa: borda de baixo no ponto de parada", () => {
  assert.equal(isStuckAtBottom(834, 844, 10), true);
  assert.equal(isStuckAtBottom(834.8, 844, 10), true);
  assert.equal(isStuckAtBottom(600, 844, 10), false, "descansa no fim do formulário");
});
