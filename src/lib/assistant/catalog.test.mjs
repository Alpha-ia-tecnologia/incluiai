import { test } from "node:test";
import assert from "node:assert/strict";
import { doneLabel, runningLabel, sceneOf, toolGuide, toolNames } from "./catalog.ts";
import { isProposalKind } from "./proposals.ts";
import { ROLE_KEYS, can, roleGroup } from "../roles.ts";

const TEAM = ["buscar_estudantes", "ver_estudante", "ver_atividades", "proximos_passos_dua", "propor_plano", "gerar_atividades", "criar_material", "registrar_aula", "decidir_atividade", "marcar_objetivo", "buscar_recursos", "indicadores", "datas_inclusivas"];

const TOOLSETS = {
  professor: TEAM,
  escola: TEAM,
  rede: ["buscar_recursos", "indicadores", "datas_inclusivas"],
  familia: ["meu_estudante", "contar_conquista", "datas_inclusivas"],
  terapeuta: ["meu_estudante", "enviar_orientacoes", "datas_inclusivas"],
  plataforma: ["datas_inclusivas"],
};

test("rótulos e jardim de cada ferramenta; o que vira cartão avisa que espera a confirmação", () => {
  const tools = [...new Set(Object.keys(TOOLSETS).flatMap(toolNames))];
  for (const name of tools) {
    const scene = sceneOf(name);
    assert.ok(runningLabel(name) !== name && doneLabel(name), name);
    assert.ok(scene.wait.endsWith("…"), name);
    assert.ok(["raizes", "trelica", "botoes", "folha", "vasinho"].includes(scene.family), name);
    if (isProposalKind(name)) {
      assert.equal(scene.family, "vasinho", name);
      assert.match(scene.hint, /sem a sua confirmação\.$/, name);
    }
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
