import { test } from "node:test";
import assert from "node:assert/strict";
import { runActivityAgents } from "./activity-graph.ts";
import { ACTIVITY_PIPELINE } from "./descriptors.ts";

const CONTEXTS = ["sala_comum", "aee", "casa"];
const rules = [
  { id: "R01-CAA", when: "CAA", then: "Prever forma de resposta não vocal" },
  { id: "R02-LIBRAS", when: "Libras", then: "Instruções em Libras e apoio visual" },
  { id: "R10-ATENCAO", when: "Atenção", then: "Alternar ação e escuta" },
  { id: "R00-ANTISSEGREGACAO", when: "Regra permanente", then: "Nenhuma atividade de sala comum pode isolar o estudante" },
];
const input = { context: "Estudante de 8 anos, 3º ano.\n\n## Objetivo trabalhado\ncomunicará três necessidades.", rules, taskToleranceMinutes: 15 };
const contextOf = (agent) => CONTEXTS.find((context) => ACTIVITY_PIPELINE.writers[context] === agent);
const card = (context, extra = {}) => ({
  title: `Atividade ${context}`, durationMinutes: context === "casa" ? 8 : 12, materials: ["Cartões"], steps: ["Mostrar o cartão", "Pedir a resposta", "Registrar"],
  responseForm: "Apontar", supportBelow: "Mais apoio", supportTarget: "Alvo", supportAbove: "Menos apoio", successCriterion: "4 de 5", planB: "Pausa",
  classParticipation: context === "sala_comum" ? "A turma faz junto" : null, ...extra,
});
const approveAll = { avaliacoes: CONTEXTS.map((context) => ({ context, aprovado: true, problemas: [] })) };

function fakeModel({ reviews = [approveAll], cardFor = (context) => card(context) } = {}) {
  const calls = [];
  const count = (agent) => calls.filter((call) => call.agent === agent).length;
  const model = async (request) => {
    calls.push(request);
    const answer = request.agent === ACTIVITY_PIPELINE.reviewer
      ? reviews[Math.min(reviews.length - 1, count(request.agent) - 1)]
      : cardFor(contextOf(request.agent), count(request.agent));
    request.schema.parse(answer);
    return answer;
  };
  return { model, calls, count };
}

test("aprovadas de primeira: três agentes e o revisor; os cartões saem na ordem sala comum, AEE e casa", async () => {
  const fake = fakeModel();
  const { cards, trace } = await runActivityAgents(input, fake.model);
  assert.equal(fake.calls.length, 4);
  assert.deepEqual(cards.map((item) => item.context), CONTEXTS);
  assert.ok(cards.every((item) => item.source === "ia" && item.reviewNotes.length === 0));
  assert.deepEqual(trace.slice(-2).map((step) => step.agent), [ACTIVITY_PIPELINE.reviewer, "Finalização"]);
  assert.equal(trace.at(-2).summary, "Aprovou as três atividades.");
  for (const call of fake.calls.slice(0, 3)) assert.ok(call.prompt.includes("R01-CAA") && call.prompt.includes(rules[0].then), call.agent);
});

test("regras de adaptação: a permanente não vira adaptação, e a de casa leva só duas", async () => {
  const { cards } = await runActivityAgents(input, fakeModel().model);
  const byContext = Object.fromEntries(cards.map((item) => [item.context, item]));
  assert.deepEqual(byContext.aee.adaptations.map((item) => item.rule), ["R01-CAA", "R02-LIBRAS", "R10-ATENCAO"]);
  assert.deepEqual(byContext.casa.adaptations.map((item) => item.rule), ["R01-CAA", "R02-LIBRAS"]);
});

test("atividade devolvida: só o agente dela refaz, com os problemas e a versão anterior", async () => {
  const reject = { avaliacoes: CONTEXTS.map((context) => ({ context, aprovado: context !== "aee", problemas: context === "aee" ? ["O critério não tem número."] : [] })) };
  const fake = fakeModel({ reviews: [reject, approveAll] });
  const { cards, trace } = await runActivityAgents(input, fake.model);
  assert.deepEqual(CONTEXTS.map((context) => fake.count(ACTIVITY_PIPELINE.writers[context])), [1, 2, 1]);
  const redo = fake.calls.filter((call) => call.agent === ACTIVITY_PIPELINE.writers.aee)[1];
  assert.ok(redo.prompt.includes("O critério não tem número."));
  assert.ok(redo.prompt.includes("Atividade aee"));
  assert.ok(trace.some((step) => step.summary === "Devolveu para correção: Agente do AEE."));
  assert.ok(cards.every((item) => item.reviewNotes.length === 0));
});

test("verificações da plataforma valem mesmo com o revisor aprovando; o que sobra vai para o professor", async () => {
  const fake = fakeModel({ cardFor: (context) => card(context, context === "casa" ? { durationMinutes: 25, materials: ["Massinha comprada na papelaria"] } : {}) });
  const { cards, trace } = await runActivityAgents(input, fake.model);
  assert.equal(fake.count(ACTIVITY_PIPELINE.writers.casa), 2);
  const home = cards.find((item) => item.context === "casa");
  assert.equal(home.reviewNotes.length, 2);
  assert.match(home.reviewNotes.join(" "), /o limite é 10 min/);
  assert.match(home.reviewNotes.join(" "), /sem compras/);
  assert.equal(trace.at(-2).summary, "Ainda há pontos a conferir em: Agente da família.");
});

test("vários agentes falhando juntos: chega o erro original", async () => {
  const model = async () => { throw new Error("limite de uso"); };
  await assert.rejects(runActivityAgents(input, model), /limite de uso/);
});
