// Jogos educativos do AEE: regras puras, testadas com node --test
// (src/lib/games/games-core.test.mjs). Os jogos rodam no navegador, com o
// professor ao lado: sem tempo limite, sem pontuação que compare estudantes e
// sem punição ao errar (a carta só pede outra tentativa). No fim, o professor
// decide se registra a aula.

export const GAME_KEYS = ["memoria", "sequencia", "associacao", "emocoes"] as const;
export type GameKey = (typeof GAME_KEYS)[number];
export const isGameKey = (value: unknown): value is GameKey => GAME_KEYS.includes(value as GameKey);

export const LEVELS = ["facil", "medio", "desafio"] as const;
export type Level = (typeof LEVELS)[number];
export const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level);
export const LEVEL_LABEL: Record<Level, string> = { facil: "Fácil", medio: "Médio", desafio: "Desafio" };
// Os jogos de fotografias (src/lib/games.ts) têm dois níveis: o fácil vira
// "com mais apoio"; o médio e o desafio, "mais desafios".
export const photoLevel = (level: Level): 1 | 2 => (level === "facil" ? 1 : 2);

export const GAMES: Record<GameKey, { title: string; skill: string }> = {
  memoria: { title: "Memória por temas", skill: "Atenção e memória" },
  sequencia: { title: "Sequência da rotina", skill: "Organização da rotina" },
  associacao: { title: "Associação", skill: "Leitura e quantidade" },
  emocoes: { title: "Emoções", skill: "Comunicação e emoções" },
};

// Figura do jogo: chave da fotografia local (game-photos.ts) e nome acessível.
export type Pic = { key: string; label: string };

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

// O tema começa pelo que o estudante mais gosta ("Como aprende", na ordem em
// que a equipe registrou); sem pista, animais.
export function themeFromInterests(interests: string[]): ThemeKey {
  for (const interest of interests) {
    const text = normalize(interest);
    const match = THEME_HINTS.find(([, pattern]) => pattern.test(text));
    if (match) return match[0];
  }
  return "animais";
}

// Nível sugerido pelo apoio de que o estudante precisa hoje (escala de 0 a 5):
// mais apoio, menos cartas e menos opções. O professor pode trocar.
export function suggestedLevel(profile: { readingSupport: number; mathSupport: number; organization: number } | null): Level {
  if (!profile) return "facil";
  const average = (profile.readingSupport + profile.mathSupport + profile.organization) / 3;
  return average >= 3.5 ? "facil" : average >= 2 ? "medio" : "desafio";
}

// Embaralhamento de Fisher-Yates; o sorteio vem de fora para os testes repetirem.
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [out[index], out[other]] = [out[other], out[index]];
  }
  return out;
}

// ---------- Memória ----------
export const MEMORY_PAIRS: Record<Level, number> = { facil: 2, medio: 4, desafio: 6 };
export type MemoryCard = { id: string; pic: Pic };

export function memoryDeck(theme: ThemeKey, level: Level, random: () => number = Math.random): MemoryCard[] {
  const pics = shuffle(themePics(theme), random).slice(0, MEMORY_PAIRS[level]);
  return shuffle(pics.flatMap((pic) => [{ id: `${pic.key}-1`, pic }, { id: `${pic.key}-2`, pic }]), random);
}

// ---------- Sequência da rotina ----------
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

// Etapas na ordem certa: no fácil, 3; no médio, 4; no desafio, a rotina inteira.
export function routineSteps(routine: RoutineKey, level: Level): Pic[] {
  const { steps, facil, medio } = ROUTINES[routine];
  return level === "facil" ? facil.map((index) => steps[index]) : level === "medio" ? medio.map((index) => steps[index]) : [...steps];
}

// ---------- Associação e emoções: 5 rodadas ----------
export const ROUNDS = 5;
export const OPTION_COUNT: Record<Level, number> = { facil: 2, medio: 3, desafio: 4 };
export const QUANTITY_MAX: Record<Level, number> = { facil: 3, medio: 5, desafio: 9 };

export type AssociationMode = "palavra" | "quantidade";
export const isAssociationMode = (value: unknown): value is AssociationMode => value === "palavra" || value === "quantidade";
export type ChoiceRound = { id: string; pic: Pic; count: number; options: string[]; answer: string };

// Sorteia ROUNDS alvos sem repetir em seguida (com poucas figuras, repete de forma espaçada).
function targets<T>(items: readonly T[], random: () => number): T[] {
  const out: T[] = [];
  while (out.length < ROUNDS) out.push(...shuffle(items, random).filter((item, index) => !(index === 0 && item === out.at(-1))));
  return out.slice(0, ROUNDS);
}

export function wordRounds(theme: ThemeKey, level: Level, random: () => number = Math.random): ChoiceRound[] {
  const pics = themePics(theme);
  return targets(pics, random).map((pic, index) => {
    const distractors = shuffle(pics.filter((item) => item.key !== pic.key), random).slice(0, OPTION_COUNT[level] - 1);
    return { id: `r${index}`, pic, count: 1, answer: pic.label, options: shuffle([pic, ...distractors], random).map((item) => item.label) };
  });
}

export function quantityRounds(theme: ThemeKey, level: Level, random: () => number = Math.random): ChoiceRound[] {
  const max = QUANTITY_MAX[level];
  const numbers = Array.from({ length: max }, (_, index) => index + 1);
  const counts = targets(numbers, random);
  const pics = targets(themePics(theme), random);
  return counts.map((count, index) => {
    const distractors = shuffle(numbers.filter((value) => value !== count), random).slice(0, OPTION_COUNT[level] - 1);
    // Números em ordem crescente: a posição ajuda a contar.
    return { id: `r${index}`, pic: pics[index], count, answer: String(count), options: [count, ...distractors].sort((a, b) => a - b).map(String) };
  });
}

export const EMOTIONS = ["feliz", "triste", "bravo", "medo"] as const;
export type Emotion = (typeof EMOTIONS)[number];
export const EMOTION_LABEL: Record<Emotion, string> = { feliz: "Feliz", triste: "Triste", bravo: "Bravo", medo: "Com medo" };
// Sempre na mesma ordem: a posição fixa ajuda quem precisa de previsibilidade.
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

export function emotionRounds(level: Level, random: () => number = Math.random): EmotionRound[] {
  const options = EMOTION_OPTIONS[level];
  const pool = SITUATIONS.filter((item) => options.includes(item.emotion));
  return targets(pool, random).map((item, index) => ({ id: `r${index}`, text: item.text, icon: item.icon, answer: item.emotion, options }));
}

// ---------- Fim do jogo: a nota e o registro sugerido ----------
export type GameResult = { done: number; total: number; hints: number; retries: number };

// Nota do registro, igual para todos os jogos da página: o nome do jogo, o
// nível e quantas dicas e tentativas a mais houve. O professor pode editar.
export function gameNote(title: string, level: Level, detail: string | null, result: GameResult, unit: string): string {
  const parts = [
    `${result.done} de ${result.total} ${unit}`,
    result.hints ? `${result.hints} ${result.hints === 1 ? "dica" : "dicas"}` : "sem dica",
    result.retries ? `${result.retries} ${result.retries === 1 ? "tentativa a mais" : "tentativas a mais"}` : null,
  ].filter(Boolean);
  return `Jogo: ${title} (${LEVEL_LABEL[level].toLowerCase()}${detail ? `, ${detail}` : ""}). ${parts.join(" · ")}.`;
}

export function sessionNote(game: GameKey, level: Level, detail: string | null, result: GameResult): string {
  return gameNote(GAMES[game].title, level, detail, result, game === "memoria" ? "pares" : game === "sequencia" ? "etapas" : "rodadas");
}

// Ponto de partida para o professor: ele confere e muda antes de registrar.
export function suggestedRecord(result: GameResult): { participation: "total" | "parcial"; criterionMet: "sim" | "parcial" | "nao"; supportLevel: number } {
  const finished = result.done >= result.total;
  return {
    participation: finished ? "total" : "parcial",
    criterionMet: finished && result.hints === 0 ? "sim" : finished ? "parcial" : "nao",
    supportLevel: result.hints === 0 && result.retries <= 1 ? 1 : result.hints <= 2 ? 2 : 3,
  };
}
