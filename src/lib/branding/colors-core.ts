import { fromOklch, oklabDistance, oklabToRgb, rgbToHex, rgbToOklab, toOklch, type Oklab } from "./color-math.ts";
import { DEFAULT_BRAND, fitsMenu, normalizeHex, type BrandColors } from "./palette.ts";

export type Swatch = { hex: string; share: number };
export type BrandSuggestion = { colors: BrandColors; swatches: Swatch[]; source: "ia" | "regras"; note: string };
export type Choice = { colors: BrandColors; note: string };

export const MAX_SWATCHES = 6;
const CLUSTERS = 8;
const OPAQUE = 128;
const NEAR_WHITE = { l: 0.93, c: 0.035 };
const SAME_COLOR = 0.05;
const MERGE = 0.06;
const SNAP = 0.03;
const MIN_SHARE = 0.01;
const MIN_FOREGROUND = 0.03;
const SATURATED = 0.05;
const BLEND = 0.035;
const ARTIFACT_WEIGHT = 0.5;
export const DERIVE_MENU = "derivar";

type Point = { key: number; lab: Oklab; weight: number };
type Cluster = { center: Oklab; members: Point[]; weight: number };

const chroma = ([, a, b]: Oklab) => Math.hypot(a, b);
const isNearWhite = (lab: Oklab) => lab[0] >= NEAR_WHITE.l && chroma(lab) <= NEAR_WHITE.c;
const labOfKey = (key: number): Oklab => rgbToOklab([(key >> 16) / 255, ((key >> 8) & 255) / 255, (key & 255) / 255]);
const hexOfKey = (key: number) => `#${key.toString(16).padStart(6, "0")}`;
const WHITE = labOfKey(0xffffff);

function weightedMean(points: Point[]): Oklab {
  const total = points.reduce((sum, point) => sum + point.weight, 0);
  return [0, 1, 2].map((axis) => points.reduce((sum, point) => sum + point.lab[axis] * point.weight, 0) / total) as Oklab;
}

function borderColor(pixels: ArrayLike<number>, width: number, height: number): Oklab | null {
  const counts = new Map<number, number>();
  let ring = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y > 0 && y < height - 1 && x > 0 && x < width - 1) continue;
      ring++;
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < OPAQUE) continue;
      const key = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const points = [...counts].map(([key, weight]) => ({ key, weight, lab: labOfKey(key) }));
  for (const candidate of points.sort((a, b) => b.weight - a.weight || a.key - b.key).slice(0, 3)) {
    const close = points.filter((point) => oklabDistance(point.lab, candidate.lab) < SAME_COLOR).reduce((sum, point) => sum + point.weight, 0);
    if (close >= ring * 0.7) return candidate.lab;
  }
  return null;
}

function seeds(points: Point[], k: number): Oklab[] {
  const centers = [points[0].lab];
  while (centers.length < k) {
    let best: Point | null = null;
    let bestScore = 0;
    for (const point of points) {
      const nearest = Math.min(...centers.map((center) => oklabDistance(center, point.lab)));
      const score = point.weight * nearest * nearest;
      if (score > bestScore) {
        best = point;
        bestScore = score;
      }
    }
    if (!best) break;
    centers.push(best.lab);
  }
  return centers;
}

function kMeans(points: Point[], k: number): Cluster[] {
  let centers = seeds(points, k);
  let assignment: number[] = [];
  for (let round = 0; round < 30; round++) {
    const next = points.map((point) => {
      let index = 0;
      centers.forEach((center, i) => {
        if (oklabDistance(center, point.lab) < oklabDistance(centers[index], point.lab)) index = i;
      });
      return index;
    });
    const stable = next.every((value, i) => value === assignment[i]);
    assignment = next;
    centers = centers.map((center, i) => {
      const members = points.filter((_, p) => assignment[p] === i);
      return members.length ? weightedMean(members) : center;
    });
    if (stable) break;
  }
  return centers
    .map((center, i) => {
      const members = points.filter((_, p) => assignment[p] === i);
      return { center, members, weight: members.reduce((sum, point) => sum + point.weight, 0) };
    })
    .filter((cluster) => cluster.weight > 0);
}

function mergeClose(clusters: Cluster[]): Cluster[] {
  const list = [...clusters];
  for (;;) {
    let pair: [number, number] | null = null;
    let closest = MERGE;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const distance = oklabDistance(list[i].center, list[j].center);
        if (distance < closest) {
          closest = distance;
          pair = [i, j];
        }
      }
    }
    if (!pair) return list;
    const members = [...list[pair[0]].members, ...list[pair[1]].members];
    const merged = { center: weightedMean(members), members, weight: list[pair[0]].weight + list[pair[1]].weight };
    list.splice(pair[1], 1);
    list.splice(pair[0], 1, merged);
  }
}

function representative(cluster: Cluster): string {
  const heaviest = cluster.members.reduce((best, point) => (point.weight > best.weight || (point.weight === best.weight && point.key < best.key) ? point : best));
  return oklabDistance(heaviest.lab, cluster.center) <= SNAP ? hexOfKey(heaviest.key) : rgbToHex(oklabToRgb(cluster.center));
}

// Na borda de cada forma, o desenho mistura a cor com a vizinha (antisserrilhado,
// compressão do JPEG), no sRGB com gama: o resultado cai no segmento entre as duas.
function blendPosition(color: Oklab, from: Oklab, to: Oklab): number | null {
  const [x, a, b] = [color, from, to].map(oklabToRgb);
  const direction = b.map((value, i) => value - a[i]);
  const length = direction.reduce((sum, value) => sum + value * value, 0);
  if (!length) return null;
  const t = direction.reduce((sum, value, i) => sum + (x[i] - a[i]) * value, 0) / length;
  if (t < 0.08 || t > 0.92) return null;
  return oklabDistance(rgbToOklab(a.map((value, i) => value + t * direction[i]) as [number, number, number]), color) < BLEND ? t : null;
}

function foldEdgeBlends(clusters: Cluster[], backgrounds: Oklab[]): Cluster[] {
  const list = [...clusters].sort((a, b) => b.weight - a.weight).map((cluster) => ({ ...cluster }));
  const alive = list.map(() => true);
  for (let i = list.length - 1; i > 0; i--) {
    const blend = list[i];
    const ends: { center: Oklab; cluster: (typeof list)[number] | null }[] = [
      ...list.slice(0, i).filter((cluster, j) => alive[j] && blend.weight <= cluster.weight * ARTIFACT_WEIGHT).map((cluster) => ({ center: cluster.center, cluster })),
      ...backgrounds.map((center) => ({ center, cluster: null })),
    ];
    search: for (let a = 0; a < ends.length; a++) {
      for (let b = a + 1; b < ends.length; b++) {
        const t = blendPosition(blend.center, ends[a].center, ends[b].center);
        if (t === null) continue;
        const target = (t < 0.5 ? ends[a].cluster : ends[b].cluster) ?? ends[a].cluster ?? ends[b].cluster;
        if (target) target.weight += blend.weight;
        alive[i] = false;
        break search;
      }
    }
  }
  return list.filter((_, i) => alive[i]);
}

export function pixelsToSwatches(pixels: ArrayLike<number>, width: number, height: number): Swatch[] {
  const counts = new Map<number, number>();
  for (let i = 0; i < width * height * 4; i += 4) {
    if (pixels[i + 3] < OPAQUE) continue;
    const key = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const opaque = [...counts].map(([key, weight]) => ({ key, weight, lab: labOfKey(key) }));
  const colored = opaque.filter((point) => !isNearWhite(point.lab));
  const border = borderColor(pixels, width, height);
  const foreground = border ? colored.filter((point) => oklabDistance(point.lab, border) >= SAME_COLOR) : colored;
  const total = (points: Point[]) => points.reduce((sum, point) => sum + point.weight, 0);
  const points = total(foreground) >= total(opaque) * MIN_FOREGROUND ? foreground : colored;
  if (!points.length) return [];
  points.sort((a, b) => b.weight - a.weight || a.key - b.key);
  const all = total(points);
  const shares = new Map<string, number>();
  const clusters = mergeClose(kMeans(points, Math.min(CLUSTERS, points.length)));
  for (const cluster of foldEdgeBlends(clusters, border ? [WHITE, border] : [WHITE])) {
    const hex = representative(cluster);
    shares.set(hex, (shares.get(hex) ?? 0) + cluster.weight / all);
  }
  return [...shares]
    .map(([hex, share]) => ({ hex, share }))
    .filter((swatch) => swatch.share >= MIN_SHARE)
    .sort((a, b) => b.share - a.share || a.hex.localeCompare(b.hex))
    .slice(0, MAX_SWATCHES);
}

export const isSaturated = (hex: string) => toOklch(hex).c >= SATURATED;

const DEFAULT_MENU = toOklch(DEFAULT_BRAND.menu);

export function darkShadeOf(hex: string): string {
  const color = toOklch(hex);
  return fromOklch({ l: DEFAULT_MENU.l, c: Math.min(color.c, DEFAULT_MENU.c * 1.5), h: color.h });
}

export function chooseByRules(swatches: Swatch[]): Choice {
  const saturated = swatches.filter((swatch) => isSaturated(swatch.hex)).sort((a, b) => b.share - a.share);
  if (!saturated.length) {
    return { colors: { ...DEFAULT_BRAND }, note: "O logo só tem preto, branco ou cinza: ficaram as cores padrão da plataforma. Escolha as cores à mão, se quiser." };
  }
  const primary = saturated[0].hex;
  const menu = saturated
    .filter((swatch) => swatch.hex !== primary && fitsMenu(swatch.hex))
    .sort((a, b) => toOklch(a.hex).l - toOklch(b.hex).l)[0]?.hex;
  return menu
    ? { colors: { primary, menu }, note: "Cor principal: a mais presente no logo. Menu: a cor mais escura do logo, que aceita texto branco." }
    : { colors: { primary, menu: darkShadeOf(primary) }, note: "Cor principal: a mais presente no logo. Menu: um tom escuro da cor principal, porque o logo não tem outra cor escura o bastante para texto branco." };
}

export type AiAnswer = { primary: string; menu: string; note: string };

export function acceptAiAnswer(swatches: Swatch[], answer: AiAnswer): Choice | null {
  const allowed = new Set(swatches.map((swatch) => swatch.hex));
  const primary = normalizeHex(answer.primary);
  if (!primary || !allowed.has(primary)) return null;
  const derive = answer.menu.trim() === DERIVE_MENU;
  const menu = derive ? darkShadeOf(primary) : normalizeHex(answer.menu);
  if (!menu || (!derive && !allowed.has(menu))) return null;
  const note = answer.note.replace(/\s+/g, " ").trim().slice(0, 280);
  return { colors: { primary, menu }, note: note || "Cores escolhidas pela IA a partir do logo." };
}
