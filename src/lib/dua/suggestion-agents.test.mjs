import { test } from "node:test";
import assert from "node:assert/strict";
import { runDuaSuggestionAgents } from "./suggestion-agents.ts";
import { DUA_PIPELINE } from "../agents/descriptors.ts";
import { checkBlocks } from "./checks.ts";
import { DUA_PRINCIPLES } from "./domain.ts";

const { preparer: DUA_ANALYST, reviewer: DUA_REVIEWER, writers: DUA_SPECIALISTS } = DUA_PIPELINE;
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

function fakeModel({ analysisResult = analysis(), reviews = [approveAll], blocksPer = {}, blocksFor } = {}) {
  const calls = [];
  const count = (agent) => calls.filter((call) => call.agent === agent).length;
  const model = async (request) => {
    calls.push(request);
    let answer;
    if (request.agent === DUA_ANALYST) answer = analysisResult;
    else if (request.agent === DUA_REVIEWER) answer = reviews[Math.min(reviews.length - 1, count(DUA_REVIEWER) - 1)];
    else {
      const principle = principleOf(request.agent);
      const blocks = blocksPer[principle] ?? 1;
      answer = blocksFor ? blocksFor(principle, count(request.agent), blocks) : { blocks: Array.from({ length: blocks }, () => block(principle)) };
    }
    request.schema.parse(answer);
    return answer;
  };
  return { model, calls, count };
}
const promptOf = (fake, agent, nth = 0) => fake.calls.filter((call) => call.agent === agent)[nth].prompt;

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

test("cada agente recebe o contexto preparado; cada especialista, só os focos do seu princípio; o revisor, os blocos", async () => {
  const fake = fakeModel();
  await runDuaSuggestionAgents(input(), fake.model);
  for (const call of fake.calls) assert.match(call.prompt, /Contexto pedagógico sem dados pessoais/);
  for (const principle of DUA_PRINCIPLES) {
    const prompt = promptOf(fake, DUA_SPECIALISTS[principle]);
    assert.ok(prompt.includes(`Lacuna de ${principle}`) && prompt.includes("Identificar personagens e ordenar acontecimentos."), principle);
    for (const other of DUA_PRINCIPLES.filter((item) => item !== principle)) assert.ok(!prompt.includes(`Lacuna de ${other}`), `${principle} recebeu ${other}`);
    assert.ok(fake.calls.at(-1).prompt.includes(block(principle).strategy), principle);
  }
});

test("focos: barreira inexistente vira hipótese, princípio sem foco recebe um, e o total cabe em 5", async () => {
  const uneven = fakeModel({
    analysisResult: analysis([focus("engajamento", "nao-existe", { hypothesis: "Pouca escolha na atividade" }), focus("engajamento"), focus("engajamento", "b2"), focus("representacao"), focus("representacao", "b2")]),
    blocksPer: { engajamento: 2, representacao: 2 },
  });
  const { raw } = await runDuaSuggestionAgents(input(), uneven.model);
  assert.ok(DUA_PRINCIPLES.every((principle) => uneven.count(DUA_SPECIALISTS[principle]) === 1), "cada especialista recebeu o número de focos que respondeu");
  const engagement = promptOf(uneven, DUA_SPECIALISTS.engajamento);
  assert.ok(engagement.includes("Pouca escolha na atividade") && engagement.includes("Lacuna de engajamento para b1") && !engagement.includes("Lacuna de engajamento para b2"));
  assert.equal(raw.blocks.length, 5);
  const full = fakeModel({ analysisResult: analysis(DUA_PRINCIPLES.flatMap((principle) => [focus(principle), focus(principle, "b2")])), blocksPer: { engajamento: 2, representacao: 2, acao_expressao: 1 } });
  const { raw: capped } = await runDuaSuggestionAgents(input(), full.model);
  assert.ok(DUA_PRINCIPLES.every((principle) => full.count(DUA_SPECIALISTS[principle]) === 1));
  assert.ok(!promptOf(full, DUA_SPECIALISTS.acao_expressao).includes("Lacuna de acao_expressao para b2"));
  assert.equal(capped.blocks.length, 5);
});

test("dois focos num princípio: dois blocos, intercalados para começar com um de cada princípio", async () => {
  const fake = fakeModel({ analysisResult: analysis([focus("engajamento"), focus("engajamento", "b2"), focus("representacao"), focus("acao_expressao", "b2")]), blocksPer: { engajamento: 2 } });
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
  assert.ok(redo.prompt.includes(block("representacao").strategy));
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
  const clinical = block("representacao", { strategy: "Simplificar a leitura por causa do laudo do estudante, com texto reduzido." });
  const fake = fakeModel({
    blocksFor: (principle, call, count) => ({ blocks: Array.from({ length: count }, () => (principle === "representacao" && call === 1 ? clinical : block(principle))) }),
  });
  const { raw, review } = await runDuaSuggestionAgents(input(), fake.model);
  assert.equal(fake.count(DUA_SPECIALISTS.representacao), 2);
  const [problem] = checkBlocks({ blocks: [clinical] }, context(), PEOPLE, SCHOOLS).blocks[0].flags.problems;
  assert.ok(promptOf(fake, DUA_SPECIALISTS.representacao, 1).includes(problem), problem);
  assert.deepEqual(review.pending, []);
  assert.ok(checkBlocks(raw, context(), PEOPLE, SCHOOLS).blocks.every((item) => !item.flags.blocked));
});

test("especialista que esquece o próprio princípio ou traz blocos a mais é ajustado no fim", async () => {
  const fake = fakeModel({ blocksFor: (principle, _call, count) => ({ blocks: Array.from({ length: count + 1 }, () => block(principle, { principles: [] })) }) });
  const { raw } = await runDuaSuggestionAgents(input(), fake.model);
  assert.ok(DUA_PRINCIPLES.every((principle) => fake.count(DUA_SPECIALISTS[principle]) === 2), "a plataforma pediu para refazer");
  assert.equal(raw.blocks.length, 3);
  assert.deepEqual(raw.blocks.map((item) => item.principles), [["engajamento"], ["representacao"], ["acao_expressao"]]);
});

test("apoio individual: princípio sem foco recebe a barreira do apoio", async () => {
  const ctx = context({ purpose: "apoio_individual", barriers: [], individual: { barrier: "Resposta só escrita", support: "Prancha", purpose: "Responder", profile: [] } });
  const fake = fakeModel({ analysisResult: analysis([focus("engajamento", null, { hypothesis: null })]) });
  await runDuaSuggestionAgents(input(ctx), fake.model);
  assert.match(promptOf(fake, DUA_SPECIALISTS.representacao), /barreira do apoio individual/);
});

test("falha de um agente interrompe a geração (a sugestão fica como 'falhou' para quem pediu)", async () => {
  const model = async (request) => {
    if (request.agent === DUA_ANALYST) return analysis();
    throw new Error("sem resposta");
  };
  await assert.rejects(runDuaSuggestionAgents(input(), model), /sem resposta/);
});
