// Testes da preparação e da conferência das sugestões do DUA: node --test src/lib/dua/checks.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBlocks, prepareContext, remainingIdentifiers, rulesBlocks } from "./checks.ts";
import { createAnonymizer } from "../agents/anonymize-core.ts";
import { BARRIER_CATEGORIES, DUA_PRINCIPLES } from "./domain.ts";

const PEOPLE = ["Dante Moreira", "Carla Moreira", "Prof.ª Beatriz (AEE)"];
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

// Bloco como chega do modelo (6.2), já dentro das regras.
const raw = (extra = {}) => ({
  objectiveConsidered: OBJECTIVE,
  barrierId: "b1",
  hypothesis: null,
  strategy: "Apresentar a instrução em etapas curtas, com um cartão visual para cada etapa.",
  principles: ["representacao"],
  justification: "Responde às instruções longas sem mudar o que se quer observar.",
  resources: ["Cartões de etapas"],
  suggestedEvidence: "Inicia cada etapa depois da instrução correspondente.",
  pendingInformation: ["Confirmar se há cartões na escola."],
  criterionProposal: null,
  ...extra,
});

const check = (blocks, ctx = context()) => checkBlocks({ blocks }, ctx, PEOPLE, SCHOOLS);
const passed = (checks, name) => checks.find((item) => item.name === name)?.passed;

// ------------------------------------------------------------- identificadores

test("identificadores: e-mail, CPF, nome completo em minúsculas e parte do nome", () => {
  assert.deepEqual(remainingIdentifiers("Combinar com carla.moreira@email.com", PEOPLE, SCHOOLS), ["contatos"]);
  assert.deepEqual(remainingIdentifiers("Documento 123.456.789-00 na ficha", PEOPLE, SCHOOLS), ["documentos"]);
  assert.deepEqual(remainingIdentifiers("Ligar para (11) 98888-0001", PEOPLE, SCHOOLS), ["contatos"]);
  assert.deepEqual(remainingIdentifiers("a turma de dante moreira lê em duplas", PEOPLE, SCHOOLS), ["nome"]);
  assert.deepEqual(remainingIdentifiers("Dante prefere começar pelas imagens", PEOPLE, SCHOOLS), ["nome"]);
  assert.deepEqual(remainingIdentifiers("Combinar com Beatriz o melhor horário", PEOPLE, SCHOOLS), ["nome"]);
  assert.deepEqual(remainingIdentifiers("Visita à emef maria firmina dos reis", PEOPLE, SCHOOLS), ["nome"]);
});

test("identificadores: texto pedagógico comum passa", () => {
  const text = "Apresentar a instrução em etapas curtas, com cartões visuais. Avaliar em 4 de 5 tentativas, ao longo de 6 semanas. EF15LP03.";
  assert.deepEqual(remainingIdentifiers(text, PEOPLE, SCHOOLS), []);
  // Parte de nome em minúsculas é palavra comum (evita barrar "rosa", "luz"...).
  assert.deepEqual(remainingIdentifiers("o personagem dante aparece no livro", PEOPLE, SCHOOLS), []);
});

test("preparação: bloqueia quando sobra identificador e passa depois da troca", () => {
  const withNames = context({ organization: "Dante senta perto da professora; Carla Moreira traz o livro de casa." });
  // Anonimizador sem a responsável: o nome dela sobra e a consulta não acontece.
  const partial = createAnonymizer({ student: "Dante Moreira", schools: SCHOOLS });
  const blocked = prepareContext(withNames, partial, PEOPLE, SCHOOLS);
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.reasons, ["nome"]);

  const anonymizer = createAnonymizer({ student: "Dante Moreira", family: ["Carla Moreira"], professionals: ["Prof.ª Beatriz (AEE)"], schools: SCHOOLS });
  const prepared = prepareContext(withNames, anonymizer, PEOPLE, SCHOOLS);
  assert.equal(prepared.ok, true);
  assert.ok(!/Dante|Carla|Moreira/.test(prepared.prompt), prepared.prompt);
  assert.match(prepared.prompt, /\[ESTUDANTE\] senta perto da professora; \[FAMILIAR\] traz o livro/);
  assert.equal(prepared.removed, 2);
  assert.match(prepared.summary, /1 menção\(ões\) ao estudante/);
});

test("preparação: contexto sem dados pessoais passa sem trocas", () => {
  const prepared = prepareContext(context(), createAnonymizer({ student: "Dante Moreira" }), PEOPLE, SCHOOLS);
  assert.deepEqual([prepared.ok, prepared.removed, prepared.summary], [true, 0, null]);
  assert.deepEqual(JSON.parse(prepared.prompt), context());
});

// Bug conhecido: o anonimizador mantém intervalos de ano (isYearRange), mas a
// conferência os lê como telefone e barra o contexto. Correção sugerida: em
// remainingIdentifiers, ignorar o padrão [TELEFONE] quando isYearRange(match).
test("preparação: intervalo de ano letivo não é telefone", () => {
  const prepared = prepareContext(context({ organization: "Ano letivo 2025-2026, segundo bimestre." }), createAnonymizer({ student: "Dante Moreira" }), PEOPLE, SCHOOLS);
  assert.equal(prepared.ok, true);
});

// ------------------------------------------------------------- verificações (6.3)

test("bloco dentro das regras: aceito para revisão, sem problemas", () => {
  const { blocks, checks } = check([raw()]);
  assert.equal(blocks.length, 1);
  const [block] = blocks;
  assert.deepEqual(block.flags, { changesObjective: false, changesCriterion: false, individual: false, problems: [], blocked: false });
  assert.deepEqual(block.barrierConsidered, { barrierId: "b1", hypothesis: null, text: "Instruções longas, apresentadas em uma única etapa" });
  assert.equal(block.decision, "pendente");
  assert.ok(checks.every((item) => item.passed), JSON.stringify(checks));
});

test("barreira que não existe vira hipótese a verificar", () => {
  const { blocks, checks } = check([raw({ barrierId: "inventada" })]);
  const [block] = blocks;
  assert.equal(block.barrierConsidered.barrierId, null);
  assert.equal(block.barrierConsidered.hypothesis, "Barreira citada pela sugestão, ainda não registrada no planejamento.");
  assert.equal(block.flags.blocked, false);
  assert.match(block.flags.problems[0], /hipótese a verificar/);
  assert.equal(passed(checks, "Referências a informações inexistentes"), false);
  // Hipótese própria do bloco é mantida.
  assert.equal(check([raw({ barrierId: "inventada", hypothesis: "Ruído no corredor" })]).blocks[0].barrierConsidered.hypothesis, "Ruído no corredor");
});

test("diagnóstico ou laudo barram o bloco", () => {
  for (const strategy of ["Como o estudante tem TEA, usar prancha.", "Conferir o laudo antes de oferecer a prancha.", "Adaptar conforme o CID F84.", "Reduzir a tarefa por causa da deficiência intelectual."]) {
    const { blocks, checks } = check([raw({ strategy })]);
    assert.equal(blocks[0].flags.blocked, true, strategy);
    assert.equal(passed(checks, "Diagnóstico e redução por deficiência"), false, strategy);
  }
  const reduction = check([raw({ justification: "Simplificar a leitura por causa da condição do estudante." })]);
  assert.equal(reduction.blocks[0].flags.blocked, true);
});

test("observação inventada e frequência como evidência barram o bloco", () => {
  for (const extra of [
    { justification: "O estudante demonstrou interesse por imagens." },
    { suggestedEvidence: "Na última aula, a turma respondeu bem aos cartões." },
    { justification: "Foi observado que funciona melhor em duplas." },
    { suggestedEvidence: "A frequência no AEE comprova a aprendizagem do estudante." },
  ]) {
    const { blocks, checks } = check([raw(extra)]);
    assert.equal(blocks[0].flags.blocked, true, JSON.stringify(extra));
    assert.equal(passed(checks, "Observações ou resultados inventados"), false);
  }
});

test("identificador na resposta barra o bloco", () => {
  const { blocks, checks } = check([raw({ strategy: "Pedir que Dante escolha o cartão de resposta." })]);
  assert.equal(blocks[0].flags.blocked, true);
  assert.equal(passed(checks, "Identificadores na resposta"), false);
});

test("mudança de objetivo e critério novo são apontados, sem barrar", () => {
  const { blocks, checks } = check([raw({ objectiveConsidered: "Identificar um personagem da história." }), raw({ criterionProposal: "Ordena três cenas com cartões." })]);
  assert.deepEqual([blocks[0].flags.changesObjective, blocks[0].flags.changesCriterion, blocks[0].flags.blocked], [true, false, false]);
  assert.deepEqual([blocks[1].flags.changesObjective, blocks[1].flags.changesCriterion, blocks[1].flags.blocked], [false, true, false]);
  assert.equal(blocks[1].criterionProposal, "Ordena três cenas com cartões.");
  assert.equal(passed(checks, "Compatibilidade com o objetivo e os critérios"), false);
  // Só diferença de maiúsculas, acentos ou espaços não é mudança de objetivo.
  assert.equal(check([raw({ objectiveConsidered: `  ${OBJECTIVE.toUpperCase()} ` })]).blocks[0].flags.changesObjective, false);
});

test("apoio individual marca os blocos como individuais", () => {
  const individual = context({ purpose: "apoio_individual", individual: { barrier: "Resposta só escrita", support: "Prancha", purpose: "Responder apontando", profile: [] } });
  const { blocks } = check([raw()], individual);
  assert.equal(blocks[0].flags.individual, true);
  assert.equal(check([raw()]).blocks[0].flags.individual, false);
});

test("estrutura: bloco sem estratégia é descartado, princípio inválido sai e no máximo 5 blocos", () => {
  const { blocks, checks } = check([raw({ strategy: " " }), raw({ principles: ["inventado", "engajamento", "engajamento"] }), raw({ principles: [] })]);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0].principles, ["engajamento"]);
  assert.match(blocks[1].flags.problems[0], /princípio/);
  assert.equal(blocks[1].flags.blocked, false);
  assert.equal(passed(checks, "Estrutura da resposta"), false);
  assert.equal(check(Array.from({ length: 8 }, () => raw())).blocks.length, 5);
  assert.equal(passed(check([]).checks, "Estrutura da resposta"), false);
});

// Bug conhecido: a expressão de diagnóstico casa com palavras comuns (cid → "cidade",
// "cidadania"; medica → "medição"; "tratamento da informação", unidade da BNCC). Como o
// objetivo do professor entra no texto conferido, TODOS os blocos — inclusive os das
// regras — ficam barrados. Correção sugerida: limites de palavra (\bcid\b|\bcid[- ]?\d,
// \bmedicament\w*|\bmedicacao\b), tirar "tratamento" solto e não conferir o objetivo
// quando ele é igual ao do professor.
test("objetivo com 'cidade', 'cidadania', 'medição' ou 'tratamento da informação' não barra as regras", () => {
  for (const learning of ["Ler o mapa da cidade e localizar a escola.", "Discutir cidadania e direitos das crianças.", "Comparar medições de comprimento com régua.", "Tratamento da informação: ler tabelas simples."]) {
    const ctx = context({ objective: { learning, curriculum: "" } });
    const { blocks } = checkBlocks(rulesBlocks(ctx), ctx, PEOPLE, SCHOOLS);
    assert.ok(blocks.every((block) => !block.flags.blocked), learning);
  }
});

// ------------------------------------------------------------- sugestões por regras (sem IA)

test("regras: um bloco por tipo de barreira, com princípios válidos", () => {
  const ctx = context({
    barriers: [
      { id: "b1", description: "Instruções longas", category: "instrucoes", status: "prevista" },
      { id: "b2", description: "Só leitura", category: "leitura", status: "prevista" },
      { id: "b3", description: "Texto pequeno demais", category: "leitura", status: "hipotese" },
      { id: "b4", description: "Barulho", category: "estimulos", status: "observada" },
      { id: "b5", description: "Uma só forma de resposta", category: "resposta", status: "prevista" },
    ],
  });
  const { blocks } = rulesBlocks(ctx);
  assert.deepEqual(blocks.map((block) => block.barrierId), ["b1", "b2", "b4", "b5"]);
  for (const block of blocks) {
    assert.ok(block.principles.length && block.principles.every((principle) => DUA_PRINCIPLES.includes(principle)), block.strategy);
    assert.equal(block.objectiveConsidered, OBJECTIVE);
    assert.equal(block.criterionProposal, null);
    assert.match(block.suggestedEvidence, /Critério relacionado: Diz ou aponta/);
  }
});

test("regras: todo tipo de barreira tem regra e passa pelas verificações", () => {
  const ctx = context({ barriers: BARRIER_CATEGORIES.map((category, index) => ({ id: `b${index}`, description: `Barreira ${index}`, category, status: "prevista" })) });
  const { blocks: rules } = rulesBlocks(ctx);
  // A resposta tem de 1 a 5 blocos (6.2): os primeiros cinco tipos entram.
  assert.deepEqual(rules.map((block) => block.barrierId), ["b0", "b1", "b2", "b3", "b4"]);
  const { blocks, checks } = checkBlocks({ blocks: rules }, ctx, PEOPLE, SCHOOLS);
  assert.equal(blocks.length, 5);
  assert.ok(blocks.every((block) => !block.flags.blocked && !block.flags.problems.length), JSON.stringify(blocks.map((block) => block.flags)));
  assert.ok(checks.every((item) => item.passed), JSON.stringify(checks));
  // Os tipos que ficaram de fora também têm regra própria.
  const rest = rulesBlocks(context({ barriers: [{ id: "x", description: "", category: "tempo", status: "prevista" }, { id: "y", description: "", category: "outra", status: "prevista" }] })).blocks;
  assert.deepEqual(rest.map((block) => block.barrierId), ["x", "y"]);
  assert.notEqual(rest[0].strategy, rest[1].strategy);
});

test("regras: sem barreira registrada, uma hipótese a verificar", () => {
  const { blocks } = rulesBlocks(context({ barriers: [] }));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].barrierId, null);
  assert.match(blocks[0].hypothesis, /confirme na observação/);
});

test("regras: apoio individual lembra de combinar com o AEE", () => {
  const { blocks } = rulesBlocks(context({ purpose: "apoio_individual", individual: { barrier: "Resposta só escrita", support: "Prancha", purpose: "Responder", profile: [] } }));
  assert.ok(blocks.every((block) => block.strategy.endsWith("Combine com o profissional do AEE como oferecer este apoio ao estudante.")));
});
