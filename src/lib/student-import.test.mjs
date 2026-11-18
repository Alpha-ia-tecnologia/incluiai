import { test } from "node:test";
import assert from "node:assert/strict";
import { IMPORT_TEMPLATE, readStudentSheet } from "./student-import.ts";
import { readStudentRecord } from "./student-record.ts";

const today = new Date("2026-10-19T12:00:00Z");

const rowsOf = (text) => readStudentSheet(text, today).rows;

test("CSV do Excel (ponto e vírgula, BOM, aspas) e da vírgula", () => {
  const excel = rowsOf('\uFEFFnome;nascimento;ano;turma;turno;responsavel\r\n"Ana; da Silva";05/03/2017;2º ano;"Turma ""A""";manhã;Mãe\r\n\r\n');
  assert.deepEqual(excel.map((row) => [row.values.name, row.values.className]), [["Ana; da Silva", 'Turma "A"']]);
  assert.equal(rowsOf("nome,nascimento,ano,turma,turno,responsavel\nBia,05/03/2017,2º ano,B,tarde,Pai")[0].values.className, "B");
  const multiline = rowsOf('nome;nascimento;ano;turma;turno;responsavel\nCaio;05/03/2017;2º ano;C;tarde;"Mãe\nou Pai"');
  assert.deepEqual(multiline.map((row) => row.values.guardianName), ["Mãe ou Pai"]);
});

test("colunas pelo nome, com acento e maiúscula; a que falta é dita pelo nome do modelo", () => {
  const [row] = rowsOf("Nome do Estudante;Data de Nascimento;Ano/Série;Turma;Turno;Responsável\nAna Lima;05/03/2017;3º ano;A;manhã;Mãe");
  assert.deepEqual([row.values.gradeYear, row.values.guardianName], ["3º ano", "Mãe"]);
  assert.match(readStudentSheet("nome;turma\nAna;A", today).problem, /Faltam colunas na primeira linha: nascimento, ano, turno, responsavel\./);
});

test("etapa, data e turno", () => {
  const fields = { name: "Ana Lima", birthDate: "05/03/2017", stage: "", gradeYear: "3º ano", className: "A", shift: "manhã", guardianName: "Mãe", supportProfessional: false };
  const read = (overrides) => readStudentRecord({ ...fields, ...overrides }, today);
  const value = (key, overrides) => read(overrides).record?.[key] ?? null;
  const invalid = (overrides) => read(overrides).problems.map((item) => item.field);
  assert.equal(value("stage", { stage: "Anos Iniciais" }), "anos_iniciais");
  assert.equal(value("stage", { gradeYear: "3º ano" }), "anos_iniciais");
  assert.equal(value("stage", { gradeYear: "7o ano" }), "anos_finais");
  assert.equal(value("stage", { gradeYear: "Pré II" }), "educacao_infantil");
  assert.deepEqual(invalid({ gradeYear: "1ª série" }), ["stage"]);
  assert.equal(value("stage", { stage: "Fundamental II", gradeYear: "1ª série" }), "anos_finais");
  assert.equal(value("birthDate", { birthDate: "05/03/2017" }), "2017-03-05");
  assert.equal(value("birthDate", { birthDate: "2017-03-05" }), "2017-03-05");
  assert.deepEqual(invalid({ birthDate: "31/02/2017" }), ["birthDate"]);
  assert.deepEqual(invalid({ birthDate: "03/2017" }), ["birthDate"]);
  assert.equal(value("shift", { shift: "Manhã" }), "manha");
  assert.equal(value("shift", { shift: "vespertino" }), "tarde");
  assert.equal(value("shift", { shift: "Noturno" }), "noite");
});

test("o modelo para baixar: formato certo, mas os exemplos não viram estudantes", () => {
  const examples = readStudentSheet(IMPORT_TEMPLATE, today);
  assert.deepEqual(examples.rows.map((row) => [row.values, row.errors]), [
    [null, ["linha de exemplo do modelo: apague antes de importar"]],
    [null, ["linha de exemplo do modelo: apague antes de importar"]],
  ]);
  const { rows, problem } = readStudentSheet(IMPORT_TEMPLATE.replaceAll("Exemplo Estudante", "Estudante"), today);
  assert.equal(problem, null);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.errors), [[], []]);
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
  assert.deepEqual(rows[0].errors, ["nascimento no futuro"]);
  assert.ok(rows[1].errors.includes("nascimento inválido (use DD/MM/AAAA)"));
  assert.ok(rows[1].errors.includes("turma em branco"));
  assert.ok(rows[1].errors.some((error) => error.startsWith("informe a etapa")));
  assert.ok(!rows[1].errors.some((error) => error.startsWith("AEE")));
  assert.equal(rows[2].errors.length, 0);
  assert.deepEqual(rows[3].errors, ["repetido na planilha (linha 4)"]);
});

test("limites e planilhas sem dados", () => {
  assert.match(readStudentSheet("", today).problem, /vazia/);
  assert.match(readStudentSheet("nome;turma\nAna;A", today).problem, /Faltam colunas/);
  assert.match(readStudentSheet("nome;nascimento;ano;turma;turno;responsavel", today).problem, /só tem o cabeçalho/);
  const many = ["nome;nascimento;ano;turma;turno;responsavel", ...Array.from({ length: 501 }, (_, i) => `Pessoa ${i};01/01/2015;2º ano;A;manhã;R`)].join("\n");
  assert.match(readStudentSheet(many, today).problem, /no máximo 500/);
});

test("o formulário de cadastro segue as mesmas regras da planilha", () => {
  const fields = { name: "  Ana   Lima ", birthDate: "2017-03-05", stage: "anos_iniciais", gradeYear: "2º ano", className: "Turma A", shift: "manha", guardianName: "Rosa  Lima", guardianPhone: "", aeeFrequency: "2x por semana", accessibilityNotes: "", supportProfessional: true };
  const { record, problems } = readStudentRecord(fields, today);
  assert.deepEqual(problems, []);
  assert.deepEqual(record, { name: "Ana Lima", birthDate: "2017-03-05", stage: "anos_iniciais", gradeYear: "2º ano", className: "Turma A", shift: "manha", guardianName: "Rosa Lima", guardianPhone: null, aeeFrequency: "2x por semana", accessibilityNotes: null, supportProfessional: true });
  const wrong = readStudentRecord({ ...fields, name: "Al", birthDate: "2030-01-01", stage: "fundamental_3", className: " " }, today);
  assert.equal(wrong.record, null);
  assert.deepEqual(wrong.problems.map((item) => item.field), ["name", "birthDate", "stage", "className"]);
  assert.ok(wrong.problems.some((item) => item.message === 'etapa não reconhecida ("fundamental_3")'));
});
