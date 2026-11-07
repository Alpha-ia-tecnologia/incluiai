"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { Pic } from "@/lib/games/games-core";
import { GamePictogram } from "./game-pictogram";
import type { GameControls } from "./types";

// Sequência da rotina: tocar nas etapas na ordem. A etapa certa sobe para o
// seu lugar; a errada fica onde está e o jogo pede a que vem agora.
export function SequenceGame({ routine, steps, order, controls }: { routine: string; steps: Pic[]; order: number[]; controls: GameControls }) {
  const [placed, setPlaced] = useState(0);
  const [tried, setTried] = useState<number | null>(null);
  const [hinted, setHinted] = useState<number | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { onInstruction, onHint, registerHint } = controls;

  useEffect(() => {
    onInstruction(placed === 0 ? `${routine}. O que vem primeiro?` : placed < steps.length ? `${routine}. O que vem depois de ${steps[placed - 1].label.toLowerCase()}?` : `${routine}. Pronto!`);
  }, [onInstruction, placed, routine, steps]);

  // Dica: destaca a etapa que vem agora.
  useEffect(() => {
    registerHint(() => {
      if (placed >= steps.length) return;
      setHinted(placed);
      onHint();
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setHinted(null), 2000);
    });
  }, [registerHint, placed, steps.length, onHint]);
  useEffect(() => () => {
    registerHint(null);
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, [registerHint]);

  function choose(index: number) {
    if (index < placed) return;
    if (index === placed) {
      const next = placed + 1;
      setPlaced(next);
      setTried(null);
      setHinted(null);
      controls.onProgress(next);
      controls.onFeedback(`Isso! ${steps[index].label}.`, `Isso! ${steps[index].label}.`);
      if (next === steps.length) setTimeout(controls.onFinish, 900);
      return;
    }
    setTried(index);
    controls.onRetry();
    controls.onFeedback(`${steps[index].label} vem depois. O que vem agora?`, "Ainda não. O que vem agora?");
  }

  // Mesma grade para os lugares e para as etapas: uma coluna por etapa no tablet.
  const columns = steps.length <= 3 ? "grid-cols-3" : steps.length === 4 ? "grid-cols-2 sm:grid-cols-4" : steps.length === 5 ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3 sm:grid-cols-6";
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8">
      <ol aria-label={`Ordem da rotina: ${routine}`} className={`grid gap-3 ${columns}`}>
        {steps.map((step, index) => (
          <li key={step.key} className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center ${index < placed ? "border-green bg-green-soft text-green" : "border-dashed border-line bg-paper text-ink-soft"}`}>
            <span className="text-sm font-medium">{index + 1}º</span>
            {index < placed ? (
              <>
                <GamePictogram name={step.key} size={96} />
                <span className="flex items-center gap-1 text-base font-medium text-ink"><Check size={16} strokeWidth={3} className="text-green" aria-hidden /> {step.label}</span>
              </>
            ) : <span className="sr-only">vazio</span>}
          </li>
        ))}
      </ol>
      <ul aria-label="Etapas para colocar em ordem" className={`grid gap-3 ${columns}`}>
        {order.filter((index) => index >= placed).map((index) => (
          <li key={steps[index].key}>
            <button
              type="button"
              onClick={() => choose(index)}
              data-step={index}
              className={`flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 bg-paper-raised p-3 text-teal-ink transition-colors hover:bg-teal-soft ${hinted === index ? "border-amber ring-4 ring-amber" : tried === index ? "border-amber" : "border-line"}`}
            >
              <GamePictogram name={steps[index].key} size={128} />
              <span className="text-base font-medium text-ink">{steps[index].label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
