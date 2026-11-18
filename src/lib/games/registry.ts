export const LEVELS = ["facil", "medio", "desafio"] as const;
export type Level = (typeof LEVELS)[number];
export const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level);
export const LEVEL_LABEL: Record<Level, string> = { facil: "Fácil", medio: "Médio", desafio: "Desafio" };

export const GAME_CATEGORIES = ["Todos", "Comunicação", "Memória", "Alfabetização", "Matemática", "Autonomia"] as const;
export type GameCategory = Exclude<(typeof GAME_CATEGORIES)[number], "Todos">;

export type Pic = { key: string; label: string };

export type PreviewLayout = "pares" | "fila" | "contar" | "trio" | "palavra" | "somar" | "comparar" | "subtrair";
export type PreviewMark = { kind: "numero" | "pergunta" | "letra" | "palavra" | "sequencia"; text: string };
export type Preview = { layout?: PreviewLayout; photos: string[]; mark?: PreviewMark };

type GameBase = {
  title: string;
  skill: string;
  description: string;
  categories: GameCategory[];
  unit: [one: string, many: string];
  preview: (themePics: readonly Pic[]) => Preview;
};

export type PhotoGameId = "pares" | "encontre" | "contar" | "padrao" | "cores" | "rotina" | "letras" | "palavras" | "somar" | "usos" | "classificar" | "comparar" | "silabas" | "subtrair" | "numeros";
const FULL_SCREEN_IDS = ["memoria", "sequencia", "associacao", "emocoes"] as const;
export type FullScreenId = (typeof FULL_SCREEN_IDS)[number];
export const isFullScreenId = (value: unknown): value is FullScreenId => FULL_SCREEN_IDS.includes(value as FullScreenId);

export type Mechanic = "pares" | "ordem" | "escolha" | "grupos" | "silabas";
type PhotoBase = GameBase & { id: PhotoGameId; kind: "foto"; instructions: string; rounds: number; finish: string };
export type PhotoGame = PhotoBase & (
  | { mechanic: "escolha"; hint: string; success: string }
  | { mechanic: "pares" | "ordem" | "silabas"; hint: string }
  | { mechanic: "grupos" }
);
export type FullScreenGame = GameBase & {
  id: FullScreenId;
  kind: "tela-cheia";
  mechanic: "pares" | "ordem" | "escolha";
  tone: "sky" | "teal" | "peach" | "rose";
  options: ("tema" | "modo" | "rotina")[];
};
export type Game = PhotoGame | FullScreenGame;

const ROUNDS = 5;
const FOUND = "Você encontrou! Vamos para a próxima descoberta?";
const OPTION_HINT = "Uma das opções tem uma pista para ajudar a encontrar a resposta.";
const EXPLORED = "Você explorou as cinco propostas desta partida.";
const UNIT = { pares: ["par", "pares"], passos: ["passo", "passos"], etapas: ["etapa", "etapas"], imagens: ["imagem", "imagens"], rodadas: ["rodada", "rodadas"] } satisfies Record<string, [string, string]>;
const fixed = (preview: Preview) => () => preview;

export const GAMES: readonly Game[] = [
  {
    id: "pares", kind: "foto", mechanic: "pares", title: "Memória em pares", skill: "Atenção e memória", categories: ["Memória"],
    description: "Vire as fotografias e descubra os pares de objetos do dia a dia.",
    instructions: "Toque em duas cartas. Se as fotos forem iguais, você encontrou um par. Se forem diferentes, observe com calma e tente de novo.",
    rounds: 1, unit: UNIT.pares, finish: "Você encontrou todos os pares de imagens.",
    hint: "Observe onde estão os pares. Esconda a pista quando quiser tentar.",
    preview: fixed({ layout: "pares", photos: ["maca", "bola", "maca", "bola"] }),
  },
  {
    id: "memoria", kind: "tela-cheia", mechanic: "pares", title: "Memória por temas", skill: "Atenção e memória", categories: ["Memória"],
    description: "Pares de fotografias no tema de que o estudante mais gosta.",
    unit: UNIT.pares, tone: "sky", options: ["tema"],
    preview: ([first, second]) => ({ layout: "pares", photos: [first.key, second.key, second.key, first.key] }),
  },
  {
    id: "encontre", kind: "foto", mechanic: "escolha", title: "Encontre a imagem", skill: "Comunicação e vocabulário", categories: ["Comunicação"],
    description: "Reconheça o objeto pedido entre fotografias familiares.",
    instructions: "Leia ou ouça o nome do objeto. Depois, toque na fotografia correspondente.",
    rounds: ROUNDS, unit: UNIT.rodadas, success: FOUND, finish: EXPLORED, hint: OPTION_HINT,
    preview: fixed({ photos: ["banana", "laranja", "livro"] }),
  },
  {
    id: "contar", kind: "foto", mechanic: "escolha", title: "Vamos contar", skill: "Números e quantidades", categories: ["Matemática"],
    description: "Conte os objetos, um de cada vez, e escolha a quantidade.",
    instructions: "Conte cada objeto que aparece na tela. Depois, toque no número que representa essa quantidade.",
    rounds: ROUNDS, unit: UNIT.rodadas, success: FOUND, finish: EXPLORED,
    hint: "Conte uma imagem por vez. Os números ajudam a acompanhar.",
    preview: fixed({ layout: "contar", photos: ["maca", "maca", "maca"], mark: { kind: "numero", text: "3" } }),
  },
  {
    id: "padrao", kind: "foto", mechanic: "escolha", title: "O que vem depois?", skill: "Raciocínio e padrões", categories: ["Memória", "Matemática"],
    description: "Observe o padrão das fotografias e descubra como continuar.",
    instructions: "Observe a sequência de objetos, da esquerda para a direita. Descubra o padrão e toque na foto que vem depois.",
    rounds: ROUNDS, unit: UNIT.rodadas, success: FOUND, finish: EXPLORED, hint: OPTION_HINT,
    preview: fixed({ layout: "fila", photos: ["banana", "maca", "banana", "maca"], mark: { kind: "pergunta", text: "?" } }),
  },
  {
    id: "cores", kind: "foto", mechanic: "escolha", title: "Cores do cotidiano", skill: "Percepção e associação", categories: ["Comunicação"],
    description: "Associe o nome de uma cor a objetos que você conhece.",
    instructions: "Leia ou ouça o nome da cor. Depois, toque no objeto que tem essa cor. O nome da cor também aparece por escrito.",
    rounds: ROUNDS, unit: UNIT.rodadas, success: FOUND, finish: EXPLORED, hint: OPTION_HINT,
    preview: fixed({ photos: ["bola", "mochila", "laranja"] }),
  },
  {
    id: "rotina", kind: "foto", mechanic: "ordem", title: "Minha rotina em passos", skill: "Autonomia e organização", categories: ["Autonomia"],
    description: "Organize os passos de uma história sobre o dia a dia na escola.",
    instructions: "Leia ou ouça a história. Depois, toque nos três passos na mesma ordem em que aparecem na história. Você pode desfazer e tentar de novo.",
    rounds: 1, unit: UNIT.passos, finish: "Você colocou cada passo no seu lugar.",
    hint: "Siga as palavras “primeiro”, “depois” e “por último” na história acima.",
    preview: fixed({ layout: "trio", photos: ["livro", "banana", "mochila"] }),
  },
  {
    id: "sequencia", kind: "tela-cheia", mechanic: "ordem", title: "Sequência da rotina", skill: "Organização da rotina", categories: ["Autonomia"],
    description: "Lavar as mãos, chegar na sala, lanche: ponha os passos em ordem.",
    unit: UNIT.etapas, tone: "teal", options: ["rotina"],
    preview: fixed({ layout: "trio", photos: ["torneira", "sabonete", "secar"] }),
  },
  {
    id: "letras", kind: "foto", mechanic: "escolha", title: "Primeira letra", skill: "Letras e consciência da escrita", categories: ["Alfabetização"],
    description: "Descubra a letra que começa o nome de cada objeto.",
    instructions: "Observe a fotografia e diga ou ouça o nome do objeto. Depois, toque na primeira letra desse nome. Você pode pedir uma pista.",
    rounds: ROUNDS, unit: UNIT.rodadas, success: "Essa é a primeira letra do nome da imagem!", finish: EXPLORED,
    hint: "Observe a primeira letra do nome da imagem. Uma das opções tem uma pista.",
    preview: fixed({ layout: "palavra", photos: ["maca"], mark: { kind: "letra", text: "M" } }),
  },
  {
    id: "palavras", kind: "foto", mechanic: "escolha", title: "Imagem e palavra", skill: "Leitura e vocabulário", categories: ["Alfabetização", "Comunicação"],
    description: "Ligue a fotografia de um objeto ao seu nome escrito.",
    instructions: "Observe a fotografia. Leia as palavras e escolha o nome do objeto. Você pode ouvir a instrução e usar uma pista quando quiser.",
    rounds: ROUNDS, unit: UNIT.rodadas, success: "Essa palavra corresponde à imagem!", finish: EXPLORED, hint: OPTION_HINT,
    preview: fixed({ layout: "palavra", photos: ["bola"], mark: { kind: "palavra", text: "BOLA" } }),
  },
  {
    id: "associacao", kind: "tela-cheia", mechanic: "escolha", title: "Associação", skill: "Leitura e quantidade", categories: ["Alfabetização", "Matemática"],
    description: "Ligue a figura à palavra ou a quantidade ao número.",
    unit: UNIT.rodadas, tone: "peach", options: ["tema", "modo"],
    preview: ([first]) => ({ layout: "palavra", photos: [first.key], mark: { kind: "palavra", text: first.label.toLocaleUpperCase("pt-BR") } }),
  },
  {
    id: "somar", kind: "foto", mechanic: "escolha", title: "Juntar para contar", skill: "Adição com objetos", categories: ["Matemática"],
    description: "Junte dois grupos de fotografias e descubra quantos objetos há ao todo.",
    instructions: "Observe os dois grupos. Conte os objetos do primeiro e do segundo grupo juntos. Depois, toque no número que mostra o total.",
    rounds: ROUNDS, unit: UNIT.rodadas, success: "Você juntou os grupos e encontrou o total!", finish: EXPLORED,
    hint: "Continue contando do primeiro para o segundo grupo. Os números junto às imagens ajudam a acompanhar.",
    preview: fixed({ layout: "somar", photos: ["maca", "maca", "maca"] }),
  },
  {
    id: "usos", kind: "foto", mechanic: "escolha", title: "Para que serve?", skill: "Comunicação e autonomia", categories: ["Comunicação", "Autonomia"],
    description: "Escolha um objeto que ajuda em uma situação do cotidiano.",
    instructions: "Leia ou ouça a situação. Depois, toque no objeto que pode ajudar. Observe as fotografias com calma e tente de novo se precisar.",
    rounds: ROUNDS, unit: UNIT.rodadas, success: "Esse objeto pode ajudar nessa situação!", finish: EXPLORED, hint: OPTION_HINT,
    preview: fixed({ photos: ["livro", "bola", "mochila"] }),
  },
  {
    id: "emocoes", kind: "tela-cheia", mechanic: "escolha", title: "Emoções", skill: "Comunicação e emoções", categories: ["Comunicação"],
    description: "Como você se sentiria? Escolha a emoção de cada situação.",
    unit: UNIT.rodadas, tone: "rose", options: [],
    preview: fixed({ photos: ["emocao-feliz", "emocao-triste", "emocao-medo"] }),
  },
  {
    id: "classificar", kind: "foto", mechanic: "grupos", title: "Cada coisa no seu grupo", skill: "Classificação e escolhas", categories: ["Comunicação", "Autonomia"],
    description: "Separe as fotografias de frutas das imagens que não são frutas.",
    instructions: "Escolha uma fotografia. Depois, toque em É fruta ou Não é fruta para colocar a imagem no seu grupo. Você pode observar e tentar outra vez.",
    rounds: 1, unit: UNIT.imagens, finish: "Você organizou todas as imagens nos grupos.",
    preview: fixed({ photos: ["maca", "laranja", "livro"] }),
  },
  {
    id: "comparar", kind: "foto", mechanic: "escolha", title: "Compare os grupos", skill: "Comparação de quantidades", categories: ["Matemática"],
    description: "Compare dois grupos de fotografias e descubra onde há mais ou menos objetos.",
    instructions: "Observe os dois grupos. Leia ou ouça se o pedido é encontrar mais ou menos objetos. Conte com calma e toque no grupo correspondente.",
    rounds: ROUNDS, unit: UNIT.rodadas, success: "Você comparou os grupos e encontrou a quantidade pedida!", finish: EXPLORED,
    hint: "Conte as imagens de cada grupo. Confira se a pergunta pede mais ou menos objetos.",
    preview: fixed({ layout: "comparar", photos: ["maca", "maca", "maca"] }),
  },
  {
    id: "silabas", kind: "foto", mechanic: "silabas", title: "Monte a palavra", skill: "Sílabas e formação de palavras", categories: ["Alfabetização"],
    description: "Junte as partes do nome de um objeto para formar a palavra.",
    instructions: "Observe a fotografia e diga ou ouça o nome do objeto. Toque nas sílabas, uma por vez, para formar a palavra. Você pode retirar a última parte ou recomeçar a montagem.",
    rounds: ROUNDS, unit: UNIT.rodadas, finish: EXPLORED,
    hint: "Use a palavra de apoio e organize as partes da esquerda para a direita.",
    preview: fixed({ layout: "palavra", photos: ["bola"], mark: { kind: "palavra", text: "BO · LA" } }),
  },
  {
    id: "subtrair", kind: "foto", mechanic: "escolha", title: "Quantos ficaram?", skill: "Subtração com objetos", categories: ["Matemática"],
    description: "Observe os objetos retirados e conte quantos ficaram, incluindo quando não sobra nenhum.",
    instructions: "Leia ou ouça quantos objetos havia e quantos foram retirados. Observe as fotografias e escolha o número de objetos que ficaram. Quando não ficar nenhum, escolha zero.",
    rounds: ROUNDS, unit: UNIT.rodadas, success: "Você descobriu quantos objetos ficaram!", finish: EXPLORED,
    hint: "As imagens marcadas como Retirado já saíram. Conte somente as outras.",
    preview: fixed({ layout: "subtrair", photos: ["laranja", "laranja", "laranja"] }),
  },
  {
    id: "numeros", kind: "foto", mechanic: "escolha", title: "Número que falta", skill: "Sequência numérica", categories: ["Matemática"],
    description: "Observe a sequência de números e encontre o que completa o espaço.",
    instructions: "Leia os números da esquerda para a direita. Descubra como a sequência continua e toque no número que falta. Use uma pista se precisar.",
    rounds: ROUNDS, unit: UNIT.rodadas, success: "Esse número completa a sequência!", finish: EXPLORED,
    hint: "Observe quanto o número aumenta de uma posição para a próxima.",
    preview: fixed({ photos: ["maca"], mark: { kind: "sequencia", text: "1   ?   3" } }),
  },
];

export function gameById(id: PhotoGameId): PhotoGame;
export function gameById(id: FullScreenId): FullScreenGame;
export function gameById(id: Game["id"]): Game {
  return GAMES.find((game) => game.id === id)!;
}

export type GameResult = { done: number; total: number; hints: number; retries: number };

export function gameNote(game: Game, level: Level, detail: string | null, result: GameResult): string {
  const parts = [
    `${result.done} de ${result.total} ${game.unit[1]}`,
    result.hints ? `${result.hints} ${result.hints === 1 ? "dica" : "dicas"}` : "sem dica",
    result.retries ? `${result.retries} ${result.retries === 1 ? "tentativa a mais" : "tentativas a mais"}` : null,
  ].filter(Boolean);
  return `Jogo: ${game.title} (${LEVEL_LABEL[level].toLowerCase()}${detail ? `, ${detail}` : ""}). ${parts.join(" · ")}.`;
}

export function suggestedRecord(result: GameResult): { participation: "total" | "parcial"; criterionMet: "sim" | "parcial" | "nao"; supportLevel: number } {
  const finished = result.done >= result.total;
  return {
    participation: finished ? "total" : "parcial",
    criterionMet: finished && result.hints === 0 ? "sim" : finished ? "parcial" : "nao",
    supportLevel: result.hints === 0 && result.retries <= 1 ? 1 : result.hints <= 2 ? 2 : 3,
  };
}
