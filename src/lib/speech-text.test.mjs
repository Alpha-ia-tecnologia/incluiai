// Testes da leitura em voz alta: node --test src/lib/speech-text.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { isTextScale, pickVoice, speechChunks } from "./speech-text.ts";

const voice = (name, lang, localService, isDefault = false) => ({ name, lang, localService, default: isDefault });

test("prefere voz em português que roda no aparelho", () => {
  const voices = [voice("Google português do Brasil", "pt-BR", false), voice("Luciana", "pt-BR", true), voice("Joana", "pt-PT", true), voice("Samantha", "en-US", true, true)];
  assert.deepEqual(pickVoice(voices), { voice: voices[1], remote: false });
});

test("sem voz local, avisa que a voz é pela internet", () => {
  const voices = [voice("Google português do Brasil", "pt-BR", false), voice("Samantha", "en-US", true)];
  assert.deepEqual(pickVoice(voices), { voice: voices[0], remote: true });
});

test("sem voz em português, não escolhe nenhuma", () => {
  assert.deepEqual(pickVoice([voice("Samantha", "en-US", true)]), { voice: null, remote: false });
  assert.deepEqual(pickVoice([]), { voice: null, remote: false });
  assert.equal(pickVoice([voice("Felipe", "pt_BR", true)]).voice.name, "Felipe");
});

test("trechos curtos: frases, parágrafos e frases longas demais", () => {
  assert.deepEqual(speechChunks("Bom dia. Hoje tem música!\n\nDepois, recreio"), ["Bom dia.", "Hoje tem música!", "Depois, recreio"]);
  const long = `${"palavra ".repeat(40)}fim.`;
  const parts = speechChunks(long, 60);
  assert.ok(parts.every((part) => part.length <= 60));
  assert.equal(parts.join(" "), long.trim());
  assert.deepEqual(speechChunks("   \n  "), []);
});

test("tamanho do texto", () => {
  assert.equal(isTextScale("2"), true);
  assert.equal(isTextScale("4"), false);
  assert.equal(isTextScale(null), false);
});
