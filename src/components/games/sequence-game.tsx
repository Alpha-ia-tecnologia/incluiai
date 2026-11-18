"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { Pic } from "@/lib/games/registry";
import { GamePhoto } from "./game-photo";
import { useHint, type GameControls } from "./game-controls";

export function SequenceGame({ routine, steps, order, controls }: { routine: string; steps: Pic[]; order: number[]; controls: GameControls }) {
  const [placed, setPlaced] = useState(0);
  const [tried, setTried] = useState<number | null>(null);
  const { onInstruction } = controls;
  const [hinted, clearHint] = useHint<number | null>(controls, null, () => (placed < steps.length ? placed : null));

  useEffect(() => {
    onInstruction(placed === 0 ? `${routine}. O que vem primeiro?` : placed < steps.length ? `${routine}. O que vem depois de ${steps[placed - 1].label.toLowerCase()}?` : `${routine}. Pronto!`);
  }, [onInstruction, placed, routine, steps]);

  function choose(index: number) {
    if (index < placed) return;
    if (index === placed) {
      const next = placed + 1;
      setPlaced(next);
      setTried(null);
      clearHint();
      controls.onProgress(next);
      controls.onFeedback(`Isso! ${steps[index].label}.`, `Isso! ${steps[index].label}.`);
      if (next === steps.length) controls.onFinish();
      return;
    }
    setTried(index);
    controls.onRetry();
    controls.onFeedback(`${steps[index].label} vem depois. O que vem agora?`, "Ainda não. O que vem agora?");
  }

  const columns = steps.length <= 3 ? "grid-cols-3" : steps.length === 4 ? "grid-cols-2 sm:grid-cols-4" : steps.length === 5 ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3 sm:grid-cols-6";
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8">
      <ol aria-label={`Ordem da rotina: ${routine}`} className={`grid gap-3 ${columns}`}>
        {steps.map((step, index) => (
          <li key={step.key} className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center ${index < placed ? "border-green bg-green-soft text-green" : "border-dashed border-line bg-paper text-ink-soft"}`}>
            <span className="text-sm font-medium">{index + 1}º</span>
            {index < placed ? (
              <>
                <GamePhoto name={step.key} size={96} />
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
              <GamePhoto name={steps[index].key} size={128} />
              <span className="text-base font-medium text-ink">{steps[index].label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
