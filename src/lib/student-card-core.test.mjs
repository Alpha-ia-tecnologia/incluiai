// Testes da carteirinha: node --test src/lib/student-card-core.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { CARD_TOKEN_PATTERN, cardHelp, formatPhone, hasHelp, newCardToken, normalizePhone, sniffCardPhoto, stripPhotoMetadata } from "./student-card-core.ts";

test("código do QR: aleatório, 24 caracteres seguros para endereço", () => {
  const tokens = new Set(Array.from({ length: 200 }, () => newCardToken()));
  assert.equal(tokens.size, 200);
  for (const token of tokens) assert.match(token, CARD_TOKEN_PATTERN);
  assert.doesNotMatch("abc", CARD_TOKEN_PATTERN);
  assert.doesNotMatch("a".repeat(23) + "/", CARD_TOKEN_PATTERN);
});

test("foto: o tipo vem dos bytes, não do nome", () => {
  assert.equal(sniffCardPhoto(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffCardPhoto(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(sniffCardPhoto(new TextEncoder().encode("%PDF-1.7")), null);
});

const segment = (marker, payload) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];

test("JPEG: sai o Exif (com GPS), o IPTC e o comentário; ficam JFIF, cor e a imagem", () => {
  const jfif = segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]);
  const exif = segment(0xe1, [...new TextEncoder().encode("Exif\0\0GPS-23.55,-46.63")]);
  const icc = segment(0xe2, [1, 2, 3]);
  const iptc = segment(0xed, [9, 9]);
  const comment = segment(0xfe, [...new TextEncoder().encode("Celular da Carla")]);
  const adobe = segment(0xee, [7]);
  const image = [0xff, 0xda, 0, 4, 1, 2, 0x55, 0x66, 0xff, 0xd9];
  const jpeg = new Uint8Array([0xff, 0xd8, ...jfif, ...exif, ...icc, ...iptc, ...comment, ...adobe, ...image]);
  const clean = stripPhotoMetadata(jpeg, "image/jpeg");
  assert.deepEqual([...clean], [0xff, 0xd8, ...jfif, ...icc, ...adobe, ...image]);
  assert.ok(!new TextDecoder().decode(clean).includes("GPS"));
  assert.equal(stripPhotoMetadata(new Uint8Array([0xff, 0xd8, 0x00, 0x11, 0, 2]), "image/jpeg"), null);
  assert.equal(stripPhotoMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]), "image/jpeg"), null);
});

const chunk = (type, data) => {
  const length = data.length;
  return [length >>> 24, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff, ...new TextEncoder().encode(type), ...data, 0, 0, 0, 0];
};

test("PNG: saem texto, data e Exif; ficam cabeçalho, imagem e fim", () => {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const text = chunk("tEXt", [...new TextEncoder().encode("Author\0Carla")]);
  const exif = chunk("eXIf", [1, 2]);
  const idat = chunk("IDAT", [1, 2, 3]);
  const iend = chunk("IEND", []);
  const png = new Uint8Array([...signature, ...ihdr, ...text, ...exif, ...idat, ...iend]);
  assert.deepEqual([...stripPhotoMetadata(png, "image/png")], [...signature, ...ihdr, ...idat, ...iend]);
  assert.equal(stripPhotoMetadata(new Uint8Array([...signature, 0, 0, 0, 9, 0x49]), "image/png"), null);
});

test("telefone: só dígitos com DDD; celular com 9", () => {
  assert.equal(normalizePhone("(11) 98765-4321"), "11987654321");
  assert.equal(normalizePhone("+55 11 98765 4321"), "11987654321");
  assert.equal(normalizePhone("011 3456-7890"), "1134567890");
  assert.equal(normalizePhone("98765-4321"), null);
  assert.equal(normalizePhone("(11) 88765-4321"), null);
  assert.equal(formatPhone("11987654321"), "(11) 98765-4321");
  assert.equal(formatPhone("1134567890"), "(11) 3456-7890");
});

test("Como me ajudar: funcional, curto e sem repetição", () => {
  const help = cardHelp({ channel: "CAA (prancha)", commandSteps: 1, calming: ["canto silencioso", " canto silencioso", "miniaturas", "pressão nos ombros"], triggers: ["barulho súbito", ""] });
  assert.equal(help.communication, "CAA (prancha); entendo um pedido por vez");
  assert.deepEqual(help.calming, ["canto silencioso", "miniaturas"]);
  assert.deepEqual(help.avoid, ["barulho súbito"]);
  assert.equal(cardHelp({ channel: "Fala", commandSteps: 3, calming: [], triggers: [] }).communication, "Fala; entendo pedidos de até 3 etapas");
  assert.equal(hasHelp(cardHelp({ channel: null, commandSteps: null, calming: [], triggers: [] })), false);
});
