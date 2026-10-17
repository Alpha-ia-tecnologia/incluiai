// Testes das cenas da espera dos agentes: node --test src/lib/assistant/garden-scenes.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACTIVITY_AGENTS, ACTIVITY_REVIEWER, ILLUSTRATION, PLAN_AGENTS, RULES_ENGINE, TIP_POOLS, TOOL_FAMILY, TOOL_HINTS, WAIT_LABELS,
  artFor, chatCaption, deriveGarden, endingCaption, inlineCaption, longBudget, sunAngle,
} from "./garden-scenes.ts";
import { TOOL_LABELS } from "./labels.ts";

const step = (name, ok, extra = {}) => ({ id: `${name}-${Math.random()}`, name, label: name, ...(ok === undefined ? {} : { ok }), ...extra });
const progress = (...items) => items.map(([agent, phase]) => ({ agent, phase }));

test("toda ferramenta do assistente tem família, rótulo e (se não for longa) dica", () => {
  for (const name of Object.keys(TOOL_LABELS)) {
    assert.ok(TOOL_FAMILY[name], `família de ${name}`);
    assert.ok(WAIT_LABELS[name], `rótulo de ${name}`);
    if (!["propor_plano", "gerar_atividades"].includes(name)) assert.ok(TOOL_HINTS[name], `dica de ${name}`);
  }
});

test("nomes dos agentes batem com os grafos e com as ferramentas", () => {
  const plan = readFileSync(new URL("../agents/plan-graph.ts", import.meta.url), "utf8");
  const activity = readFileSync(new URL("../agents/activity-graph.ts", import.meta.url), "utf8");
  const generate = readFileSync(new URL("../agents/generate.ts", import.meta.url), "utf8");
  const tools = readFileSync(new URL("./tools.ts", import.meta.url), "utf8");
  for (const name of PLAN_AGENTS) assert.ok(plan.includes(`"${name}"`), name);
  for (const name of [...ACTIVITY_AGENTS, ACTIVITY_REVIEWER]) assert.ok(activity.includes(`"${name}"`), name);
  assert.ok(generate.includes(`"${RULES_ENGINE}"`));
  assert.ok(tools.includes(`"${ILLUSTRATION}"`));
});

test("pensando: broto com tutor e dois amarrilhos", () => {
  const garden = deriveGarden([], false);
  assert.equal(garden.phase, "pensando");
  assert.equal(garden.scene, "broto");
  const art = artFor(garden, null, null);
  assert.deepEqual([art.grown, art.ties, art.stem, art.stake], [0, 2, 0, true]);
  assert.equal(chatCaption(garden, 0, 0, "popup", true).status, "Pensando no seu pedido.");
  assert.equal(chatCaption(garden, 4, 0, "popup", true).hint, "Enquanto espera, você pode regar a planta.");
  assert.equal(chatCaption(garden, 4, 0, "popup", false).hint, "");
  assert.equal(chatCaption(garden, 60, 0, "page", true).hint, "Se sair, a resposta fica salva na conversa.");
  assert.equal(chatCaption(garden, 4, 0, "popup", true).keep, false);
  assert.equal(chatCaption(garden, 20, 0, "popup", true).keep, true);
});

test("consulta: raiz viva, depois folha nova e um amarrilho a menos", () => {
  const running = deriveGarden([step("ver_estudante")], false);
  assert.equal(running.scene, "raizes");
  assert.equal(running.tool, "ver_estudante");
  assert.deepEqual(running.roots, [{ slot: 0, palette: "teal", state: "vivo" }]);
  assert.equal(chatCaption(running, 0, 0, "popup", true).status, "Lendo o acompanhamento.");
  const done = deriveGarden([step("ver_estudante", true)], false);
  assert.equal(done.phase, "organizando");
  const art = artFor(done, null, null);
  assert.deepEqual([art.grown, art.ties, art.stem], [1, 1, 1]);
  const two = artFor(deriveGarden([step("ver_estudante", true), step("datas_inclusivas", true)], false), null, null);
  assert.deepEqual([two.grown, two.ties, two.stem], [2, 0, 2]);
});

test("consultas em paralelo e ferramenta desconhecida", () => {
  const both = deriveGarden([step("buscar_estudantes"), step("indicadores")], false);
  assert.equal(both.label, "Fazendo 2 consultas ao mesmo tempo…");
  const unknown = deriveGarden([step("ferramenta_nova")], false);
  assert.equal(unknown.scene, "raizes");
  assert.equal(unknown.label, "Trabalhando no seu pedido…");
});

test("falha vira pedra no caminho, sem tirar amarrilho", () => {
  const garden = deriveGarden([step("ver_estudante", true), step("criar_material", false)], false);
  const art = artFor(garden, null, null);
  assert.deepEqual([art.grown, art.ties, art.stones], [1, 1, 1]);
  assert.equal(chatCaption(garden, 0, 0, "popup", true).hint, "Uma etapa não deu certo; o assistente segue.");
  const lookup = deriveGarden([step("ver_atividades", false)], false);
  assert.equal(lookup.roots[0].state, "pedra");
  assert.equal(lookup.stones, 0);
});

test("cartões: vasinho sem marca de concluído e frase certa", () => {
  const save = deriveGarden([step("registrar_aula")], false);
  assert.equal(save.scene, "vasinho");
  assert.equal(chatCaption(save, 0, 0, "popup", true).status, "Preparando o registro da aula. Nada é gravado sem a sua confirmação.");
  const send = deriveGarden([step("contar_conquista")], false);
  assert.equal(send.hint, "Nada é enviado sem a sua confirmação.");
});

test("plano: só o degrau do agente real acende; ajustes e regras", () => {
  const first = deriveGarden([step("propor_plano", undefined, { progress: progress(["Analista do caso", "start"]) })], false);
  assert.equal(first.long?.stage, "analista");
  assert.deepEqual(first.rungs, ["ativo", "espera", "espera"]);
  assert.equal(chatCaption(first, 0, 0, "popup", true).status, "O analista lê o caso. Costuma levar de 1 a 3 minutos.");
  const noEvents = deriveGarden([step("propor_plano")], false);
  assert.deepEqual(noEvents.rungs, ["espera", "espera", "espera"]);
  assert.equal(noEvents.label, "Preparando a proposta de plano…");
  const again = deriveGarden([step("propor_plano", undefined, { progress: progress(
    ["Analista do caso", "start"], ["Analista do caso", "end"], ["Planejador do PPI", "start"], ["Planejador do PPI", "end"],
    ["Revisor pedagógico", "start"], ["Revisor pedagógico", "end"], ["Planejador do PPI", "start"]) })], false);
  assert.equal(again.long?.stage, "ajustes");
  assert.equal(again.label, "O planejador ajusta a proposta…");
  assert.equal(chatCaption(again, 0, 30, "popup", true).hint, "O revisor pediu ajustes. Isso é normal.");
  const rules = deriveGarden([step("propor_plano", undefined, { progress: progress(["Analista do caso", "start"], ["Analista do caso", "fail"], ["Motor de regras", "start"]) })], false);
  assert.equal(rules.long?.stage, "regras");
  assert.deepEqual(rules.rungs, ["espera", "espera", "espera"]);
});

test("atividades: botões abrem com o fim real de cada agente", () => {
  const one = deriveGarden([step("gerar_atividades", undefined, { progress: progress(
    ["Agente da sala comum", "start"], ["Agente do AEE", "start"], ["Agente da família", "start"], ["Agente do AEE", "end"]) })], false);
  assert.equal(one.label, "1 de 3 atividades escritas…");
  assert.deepEqual(one.buds?.states, ["fechado", "aberto", "fechado"]);
  const review = deriveGarden([step("gerar_atividades", undefined, { progress: progress(
    ["Agente da sala comum", "end"], ["Agente do AEE", "end"], ["Agente da família", "end"], ["Revisor das atividades", "start"]) })], false);
  assert.equal(review.long?.stage, "revisor");
  assert.equal(review.buds?.review, true);
  const redo = deriveGarden([step("gerar_atividades", undefined, { progress: progress(
    ["Agente da sala comum", "end"], ["Agente do AEE", "end"], ["Agente da família", "end"], ["Revisor das atividades", "start"],
    ["Revisor das atividades", "end"], ["Agente da família", "start"]) })], false);
  assert.equal(redo.label, "Ajustando 1 atividade…");
  assert.deepEqual(redo.buds?.states, ["aberto", "aberto", "fechado"]);
  const images = deriveGarden([step("gerar_atividades", undefined, { progress: progress(["Ilustração", "start"]) })], false);
  assert.equal(images.long?.stage, "imagens");
});

test("ferramenta longa depois de texto volta à faixa inteira; entrega anunciada", () => {
  const garden = deriveGarden([step("propor_plano")], true);
  assert.equal(garden.phase, "ferramenta");
  assert.ok(garden.long);
  const handoff = deriveGarden([step("propor_plano", true)], false);
  assert.equal(handoff.handoff, "plano");
  assert.equal(chatCaption(handoff, 0, 0, "popup", true).status, "Proposta pronta para a sua revisão. O plano só vale depois que você ativar.");
});

test("tempo das esperas longas: frases honestas e anúncio sem contador de minutos", () => {
  const garden = deriveGarden([step("gerar_atividades")], false);
  assert.equal(chatCaption(garden, 0, 0, "popup", true).hint, "Sala comum, AEE e casa. Depois, um revisor.");
  assert.equal(chatCaption(garden, 0, 20, "popup", true).hint, "Pode fechar o painel: a resposta fica salva.");
  const minute = chatCaption(garden, 0, 60, "popup", true);
  assert.equal(minute.hint, "Já passou 1 minuto. Costuma levar até 3.");
  assert.ok(!minute.status.includes("minuto"));
  assert.equal(chatCaption(garden, 0, 180, "popup", true).hint, "Mais lento que o normal; a resposta fica salva.");
  assert.deepEqual([sunAngle(0, 180), sunAngle(60, 180), sunAngle(180, 180), sunAngle(240, 180)], [-60, -20, 60, 60]);
});

test("atividades com imagens: 4 minutos de tempo habitual, sabidos desde o início", () => {
  const queued = deriveGarden([step("gerar_atividades", undefined, { progress: progress(["Ilustração", "queued"]) })], false);
  assert.equal(queued.long?.images, true);
  assert.equal(queued.long?.stage, "inicio");
  assert.equal(queued.label, "Criando 3 sugestões de atividade…");
  assert.equal(longBudget(queued), 240);
  assert.equal(chatCaption(queued, 0, 0, "popup", true).status, "Criando 3 sugestões de atividade. Costuma levar de 1 a 4 minutos, com as imagens.");
  assert.equal(chatCaption(queued, 0, 60, "popup", true).hint, "Já passou 1 minuto. Costuma levar até 4.");
  const three = chatCaption(queued, 0, 180, "popup", true);
  assert.equal(three.hint, "Já são 3 minutos. Costuma levar até 4.");
  assert.ok(!three.status.includes("mais que o normal"), three.status);
  const late = chatCaption(queued, 0, 240, "popup", true);
  assert.equal(late.hint, "Mais lento que o normal; a resposta fica salva.");
  assert.ok(late.status.endsWith("Está levando mais que o normal; a resposta fica salva."), late.status);
  const drawing = deriveGarden([step("gerar_atividades", undefined, { progress: progress(
    ["Ilustração", "queued"], ["Agente da sala comum", "end"], ["Agente do AEE", "end"], ["Agente da família", "end"], ["Ilustração", "start"]) })], false);
  assert.equal(drawing.long?.stage, "imagens");
  assert.equal(chatCaption(drawing, 0, 180, "popup", true).hint, "Estilo pictograma, sem dados pessoais.");
  assert.equal(sunAngle(180, longBudget(drawing)), 30);
  const plain = deriveGarden([step("gerar_atividades", undefined, { progress: progress(["Agente do AEE", "start"]) })], false);
  assert.equal(plain.long?.images, false);
  assert.equal(longBudget(plain), 180);
  assert.equal(chatCaption(plain, 0, 0, "popup", true).status, "Três agentes escrevem ao mesmo tempo. Costuma levar de 1 a 3 minutos.");
  // Antes do primeiro evento não se sabe se haverá imagens: nenhuma estimativa anunciada.
  const unknown = deriveGarden([step("gerar_atividades")], false);
  assert.equal(chatCaption(unknown, 0, 0, "popup", true).status, "Criando 3 sugestões de atividade.");
  assert.equal(chatCaption(unknown, 0, 20, "popup", true).status, "Criando 3 sugestões de atividade. Pode fechar o painel: a resposta fica salva.");
  assert.equal(chatCaption(deriveGarden([step("propor_plano")], false), 0, 0, "popup", true).status, "Preparando a proposta de plano. Costuma levar de 1 a 3 minutos.");
  assert.equal(longBudget(deriveGarden([step("propor_plano")], false)), 180);
});

test("final: flor sem tutor, ou nuvem passando; anúncio de erro vazio", () => {
  const garden = deriveGarden([step("ver_estudante", true)], true);
  const bloom = artFor(garden, { outcome: "pronto", finale: true }, null);
  assert.deepEqual([bloom.crown, bloom.stake, bloom.ties], ["flor", false, 0]);
  const cloud = artFor(garden, { outcome: "erro", finale: true }, null);
  assert.deepEqual([cloud.cloud, cloud.stake], [true, true]);
  assert.equal(endingCaption("pronto", 2).label, "Resposta pronta. Há 2 cartões para decidir.");
  assert.equal(endingCaption("erro", 0).status, "");
});

test("conexão caída: sem nuvem nem flor; a faixa diz que a resposta segue", () => {
  const garden = deriveGarden([step("propor_plano")], false);
  const art = artFor(garden, { outcome: "interrompida", finale: true }, null);
  assert.deepEqual([art.cloud, art.stake, art.crown, art.sun], [false, true, "nenhum", null]);
  const caption = endingCaption("interrompida", 0);
  assert.deepEqual([caption.label, caption.hint, caption.status, caption.keep], ["A conexão caiu.", "A resposta continua sendo preparada.", "", true]);
});

test("formulários: aviso de demora só no fim do tempo habitual", () => {
  assert.equal(inlineCaption("plano", 120, false).late, "");
  assert.equal(inlineCaption("plano", 180, false).late, "Está levando mais que o normal. Mantenha esta página aberta.");
  assert.equal(inlineCaption("atividades", 180, true).time, "Já são 3 minutos. Costuma levar até 4 minutos.");
  assert.equal(inlineCaption("imagem", 20, false).time, "Ainda desenhando. Pode levar até 1 minuto.");
});

test("textos cabem na faixa de 320 px (linha 1 até 44 caracteres; linha 2 até 52)", () => {
  const endings = ["pronto", "erro", "interrompida"].map((outcome) => endingCaption(outcome, 9));
  const lines1 = [...Object.values(WAIT_LABELS), "Ainda pensando no seu pedido…", "As regras da plataforma montam as sugestões…", ...endings.map((item) => item.label)];
  for (const text of lines1) assert.ok(text.length <= 44, text);
  const images = deriveGarden([step("gerar_atividades", undefined, { progress: progress(["Ilustração", "queued"]) })], false);
  const plan = deriveGarden([step("propor_plano")], false);
  const timeLines = [0, 20, 60, 120, 180, 240].flatMap((bucket) => [chatCaption(images, 0, bucket, "popup", true).hint, chatCaption(plan, 0, bucket, "page", true).hint]);
  const lines2 = [...Object.values(TOOL_HINTS), ...Object.values(TIP_POOLS).flat(), ...endings.map((item) => item.hint), ...timeLines];
  for (const text of lines2) assert.ok(text.length <= 52, text);
});
