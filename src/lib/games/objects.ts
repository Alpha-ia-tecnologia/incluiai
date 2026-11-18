import { GAME_PHOTOS } from "./game-photos.ts";
import { pairDeck, shuffle, withDistractors, type MemoryCard, type RandomSource } from "./mechanics.ts";
import type { Level, PhotoGameId } from "./registry.ts";

export type GameObjectId = "apple" | "banana" | "orange" | "ball" | "backpack" | "book";

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
  { id: "apple", label: "Maçã", plural: "maçãs", article: "a", image: GAME_PHOTOS.maca, color: "#b93636", colorLabel: "Vermelho" },
  { id: "banana", label: "Banana", plural: "bananas", article: "a", image: GAME_PHOTOS.banana, color: "#e5bd32", colorLabel: "Amarelo" },
  { id: "orange", label: "Laranja", plural: "laranjas", article: "a", image: GAME_PHOTOS.laranja, color: "#df7b21", colorLabel: "Laranja" },
  { id: "ball", label: "Bola", plural: "bolas", article: "a", image: GAME_PHOTOS.bola, color: "#326da7", colorLabel: "Azul" },
  { id: "backpack", label: "Mochila", plural: "mochilas", article: "a", image: GAME_PHOTOS.mochila, color: "#36754e", colorLabel: "Verde" },
  { id: "book", label: "Livro", plural: "livros", article: "o", image: GAME_PHOTOS.livro, color: "#b93636", colorLabel: "Vermelho" },
];

export type GameChoice = { id: string; label: string; image?: string; objectId?: GameObjectId };
export type ImageChoice = GameChoice & { image: string; objectId: GameObjectId };
export type ComparisonChoice = ImageChoice & { quantity: number };
export type MemoryRound = { kind: "pares"; prompt: string; cards: MemoryCard<GameObject>[]; pairCount: number };
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
  | { kind: "padrao"; sequence: GameObject[] }
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

export function objectById(id: GameObjectId): GameObject {
  return GAME_OBJECTS.find((object) => object.id === id)!;
}

function objectChoice(object: GameObject): ImageChoice {
  return { id: object.id, label: object.label, image: object.image, objectId: object.id };
}

const optionCount = (level: Level) => (level === "facil" ? 3 : 4);

function choicesFor(target: GameObject, level: Level, rng: RandomSource, excludeSameColor = false): GameChoice[] {
  const otherObjects = GAME_OBJECTS.filter((object) => object.id !== target.id && (!excludeSameColor || object.colorLabel !== target.colorLabel));
  return withDistractors(target, otherObjects, optionCount(level), rng).map(objectChoice);
}

function initialLetter(word: string): string {
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

function classificationGroupFor(objectId: GameObjectId): ClassificationGroupId {
  return CLASSIFICATION_ASSIGNMENTS[objectId];
}

export function isCorrectClassification(round: ClassificationRound, objectId: GameObjectId, groupId: ClassificationGroupId): boolean {
  return round.items.some((item) => item.id === objectId)
    && round.groups.some((group) => group.id === groupId)
    && round.assignments[objectId] === groupId;
}

function numberChoices(quantity: number, max: number, level: Level, rng: RandomSource, min = 1): GameChoice[] {
  const numbers = Array.from({ length: max - min + 1 }, (_, index) => index + min);
  return withDistractors(quantity, numbers.filter((number) => number !== quantity), optionCount(level), rng).map((number) => ({ id: String(number), label: String(number) }));
}

export function generateRound(gameId: PhotoGameId, level: Level = "facil", rng: RandomSource = Math.random): GameRound {
  const objects = shuffle(GAME_OBJECTS, rng);
  const target = objects[0];
  const easy = level === "facil";
  switch (gameId) {
    case "pares": {
      const pairCount = easy ? 3 : 6;
      return { kind: "pares", prompt: "Encontre as fotografias iguais.", cards: pairDeck(objects.slice(0, pairCount), (object) => object.id, rng), pairCount };
    }
    case "encontre":
      return {
        kind: "encontre", prompt: `Onde está ${target.article} ${target.label.toLocaleLowerCase("pt-BR")}?`,
        options: choicesFor(target, level, rng), answerId: target.id, target,
      };
    case "contar": {
      const max = easy ? 5 : 8;
      const quantity = Math.floor(rng() * max) + 1;
      return {
        kind: "contar", prompt: `${target.article === "o" ? "Quantos" : "Quantas"} ${target.plural} você vê?`, target, quantity,
        options: numberChoices(quantity, max, level, rng),
        answerId: String(quantity),
      };
    }
    case "padrao": {
      const pattern = objects.slice(0, easy ? 2 : 3);
      const sequence = Array.from({ length: easy ? 4 : 5 }, (_, index) => pattern[index % pattern.length]);
      const nextObject = pattern[sequence.length % pattern.length];
      return {
        kind: "padrao", prompt: "Qual imagem continua a sequência?", sequence,
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
      return {
        kind: "letras", prompt: "Qual é a primeira letra do nome desta imagem?", target, answerId,
        options: withDistractors(answerId, alphabet.filter((letter) => letter !== answerId), optionCount(level), rng).map((letter) => ({ id: letter, label: letter })),
      };
    }
    case "palavras":
      return {
        kind: "palavras", prompt: "Qual palavra combina com esta imagem?", target, answerId: target.id,
        options: choicesFor(target, level, rng).map((choice) => ({ id: choice.id, label: choice.label.toLocaleUpperCase("pt-BR"), objectId: choice.objectId })),
      };
    case "somar": {
      const max = easy ? 5 : 10;
      const first = Math.floor(rng() * (easy ? 3 : 5)) + 1;
      const second = Math.floor(rng() * Math.min(easy ? 3 : 5, max - first)) + 1;
      const quantity = first + second;
      return {
        kind: "somar", prompt: `${target.article === "o" ? "Quantos" : "Quantas"} ${target.plural} há nos dois grupos juntos?`,
        target, addends: [first, second], quantity, answerId: String(quantity),
        options: numberChoices(quantity, max, level, rng),
      };
    }
    case "usos": {
      const prompts = {
        book: easy ? "Qual objeto tem páginas para ler uma história?" : "Você quer ler uma história folheando páginas. Qual objeto pode usar?",
        ball: easy ? "Qual objeto é feito para brincar de chutar e rolar?" : "Na brincadeira, você quer usar um objeto feito para chutar e rolar. Qual destes pode escolher?",
        backpack: easy ? "Qual objeto serve para levar os materiais nas costas?" : "Você quer levar o livro e o lanche nas costas até a escola. Qual objeto pode ajudar?",
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
        items: easy ? shuffle([fruit, other, extra], rng) : objects,
        groups: [{ id: "frutas", label: "É fruta" }, { id: "outros", label: "Não é fruta" }],
        assignments: { ...CLASSIFICATION_ASSIGNMENTS },
      };
    }
    case "comparar": {
      const max = easy ? 5 : 8;
      const first = Math.floor(rng() * max) + 1;
      const second = shuffle(Array.from({ length: max }, (_, index) => index + 1).filter((quantity) => quantity !== first), rng)[0];
      const comparison = !easy && rng() >= 0.5 ? "menos" : "mais";
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
      const syllableTarget = easy ? objects.find((object) => OBJECT_SYLLABLES[object.id].length === 2)! : target;
      const syllables = [...OBJECT_SYLLABLES[syllableTarget.id]];
      return {
        kind: "silabas", prompt: "Junte as sílabas para formar o nome desta imagem.", target: syllableTarget, syllables,
        pieces: shuffle(syllables.map((label, index) => ({ id: `${syllableTarget.id}-${index}`, label })), rng),
      };
    }
    case "subtrair": {
      const max = easy ? 5 : 10;
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
      const length = easy ? 4 : 5;
      const max = easy ? 5 : 10;
      const step = !easy && rng() >= 0.5 ? 2 : 1;
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
      const order = !easy && rng() >= 0.5 ? [steps[1], steps[0], steps[2]] : steps;
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
  if (round.kind === "pares" || round.kind === "classificar") return false;
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


export function spokenInstruction(round: GameRound): string {
  const detail = round.kind === "rotina" ? round.story
    : round.kind === "letras" || round.kind === "palavras" || round.kind === "silabas" ? `A imagem mostra ${round.target.article === "a" ? "uma" : "um"} ${round.target.label.toLocaleLowerCase("pt-BR")}.`
      : round.kind === "somar" ? `${round.addends[0]} no primeiro grupo e ${round.addends[1]} no segundo grupo.`
        : round.kind === "comparar" ? `${round.options[0].quantity} no primeiro grupo e ${round.options[1].quantity} no segundo grupo.`
          : round.kind === "numeros" ? `A sequência é: ${round.sequence.map((number) => number === null ? "espaço vazio" : number).join(", ")}.`
            : "";
  return `${round.prompt} ${detail}`;
}
