// Testes do modelo do planejamento com DUA: node --test src/lib/dua/domain.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildActivityScript, buildSupportScript, collectiveCopy, emptyDuaContent, followUpSuggestions, normalizeContent, observationOf,
  ratio, resultFromCriteria, suggestionStateAfter, supportProblems, validationProblems,
} from "./domain.ts";

const strategy = (id, description, principles, extra = {}) => ({
  id, description, principles, barrierIds: [], criterionIds: [], resources: [], context: "",
  details: { what: "", purpose: "", when: "", how: "" }, origin: { kind: "professor" }, ...extra,
});

// Planejamento pronto para validar: objetivo, critério, barreira e uma opção ligada a eles.
const complete = () => ({
  ...emptyDuaContent("Compreensão de uma narrativa"),
  objective: { learning: "Identificar dois personagens principais e ordenar três acontecimentos da história.", curriculum: "EF15LP03" },
  criteria: [{ id: "c1", description: "Diz ou aponta os dois personagens principais." }],
  barriers: [
    { id: "b1", description: "Instruções longas, apresentadas em uma única etapa", category: "instrucoes", status: "prevista", origin: { kind: "professor" } },
    { id: "b2", description: "Barulho do pátio durante a leitura", category: "estimulos", status: "observada", origin: { kind: "professor" } },
  ],
  strategies: [
    strategy("s1", "Apresentar a instrução em etapas curtas, com cartões", ["representacao"], { barrierIds: ["b1"], criterionIds: ["c1"], resources: ["Cartões de etapas", "Quadro"] }),
    strategy("s2", "Responder oralmente, apontando ou por escrito", ["acao_expressao"], { resources: ["Cartões de resposta", "Quadro"] }),
    strategy("s3", "Escolher o personagem preferido para começar", ["engajamento"]),
  ],
});

const fields = (problems) => problems.map((problem) => problem.field);

test("validação: rascunho vazio fica incompleto, com o que falta", () => {
  const problems = validationProblems(emptyDuaContent());
  assert.deepEqual(fields(problems), ["title", "objective.learning", "criteria", "barriers", "strategies"]);
  for (const problem of problems) assert.ok(problem.message.length > 10, problem.field);
});

test("validação: planejamento completo passa", () => {
  assert.deepEqual(validationProblems(complete()), []);
});

test("validação: critério e barreira só com espaços não contam", () => {
  const content = { ...complete(), criteria: [{ id: "c1", description: "   " }], barriers: [{ ...complete().barriers[0], description: " " }] };
  assert.deepEqual(fields(validationProblems(content)).filter((field) => !field.startsWith("strategies")), ["criteria", "barriers"]);
});

test("validação: opção que cita barreira ou critério removido é apontada", () => {
  const content = complete();
  content.strategies[0] = { ...content.strategies[0], barrierIds: ["b1", "removida"], criterionIds: ["c-removido"] };
  const problems = validationProblems(content);
  assert.deepEqual(fields(problems), ["strategies.0.barrierIds", "strategies.0.criterionIds"]);
  assert.match(problems[0].message, /^Opção 1: .*barreira que não existe mais/);
  assert.match(problems[1].message, /critério que não existe mais/);
});

test("validação: opção sem descrição ou sem princípio é apontada", () => {
  const content = complete();
  content.strategies.push(strategy("s4", "  ", []));
  assert.deepEqual(fields(validationProblems(content)), ["strategies.3.description", "strategies.3.principles"]);
});

test("resultado: sem oportunidade e não registrado não viram 'nao'", () => {
  assert.equal(resultFromCriteria([]), null);
  assert.equal(resultFromCriteria([{ status: "sem_oportunidade" }]), null);
  assert.equal(resultFromCriteria([{ status: "nao_registrado" }]), null);
  assert.equal(resultFromCriteria([{ status: "sem_oportunidade" }, { status: "nao_registrado" }]), null);
  // Só os critérios observados entram no resultado.
  assert.equal(resultFromCriteria([{ status: "demonstrado" }, { status: "sem_oportunidade" }]), "sim");
  assert.equal(resultFromCriteria([{ status: "ainda_nao_demonstrado" }, { status: "nao_registrado" }]), "nao");
  assert.equal(resultFromCriteria([{ status: "demonstrado" }, { status: "ainda_nao_demonstrado" }]), "parcial");
  assert.equal(resultFromCriteria([{ status: "parcial" }]), "parcial");
});

test("observação: sem oportunidade vence não registrado; qualquer observado conta", () => {
  assert.equal(observationOf([{ status: "sem_oportunidade" }, { status: "nao_registrado" }]), "sem_oportunidade");
  assert.equal(observationOf([{ status: "nao_registrado" }, { status: "sem_oportunidade" }]), "sem_oportunidade");
  assert.equal(observationOf([{ status: "nao_registrado" }]), "nao_registrado");
  assert.equal(observationOf([]), "nao_registrado");
  assert.equal(observationOf([{ status: "sem_oportunidade" }, { status: "ainda_nao_demonstrado" }]), "observado");
});

test("apoio individual: recurso e finalidade obrigatórios", () => {
  assert.deepEqual(fields(supportProblems({ support: " ", purpose: "", individualObjective: null })), ["support", "purpose"]);
  assert.deepEqual(supportProblems({ support: "Prancha com as palavras-chave", purpose: "Responder sem depender da fala", individualObjective: null }), []);
});

test("apoio individual: objetivo diferente do coletivo exige justificativa e vínculo ao plano", () => {
  const base = { support: "Prancha com as palavras-chave", purpose: "Responder sem depender da fala" };
  assert.deepEqual(fields(supportProblems({ ...base, individualObjective: { text: "Apontar um personagem", justification: "", objectiveId: null } })), ["individualObjective.justification", "individualObjective.objectiveId"]);
  assert.deepEqual(fields(supportProblems({ ...base, individualObjective: { text: "Apontar um personagem", justification: "Objetivo do Plano de ensino em andamento", objectiveId: null } })), ["individualObjective.objectiveId"]);
  assert.deepEqual(supportProblems({ ...base, individualObjective: { text: "Apontar um personagem", justification: "Objetivo do Plano de ensino em andamento", objectiveId: "obj-1" } }), []);
  // Sem texto, não há objetivo individual a justificar.
  assert.deepEqual(supportProblems({ ...base, individualObjective: { text: " ", justification: "", objectiveId: null } }), []);
});

test("indicadores: denominador zero não vira 0%", () => {
  assert.equal(ratio(0, 0), null);
  assert.equal(ratio(3, 0), null);
  assert.equal(ratio(0, 5), 0);
  assert.equal(ratio(1, 3), 33.3);
  assert.equal(ratio(2, 2), 100);
});

test("sugestão: só sai de 'aguardando revisão' quando todo bloco foi decidido", () => {
  assert.equal(suggestionStateAfter([{ decision: "aceito" }, { decision: "pendente" }]), "aguardando_revisao");
  assert.equal(suggestionStateAfter([{ decision: "recusado" }, { decision: "recusado" }]), "recusado");
  assert.equal(suggestionStateAfter([{ decision: "recusado" }, { decision: "editado" }]), "aceito");
  assert.equal(suggestionStateAfter([{ decision: "aceito" }]), "aceito");
});

test("reaproveitar: só o conteúdo coletivo, com origens, em cópia profunda", () => {
  const original = complete();
  original.barriers[1] = { ...original.barriers[1], origin: { kind: "ia", suggestionId: "sug-1", blockId: "bl-1" } };
  original.strategies[2] = { ...original.strategies[2], origin: { kind: "colaboracao" } };
  // Campo que não faz parte do planejamento coletivo (ex.: apoio individual colado por engano).
  const withExtra = { ...original, apoios: [{ studentId: "est-1", support: "Prancha" }] };
  const copy = collectiveCopy(withExtra, "Narrativa — Turma C");
  assert.equal(copy.title, "Narrativa — Turma C");
  assert.equal("apoios" in copy, false);
  assert.deepEqual(copy.barriers[1].origin, { kind: "ia", suggestionId: "sug-1", blockId: "bl-1" });
  assert.deepEqual(copy.strategies[2].origin, { kind: "colaboracao" });
  assert.deepEqual(copy.strategies, original.strategies);
  copy.barriers[0].description = "alterada";
  copy.strategies[0].barrierIds.push("b2");
  copy.context.resources.push("Novo");
  assert.equal(original.barriers[0].description, "Instruções longas, apresentadas em uma única etapa");
  assert.deepEqual(original.strategies[0].barrierIds, ["b1"]);
  assert.deepEqual(original.context.resources, []);
  assert.equal(collectiveCopy(original).title, "Compreensão de uma narrativa");
});

test("conteúdo antigo: campos ausentes são tolerados", () => {
  const content = normalizeContent({ title: "Antigo", strategies: [{ id: "s1", description: "Áudio", principles: ["representacao"] }] });
  assert.deepEqual(content.criteria, []);
  assert.deepEqual(content.context, { audience: "", organization: "", resources: [], notes: "" });
  assert.deepEqual(content.strategies[0].details, { what: "", purpose: "", when: "", how: "" });
  assert.deepEqual([content.strategies[0].barrierIds, content.strategies[0].criterionIds, content.strategies[0].resources], [[], [], []]);
  assert.deepEqual(normalizeContent(null), emptyDuaContent());
});

const evidence = (statuses, extra = {}) => ({
  criteria: statuses.map((status) => ({ status })), remainingBarriers: "", supportProvided: "Prancha", studentChoice: "Escolheu responder apontando",
  date: "10/10/2026", activity: "Narrativa", ...extra,
});
const texts = (items) => items.map((item) => item.text);

test("próximos passos: cada situação gera a sugestão esperada, com base e pendência", () => {
  assert.deepEqual(followUpSuggestions([evidence(["demonstrado"])]), []);
  assert.deepEqual(texts(followUpSuggestions([evidence(["sem_oportunidade"])])), ["Oferecer uma oportunidade adicional de resposta."]);
  assert.deepEqual(texts(followUpSuggestions([evidence(["nao_registrado"])])), ["Completar o registro da aplicação."]);
  assert.deepEqual(texts(followUpSuggestions([evidence(["parcial"])])), ["Retomar a atividade com outra forma de apresentação."]);
  assert.deepEqual(texts(followUpSuggestions([evidence(["demonstrado"], { remainingBarriers: "barulho do pátio" })])), ["Revisar a clareza das instruções e as barreiras que permaneceram."]);
  assert.deepEqual(texts(followUpSuggestions([evidence(["demonstrado"], { studentChoice: " " })])), ["Consultar o estudante sobre a estratégia utilizada."]);
  // Apoio planejado sem registro de uso.
  assert.deepEqual(texts(followUpSuggestions([evidence(["demonstrado"], { supportProvided: "" })], [{ support: "Prancha" }])), ["Verificar se o recurso previsto estava disponível."]);
  assert.deepEqual(followUpSuggestions([evidence(["demonstrado"], { supportProvided: "" })]), []);
  const [suggestion] = followUpSuggestions([evidence(["demonstrado"], { remainingBarriers: " barulho do pátio " })]);
  assert.equal(suggestion.basis, "Narrativa (10/10/2026): barreiras registradas — barulho do pátio.");
  assert.equal(suggestion.pending, "Confirmar se a barreira é da tarefa, do material ou da organização.");
});

test("próximos passos: apoio planejado com critério não demonstrado leva ao AEE", () => {
  const items = followUpSuggestions([evidence(["ainda_nao_demonstrado"])], [{ support: "Prancha" }]);
  assert.deepEqual(texts(items), ["Retomar a atividade com outra forma de apresentação.", "Discutir o apoio com o profissional do AEE."]);
  assert.equal(items[1].basis, "Há apoio individual planejado e critério ainda não demonstrado.");
});

test("próximos passos: sem repetição e no máximo 6", () => {
  const all = evidence(["sem_oportunidade", "nao_registrado", "ainda_nao_demonstrado"], { remainingBarriers: "instrução longa", supportProvided: "", studentChoice: "" });
  const items = followUpSuggestions([all, { ...all, date: "11/10/2026" }], [{ support: "Prancha" }]);
  assert.equal(items.length, 6);
  assert.equal(new Set(texts(items)).size, 6);
  // A primeira evidência dá a base; a sétima sugestão (AEE) fica de fora do limite.
  assert.ok(items.every((item) => item.basis.includes("10/10/2026") && item.pending.trim()));
  assert.ok(!texts(items).includes("Discutir o apoio com o profissional do AEE."));
});

const headings = (sections) => sections.map((section) => section.heading);

test("material: roteiro em passos e fonte ampliada saem da versão, sem dado individual", () => {
  const content = complete();
  const sections = buildActivityScript(content, "roteiro_passos");
  assert.deepEqual(headings(sections), ["Para que serve esta atividade", "Como vamos fazer", "Como você pode mostrar o que aprendeu", "O que vamos observar"]);
  assert.deepEqual(sections[1].items, ["Apresentar a instrução em etapas curtas, com cartões", "Escolher o personagem preferido para começar"]);
  assert.deepEqual(sections[2].items, ["Responder oralmente, apontando ou por escrito"]);
  assert.deepEqual(buildActivityScript(content, "fonte_ampliada"), sections);
  assert.deepEqual(buildActivityScript(content, "anexo"), sections);
  // Seções vazias não aparecem.
  assert.deepEqual(headings(buildActivityScript({ ...emptyDuaContent("x"), criteria: [{ id: "c1", description: "Aponta" }] }, "roteiro_passos")), ["O que vamos observar"]);
});

test("material: rotina visual, prancha e alertas sensoriais", () => {
  const content = complete();
  content.strategies.push(strategy("s4", "Quarta", ["engajamento"]), strategy("s5", "Quinta", ["engajamento"]));
  const routine = buildActivityScript(content, "rotina_visual");
  assert.equal(routine[1].heading, "Etapas");
  assert.deepEqual(routine[1].items, ["Início", "1. Apresentar a instrução em etapas curtas, com cartões", "2. Responder oralmente, apontando ou por escrito", "3. Escolher o personagem preferido para começar", "4. Quarta", "Encerramento"]);
  const board = buildActivityScript(content, "prancha_comunicacao").at(-1);
  assert.equal(board.heading, "Cartões da prancha");
  assert.deepEqual(board.items, ["Cartões de etapas", "Quadro", "Cartões de resposta", "Sim", "Não", "Preciso de ajuda", "Terminei"]);
  const alerts = buildActivityScript(content, "alertas_sensoriais").at(-1);
  assert.deepEqual(alerts, { heading: "Cuidados com o ambiente", items: ["Barulho do pátio durante a leitura"] });
  assert.ok(!headings(buildActivityScript({ ...content, barriers: [content.barriers[0]] }, "alertas_sensoriais")).includes("Cuidados com o ambiente"));
});

test("material individual: roteiro coletivo mais o apoio planejado", () => {
  const content = complete();
  const sections = buildSupportScript(content, "roteiro_passos", { support: " Prancha com as palavras-chave ", usageContext: "na leitura coletiva" });
  assert.deepEqual(sections.at(-1), { heading: "Meu apoio nesta atividade", items: ["Prancha com as palavras-chave", "Quando usar: na leitura coletiva"] });
  assert.deepEqual(buildSupportScript(content, "roteiro_passos", { support: " ", usageContext: "" }), buildActivityScript(content, "roteiro_passos"));
});
