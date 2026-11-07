"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import type { MemoryCard } from "@/lib/games/games-core";
import { GamePictogram } from "./game-pictogram";
import type { GameControls } from "./types";

// Memória: virar duas cartas e achar as iguais. O par certo fica aberto; o par
// errado volta a se virar depois de um instante, sem contar ponto contra.
export function MemoryGame({ deck, controls }: { deck: MemoryCard[]; controls: GameControls }) {
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [hinted, setHinted] = useState<string[]>([]);
  const busy = useRef(false);
  const pairs = deck.length / 2;
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { onInstruction, onHint, registerHint } = controls;

  useEffect(() => {
    onInstruction("Vire duas cartas e encontre as figuras iguais.");
  }, [onInstruction]);

  // Dica: com uma carta aberta, mostra o par dela; sem nenhuma, mostra um par inteiro.
  useEffect(() => {
    registerHint(() => {
      const remaining = deck.filter((card) => !matched.has(card.pic.key));
      if (!remaining.length) return;
      const first = deck.find((card) => card.id === open[0]);
      const key = first && !matched.has(first.pic.key) ? first.pic.key : remaining[0].pic.key;
      setHinted(deck.filter((card) => card.pic.key === key && !open.includes(card.id)).map((card) => card.id));
      onHint();
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setHinted([]), 2000);
    });
  }, [registerHint, deck, matched, open, onHint]);
  useEffect(() => () => {
    registerHint(null);
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, [registerHint]);

  function flip(card: MemoryCard) {
    if (busy.current || open.includes(card.id) || matched.has(card.pic.key)) return;
    const next = [...open, card.id];
    setOpen(next);
    setHinted([]);
    if (next.length < 2) {
      controls.onFeedback(card.pic.label, card.pic.label);
      return;
    }
    const [a, b] = next.map((id) => deck.find((item) => item.id === id)!);
    if (a.pic.key === b.pic.key) {
      const done = new Set(matched).add(a.pic.key);
      setMatched(done);
      setOpen([]);
      controls.onProgress(done.size);
      controls.onFeedback(`Isso! Duas cartas de ${a.pic.label}.`, `Isso! ${a.pic.label}.`);
      if (done.size === pairs) setTimeout(controls.onFinish, 900);
      return;
    }
    busy.current = true;
    controls.onRetry();
    controls.onFeedback(`${b.pic.label}. Não é igual. Tente de novo.`, `${b.pic.label}. Tente de novo.`);
    setTimeout(() => {
      setOpen([]);
      busy.current = false;
    }, 1300);
  }

  const columns = deck.length <= 4 ? "grid-cols-2" : deck.length <= 8 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3 sm:grid-cols-4";
  return (
    <ul className={`mx-auto grid w-full max-w-3xl gap-3 sm:gap-4 ${columns}`} aria-label={`Cartas da memória: ${pairs} pares`}>
      {deck.map((card, index) => {
        const isMatched = matched.has(card.pic.key);
        const faceUp = isMatched || open.includes(card.id);
        const hint = hinted.includes(card.id);
        return (
          <li key={card.id}>
            <button
              type="button"
              onClick={() => flip(card)}
              aria-disabled={isMatched || undefined}
              aria-label={isMatched ? `${card.pic.label}, par encontrado` : faceUp ? card.pic.label : `Carta ${index + 1}, virada para baixo`}
              data-pic={card.pic.key}
              className={`relative block aspect-square w-full rounded-2xl focus-visible:outline-offset-4 ${hint ? "ring-4 ring-amber" : ""}`}
            >
              {/* Verso e frente se alternam com uma troca suave (sem giro 3D: o toque cai sempre no botão). */}
              <span aria-hidden className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl border-2 border-sky-ink/15 bg-sky-soft motion-safe:transition-opacity motion-safe:duration-200 ${faceUp ? "opacity-0" : "opacity-100"}`}>
                <Image src="/images/games/hero.webp" alt="" fill sizes="(max-width: 639px) 45vw, 250px" className="object-cover opacity-20" /><span className="relative font-display text-4xl font-bold text-ink">{index + 1}</span>
              </span>
              <span aria-hidden className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 motion-safe:transition-opacity motion-safe:duration-200 ${faceUp ? "opacity-100" : "opacity-0"} ${isMatched ? "border-green bg-green-soft text-green" : "border-line bg-paper-raised text-sky-ink"}`}>
                <GamePictogram name={card.pic.key} size={240} className="!h-[70%] !w-[70%]" />
                <span className="text-base font-medium text-ink">{card.pic.label}</span>
                {isMatched ? <Check size={22} strokeWidth={3} className="absolute right-2.5 top-2.5" /> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
