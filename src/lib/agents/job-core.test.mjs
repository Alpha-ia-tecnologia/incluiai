import { test } from "node:test";
import assert from "node:assert/strict";
import { createJobRunner } from "./job-core.ts";
import { withRedaction } from "./redactor.ts";

const NAMES = { focus: { id: "s1", name: "Dante Moreira" }, students: [], family: ["Carla Moreira"], professionals: [], schools: [], everyPart: false };

function setup({ gate = "liberada", provider = async () => ({ ok: true }), deepseek = [] } = {}) {
  const sent = [];
  const records = [];
  const runAiJob = createJobRunner({
    gate: async () => gate,
    names: async () => NAMES,
    chain: (redactor) => ({
      model: withRedaction(async (request) => { sent.push(request.prompt); return provider(request); }, redactor),
      deepseekAgents: () => deepseek,
      modelId: () => (deepseek.length ? "deepseek" : "claude"),
    }),
    describeError: (error) => `falha: ${error.message}`,
    recordDeepSeekUse: async (studentId, agents, trace, purpose) => { records.push({ studentId, agents, purpose }); if (agents.length) trace.push({ agent: "Provedor de IA", summary: agents.join(", ") }); },
  });
  return { runAiJob, sent, records };
}

const job = (extra = {}) => ({
  task: "teste",
  madeByRules: "A proposta foi feita",
  scope: { student: "s1" },
  student: "s1",
  run: async (model) => ({ ...(await model({ agent: "Agente", system: "", prompt: "Dante e Carla, 01/02/2026.", schema: null })), trace: [{ agent: "Agente", summary: "Propôs." }] }),
  rules: () => ({ regras: true, trace: [] }),
  ...extra,
});

test("IA liberada: o modelo recebe o texto trocado; o rastro abre com a anonimização", async () => {
  const { runAiJob, sent, records } = setup();
  const outcome = await runAiJob(job());
  assert.deepEqual(sent, ["[ESTUDANTE] e [FAMILIAR], [DATA]."]);
  assert.equal(outcome.source, "ia");
  assert.equal(outcome.model, "claude");
  assert.deepEqual(outcome.trace.map((step) => step.agent), ["Anonimização", "Agente"]);
  assert.match(outcome.trace[0].summary, /^Antes do envio à IA, foram substituídos: /);
  assert.deepEqual(outcome.privacy.removed, 3);
  assert.deepEqual(records, [{ studentId: "s1", agents: [], purpose: undefined }]);
});

test("IA desligada ou sem autorização: as regras respondem e o rastro diz por quê", async () => {
  for (const [gate, reason] of [["desligada", /A IA está desligada nesta instalação\./], ["sem_autorizacao", /A família ainda não autorizou o uso de IA/]]) {
    const progress = [];
    const { runAiJob, sent, records } = setup({ gate });
    const outcome = await runAiJob(job({ report: (item) => progress.push(item) }));
    assert.deepEqual([outcome.source, outcome.reason, outcome.value], ["regras", gate, { regras: true, trace: [] }]);
    assert.equal(outcome.trace.length, 1);
    assert.equal(outcome.trace[0].agent, "Motor de regras");
    assert.match(outcome.trace[0].summary, reason);
    assert.match(outcome.trace[0].summary, /A proposta foi feita pelas regras da plataforma\.$/);
    assert.deepEqual([sent, records], [[], []]);
    assert.deepEqual(progress, [{ agent: "Motor de regras", phase: "start" }]);
  }
});

test("a IA falhou: as regras respondem, o erro vira texto para a pessoa e o uso da DeepSeek fica registrado", async () => {
  const { runAiJob, records } = setup({ provider: async () => { throw new Error("limite"); }, deepseek: ["Analista"] });
  const outcome = await runAiJob(job({ deepseekPurpose: "sugestão de apoio na atividade com DUA" }));
  assert.deepEqual([outcome.source, outcome.reason, outcome.error], ["regras", "falhou", "falha: limite"]);
  assert.deepEqual(outcome.value, { regras: true, trace: [] });
  assert.equal(outcome.trace[0].summary, "Indisponíveis no momento (falha: limite). A proposta foi feita pelas regras da plataforma.");
  assert.deepEqual(outcome.trace.at(-1), { agent: "Provedor de IA", summary: "Analista" });
  assert.deepEqual(records, [{ studentId: "s1", agents: ["Analista"], purpose: "sugestão de apoio na atividade com DUA" }]);
});

test("sem regras: a falha volta para quem chamou decidir; sem estudante, nada a registrar", async () => {
  const { runAiJob, records } = setup({ provider: async () => { throw new Error("rede"); } });
  const outcome = await runAiJob(job({ rules: undefined, student: null }));
  assert.deepEqual([outcome.source, outcome.value, outcome.reason, outcome.error], ["regras", null, "falhou", "falha: rede"]);
  assert.deepEqual(records, []);
});
