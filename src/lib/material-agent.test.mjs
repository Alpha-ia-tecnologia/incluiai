import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MATERIAL_ACTIVITY_AGENTS, MATERIAL_AGENT, MATERIAL_REVIEWER, MaterialActivitySchema, MaterialDesignSchema, MaterialReviewSchema, runMaterialAgent,
} from "./agents/material-agent.ts";
import { checkMaterial } from "./material-content.ts";

// Os agentes do material de apoio com um modelo de mentira: confere o caminho do
// grafo (criador → três atividades → revisor), o que cada agente recebe e o que
// é refeito quando o revisor devolve uma parte. Nenhuma chamada à API.

const facts = {
  firstName: "Dante", expressiveChannel: "caa_prancha", expressiveLabel: "Prancha de comunicação", receptiveLabel: "Fala com apoio visual",
  commandSteps: 1, attentionMinutes: 8, toleranceMinutes: 12, interests: ["Dinossauros"], calming: ["Canto silencioso"], triggers: ["Mudança de rotina"],
  sensitiveTo: ["auditiva"], readingSupport: 3, fineMotorSupport: 2, usesWheelchair: false, strengths: "Memória visual",
};
const rules = [
  { id: "R00-ANTISSEGREGACAO", when: "sempre", then: "O estudante participa da mesma aula, com a turma" },
  { id: "R01-CAA", when: "CAA ou acionador como canal expressivo", then: "Prever forma de resposta não vocal (apontar, cartão, botão, varredura)" },
];
const input = (overrides = {}) => ({
  kind: "rotina_visual", topic: "Hora do lanche", context: "aee", rules, facts,
  contextText: "Estudante de 7 anos, 2º ano.\n\n## Objetivo do plano que o material apoia\ncomunicará três necessidades da rotina, com pista visual, em 4 de 5 tentativas (Comunicação).\nHabilidade da BNCC: EF15LP09.",
  ...overrides,
});

const design = (title = "Rotina da hora do lanche") => ({
  title,
  purpose: "Antecipar cada momento do lanche e apoiar os pedidos pela prancha.",
  intro: "Mostre os cartões na ordem antes de sair para o lanche.",
  cards: ["Lavar as mãos", "Pegar a lancheira", "Sentar à mesa", "Comer com calma", "Guardar a lancheira"].map((label) => ({ label, caption: null, visual: `Criança fazendo a ação: ${label.toLowerCase()}`, alt: label })),
  preparation: ["Imprima e recorte os cartões.", "Fixe com velcro numa tira, na altura dos olhos."],
  howToUse: ["Aponte o cartão de cada momento.", "Avise a troca mostrando o próximo cartão.", "No fim, o estudante vira o cartão feito."],
  adaptations: [{ text: "Uma ação por cartão.", basis: "Como aprende: compreende comandos de 1 etapa." }],
  accessibility: ["Um pictograma por cartão"],
  familyTip: "Use os mesmos cartões no lanche de casa.",
});
const activity = (title, overrides = {}) => ({
  title, durationMinutes: 10, goal: "Comunicar necessidades da rotina com a prancha.",
  materials: ["Rotina da hora do lanche"],
  steps: ["Mostrar o cartão “Lavar as mãos”.", "Esperar o estudante apontar o cartão.", "Seguir para o próximo cartão."],
  responseForms: ["Apontar o cartão"], supportBelow: "Modelo do adulto.", supportTarget: "Pista visual.", supportAbove: "Só supervisão.",
  successCriterion: "Aponta o cartão certo em 4 de 5 momentos.", record: "Registre quantos cartões apontou e o apoio usado.",
  planB: "Oferecer o canto silencioso e retomar depois.", classParticipation: title.includes("turma") ? "A turma segue a mesma rotina no quadro." : null,
  ...overrides,
});
const TITLES = { [MATERIAL_ACTIVITY_AGENTS.sala_comum]: "Lanche com a turma", [MATERIAL_ACTIVITY_AGENTS.aee]: "Ensaio da rotina", [MATERIAL_ACTIVITY_AGENTS.casa]: "Lanche em casa" };
const approveAll = { avaliacoes: ["material", "sala_comum", "aee", "casa"].map((parte) => ({ parte, aprovado: true, problemas: [] })) };

// Modelo de mentira: responde por agente e guarda os pedidos. `reviews` são as
// respostas do revisor, na ordem das rodadas.
function fakeModel({ reviews = [approveAll], activityFor = (agent) => activity(TITLES[agent]) } = {}) {
  const calls = [];
  const model = async (request) => {
    calls.push(request);
    if (request.agent === MATERIAL_AGENT) {
      assert.equal(request.schema, MaterialDesignSchema);
      return design(calls.filter((call) => call.agent === MATERIAL_AGENT).length > 1 ? "Rotina do lanche (revisada)" : undefined);
    }
    if (request.agent === MATERIAL_REVIEWER) {
      assert.equal(request.schema, MaterialReviewSchema);
      return reviews[Math.min(reviews.length - 1, calls.filter((call) => call.agent === MATERIAL_REVIEWER).length - 1)];
    }
    assert.equal(request.schema, MaterialActivitySchema);
    return activityFor(request.agent, calls.filter((call) => call.agent === request.agent).length);
  };
  return { model, calls, count: (agent) => calls.filter((call) => call.agent === agent).length };
}

test("aprovado de primeira: criador, três atividades e revisor, uma chamada cada", async () => {
  const fake = fakeModel();
  const { title, content, trace } = await runMaterialAgent(input(), fake.model);
  assert.equal(fake.calls.length, 5);
  assert.equal(fake.calls[0].agent, MATERIAL_AGENT);
  assert.equal(fake.calls.at(-1).agent, MATERIAL_REVIEWER);
  assert.equal(title, "Rotina da hora do lanche");
  assert.equal(content.cards.length, 5);
  // A atividade do contexto pedido (AEE) vem primeiro; as três têm contexto e registro.
  assert.deepEqual(content.activities.map((item) => item.context), ["aee", "sala_comum", "casa"]);
  assert.ok(content.activities.every((item) => item.record));
  assert.ok(content.activities.find((item) => item.context === "sala_comum").classParticipation);
  assert.equal(content.preparation.length, 2);
  assert.deepEqual(content.reviewNotes, []);
  assert.deepEqual(checkMaterial(content, { kind: "rotina_visual", toleranceMinutes: 12 }), []);
  assert.equal(trace.at(-1).agent, "Finalização");
});

test("todos os agentes recebem o pedido, o objetivo e as regras; as atividades recebem os cartões", async () => {
  const fake = fakeModel();
  await runMaterialAgent(input(), fake.model);
  for (const call of fake.calls) {
    assert.match(call.prompt, /Tipo: Rotina visual \(4 a 8 cartões\)/);
    assert.match(call.prompt, /Situação ou conteúdo: Hora do lanche/);
    assert.match(call.prompt, /\[R01-CAA\]/);
    assert.match(call.prompt, /EF15LP09/);
  }
  for (const agent of Object.values(MATERIAL_ACTIVITY_AGENTS)) {
    const call = fake.calls.find((item) => item.agent === agent);
    assert.match(call.prompt, /Cartões, em ordem:\n1\. Lavar as mãos/);
    assert.match(call.system, /material de apoio que já foi criado/);
  }
  const review = fake.calls.at(-1);
  assert.match(review.prompt, /## Material a revisar/);
  assert.match(review.prompt, /Lanche com a turma/);
});

test("adaptações: as do material e as regras obrigatórias, cada uma com a base", async () => {
  const { content } = await runMaterialAgent(input(), fakeModel().model);
  assert.deepEqual(content.adaptations, [
    { text: "Uma ação por cartão.", basis: "Como aprende: compreende comandos de 1 etapa." },
    { text: "Prever forma de resposta não vocal (apontar, cartão, botão, varredura)", basis: "Regra R01-CAA: CAA ou acionador como canal expressivo." },
  ]);
});

test("atividade devolvida: só ela é refeita, com os problemas do revisor", async () => {
  const fake = fakeModel({
    reviews: [
      { avaliacoes: [{ parte: "material", aprovado: true, problemas: [] }, { parte: "sala_comum", aprovado: true, problemas: [] }, { parte: "aee", aprovado: true, problemas: [] }, { parte: "casa", aprovado: false, problemas: ["Usa massinha comprada: troque por objetos da casa."] }] },
      approveAll,
    ],
  });
  const { content, trace } = await runMaterialAgent(input(), fake.model);
  assert.equal(fake.count(MATERIAL_AGENT), 1);
  assert.equal(fake.count(MATERIAL_ACTIVITY_AGENTS.casa), 2);
  assert.equal(fake.count(MATERIAL_ACTIVITY_AGENTS.aee), 1);
  assert.equal(fake.count(MATERIAL_REVIEWER), 2);
  const redo = fake.calls.filter((call) => call.agent === MATERIAL_ACTIVITY_AGENTS.casa)[1];
  assert.match(redo.prompt, /massinha comprada/);
  assert.match(redo.prompt, /Atividade anterior:/);
  assert.deepEqual(content.reviewNotes, []);
  assert.ok(trace.some((step) => step.agent === MATERIAL_REVIEWER && /Devolveu para correção: Agente da família/.test(step.summary)));
});

test("material devolvido: o criador refaz e as três atividades acompanham os cartões novos", async () => {
  const fake = fakeModel({
    reviews: [
      { avaliacoes: [{ parte: "material", aprovado: false, problemas: ["Os cartões não chegam ao fim do lanche: inclua guardar e voltar para a sala."] }, { parte: "sala_comum", aprovado: true, problemas: [] }, { parte: "aee", aprovado: true, problemas: [] }, { parte: "casa", aprovado: true, problemas: [] }] },
      approveAll,
    ],
  });
  const { title } = await runMaterialAgent(input(), fake.model);
  assert.equal(fake.count(MATERIAL_AGENT), 2);
  for (const agent of Object.values(MATERIAL_ACTIVITY_AGENTS)) assert.equal(fake.count(agent), 2, agent);
  assert.equal(fake.count(MATERIAL_REVIEWER), 2);
  assert.equal(title, "Rotina do lanche (revisada)");
  assert.match(fake.calls.filter((call) => call.agent === MATERIAL_AGENT)[1].prompt, /não chegam ao fim do lanche/);
  assert.match(fake.calls.filter((call) => call.agent === MATERIAL_ACTIVITY_AGENTS.aee)[1].prompt, /O material foi refeito depois da revisão/);
});

test("verificações da plataforma valem mesmo com o revisor aprovando; o que sobra vira ponto para conferir", async () => {
  // A atividade de casa passa do limite de 10 minutos nas duas rodadas.
  const fake = fakeModel({ activityFor: (agent) => activity(TITLES[agent], agent === MATERIAL_ACTIVITY_AGENTS.casa ? { durationMinutes: 25 } : {}) });
  const { content, trace } = await runMaterialAgent(input(), fake.model);
  assert.equal(fake.count(MATERIAL_ACTIVITY_AGENTS.casa), 2);
  assert.equal(fake.count(MATERIAL_REVIEWER), 2);
  // O ajuste final corta a duração; a professora ainda é avisada do ponto.
  assert.equal(content.activities.find((item) => item.context === "casa").durationMinutes, 10);
  assert.equal(content.reviewNotes.length, 1);
  assert.match(content.reviewNotes[0], /^Atividade de casa: "Lanche em casa" dura 25 min/);
  assert.match(trace.find((step) => step.agent === MATERIAL_REVIEWER && /Ainda há pontos/.test(step.summary)).summary, /Agente da família/);
});

test("falha de um agente interrompe a geração (quem chama cai para o motor de regras)", async () => {
  const model = async (request) => {
    if (request.agent === MATERIAL_ACTIVITY_AGENTS.aee) throw new Error("sem resposta");
    return request.agent === MATERIAL_AGENT ? design() : activity(TITLES[request.agent]);
  };
  await assert.rejects(runMaterialAgent(input(), model), /sem resposta/);
});
