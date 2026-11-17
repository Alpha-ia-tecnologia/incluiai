import assert from "node:assert/strict";
import { test } from "node:test";
import { PLAN_AGENT_NAMES, checkObjectives, checkPaee, checkPei, normalizePlanProposal, runPlanAgents } from "./agents/plan-graph.ts";
import { CaseAnalysisSchema, ObjectivesProposalSchema, PaeeProposalSchema, PeiProposalSchema, PlanProposalSchema, PlanReviewSchema } from "./agents/schemas.ts";
import { NO_NEED, NO_RESOURCE, canonicalItems, mergeProposalDefaults, missingPlanItems } from "./plan-documents.ts";

const CONTEXT = "Estudante de 7 anos, 2º ano. Frequenta o AEE.\n\n## Estudo de caso\nNecessidades educacionais identificadas: Comunicação alternativa e aumentativa";
const analysis = { sintese: "Participa com apoio visual.", potencialidades: ["Memória visual"], barreiras: ["Instruções só orais"], prioridades: [{ dimension: "comunicacao", justificativa: "Pede por gestos." }], cuidados: ["Avisar as trocas"] };
const paee = (extra = {}) => ({ accessibilityResources: ["Rotina visual"], assistiveTech: ["prancha de comunicação"], supportStaff: [NO_NEED], networkDemands: ["Formação em comunicação alternativa"], ...extra });
const pei = (extra = {}) => ({
  aeeServices: ["Comunicação alternativa e aumentativa (CAA)"], aeeStrategies: ["Ensino do uso da prancha"], commonRoomStrategies: ["Instruções em uma etapa, com apoio visual"],
  assessmentAccessibility: ["Tempo adicional"], monitoring: ["Registro de aula no diário"], familyFeedback: ["Reunião com a família a cada bimestre"], ...extra,
});
const objective = (extra = {}) => ({ dimension: "comunicacao", action: "Comunicará três necessidades da rotina escolar.", condition: "usando prancha de comunicação", criterion: "em 4 de 5 tentativas", deadlineWeeks: 8, currentSupport: 3, targetSupport: 2, bnccCode: null, rationale: "Pede por gestos.", ...extra });
const objectives = (extra = {}) => ({ initialSituation: ["Aponta o que quer"], reviewWeeks: 12, objectives: [objective(), objective({ dimension: "autonomia", action: "organizará o material no início da aula" })], ...extra });
const PARTS = ["paee", "pei", "objetivos"];
const approveAll = { avaliacoes: PARTS.map((parte) => ({ parte, aprovado: true, problemas: [] })) };
const reject = (part, problema) => ({ avaliacoes: PARTS.map((parte) => ({ parte, aprovado: parte !== part, problemas: parte === part ? [{ alvo: part, problema, correcao: "Corrija." }] : [] })) });

function fakeModel({ reviews = [approveAll], answers = {} } = {}) {
  const calls = [];
  const count = (agent) => calls.filter((call) => call.agent === agent).length;
  const model = async (request) => {
    calls.push(request);
    const nth = count(request.agent);
    const pick = (key, fallback) => (answers[key] ? answers[key](nth) : fallback);
    if (request.agent === PLAN_AGENT_NAMES.analista) { assert.equal(request.schema, CaseAnalysisSchema); return analysis; }
    if (request.agent === PLAN_AGENT_NAMES.paee) { assert.equal(request.schema, PaeeProposalSchema); return pick("paee", paee()); }
    if (request.agent === PLAN_AGENT_NAMES.pei) { assert.equal(request.schema, PeiProposalSchema); return pick("pei", pei()); }
    if (request.agent === PLAN_AGENT_NAMES.objetivos) { assert.equal(request.schema, ObjectivesProposalSchema); return pick("objetivos", objectives()); }
    assert.equal(request.schema, PlanReviewSchema);
    return reviews[Math.min(reviews.length - 1, nth - 1)];
  };
  return { model, calls, count };
}

test("aprovado de primeira: analista, PAEE, PEI e objetivos em paralelo, revisor; a proposta traz os 10 itens", async () => {
  const fake = fakeModel();
  const { proposal, analysis: read, trace } = await runPlanAgents(CONTEXT, fake.model);
  assert.equal(fake.calls.length, 5);
  assert.equal(fake.calls[0].agent, PLAN_AGENT_NAMES.analista);
  assert.equal(fake.calls.at(-1).agent, PLAN_AGENT_NAMES.revisor);
  assert.equal(read, analysis);
  assert.deepEqual(trace.map((step) => step.agent).slice(-2), [PLAN_AGENT_NAMES.revisor, "Finalização"]);
  assert.deepEqual(proposal.assistiveTech, ["Prancha de comunicação"]);
  assert.deepEqual(proposal.aeeServices, ["Comunicação alternativa e aumentativa (CAA)"]);
  assert.equal(proposal.objectives[0].action, "comunicará três necessidades da rotina escolar");
  assert.equal(proposal.objectives[0].criterion, "4 de 5 tentativas");
  const missing = missingPlanItems(mergeProposalDefaults({}, proposal));
  assert.deepEqual([missing.paee, missing.pei], [[], []]);
  assert.doesNotThrow(() => PlanProposalSchema.parse(JSON.parse(JSON.stringify(proposal))));
});

test("cada agente recebe o caso e a análise; PAEE e PEI recebem só as opções dos seus campos", async () => {
  const fake = fakeModel();
  await runPlanAgents(CONTEXT, fake.model);
  const call = (agent) => fake.calls.find((item) => item.agent === agent);
  for (const agent of [PLAN_AGENT_NAMES.paee, PLAN_AGENT_NAMES.pei, PLAN_AGENT_NAMES.objetivos, PLAN_AGENT_NAMES.revisor]) {
    assert.match(call(agent).prompt, /Frequenta o AEE/);
    assert.match(call(agent).prompt, /Análise do caso:\n\{"sintese"/);
  }
  assert.match(call(PLAN_AGENT_NAMES.paee).prompt, /- supportStaff: Avaliado: não há necessidade; Profissional de apoio escolar/);
  assert.doesNotMatch(call(PLAN_AGENT_NAMES.paee).prompt, /aeeServices/);
  assert.match(call(PLAN_AGENT_NAMES.pei).prompt, /- aeeServices: Desenvolvimento de funções cognitivas;/);
  assert.match(call(PLAN_AGENT_NAMES.pei).prompt, /- assessmentAccessibility: Auxílio ledor;/);
  assert.match(call(PLAN_AGENT_NAMES.pei).system, /art\. 11/);
  assert.match(call(PLAN_AGENT_NAMES.paee).system, /art\. 10/);
  assert.doesNotMatch(call(PLAN_AGENT_NAMES.objetivos).prompt, /Opções de cada campo/);
  assert.match(call(PLAN_AGENT_NAMES.revisor).prompt, /Proposta a revisar:\n\{"paee"/);
});

test("parte devolvida: só o agente dela refaz, com os problemas e a versão anterior", async () => {
  const fake = fakeModel({ reviews: [reject("pei", "As atividades do AEE não usam a prancha prevista no PAEE."), approveAll] });
  const { trace } = await runPlanAgents(CONTEXT, fake.model);
  assert.equal(fake.count(PLAN_AGENT_NAMES.pei), 2);
  assert.equal(fake.count(PLAN_AGENT_NAMES.paee), 1);
  assert.equal(fake.count(PLAN_AGENT_NAMES.objetivos), 1);
  assert.equal(fake.count(PLAN_AGENT_NAMES.revisor), 2);
  const redo = fake.calls.filter((call) => call.agent === PLAN_AGENT_NAMES.pei)[1];
  assert.match(redo.prompt, /não usam a prancha prevista no PAEE/);
  assert.match(redo.prompt, /Versão anterior:\n\{"aeeServices"/);
  assert.ok(trace.some((step) => step.agent === PLAN_AGENT_NAMES.revisor && step.summary === "Devolveu para correção: PEI."));
  assert.equal(trace.at(-2).summary, "Aprovou o PAEE, o PEI e os objetivos.");
});

test("checagens da plataforma valem mesmo com o revisor aprovando; o que sobra vai para o professor", async () => {
  const broken = pei({ aeeServices: ["Reforço escolar", "Ensino de Libras"], familyFeedback: [] });
  const fake = fakeModel({ answers: { pei: () => broken } });
  const { proposal, trace } = await runPlanAgents(CONTEXT, fake.model);
  assert.equal(fake.count(PLAN_AGENT_NAMES.pei), 2);
  assert.equal(fake.count(PLAN_AGENT_NAMES.revisor), 2);
  assert.match(fake.calls.filter((call) => call.agent === PLAN_AGENT_NAMES.pei)[1].prompt, /"Reforço escolar" não é um tipo de atendimento do Censo Escolar/);
  assert.deepEqual(proposal.aeeServices, ["Ensino de Libras"]);
  assert.deepEqual(proposal.familyFeedback, []);
  assert.match(trace.at(-1).summary, /Ponto\(s\) para o professor conferir:.*Não diz como a família recebe a devolutiva\./);
  assert.equal(trace.at(-2).summary, "Ainda há pontos a conferir em: PEI.");
});

test("checagens por parte: profissional fora da lista, classe comum vazia, objetivo sem verbo no futuro, linguagem clínica", () => {
  assert.deepEqual(checkPaee(paee()), []);
  assert.match(checkPaee(paee({ supportStaff: ["Cuidador"] }))[0].problema, /"Cuidador" não está na lista/);
  assert.equal(checkPaee(paee({ accessibilityResources: ["Material indicado no laudo"] }))[0].problema, "Há linguagem clínica.");
  assert.deepEqual(checkPei(pei()), []);
  assert.deepEqual(checkPei(pei({ commonRoomStrategies: [], monitoring: [" "] })).map((item) => item.alvo), ["PEI: classe comum", "PEI: acompanhamento"]);
  assert.deepEqual(checkObjectives(objectives()), []);
  const bad = checkObjectives(objectives({ objectives: [objective({ action: "identifica o nome", criterion: "quase sempre", targetSupport: 3 })] }));
  assert.equal(bad.length, 3);
  assert.ok(bad.every((item) => item.alvo === "objetivo 1"));
});

test("nomes das listas: grafia do formulário, 'não precisa' só sozinho, tipos de AEE e profissionais só da lista", () => {
  assert.deepEqual(canonicalItems(["tempo adicional.", "Prova ampliada (fonte 18)", "Tempo adicional"], ["Tempo adicional", "Prova ampliada (fonte 18)"]), ["Tempo adicional", "Prova ampliada (fonte 18)"]);
  assert.deepEqual(canonicalItems(["Mesa inclinada; com apoio"], ["Prancha de comunicação"]), ["Mesa inclinada, com apoio"]);
  assert.deepEqual(canonicalItems(["Cuidador", "guia-intérprete"], ["Guia-intérprete"], { strict: true }), ["Guia-intérprete"]);
  assert.deepEqual(canonicalItems([NO_NEED, "Acionador"], [NO_NEED, "Acionador"]), ["Acionador"]);
  assert.deepEqual(canonicalItems([NO_RESOURCE], [NO_RESOURCE, "Tempo adicional"]), [NO_RESOURCE]);
  const normalized = normalizePlanProposal({ ...paee({ supportStaff: ["Cuidador"] }), ...pei({ aeeServices: ["ensino de libras", "Reforço"] }), ...objectives() });
  assert.deepEqual(normalized.supportStaff, []);
  assert.deepEqual(normalized.aeeServices, ["Ensino de Libras"]);
});

test("formulário: o que o estudo de caso registrou e o que a proposta trouxe se somam, sem repetir", () => {
  const merged = mergeProposalDefaults(
    { aeeTeacher: "Beatriz", assistiveTech: "Prancha de comunicação", supportStaff: "Profissional de apoio escolar", aeeServices: "Ensino de Libras" },
    { assistiveTech: ["Prancha de comunicação", "Acionador"], supportStaff: [NO_NEED], aeeServices: ["Comunicação alternativa e aumentativa (CAA)"], monitoring: ["Registro de aula no diário"], familyFeedback: [] },
  );
  assert.equal(merged.aeeTeacher, "Beatriz");
  assert.equal(merged.assistiveTech, "Prancha de comunicação; Acionador");
  assert.equal(merged.supportStaff, "Profissional de apoio escolar");
  assert.equal(merged.aeeServices, "Ensino de Libras; Comunicação alternativa e aumentativa (CAA)");
  assert.equal(merged.monitoring, "Registro de aula no diário");
  assert.equal(merged.familyFeedback, null);
});

test("rascunho gravado antes dos campos do PAEE e do PEI continua legível", () => {
  const old = { initialSituation: ["Aponta o que quer"], commonRoomStrategies: ["Rotina visual"], aeeStrategies: [], accessibilityResources: [], reviewWeeks: 12, objectives: [objective()] };
  const parsed = PlanProposalSchema.parse(old);
  assert.deepEqual([parsed.assistiveTech, parsed.aeeServices, parsed.monitoring, parsed.familyFeedback], [[], [], [], []]);
  assert.equal(mergeProposalDefaults({}, parsed).commonRoomStrategies, "Rotina visual");
});

test("vários agentes falhando juntos: chega o erro original, não o agregado do grafo", async () => {
  const model = async (request) => {
    if (request.agent === PLAN_AGENT_NAMES.analista) return analysis;
    throw new Error("limite de uso atingido");
  };
  await assert.rejects(runPlanAgents(CONTEXT, model), (error) => !(error instanceof AggregateError) && /limite de uso/.test(error.message));
});
