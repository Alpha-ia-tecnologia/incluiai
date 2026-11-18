import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOL_CATALOG, doneLabel, runningLabel, sceneOf, toolGuide, toolNames } from "./catalog.ts";
import { ROLE_KEYS, can, roleGroup } from "../roles.ts";

const NO_NAMES = "Os dados chegam à IA sem nomes.";
const SAVE_GATE = "Nada é gravado sem a sua confirmação.";
const SEND_GATE = "Nada é enviado sem a sua confirmação.";

const TOOLS = {
  buscar_estudantes: ["Consultando os estudantes", "Consultou os estudantes", "Consultando a lista de estudantes…", NO_NAMES, "raizes", "sky"],
  ver_estudante: ["Lendo o acompanhamento do estudante", "Leu o acompanhamento do estudante", "Lendo o acompanhamento…", NO_NAMES, "raizes", "teal"],
  ver_atividades: ["Consultando as atividades", "Consultou as atividades", "Consultando as atividades…", NO_NAMES, "raizes", "peach"],
  proximos_passos_dua: ["Consultando os próximos passos do DUA", "Consultou os próximos passos do DUA", "Consultando os próximos passos do DUA…", "Recomendações para a equipe revisar.", "raizes", "sage"],
  propor_plano: ["Preparando a proposta de plano com os agentes", "Preparou a proposta de plano", "Preparando a proposta de plano…", undefined, "trelica", "plano"],
  gerar_atividades: ["Criando as 3 sugestões de atividade com os agentes", "Criou as sugestões de atividade", "Criando 3 sugestões de atividade…", undefined, "botoes", "atividades"],
  criar_material: ["Montando o material de apoio", "Montou o material de apoio", "Montando o material de apoio…", "Fica em Materiais de apoio para revisar e aprovar.", "folha", undefined],
  registrar_aula: ["Preparando o registro da aula", "Preparou o registro da aula", "Preparando o registro da aula…", SAVE_GATE, "vasinho", undefined],
  decidir_atividade: ["Preparando a decisão sobre a atividade", "Preparou a decisão sobre a atividade", "Preparando a decisão sobre a atividade…", SAVE_GATE, "vasinho", undefined],
  marcar_objetivo: ["Preparando a mudança do objetivo", "Preparou a mudança do objetivo", "Preparando a mudança do objetivo…", SAVE_GATE, "vasinho", undefined],
  buscar_recursos: ["Consultando o banco de recursos", "Consultou o banco de recursos", "Consultando o banco de recursos…", "Práticas já usadas na rede, com resultados.", "raizes", "sage"],
  indicadores: ["Consultando o painel", "Consultou o painel", "Consultando o painel…", "Números do painel, sem nomes.", "raizes", "lime"],
  meu_estudante: ["Consultando o acompanhamento", "Consultou o acompanhamento", "Consultando o acompanhamento…", NO_NAMES, "raizes", "teal"],
  contar_conquista: ["Preparando a conquista para enviar", "Preparou a conquista para enviar", "Preparando a conquista para enviar…", SEND_GATE, "vasinho", undefined],
  enviar_orientacoes: ["Preparando o relatório", "Preparou o relatório", "Preparando o relatório…", SEND_GATE, "vasinho", undefined],
  datas_inclusivas: ["Consultando o calendário", "Consultou o calendário", "Consultando o calendário…", "Datas com ideias para a turma toda.", "raizes", "rose"],
};

const TEAM = ["buscar_estudantes", "ver_estudante", "ver_atividades", "proximos_passos_dua", "propor_plano", "gerar_atividades", "criar_material", "registrar_aula", "decidir_atividade", "marcar_objetivo", "buscar_recursos", "indicadores", "datas_inclusivas"];

const TOOLSETS = {
  professor: TEAM,
  escola: TEAM,
  rede: ["buscar_recursos", "indicadores", "datas_inclusivas"],
  familia: ["meu_estudante", "contar_conquista", "datas_inclusivas"],
  terapeuta: ["meu_estudante", "enviar_orientacoes", "datas_inclusivas"],
  plataforma: ["datas_inclusivas"],
};

test("rótulos e jardim de cada ferramenta", () => {
  assert.deepEqual(Object.keys(TOOL_CATALOG).sort(), Object.keys(TOOLS).sort());
  for (const [name, [running, done, wait, hint, family, mark]] of Object.entries(TOOLS)) {
    const scene = sceneOf(name);
    assert.equal(runningLabel(name), running, name);
    assert.equal(doneLabel(name), done, name);
    assert.equal(scene.wait, wait, name);
    assert.equal(scene.hint, hint, name);
    assert.equal(scene.family, family, name);
    assert.equal(scene.long ?? scene.pebble, mark, name);
  }
});

test("nome desconhecido: rótulo é o próprio nome, sem cena", () => {
  assert.equal(runningLabel("ferramenta_nova"), "ferramenta_nova");
  assert.equal(doneLabel("ferramenta_nova"), undefined);
  assert.equal(sceneOf("constructor"), undefined);
});

test("ferramentas de cada grupo, na ordem do catálogo", () => {
  for (const [group, names] of Object.entries(TOOLSETS)) assert.deepEqual(toolNames(group), names, group);
  for (const role of ROLE_KEYS) {
    const names = toolNames(roleGroup(role));
    if (names.includes("buscar_estudantes")) assert.ok(can(role, "seeNames"), role);
    if (names.includes("ver_estudante")) assert.ok(can(role, "pedagogical"), role);
  }
});

test("cada ferramenta de um grupo com seção no prompt tem a sua linha", () => {
  for (const group of ["professor", "escola", "rede", "familia", "terapeuta"]) {
    const guide = toolGuide(group).join("\n");
    for (const name of toolNames(group)) assert.ok(guide.includes(name), `${group}: ${name}`);
  }
  assert.deepEqual(toolGuide("plataforma"), []);
});
