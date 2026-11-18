import { test } from "node:test";
import assert from "node:assert/strict";
import { GAMES, GAME_CATEGORIES, gameById, isFullScreenId } from "./registry.ts";
import { GAME_PHOTOS } from "./game-photos.ts";
import { THEME_KEYS, themePics } from "./themes.ts";
import { generateRound } from "./objects.ts";

const photoGames = GAMES.filter((game) => game.kind === "foto");

test("um registro: ids únicos; os de tela cheia abrem em /jogar e os de fotografias não", () => {
  assert.equal(new Set(GAMES.map((game) => game.id)).size, GAMES.length);
  for (const game of GAMES) {
    assert.equal(isFullScreenId(game.id), game.kind === "tela-cheia", game.id);
    assert.equal(gameById(game.id), game);
  }
  assert.equal(isFullScreenId("inexistente"), false);
});

test("cada jogo tem textos, categorias válidas e a unidade da nota", () => {
  for (const game of GAMES) {
    assert.ok(game.title && game.skill && game.description, game.id);
    assert.ok(game.categories.length > 0 && new Set(game.categories).size === game.categories.length, game.id);
    assert.ok(game.categories.every((category) => category !== "Todos" && GAME_CATEGORIES.includes(category)), game.id);
    assert.ok(game.unit[0] && game.unit[1], game.id);
    if (game.kind === "foto") assert.ok(game.instructions && game.finish && game.rounds >= 1, game.id);
  }
});

test("o motor de cada jogo de fotografias é o da rodada que ele gera", () => {
  const MECHANIC_OF_ROUND = { pares: "pares", rotina: "ordem", classificar: "grupos", silabas: "silabas" };
  for (const { id, mechanic } of photoGames) {
    const round = generateRound(id, "facil", () => 0.5);
    assert.equal(round.kind, id);
    assert.equal(mechanic, MECHANIC_OF_ROUND[id] ?? "escolha", id);
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
