import { contrast, fromOklch, over, rgbBytes, toOklch, type Oklch, type Rgb } from "./color-math.ts";

export type BrandColors = { primary: string; menu: string };
export type BrandTokens = Record<`--${string}`, string>;
export type ContrastCheck = { label: string; ratio: number; min: number; ok: boolean };
export type BrandPalette = { colors: BrandColors; tokens: BrandTokens; checks: ContrastCheck[]; adjusted: boolean };

export const DEFAULT_BRAND: BrandColors = { primary: "#0a6a9a", menu: "#0b3550" };

// Valores de :root em src/app/globals.css (palette.test.mjs confere a cópia).
export const FIXED_TOKENS = {
  "--paper": "#f3f6f8",
  "--paper-raised": "#ffffff",
  "--canvas": "#dce6eb",
  "--surface-muted": "#e6eef1",
  "--on-navy": "#ffffff",
  "--coral-soft": "#f7dee0",
  "--green-soft": "#e4f2d8",
  "--sky-soft": "#e2f1f8",
  "--signal-track": "#e3ecef",
  "--signal-lime": "#7cb93a",
  "--signal-yellow": "#f5be0b",
  "--signal-orange": "#f4693a",
} as const;

export const DEFAULT_TOKENS = {
  "--brand": "#0a6a9a",
  "--brand-strong": "#08547a",
  "--brand-soft": "#e2f1f8",
  "--lilac-warm": "#d3e9f5",
  "--lilac-soft": "#e6f3f9",
  "--lilac": "#cfe5f1",
  "--lilac-cool": "#d8e6ee",
  "--navy": "#0b3550",
  "--on-navy-soft": "#c3d7e3",
  "--accent-sky": "#4fb3e3",
  "--ink-strong": "#06243a",
  "--ink": "#0b3550",
  "--ink-soft": "#4a6577",
  "--shadow-e1": "0 2px 8px rgb(11 53 80 / 0.03)",
  "--shadow-e2": "0 8px 24px rgb(11 53 80 / 0.08)",
  "--shadow-glow": "0 0 0 4px rgb(79 179 227 / 0.35)",
  "--shadow-frame": "0 24px 80px -36px rgb(11 53 80 / 0.24)",
} as const satisfies BrandTokens;

type TokenName = keyof typeof DEFAULT_TOKENS;

// Opacidades de --navy-hover e --navy-line em globals.css: fundos de chips e
// botões sobre o marinho, com texto por cima.
const NAVY_HOVER = 0.1;
const NAVY_LINE = 0.16;
const TEXT_MIN = 4.5;
const UI_MIN = 3;
// Folga na hora de ajustar, para arredondamentos do navegador não derrubarem um par no limite.
const MARGIN = 0.05;
const ACHROMATIC = 0.03;

const F = FIXED_TOKENS;
const WHITE = F["--on-navy"];

export function normalizeHex(value: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  return `#${digits.toLowerCase()}`;
}

const worst = (color: string | Rgb, backgrounds: (string | Rgb)[]) => Math.min(...backgrounds.map((background) => contrast(color, background)));

type Rule = { label: string; min: number; ratio: (t: Record<TokenName, string>) => number };

const BRAND_BACKGROUNDS = (t: Record<TokenName, string>) => [F["--paper"], F["--paper-raised"], F["--canvas"], F["--surface-muted"], t["--brand-soft"]];
const BRAND_STRONG_BACKGROUNDS = (t: Record<TokenName, string>) => [...BRAND_BACKGROUNDS(t), t["--lilac"], t["--lilac-soft"], t["--lilac-warm"], F["--coral-soft"], F["--green-soft"]];
const INK_BACKGROUNDS = (t: Record<TokenName, string>) => [...BRAND_STRONG_BACKGROUNDS(t), t["--lilac-cool"], F["--sky-soft"], F["--signal-track"], t["--accent-sky"], F["--signal-lime"], F["--signal-yellow"]];
const INK_SOFT_BACKGROUNDS = (t: Record<TokenName, string>) => [F["--paper"], F["--paper-raised"], F["--canvas"], F["--surface-muted"], t["--brand-soft"], F["--coral-soft"], F["--signal-track"], F["--sky-soft"]];
const SIGNALS = [F["--signal-lime"], F["--signal-yellow"], F["--signal-orange"]];

// Os pares que a interface usa como texto ou como parte significativa (WCAG 2.2:
// 1.4.3 pede 4,5:1 para texto; 1.4.11, 3:1 para contorno de foco, ícones e bordas).
const RULES: Record<string, Rule> = {
  whiteOnBrand: { label: "Texto branco no botão principal", min: TEXT_MIN, ratio: (t) => contrast(WHITE, t["--brand"]) },
  whiteOnBrandStrong: { label: "Texto branco no botão principal ao passar o mouse", min: TEXT_MIN, ratio: (t) => contrast(WHITE, t["--brand-strong"]) },
  brandText: { label: "Cor principal em links e ícones sobre fundos claros", min: TEXT_MIN, ratio: (t) => worst(t["--brand"], BRAND_BACKGROUNDS(t)) },
  brandStrongText: { label: "Tom escuro da cor principal em links e botões secundários", min: TEXT_MIN, ratio: (t) => worst(t["--brand-strong"], BRAND_STRONG_BACKGROUNDS(t)) },
  focus: { label: "Contorno de foco do teclado na página e no menu", min: UI_MIN, ratio: (t) => Math.min(worst(t["--brand"], [F["--paper"], F["--paper-raised"]]), contrast(t["--accent-sky"], t["--navy"])) },
  menuText: { label: "Texto branco no menu", min: TEXT_MIN, ratio: (t) => worst(WHITE, [t["--navy"], over(t["--navy"], WHITE, NAVY_LINE)]) },
  menuSoftText: { label: "Texto de apoio no menu", min: TEXT_MIN, ratio: (t) => worst(t["--on-navy-soft"], [t["--navy"], over(t["--navy"], WHITE, NAVY_HOVER)]) },
  accentOnMenu: { label: "Destaque do item ativo sobre o menu", min: TEXT_MIN, ratio: (t) => contrast(t["--accent-sky"], t["--navy"]) },
  inkStrongText: { label: "Texto do item ativo e das pílulas de situação", min: TEXT_MIN, ratio: (t) => worst(t["--ink-strong"], [t["--accent-sky"], ...SIGNALS, WHITE]) },
  inkText: { label: "Texto principal sobre o papel e os fundos suaves", min: TEXT_MIN, ratio: (t) => Math.min(worst(t["--ink"], INK_BACKGROUNDS(t)), contrast(WHITE, t["--ink"])) },
  inkSoftText: { label: "Texto de apoio sobre o papel", min: TEXT_MIN, ratio: (t) => worst(t["--ink-soft"], INK_SOFT_BACKGROUNDS(t)) },
};

const passes = (t: Record<TokenName, string>, ...rules: Rule[]) => rules.every((rule) => rule.ratio(t) >= rule.min + MARGIN);

function fitLightness(color: Oklch, direction: -1 | 1, ok: (hex: string) => boolean): string {
  const start = fromOklch(color);
  if (ok(start)) return start;
  let pass = direction < 0 ? 0 : 1;
  let fail = color.l;
  for (let i = 0; i < 40; i++) {
    const mid = (pass + fail) / 2;
    if (ok(fromOklch({ ...color, l: mid }))) pass = mid;
    else fail = mid;
  }
  return fromOklch({ ...color, l: pass });
}

const DEFAULT = { primary: toOklch(DEFAULT_BRAND.primary), menu: toOklch(DEFAULT_BRAND.menu) };

type Source = { from: Oklch; to: Oklch };
type Follow = { lightness: "fixed" | "relative"; maxScale: number };

function follow(token: TokenName, { from, to }: Source, { lightness, maxScale }: Follow): Oklch {
  const base = toOklch(DEFAULT_TOKENS[token]);
  const scale = from.c > 0 ? to.c / from.c : 0;
  return {
    l: lightness === "fixed" ? base.l : base.l + to.l - from.l,
    c: base.c * Math.min(scale, maxScale),
    h: base.h + to.h - from.h,
  };
}

const TINT: Follow = { lightness: "fixed", maxScale: 1.5 };
const TEXT: Follow = { lightness: "fixed", maxScale: 1 };
const shadow = (geometry: string, hex: string, alpha: number) => `${geometry} rgb(${rgbBytes(hex).join(" ")} / ${alpha})`;

function primaryFamily(brand: string) {
  const source = { from: DEFAULT.primary, to: toOklch(brand) };
  return {
    "--brand": brand,
    "--brand-soft": fromOklch(follow("--brand-soft", source, TINT)),
    "--lilac-warm": fromOklch(follow("--lilac-warm", source, TINT)),
    "--lilac-soft": fromOklch(follow("--lilac-soft", source, TINT)),
    "--lilac": fromOklch(follow("--lilac", source, TINT)),
    "--lilac-cool": fromOklch(follow("--lilac-cool", source, TINT)),
  };
}

export const fitsMenu = (hex: string) => passes({ ...DEFAULT_TOKENS, "--navy": hex }, RULES.menuText);

export function derivePalette(colors: BrandColors): BrandPalette {
  const primary = normalizeHex(colors.primary) ?? DEFAULT_BRAND.primary;
  const menu = normalizeHex(colors.menu) ?? DEFAULT_BRAND.menu;
  const t: Record<TokenName, string> = { ...DEFAULT_TOKENS };

  const brand = fitLightness(toOklch(primary), -1, (hex) => passes({ ...t, ...primaryFamily(hex) }, RULES.whiteOnBrand, RULES.brandText));
  Object.assign(t, primaryFamily(brand));
  const brandSource = { from: DEFAULT.primary, to: toOklch(brand) };
  t["--brand-strong"] = fitLightness(follow("--brand-strong", brandSource, { lightness: "relative", maxScale: Infinity }), -1, (hex) => passes({ ...t, "--brand-strong": hex }, RULES.whiteOnBrandStrong, RULES.brandStrongText));

  const navy = fitLightness(toOklch(menu), -1, fitsMenu);
  t["--navy"] = navy;
  const navySource = { from: DEFAULT.menu, to: toOklch(navy) };
  const accentSource = navySource.to.c >= ACHROMATIC ? navySource : brandSource;
  t["--ink-strong"] = fitLightness(follow("--ink-strong", navySource, TEXT), -1, (hex) => worst(hex, [...SIGNALS, WHITE]) >= TEXT_MIN + MARGIN);
  t["--accent-sky"] = fitLightness(follow("--accent-sky", accentSource, TINT), 1, (hex) => passes({ ...t, "--accent-sky": hex }, RULES.accentOnMenu, RULES.inkStrongText));
  t["--on-navy-soft"] = fitLightness(follow("--on-navy-soft", navySource, TEXT), 1, (hex) => passes({ ...t, "--on-navy-soft": hex }, RULES.menuSoftText));
  t["--ink"] = fitLightness(follow("--ink", navySource, TEXT), -1, (hex) => passes({ ...t, "--ink": hex }, RULES.inkText));
  t["--ink-soft"] = fitLightness(follow("--ink-soft", navySource, TEXT), -1, (hex) => passes({ ...t, "--ink-soft": hex }, RULES.inkSoftText));

  t["--shadow-e1"] = shadow("0 2px 8px", t["--ink"], 0.03);
  t["--shadow-e2"] = shadow("0 8px 24px", t["--ink"], 0.08);
  t["--shadow-glow"] = shadow("0 0 0 4px", t["--accent-sky"], 0.35);
  t["--shadow-frame"] = shadow("0 24px 80px -36px", t["--ink"], 0.24);

  const checks = Object.values(RULES).map(({ label, min, ratio }) => {
    const value = ratio(t);
    return { label, min, ratio: Math.floor(value * 100) / 100, ok: value >= min };
  });
  return { colors: { primary: brand, menu: navy }, tokens: t, checks, adjusted: brand !== primary || navy !== menu };
}

export function brandCss(palette: BrandPalette): string {
  const changed = (Object.keys(DEFAULT_TOKENS) as TokenName[])
    .filter((name) => palette.tokens[name] !== undefined && palette.tokens[name] !== DEFAULT_TOKENS[name])
    .map((name) => `${name}:${palette.tokens[name]}`);
  if (palette.tokens["--brand"] !== DEFAULT_TOKENS["--brand"]) changed.push(`--select-arrow:${selectArrow(palette.tokens["--brand"])}`);
  return changed.length ? `:root{${changed.join(";")}}` : "";
}

function selectArrow(hex: string): string {
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23${hex.slice(1)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;
}
