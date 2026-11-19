import { test } from "node:test";
import assert from "node:assert/strict";
import { FAMILY_HELP, familyGoalSentence, familyGoalTitle, familyWeek, pickGoals, planShare, sameCheckIn, weekWindow } from "./family-portal.ts";
import { stepsFrom } from "./support-steps.ts";

const at = (day, hour = 12) => new Date(`2026-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00-03:00`);
const lesson = (day, supportLevel, participation = "total") => ({ id: `e${day}`, date: at(day), supportLevel, participation });

test("objetivo na voz da família: o verbo no infinitivo, sem o nome no começo", () => {
  assert.equal(familyGoalTitle("identificará seu nome entre 5 opções"), "Identificar seu nome entre 5 opções");
  assert.equal(familyGoalTitle("lerá e escreverá palavras com sílabas simples"), "Ler e escrever palavras com sílabas simples");
  assert.equal(familyGoalTitle("fará a transição entre atividades com aviso antecipado."), "Fazer a transição entre atividades com aviso antecipado");
  assert.equal(familyGoalTitle("Dante comunicará três necessidades da rotina", "Dante"), "Comunicar três necessidades da rotina");
  assert.equal(familyGoalTitle("Reconhecer o próprio nome"), "Reconhecer o próprio nome");
  assert.equal(familyGoalTitle("identificará seu nome com pista visual (VERB) (EF01LP04)"), "Identificar seu nome com pista visual");
});

test("frase do objetivo: a ajuda em palavras, com o objetivo quando ainda não chegou", () => {
  assert.equal(FAMILY_HELP.length, 6);
  const less = stepsFrom([lesson(2, 4), lesson(5, 4), lesson(9, 3), lesson(12, 2)], { target: 1 });
  assert.equal(familyGoalSentence(less), "Está precisando de menos ajuda: na última aula, fez com uma dica falada ou visual; o objetivo é fazer só com um lembrete.");
  const goal = stepsFrom([lesson(2, 3), lesson(5, 2), lesson(9, 1)], { target: 1 });
  assert.equal(familyGoalSentence(goal), "Chegou ao objetivo: na última aula, fez só com um lembrete.");
  const refused = stepsFrom([lesson(2, 2), lesson(5, 2, "recusou"), lesson(9, 2, "recusou")], { target: 1 });
  assert.equal(familyGoalSentence(refused), "Em 2 das 3 últimas aulas, preferiu não fazer a atividade.");
  const steady = stepsFrom([lesson(2, 2), lesson(5, 2), lesson(9, 2)], { target: 1 });
  assert.equal(familyGoalSentence(steady), "Nas últimas aulas, fez com uma dica falada ou visual; o objetivo é fazer só com um lembrete.");
  assert.equal(familyGoalSentence(stepsFrom([lesson(2, 3)], { target: 1 })), "Na primeira aula, fez vendo alguém fazer antes; o objetivo é fazer só com um lembrete.");
  assert.equal(familyGoalSentence(stepsFrom([], { target: 0 })), "O objetivo é fazer sem ajuda.");
  assert.equal(familyGoalSentence(stepsFrom([])), null);
  for (const sentence of [less, goal, refused, steady].map(familyGoalSentence)) assert.doesNotMatch(sentence, /\b(IND|SUP|VERB|MOD|FIS-[PT])\b/);
});

test("objetivos do portal: os das aulas mais recentes primeiro, depois a ordem do plano", () => {
  const objectives = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const lessons = [{ date: at(2), objectiveId: "a" }, { date: at(9), objectiveId: "c" }, { date: at(5), objectiveId: "a" }, { date: at(8), objectiveId: null }];
  assert.deepEqual(pickGoals(objectives, lessons).map((item) => item.id), ["c", "a"]);
  assert.deepEqual(pickGoals(objectives, [], 2).map((item) => item.id), ["a", "b"]);
  assert.deepEqual(pickGoals(objectives, lessons, 5).map((item) => item.id), ["c", "a", "b"]);
});

test("semana: os 7 dias até hoje, no horário de Brasília", () => {
  const week = weekWindow(at(18, 22));
  assert.equal(week.label, "12 a 18 de novembro");
  assert.equal(week.since.toISOString(), "2026-11-12T03:00:00.000Z");
  assert.equal(weekWindow(new Date("2026-12-02T15:00:00-03:00")).label, "26 de novembro a 2 de dezembro");
});

test("semana na escola: o que foi registrado, em palavras da família, só nos 7 dias", () => {
  const since = at(12, 0);
  const items = familyWeek({
    since,
    portal: "/familia/x",
    firstName: "Dante",
    lessons: [
      { date: at(13), participation: "total", objectiveId: "a" },
      { date: at(16), participation: "parcial", objectiveId: "b" },
      { date: at(17), participation: "recusou", objectiveId: "a" },
      { date: at(5), participation: "total", objectiveId: "a" },
    ],
    objectives: [{ id: "a", action: "identificará seu nome entre 5 opções" }, { id: "b", action: "comunicará três necessidades" }],
    sessions: [{ date: at(16), status: "realizado" }, { date: at(17), status: "falta" }, { date: at(3), status: "realizado" }],
    conquests: [{ id: "c1", date: at(14), title: "Leu o próprio nome" }, { id: "c0", date: at(1), title: "Antiga" }],
    activities: [{ id: "t1", title: "Caça ao nome", at: at(15) }],
    materials: [{ id: "m1", title: "Rotina visual", at: at(16) }, { id: "m0", title: "Velho", at: at(2) }],
    reports: [{ id: "r1", at: at(17) }, { id: "r0", at: null }],
  });
  assert.deepEqual(items.map((item) => item.kind), ["aulas", "atendimento", "conquista", "casa", "material", "relatorio"]);
  assert.equal(items[0].title, "3 aulas registradas: participou de toda a atividade em 1 e de parte em 1; recusou 1");
  assert.equal(items[0].detail, "Identificar seu nome entre 5 opções · Comunicar três necessidades");
  assert.deepEqual([items[1].title, items[1].detail], ["1 atendimento especializado", "1 falta"]);
  assert.equal(items[2].detail, "Leu o próprio nome");
  assert.equal(items[4].href, "/familia/x/materiais/m1");
  assert.equal(items[5].href, "/familia/x/relatorios/r1");
  const one = familyWeek({ since, portal: "/familia/x", firstName: "Dante", lessons: [{ date: at(13), participation: "parcial", objectiveId: "b" }], objectives: [{ id: "b", action: "comunicará três necessidades" }], sessions: [], conquests: [], activities: [], materials: [], reports: [] });
  assert.equal(one[0].title, "1 aula registrada: participou de parte da atividade");
  const coded = familyWeek({ since, portal: "/familia/x", firstName: "Dante", lessons: [], objectives: [], sessions: [], conquests: [{ id: "c2", date: at(14), title: "De modelo (MOD) para pista verbal (VERB)" }], activities: [{ id: "t2", title: "Rotina (FIS-P)", at: at(15) }], materials: [{ id: "m2", title: "Prancha (EF01LP04)", at: at(16) }], reports: [] });
  assert.deepEqual(coded.map((item) => item.detail), ["De modelo para pista verbal", "Rotina", "Prancha"]);
  const empty = familyWeek({ since, portal: "/familia/x", firstName: "Dante", lessons: [{ date: at(5), participation: "total", objectiveId: null }], objectives: [], sessions: [], conquests: [], activities: [], materials: [], reports: [] });
  assert.deepEqual(empty, []);
});

test("contar para a escola: cada parte vai para o seu registro", () => {
  assert.deepEqual(planShare({ answers: [" Dormiu bem ", ""], note: "", achievement: "", author: "Mãe" }), { checkIn: { answers: ["Dormiu bem"], note: "" }, achievement: null });
  assert.deepEqual(planShare({ answers: [], note: "", achievement: "Comeu sem ajuda; Dormiu melhor", author: " Avó " }), { checkIn: null, achievement: { note: "Comeu sem ajuda; Dormiu melhor", author: "Avó" } });
  assert.deepEqual(planShare({ answers: [], note: "Foi ao parque", achievement: "Comeu sem ajuda", author: "" }), { checkIn: { answers: [], note: "Foi ao parque" }, achievement: { note: "Comeu sem ajuda", author: "" } });
  assert.ok("error" in planShare({ answers: [], note: "  ", achievement: "", author: "Mãe" }));
});

test("resposta da semana igual: mesmas opções em qualquer ordem e mesma frase", () => {
  assert.ok(sameCheckIn({ answers: ["Comeu bem", "Dormiu bem"], note: null }, { answers: ["Dormiu bem", "Comeu bem"], note: "" }));
  assert.ok(!sameCheckIn({ answers: ["Dormiu bem"], note: "a" }, { answers: ["Dormiu bem"], note: "b" }));
  assert.ok(!sameCheckIn({ answers: ["Dormiu bem"], note: null }, { answers: ["Dormiu bem", "Comeu bem"], note: null }));
});
