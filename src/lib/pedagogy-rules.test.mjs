import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PERMANENT_RULE_ID, SAFEGUARDS, SUPPORT_SCALE, activityMinutesLimit, checkActivity, hasClinicalTerm, isActivityContext, studentAdaptations, usesAac,
} from "./pedagogy-rules.ts";
import { SUPPORT_LEVELS } from "./scale.ts";

test("linguagem clínica: um só vocabulário para plano, material, DUA e orientações de laudo", () => {
  const clinical = [
    "Conforme o diagnóstico", "Material indicado no laudo", "CID F84", "cid-10", "F84.0", "Como o estudante tem TEA", "TDAH", "autismo",
    "síndrome de Down", "transtorno do espectro", "deficiência intelectual", "déficit cognitivo", "patologia", "epilepsia", "medicamento",
    "medicação no horário", "estudante medicado", "remédio", "dose", "terapia ocupacional",
  ];
  for (const text of clinical) assert.ok(hasClinicalTerm(text), text);
  for (const text of ["Antecipar a rotina com apoio visual", "Habilidade EF15LP03", "Combinar com a terapeuta da rede de saúde", "teatro na escola", "dosar o tempo da atividade"]) {
    assert.ok(!hasClinicalTerm(text), text);
  }
  assert.ok(hasClinicalTerm({ cards: [{ label: "Hora do remédio" }] }));
});

test("tempo da atividade: em casa até 10 minutos; nos outros contextos, a tolerância do estudante ou 25", () => {
  assert.equal(activityMinutesLimit("casa", 30), 10);
  assert.equal(activityMinutesLimit("casa", 6), 6);
  assert.equal(activityMinutesLimit("casa", 0), 10);
  assert.equal(activityMinutesLimit("aee", 15), 15);
  assert.equal(activityMinutesLimit("sala_comum", 0), 25);
});

test("verificação de uma atividade: tempo, passos, critério, turma junto e nada comprado", () => {
  const ok = { title: "Rotina", context: "sala_comum", durationMinutes: 12, materials: ["Cartões"], steps: ["Mostrar", "Apontar", "Registrar"], successCriterion: "4 de 5", classParticipation: "A turma faz junto" };
  assert.deepEqual(checkActivity(ok, 15), []);
  const problems = checkActivity({ ...ok, context: "casa", durationMinutes: 20, steps: ["Fazer"], successCriterion: " ", materials: ["Comprar massinha na papelaria"] }, 15);
  assert.equal(problems.length, 4);
  assert.match(problems.join(" "), /o limite é 10 min/);
  assert.match(problems.join(" "), /use de 3 a 6/);
  assert.match(problems.join(" "), /critério de sucesso/);
  assert.match(problems.join(" "), /sem compras/);
  assert.match(checkActivity({ ...ok, classParticipation: null }, 15).join(" "), /como a turma participa/);
  assert.match(checkActivity({ ...ok, steps: ["a", "b", Array.from({ length: 31 }, () => "palavra").join(" ")] }, 15).join(" "), /passo longo/);
});

test("contextos, regra permanente e comunicação alternativa", () => {
  assert.ok(isActivityContext("casa") && !isActivityContext("rua"));
  const rules = [{ id: "R01-CAA" }, { id: PERMANENT_RULE_ID }, { id: "R02-LIBRAS" }];
  assert.deepEqual(studentAdaptations(rules).map((rule) => rule.id), ["R01-CAA", "R02-LIBRAS"]);
  for (const channel of ["caa_prancha", "caa_pecs", "caa_alta_tecnologia", "olhar_acionador"]) assert.ok(usesAac(channel), channel);
  for (const channel of ["fala", "libras", "gestos", "vocalizacoes"]) assert.ok(!usesAac(channel), channel);
});

test("textos para os agentes: escala de apoio completa e salvaguardas", () => {
  const positions = SUPPORT_LEVELS.map(({ level, code }) => SUPPORT_SCALE.indexOf(`${level} ${code}`));
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])), SUPPORT_SCALE);
  assert.deepEqual(SUPPORT_LEVELS.map(({ level }) => level), [0, 1, 2, 3, 4, 5]);
  for (const rule of [/a pessoa decide/, /Não infira diagnóstico/, /nunca reduza o currículo/, /sem segregação/, /não invente dados/]) assert.match(SAFEGUARDS, rule);
});
