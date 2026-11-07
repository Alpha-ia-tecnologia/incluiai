import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { THEMES, ROUTINES, SITUATIONS } from "./games-core.ts";
import { GAME_PHOTOS } from "./game-photos.ts";

const keys = [...new Set([...Object.values(THEMES).flatMap((theme) => theme.items.map(([key]) => key)), ...Object.values(ROUTINES).flatMap((routine) => routine.steps.map((step) => step.key)), ...SITUATIONS.map((situation) => situation.icon), ...["feliz", "triste", "bravo", "medo"].map((emotion) => `emocao-${emotion}`)])];

test("todas as figuras dos temas, rotinas, situações e emoções têm fotografia local", () => {
  assert.equal(keys.length, 69);
  for (const key of keys) {
    const src = GAME_PHOTOS[key];
    assert.ok(src?.startsWith("/images/games/"), key);
    const bytes = readFileSync(new URL(`../../../public${src}`, import.meta.url));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF", key);
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP", key);
  }
});

test("pão e laranja da tela relatada têm fotos próprias", () => {
  assert.equal(GAME_PHOTOS.pao, "/images/games/legacy/pao.webp");
  assert.equal(GAME_PHOTOS.laranja, "/images/games/orange.webp");
  assert.notEqual(GAME_PHOTOS.pao, GAME_PHOTOS.laranja);
});
