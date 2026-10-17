// Testes das regras dos materiais de apoio: node --test src/lib/material-content.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MATERIAL_KINDS, checkMaterial, finalizeMaterial, normalizeMaterialContent, profileAdaptations, responseFormsFor, rulesMaterial,
} from "./material-content.ts";

const facts = (overrides = {}) => ({
  firstName: "Dante",
  expressiveChannel: "caa_prancha",
  expressiveLabel: "CAA (prancha)",
  receptiveLabel: "Fala",
  commandSteps: 1,
  attentionMinutes: 8,
  toleranceMinutes: 15,
  interests: ["Dinossauros", "Música"],
  calming: ["Fone abafador", "Respirar devagar"],
  triggers: ["Barulho alto", "Mudança de rotina sem aviso"],
  sensitiveTo: ["auditiva"],
  readingSupport: 4,
  fineMotorSupport: 2,
  usesWheelchair: false,
  strengths: "Memória visual",
  ...overrides,
});

test("material antigo ({ intro, cards[{label, hint}] }) continua legível", () => {
  const content = normalizeMaterialContent({ intro: "Rotina", cards: [{ label: "Chegar", hint: "Foto do armário" }, { label: "" }] });
  assert.equal(content.version, 2);
  assert.equal(content.cards.length, 1);
  assert.equal(content.cards[0].caption, "Foto do armário");
  assert.equal(content.cards[0].visual, "Foto do armário");
  assert.deepEqual(content.activities, []);
});

test("regras: os seis tipos saem completos e passam nas verificações", () => {
  for (const { kind, cards } of MATERIAL_KINDS) {
    for (const context of ["sala_comum", "aee", "casa"]) {
      const { title, content } = rulesMaterial({ kind, topic: "Hora do lanche", context, objective: null, facts: facts() });
      assert.ok(title.length > 3, kind);
      assert.ok(content.cards.length >= cards[0] && content.cards.length <= cards[1], `${kind}: ${content.cards.length} cartões`);
      assert.equal(content.activities.length, 2, kind);
      assert.ok(content.adaptations.every((item) => item.basis), kind);
      assert.deepEqual(checkMaterial(content, { kind, toleranceMinutes: 15 }), [], `${kind} em ${context}`);
    }
  }
});

test("regras: situação conhecida vira passos concretos; situação livre usa o tema", () => {
  const known = rulesMaterial({ kind: "rotina_visual", topic: "Lavar as mãos", context: "aee", objective: null, facts: facts() }).content;
  assert.equal(known.cards[0].label, "Abrir a torneira");
  const free = rulesMaterial({ kind: "sequencia_tarefa", topic: "Montar o vulcão de argila", context: "aee", objective: null, facts: facts() }).content;
  assert.ok(free.cards.some((card) => card.label.includes("montar o vulcão de argila")));
});

test("regras: atividades respeitam o tempo de tarefa e, em casa, no máximo 10 minutos", () => {
  const short = rulesMaterial({ kind: "rotina_visual", topic: "Recreio", context: "casa", objective: null, facts: facts({ toleranceMinutes: 6 }) }).content;
  for (const activity of short.activities) assert.ok(activity.durationMinutes <= 6, `${activity.title}: ${activity.durationMinutes}`);
  const long = rulesMaterial({ kind: "rotina_visual", topic: "Recreio", context: "casa", objective: null, facts: facts({ toleranceMinutes: 40 }) }).content;
  for (const activity of long.activities.filter((item) => item.context === "casa")) assert.ok(activity.durationMinutes <= 10);
});

test("regras: o objetivo do plano aparece nas atividades", () => {
  const { content } = rulesMaterial({ kind: "quadro_escolhas", topic: "", context: "aee", objective: "identificará o próprio nome entre 5 opções", facts: facts() });
  assert.ok(content.activities.every((activity) => activity.goal.includes("identificará o próprio nome")));
});

test("verificações: apontam cartões demais, texto longo, tempo, passos, turma e linguagem clínica", () => {
  const { content } = rulesMaterial({ kind: "rotina_visual", topic: "Recreio", context: "sala_comum", objective: null, facts: facts() });
  const broken = structuredClone(content);
  broken.cards = Array.from({ length: 10 }, (_, index) => ({ label: index === 0 ? "um texto de cartão muito comprido que passa do limite de palavras" : "Passo", visual: "Criança brincando", alt: "Passo" }));
  broken.activities[1].durationMinutes = 40;
  broken.activities[1].steps = ["Um passo só"];
  broken.activities[1].classParticipation = "";
  broken.purpose = "Material para estudante com TEA";
  const problems = checkMaterial(broken, { kind: "rotina_visual", toleranceMinutes: 15 }).join(" | ");
  assert.match(problems, /de 4 a 8 cartões/);
  assert.match(problems, /texto longo/);
  assert.match(problems, /limite é 15 min/);
  assert.match(problems, /use de 3 a 6/);
  assert.match(problems, /como a turma participa/);
  assert.match(problems, /linguagem clínica/);
});

test("verificações: descrição visual não pode pedir texto na imagem, mas pode mostrar uma criança escrevendo", () => {
  const { content } = rulesMaterial({ kind: "sequencia_tarefa", topic: "Lavar as mãos", context: "aee", objective: null, facts: facts() });
  const writing = structuredClone(content);
  writing.cards[0].visual = "Criança fazendo a escrita do nome no caderno";
  assert.deepEqual(checkMaterial(writing, { kind: "sequencia_tarefa", toleranceMinutes: 15 }), []);
  writing.cards[0].visual = "Placa com o texto 'banheiro'";
  assert.match(checkMaterial(writing, { kind: "sequencia_tarefa", toleranceMinutes: 15 }).join(" "), /sem pedir texto escrito/);
});

test("ajustes finais: cortam excessos, limitam a duração e só a sala comum tem participação da turma", () => {
  const { content } = rulesMaterial({ kind: "prancha_caa", topic: "Hora do lanche", context: "sala_comum", objective: null, facts: facts() });
  const raw = structuredClone(content);
  raw.cards = Array.from({ length: 30 }, (_, index) => ({ label: `Palavra ${index}`, visual: "Objeto", alt: "Objeto" }));
  raw.activities = [
    { ...raw.activities[0], context: "casa", durationMinutes: 45, classParticipation: "turma" },
    { ...raw.activities[1], context: "sala_comum", durationMinutes: 90 },
    { ...raw.activities[1] }, { ...raw.activities[1] },
  ];
  const fixed = finalizeMaterial(raw, { kind: "prancha_caa", toleranceMinutes: 15 });
  assert.equal(fixed.cards.length, 16);
  assert.equal(fixed.activities.length, 3);
  assert.equal(fixed.activities[0].durationMinutes, 10);
  assert.equal(fixed.activities[0].classParticipation, undefined);
  assert.equal(fixed.activities[1].durationMinutes, 15);
});

test("formas de resposta seguem a comunicação do estudante", () => {
  assert.match(responseFormsFor({ expressiveChannel: "caa_pecs", fineMotorSupport: 0 }).join(" "), /prancha/);
  assert.match(responseFormsFor({ expressiveChannel: "olhar_acionador", fineMotorSupport: 5 }).join(" "), /Olhar/);
  assert.match(responseFormsFor({ expressiveChannel: "libras", fineMotorSupport: 0 }).join(" "), /Libras/);
  assert.doesNotMatch(responseFormsFor({ expressiveChannel: "fala", fineMotorSupport: 4 }).join(" "), /Escrever/);
});

test("por que assim: cada adaptação diz a base no perfil", () => {
  const adaptations = profileAdaptations(facts(), "historia_social");
  assert.ok(adaptations.length >= 5);
  assert.ok(adaptations.every((item) => item.basis.startsWith("Como aprende") || item.basis.startsWith("Rotina")));
  assert.ok(adaptations.some((item) => /sonoro/.test(item.basis)));
  assert.ok(adaptations.some((item) => /Dinossauros/.test(item.text)));
});
