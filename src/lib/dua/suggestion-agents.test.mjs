import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DUA_ANALYST, DUA_REVIEWER, DUA_SPECIALISTS, DuaAnalysisSchema, DuaBlocksSchema, DuaReviewSchema, distributeFoci, runDuaSuggestionAgents,
} from "./suggestion-agents.ts";
import { checkBlocks } from "./checks.ts";
import { DUA_PRINCIPLES } from "./domain.ts";

const PEOPLE = ["Dante Moreira", "Carla Moreira"];
const SCHOOLS = ["EMEF Maria Firmina dos Reis"];
const OBJECTIVE = "Identificar dois personagens principais e ordenar três acontecimentos da história.";

const context = (extra = {}) => ({
  purpose: "opcoes",
  objective: { learning: OBJECTIVE, curriculum: "EF15LP03" },
  criteria: [{ id: "c1", description: "Diz ou aponta os dois personagens principais." }],
  barriers: [
    { id: "b1", description: "Instruções longas, apresentadas em uma única etapa", category: "instrucoes", status: "prevista" },
    { id: "b2", description: "Exigência de uma única forma de resposta", category: "resposta", status: "observada" },
  ],
  organization: "Em duplas, depois da leitura coletiva.",
  resources: ["Livro da turma"],
  existingStrategies: [],
  individual: null,
  ...extra,
});
const input = (ctx = context()) => ({ prompt: `Contexto pedagógico sem dados pessoais (opções para a turma):\n${JSON.stringify(ctx)}`, context: ctx, people: PEOPLE, schools: SCHOOLS });

const focus = (principle, barrierId = "b1", extra = {}) => ({ principle, barrierId, hypothesis: null, direction: `Lacuna de ${principle} para ${barrierId}`, ...extra });
const analysis = (focos = [focus("engajamento"), focus("representacao"), focus("acao_expressao", "b2")]) => ({ preservar: "Identificar personagens e ordenar acontecimentos.", focos });
const block = (principle, extra = {}) => ({
  objectiveConsidered: OBJECTIVE, barrierId: "b1", hypothesis: null,
  strategy: `Opção de ${principle}: apresentar a instrução em etapas curtas, com um cartão para cada etapa, antes da leitura.`,
  principles: [principle], justification: "Responde às instruções longas sem mudar o que se quer observar.",
  resources: ["Cartões de etapas"], suggestedEvidence: "Aponta os dois personagens principais.", pendingInformation: [], criterionProposal: null,
  ...extra,
});
const approveAll = { avaliacoes: DUA_PRINCIPLES.map((principle) => ({ principle, aprovado: true, problemas: [] })) };
const principleOf = (agent) => DUA_PRINCIPLES.find((principle) => DUA_SPECIALISTS[principle] === agent);

function fakeModel({ analysisResult = analysis(), reviews = [approveAll], blocksFor } = {}) {
  const calls = [];
  const count = (agent) => calls.filter((call) => call.agent === agent).length;
  const model = async (request) => {
    calls.push(request);
    if (request.agent === DUA_ANALYST) { assert.equal(request.schema, DuaAnalysisSchema); return analysisResult; }
    if (request.agent === DUA_REVIEWER) { assert.equal(request.schema, DuaReviewSchema); return reviews[Math.min(reviews.length - 1, count(DUA_REVIEWER) - 1)]; }
    assert.equal(request.schema, DuaBlocksSchema);
    const principle = principleOf(request.agent);
    const expected = (request.prompt.match(/^\d+\. (Barreira|Hipótese|Sem barreira)/gm) ?? []).length;
    return blocksFor ? blocksFor(principle, count(request.agent), expected) : { blocks: Array.from({ length: expected }, () => block(principle)) };
  };
  return { model, calls, count };
}

test("aprovado de primeira: analista, três especialistas e revisor; um bloco por princípio", async () => {
  const fake = fakeModel();
  const { raw, trace, review } = await runDuaSuggestionAgents(input(), fake.model);
  assert.equal(fake.calls.length, 5);
  assert.equal(fake.calls[0].agent, DUA_ANALYST);
  assert.equal(fake.calls.at(-1).agent, DUA_REVIEWER);
  assert.deepEqual(raw.blocks.map((item) => item.principles[0]), ["engajamento", "representacao", "acao_expressao"]);
  assert.deepEqual(review, { pending: [], rounds: 1 });
  assert.equal(trace.at(-1).agent, DUA_REVIEWER);
  const { blocks, checks } = checkBlocks(raw, context(), PEOPLE, SCHOOLS);
  assert.equal(blocks.length, 3);
  assert.ok(blocks.every((item) => !item.flags.blocked && item.flags.problems.length === 0));
  assert.ok(checks.every((item) => item.passed));
});

test("cada agente recebe o contexto preparado; os especialistas recebem os focos do seu princípio", async () => {
  const fake = fakeModel();
  await runDuaSuggestionAgents(input(), fake.model);
  for (const call of fake.calls) assert.match(call.prompt, /Contexto pedagógico sem dados pessoais/);
  const action = fake.calls.find((call) => call.agent === DUA_SPECIALISTS.acao_expressao);
  assert.match(action.prompt, /Focos de ação e expressão:\n1\. Barreira b2 — Lacuna de acao_expressao para b2/);
  assert.match(action.prompt, /O que preservar: Identificar personagens e ordenar acontecimentos\./);
  assert.match(action.system, /principles inclui "acao_expressao"/);
  assert.doesNotMatch(action.prompt, /Lacuna de engajamento/);
  assert.match(fake.calls.at(-1).prompt, /Focos e blocos a revisar:/);
});

test("focos: barreira inexistente vira hipótese, princípio sem foco recebe um, e o total cabe em 5", () => {
  const foci = distributeFoci(analysis([
    focus("engajamento", "nao-existe", { hypothesis: "Pouca escolha na atividade" }),
    focus("engajamento"), focus("engajamento", "b2"),
    focus("representacao"), focus("representacao", "b2"),
  ]), context());
  assert.equal(foci.engajamento.length, 2);
  assert.deepEqual([foci.engajamento[0].barrierId, foci.engajamento[0].hypothesis], [null, "Pouca escolha na atividade"]);
  assert.equal(foci.acao_expressao.length, 1);
  assert.equal(foci.acao_expressao[0].barrierId, "b1");
  assert.equal(foci.representacao.length, 2);
  const full = distributeFoci(analysis(DUA_PRINCIPLES.flatMap((principle) => [focus(principle), focus(principle, "b2")])), context());
  assert.deepEqual(DUA_PRINCIPLES.map((principle) => full[principle].length), [2, 2, 1]);
});

test("dois focos num princípio: dois blocos, intercalados para começar com um de cada princípio", async () => {
  const fake = fakeModel({ analysisResult: analysis([focus("engajamento"), focus("engajamento", "b2"), focus("representacao"), focus("acao_expressao", "b2")]) });
  const { raw } = await runDuaSuggestionAgents(input(), fake.model);
  assert.deepEqual(raw.blocks.map((item) => item.principles[0]), ["engajamento", "representacao", "acao_expressao", "engajamento"]);
});

test("princípio devolvido: só o especialista dele refaz, com os problemas do revisor", async () => {
  const fake = fakeModel({
    reviews: [
      { avaliacoes: [{ principle: "engajamento", aprovado: true, problemas: [] }, { principle: "representacao", aprovado: false, problemas: ["Bloco 1: diga em que momento os cartões entram."] }, { principle: "acao_expressao", aprovado: true, problemas: [] }] },
      approveAll,
    ],
  });
  const { raw, trace, review } = await runDuaSuggestionAgents(input(), fake.model);
  assert.equal(fake.count(DUA_ANALYST), 1);
  assert.equal(fake.count(DUA_SPECIALISTS.representacao), 2);
  assert.equal(fake.count(DUA_SPECIALISTS.engajamento), 1);
  assert.equal(fake.count(DUA_REVIEWER), 2);
  const redo = fake.calls.filter((call) => call.agent === DUA_SPECIALISTS.representacao)[1];
  assert.match(redo.prompt, /em que momento os cartões entram/);
  assert.match(redo.prompt, /Blocos anteriores:/);
  assert.deepEqual(review, { pending: [], rounds: 2 });
  assert.ok(raw.blocks.every((item) => item.reviewerNotes.length === 0));
  assert.ok(trace.some((step) => step.agent === DUA_REVIEWER && /Devolveu para correção: representação/.test(step.summary)));
});

test("ponto que o revisor mantém depois da correção acompanha o bloco, sem barrar", async () => {
  const rejected = { avaliacoes: [{ principle: "engajamento", aprovado: false, problemas: ["Bloco 1: a evidência não se liga a um critério."] }, { principle: "representacao", aprovado: true, problemas: [] }, { principle: "acao_expressao", aprovado: true, problemas: [] }] };
  const { raw, review } = await runDuaSuggestionAgents(input(), fakeModel({ reviews: [rejected, rejected] }).model);
  assert.deepEqual(review, { pending: ["engajamento"], rounds: 2 });
  const { blocks } = checkBlocks(raw, context(), PEOPLE, SCHOOLS);
  assert.deepEqual(blocks[0].flags.problems, ["Revisor: Bloco 1: a evidência não se liga a um critério."]);
  assert.equal(blocks[0].flags.blocked, false);
  assert.deepEqual(blocks[1].flags.problems, []);
});

test("verificações da plataforma devolvem o bloco mesmo com o revisor aprovando", async () => {
  const fake = fakeModel({
    blocksFor: (principle, call, expected) => ({
      blocks: Array.from({ length: expected }, () => block(principle, principle === "representacao" && call === 1 ? { strategy: "Simplificar a leitura por causa do laudo do estudante, com texto reduzido." } : {})),
    }),
  });
  const { raw, review } = await runDuaSuggestionAgents(input(), fake.model);
  assert.equal(fake.count(DUA_SPECIALISTS.representacao), 2);
  assert.match(fake.calls.filter((call) => call.agent === DUA_SPECIALISTS.representacao)[1].prompt, /diagnóstico, condição clínica ou redução de complexidade/);
  assert.deepEqual(review.pending, []);
  assert.ok(checkBlocks(raw, context(), PEOPLE, SCHOOLS).blocks.every((item) => !item.flags.blocked));
});

test("especialista que esquece o próprio princípio ou traz blocos a mais é ajustado no fim", async () => {
  const fake = fakeModel({ blocksFor: (principle, _call, expected) => ({ blocks: Array.from({ length: expected + 1 }, () => block(principle, { principles: [] })) }) });
  const { raw } = await runDuaSuggestionAgents(input(), fake.model);
  assert.equal(raw.blocks.length, 3);
  assert.deepEqual(raw.blocks.map((item) => item.principles), [["engajamento"], ["representacao"], ["acao_expressao"]]);
  assert.match(fake.calls.filter((call) => call.agent === DUA_SPECIALISTS.engajamento)[1].prompt, /Traga um bloco para cada foco recebido \(1\); vieram 2\./);
});

test("apoio individual: princípio sem foco recebe a barreira do apoio", () => {
  const ctx = context({ purpose: "apoio_individual", barriers: [], individual: { barrier: "Resposta só escrita", support: "Prancha", purpose: "Responder", profile: [] } });
  const foci = distributeFoci(analysis([focus("engajamento", null, { hypothesis: null })]), ctx);
  assert.match(foci.representacao[0].direction, /barreira do apoio individual/);
  assert.equal(foci.representacao[0].barrierId, null);
});

test("falha de um agente interrompe a geração (a sugestão fica como 'falhou' para quem pediu)", async () => {
  const model = async (request) => {
    if (request.agent === DUA_ANALYST) return analysis();
    throw new Error("sem resposta");
  };
  await assert.rejects(runDuaSuggestionAgents(input(), model), /sem resposta/);
});
