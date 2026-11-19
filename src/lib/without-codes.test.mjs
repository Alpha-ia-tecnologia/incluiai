import { test } from "node:test";
import assert from "node:assert/strict";
import { hasTeamCode, withoutCodes, withoutCodesDeep } from "./without-codes.ts";

test("sem códigos: o código da escala entre parênteses sai, o resto fica igual", () => {
  assert.equal(
    withoutCodes("Dante identificará seu nome entre 5 opções, com pista visual (VERB), em 4 de 5 tentativas, ao longo de 6 semanas."),
    "Dante identificará seu nome entre 5 opções, com pista visual, em 4 de 5 tentativas, ao longo de 6 semanas.",
  );
  assert.equal(withoutCodes("Lívia responderá questões, usando acionador (SUP), em 80% das aulas."), "Lívia responderá questões, usando acionador, em 80% das aulas.");
  assert.equal(withoutCodes("De modelo (MOD) para pista verbal (VERB) na escrita."), "De modelo para pista verbal na escrita.");
  assert.equal(withoutCodes("Apoio físico total (FIS-T) no recorte; parcial (FIS-P) na colagem."), "Apoio físico total no recorte; parcial na colagem.");
});

test("sem códigos: código com o nome ao lado fica só com o nome; código solto vira a palavra", () => {
  assert.equal(withoutCodes("VERB · Instrução verbal"), "Instrução verbal");
  assert.equal(withoutCodes("Nível de apoio: FIS-T — Apoio físico total"), "Nível de apoio: Apoio físico total");
  assert.equal(withoutCodes("Precisa de apoio VERB na leitura"), "Precisa de apoio instrução verbal na leitura");
  assert.equal(withoutCodes("De IND a FIS-T"), "De independente a apoio físico total");
});

test("sem códigos: BNCC some ou vira 'base curricular'", () => {
  assert.equal(withoutCodes("Reconhecer o nome (EF01LP04) entre colegas."), "Reconhecer o nome entre colegas.");
  assert.equal(withoutCodes("Habilidade da BNCC: EF01LP04."), "Habilidade da base curricular.");
  assert.equal(withoutCodes("Ligado à BNCC EI03EF01 e à rotina"), "Ligado à base curricular e à rotina");
  assert.equal(withoutCodes("Planejado com a BNCC"), "Planejado com a base curricular");
});

test("sem códigos: palavras parecidas ficam como estão", () => {
  for (const text of ["Supervisão da professora", "Modelo do professor", "Indicou o caminho", "MODO de brincar", "INDEPENDENTE", "Sup. técnico", "ver a rotina"]) {
    assert.equal(withoutCodes(text), text);
    assert.ok(!hasTeamCode(text), text);
  }
  assert.ok(hasTeamCode("com pista visual (VERB)") && hasTeamCode("BNCC EF01LP04") && hasTeamCode("EF01LP04") && hasTeamCode("FIS-T"));
  assert.equal(withoutCodes(""), "");
});

test("sem códigos em todo o conteúdo: listas e objetos, sem mudar números nem chaves", () => {
  const content = { title: "Rotina (VERB)", cards: [{ text: "Apontar", level: 2 }], activities: [{ supportBelow: "Mais apoio (FIS-P): mão sobre mão", steps: ["Mostrar (MOD)", "Esperar"] }], ok: true, empty: null };
  assert.deepEqual(withoutCodesDeep(content), { title: "Rotina", cards: [{ text: "Apontar", level: 2 }], activities: [{ supportBelow: "Mais apoio: mão sobre mão", steps: ["Mostrar", "Esperar"] }], ok: true, empty: null });
});
