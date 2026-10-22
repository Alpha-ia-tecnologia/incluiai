// Testes do relatório do período: node --test src/lib/period-report.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { currentSemester, draftOpinion, lessSupport, opinionProblem, periodProblem, supportAt, topItems } from "./period-report.ts";

const at = (iso) => new Date(`${iso}T12:00:00-03:00`);

test("semestre de referência", () => {
  assert.deepEqual(currentSemester(at("2026-10-22")), { start: "2026-07-01", end: "2026-12-31" });
  assert.deepEqual(currentSemester(at("2026-03-02")), { start: "2026-01-01", end: "2026-06-30" });
});

test("período válido", () => {
  const today = at("2026-10-22");
  assert.equal(periodProblem("2026-07-01", "2026-12-31", today), null);
  assert.match(periodProblem("2026-12-31", "2026-07-01", today), /depois do começo/);
  assert.match(periodProblem("2026-11-01", "2026-12-31", today), /precisa ter começado/);
  assert.match(periodProblem("2025-01-01", "2026-06-30", today), /até um ano/);
  assert.match(periodProblem("", "2026-06-30", today), /Informe/);
});

test("apoio numa data: último registro até ali, ou o do início", () => {
  const entries = [{ date: at("2026-08-01"), supportLevel: 4 }, { date: at("2026-09-01"), supportLevel: 3 }, { date: at("2026-11-01"), supportLevel: 2 }];
  assert.equal(supportAt(entries, at("2026-07-01"), 5), 5);
  assert.equal(supportAt(entries, at("2026-10-01"), 5), 3);
  assert.equal(supportAt([], at("2026-10-01"), null), null);
});

test("o que mais funcionou, sem repetir", () => {
  assert.deepEqual(topItems(["Apoio visual", "apoio visual", " Pausa ", "Música", "Pausa", ""], 2), ["Apoio visual", "Pausa"]);
});

const data = {
  version: 1,
  period: { start: "2026-07-01", end: "2026-12-31" },
  student: { name: "Dante Oliveira", gradeYear: "2º ano", className: "Turma B", school: "EMEF" },
  caseStudy: { concluded: true, synthesis: "Comunica-se pela prancha.", needs: [] },
  objectives: [
    { description: "Dante identificará o próprio nome.", dimension: "Leitura", bncc: null, status: "ativo", supportStart: 3, supportEnd: 2, records: 6 },
    { description: "Dante pedirá pausa.", dimension: "Regulação", bncc: null, status: "ativo", supportStart: 3, supportEnd: 3, records: 2 },
  ],
  aee: { done: 12, absences: 1, cancelled: 2 },
  strategies: ["Apoio visual", "Pausa programada"],
  activities: [],
  materials: [],
  familyNotes: 3,
  therapistReports: 0,
};

test("rascunho do parecer a partir dos registros", () => {
  const text = draftOpinion(data);
  assert.match(text, /Entre 01\/07\/2026 e 31\/12\/2026, Dante participou de 12 atendimentos no AEE, com 1 falta\./);
  assert.match(text, /Em 1 de 2 objetivos, passou a precisar de menos apoio: Dante identificará o próprio nome\./);
  assert.match(text, /O que mais ajudou: Apoio visual, Pausa programada\./);
  assert.match(text, /3 observações de casa/);
  assert.equal(lessSupport(data.objectives[1]), false);
  assert.match(draftOpinion({ ...data, aee: { done: 0, absences: 0, cancelled: 0 } }), /não há atendimentos do AEE registrados/);
  assert.match(draftOpinion({ ...data, aee: { done: 0, absences: 3, cancelled: 0 } }), /não teve atendimento do AEE realizado: foram 3 faltas\./);
  assert.match(text, /período\]$/);
  const withAssessment = draftOpinion({ ...data, assessment: [{ label: "Comunicação e linguagem", start: 3.5, end: 2 }, { label: "Matemática", start: 2, end: 2 }] });
  assert.match(withAssessment, /Na sondagem, passou a precisar de menos apoio em comunicação e linguagem\./);
});

test("parecer pronto para validar", () => {
  assert.match(opinionProblem("curto"), /pelo menos algumas frases/);
  assert.match(opinionProblem(draftOpinion(data)), /entre colchetes/);
  assert.equal(opinionProblem(draftOpinion(data).replace(/\[complete[^\]]*\]/, "manter a prancha e ampliar a leitura de palavras.")), null);
});
