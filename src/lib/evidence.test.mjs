// Testes do dossiê de evidências: node --test src/lib/evidence.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceGroups, evidenceSummary, itemTotals } from "./evidence.ts";

const now = new Date("2026-10-22T15:00:00Z");
const daysAgo = (days) => new Date(now.getTime() - days * 86_400_000);
const empty = { now, caseStudy: null, plan: null, approvedAdaptations: 0, diaryRecent: 0, aee: { done: 0, absences: 0, cancelled: 0 }, lastReportAt: null, assessmentAt: null, consent: null };
const byId = (groups) => Object.fromEntries(groups.flatMap((group) => group.items).map((item) => [item.id, item]));

const complete = {
  now,
  caseStudy: {
    status: "concluido",
    concludedAt: daysAgo(120),
    content: {
      encaminhadoPor: "Professor(a) da sala comum", motivos: "Comunicação; Interação",
      barreiras: "Comunicacional", potencialidades: "Memória visual",
      necessidades: "Comunicação alternativa e aumentativa; Apoio à autorregulação",
      recursos: "AEE na sala de recursos; Profissional de apoio",
      entrevistados: "Mãe", formaEscuta: "Prancha de comunicação",
      encaminhamentos: "Nenhum", participantes: "Professor(a) do AEE; Família",
    },
  },
  plan: { createdAt: daysAgo(100), reviewedAt: daysAgo(20), reviewDate: new Date("2027-01-15T12:00:00Z"), commonRoomStrategies: "Rotina visual", aeeStrategies: "Prancha", accessibilityResources: "Prancha de comunicação", objectives: 3 },
  approvedAdaptations: 2,
  diaryRecent: 6,
  aee: { done: 7, absences: 1, cancelled: 0 },
  lastReportAt: daysAgo(30),
  assessmentAt: daysAgo(40),
  consent: { aiUse: true, therapistLink: false, decidedAt: daysAgo(90) },
};

test("estudante sem registros: tudo pendente, exceto o que é só para conferir", () => {
  const items = byId(evidenceGroups(empty));
  assert.equal(items.estudo.status, "pendente");
  assert.equal(items.estudo.detail, "Ainda não começou.");
  assert.equal(items.plano.detail, "Depende do estudo de caso concluído.");
  assert.equal(items.paee_ta.status, "conferir");
  assert.equal(items.sondagem.detail, "Sem linha de base.");
  assert.equal(items.laudo.status, "info");
  assert.match(items.autorizacoes.detail, /ainda não decidiu/);
  const summary = evidenceSummary(evidenceGroups(empty));
  assert.equal(summary.ok, 0);
  assert.equal(summary.total, summary.pendente + summary.conferir);
});

test("estudante com tudo registrado: em dia, sem contar as informações", () => {
  const groups = evidenceGroups(complete);
  const summary = evidenceSummary(groups);
  assert.deepEqual(summary, { ok: summary.total, conferir: 0, pendente: 0, total: 19 });
  const items = byId(groups);
  assert.match(items.etapa3.detail, /Comunicação alternativa e aumentativa, Apoio à autorregulação/);
  assert.match(items.paee_ta.detail, /Comunicação alternativa e aumentativa/);
  assert.match(items.paee_profissional.detail, /Profissional de apoio/);
  assert.match(items.aee.detail, /7 realizados, 1 falta e 0 cancelamentos/);
  assert.match(items.autorizacoes.detail, /uso da IA autorizado; conexão com o terapeuta não autorizada/);
  for (const item of groups.flatMap((group) => group.items)) assert.ok(item.norm && item.label && item.short, item.id);
});

test("prazos: revisão anual, revisão marcada, devolutiva e reavaliação", () => {
  const overdue = byId(evidenceGroups({ ...complete, plan: { ...complete.plan, reviewDate: daysAgo(3) } }));
  assert.equal(overdue.revisao.status, "conferir");
  const old = byId(evidenceGroups({ ...complete, plan: { ...complete.plan, createdAt: daysAgo(500), reviewedAt: daysAgo(400) } }));
  assert.equal(old.revisao.status, "pendente");
  assert.match(old.revisao.detail, /há mais de um ano/);
  const stale = byId(evidenceGroups({ ...complete, lastReportAt: daysAgo(260), assessmentAt: daysAgo(100) }));
  assert.equal(stale.pei_devolutiva.status, "conferir");
  assert.equal(stale.sondagem.status, "conferir");
  assert.match(stale.sondagem.detail, /a reavaliação venceu/);
});

test("participação do estudante e atendimentos sem realização", () => {
  const notHeard = byId(evidenceGroups({ ...complete, caseStudy: { ...complete.caseStudy, content: { ...complete.caseStudy.content, formaEscuta: "Não foi possível" } } }));
  assert.equal(notHeard.estudante.status, "conferir");
  const onlyAbsences = byId(evidenceGroups({ ...complete, aee: { done: 0, absences: 2, cancelled: 1 } }));
  assert.equal(onlyAbsences.aee.status, "conferir");
  const noStrategies = byId(evidenceGroups({ ...complete, plan: { ...complete.plan, commonRoomStrategies: "" } }));
  assert.equal(noStrategies.pei_atividades.detail, "Registre no plano as estratégias da sala comum.");
});

test("totais da escola por item, do mais pendente ao menos", () => {
  const students = [evidenceGroups(empty), evidenceGroups(complete), evidenceGroups({ ...complete, lastReportAt: null })].map((groups) => ({ groups }));
  const totals = itemTotals(students);
  assert.deepEqual(totals.find((total) => total.id === "pei_devolutiva"), { id: "pei_devolutiva", short: "Devolutiva", label: "PEI: devolutivas à família", pendente: 2, conferir: 0 });
  assert.equal(totals.find((total) => total.id === "paee_ta").conferir, 1);
  assert.equal(totals[0].pendente, 2);
  assert.ok(!totals.some((total) => total.id === "laudo" || total.id === "autorizacoes"));
});
