// Testes do VLibras com anonimização: node --test src/lib/vlibras-core.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { requestKind, tidyForLibras, translationBody, translationText, VLIBRAS_ROOT } from "./vlibras-core.ts";
import { createAnonymizer, naturalizePlaceholders } from "./agents/anonymize-core.ts";

test("cada pedido do widget: tradução, bloqueado, estatística ou outro", () => {
  assert.equal(requestKind("https://traducao2.vlibras.gov.br/translate"), "traducao");
  assert.equal(requestKind("https://traducao2-dth.vlibras.gov.br/translate/"), "traducao");
  assert.equal(requestKind("https://traducao2.vlibras.gov.br/review"), "bloqueado");
  assert.equal(requestKind("https://us.i.posthog.com/e/?ip=1"), "analytics");
  assert.equal(requestKind("https://dicionario2.vlibras.gov.br/2018.3.1/WEBGL/CASA"), "outro");
  assert.equal(requestKind("/api/libras/anonimizar"), "outro");
  assert.equal(requestKind("http://[::1"), "outro");
  assert.match(VLIBRAS_ROOT, /vlibras-portal@v7\.12\.2\/app$/);
});

test("corpo do pedido: só o formato conferido passa", () => {
  assert.equal(translationText('{"text":"Olá"}'), "Olá");
  assert.equal(translationText("{\"texto\":\"Olá\"}"), null);
  assert.equal(translationText("não é json"), null);
  assert.equal(translationText(undefined), null);
  assert.equal(translationBody("o estudante"), '{"text":"o estudante"}');
});

test("o que vai para o tradutor do governo: sem nomes, documentos, datas e contatos", () => {
  const anonymizer = createAnonymizer({ student: "", students: ["Dante Oliveira", "Ravi Almeida"], family: ["Carla Oliveira"], professionals: ["Prof.ª Beatriz (AEE)"], schools: ["EMEF Maria Firmina dos Reis"] });
  const text = "Dante Oliveira e a mãe, Carla, falaram com Beatriz na EMEF Maria Firmina dos Reis. CPF 111.222.333-44, nascido em 12/03/2019, telefone (98) 99876-5432. Ravi também foi.";
  const sent = tidyForLibras(naturalizePlaceholders(anonymizer.applyNatural(text)));
  for (const secret of ["Dante", "Oliveira", "Carla", "Beatriz", "Maria Firmina", "111.222", "12/03/2019", "99876", "Ravi"]) assert.ok(!sent.includes(secret), `${secret} saiu: ${sent}`);
  assert.match(sent, /^o estudante e a mãe, um familiar, falaram com um profissional na escola\./);
  assert.match(sent, /\(informação omitida\)/);
  assert.ok(!sent.includes("["), "sem colchetes para o avatar soletrar");
  assert.equal(tidyForLibras("Ele da uma olhada da a escola."), "Ele da uma olhada da escola.");
  // Sem nomes conhecidos (tela de entrada): só documentos, datas e contatos.
  assert.equal(naturalizePlaceholders(createAnonymizer({ student: "" }).applyNatural("Dante, 12/03/2019")), "Dante, (informação omitida)");
});
