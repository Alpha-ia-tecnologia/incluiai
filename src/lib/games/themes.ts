import { pairDeck, shuffle, withDistractors, type MemoryCard, type RandomSource } from "./mechanics.ts";
import type { FullScreenId, Level, Pic } from "./registry.ts";

export const THEMES = {
  animais: { label: "Animais", items: [["cachorro", "Cachorro"], ["gato", "Gato"], ["peixe", "Peixe"], ["passaro", "Pássaro"], ["coelho", "Coelho"], ["tartaruga", "Tartaruga"], ["esquilo", "Esquilo"], ["caracol", "Caracol"]] },
  alimentos: { label: "Alimentos", items: [["maca", "Maçã"], ["banana", "Banana"], ["uva", "Uva"], ["cereja", "Cereja"], ["cenoura", "Cenoura"], ["laranja", "Laranja"], ["pao", "Pão"], ["leite", "Leite"]] },
  transportes: { label: "Transportes", items: [["carro", "Carro"], ["onibus", "Ônibus"], ["bicicleta", "Bicicleta"], ["aviao", "Avião"], ["barco", "Barco"], ["trem", "Trem"], ["caminhao", "Caminhão"]] },
  escola: { label: "Escola", items: [["livro", "Livro"], ["lapis", "Lápis"], ["mochila", "Mochila"], ["tesoura", "Tesoura"], ["regua", "Régua"], ["relogio", "Relógio"], ["computador", "Computador"]] },
  natureza: { label: "Natureza", items: [["sol", "Sol"], ["lua", "Lua"], ["nuvem", "Nuvem"], ["chuva", "Chuva"], ["flor", "Flor"], ["arvore", "Árvore"], ["estrela", "Estrela"], ["folha", "Folha"]] },
} as const;
export type ThemeKey = keyof typeof THEMES;
export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];
export const isThemeKey = (value: unknown): value is ThemeKey => typeof value === "string" && value in THEMES;
export const themePics = (theme: ThemeKey): Pic[] => THEMES[theme].items.map(([key, label]) => ({ key, label }));

const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const THEME_HINTS: [ThemeKey, RegExp][] = [
  ["transportes", /carro|onibus|trem|aviao|barco|caminh|moto|bicicleta|transporte/],
  ["alimentos", /fruta|comida|lanche|cozinh|bolo|doce|alimento/],
  ["natureza", /natureza|planta|flor|jardim|chuva|sol|lua|estrela|vulc|ceu|planeta/],
  ["escola", /livro|ler|leitura|desenh|pintar|escola|letra|numero/],
  ["animais", /anima|bicho|cachorro|gato|peixe|passaro|dinossauro|coelho|cavalo/],
];

export function themeFromInterests(interests: string[]): ThemeKey {
  for (const interest of interests) {
    const text = normalize(interest);
    const match = THEME_HINTS.find(([, pattern]) => pattern.test(text));
    if (match) return match[0];
  }
  return "animais";
}

export function suggestedLevel(profile: { readingSupport: number; mathSupport: number; organization: number } | null): Level {
  if (!profile) return "facil";
  const average = (profile.readingSupport + profile.mathSupport + profile.organization) / 3;
  return average >= 3.5 ? "facil" : average >= 2 ? "medio" : "desafio";
}

export const MEMORY_PAIRS: Record<Level, number> = { facil: 2, medio: 4, desafio: 6 };

export function memoryDeck(theme: ThemeKey, level: Level, random: RandomSource = Math.random): MemoryCard<Pic>[] {
  return pairDeck(shuffle(themePics(theme), random).slice(0, MEMORY_PAIRS[level]), (pic) => pic.key, random);
}

type Routine = { label: string; steps: Pic[]; facil: number[]; medio: number[] };
export const ROUTINES: Record<string, Routine> = {
  maos: {
    label: "Lavar as mãos",
    steps: [
      { key: "torneira", label: "Abrir a torneira" }, { key: "molhar", label: "Molhar as mãos" }, { key: "sabonete", label: "Passar sabonete" },
      { key: "esfregar", label: "Esfregar as mãos" }, { key: "enxaguar", label: "Enxaguar" }, { key: "secar", label: "Secar as mãos" },
    ],
    facil: [1, 2, 5], medio: [0, 2, 4, 5],
  },
  chegada: {
    label: "Chegar na sala",
    steps: [
      { key: "bomdia", label: "Dar bom dia" }, { key: "mochila", label: "Guardar a mochila" }, { key: "agenda", label: "Entregar a agenda" },
      { key: "sentar", label: "Sentar no lugar" }, { key: "atividade", label: "Começar a atividade" },
    ],
    facil: [1, 3, 4], medio: [0, 1, 3, 4],
  },
  lanche: {
    label: "Hora do lanche",
    steps: [
      { key: "lavar", label: "Lavar as mãos" }, { key: "pegarlanche", label: "Pegar o lanche" }, { key: "comer", label: "Comer sentado" },
      { key: "lixo", label: "Jogar o lixo no cesto" }, { key: "voltar", label: "Voltar para a sala" },
    ],
    facil: [0, 2, 3], medio: [0, 1, 2, 3],
  },
  banheiro: {
    label: "Ir ao banheiro",
    steps: [
      { key: "pedir", label: "Pedir para ir" }, { key: "vaso", label: "Usar o banheiro" }, { key: "lavar", label: "Lavar as mãos" },
      { key: "voltar", label: "Voltar para a sala" },
    ],
    facil: [0, 1, 3], medio: [0, 1, 2, 3],
  },
};
export type RoutineKey = keyof typeof ROUTINES;
export const ROUTINE_KEYS = Object.keys(ROUTINES);
export const isRoutineKey = (value: unknown): value is RoutineKey => typeof value === "string" && value in ROUTINES;

export function routineSteps(routine: RoutineKey, level: Level): Pic[] {
  const { steps, facil, medio } = ROUTINES[routine];
  return level === "facil" ? facil.map((index) => steps[index]) : level === "medio" ? medio.map((index) => steps[index]) : [...steps];
}

export const ROUNDS = 5;
export const OPTION_COUNT: Record<Level, number> = { facil: 2, medio: 3, desafio: 4 };
export const QUANTITY_MAX: Record<Level, number> = { facil: 3, medio: 5, desafio: 9 };

export type AssociationMode = "palavra" | "quantidade";
export const isAssociationMode = (value: unknown): value is AssociationMode => value === "palavra" || value === "quantidade";
export type PictureRound = { id: string; pic: Pic; count: number; options: string[]; answer: string };

function targets<T>(items: readonly T[], random: RandomSource): T[] {
  const out: T[] = [];
  while (out.length < ROUNDS) out.push(...shuffle(items, random).filter((item, index) => !(index === 0 && item === out.at(-1))));
  return out.slice(0, ROUNDS);
}

export function wordRounds(theme: ThemeKey, level: Level, random: RandomSource = Math.random): PictureRound[] {
  const pics = themePics(theme);
  return targets(pics, random).map((pic, index) => (
    { id: `r${index}`, pic, count: 1, answer: pic.label, options: withDistractors(pic, pics.filter((item) => item.key !== pic.key), OPTION_COUNT[level], random).map((item) => item.label) }
  ));
}

export function quantityRounds(theme: ThemeKey, level: Level, random: RandomSource = Math.random): PictureRound[] {
  const max = QUANTITY_MAX[level];
  const numbers = Array.from({ length: max }, (_, index) => index + 1);
  const counts = targets(numbers, random);
  const pics = targets(themePics(theme), random);
  return counts.map((count, index) => {
    const distractors = shuffle(numbers.filter((value) => value !== count), random).slice(0, OPTION_COUNT[level] - 1);
    return { id: `r${index}`, pic: pics[index], count, answer: String(count), options: [count, ...distractors].sort((a, b) => a - b).map(String) };
  });
}

export const EMOTIONS = ["feliz", "triste", "bravo", "medo"] as const;
export type Emotion = (typeof EMOTIONS)[number];
export const EMOTION_LABEL: Record<Emotion, string> = { feliz: "Feliz", triste: "Triste", bravo: "Bravo", medo: "Com medo" };
export const EMOTION_OPTIONS: Record<Level, Emotion[]> = { facil: ["feliz", "triste"], medio: ["feliz", "triste", "bravo"], desafio: ["feliz", "triste", "bravo", "medo"] };

export const SITUATIONS: { text: string; icon: string; emotion: Emotion }[] = [
  { text: "Você ganhou um presente.", icon: "presente", emotion: "feliz" },
  { text: "Você brincou com os amigos no recreio.", icon: "amigos", emotion: "feliz" },
  { text: "Você comeu o lanche de que mais gosta.", icon: "lanchefavorito", emotion: "feliz" },
  { text: "O seu sorvete caiu no chão.", icon: "sorvete", emotion: "triste" },
  { text: "O seu amigo foi embora mais cedo.", icon: "porta", emotion: "triste" },
  { text: "O seu brinquedo preferido quebrou.", icon: "brinquedo", emotion: "triste" },
  { text: "Pegaram o seu brinquedo sem pedir.", icon: "pegar", emotion: "bravo" },
  { text: "Furaram a fila na sua frente.", icon: "fila", emotion: "bravo" },
  { text: "Você ouviu um barulho muito alto.", icon: "barulho", emotion: "medo" },
  { text: "A luz apagou de repente.", icon: "escuro", emotion: "medo" },
];

export type EmotionRound = { id: string; text: string; icon: string; answer: Emotion; options: Emotion[] };

export function emotionRounds(level: Level, random: RandomSource = Math.random): EmotionRound[] {
  const options = EMOTION_OPTIONS[level];
  const pool = SITUATIONS.filter((item) => options.includes(item.emotion));
  return targets(pool, random).map((item, index) => ({ id: `r${index}`, text: item.text, icon: item.icon, answer: item.emotion, options }));
}

export type GameData =
  | { game: "memoria"; deck: MemoryCard<Pic>[] }
  | { game: "sequencia"; routine: string; steps: Pic[]; order: number[] }
  | { game: "associacao"; mode: AssociationMode; rounds: PictureRound[] }
  | { game: "emocoes"; rounds: EmotionRound[] };

export type SessionChoices = { level: Level; theme: ThemeKey; routine?: string; mode?: string };

export function fullScreenSession(game: FullScreenId, { level, theme, routine, mode }: SessionChoices, random: RandomSource = Math.random): { data: GameData; detail: string | null } {
  if (game === "memoria") return { data: { game, deck: memoryDeck(theme, level, random) }, detail: THEMES[theme].label };
  if (game === "sequencia") {
    const key = isRoutineKey(routine) ? routine : "maos";
    const steps = routineSteps(key, level);
    const indexes = steps.map((_, index) => index);
    let order = shuffle(indexes, random);
    while (order.every((value, index) => value === index)) order = shuffle(indexes, random);
    return { data: { game, routine: ROUTINES[key].label, steps, order }, detail: ROUTINES[key].label };
  }
  if (game === "associacao") {
    const byWord = !isAssociationMode(mode) || mode === "palavra";
    return {
      data: { game, mode: byWord ? "palavra" : "quantidade", rounds: byWord ? wordRounds(theme, level, random) : quantityRounds(theme, level, random) },
      detail: `${byWord ? "Figura e palavra" : "Quantidade e número"} · ${THEMES[theme].label}`,
    };
  }
  return { data: { game, rounds: emotionRounds(level, random) }, detail: null };
}
