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
      encaminhamentos: "Nenhum", participantes: "Professor(a) do AEE; Professor(a) da sala comum; Família",
      impedimentos: "Na fala e na comunicação; Na interação social",
    },
  },
  plan: {
    createdAt: daysAgo(100), reviewedAt: daysAgo(20), reviewDate: new Date("2027-01-15T12:00:00Z"), commonRoomStrategies: "Rotina visual", aeeStrategies: "Prancha", accessibilityResources: "Prancha de comunicação", objectives: 3,
    aeeTeacher: "Ana Souza", regularTeacher: "Bruno Lima", participants: "Família; O próprio estudante", aeeServices: "Comunicação alternativa e aumentativa (CAA)",
    assessmentAccessibility: "Tempo adicional", monitoring: "Registro de aula no diário", familyFeedback: "Relatório do período a cada semestre",
  },
  approvedAdaptations: 2,
  diaryRecent: 6,
  aee: { done: 7, absences: 1, cancelled: 0 },
  lastReportAt: daysAgo(30),
  assessmentAt: daysAgo(40),
  consent: { aiUse: true, therapistLink: false, decidedAt: daysAgo(90) },
  census: { aee: true, services: ["Comunicação alternativa e aumentativa (CAA)"], resources: ["Tempo adicional"], syncedAt: "2026-08-01T12:00:00Z" },
};

test("estudante sem registros: tudo pendente, exceto o que é só para conferir", () => {
  const items = byId(evidenceGroups(empty));
  assert.equal(items.estudo.status, "pendente");
  assert.equal(items.estudo.detail, "Ainda não começou.");
  assert.equal(items.plano.detail, "Depende do estudo de caso concluído.");
  assert.equal(items.paee_ta.status, "conferir");
  assert.equal(items.sondagem.detail, "Sem linha de base.");
  assert.equal(items.laudo.status, "info");
  assert.equal(items.autoria.status, "pendente");
  assert.equal(items.censo_registro.status, "conferir");
  assert.match(items.censo_registro.detail, /Qualquer um deles basta; laudo não pode ser exigido/);
  assert.equal(items.impedimentos.status, "pendente");
  assert.equal(items.conducao.status, "pendente");
  assert.equal(items.censo_plano.status, "info");
  assert.match(items.autorizacoes.detail, /ainda não decidiu/);
  const summary = evidenceSummary(evidenceGroups(empty));
  assert.equal(summary.ok, 0);
  assert.equal(summary.total, summary.pendente + summary.conferir);
});

test("estudante com tudo registrado: em dia, sem contar as informações", () => {
  const groups = evidenceGroups(complete);
  const summary = evidenceSummary(groups);
  assert.ok(summary.total > 0);
  assert.deepEqual(summary, { ok: summary.total, conferir: 0, pendente: 0, total: summary.total });
  const items = byId(groups);
  assert.match(items.etapa3.detail, /Comunicação alternativa e aumentativa, Apoio à autorregulação/);
  assert.match(items.paee_ta.detail, /Comunicação alternativa e aumentativa/);
  assert.match(items.paee_profissional.detail, /Profissional de apoio/);
  assert.equal(items.autoria.detail, "PAEE: Ana Souza. PEI: Bruno Lima. Com: Família, O próprio estudante.");
  assert.equal(items.censo_registro.detail, "Respaldo da declaração: Estudo de caso, PAEE, PEI.");
  assert.equal(items.censo_plano.detail, "Iguais no plano e no arquivo do Censo aplicado em 01/08/2026.");
  assert.equal(items.impedimentos.detail, "Observados: Na fala e na comunicação, Na interação social.");
  assert.match(items.pei_devolutiva.detail, /Previsto no PEI: Relatório do período a cada semestre/);
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

test("PAEE e PEI: o plano vale antes do estudo de caso, e plano antigo pede para completar", () => {
  const recorded = byId(evidenceGroups({ ...complete, plan: { ...complete.plan, assistiveTech: "Avaliado: não há necessidade", supportStaff: "Avaliado: não há necessidade", networkDemands: "Nenhuma demanda" } }));
  assert.equal(recorded.paee_ta.detail, "No plano: Avaliado: não há necessidade.");
  assert.equal(recorded.paee_rede.detail, "No plano: Nenhuma demanda.");
  const older = { ...complete.plan };
  for (const key of ["aeeTeacher", "regularTeacher", "participants", "assessmentAccessibility", "monitoring", "familyFeedback"]) delete older[key];
  const old = byId(evidenceGroups({ ...complete, approvedAdaptations: 0, plan: older }));
  assert.equal(old.autoria.status, "conferir");
  assert.equal(old.autoria.detail, "Registre no plano: professor(a) do AEE, professor(a) da classe comum, participação da família.");
  assert.equal(old.pei_monitoramento.status, "conferir");
  assert.match(old.pei_monitoramento.detail, /Registre no PEI como o plano será acompanhado/);
  assert.equal(old.pei_acessibilidade.status, "conferir");
  assert.match(old.pei_acessibilidade.detail, /Registre no PEI a acessibilidade na avaliação/);
  assert.equal(byId(evidenceGroups({ ...complete, plan: older })).pei_acessibilidade.status, "ok");
});

test("Censo: estudo de caso concluído basta, mesmo sem plano", () => {
  const items = byId(evidenceGroups({ ...complete, plan: null }));
  assert.equal(items.censo_registro.status, "ok");
  assert.equal(items.censo_registro.detail, "Respaldo da declaração: Estudo de caso.");
  const draft = byId(evidenceGroups({ ...complete, caseStudy: { ...complete.caseStudy, status: "rascunho" }, plan: null }));
  assert.equal(draft.censo_registro.status, "conferir");
});

test("estudo de caso como o INEP descreve: impedimentos e condução pelo AEE", () => {
  const content = { ...complete.caseStudy.content, participantes: "Família", impedimentos: "" };
  const items = byId(evidenceGroups({ ...complete, caseStudy: { ...complete.caseStudy, content } }));
  assert.equal(items.impedimentos.status, "conferir");
  assert.equal(items.conducao.status, "conferir");
  assert.equal(items.conducao.detail, "Registre em Quem participou: professor(a) do AEE e professor(a) da sala comum.");
});

test("plano e Censo: diferença, plano incompleto e estudante sem arquivo", () => {
  const other = byId(evidenceGroups({ ...complete, census: { aee: true, services: ["Desenvolvimento de funções cognitivas"], resources: [] } }));
  assert.equal(other.censo_plano.status, "conferir");
  assert.equal(other.censo_plano.detail, "No último arquivo do Censo: atendimentos do AEE: Desenvolvimento de funções cognitivas; recursos nas avaliações do INEP: nenhum. Confira o plano ou o Educacenso.");
  const incomplete = byId(evidenceGroups({ ...complete, plan: { ...complete.plan, aeeServices: null } }));
  assert.equal(incomplete.censo_plano.status, "conferir");
  assert.match(incomplete.censo_plano.detail, /Registre no PEI os atendimentos do AEE/);
  assert.equal(byId(evidenceGroups({ ...complete, census: null })).censo_plano.status, "info");
});
