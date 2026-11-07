"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import type { GameControls } from "./types";

// Rodadas de escolha (associação e emoções): uma pergunta, opções grandes.
// A opção errada fica apagada e o estudante tenta outra; a certa passa para a
// rodada seguinte depois de um instante.
export type RoundView = {
  id: string;
  instruction: string;
  prompt: ReactNode;
  answer: string;
  options: { value: string; label: string; content: ReactNode }[];
};

export function RoundsGame({ rounds, controls, optionsClass }: { rounds: RoundView[]; controls: GameControls; optionsClass: string }) {
  const [index, setIndex] = useState(0);
  const [tried, setTried] = useState<string[]>([]);
  const [right, setRight] = useState(false);
  const [hinted, setHinted] = useState(false);
  const round = rounds[index];
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { onInstruction, onHint, registerHint } = controls;

  useEffect(() => {
    if (round) onInstruction(round.instruction);
  }, [onInstruction, round]);

  // Dica: destaca a resposta da rodada.
  useEffect(() => {
    registerHint(() => {
      if (right) return;
      setHinted(true);
      onHint();
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setHinted(false), 2000);
    });
  }, [registerHint, right, onHint]);
  useEffect(() => () => {
    registerHint(null);
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, [registerHint]);

  if (!round) return null;

  function choose(option: RoundView["options"][number]) {
    if (right || tried.includes(option.value)) return;
    if (option.value === round.answer) {
      setRight(true);
      setHinted(false);
      controls.onProgress(index + 1);
      controls.onFeedback(`Isso! ${option.label}.`, `Isso! ${option.label}.`);
      setTimeout(() => {
        if (index + 1 >= rounds.length) controls.onFinish();
        else {
          setIndex(index + 1);
          setTried([]);
          setRight(false);
        }
      }, 1000);
      return;
    }
    setTried([...tried, option.value]);
    controls.onRetry();
    controls.onFeedback(`${option.label}: não é essa. Tente outra.`, "Tente outra.");
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl justify-items-center gap-8" key={round.id}>
      <div className="grid justify-items-center gap-4 text-center">{round.prompt}</div>
      <ul aria-label="Opções" className={`grid w-full gap-3 ${optionsClass}`}>
        {round.options.map((option) => {
          const isRight = right && option.value === round.answer;
          const isTried = tried.includes(option.value);
          const isHint = hinted && option.value === round.answer;
          return (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => choose(option)}
                aria-disabled={isTried || right || undefined}
                data-answer={option.value === round.answer ? "sim" : undefined}
                className={`relative flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 text-ink transition-colors ${isRight ? "border-green bg-green-soft" : isTried ? "border-line bg-paper opacity-50" : isHint ? "border-amber bg-paper-raised ring-4 ring-amber" : "border-line bg-paper-raised hover:bg-peach-soft"}`}
              >
                {option.content}
                {isRight ? <Check size={24} strokeWidth={3} aria-hidden className="absolute right-3 top-3 text-green" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
