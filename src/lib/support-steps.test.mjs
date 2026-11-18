import { test } from "node:test";
import assert from "node:assert/strict";
import { STEPS_LIMIT, focusObjective, reachedGoal, stepsByObjective, stepsFor, stepsFrom, stepsSentence, visibleLessons } from "./support-steps.ts";

const at = (day) => new Date(`2026-10-${String(day).padStart(2, "0")}T12:00:00-03:00`);
const entry = (day, supportLevel, participation = "total", objectiveId = "a") => ({ id: `e${day}`, date: at(day), supportLevel, participation, objectiveId });

test("degraus: aulas em ordem de data, nível preso entre 0 e 5, datas curtas e longas", () => {
  const data = stepsFrom([entry(9, 2), entry(2, 9), entry(5, 3)], { target: 1 });
  assert.deepEqual(data.lessons.map((lesson) => [lesson.date, lesson.level]), [["02/10", 5], ["05/10", 3], ["09/10", 2]]);
  assert.equal(data.lessons[2].dateLong, "09 de out. de 2026");
  assert.equal(data.total, 3);
  assert.equal(data.target, 1);
  assert.equal(data.trend.trend, "avancando");
});

test("degraus: cada tamanho mostra as aulas mais recentes até o seu limite", () => {
  const many = Array.from({ length: 30 }, (_, index) => entry(index + 1, 3));
  const data = stepsFrom(many);
  assert.equal(data.lessons.length, STEPS_LIMIT.full);
  assert.equal(data.total, 30);
  assert.deepEqual(visibleLessons(data, "mini").map((lesson) => lesson.key), ["e23", "e24", "e25", "e26", "e27", "e28", "e29", "e30"]);
  assert.equal(visibleLessons(data, "regular").length, 12);
});

test("degraus de um objetivo: só as aulas dele", () => {
  const data = stepsFor({ id: "a", targetSupport: 2 }, [entry(1, 3), entry(2, 5, "recusou", "b"), entry(3, 2)]);
  assert.deepEqual(data.lessons.map((lesson) => lesson.level), [3, 2]);
  assert.equal(data.target, 2);
  assert.ok(reachedGoal(2, 2) && reachedGoal(0, 2) && !reachedGoal(3, 2) && !reachedGoal(0, null));
});

test("frase dos degraus: caminho, meta e participação, em palavras", () => {
  const data = stepsFrom([entry(1, 3), entry(2, 3), entry(3, 2, "parcial"), entry(4, 2), entry(5, 2), entry(6, 2, "recusou"), entry(7, 1), entry(8, 1)], { target: 1 });
  assert.equal(stepsSentence(data), "8 aulas: de Modelo para Supervisão; meta Supervisão alcançada nas 2 últimas; participou de toda a atividade em 6, de parte em 1, recusou em 1.");
  assert.equal(stepsSentence(data, { audience: "familia" }), "8 aulas: de Modelo para Supervisão; objetivo Supervisão alcançado nas 2 últimas; participou de toda a atividade em 6, de parte em 1, recusou em 1.");
  assert.doesNotMatch(stepsSentence(data), /VERB|SUP\b|MOD|FIS/);
});

test("frase dos degraus: sem aula, uma aula, sempre no mesmo nível e mais aulas do que cabem", () => {
  assert.equal(stepsSentence(stepsFrom([], { target: 1 })), "Ainda sem registro de aula; meta Supervisão.");
  assert.equal(stepsSentence(stepsFrom([entry(1, 2, "parcial")], { target: 1 })), "1 aula: Instrução verbal; meta Supervisão; participou de parte da atividade.");
  assert.equal(stepsSentence(stepsFrom([entry(1, 1), entry(2, 1)], { target: 1 })), "2 aulas: sempre em Supervisão; meta Supervisão alcançada em todas; participou de toda a atividade em 2.");
  assert.equal(stepsSentence(stepsFrom([entry(1, 2), entry(2, 3), entry(3, 2)])), "3 aulas: começou e terminou em Instrução verbal; participou de toda a atividade em 3.");
  const many = stepsFrom(Array.from({ length: 10 }, (_, index) => entry(index + 1, 4)));
  assert.match(stepsSentence(many, { size: "mini" }), /^8 últimas de 10 aulas: sempre em Apoio físico parcial;/);
});

test("objetivo em foco: o da aula mais recente; sem aula, o primeiro", () => {
  const objectives = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(focusObjective(objectives, [entry(3, 2, "total", "a"), entry(9, 2, "total", "b"), entry(5, 2, "total", "c")]).id, "b");
  assert.equal(focusObjective(objectives, [entry(9, 2, "total", "outro")]).id, "a");
  assert.equal(focusObjective(objectives, []).id, "a");
  assert.equal(focusObjective([], []), null);
});

test("degraus por objetivo: um grupo por objetivo, o da aula mais recente primeiro, e as aulas sem objetivo à parte", () => {
  const nome = { id: "a", action: "identificará seu nome", targetSupport: 1 };
  const pausa = { id: "b", action: "pedirá pausa", targetSupport: 2 };
  const groups = stepsByObjective([
    { ...entry(1, 3), objective: nome },
    { ...entry(4, 2, "parcial", "b"), objective: pausa },
    { ...entry(2, 2), objective: nome },
    { ...entry(6, 4, "total", null), objective: null },
  ]);
  assert.deepEqual(groups.map((group) => [group.key, group.name, group.data.total, group.data.target]), [["sem-objetivo", null, 1, null], ["b", "pedirá pausa", 1, 2], ["a", "identificará seu nome", 2, 1]]);
});
