"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Check, Lightbulb } from "lucide-react";
import type { ClassificationGroupId, ClassificationRound, GameObjectId } from "@/lib/games";
import styles from "./classification-game.module.css";

type ClassificationGameProps = {
  round: ClassificationRound;
  onComplete: () => void;
  onProgress?: (count: number) => void;
  reduceMotion?: boolean;
};

export function ClassificationGame({ round, onComplete, onProgress, reduceMotion = false }: ClassificationGameProps) {
  const [selectedId, setSelectedId] = useState<GameObjectId | null>(null);
  const [placed, setPlaced] = useState<Partial<Record<GameObjectId, ClassificationGroupId>>>({});
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"success" | "hint">("hint");
  const itemButtons = useRef<Partial<Record<GameObjectId, HTMLButtonElement | null>>>({});
  const firstDestination = useRef<HTMLButtonElement>(null);
  const selected = round.items.find((object) => object.id === selectedId);
  const selectedGroup = selected ? round.groups.find((group) => group.id === round.assignments[selected.id]) : null;
  const complete = Object.keys(placed).length === round.items.length;

  function select(id: GameObjectId) {
    if (placed[id] || complete) return;
    setSelectedId(id);
    setHint(false);
    setFeedback("");
    requestAnimationFrame(() => firstDestination.current?.focus());
  }

  function classify(groupId: ClassificationGroupId) {
    if (!selected || placed[selected.id] || complete) return;
    if (round.assignments[selected.id] !== groupId) {
      setFeedbackKind("hint");
      setFeedback("Vamos observar mais uma vez? Essa imagem vai para o outro grupo. Você pode pedir uma pista.");
      return;
    }

    const nextPlaced = { ...placed, [selected.id]: groupId };
    const count = Object.keys(nextPlaced).length;
    const group = round.groups.find((item) => item.id === groupId)!;
    setPlaced(nextPlaced);
    setSelectedId(null);
    setHint(false);
    setFeedbackKind("success");
    setFeedback(`${selected.label} ficou no grupo “${group.label}”.${count === round.items.length ? " Você separou todas as imagens!" : " Escolha outra imagem para continuar."}`);
    onProgress?.(count);

    if (count === round.items.length) {
      onComplete();
      return;
    }
    const next = round.items.find((object) => !nextPlaced[object.id]);
    if (next) requestAnimationFrame(() => itemButtons.current[next.id]?.focus());
  }

  return (
    <div className={styles.board} data-reduce-motion={reduceMotion || undefined}>
      <p className={styles.instructions}>Escolha uma fotografia. Depois, toque no grupo em que ela deve ficar.</p>

      <div className={styles.pictures} role="group" aria-label="Fotografias para separar">
        {round.items.map((object) => {
          const group = round.groups.find((item) => item.id === placed[object.id]);
          return <button
            key={object.id}
            ref={(node) => { itemButtons.current[object.id] = node; }}
            type="button"
            className={styles.picture}
            data-classification-item={object.id}
            data-classified={Boolean(group) || undefined}
            aria-label={group ? `${object.label}, no grupo ${group.label}` : `Selecionar ${object.label}`}
            aria-pressed={selectedId === object.id}
            disabled={Boolean(group) || complete}
            onClick={() => select(object.id)}
          >
            <Image src={object.image} alt="" width={240} height={240} sizes="(max-width: 639px) 40vw, 180px" className={styles.photo} />
            <span className={styles.pictureName}>{object.label}</span>
            <span className={styles.pictureState}>{group ? <><Check size={16} aria-hidden="true" /> No grupo</> : selectedId === object.id ? "Imagem escolhida" : "Escolher"}</span>
          </button>;
        })}
      </div>

      <p className={styles.currentSelection}>
        {selected ? <><strong>{selected.label}</strong>: em qual grupo esta imagem deve ficar?</> : complete ? "Todas as imagens estão nos seus grupos." : "Selecione uma imagem para escolher o grupo."}
      </p>

      <div className={styles.destinations} role="group" aria-label="Escolher grupo">
        {round.groups.map((group, index) => {
          const objects = round.items.filter((object) => placed[object.id] === group.id);
          const isHint = hint && selectedGroup?.id === group.id;
          return <section className={styles.destination} key={group.id} aria-label={`Grupo ${group.label}`}>
            <button
              ref={index === 0 ? firstDestination : undefined}
              type="button"
              className={styles.destinationButton}
              data-classification-group={group.id}
              data-hint={isHint || undefined}
              disabled={!selected || complete}
              aria-label={selected ? `Colocar ${selected.label} no grupo ${group.label}` : `Escolher grupo ${group.label}`}
              aria-describedby={isHint ? "classification-hint" : undefined}
              onClick={() => classify(group.id)}
            >
              <span>{group.label}</span>
              <span className={styles.destinationAction}>{selected ? "Colocar imagem aqui" : complete ? "Grupo organizado" : "Escolha uma imagem primeiro"}</span>
            </button>
            {objects.length ? <ul className={styles.groupPictures} aria-label={`Imagens no grupo ${group.label}`}>
              {objects.map((object) => <li key={object.id}><Image src={object.image} alt="" width={120} height={120} sizes="(max-width: 639px) 64px, 90px" className={styles.photo} /><span>{object.label}</span></li>)}
            </ul> : <p className={styles.emptyGroup}>As imagens deste grupo aparecem aqui.</p>}
          </section>;
        })}
      </div>

      {!complete ? <div className={styles.hintArea}>
        <button type="button" className={styles.hintButton} disabled={!selected} aria-pressed={hint} aria-controls="classification-hint" onClick={() => setHint((current) => !current)}>
          <Lightbulb size={18} aria-hidden="true" />{hint ? "Esconder pista" : "Ver uma pista"}
        </button>
        <p id="classification-hint" className={styles.hint} role="status" hidden={!hint || !selected || !selectedGroup}>{hint && selected && selectedGroup ? <>{selected.label}: grupo “{selectedGroup.label}”. Este grupo corresponde à imagem escolhida.</> : null}</p>
      </div> : null}

      <div className={styles.feedback} role="status" aria-live="polite" aria-atomic="true" data-kind={feedback ? feedbackKind : undefined}>
        {feedback ? <>{feedbackKind === "success" ? <Check size={20} aria-hidden="true" /> : <Lightbulb size={20} aria-hidden="true" />}<p>{feedback}</p></> : <p>Você pode observar com calma e tentar de novo quando precisar.</p>}
      </div>
    </div>
  );
}
