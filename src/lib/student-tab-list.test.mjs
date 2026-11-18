import { test } from "node:test";
import assert from "node:assert/strict";
import { STUDENT_TABS, activityViews, isTabVisible, visibleTabs } from "./student-tab-list.ts";
import { TRAIL_STEPS } from "./student-journey.ts";

const team = { edit: true, dua: true };
const reader = { edit: false, dua: false };
const labels = (tabs, group) => tabs.filter((tab) => tab.group === group).map((tab) => tab.label);

test("abas fixas: Resumo, os seis passos na ordem da trilha e o restante em Mais", () => {
  assert.deepEqual(labels(STUDENT_TABS, "resumo"), ["Resumo"]);
  assert.deepEqual(labels(STUDENT_TABS, "trilha"), TRAIL_STEPS.map((step) => step.label));
  assert.deepEqual(labels(STUDENT_TABS, "mais"), ["Sondagem", "Atendimentos AEE", "Materiais de apoio", "Relatórios", "Dossiê", "Carteirinha"]);
  assert.deepEqual(visibleTabs(team).map((tab) => tab.label), STUDENT_TABS.map((tab) => tab.label));
});

test("leitura com motivo: só o que não altera a ficha; a vista com DUA pede edição e DUA", () => {
  assert.deepEqual(visibleTabs(reader).map((tab) => tab.slug), ["", "estudo-de-caso", "ppi", "linha-do-tempo", "sondagem", "materiais", "relatorios", "dossie"]);
  for (const slug of ["perfil", "atividades", "atividades/dua", "diario", "atendimentos-aee", "carteirinha"]) assert.equal(isTabVisible(slug, reader), false, slug);
  assert.equal(isTabVisible("atividades/dua", team), true);
  assert.equal(isTabVisible("atividades/dua", { edit: true, dua: false }), false);
  assert.equal(isTabVisible("atividades/dua", { edit: false, dua: true }), false);
  assert.equal(isTabVisible("dua", team), false);
});

test("o passo Atividade tem duas vistas só para quem planeja com DUA", () => {
  assert.deepEqual(activityViews(team).map((view) => view.slug), ["atividades", "atividades/dua"]);
  assert.deepEqual(activityViews({ edit: true, dua: false }).map((view) => view.slug), ["atividades"]);
  assert.deepEqual(activityViews(reader), []);
});
