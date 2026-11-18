import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DOCUMENT_PATTERNS, MARKER_LIST, createPseudonymizer, hasStudentLabel, createRedactor, inWords, remainingIdentifiers, replacePatterns, restorableLength, withRedaction,
} from "./redactor.ts";

const SCHOOL = "EMEF Maria Firmina dos Reis";

// Registro de um estudante: ele por inteiro, os colegas da escola, as famílias e os profissionais.
const studentScope = () => createRedactor({
  focus: "Dante Moreira Lima",
  students: ["Ravi Almeida", "Lia Souza"],
  family: ["Carla Moreira"],
  professionals: ["Prof.ª Beatriz Nunes (AEE)"],
  schools: [SCHOOL],
});

test("registro do estudante: cada parte do nome dele sai; dos outros, o nome completo e o primeiro nome", () => {
  const redactor = studentScope();
  const text = "Dante foi com Lima e DANTE ao recreio. Ravi Almeida e Ravi brincaram; Almeida ficou. Carla e Beatriz Nunes vieram à EMEF maria firmina dos reis.";
  assert.equal(
    redactor.redact(text),
    "[ESTUDANTE] foi com [ESTUDANTE] e [ESTUDANTE] ao recreio. [COLEGA] e [COLEGA] brincaram; Almeida ficou. [FAMILIAR] e [PROFISSIONAL] vieram à [ESCOLA].",
  );
  assert.equal(redactor.removed(), 8);
  assert.equal(redactor.summary(), "Antes do envio à IA, foram substituídos: 1 nome(s) da escola, 1 nome(s) de profissional, 2 nome(s) de colega, 3 menção(ões) ao estudante, 1 nome(s) de familiar.");
});

test("contatos, documentos e datas saem; intervalo de ano e número curto ficam", () => {
  const redactor = createRedactor({});
  const text = "E-mail carla@escola.org, site https://escola.org, CPF 111.222.333-44, CEP 65000-100, em 12/03/2019, telefone (98) 99876-5432. Ano letivo 2025-2026, sala 1234.";
  assert.equal(redactor.redact(text), "E-mail [E-MAIL], site [LINK] CPF [DOCUMENTO], CEP [CEP], em [DATA], telefone [TELEFONE]. Ano letivo 2025-2026, sala 1234.");
  assert.equal(redactor.summary(), "Antes do envio à IA, foram substituídos: 3 contatos, 2 documentos, 1 datas.");
  assert.equal(createRedactor({}).summary(), null);
});

test("planejamento da escola: cada parte de cada nome sai, e o texto passa na conferência", () => {
  const redactor = createRedactor({ students: ["Ravi Almeida"], family: ["Carla Moreira"], professionals: ["Beatriz Nunes"], schools: [SCHOOL], everyPart: true });
  const sent = redactor.redact("Almeida senta com Ravi; Moreira traz o livro; Nunes conduz.");
  assert.equal(sent, "[ESTUDANTE] senta com [ESTUDANTE]; [FAMILIAR] traz o livro; [PROFISSIONAL] conduz.");
  assert.deepEqual(remainingIdentifiers(sent, ["Ravi Almeida", "Carla Moreira", "Beatriz Nunes"], [SCHOOL]), []);
  assert.deepEqual(remainingIdentifiers("Almeida senta perto", ["Ravi Almeida"], []), ["nome"]);
});

test("Libras: só os nomes da lista mudam, em palavras e sem colchetes", () => {
  const redactor = createRedactor({ students: ["Dante Oliveira"], family: ["Carla Oliveira"], schools: [SCHOOL] });
  assert.equal(
    redactor.redactInWords("Dante Oliveira e Carla na EMEF Maria Firmina dos Reis com Ravi Almeida, em 12/03/2019."),
    "o estudante e um familiar na a escola com Ravi Almeida, em (informação omitida).",
  );
});

test("um mesmo nome em dois papéis: no registro vale o primeiro; na conversa vira pessoa ambígua", () => {
  assert.equal(createRedactor({ focus: "Ana Lima", professionals: ["Ana Costa"] }).redact("Ana chegou"), "[ESTUDANTE] chegou");
  const conversation = createPseudonymizer({
    map: { students: {}, schools: {} },
    students: [{ id: "s1", name: "Ana Lima" }], schools: [], family: [], professionals: ["Ana Costa"],
  });
  assert.equal(conversation.apply("Ana chegou"), "[PESSOA] chegou");
  assert.equal(conversation.restore("[PESSOA] chegou"), "uma pessoa chegou");
});

test("conversa com o assistente: números estáveis, nome e sobrenome num marcador só, volta com o nome na tela", () => {
  const conversation = createPseudonymizer({
    map: { students: { s2: 1 }, schools: {} },
    students: [{ id: "s1", name: "Ana Clara Lima" }, { id: "s2", name: "Ravi Almeida" }, { id: "s3", name: "Ana Souza" }],
    schools: [{ id: "e1", name: SCHOOL }],
    family: ["Carla Moreira"],
    professionals: ["Beatriz Nunes"],
  });
  assert.equal(conversation.changed, true);
  assert.deepEqual(conversation.map, { students: { s2: 1, s1: 2, s3: 3 }, schools: { e1: 1 } });
  assert.equal(conversation.studentLabel("s1"), "[ESTUDANTE 2]");
  assert.equal(
    conversation.apply("Ana Clara e Ravi, da EMEF Maria Firmina dos Reis, com Carla e Nunes; Ana faltou."),
    "[ESTUDANTE 2] e [ESTUDANTE 1], da [ESCOLA 1], com [FAMILIAR] e Nunes; [PESSOA] faltou.",
  );
  assert.equal(conversation.restore("[ESTUDANTE 2] e ESTUDANTE 1 na [ESCOLA 1]; [FAMILIAR] veio."), "Ana Clara Lima e Ravi na EMEF Maria Firmina dos Reis; um familiar veio.");
  assert.equal(conversation.restore("ESTUDANTE3 leu"), "Ana Souza leu");
});

test("conversa com o assistente: o marcador que o modelo cita leva ao estudante", () => {
  const conversation = createPseudonymizer({
    map: { students: { s2: 1, s1: 2 }, schools: {} },
    students: [{ id: "s1", name: "Ana Clara Lima" }, { id: "s2", name: "Ravi Almeida" }],
    schools: [], family: [], professionals: [],
  });
  for (const text of ["[ESTUDANTE 2]", "ESTUDANTE 2", "estudante2", "o [ESTUDANTE 2] faltou"]) {
    assert.ok(hasStudentLabel(text), text);
    assert.equal(conversation.studentIdOf(text), "s1", text);
  }
  assert.equal(conversation.studentIdOf("[ESTUDANTE 9]"), undefined);
  assert.equal(hasStudentLabel("Ana Clara"), false);
  assert.equal(conversation.studentIdOf("Ana Clara"), undefined);
});

test("laudo: linhas de identificação, profissionais, registros, documentos e endereços saem; a resposta volta sem marcadores", () => {
  const counts = {};
  const text = "Paciente: Dante Moreira\nDra. Helena Prado, CRM-MA 12345\nCNS 123 4567 8901 2345, RG 12.345.678-9\nRua das Flores, 120";
  const cleaned = replacePatterns(text, DOCUMENT_PATTERNS, counts);
  assert.equal(cleaned, "Paciente: [OMITIDO]\n[PROFISSIONAL], [REGISTRO PROFISSIONAL]\nCNS [DOCUMENTO], RG [DOCUMENTO]\n[ENDEREÇO]");
  assert.deepEqual(counts, { "linhas de identificação": 1, "nomes de profissionais": 1, "registros profissionais": 1, documentos: 2, endereços: 1 });
  assert.deepEqual(inWords({ resumo: cleaned, lista: ["[ESTUDANTE] e [COLEGA]"] }), {
    resumo: "Paciente: (informação omitida)\num profissional, (informação omitida)\nCNS (informação omitida), RG (informação omitida)\n(informação omitida)",
    lista: ["o estudante e um colega"],
  });
});

test("o modelo recebe o pedido trocado e a resposta volta em palavras", async () => {
  const seen = [];
  const model = withRedaction(async (request) => { seen.push(request.prompt); return { texto: "[ESTUDANTE] leu com [FAMILIAR] em [DATA]." }; }, studentScope());
  const answer = await model({ agent: "teste", system: "", prompt: "Dante leu com Carla em 01/02/2026.", schema: null });
  assert.deepEqual(seen, ["[ESTUDANTE] leu com [FAMILIAR] em [DATA]."]);
  assert.deepEqual(answer, { texto: "o estudante leu com um familiar em (informação omitida)." });
});

test("a lista de marcadores para as instruções dos agentes inclui todos os que a troca usa", () => {
  for (const marker of ["[ESTUDANTE]", "[COLEGA]", "[FAMILIAR]", "[PROFISSIONAL]", "[ESCOLA]", "[E-MAIL]", "[LINK]", "[DOCUMENTO]", "[CEP]", "[DATA]", "[TELEFONE]"]) {
    assert.ok(MARKER_LIST.includes(marker), marker);
  }
  assert.match(MARKER_LIST, /, \[DATA\] e \[TELEFONE\]$/);
});

test("resposta em partes: o texto só vai para a tela até antes de um marcador incompleto", () => {
  const open = "Hoje a leitura correu bem para [ESTUDANTE 1 e a turma toda participou da roda";
  assert.equal(open.slice(0, restorableLength(open)), "Hoje a leitura correu bem para ");
  assert.equal(restorableLength("curto"), 0);
  const bare = "A professora conversou bastante com estudante 2 depois da aula de hoje";
  assert.equal(bare.slice(0, restorableLength(bare)), "A professora conversou bastante com ");
});
