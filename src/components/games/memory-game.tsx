"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { cardsMatch, type MemoryCard } from "@/lib/games/mechanics";
import type { Pic } from "@/lib/games/registry";
import { GamePhoto } from "./game-photo";
import { useHint, type GameControls } from "./game-controls";

export function MemoryGame({ deck, controls }: { deck: MemoryCard<Pic>[]; controls: GameControls }) {
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const busy = useRef(false);
  const pairs = deck.length / 2;
  const { onInstruction } = controls;
  const [hinted, clearHint] = useHint<string[]>(controls, [], () => {
    const remaining = deck.filter((card) => !matched.has(card.key));
    if (!remaining.length) return null;
    const first = deck.find((card) => card.id === open[0]);
    const key = first && !matched.has(first.key) ? first.key : remaining[0].key;
    return deck.filter((card) => card.key === key && !open.includes(card.id)).map((card) => card.id);
  });

  useEffect(() => {
    onInstruction("Vire duas cartas e encontre as figuras iguais.");
  }, [onInstruction]);

  function flip(card: MemoryCard<Pic>) {
    if (busy.current || open.includes(card.id) || matched.has(card.key)) return;
    const next = [...open, card.id];
    setOpen(next);
    clearHint();
    if (next.length < 2) {
      controls.onFeedback(card.item.label, card.item.label);
      return;
    }
    const [a, b] = next.map((id) => deck.find((item) => item.id === id)!);
    if (cardsMatch(a, b)) {
      const done = new Set(matched).add(a.key);
      setMatched(done);
      setOpen([]);
      controls.onProgress(done.size);
      controls.onFeedback(`Isso! Duas cartas de ${a.item.label}.`, `Isso! ${a.item.label}.`);
      if (done.size === pairs) controls.onFinish();
      return;
    }
    busy.current = true;
    controls.onRetry();
    controls.onFeedback(`${b.item.label}. Não é igual. Tente de novo.`, `${b.item.label}. Tente de novo.`);
    setTimeout(() => {
      setOpen([]);
      busy.current = false;
    }, 1300);
  }

  const columns = deck.length <= 4 ? "grid-cols-2" : deck.length <= 8 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3 sm:grid-cols-4";
  return (
    <ul className={`mx-auto grid w-full max-w-3xl gap-3 sm:gap-4 ${columns}`} aria-label={`Cartas da memória: ${pairs} pares`}>
      {deck.map((card, index) => {
        const isMatched = matched.has(card.key);
        const faceUp = isMatched || open.includes(card.id);
        const hint = hinted.includes(card.id);
        return (
          <li key={card.id}>
            <button
              type="button"
              onClick={() => flip(card)}
              aria-disabled={isMatched || undefined}
              aria-label={isMatched ? `${card.item.label}, par encontrado` : faceUp ? card.item.label : `Carta ${index + 1}, virada para baixo`}
              data-pic={card.key}
              className={`relative block aspect-square w-full rounded-2xl focus-visible:outline-offset-4 ${hint ? "ring-4 ring-amber" : ""}`}
            >
              <span aria-hidden className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl border-2 border-sky-ink/15 bg-sky-soft motion-safe:transition-opacity motion-safe:duration-200 ${faceUp ? "opacity-0" : "opacity-100"}`}>
                <Image src="/images/games/hero.webp" alt="" fill sizes="(max-width: 639px) 45vw, 250px" className="object-cover opacity-20" /><span className="relative font-display text-4xl font-bold text-ink">{index + 1}</span>
              </span>
              <span aria-hidden className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 motion-safe:transition-opacity motion-safe:duration-200 ${faceUp ? "opacity-100" : "opacity-0"} ${isMatched ? "border-green bg-green-soft text-green" : "border-line bg-paper-raised text-sky-ink"}`}>
                <GamePhoto name={card.key} size={240} className="!h-[70%] !w-[70%]" />
                <span className="text-base font-medium text-ink">{card.item.label}</span>
                {isMatched ? <Check size={22} strokeWidth={3} className="absolute right-2.5 top-2.5" /> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
