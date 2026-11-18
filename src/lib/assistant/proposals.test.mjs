import { test } from "node:test";
import assert from "node:assert/strict";
import { isProposalKind, proposalLabel, readProposalArgs, writeProposalArgs } from "./proposals.ts";

const STORED = {
  registrar_aula: '{"studentId":"s1","objectiveId":"o1","activityId":null,"participation":"parcial","supportLevel":2,"criterionMet":"sim","note":"Leu o nome","whatWorked":null,"recommendation":null,"authorRole":"professor_aee"}',
  decidir_atividade: '{"studentId":"s1","activityId":"a1","decision":"rejeitada","reason":"Longa demais"}',
  marcar_objetivo: '{"studentId":"s1","objectiveId":"o1","status":"em_revisao"}',
  contar_conquista: '{"studentId":"s1","note":"Escovou os dentes sozinho","author":"Família"}',
  enviar_orientacoes: '{"studentId":"s1","communication":"Gestos","accessResources":"Prancha","positioning":null,"facilitators":"Rotina","schoolGuidance":"Antecipar","strategiesToTry":"Pistas visuais","sharedGoals":"Pedir ajuda"}',
};

test("os tipos de ação gravados continuam reconhecidos, cada um com um rótulo", () => {
  for (const kind of Object.keys(STORED)) {
    assert.ok(isProposalKind(kind), kind);
    assert.ok(proposalLabel(kind) && proposalLabel(kind) !== kind, kind);
  }
  assert.equal(isProposalKind("toString"), false);
  assert.equal(proposalLabel("tipo_antigo"), "tipo_antigo");
});

test("argumentos gravados antes continuam legíveis e voltam a ser gravados iguais", () => {
  for (const [kind, args] of Object.entries(STORED)) {
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
