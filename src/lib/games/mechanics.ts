export type RandomSource = () => number;

export function shuffle<T>(items: readonly T[], rng: RandomSource = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export type MemoryCard<T> = { id: string; key: string; item: T };

export function pairDeck<T>(items: readonly T[], keyOf: (item: T) => string, rng: RandomSource = Math.random): MemoryCard<T>[] {
  return shuffle(items.flatMap((item) => [1, 2].map((copy) => ({ id: `${keyOf(item)}-${copy}`, key: keyOf(item), item }))), rng);
}

export const cardsMatch = <T>(first: MemoryCard<T>, second: MemoryCard<T>) => first.id !== second.id && first.key === second.key;

export function withDistractors<T>(answer: T, others: readonly T[], count: number, rng: RandomSource = Math.random): T[] {
  return shuffle([answer, ...shuffle(others, rng).slice(0, count - 1)], rng);
}
