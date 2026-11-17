// Testes da paleta da marca: node --test src/lib/branding/palette.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_BRAND, DEFAULT_TOKENS, FIXED_TOKENS, brandCss, derivePalette, fitsMenu, normalizeHex } from "./palette.ts";

// Contraste da WCAG calculado aqui de novo, sem o color-math.ts.
const channel = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (rgb) => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const ratio = (a, b) => {
  const [x, y] = [lum(Array.isArray(a) ? a : rgb(a)), lum(Array.isArray(b) ? b : rgb(b))];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const over = (bg, alpha) => rgb(bg).map((v) => v * (1 - alpha) + alpha);

const HARD = ["#ffffff", "#000000", "#ffff00", "#ff0000", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#808080", "#999999", "#bbbbbb", "#444444",
  "#f5be0b", "#fafafa", "#e0f0ff", "#fff4cc", "#020202", "#ff8800", "#1f6f43", "#0a6a9a", "#0b3550", "#7cb93a"];

function assertAccessible(palette, context) {
  const t = palette.tokens;
  for (const check of palette.checks) assert.ok(check.ok, `${context}: ${check.label} (${check.ratio} < ${check.min})`);
  const pairs = [
    ["#ffffff", t["--brand"]], ["#ffffff", t["--brand-strong"]],
    [t["--brand"], FIXED_TOKENS["--paper"]], [t["--brand"], FIXED_TOKENS["--paper-raised"]], [t["--brand"], t["--brand-soft"]],
    [t["--brand-strong"], t["--brand-soft"]], [t["--brand-strong"], t["--lilac"]], [t["--brand-strong"], FIXED_TOKENS["--paper"]],
    [t["--ink"], FIXED_TOKENS["--paper"]], [t["--ink"], FIXED_TOKENS["--canvas"]], [t["--ink-soft"], FIXED_TOKENS["--paper"]], [t["--ink-soft"], FIXED_TOKENS["--surface-muted"]],
    ["#ffffff", t["--navy"]], ["#ffffff", over(t["--navy"], 0.16)], [t["--on-navy-soft"], t["--navy"]], [t["--on-navy-soft"], over(t["--navy"], 0.1)],
    [t["--accent-sky"], t["--navy"]], [t["--ink-strong"], t["--accent-sky"]], [t["--ink-strong"], FIXED_TOKENS["--signal-orange"]],
  ];
  for (const [a, b] of pairs) assert.ok(ratio(a, b) >= 4.5, `${context}: ${a} sobre ${b} = ${ratio(a, b).toFixed(2)}`);
  assert.ok(ratio(t["--brand"], FIXED_TOKENS["--paper-raised"]) >= 3, `${context}: contorno de foco`);
}

test("hex: aceita #abc, abcdef e maiúsculas; recusa o resto", () => {
  assert.equal(normalizeHex("#ABC"), "#aabbcc");
  assert.equal(normalizeHex("abcdef"), "#abcdef");
  assert.equal(normalizeHex("#AbCdEf"), "#abcdef");
  assert.equal(normalizeHex("  #0A6A9A "), "#0a6a9a");
  for (const bad of ["", "#", "#abcd", "#abcdefa", "ghijkl", "#12345g", "red", "#fff;}", "rgb(0 0 0)"]) assert.equal(normalizeHex(bad), null, bad);
});

test("os tokens copiados são os de :root em globals.css", () => {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
  const declared = Object.fromEntries([...root.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
  for (const [name, value] of Object.entries({ ...DEFAULT_TOKENS, ...FIXED_TOKENS })) assert.equal(declared[name], value, name);
});

test("cores padrão: nenhum CSS a mais e o mesmo valor de hoje em cada token", () => {
  const palette = derivePalette(DEFAULT_BRAND);
  assert.equal(brandCss(palette), "");
  assert.equal(palette.adjusted, false);
  assert.deepEqual(palette.colors, DEFAULT_BRAND);
  assert.deepEqual(palette.tokens, { ...DEFAULT_TOKENS });
  assertAccessible(palette, "padrão");
  assert.equal(brandCss(derivePalette({ primary: "#0A6A9A", menu: "0b3550" })), "");
});

test("combinações difíceis: todo par usado na interface passa a AA", () => {
  for (const primary of HARD) for (const menu of HARD) assertAccessible(derivePalette({ primary, menu }), `${primary}/${menu}`);
});

test("cores sorteadas: todo par passa e a derivação é estável", () => {
  let seed = 20261117;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const hex = () => `#${Math.floor(next() * 0xffffff).toString(16).padStart(6, "0")}`;
  for (let i = 0; i < 400; i++) {
    const colors = { primary: hex(), menu: hex() };
    const palette = derivePalette(colors);
    assertAccessible(palette, `${colors.primary}/${colors.menu}`);
    const again = derivePalette(palette.colors);
    assert.equal(again.adjusted, false, `${colors.primary}/${colors.menu}: reaplicar a cor ajustada não ajusta de novo`);
    assert.deepEqual(again.tokens, palette.tokens);
  }
});

test("cor que não serve é ajustada só na luminosidade, e o resultado diz isso", () => {
  const yellow = derivePalette({ primary: "#ffff00", menu: "#e0f0ff" });
  assert.equal(yellow.adjusted, true);
  assert.notEqual(yellow.colors.primary, "#ffff00");
  assert.notEqual(yellow.colors.menu, "#e0f0ff");
  assert.ok(ratio("#ffffff", yellow.colors.primary) >= 4.5);
  const hue = (hex) => {
    const [r, g, b] = rgb(hex);
    return Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b);
  };
  assert.ok(Math.abs(hue(yellow.colors.primary) - hue("#ffff00")) < 0.1, "o amarelo continua amarelo, mais escuro");
  const fine = derivePalette({ primary: "#1f6f43", menu: "#0b3550" });
  assert.equal(fine.adjusted, false);
  assert.equal(fine.tokens["--brand"], "#1f6f43");
  assert.equal(fine.tokens["--navy"], "#0b3550");
});

test("CSS: só os tokens que mudaram, sem nada além de cores", () => {
  const palette = derivePalette({ primary: "#c8102e", menu: "#0b3550" });
  const css = brandCss(palette);
  assert.match(css, /^:root\{[^{}]+\}$/);
  const declarations = css.slice(6, -1).split(";");
  const arrow = declarations.find((declaration) => declaration.startsWith("--select-arrow:"));
  assert.ok(arrow?.includes("stroke='%23c8102e'"), "a seta da lista acompanha a cor principal");
  assert.equal(arrow.replace(/%23c8102e/, ""), `--select-arrow:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`);
  for (const declaration of declarations.filter((item) => item !== arrow)) {
    const [name, value] = declaration.split(":");
    assert.ok(name in DEFAULT_TOKENS, name);
    assert.notEqual(value, DEFAULT_TOKENS[name]);
    assert.match(value, /^(#[0-9a-f]{6}|[0-9 px-]+rgb\(\d+ \d+ \d+ \/ [0-9.]+\))$/);
  }
  assert.ok(!css.includes("--navy:"), "o menu padrão não muda");
  assert.ok(css.includes("--brand:#c8102e"));
});

test("cor inválida vinda do banco cai no padrão, sem chegar ao CSS", () => {
  assert.equal(brandCss(derivePalette({ primary: "red;} body{display:none", menu: "</style>" })), "");
});

test("menu: aceita cor escura, recusa cor clara", () => {
  assert.equal(fitsMenu("#0b3550"), true);
  assert.equal(fitsMenu("#000000"), true);
  assert.equal(fitsMenu("#ffff00"), false);
  assert.equal(fitsMenu("#808080"), false);
});
