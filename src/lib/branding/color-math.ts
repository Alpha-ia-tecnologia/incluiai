export type Rgb = [number, number, number];
export type Oklab = [number, number, number];
export type Oklch = { l: number; c: number; h: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export const rgbBytes = (hex: string): Rgb => hexToRgb(hex).map((v) => Math.round(v * 255)) as Rgb;

// Curva de transferência do sRGB (IEC 61966-2-1), a mesma que a WCAG usa.
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

// OKLab de Björn Ottosson (2020), matrizes da publicação original.
export function rgbToOklab(rgb: Rgb): Oklab {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToRgb([L, a, b]: Oklab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

// As matrizes arredondadas deixam um resto de croma (~1e-8) nos cinzas, que
// viraria um tom de 1/255 depois de mexer na luminosidade.
export function toOklch(hex: string): Oklch {
  const [l, a, b] = rgbToOklab(hexToRgb(hex));
  const c = Math.hypot(a, b);
  return c < 1e-4 ? { l, c: 0, h: 0 } : { l, c, h: (Math.atan2(b, a) * 180) / Math.PI };
}

const lchToRgb = ({ l, c, h }: Oklch): Rgb => {
  const rad = (h * Math.PI) / 180;
  return oklabToRgb([l, c * Math.cos(rad), c * Math.sin(rad)]);
};

const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-7 && v <= 1 + 1e-7);

export function fromOklch(color: Oklch): string {
  const l = clamp(color.l, 0, 1);
  const target = { ...color, l, c: Math.max(0, color.c) };
  if (inGamut(lchToRgb(target))) return rgbToHex(lchToRgb(target));
  let low = 0;
  let high = target.c;
  for (let i = 0; i < 32; i++) {
    const mid = (low + high) / 2;
    if (inGamut(lchToRgb({ ...target, c: mid }))) low = mid;
    else high = mid;
  }
  return rgbToHex(lchToRgb({ ...target, c: low }));
}

export const oklabDistance = (x: Oklab, y: Oklab) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);

// Luminância relativa e razão de contraste da WCAG 2.2 (definições do glossário).
export function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(x: string | Rgb, y: string | Rgb): number {
  const a = luminance(typeof x === "string" ? hexToRgb(x) : x);
  const b = luminance(typeof y === "string" ? hexToRgb(y) : y);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Cor com transparência sobre um fundo: o navegador compõe no sRGB com gama, canal a canal.
export function over(background: string, color: string, alpha: number): Rgb {
  const bg = hexToRgb(background);
  const fg = hexToRgb(color);
  return bg.map((v, i) => v * (1 - alpha) + fg[i] * alpha) as Rgb;
}
