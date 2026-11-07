"use client";

import { useRef, useState } from "react";
import { isCorrectAnswer, type SyllableRound } from "@/lib/games";
import styles from "./games.module.css";

export function SyllableBuilder({ round, hint, solved, onAnswer, onEdit }: {
  round: SyllableRound;
  hint: boolean;
  solved: boolean;
  onAnswer: (answer: string[]) => void;
  onEdit: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const choices = useRef<HTMLDivElement>(null);
  const undo = useRef<HTMLButtonElement>(null);

  function focusChoice() {
    requestAnimationFrame(() => choices.current?.querySelector<HTMLButtonElement>("button:enabled")?.focus());
  }

  function choose(id: string) {
    if (solved || chosen.includes(id)) return;
    const next = [...chosen, id];
    setChosen(next);
    onEdit();
    if (next.length === round.syllables.length) {
      onAnswer(next);
      if (!isCorrectAnswer(round, next)) requestAnimationFrame(() => undo.current?.focus());
    } else focusChoice();
  }

  function removeLast() {
    setChosen((current) => current.slice(0, -1));
    onEdit();
    focusChoice();
  }

  function clear() {
    setChosen([]);
    onEdit();
    focusChoice();
  }

  return <div className={styles.syllableBuilder}>
    {hint ? <p className={styles.syllableModel} role="status">Uma pista para montar: <strong>{round.syllables.join(" · ")}</strong></p> : null}
    <ol className={styles.syllableSlots} aria-label="Palavra em construção">
      {round.syllables.map((_, index) => {
        const piece = round.pieces.find((item) => item.id === chosen[index]);
        return <li key={index} aria-label={`Posição ${index + 1}: ${piece?.label ?? "vazia"}`} data-filled={Boolean(piece) || undefined} data-solved={solved || undefined}>{piece?.label ?? "?"}</li>;
      })}
    </ol>
    <div ref={choices} className={styles.syllableChoices} role="group" aria-label="Sílabas para montar a palavra">
      {round.pieces.map((piece, index) => <button key={piece.id} className={styles.syllablePiece} data-syllable-piece={piece.id} data-syllable-label={piece.label} aria-label={`Escolher sílaba ${piece.label}, peça ${index + 1}`} aria-pressed={chosen.includes(piece.id)} disabled={solved || chosen.includes(piece.id)} onClick={() => choose(piece.id)}>{piece.label}</button>)}
    </div>
    {!solved ? <div className={styles.routineActions}>
      <button ref={undo} className={styles.textButton} disabled={!chosen.length} onClick={removeLast}>Retirar última sílaba</button>
      <button className={styles.textButton} disabled={!chosen.length} onClick={clear}>Limpar palavra</button>
    </div> : null}
  </div>;
}
