"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Volume2 } from "lucide-react";
import { GAME_OBJECTS, objectById, type GameObjectId } from "@/lib/games";
import styles from "./communication-board.module.css";

const INTENTIONS = [
  { id: "quero", label: "Eu quero" },
  { id: "vejo", label: "Eu vejo" },
  { id: "gosto", label: "Eu gosto de" },
] as const;

type Intention = (typeof INTENTIONS)[number]["id"];

export function CommunicationBoard({ onClose }: { onClose: () => void }) {
  const [intention, setIntention] = useState<Intention>("quero");
  const [selectedId, setSelectedId] = useState<GameObjectId | null>(null);
  const [audioMessage, setAudioMessage] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const pictureTitle = useRef<HTMLHeadingElement>(null);
  const activeSpeech = useRef<SpeechSynthesisUtterance | null>(null);
  const selected = selectedId ? objectById(selectedId) : null;
  const prefix = INTENTIONS.find((item) => item.id === intention)!.label;
  const phrase = selected
    ? intention === "gosto"
      ? `Eu gosto ${selected.article === "a" ? "da" : "do"} ${selected.label.toLocaleLowerCase("pt-BR")}`
      : `${prefix} ${selected.article === "a" ? "uma" : "um"} ${selected.label.toLocaleLowerCase("pt-BR")}`
    : `${prefix}…`;

  function cancelSpeech() {
    if (activeSpeech.current) {
      activeSpeech.current.onerror = null;
      activeSpeech.current.onend = null;
      activeSpeech.current = null;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    }
  }

  useEffect(() => {
    title.current?.focus();
    return () => {
      if (activeSpeech.current) {
        activeSpeech.current.onerror = null;
        activeSpeech.current.onend = null;
        activeSpeech.current = null;
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      }
    };
  }, []);

  function changeIntention(next: Intention) {
    cancelSpeech();
    setAudioMessage("");
    setIntention(next);
  }

  function choose(id: GameObjectId) {
    cancelSpeech();
    setAudioMessage("");
    setSelectedId(id);
  }

  function clear() {
    cancelSpeech();
    setAudioMessage("");
    setSelectedId(null);
    requestAnimationFrame(() => pictureTitle.current?.focus());
  }

  function speak() {
    if (!selected) return;
    cancelSpeech();
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setAudioMessage("O áudio não está disponível neste navegador. Sua frase continua escrita na tela.");
      return;
    }
    const speech = new SpeechSynthesisUtterance(phrase);
    speech.lang = "pt-BR";
    speech.rate = 0.85;
    speech.onerror = (event) => {
      if (event.error !== "interrupted" && event.error !== "canceled") {
        setAudioMessage("Não foi possível ouvir a frase. Você pode mostrar as imagens ou ler a frase com alguém.");
      }
    };
    speech.onend = () => {
      if (activeSpeech.current === speech) activeSpeech.current = null;
    };
    activeSpeech.current = speech;
    setAudioMessage("");
    window.speechSynthesis.speak(speech);
  }

  return (
    <section className={styles.board} aria-label="Prancha de comunicação">
      <button type="button" className={styles.backButton} onClick={() => { cancelSpeech(); onClose(); }}>
        <ArrowLeft size={18} aria-hidden="true" /> Voltar aos jogos
      </button>
      <header className={styles.header}>
        <h1 ref={title} tabIndex={-1}>Eu escolho, eu comunico</h1>
        <p>Explore preferências com imagens. As escolhas são livres e podem ser acompanhadas por uma pessoa de apoio.</p>
      </header>

      <div className={styles.intentionArea}>
        <h2 id="communication-intention-title">Como você quer começar?</h2>
        <div className={styles.intentions} role="group" aria-label="Começo da frase">
          {INTENTIONS.map((item) => (
            <button type="button" key={item.id} className={styles.intention} aria-pressed={intention === item.id} onClick={() => changeIntention(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className={styles.phraseArea} aria-labelledby="communication-phrase-title">
        <div className={styles.phraseCopy}>
          <h2 id="communication-phrase-title">Minha frase</h2>
          <p id="communication-phrase" className={styles.phrase} role="status" aria-live="polite" aria-atomic="true">{phrase}</p>
          {!selected ? <p className={styles.prompt}>Escolha uma imagem abaixo para completar a frase.</p> : null}
        </div>
        {selected ? <Image className={styles.selectedPhoto} src={selected.image} alt="" width={160} height={160} sizes="160px" /> : null}
        <div className={styles.phraseActions}>
          <button type="button" className={styles.speakButton} onClick={speak} disabled={!selected} aria-describedby={audioMessage ? "communication-audio-message" : undefined}>
            <Volume2 size={19} aria-hidden="true" /> Ouvir minha frase
          </button>
          <button type="button" className={styles.clearButton} disabled={!selected} onClick={clear}>
            <RotateCcw size={17} aria-hidden="true" /> Limpar escolha
          </button>
        </div>
        {audioMessage ? <p id="communication-audio-message" className={styles.audioMessage} role="status">{audioMessage}</p> : null}
      </section>

      <section className={styles.pictureArea} aria-labelledby="communication-objects-title">
        <h2 id="communication-objects-title" ref={pictureTitle} tabIndex={-1}>O que você quer comunicar?</h2>
        <p>Toque em uma imagem. Você pode mudar de ideia e escolher outra.</p>
        <div className={styles.pictures} role="group" aria-label="Imagens para completar a frase">
          {GAME_OBJECTS.map((object) => (
            <button type="button" key={object.id} className={styles.picture} aria-label={`Escolher ${object.label}`} aria-pressed={object.id === selectedId} onClick={() => choose(object.id)}>
              <Image src={object.image} alt="" width={320} height={320} sizes="(max-width: 639px) 40vw, 230px" className={styles.objectPhoto} />
              <span>{object.label}</span>
              <span className={styles.selectionMark} aria-hidden="true">{object.id === selectedId ? "Escolhido" : "Escolher"}</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
