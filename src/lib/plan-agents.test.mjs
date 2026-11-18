import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePlanProposal, runPlanAgents } from "./agents/plan-graph.ts";
import { PLAN_PIPELINE } from "./agents/descriptors.ts";
import { PlanProposalSchema } from "./agents/schemas.ts";
import { PAEE_ITEMS, PEI_ITEMS, canonicalItems, mergeProposalDefaults, missingPlanItems } from "./plan-documents.ts";

const PLAN_AGENT_NAMES = { analista: PLAN_PIPELINE.preparer, ...PLAN_PIPELINE.writers, revisor: PLAN_PIPELINE.reviewer };
const NO_NEED = "Avaliado: não há necessidade";
const NO_RESOURCE = "Nenhum recurso";
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
    const byAgent = {
      [PLAN_AGENT_NAMES.analista]: () => analysis,
      [PLAN_AGENT_NAMES.paee]: () => pick("paee", paee()),
      [PLAN_AGENT_NAMES.pei]: () => pick("pei", pei()),
      [PLAN_AGENT_NAMES.objetivos]: () => pick("objetivos", objectives()),
      [PLAN_AGENT_NAMES.revisor]: () => reviews[Math.min(reviews.length - 1, nth - 1)],
    };
    const answer = byAgent[request.agent]();
    request.schema.parse(answer);
    return answer;
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
  assert.doesNotMatch(trace.at(-1).summary, /para o professor conferir/);
});

const optionsOf = (items) => new Set(items.flatMap((item) => item.options ?? []));
const only = (mine, theirs) => [...mine].filter((option) => !theirs.has(option) && !CONTEXT.includes(option));

test("cada agente recebe o caso e a análise; PAEE e PEI recebem só as opções dos seus campos; o revisor recebe a proposta", async () => {
  const fake = fakeModel();
  await runPlanAgents(CONTEXT, fake.model);
  const prompt = (agent) => fake.calls.find((item) => item.agent === agent).prompt;
  for (const agent of [PLAN_AGENT_NAMES.paee, PLAN_AGENT_NAMES.pei, PLAN_AGENT_NAMES.objetivos, PLAN_AGENT_NAMES.revisor]) {
    assert.match(prompt(agent), /Frequenta o AEE/, agent);
    assert.ok(prompt(agent).includes(analysis.sintese) && prompt(agent).includes(analysis.prioridades[0].justificativa), agent);
  }
  const [paeeOptions, peiOptions] = [optionsOf(PAEE_ITEMS), optionsOf(PEI_ITEMS)];
  for (const option of only(paeeOptions, peiOptions)) {
    assert.ok(prompt(PLAN_AGENT_NAMES.paee).includes(option), option);
    assert.ok(!prompt(PLAN_AGENT_NAMES.pei).includes(option) && !prompt(PLAN_AGENT_NAMES.objetivos).includes(option), option);
  }
  for (const option of only(peiOptions, paeeOptions)) {
    assert.ok(prompt(PLAN_AGENT_NAMES.pei).includes(option), option);
    assert.ok(!prompt(PLAN_AGENT_NAMES.paee).includes(option) && !prompt(PLAN_AGENT_NAMES.objetivos).includes(option), option);
  }
  for (const proposed of [paee().networkDemands[0], pei().aeeStrategies[0], objective().action]) assert.ok(prompt(PLAN_AGENT_NAMES.revisor).includes(proposed), proposed);
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
  assert.ok(redo.prompt.includes(pei().aeeStrategies[0]));
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

test("checagens por parte: profissional fora da lista, classe comum vazia, objetivo sem verbo no futuro, linguagem clínica", async () => {
  const answers = {
    paee: () => paee({ supportStaff: ["Cuidador"], accessibilityResources: ["Material indicado no laudo"] }),
    pei: () => pei({ commonRoomStrategies: [], monitoring: [" "] }),
    objetivos: () => objectives({ objectives: [objective({ action: "identifica o nome", criterion: "quase sempre", targetSupport: 3 })] }),
  };
  const { trace } = await runPlanAgents(CONTEXT, fakeModel({ answers }).model);
  const pending = trace.at(-1).summary;
  for (const problem of [
    '"Cuidador" não está na lista de profissionais.', "Há linguagem clínica.", "Não há estratégias para a classe comum.", "Não diz como o plano será acompanhado.",
    "A proposta tem 1 objetivos.", 'A ação "identifica o nome" não começa com verbo no futuro.', 'O critério "quase sempre" não é mensurável.', "O apoio esperado não é menor que o atual.",
  ]) assert.ok(pending.includes(problem), problem);
  assert.doesNotMatch(pending, /devolutiva/);
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
