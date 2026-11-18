import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROUTINES, THEMES, fullScreenSession } from "./themes.ts";
import { GAME_PHOTOS } from "./game-photos.ts";

function seeded(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const emotionRounds = Array.from({ length: 100 }, (_, seed) => fullScreenSession("emocoes", { level: "desafio", theme: "animais" }, seeded(seed)).data.rounds).flat();
const keys = [...new Set([
  ...Object.values(THEMES).flatMap((theme) => theme.items.map(([key]) => key)),
  ...Object.values(ROUTINES).flatMap((routine) => routine.steps.map((step) => step.key)),
  ...emotionRounds.map((round) => round.icon),
  ...emotionRounds.flatMap((round) => round.options).map((emotion) => `emocao-${emotion}`),
])];
const photo = (key) => readFileSync(new URL(`../../../public${GAME_PHOTOS[key]}`, import.meta.url));

test("todas as figuras dos temas, rotinas, situações e emoções têm fotografia local", () => {
  for (const key of keys) {
    assert.ok(GAME_PHOTOS[key]?.startsWith("/images/games/"), key);
    const bytes = photo(key);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF", key);
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP", key);
  }
});

test("pão e laranja da tela relatada têm fotos diferentes", () => {
  assert.notDeepEqual(photo("pao"), photo("laranja"));
});
