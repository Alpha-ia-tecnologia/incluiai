import { test } from "node:test";
import assert from "node:assert/strict";
import { LEGACY_ANCHORS, SCHOOL_HELP_SHARE, advancingCount, groupByTrend, needsHelp, panelViews, parseView, recentRecord, schoolsNeedingHelp, trendGroupOf, trendGroupsSentence } from "./panel-overview.ts";

const NOW = new Date("2026-11-18T15:00:00-03:00");
const day = (offset) => new Date(NOW.getTime() + offset * 86_400_000);

test("vistas: a Visão geral é o padrão; Equipe só para a rede; endereço desconhecido cai na Visão geral", () => {
  assert.deepEqual(panelViews({ network: false }).map((view) => view.key), ["geral", "objetivos", "aulas", "atividades", "perfil", "familia"]);
  assert.equal(panelViews({ network: true }).at(-1).key, "equipe");
  assert.equal(parseView(undefined, { network: true }), "geral");
  assert.equal(parseView("aulas", { network: false }), "aulas");
  assert.equal(parseView("equipe", { network: false }), "geral");
  assert.equal(parseView("equipe", { network: true }), "equipe");
  assert.equal(parseView("ia", { network: true }), "geral");
});

test("âncoras antigas levam a uma vista que existe", () => {
  const keys = new Set(panelViews({ network: true }).map((view) => view.key));
  for (const view of Object.values(LEGACY_ANCHORS)) assert.ok(keys.has(view), view);
  assert.equal(LEGACY_ANCHORS.dua, "atividades");
  assert.equal(LEGACY_ANCHORS.atencao, undefined, "#atencao continua na Visão geral");
});

test("registro recente: o mesmo limite do aviso de registro (14 dias)", () => {
  assert.equal(recentRecord(null, NOW), false);
  assert.equal(recentRecord(day(-13), NOW), true);
  assert.equal(recentRecord(day(-14), NOW), false);
});

const school = (name, students, withAlerts) => ({ id: name, name, students, withAlerts, byKind: [] });

test("escola precisa de ajuda a partir de 1 em cada 5 estudantes com aviso", () => {
  assert.equal(SCHOOL_HELP_SHARE, 0.2);
  assert.equal(needsHelp(school("A", 10, 2)), true);
  assert.equal(needsHelp(school("B", 10, 1)), false);
  assert.equal(needsHelp(school("C", 1, 1)), true);
  assert.equal(needsHelp(school("D", 0, 0)), false);
  assert.equal(needsHelp(school("E", 5, 0)), false);
});

test("escolas acima do limite primeiro, da maior parte com aviso para a menor; as outras por nome", () => {
  const { flagged, others } = schoolsNeedingHelp([school("Zé", 10, 1), school("Beta", 10, 3), school("Alfa", 4, 2), school("Caju", 8, 0)]);
  assert.deepEqual(flagged.map((item) => item.name), ["Alfa", "Beta"]);
  assert.deepEqual(others.map((item) => item.name), ["Caju", "Zé"]);
});

const reading = (trend, reason) => ({ trend, reason });

test("tendência: meta alcançada tem grupo próprio; os grupos seguem a ordem de leitura e somem vazios", () => {
  assert.equal(trendGroupOf(reading("avancando", "meta")), "meta");
  assert.equal(trendGroupOf(reading("avancando", "menos_apoio")), "avancando");
  assert.equal(trendGroupOf(reading("estavel", "sem_avanco")), "estavel");
  assert.equal(trendGroupOf(reading("atencao", "recusas")), "atencao");
  const items = [reading("sem_dados", "poucos"), reading("avancando", "meta"), reading("estavel", "estavel"), reading("avancando", "menos_apoio"), reading("sem_dados", "poucos")];
  const groups = groupByTrend(items, (item) => item);
  assert.deepEqual(groups.map((group) => [group.key, group.items.length]), [["meta", 1], ["avancando", 1], ["estavel", 1], ["sem_dados", 2]]);
  assert.equal(advancingCount(groups), 2);
});

test("frase dos degraus agregados, para o leitor de tela", () => {
  const groups = groupByTrend([reading("avancando", "meta"), reading("estavel", "estavel"), reading("estavel", "sem_avanco"), reading("atencao", "mais_apoio")], (item) => item);
  assert.equal(trendGroupsSentence(groups), "4 objetivos em acompanhamento: 1 com a meta alcançada, 2 estáveis, 1 pede atenção.");
  assert.equal(trendGroupsSentence([]), "Nenhum objetivo em acompanhamento.");
});
