// Testes da importação por planilha: node --test src/lib/student-import.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { IMPORT_TEMPLATE, dateOf, mapHeader, parseCsv, readStudentSheet, shiftOf, stageOf, studentKey } from "./student-import.ts";

const today = new Date("2026-10-19T12:00:00Z");

test("CSV do Excel (ponto e vírgula, BOM, aspas) e da vírgula", () => {
  assert.deepEqual(parseCsv('﻿nome;turma\r\n"Ana; da Silva";"Turma ""A"""\r\n\r\n'), [["nome", "turma"], ["Ana; da Silva", 'Turma "A"']]);
  assert.deepEqual(parseCsv("nome,turma\nBia,B"), [["nome", "turma"], ["Bia", "B"]]);
  assert.deepEqual(parseCsv('nome;obs\nCaio;"linha 1\nlinha 2"'), [["nome", "obs"], ["Caio", "linha 1\nlinha 2"]]);
});

test("colunas pelo nome, com acento e maiúscula", () => {
  const { index, missing } = mapHeader(["Nome do Estudante", "Data de Nascimento", "Ano/Série", "Turma", "Turno", "Responsável"]);
  assert.deepEqual(missing, []);
  assert.equal(index.gradeYear, 2);
  assert.deepEqual(mapHeader(["nome", "turma"]).missing, ["nascimento", "ano", "turno", "responsavel"]);
});

test("etapa, data e turno", () => {
  assert.equal(stageOf("Anos Iniciais", ""), "anos_iniciais");
  assert.equal(stageOf("", "3º ano"), "anos_iniciais");
  assert.equal(stageOf("", "7o ano"), "anos_finais");
  assert.equal(stageOf("", "Pré II"), "educacao_infantil");
  assert.equal(stageOf("", "1ª série"), null);
  assert.equal(stageOf("Fundamental II", "1ª série"), "anos_finais");
  assert.equal(dateOf("05/03/2017"), "2017-03-05");
  assert.equal(dateOf("2017-03-05"), "2017-03-05");
  assert.equal(dateOf("31/02/2017"), null);
  assert.equal(dateOf("03/2017"), null);
  assert.equal(shiftOf("Manhã"), "manha");
  assert.equal(shiftOf("vespertino"), "tarde");
  assert.equal(shiftOf("Noturno"), "Noite");
});

test("o modelo para baixar: formato certo, mas os exemplos não viram estudantes", () => {
  const examples = readStudentSheet(IMPORT_TEMPLATE, today);
  assert.deepEqual(examples.rows.map((row) => [row.values, row.errors]), [
    [null, ["linha de exemplo do modelo: apague antes de importar"]],
    [null, ["linha de exemplo do modelo: apague antes de importar"]],
  ]);
  // Com nomes de verdade, as mesmas linhas passam inteiras.
  const { rows, problem } = readStudentSheet(IMPORT_TEMPLATE.replaceAll("Exemplo Estudante", "Estudante"), today);
  assert.equal(problem, null);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.errors), [[], []]);
  assert.equal(rows[0].values.hasAEE, true);
  assert.equal(rows[0].values.shift, "manha");
  assert.equal(rows[1].values.stage, "anos_finais");
  assert.equal(rows[1].values.guardianPhone, null);
});

test("cada linha diz o que falta, e repetidos são apontados", () => {
  const sheet = [
    "nome;nascimento;ano;turma;turno;responsavel;aee;frequencia_aee",
    "Davi Souza;10/10/2030;2º ano;A;manhã;Mãe;sim;",
    "Eva;99/99/2015;1ª série;;tarde;;talvez;",
    "Davi Lima;01/02/2016;4º ano;B;tarde;Pai;não;",
    "davi lima;01/02/2016;4º ano;B;tarde;Pai;não;",
  ].join("\n");
  const { rows } = readStudentSheet(sheet, today);
  assert.deepEqual(rows.map((row) => row.line), [2, 3, 4, 5]);
  assert.deepEqual(rows[0].errors, ["nascimento no futuro", "informe a frequência do AEE (ex.: 2x por semana)"]);
  assert.ok(rows[1].errors.includes("nascimento inválido (use DD/MM/AAAA)"));
  assert.ok(rows[1].errors.includes("turma em branco"));
  assert.ok(rows[1].errors.some((error) => error.startsWith("informe a etapa")));
  assert.ok(rows[1].errors.some((error) => error.startsWith("AEE: use sim ou não")));
  assert.equal(rows[2].errors.length, 0);
  assert.deepEqual(rows[3].errors, ["repetido na planilha (linha 4)"]);
});

test("limites e planilhas sem dados", () => {
  assert.match(readStudentSheet("", today).problem, /vazia/);
  assert.match(readStudentSheet("nome;turma\nAna;A", today).problem, /Faltam colunas/);
  assert.match(readStudentSheet("nome;nascimento;ano;turma;turno;responsavel", today).problem, /só tem o cabeçalho/);
  const many = ["nome;nascimento;ano;turma;turno;responsavel", ...Array.from({ length: 501 }, (_, i) => `Pessoa ${i};01/01/2015;2º ano;A;manhã;R`)].join("\n");
  assert.match(readStudentSheet(many, today).problem, /no máximo 500/);
  assert.equal(studentKey("Ána  Lima", "2015-01-01"), studentKey("ana lima", "2015-01-01"));
});
