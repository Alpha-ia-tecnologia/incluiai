import { test } from "node:test";
import assert from "node:assert/strict";
import { answerText, chatFormData, chipsAnswer, draftsFor, firstMissing } from "./guided-chat.ts";
import { PROFILE_FIELDS, profileAnswers, profileFromForm } from "./functional-profile.ts";
import { STUDENT_FIELDS, readStudentRecord } from "./student-record.ts";

const field = (fields, key) => fields.find((item) => item.key === key);
const reader = (data) => [(name) => data.get(name), (name) => data.getAll(name)];

const SAVED = {
  readingSupport: 3, writingSupport: 2, mathSupport: 4, peerInteraction: 1, adultInteraction: 0, groupWork: 2,
  organization: 2, feeding: 0, hygiene: 1, mobility: 0, fineMotor: 1, grossMotor: 0,
  expressiveChannel: "caa_prancha", receptiveChannel: "fala", commandSteps: 2, attentionMinutes: 12,
  sensoryProfile: JSON.stringify({ auditiva: "hiper", visual: "tipica", tatil: "hipo", vestibular: "tipica", proprioceptiva: "tipica" }),
  usesWheelchairOrOrthosis: true, triggers: JSON.stringify(["Barulho alto", "Fila"]), earlySigns: "[]", calmingStrategies: JSON.stringify(["Fone abafador"]),
  bestShift: "tarde", taskToleranceMinutes: 15, interests: JSON.stringify(["Dinossauros", "Trens"]), barriers: JSON.stringify(["comunicacional", "atitudinal"]),
  strengths: "Memória visual excelente; pareia figuras com precisão",
};

test("perfil: o que a conversa envia é o que o formulário grava", () => {
  const data = chatFormData(PROFILE_FIELDS, profileAnswers(SAVED));
  assert.deepEqual(profileFromForm(...reader(data)), SAVED);
  assert.deepEqual(data.getAll("barriers"), ["comunicacional", "atitudinal"]);
  assert.equal(data.get("usesWheelchairOrOrthosis"), "on");
  assert.equal(chatFormData(PROFILE_FIELDS, { ...profileAnswers(SAVED), usesWheelchairOrOrthosis: "nao" }).get("usesWheelchairOrOrthosis"), null);
});

test("perfil: o resumo mostra código e nome do apoio, minutos e as listas como foram gravadas", () => {
  const answers = profileAnswers(SAVED);
  assert.equal(answerText(field(PROFILE_FIELDS, "readingSupport"), answers, undefined, "-"), "MOD · Modelo");
  assert.equal(answerText(field(PROFILE_FIELDS, "attentionMinutes"), answers, undefined, "-"), "12 minutos");
  assert.equal(answerText(field(PROFILE_FIELDS, "taskToleranceMinutes"), answers, undefined, "-"), "15 minutos");
  assert.equal(answerText(field(PROFILE_FIELDS, "strengths"), answers, undefined, "-"), SAVED.strengths);
  assert.equal(answerText(field(PROFILE_FIELDS, "triggers"), answers, undefined, "-"), "Barulho alto, Fila");
  assert.equal(answerText(field(PROFILE_FIELDS, "earlySigns"), answers, undefined, "Ainda não observado"), "Ainda não observado");
  assert.equal(answerText(field(PROFILE_FIELDS, "barriers"), { barriers: [] }, undefined, "-"), "Nenhuma barreira selecionada");
});

test("rascunhos: o que está na lista vira marcação, o resto vai para o Outro", () => {
  const triggers = field(PROFILE_FIELDS, "triggers");
  assert.deepEqual(draftsFor(triggers, { triggers: ["Fila", "cheiro de tinta"] }, undefined), { chips: ["Fila"], text: "cheiro de tinta", otherOpen: false });
  assert.deepEqual(chipsAnswer(triggers, ["Barulho alto"], "cheiro de tinta, cheiro de tinta; luz"), ["Barulho alto", "cheiro de tinta", "luz"]);
  const minutes = field(PROFILE_FIELDS, "attentionMinutes");
  assert.deepEqual(draftsFor(minutes, { attentionMinutes: "12" }, undefined), { chips: [], text: "12", otherOpen: true });
  assert.deepEqual(draftsFor(minutes, { attentionMinutes: "10" }, undefined), { chips: [], text: "", otherOpen: false });
  assert.equal(firstMissing(PROFILE_FIELDS, profileAnswers(SAVED)), undefined);
  assert.equal(firstMissing(PROFILE_FIELDS, { ...profileAnswers(SAVED), interests: [] }).key, "interests");
});

const SCHOOLS = [
  { value: "e1", label: "Escola Um", classes: [{ name: "3º A", gradeYear: "3º ano", shift: "tarde" }] },
  { value: "e2", label: "Escola Dois", classes: [] },
];

function answer(answers, key, value) {
  const item = field(STUDENT_FIELDS, key);
  const next = { ...answers, [key]: value };
  return item.onAnswer?.(next, answers, { schools: SCHOOLS }) ?? next;
}

test("cadastro: a turma da escola traz o turno e trocar de escola limpa turma, ano e turno", () => {
  let answers = answer({}, "schoolId", "e1");
  answers = answer(answers, "gradeYear", "3º ano");
  answers = answer(answers, "className", "3º A");
  assert.equal(answers.shift, "tarde");
  assert.deepEqual(answer(answers, "schoolId", "e2"), { schoolId: "e2" });
  assert.deepEqual(answer(answers, "schoolId", "e1"), answers);
  assert.equal(answerText(field(STUDENT_FIELDS, "schoolId"), answers, { schools: SCHOOLS }, "-"), "Escola Um");
});

test("cadastro: o que a conversa envia passa pela leitura do cadastro", () => {
  const answers = {
    name: "Ana Clara Souza", birthDate: "2017-03-15", schoolId: "e1", stage: "anos_iniciais", gradeYear: "3º ano", className: "3º A", shift: "tarde",
    guardianName: "Maria Souza", guardianPhone: "", aeeFrequency: "2 vezes por semana", supportProfessional: "sim", accessibilityNotes: ["Usa óculos", "senta perto da porta"],
  };
  const data = chatFormData(STUDENT_FIELDS, answers);
  assert.equal(data.get("supportProfessional"), "on");
  assert.equal(data.get("accessibilityNotes"), "Usa óculos; senta perto da porta");
  const fields = Object.fromEntries(["name", "birthDate", "stage", "gradeYear", "className", "shift", "guardianName", "guardianPhone", "aeeFrequency", "accessibilityNotes"].map((key) => [key, String(data.get(key))]));
  const { record, problems } = readStudentRecord({ ...fields, supportProfessional: data.get("supportProfessional") === "on" }, new Date("2026-06-01T12:00:00Z"));
  assert.deepEqual(problems, []);
  assert.equal(record.shift, "tarde");
  assert.equal(record.supportProfessional, true);
  assert.equal(answerText(field(STUDENT_FIELDS, "birthDate"), answers, { schools: SCHOOLS }, "-"), "15/03/2017");
  assert.equal(answerText(field(STUDENT_FIELDS, "guardianPhone"), answers, { schools: SCHOOLS }, "Não informado"), "Não informado");
});
