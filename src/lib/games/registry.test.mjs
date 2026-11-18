import { test } from "node:test";
import assert from "node:assert/strict";
import { FULL_SCREEN_IDS, GAMES, GAME_CATEGORIES, PHOTO_GAME_IDS, gameById, isFullScreenId } from "./registry.ts";
import { GAME_PHOTOS } from "./game-photos.ts";
import { THEME_KEYS, themePics } from "./themes.ts";
import { generateRound } from "./objects.ts";

test("um registro: 19 jogos com ids únicos, 15 de fotografias e 4 de tela cheia", () => {
  assert.equal(GAMES.length, 19);
  assert.equal(new Set(GAMES.map((game) => game.id)).size, 19);
  assert.deepEqual(GAMES.filter((game) => game.kind === "foto").map((game) => game.id).sort(), [...PHOTO_GAME_IDS].sort());
  assert.deepEqual(GAMES.filter((game) => game.kind === "tela-cheia").map((game) => game.id).sort(), [...FULL_SCREEN_IDS].sort());
  assert.equal(isFullScreenId("memoria"), true);
  assert.equal(isFullScreenId("pares"), false);
  assert.equal(isFullScreenId("inexistente"), false);
  for (const id of PHOTO_GAME_IDS) assert.equal(gameById(id).id, id);
});

test("cada jogo tem textos, categorias válidas e a unidade da nota", () => {
  for (const game of GAMES) {
    assert.ok(game.title && game.skill && game.description, game.id);
    assert.ok(game.categories.length > 0 && new Set(game.categories).size === game.categories.length, game.id);
    assert.ok(game.categories.every((category) => category !== "Todos" && GAME_CATEGORIES.includes(category)), game.id);
    assert.ok(game.unit[0] && game.unit[1], game.id);
    if (game.kind === "foto") assert.ok(game.instructions && game.finish && game.rounds >= 1, game.id);
  }
  assert.deepEqual(GAMES.filter((game) => game.kind === "foto" && game.categories.includes("Alfabetização")).map((game) => game.id), ["letras", "palavras", "silabas"]);
});

test("o motor de cada jogo de fotografias é o da rodada que ele gera", () => {
  const MECHANIC_OF_ROUND = { pares: "pares", rotina: "ordem", classificar: "grupos", silabas: "silabas" };
  for (const id of PHOTO_GAME_IDS) {
    const round = generateRound(id, "facil", () => 0.5);
    assert.equal(round.kind, id);
    assert.equal(gameById(id).mechanic, MECHANIC_OF_ROUND[id] ?? "escolha", id);
  }
});

test("a prévia de cada jogo usa fotografias locais, em qualquer tema", () => {
  for (const theme of THEME_KEYS) {
    for (const game of GAMES) {
      const preview = game.preview(themePics(theme));
      assert.ok(preview.photos.length > 0, game.id);
      for (const key of preview.photos) assert.ok(GAME_PHOTOS[key]?.startsWith("/images/games/"), `${game.id}: ${key}`);
    }
  }
});
