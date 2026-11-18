import { test } from "node:test";
import assert from "node:assert/strict";
import { JOURNEY_STEPS, journeyFacts, nextStepOf } from "./student-journey.ts";

const row = (extra = {}) => ({ id: "e1", caseStudy: null, profile: null, plans: [], activities: [], diaryEntries: [], ...extra });
const activePlan = (objectives = [{ status: "ativo" }]) => ({ status: "ativo", objectives });

test("os fatos da jornada vêm das linhas completas ou já filtradas, com a mesma regra", () => {
  const full = journeyFacts(row({
    caseStudy: { status: "concluido" },
    plans: [{ status: "encerrado", objectives: [{ status: "ativo" }] }, activePlan([{ status: "alcancado" }])],
    activities: [{ status: "sugerida" }, { status: "rejeitada" }],
  }));
  assert.deepEqual(full, { caseStudy: "concluido", hasProfile: false, hasPlan: true, hasObjective: false, hasPreparedActivity: false, hasDiary: false });
  assert.equal(journeyFacts(row({ activities: [{ status: "aplicada" }] })).hasPreparedActivity, true);
});

test("próximo passo segue a ordem das etapas; o plano dispensa o estudo de caso em rascunho", () => {
  assert.equal(nextStepOf(row()).step, 1);
  assert.equal(nextStepOf(row({ caseStudy: { status: "concluido" } })).label, "Criar o plano de ensino");
  assert.equal(nextStepOf(row({ caseStudy: { status: "rascunho" }, plans: [activePlan()] })).label, "Conhecer o estudante");
  const ready = row({ caseStudy: { status: "concluido" }, profile: {}, plans: [activePlan()], activities: [{ status: "aceita" }], diaryEntries: [{}] });
  assert.equal(nextStepOf(ready).step, JOURNEY_STEPS.length);
  assert.equal(JOURNEY_STEPS.filter((step) => step.done(journeyFacts(ready))).length, JOURNEY_STEPS.length);
});
