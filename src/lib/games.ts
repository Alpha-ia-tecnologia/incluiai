/** Regras locais dos jogos: sem dados pessoais, cronômetro ou pontuação clínica. */
export type GameId = "memoria" | "encontre" | "contar" | "sequencia" | "cores" | "rotina" | "letras" | "palavras" | "somar" | "usos" | "classificar" | "comparar" | "silabas" | "subtrair" | "numeros";
export type GameLevel = 1 | 2;
export type GameObjectId = "apple" | "banana" | "orange" | "ball" | "backpack" | "book";
export type RandomSource = () => number;
export const GAME_CATEGORIES = ["Todos", "Comunicação", "Memória", "Alfabetização", "Matemática", "Autonomia"] as const;
export type GameCategory = Exclude<(typeof GAME_CATEGORIES)[number], "Todos">;

export type GameObject = {
  id: GameObjectId;
  label: string;
  plural: string;
  article: "a" | "o";
  image: string;
  color: string;
  colorLabel: string;
};

export const GAME_OBJECTS: GameObject[] = [
  { id: "apple", label: "Maçã", plural: "maçãs", article: "a", image: "/images/games/apple.webp", color: "#b93636", colorLabel: "Vermelho" },
  { id: "banana", label: "Banana", plural: "bananas", article: "a", image: "/images/games/banana.webp", color: "#e5bd32", colorLabel: "Amarelo" },
  { id: "orange", label: "Laranja", plural: "laranjas", article: "a", image: "/images/games/orange.webp", color: "#df7b21", colorLabel: "Laranja" },
  { id: "ball", label: "Bola", plural: "bolas", article: "a", image: "/images/games/ball.webp", color: "#326da7", colorLabel: "Azul" },
  { id: "backpack", label: "Mochila", plural: "mochilas", article: "a", image: "/images/games/backpack.webp", color: "#36754e", colorLabel: "Verde" },
  { id: "book", label: "Livro", plural: "livros", article: "o", image: "/images/games/book.webp", color: "#b93636", colorLabel: "Vermelho" },
];

export type GameDefinition = {
  id: GameId;
  title: string;
  description: string;
  skill: string;
  categories: GameCategory[];
  instructions: string;
  cover: string;
  duration: string;
};

export const GAME_CATALOG: GameDefinition[] = [
  {
    id: "memoria", title: "Memória em pares", skill: "Atenção e memória", categories: ["Memória"],
    description: "Vire as fotografias e descubra os pares de objetos do dia a dia.",
    instructions: "Toque em duas cartas. Se as fotos forem iguais, você encontrou um par. Se forem diferentes, observe com calma e tente de novo.",
    cover: "/images/games/apple.webp", duration: "3 a 5 min",
  },
  {
    id: "encontre", title: "Encontre a imagem", skill: "Comunicação e vocabulário", categories: ["Comunicação"],
    description: "Reconheça o objeto pedido entre fotografias familiares.",
    instructions: "Leia ou ouça o nome do objeto. Depois, toque na fotografia correspondente.",
    cover: "/images/games/backpack.webp", duration: "2 a 4 min",
  },
  {
    id: "contar", title: "Vamos contar", skill: "Números e quantidades", categories: ["Matemática"],
    description: "Conte os objetos, um de cada vez, e escolha a quantidade.",
    instructions: "Conte cada objeto que aparece na tela. Depois, toque no número que representa essa quantidade.",
    cover: "/images/games/orange.webp", duration: "3 a 5 min",
  },
  {
    id: "sequencia", title: "O que vem depois?", skill: "Raciocínio e padrões", categories: ["Memória", "Matemática"],
    description: "Observe o padrão das fotografias e descubra como continuar.",
    instructions: "Observe a sequência de objetos, da esquerda para a direita. Descubra o padrão e toque na foto que vem depois.",
    cover: "/images/games/banana.webp", duration: "3 a 5 min",
  },
  {
    id: "cores", title: "Cores do cotidiano", skill: "Percepção e associação", categories: ["Comunicação"],
    description: "Associe o nome de uma cor a objetos que você conhece.",
    instructions: "Leia ou ouça o nome da cor. Depois, toque no objeto que tem essa cor. O nome da cor também aparece por escrito.",
    cover: "/images/games/ball.webp", duration: "2 a 4 min",
  },
  {
    id: "rotina", title: "Minha rotina em passos", skill: "Autonomia e organização", categories: ["Autonomia"],
    description: "Organize os passos de uma história sobre o dia a dia na escola.",
    instructions: "Leia ou ouça a história. Depois, toque nos três passos na mesma ordem em que aparecem na história. Você pode desfazer e tentar de novo.",
    cover: "/images/games/book.webp", duration: "3 a 5 min",
  },
  {
    id: "letras", title: "Primeira letra", skill: "Letras e consciência da escrita", categories: ["Alfabetização"],
    description: "Descubra a letra que começa o nome de cada objeto.",
    instructions: "Observe a fotografia e diga ou ouça o nome do objeto. Depois, toque na primeira letra desse nome. Você pode pedir uma pista.",
    cover: "/images/games/ball.webp", duration: "2 a 4 min",
  },
  {
    id: "palavras", title: "Imagem e palavra", skill: "Leitura e vocabulário", categories: ["Alfabetização", "Comunicação"],
    description: "Ligue a fotografia de um objeto ao seu nome escrito.",
    instructions: "Observe a fotografia. Leia as palavras e escolha o nome do objeto. Você pode ouvir a instrução e usar uma pista quando quiser.",
    cover: "/images/games/apple.webp", duration: "3 a 5 min",
  },
  {
    id: "somar", title: "Juntar para contar", skill: "Adição com objetos", categories: ["Matemática"],
    description: "Junte dois grupos de fotografias e descubra quantos objetos há ao todo.",
    instructions: "Observe os dois grupos. Conte os objetos do primeiro e do segundo grupo juntos. Depois, toque no número que mostra o total.",
    cover: "/images/games/orange.webp", duration: "3 a 5 min",
  },
  {
    id: "usos", title: "Para que serve?", skill: "Comunicação e autonomia", categories: ["Comunicação", "Autonomia"],
    description: "Escolha um objeto que ajuda em uma situação do cotidiano.",
    instructions: "Leia ou ouça a situação. Depois, toque no objeto que pode ajudar. Observe as fotografias com calma e tente de novo se precisar.",
    cover: "/images/games/backpack.webp", duration: "2 a 4 min",
  },
  {
    id: "classificar", title: "Cada coisa no seu grupo", skill: "Classificação e escolhas", categories: ["Comunicação", "Autonomia"],
    description: "Separe as fotografias de frutas das imagens que não são frutas.",
    instructions: "Escolha uma fotografia. Depois, toque em É fruta ou Não é fruta para colocar a imagem no seu grupo. Você pode observar e tentar outra vez.",
    cover: "/images/games/apple.webp", duration: "3 a 5 min",
  },
  {
    id: "comparar", title: "Compare os grupos", skill: "Comparação de quantidades", categories: ["Matemática"],
    description: "Compare dois grupos de fotografias e descubra onde há mais ou menos objetos.",
    instructions: "Observe os dois grupos. Leia ou ouça se o pedido é encontrar mais ou menos objetos. Conte com calma e toque no grupo correspondente.",
    cover: "/images/games/orange.webp", duration: "3 a 5 min",
  },
  {
    id: "silabas", title: "Monte a palavra", skill: "Sílabas e formação de palavras", categories: ["Alfabetização"],
    description: "Junte as partes do nome de um objeto para formar a palavra.",
    instructions: "Observe a fotografia e diga ou ouça o nome do objeto. Toque nas sílabas, uma por vez, para formar a palavra. Você pode retirar a última parte ou recomeçar a montagem.",
    cover: "/images/games/ball.webp", duration: "3 a 5 min",
  },
  {
    id: "subtrair", title: "Quantos ficaram?", skill: "Subtração com objetos", categories: ["Matemática"],
    description: "Observe os objetos retirados e conte quantos ficaram, incluindo quando não sobra nenhum.",
    instructions: "Leia ou ouça quantos objetos havia e quantos foram retirados. Observe as fotografias e escolha o número de objetos que ficaram. Quando não ficar nenhum, escolha zero.",
    cover: "/images/games/banana.webp", duration: "3 a 5 min",
  },
  {
    id: "numeros", title: "Número que falta", skill: "Sequência numérica", categories: ["Matemática"],
    description: "Observe a sequência de números e encontre o que completa o espaço.",
    instructions: "Leia os números da esquerda para a direita. Descubra como a sequência continua e toque no número que falta. Use uma pista se precisar.",
    cover: "/images/games/book.webp", duration: "3 a 5 min",
  },
];

export type GameChoice = { id: string; label: string; image?: string; objectId?: GameObjectId };
export type ImageChoice = GameChoice & { image: string; objectId: GameObjectId };
export type ComparisonChoice = ImageChoice & { quantity: number };
export type MemoryCard = { id: string; objectId: GameObjectId };
export type MemoryRound = { kind: "memoria"; prompt: string; cards: MemoryCard[]; pairCount: number };
type ChoiceFields = {
  prompt: string;
  options: GameChoice[];
  answerId: string;
  target: GameObject;
};
export type ChoiceRound = ChoiceFields & (
  | { kind: "encontre" | "cores" | "letras" | "palavras" | "usos" }
  | { kind: "contar"; quantity: number }
  | { kind: "somar"; addends: [number, number]; quantity: number }
  | { kind: "sequencia"; sequence: GameObject[] }
  | { kind: "comparar"; comparison: "mais" | "menos"; options: ComparisonChoice[] }
  | { kind: "subtrair"; initialQuantity: number; removedQuantity: number; quantity: number }
  | { kind: "numeros"; sequence: (number | null)[]; missingIndex: number }
);
export type RoutineRound = {
  kind: "rotina";
  prompt: string;
  story: string;
  options: ImageChoice[];
  correctOrder: string[];
};
export type ClassificationGroupId = "frutas" | "outros";
export type ClassificationRound = {
  kind: "classificar";
  prompt: string;
  items: GameObject[];
  groups: [{ id: "frutas"; label: "É fruta" }, { id: "outros"; label: "Não é fruta" }];
  assignments: Record<GameObjectId, ClassificationGroupId>;
};
export type SyllableRound = {
  kind: "silabas";
  prompt: string;
  target: GameObject;
  syllables: string[];
  pieces: { id: string; label: string }[];
};
export type GameRound = MemoryRound | ChoiceRound | RoutineRound | ClassificationRound | SyllableRound;

export function isGameId(value: string): value is GameId {
  return GAME_CATALOG.some((game) => game.id === value);
}

export function objectById(id: GameObjectId): GameObject {
  return GAME_OBJECTS.find((object) => object.id === id)!;
}

/** Fisher–Yates; não altera a lista de origem. O RNG é injetável para testes. */
export function shuffle<T>(items: readonly T[], rng: RandomSource = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function objectChoice(object: GameObject): ImageChoice {
  return { id: object.id, label: object.label, image: object.image, objectId: object.id };
}

function choicesFor(target: GameObject, level: GameLevel, rng: RandomSource, excludeSameColor = false): GameChoice[] {
  const otherObjects = GAME_OBJECTS.filter((object) => object.id !== target.id && (!excludeSameColor || object.colorLabel !== target.colorLabel));
  return shuffle([target, ...shuffle(otherObjects, rng).slice(0, level === 1 ? 2 : 3)], rng).map(objectChoice);
}

/** A letra representa a escrita inicial, sem usar acentos como distratores. */
export function initialLetter(word: string): string {
  return word.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 1).toLocaleUpperCase("pt-BR");
}

const CLASSIFICATION_ASSIGNMENTS: Record<GameObjectId, ClassificationGroupId> = {
  apple: "frutas", banana: "frutas", orange: "frutas",
  ball: "outros", backpack: "outros", book: "outros",
};

const OBJECT_SYLLABLES: Record<GameObjectId, readonly string[]> = {
  apple: ["MA", "ÇÃ"], banana: ["BA", "NA", "NA"], orange: ["LA", "RAN", "JA"],
  ball: ["BO", "LA"], backpack: ["MO", "CHI", "LA"], book: ["LI", "VRO"],
};

export function classificationGroupFor(objectId: GameObjectId): ClassificationGroupId {
  return CLASSIFICATION_ASSIGNMENTS[objectId];
}

export function isCorrectClassification(round: ClassificationRound, objectId: GameObjectId, groupId: ClassificationGroupId): boolean {
  return round.items.some((item) => item.id === objectId)
    && round.groups.some((group) => group.id === groupId)
    && round.assignments[objectId] === groupId;
}

function numberChoices(quantity: number, max: number, level: GameLevel, rng: RandomSource, min = 1): GameChoice[] {
  const numbers = Array.from({ length: max - min + 1 }, (_, index) => index + min);
  const others = shuffle(numbers.filter((number) => number !== quantity), rng).slice(0, level === 1 ? 2 : 3);
  return shuffle([quantity, ...others], rng).map((number) => ({ id: String(number), label: String(number) }));
}

export function generateRound(gameId: GameId, level: GameLevel = 1, rng: RandomSource = Math.random): GameRound {
  const objects = shuffle(GAME_OBJECTS, rng);
  const target = objects[0];
  switch (gameId) {
    case "memoria": {
      const pairCount = level === 1 ? 3 : 6;
      const cards = objects.slice(0, pairCount).flatMap((object) => [
        { id: `${object.id}-1`, objectId: object.id },
        { id: `${object.id}-2`, objectId: object.id },
      ]);
      return { kind: "memoria", prompt: "Encontre as fotografias iguais.", cards: shuffle(cards, rng), pairCount };
    }
    case "encontre":
      return {
        kind: "encontre", prompt: `Onde está ${target.article} ${target.label.toLocaleLowerCase("pt-BR")}?`,
        options: choicesFor(target, level, rng), answerId: target.id, target,
      };
    case "contar": {
      const max = level === 1 ? 5 : 8;
      const quantity = Math.floor(rng() * max) + 1;
      return {
        kind: "contar", prompt: `${target.article === "o" ? "Quantos" : "Quantas"} ${target.plural} você vê?`, target, quantity,
        options: numberChoices(quantity, max, level, rng),
        answerId: String(quantity),
      };
    }
    case "sequencia": {
      const pattern = objects.slice(0, level === 1 ? 2 : 3);
      const sequence = Array.from({ length: level === 1 ? 4 : 5 }, (_, index) => pattern[index % pattern.length]);
      const nextObject = pattern[sequence.length % pattern.length];
      return {
        kind: "sequencia", prompt: "Qual imagem continua a sequência?", sequence,
        target: nextObject, options: choicesFor(nextObject, level, rng), answerId: nextObject.id,
      };
    }
    case "cores":
      return {
        kind: "cores", prompt: `Encontre um objeto desta cor: ${target.colorLabel.toLocaleLowerCase("pt-BR")}.`, target,
        options: choicesFor(target, level, rng, true), answerId: target.id,
      };
    case "letras": {
      const answerId = initialLetter(target.label);
      const alphabet = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
      const otherLetters = shuffle(alphabet.filter((letter) => letter !== answerId), rng).slice(0, level === 1 ? 2 : 3);
      return {
        kind: "letras", prompt: "Qual é a primeira letra do nome desta imagem?", target, answerId,
        options: shuffle([answerId, ...otherLetters], rng).map((letter) => ({ id: letter, label: letter })),
      };
    }
    case "palavras":
      return {
        kind: "palavras", prompt: "Qual palavra combina com esta imagem?", target, answerId: target.id,
        options: choicesFor(target, level, rng).map((choice) => ({ id: choice.id, label: choice.label.toLocaleUpperCase("pt-BR"), objectId: choice.objectId })),
      };
    case "somar": {
      const max = level === 1 ? 5 : 10;
      const first = Math.floor(rng() * (level === 1 ? 3 : 5)) + 1;
      const second = Math.floor(rng() * Math.min(level === 1 ? 3 : 5, max - first)) + 1;
      const quantity = first + second;
      return {
        kind: "somar", prompt: `${target.article === "o" ? "Quantos" : "Quantas"} ${target.plural} há nos dois grupos juntos?`,
        target, addends: [first, second], quantity, answerId: String(quantity),
        options: numberChoices(quantity, max, level, rng),
      };
    }
    case "usos": {
      // Cada situação nomeia uma função específica, evitando frutas como
      // respostas concorrentes a uma pergunta genérica sobre comer ou brincar.
      const prompts = {
        book: level === 1 ? "Qual objeto tem páginas para ler uma história?" : "Você quer ler uma história folheando páginas. Qual objeto pode usar?",
        ball: level === 1 ? "Qual objeto é feito para brincar de chutar e rolar?" : "Na brincadeira, você quer usar um objeto feito para chutar e rolar. Qual destes pode escolher?",
        backpack: level === 1 ? "Qual objeto serve para levar os materiais nas costas?" : "Você quer levar o livro e o lanche nas costas até a escola. Qual objeto pode ajudar?",
      };
      const functionalTarget = objects.find((object) => object.id === "book" || object.id === "ball" || object.id === "backpack")!;
      return {
        kind: "usos", prompt: prompts[functionalTarget.id as keyof typeof prompts], target: functionalTarget,
        answerId: functionalTarget.id, options: choicesFor(functionalTarget, level, rng),
      };
    }
    case "classificar": {
      const fruit = objects.find((object) => classificationGroupFor(object.id) === "frutas")!;
      const other = objects.find((object) => classificationGroupFor(object.id) === "outros")!;
      const extra = objects.find((object) => object.id !== fruit.id && object.id !== other.id)!;
      return {
        kind: "classificar", prompt: "Escolha uma imagem e coloque no grupo correspondente.",
        items: level === 1 ? shuffle([fruit, other, extra], rng) : objects,
        groups: [{ id: "frutas", label: "É fruta" }, { id: "outros", label: "Não é fruta" }],
        assignments: { ...CLASSIFICATION_ASSIGNMENTS },
      };
    }
    case "comparar": {
      const max = level === 1 ? 5 : 8;
      const first = Math.floor(rng() * max) + 1;
      const second = shuffle(Array.from({ length: max }, (_, index) => index + 1).filter((quantity) => quantity !== first), rng)[0];
      const comparison = level === 2 && rng() >= 0.5 ? "menos" : "mais";
      const options: ComparisonChoice[] = [
        { ...objectChoice(target), id: "grupo-1", label: "Primeiro grupo", quantity: first },
        { ...objectChoice(target), id: "grupo-2", label: "Segundo grupo", quantity: second },
      ];
      const answer = comparison === "mais" ? Math.max(first, second) : Math.min(first, second);
      return {
        kind: "comparar", prompt: `Toque no grupo que tem ${comparison} ${target.plural}.`, target, comparison, options,
        answerId: options.find((option) => option.quantity === answer)!.id,
      };
    }
    case "silabas": {
      const syllableTarget = level === 1 ? objects.find((object) => OBJECT_SYLLABLES[object.id].length === 2)! : target;
      const syllables = [...OBJECT_SYLLABLES[syllableTarget.id]];
      return {
        kind: "silabas", prompt: "Junte as sílabas para formar o nome desta imagem.", target: syllableTarget, syllables,
        pieces: shuffle(syllables.map((label, index) => ({ id: `${syllableTarget.id}-${index}`, label })), rng),
      };
    }
    case "subtrair": {
      const max = level === 1 ? 5 : 10;
      const initialQuantity = Math.floor(rng() * (max - 1)) + 2;
      const removedQuantity = Math.floor(rng() * initialQuantity) + 1;
      const quantity = initialQuantity - removedQuantity;
      return {
        kind: "subtrair", prompt: `Havia ${initialQuantity} ${target.plural}. Retiramos ${removedQuantity}. ${target.article === "o" ? "Quantos ficaram?" : "Quantas ficaram?"}`,
        target, initialQuantity, removedQuantity, quantity, answerId: String(quantity),
        options: numberChoices(quantity, max, level, rng, 0),
      };
    }
    case "numeros": {
      const length = level === 1 ? 4 : 5;
      const max = level === 1 ? 5 : 10;
      const step = level === 2 && rng() >= 0.5 ? 2 : 1;
      const first = Math.floor(rng() * (max - (length - 1) * step + 1));
      const missingIndex = Math.floor(rng() * (length - 2)) + 1;
      const quantity = first + missingIndex * step;
      return {
        kind: "numeros", prompt: "Qual número completa a sequência?", target, missingIndex,
        sequence: Array.from({ length }, (_, index) => index === missingIndex ? null : first + index * step),
        answerId: String(quantity), options: numberChoices(quantity, max, level, rng, 0),
      };
    }
    case "rotina": {
      const book = objectById("book");
      const banana = objectById("banana");
      const backpack = objectById("backpack");
      const steps: ImageChoice[] = [
        { id: "livro", label: "Guardar o livro", image: book.image, objectId: book.id },
        { id: "lanche", label: "Guardar o lanche", image: banana.image, objectId: banana.id },
        { id: "mochila", label: "Fechar a mochila", image: backpack.image, objectId: backpack.id },
      ];
      // As duas ordens são possíveis no cotidiano. A história explicita qual
      // delas reconstruir, sem apresentar uma preferência como regra universal.
      const order = level === 2 && rng() >= 0.5 ? [steps[1], steps[0], steps[2]] : steps;
      const first = order[0].id === "livro" ? "o livro" : "o lanche";
      const second = order[1].id === "livro" ? "o livro" : "o lanche";
      return {
        kind: "rotina", prompt: "Toque nos passos na ordem da história.",
        story: `Vamos preparar a mochila. Primeiro, guarde ${first}. Depois, guarde ${second}. Por último, feche a mochila.`,
        options: shuffle(steps, rng), correctOrder: order.map((step) => step.id),
      };
    }
  }
}

export function isCorrectAnswer(round: GameRound, answer: string | readonly string[]): boolean {
  // Classificar usa objeto + grupo, conferidos por isCorrectClassification.
  if (round.kind === "memoria" || round.kind === "classificar") return false;
  if (round.kind === "silabas") {
    return Array.isArray(answer) && answer.length === round.syllables.length
      && new Set(answer).size === answer.length
      && round.syllables.every((syllable, index) => round.pieces.find((piece) => piece.id === answer[index])?.label === syllable);
  }
  if (round.kind === "rotina") {
    return Array.isArray(answer) && answer.length === round.correctOrder.length
      && round.correctOrder.every((id, index) => answer[index] === id);
  }
  return typeof answer === "string" && answer === round.answerId;
}

export function memoryCardsMatch(first: MemoryCard, second: MemoryCard): boolean {
  return first.id !== second.id && first.objectId === second.objectId;
}
