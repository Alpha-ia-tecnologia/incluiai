"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { ArrowLeft, Flag, Lightbulb, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Character } from "@/components/character";
import { quietButtonCls, secondaryButtonCls } from "@/components/form-styles";
import {
  EMOTION_LABEL, GAMES, LEVEL_LABEL, sessionNote,
  type AssociationMode, type ChoiceRound, type EmotionRound, type GameKey, type GameResult, type Level, type MemoryCard, type Pic,
} from "@/lib/games/games-core";
import { GameRecordForm } from "./game-record-form";
import { GamePictogram } from "./game-pictogram";
import { EmotionFace } from "./emotion-face";
import { MemoryGame } from "./memory-game";
import { SequenceGame } from "./sequence-game";
import { RoundsGame, type RoundView } from "./rounds-game";
import { useSpeech } from "./use-speech";
import type { GameControls } from "./types";

export type GameData =
  | { game: "memoria"; deck: MemoryCard[] }
  | { game: "sequencia"; routine: string; steps: Pic[]; order: number[] }
  | { game: "associacao"; mode: AssociationMode; rounds: ChoiceRound[] }
  | { game: "emocoes"; rounds: EmotionRound[] };

const UNIT: Record<GameKey, [string, string]> = { memoria: ["par", "pares"], sequencia: ["etapa", "etapas"], associacao: ["rodada", "rodadas"], emocoes: ["rodada", "rodadas"] };
const TONE: Record<GameKey, string> = { memoria: "bg-sky-soft text-sky-ink", sequencia: "bg-teal-soft text-teal-ink", associacao: "bg-peach-soft text-peach-ink", emocoes: "bg-rose-soft text-rose-ink" };

function totalOf(data: GameData) {
  return data.game === "memoria" ? data.deck.length / 2 : data.game === "sequencia" ? data.steps.length : data.rounds.length;
}

// Associação e emoções viram rodadas de escolha com o desenho de cada uma.
function roundsOf(data: Extract<GameData, { game: "associacao" | "emocoes" }>): { rounds: RoundView[]; optionsClass: string } {
  if (data.game === "emocoes") {
    return {
      optionsClass: data.rounds[0]?.options.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4",
      rounds: data.rounds.map((round) => ({
        id: round.id,
        answer: round.answer,
        instruction: `${round.text} Como você se sentiria?`,
        prompt: (
          <>
            <span className="flex size-36 items-center justify-center rounded-full bg-rose-soft text-rose-ink"><GamePictogram name={round.icon} size={132} /></span>
            <p className="max-w-xl text-2xl font-medium leading-snug text-ink">{round.text}</p>
            <p className="text-base text-ink-soft">Como você se sentiria?</p>
          </>
        ),
        options: round.options.map((emotion) => ({
          value: emotion,
          label: EMOTION_LABEL[emotion],
          content: <><EmotionFace emotion={emotion} size={112} className="text-rose-ink" /><span className="text-xl font-medium">{EMOTION_LABEL[emotion]}</span></>,
        })),
      })),
    };
  }
  const byWord = data.mode === "palavra";
  return {
    optionsClass: data.rounds[0]?.options.length === 2 ? "grid-cols-2" : data.rounds[0]?.options.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
    rounds: data.rounds.map((round) => ({
      id: round.id,
      answer: round.answer,
      instruction: byWord ? `Qual é o nome desta figura? ${round.options.join(", ")}.` : "Quantos tem? Conte e toque no número.",
      prompt: byWord ? (
        <>
          <span className="flex size-40 items-center justify-center rounded-full bg-peach-soft text-peach-ink"><GamePictogram name={round.pic.key} size={148} /></span>
          <p className="text-base text-ink-soft">Qual é o nome desta figura?</p>
        </>
      ) : (
        <>
          <ul aria-label={`${round.count} ${round.count === 1 ? "figura" : "figuras"}`} className="flex max-w-xl flex-wrap justify-center gap-3 rounded-3xl bg-peach-soft p-5 text-peach-ink">
            {Array.from({ length: round.count }, (_, index) => <li key={index}><GamePictogram name={round.pic.key} size={52} /></li>)}
          </ul>
          <p className="text-base text-ink-soft">Quantos tem?</p>
        </>
      ),
      options: round.options.map((option) => ({
        value: option,
        label: option,
        content: <span className={byWord ? "text-2xl font-medium" : "font-display text-5xl font-bold tabular-nums"}>{option}</span>,
      })),
    })),
  };
}

// Sem estudante escolhido, o jogo funciona igual, mas não há registro no fim.
export function GamePlayer({ data, level, detail, student, replayHref }: {
  data: GameData;
  replayHref: string;
  level: Level;
  detail: string | null;
  student: { id: string; firstName: string } | null;
}) {
  const router = useRouter();
  const { available, speak } = useSpeech();
  const [soundOn, setSoundOn] = useState(true);
  const [instruction, setInstruction] = useState("");
  const [feedback, setFeedback] = useState("");
  const [result, setResult] = useState<GameResult>({ done: 0, total: totalOf(data), hints: 0, retries: 0 });
  const hintHandler = useRef<(() => void) | null>(null);
  const [finished, setFinished] = useState(false);
  const game = data.game;
  const [one, many] = UNIT[game];

  const onFeedback = useCallback((text: string, spoken?: string) => {
    setFeedback(text);
    if (soundOn && spoken) speak(spoken);
  }, [soundOn, speak]);
  const controls: GameControls = {
    registerHint: useCallback((handler: (() => void) | null) => { hintHandler.current = handler; }, []),
    onHint: useCallback(() => setResult((current) => ({ ...current, hints: current.hints + 1 })), []),
    onRetry: useCallback(() => setResult((current) => ({ ...current, retries: current.retries + 1 })), []),
    onProgress: useCallback((done: number) => setResult((current) => ({ ...current, done })), []),
    onFinish: useCallback(() => setFinished(true), []),
    onFeedback,
    onInstruction: useCallback((text: string) => setInstruction(text), []),
  };

  const replay = () => router.push(replayHref);
  const backHref = student ? `/jogos?estudante=${student.id}` : "/jogos";

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-paper-raised/95 px-3 py-2.5 backdrop-blur sm:px-5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2">
          <Link href={backHref} className={`${quietButtonCls} !px-3`}><ArrowLeft size={18} aria-hidden /> Sair</Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-ink sm:text-xl">{GAMES[game].title}</h1>
            <p className="truncate text-sm text-ink-soft">{[LEVEL_LABEL[level], detail, student ? `com ${student.firstName}` : null].filter(Boolean).join(" · ")}</p>
          </div>
          <p className={`rounded-full px-3 py-1.5 text-sm font-medium tabular-nums ${TONE[game]}`} aria-live="polite">
            {result.done} de {result.total} {result.total === 1 ? one : many}
          </p>
          {!finished ? (
            <div className="flex flex-wrap items-center gap-2">
              {available ? (
                <>
                  <button type="button" onClick={() => speak(instruction)} className={secondaryButtonCls}><Volume2 size={18} aria-hidden /> Ouvir</button>
                  <button type="button" onClick={() => setSoundOn(!soundOn)} aria-pressed={soundOn} className={`${quietButtonCls} !px-3`}>
                    {soundOn ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />} {soundOn ? "Voz" : "Sem voz"}
                  </button>
                </>
              ) : null}
              <button type="button" onClick={() => hintHandler.current?.()} className={quietButtonCls}><Lightbulb size={18} aria-hidden /> Dica</button>
              <button type="button" onClick={() => setFinished(true)} className={`${quietButtonCls} !px-3`}><Flag size={18} aria-hidden /> Terminar</button>
            </div>
          ) : null}
        </div>
      </header>

      <main id="conteudo" className="flex flex-1 flex-col px-3 py-6 sm:px-6 sm:py-8">
        {finished ? (
          <GameEnd game={game} level={level} detail={detail} result={result} student={student} backHref={backHref} onReplay={replay} />
        ) : (
          <>
            {/* Nas rodadas, a pergunta já está no cartão: a instrução fica só para o "Ouvir". */}
            {data.game === "memoria" || data.game === "sequencia" ? <p className="mx-auto mb-6 max-w-2xl text-center text-xl font-medium text-ink">{instruction}</p> : null}
            {data.game === "memoria" ? <MemoryGame deck={data.deck} controls={controls} />
              : data.game === "sequencia" ? <SequenceGame routine={data.routine} steps={data.steps} order={data.order} controls={controls} />
                : <RoundsGame {...roundsOf(data)} controls={controls} />}
            <p role="status" aria-live="polite" className="mx-auto mt-6 min-h-8 max-w-2xl text-center text-base text-ink-soft">{feedback}</p>
          </>
        )}
      </main>
    </div>
  );
}

function GameEnd({ game, level, detail, result, student, backHref, onReplay }: {
  game: GameKey; level: Level; detail: string | null; result: GameResult; student: { id: string; firstName: string } | null;
  backHref: string; onReplay: () => void;
}) {
  const complete = result.done >= result.total;
  const [one, many] = UNIT[game];
  const again = (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onReplay} className={secondaryButtonCls}><RotateCcw size={16} aria-hidden /> Jogar de novo</button>
      <Link href={backHref} className={quietButtonCls}>Outro jogo</Link>
    </div>
  );
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <section className="flex flex-col items-center gap-3 text-center">
        <Character variant="learning" className="w-28" />
        <h2 className="font-display text-3xl font-bold text-ink">{complete ? "Você terminou!" : "Jogo encerrado"}</h2>
        <ul aria-label="Resumo para o professor" className="flex flex-wrap justify-center gap-2 text-sm">
          <li className="rounded-full bg-surface-muted px-3 py-1.5 tabular-nums">{result.done} de {result.total} {result.total === 1 ? one : many}</li>
          <li className="rounded-full bg-surface-muted px-3 py-1.5 tabular-nums">{result.hints ? `${result.hints} ${result.hints === 1 ? "dica" : "dicas"}` : "Sem dica"}</li>
          <li className="rounded-full bg-surface-muted px-3 py-1.5 tabular-nums">{result.retries ? `${result.retries} ${result.retries === 1 ? "tentativa a mais" : "tentativas a mais"}` : "Sem tentativa a mais"}</li>
        </ul>
        {student ? null : <div className="mt-2">{again}</div>}
      </section>
      {student ? <GameRecordForm student={student} result={result} note={sessionNote(game, level, detail, result)} actions={again} /> : null}
    </div>
  );
}
