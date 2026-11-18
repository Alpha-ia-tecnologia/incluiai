// Testes das cores do logo (grupos de cor e regras): node --test src/lib/branding/colors-core.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { DERIVE_MENU, acceptAiAnswer, chooseByRules, pixelsToSwatches } from "./colors-core.ts";
import { DEFAULT_BRAND, fitsMenu } from "./palette.ts";

const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function image(width, height, paint) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = paint(x, y);
      if (color) pixels.set([...parse(color), 255], (y * width + x) * 4);
    }
  }
  return pixels;
}

const luminance = (hex) => parse(hex).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const hue = (hex) => {
  const [r, g, b] = parse(hex);
  return Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b);
};
const derivedMenu = (primary) => chooseByRules([{ hex: primary, share: 0.8 }, { hex: "#f5be0b", share: 0.2 }]).colors.menu;

const share = (swatches, hex) => swatches.find((swatch) => swatch.hex === hex)?.share ?? 0;

test("logo em fundo transparente: as cores e a fatia de cada uma, sem o branco", () => {
  const pixels = image(40, 20, (x, y) => (x < 2 || y < 2 || x > 37 || y > 17 ? null : x < 22 ? "#1f6f43" : x < 30 ? "#f5be0b" : "#ffffff"));
  const swatches = pixelsToSwatches(pixels, 40, 20);
  assert.deepEqual(swatches.map((swatch) => swatch.hex), ["#1f6f43", "#f5be0b"]);
  assert.ok(Math.abs(share(swatches, "#1f6f43") - 20 / 28) < 0.01);
  assert.ok(Math.abs(share(swatches, "#f5be0b") - 8 / 28) < 0.01);
});

test("fundo liso em volta do logo fica de fora; se o logo é só o fundo, ele conta", () => {
  const emblem = pixelsToSwatches(image(30, 30, (x, y) => (x > 8 && x < 21 && y > 8 && y < 21 ? (y < 15 ? "#c8102e" : "#002868") : "#0055a4")), 30, 30);
  assert.deepEqual(emblem.map((swatch) => swatch.hex).sort(), ["#002868", "#c8102e"]);
  const field = pixelsToSwatches(image(30, 30, (x, y) => (Math.hypot(x - 15, y - 15) < 9 ? "#ffffff" : "#0055a4")), 30, 30);
  assert.deepEqual(field.map((swatch) => swatch.hex), ["#0055a4"]);
});

test("bordas misturadas com o branco não viram cor do logo", () => {
  const pixels = image(40, 40, (x, y) => {
    const d = Math.hypot(x - 20, y - 20);
    return d < 12 ? "#c8102e" : d < 13 ? "#e48896" : d < 14 ? "#f4cfd5" : "#ffffff";
  });
  assert.deepEqual(pixelsToSwatches(pixels, 40, 40).map((swatch) => swatch.hex), ["#c8102e"]);
});

test("no máximo seis cores, as maiores primeiro, e o mesmo resultado sempre", () => {
  const colors = ["#e63946", "#2a9d8f", "#264653", "#f4a261", "#8338ec", "#ffbe0b", "#3a86ff", "#06d6a0"];
  const pixels = image(80, 10, (x) => colors[Math.min(colors.length - 1, Math.floor((x * x) / 800))]);
  const first = pixelsToSwatches(pixels, 80, 10);
  assert.equal(first.length, 6);
  for (let i = 1; i < first.length; i++) assert.ok(first[i - 1].share >= first[i].share);
  assert.deepEqual(pixelsToSwatches(pixels, 80, 10), first);
});

test("logo todo transparente ou branco: nenhuma cor", () => {
  assert.deepEqual(pixelsToSwatches(image(10, 10, () => null), 10, 10), []);
  assert.deepEqual(pixelsToSwatches(image(10, 10, () => "#fdfdfd"), 10, 10), []);
});

test("regra: principal é a cor marcante mais presente; menu, a mais escura que aceita texto branco", () => {
  const swatches = [{ hex: "#f5be0b", share: 0.5 }, { hex: "#c8102e", share: 0.2 }, { hex: "#002868", share: 0.15 }, { hex: "#000000", share: 0.15 }];
  assert.deepEqual(chooseByRules(swatches).colors, { primary: "#f5be0b", menu: "#002868" });
});

test("regra: sem outra cor escura, o menu é um tom escuro da principal", () => {
  const { colors, note } = chooseByRules([{ hex: "#1f6f43", share: 0.8 }, { hex: "#f5be0b", share: 0.2 }]);
  assert.equal(colors.primary, "#1f6f43");
  assert.ok(fitsMenu(colors.menu));
  assert.ok(luminance(colors.menu) < luminance(colors.primary));
  assert.ok(Math.abs(hue(colors.menu) - hue(colors.primary)) < 0.15, colors.menu);
  assert.match(note, /tom escuro da cor principal/);
});

test("regra: logo preto, branco e cinza fica com as cores padrão e avisa", () => {
  const { colors, note } = chooseByRules([{ hex: "#111111", share: 0.6 }, { hex: "#888888", share: 0.4 }]);
  assert.deepEqual(colors, DEFAULT_BRAND);
  assert.match(note, /cores padrão/);
  assert.deepEqual(chooseByRules([]).colors, DEFAULT_BRAND);
});

test("resposta da IA: só vale cor da lista ou derivar", () => {
  const swatches = [{ hex: "#1f6f43", share: 0.6 }, { hex: "#0b3550", share: 0.4 }];
  assert.deepEqual(acceptAiAnswer(swatches, { primary: "#1F6F43", menu: "#0b3550", note: "  Verde da bandeira;\n azul do brasão.  " }), {
    colors: { primary: "#1f6f43", menu: "#0b3550" }, note: "Verde da bandeira; azul do brasão.",
  });
  assert.deepEqual(acceptAiAnswer(swatches, { primary: "#1f6f43", menu: DERIVE_MENU, note: "" }).colors, { primary: "#1f6f43", menu: derivedMenu("#1f6f43") });
  assert.match(acceptAiAnswer(swatches, { primary: "#1f6f43", menu: DERIVE_MENU, note: "" }).note, /IA/);
  assert.equal(acceptAiAnswer(swatches, { primary: "#ff0000", menu: "#0b3550", note: "x" }), null);
  assert.equal(acceptAiAnswer(swatches, { primary: "#1f6f43", menu: "#000000", note: "x" }), null);
  assert.equal(acceptAiAnswer(swatches, { primary: "azul", menu: "#0b3550", note: "x" }), null);
  assert.ok(acceptAiAnswer(swatches, { primary: "#1f6f43", menu: "#0b3550", note: "a".repeat(1000) }).note.length <= 280);
});

test("logo SVG desenhado de verdade (antisserrilhado do librsvg): as duas cores certas", async () => {
  const logo = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#fff"/><circle cx="60" cy="60" r="50" fill="#c8102e"/><path d="M120 20 L190 60 L120 100 Z" fill="#002868"/></svg>');
  const { data, info } = await sharp(logo).resize(96, 96, { fit: "inside", kernel: "nearest" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const swatches = pixelsToSwatches(data, info.width, info.height);
  assert.deepEqual(swatches.map((swatch) => swatch.hex), ["#c8102e", "#002868"]);
  assert.deepEqual(chooseByRules(swatches).colors, { primary: "#c8102e", menu: "#002868" });
});
