// Testes dos vídeos tutoriais: node --test src/lib/tutorials-core.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, isTutorial, parseTutorials, tutorialsForRole } from "./tutorials-core.ts";

const valid = { id: "10-registrar-aula", title: "Registrar uma aula", audience: "Professores", roles: ["professor_aee", "professor_sala"], summary: "Três partes.", seconds: 95, video: "10-registrar-aula.mp4", poster: "10-registrar-aula.jpg" };

test("vídeo válido passa; sem capa também", () => {
  assert.equal(isTutorial(valid), true);
  assert.equal(isTutorial({ ...valid, poster: null }), true);
});

test("nomes de arquivo e endereço só com letras, números e hífen", () => {
  assert.equal(isTutorial({ ...valid, id: "../ajuda" }), false);
  assert.equal(isTutorial({ ...valid, video: "../../.env" }), false);
  assert.equal(isTutorial({ ...valid, video: "aula.webm" }), false);
  assert.equal(isTutorial({ ...valid, poster: "capa.png" }), false);
  assert.equal(isTutorial({ ...valid, video: "https://exemplo.com/a.mp4" }), false);
});

test("campos faltando ou de outro tipo ficam de fora", () => {
  assert.equal(isTutorial(null), false);
  assert.equal(isTutorial({ ...valid, title: " " }), false);
  assert.equal(isTutorial({ ...valid, roles: "professor_aee" }), false);
  assert.equal(isTutorial({ ...valid, seconds: 0 }), false);
  assert.equal(isTutorial({ ...valid, seconds: "95" }), false);
});

test("lista: ignora o que não serve e mantém a ordem", () => {
  const second = { ...valid, id: "01-primeiros-passos", video: "01-primeiros-passos.mp4" };
  assert.deepEqual(parseTutorials([valid, { id: 1 }, second]).map((item) => item.id), ["10-registrar-aula", "01-primeiros-passos"]);
  assert.deepEqual(parseTutorials({ not: "a list" }), []);
});

test("cada perfil vê os vídeos feitos para ele", () => {
  const family = { ...valid, id: "16-portal-da-familia", roles: ["familia"], video: "16-portal-da-familia.mp4" };
  assert.deepEqual(tutorialsForRole([valid, family], "familia").map((item) => item.id), ["16-portal-da-familia"]);
  assert.deepEqual(tutorialsForRole([valid, family], "secretaria"), []);
});

test("duração em minutos e segundos", () => {
  assert.equal(formatDuration(45), "45 s");
  assert.equal(formatDuration(80), "1 min 20 s");
  assert.equal(formatDuration(120), "2 min");
  assert.equal(formatDuration(119.6), "2 min");
});
