import { test } from "node:test";
import assert from "node:assert/strict";
import { PROPOSALS, isProposalKind, proposalLabel, readProposalArgs, writeProposalArgs } from "./proposals.ts";

const STORED = {
  registrar_aula: {
    label: "Registro de aula",
    args: '{"studentId":"s1","objectiveId":"o1","activityId":null,"participation":"parcial","supportLevel":2,"criterionMet":"sim","note":"Leu o nome","whatWorked":null,"recommendation":null,"authorRole":"professor_aee"}',
  },
  decidir_atividade: {
    label: "Decisão sobre atividade",
    args: '{"studentId":"s1","activityId":"a1","decision":"rejeitada","reason":"Longa demais"}',
  },
  marcar_objetivo: {
    label: "Situação do objetivo",
    args: '{"studentId":"s1","objectiveId":"o1","status":"em_revisao"}',
  },
  contar_conquista: {
    label: "Conquista de casa",
    args: '{"studentId":"s1","note":"Escovou os dentes sozinho","author":"Família"}',
  },
  enviar_orientacoes: {
    label: "Orientações para a escola",
    args: '{"studentId":"s1","communication":"Gestos","accessResources":"Prancha","positioning":null,"facilitators":"Rotina","schoolGuidance":"Antecipar","strategiesToTry":"Pistas visuais","sharedGoals":"Pedir ajuda"}',
  },
};

test("os tipos de ação gravados continuam os mesmos, com o mesmo rótulo", () => {
  assert.deepEqual(Object.keys(PROPOSALS), Object.keys(STORED));
  for (const [kind, { label }] of Object.entries(STORED)) {
    assert.ok(isProposalKind(kind), kind);
    assert.equal(proposalLabel(kind), label, kind);
  }
  assert.equal(isProposalKind("toString"), false);
  assert.equal(proposalLabel("tipo_antigo"), "tipo_antigo");
});

test("argumentos gravados antes continuam legíveis e voltam a ser gravados iguais", () => {
  for (const [kind, { args }] of Object.entries(STORED)) {
    const read = readProposalArgs(kind, args);
    assert.deepEqual(read, JSON.parse(args), kind);
    assert.equal(writeProposalArgs(kind, read), args, kind);
  }
});

test("argumentos fora do formato do tipo não chegam ao comando", () => {
  assert.throws(() => readProposalArgs("marcar_objetivo", '{"studentId":"s1","objectiveId":"o1","status":"concluido"}'));
  assert.throws(() => readProposalArgs("decidir_atividade", '{"studentId":"s1","activityId":"a1"}'));
  assert.throws(() => writeProposalArgs("contar_conquista", { studentId: "s1", note: "Oi" }));
});
