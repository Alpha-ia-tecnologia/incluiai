// Testes do VLibras com anonimização: node --test src/lib/vlibras-core.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { requestKind, tidyForLibras, translationBody, translationText, VLIBRAS_ROOT } from "./vlibras-core.ts";
import { createAnonymizer, naturalizePlaceholders } from "./agents/anonymize-core.ts";

test("cada pedido: tradução, bloqueado, estatística ou outro (fechado por padrão)", () => {
  const here = "https://incluiedu.municipio.gov.br";
  assert.equal(requestKind("https://traducao2.vlibras.gov.br/translate", "POST", here), "traducao");
  assert.equal(requestKind("https://traducao2-dth.vlibras.gov.br/translate/", "post", here), "traducao");
  assert.equal(requestKind("https://traducao2.vlibras.gov.br/review", "POST", here), "bloqueado");
  assert.equal(requestKind("https://traducao2.vlibras.gov.br/translate", "GET", here), "bloqueado");
  assert.equal(requestKind("https://us.i.posthog.com/e/?ip=1", "POST", here), "analytics");
  assert.equal(requestKind("https://dicionario2.vlibras.gov.br/2018.3.1/WEBGL/CASA", "GET", here), "outro");
  // Envio de dados a outro site que não seja o tradutor: bloqueado, mesmo de um endereço novo.
  assert.equal(requestKind("https://novo-tradutor.vlibras.gov.br/api", "POST", here), "bloqueado");
  assert.equal(requestKind("https://exemplo.com/coleta", "PUT", here), "bloqueado");
  assert.equal(requestKind("/api/libras/anonimizar", "POST", here), "outro");
  assert.equal(requestKind(`${here}/api/assistente`, "POST", here), "outro");
  assert.equal(requestKind("http://[::1", "POST", here), "outro");
  assert.equal(VLIBRAS_ROOT, "https://vlibras.gov.br/app");
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
