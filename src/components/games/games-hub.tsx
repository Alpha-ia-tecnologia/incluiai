"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, ClipboardCheck, Hourglass, Lightbulb, RotateCcw, ShieldCheck, Volume2 } from "lucide-react";
import { GAME_CATALOG, GAME_CATEGORIES, generateRound, isCorrectAnswer, objectById, type GameCategory, type GameId, type GameObjectId, type GameRound } from "@/lib/games";
import {
  GAMES, LEVELS, LEVEL_LABEL, ROUTINES, ROUTINE_KEYS, THEMES, THEME_KEYS, gameNote, photoLevel, themePics,
  type GameKey, type GameResult, type Level, type ThemeKey,
} from "@/lib/games/games-core";
import { GAME_PHOTOS } from "@/lib/games/game-photos";
import { Assurances } from "@/components/explain";
import { inputCls, labelCls } from "@/components/form-styles";
import { GameRecordForm } from "./game-record-form";
import { CommunicationBoard } from "./communication-board";
import { ClassificationGame } from "./classification-game";
import { SyllableBuilder } from "./syllable-builder";
import styles from "./games.module.css";

type CatalogGame = (typeof GAME_CATALOG)[number];
type Session = { game: CatalogGame; round: GameRound; level: Level; key: number };

// Estudante com quem o professor joga: o nível e o tema vêm do "Como aprende".
export type HubStudent = { id: string; name: string; firstName: string; detail: string; level: Level; theme: ThemeKey };

// Todos os jogos numa só lista. Os de fotografias (src/lib/games.ts) abrem aqui
// mesmo; os de tela cheia (/jogar), com tema e rotina, abrem em outra tela.
type GuidedInfo = { categories: GameCategory[]; description: string };
const GUIDED: Record<GameKey, GuidedInfo> = {
  memoria: { categories: ["Memória"], description: "Pares de fotografias no tema de que o estudante mais gosta." },
  sequencia: { categories: ["Autonomia"], description: "Lavar as mãos, chegar na sala, lanche: ponha os passos em ordem." },
  associacao: { categories: ["Alfabetização", "Matemática"], description: "Ligue a figura à palavra ou a quantidade ao número." },
  emocoes: { categories: ["Comunicação"], description: "Como você se sentiria? Escolha a emoção de cada situação." },
};
type Entry = { kind: "foto"; game: CatalogGame } | ({ kind: "tela-cheia"; key: GameKey } & GuidedInfo);
// Cada jogo de tela cheia entra ao lado do jogo de fotografias mais parecido.
const NEXT_TO: Partial<Record<GameId, GameKey>> = { memoria: "memoria", rotina: "sequencia", palavras: "associacao", usos: "emocoes" };
const LIBRARY: Entry[] = GAME_CATALOG.flatMap((game): Entry[] => {
  const guided = NEXT_TO[game.id];
  return guided ? [{ kind: "foto", game }, { kind: "tela-cheia", key: guided, ...GUIDED[guided] }] : [{ kind: "foto", game }];
});
const categoriesOf = (entry: Entry) => (entry.kind === "foto" ? entry.game.categories : entry.categories);

const HINT_TEXT: Partial<Record<GameId, string>> = {
  memoria: "Observe onde estão os pares. Esconda a pista quando quiser tentar.",
  rotina: "Siga as palavras “primeiro”, “depois” e “por último” na história acima.",
  contar: "Conte uma imagem por vez. Os números ajudam a acompanhar.",
  somar: "Continue contando do primeiro para o segundo grupo. Os números junto às imagens ajudam a acompanhar.",
  letras: "Observe a primeira letra do nome da imagem. Uma das opções tem uma pista.",
  silabas: "Use a palavra de apoio e organize as partes da esquerda para a direita.",
  subtrair: "As imagens marcadas como Retirado já saíram. Conte somente as outras.",
  comparar: "Conte as imagens de cada grupo. Confira se a pergunta pede mais ou menos objetos.",
  numeros: "Observe quanto o número aumenta de uma posição para a próxima.",
};

const PREVIEWS: Record<GameId, GameObjectId[]> = {
  memoria: ["apple", "ball", "apple", "ball"],
  encontre: ["banana", "orange", "book"],
  contar: ["apple", "apple", "apple"],
  sequencia: ["banana", "apple", "banana", "apple"],
  cores: ["ball", "backpack", "orange"],
  rotina: ["book", "banana", "backpack"],
  letras: ["apple"],
  palavras: ["ball"],
  somar: ["apple", "apple", "apple"],
  usos: ["book", "ball", "backpack"],
  classificar: ["apple", "orange", "book"],
  comparar: ["apple", "apple", "apple"],
  silabas: ["ball"],
  subtrair: ["orange", "orange", "orange"],
  numeros: ["apple"],
};

function ObjectPhoto({ id }: { id: GameObjectId }) {
  const object = objectById(id);
  return <Image src={object.image} alt={object.label} width={400} height={400} sizes="(max-width: 640px) 140px, 200px" className={styles.objectPhoto} />;
}

function GamePreview({ id }: { id: GameId }) {
  return <div className={`${styles.preview} ${styles[`preview_${id}`] ?? ""}`} aria-hidden="true">
    {PREVIEWS[id].map((objectId, index) => <div className={styles.previewPhoto} key={`${objectId}-${index}`}>{id === "somar" && index === 1 ? <span className={styles.previewPlus}>+</span> : null}<ObjectPhoto id={objectId} /></div>)}
    {id === "contar" ? <span className={styles.previewNumber}>3</span> : null}
    {id === "sequencia" ? <span className={styles.previewQuestion}>?</span> : null}
    {id === "letras" ? <span className={styles.previewLetter}>M</span> : null}
    {id === "palavras" ? <span className={styles.previewWord}>BOLA</span> : null}
    {id === "silabas" ? <span className={styles.previewWord}>BO · LA</span> : null}
    {id === "numeros" ? <span className={styles.previewSequence}>1 &nbsp; ? &nbsp; 3</span> : null}
  </div>;
}

function GuidedPreview({ game, theme }: { game: GameKey; theme: ThemeKey }) {
  const [first, second] = themePics(theme);
  const keys = game === "memoria" ? [first.key, second.key, second.key, first.key]
    : game === "sequencia" ? ["torneira", "sabonete", "secar"]
      : game === "associacao" ? [first.key]
        : ["emocao-feliz", "emocao-triste", "emocao-medo"];
  const look = game === "memoria" ? styles.preview_memoria : game === "sequencia" ? styles.preview_rotina : game === "associacao" ? styles.preview_palavras : "";
  return <div className={`${styles.preview} ${look ?? ""}`} aria-hidden="true">
    {keys.map((key, index) => <div className={styles.previewPhoto} key={`${key}-${index}`}><Image src={GAME_PHOTOS[key]} alt="" width={400} height={400} sizes="(max-width: 640px) 140px, 200px" className={styles.objectPhoto} /></div>)}
    {game === "associacao" ? <span className={styles.previewWord}>{first.label.toLocaleUpperCase("pt-BR")}</span> : null}
  </div>;
}

// Jogo de tela cheia: um formulário GET que abre /jogar com o estudante, o
// nível e o tema ou a rotina escolhidos (funciona mesmo sem JavaScript).
function GuidedCard({ entry, student, level }: { entry: Extract<Entry, { kind: "tela-cheia" }>; student: HubStudent | null; level: Level }) {
  const { key } = entry;
  const theme = student?.theme ?? "animais";
  return <article className={styles.gameCard}>
    <GuidedPreview game={key} theme={theme} />
    <form action={`/jogar/${key}`} method="get" className={styles.gameCardCopy}>
      <h3>{GAMES[key].title}</h3><span className={styles.skill}>{GAMES[key].skill}</span><p>{entry.description}</p>
      {student ? <input type="hidden" name="estudante" value={student.id} /> : null}
      <input type="hidden" name="nivel" value={level} />
      {key === "memoria" || key === "associacao" ? <div className={styles.cardOption}>
        <label htmlFor={`tema-${key}`} className={labelCls}>Tema</label>
        <select id={`tema-${key}`} name="tema" defaultValue={theme} className={inputCls}>{THEME_KEYS.map((item) => <option key={item} value={item}>{THEMES[item].label}</option>)}</select>
      </div> : null}
      {key === "associacao" ? <div className={styles.cardOption}>
        <label htmlFor="modo-associacao" className={labelCls}>Associar</label>
        <select id="modo-associacao" name="modo" defaultValue="palavra" className={inputCls}><option value="palavra">Figura e palavra</option><option value="quantidade">Quantidade e número</option></select>
      </div> : null}
      {key === "sequencia" ? <div className={styles.cardOption}>
        <label htmlFor="rotina-sequencia" className={labelCls}>Rotina</label>
        <select id="rotina-sequencia" name="rotina" defaultValue="maos" className={inputCls}>{ROUTINE_KEYS.map((item) => <option key={item} value={item}>{ROUTINES[item].label}</option>)}</select>
      </div> : null}
      <button type="submit" id={`play-tela-cheia-${key}`} className={styles.playButton} aria-label={`Jogar ${GAMES[key].title}`}>Vamos jogar <ChevronRight size={18} aria-hidden="true" /></button>
    </form>
  </article>;
}

export function GamesHub({ students, initialStudentId }: { students: HubStudent[]; initialStudentId: string | null }) {
  const initial = students.find((item) => item.id === initialStudentId) ?? null;
  const [studentId, setStudentId] = useState(initial?.id ?? "");
  const [level, setLevel] = useState<Level>(initial?.level ?? "facil");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [filter, setFilter] = useState<(typeof GAME_CATEGORIES)[number]>("Todos");
  const heading = useRef<HTMLHeadingElement>(null);
  const student = students.find((item) => item.id === studentId) ?? null;

  useEffect(() => {
    if (session) heading.current?.focus();
  }, [session]);

  // Trocar o estudante traz o nível sugerido para ele e fica no endereço,
  // para o "Sair" dos jogos de tela cheia voltar com a mesma escolha.
  function chooseStudent(id: string) {
    setStudentId(id);
    const next = students.find((item) => item.id === id);
    if (next) setLevel(next.level);
    window.history.replaceState(null, "", id ? `/jogos?${new URLSearchParams({ estudante: id }).toString()}` : "/jogos");
  }

  function start(game: CatalogGame) {
    setSession({ game, round: generateRound(game.id, photoLevel(level)), level, key: Date.now() });
  }

  function leave() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const gameId = session?.game.id;
    setSession(null);
    requestAnimationFrame(() => (document.getElementById(`play-${gameId}`) ?? document.getElementById("game-library-title"))?.focus());
  }

  function closeCommunication() {
    setCommunicationOpen(false);
    requestAnimationFrame(() => document.getElementById("open-communication")?.focus());
  }

  const entries = filter === "Todos" ? LIBRARY : LIBRARY.filter((entry) => categoriesOf(entry).includes(filter));

  return <div className={styles.hub} data-reduce-motion={reduceMotion || undefined}>
    {communicationOpen ? <CommunicationBoard onClose={closeCommunication} /> : session ? <>
      <div className={styles.sessionNav}>
        <button className={styles.textButton} onClick={leave}><ArrowLeft size={18} aria-hidden="true" /> Escolher outro jogo</button>
        <span className={styles.levelLabel}>{[LEVEL_LABEL[session.level], student ? `com ${student.firstName}` : null].filter(Boolean).join(" · ")}</span>
      </div>
      <h1 className={styles.sessionTitle} ref={heading} tabIndex={-1}>{session.game.title}</h1>
      <p className={styles.sessionDescription}>{session.game.instructions}</p>
      <GameSession key={session.key} game={session.game} initialRound={session.round} level={session.level} student={student} onLeave={leave} />
    </> : <>
      <header className={styles.pageHeader}>
        <h1>Jogos educativos</h1>
        <p>Para jogar com o estudante no tablet ou no computador, durante a aula.</p>
        <Assurances
          label="Como os jogos funcionam"
          className="mt-4"
          items={[
            { icon: Hourglass, text: "Sem tempo limite" },
            { icon: Volume2, text: "Instrução falada" },
            { icon: ShieldCheck, text: "Errar não tira ponto" },
            { icon: ClipboardCheck, text: "Você decide se registra" },
          ]}
        />
      </header>

      <section className={styles.preferences} aria-label="Ajustar os jogos">
        {students.length ? <div className={styles.studentOption}>
          <label htmlFor="jogo-estudante" className={labelCls}>Com quem vamos jogar?</label>
          <select id="jogo-estudante" value={studentId} onChange={(event) => chooseStudent(event.target.value)} className={inputCls}>
            <option value="">Sem estudante (sem registro)</option>
            {students.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.detail}</option>)}
          </select>
        </div> : null}
        <fieldset className={styles.levelOptions}>
          <legend>Nível</legend>
          <div className={styles.segmented}>
            {LEVELS.map((item) => <label key={item}><input type="radio" name="game-level" value={item} checked={level === item} onChange={() => setLevel(item)} /><span>{LEVEL_LABEL[item]}</span></label>)}
          </div>
          {student ? <p>Sugerido para {student.firstName}: {LEVEL_LABEL[student.level]}</p> : null}
        </fieldset>
        <label className={styles.motionOption}><input type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} /> Reduzir movimento</label>
      </section>

      <section className={styles.featured} aria-labelledby="featured-title">
        <div className={styles.featuredImage}><Image src="/images/games/hero.webp" alt="Cartões com fotografias de objetos, uma bola azul, um livro vermelho e uma mochila verde sobre uma mesa." width={1400} height={788} sizes="(max-width: 639px) 100vw, 50vw" preload /></div>
        <div className={styles.featuredCopy}>
          <h2 id="featured-title">Olhar, lembrar, <br />encontrar.</h2>
          <p>Uma maçã aqui, outra ali. Descubra os pares de fotografias no jogo da memória.</p>
          <button className={styles.primaryButton} onClick={() => start(GAME_CATALOG.find((game) => game.id === "memoria")!)}>Jogar memória <ArrowRight size={18} aria-hidden="true" /></button>
        </div>
      </section>

      <section aria-labelledby="game-library-title" className={styles.library}>
        <div className={styles.libraryHeading}><h2 id="game-library-title" tabIndex={-1}>O que vamos descobrir hoje?</h2><span>{entries.length} {entries.length === 1 ? "jogo" : "jogos"}</span></div>
        <div className={styles.filters} role="group" aria-label="Filtrar jogos por habilidade">{GAME_CATEGORIES.map((category) => <button key={category} className={styles.filter} aria-pressed={category === filter} onClick={() => setFilter(category)}>{category}</button>)}</div>
        <div className={styles.gameGrid}>
          {entries.map((entry) => entry.kind === "tela-cheia"
            ? <GuidedCard key={`${entry.key}-${studentId}`} entry={entry} student={student} level={level} />
            : <article className={styles.gameCard} key={entry.game.id}>
              <GamePreview id={entry.game.id} />
              <div className={styles.gameCardCopy}><h3>{entry.game.title}</h3><span className={styles.skill}>{entry.game.skill}</span><p>{entry.game.description}</p><button id={`play-${entry.game.id}`} className={styles.playButton} onClick={() => start(entry.game)} aria-label={`Jogar ${entry.game.title}`}>Vamos jogar <ChevronRight size={18} aria-hidden="true" /></button></div>
            </article>)}
        </div>
      </section>

      <section className={styles.communicationInvite} aria-labelledby="communication-invite-title">
        <div className={styles.communicationPhotos} aria-hidden="true"><ObjectPhoto id="apple" /><ObjectPhoto id="ball" /></div>
        <div className={styles.communicationCopy}><h2 id="communication-invite-title">Uma imagem também pode dizer o que você quer.</h2><p>Monte frases com fotografias para expressar escolhas, observações e preferências. Aqui, cada escolha é livre.</p><button id="open-communication" className={styles.secondaryButton} onClick={() => setCommunicationOpen(true)}>Abrir prancha de comunicação <ArrowRight size={18} aria-hidden="true" /></button></div>
      </section>
    </>}
  </div>;
}

function GameSession({ game, initialRound, level: levelKey, student, onLeave }: { game: CatalogGame; initialRound: GameRound; level: Level; student: HubStudent | null; onLeave: () => void }) {
  const level = photoLevel(levelKey);
  // Dicas e tentativas a mais: entram na nota do registro, como nos jogos de tela cheia.
  const [stats, setStats] = useState({ hints: 0, retries: 0 });
  const miss = () => setStats((current) => ({ ...current, retries: current.retries + 1 }));
  const [round, setRound] = useState(initialRound);
  const [roundIndex, setRoundIndex] = useState(0);
  const [solved, setSolved] = useState(false);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"success" | "hint">("hint");
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [ordered, setOrdered] = useState<string[]>([]);
  const [hint, setHint] = useState(false);
  const [audioMessage, setAudioMessage] = useState("");
  const [classifiedCount, setClassifiedCount] = useState(0);
  const [roundRevision, setRoundRevision] = useState(0);
  const promptHeading = useRef<HTMLHeadingElement>(null);
  const completionHeading = useRef<HTMLHeadingElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const roundCount = game.id === "memoria" || game.id === "rotina" || game.id === "classificar" ? 1 : 5;

  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);
  useEffect(() => {
    if (finished) completionHeading.current?.focus();
    else if (solved) nextButton.current?.focus();
  }, [finished, solved]);

  function sayInstruction() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setAudioMessage("O áudio não está disponível neste navegador. A instrução está escrita logo abaixo.");
      return;
    }
    window.speechSynthesis.cancel();
    const detail = round.kind === "rotina" ? round.story : round.kind === "letras" || round.kind === "palavras" || round.kind === "silabas" ? `A imagem mostra ${round.target.article === "a" ? "uma" : "um"} ${round.target.label.toLocaleLowerCase("pt-BR")}.` : round.kind === "somar" ? `${round.addends[0]} no primeiro grupo e ${round.addends[1]} no segundo grupo.` : round.kind === "comparar" ? `${round.options[0].quantity} no primeiro grupo e ${round.options[1].quantity} no segundo grupo.` : round.kind === "numeros" ? `A sequência é: ${round.sequence.map((number) => number === null ? "espaço vazio" : number).join(", ")}.` : "";
    const speech = new SpeechSynthesisUtterance(`${round.prompt} ${detail}`);
    speech.lang = "pt-BR";
    speech.rate = 0.85;
    speech.onerror = (event) => {
      if (event.error !== "interrupted" && event.error !== "canceled") setAudioMessage("Não foi possível reproduzir o áudio. Você pode ler a instrução e continuar.");
    };
    setAudioMessage("");
    window.speechSynthesis.speak(speech);
  }

  function reset(nextRound: GameRound) {
    setRound(nextRound); setSolved(false); setFeedback(""); setSelected(null);
    setRevealed([]); setMatched([]); setOrdered([]); setHint(false); setAudioMessage("");
    setClassifiedCount(0); setRoundRevision((current) => current + 1);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    requestAnimationFrame(() => promptHeading.current?.focus());
  }

  function restart() {
    setFinished(false); setRoundIndex(0); setStats({ hints: 0, retries: 0 }); reset(generateRound(game.id, level));
  }

  function next() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (roundIndex + 1 >= roundCount) setFinished(true);
    else { setRoundIndex((current) => current + 1); reset(generateRound(game.id, level)); }
  }

  function choose(id: string) {
    if (solved || round.kind === "memoria" || round.kind === "rotina" || round.kind === "classificar" || round.kind === "silabas") return;
    setSelected(id);
    if (isCorrectAnswer(round, id)) {
      const message = round.kind === "somar" ? "Você juntou os grupos e encontrou o total!" : round.kind === "subtrair" ? "Você descobriu quantos objetos ficaram!" : round.kind === "comparar" ? "Você comparou os grupos e encontrou a quantidade pedida!" : round.kind === "numeros" ? "Esse número completa a sequência!" : round.kind === "letras" ? "Essa é a primeira letra do nome da imagem!" : round.kind === "palavras" ? "Essa palavra corresponde à imagem!" : round.kind === "usos" ? "Esse objeto pode ajudar nessa situação!" : "Você encontrou! Vamos para a próxima descoberta?";
      setSolved(true); setFeedbackKind("success"); setFeedback(message);
    } else {
      miss(); setFeedbackKind("hint"); setFeedback("Vamos olhar mais uma vez? Use uma pista ou escolha outra opção.");
    }
  }

  function reveal(id: string) {
    if (round.kind !== "memoria" || solved || matched.includes(id) || revealed.includes(id) || revealed.length === 2 || hint) return;
    const open = [...revealed, id];
    setRevealed(open);
    if (open.length === 1) { setFeedback(""); return; }
    const first = round.cards.find((card) => card.id === open[0])!;
    const second = round.cards.find((card) => card.id === open[1])!;
    if (first.objectId === second.objectId) {
      const pairs = [...matched, ...open];
      setMatched(pairs); setRevealed([]); setFeedbackKind("success");
      setFeedback(`Par de ${objectById(first.objectId).label.toLocaleLowerCase("pt-BR")} encontrado!`);
      if (pairs.length === round.cards.length) setSolved(true);
    } else {
      miss(); setFeedbackKind("hint"); setFeedback("Estas imagens são diferentes. Observe onde estão antes de virar as cartas.");
    }
  }

  function order(id: string) {
    if (round.kind !== "rotina" || solved || ordered.includes(id)) return;
    const nextOrder = [...ordered, id];
    setOrdered(nextOrder); setFeedback("");
    if (nextOrder.length === round.correctOrder.length) {
      if (isCorrectAnswer(round, nextOrder)) {
        setSolved(true); setFeedbackKind("success"); setFeedback("Tudo pronto! Você organizou os passos da história.");
      } else {
        miss(); setFeedbackKind("hint"); setFeedback("Vamos conferir a história? Retire o último passo ou recomece a ordem.");
      }
    }
  }

  function answerSyllables(answer: string[]) {
    if (round.kind !== "silabas" || solved) return;
    if (isCorrectAnswer(round, answer)) {
      setSolved(true); setFeedbackKind("success"); setFeedback(`Você montou a palavra ${round.target.label.toLocaleUpperCase("pt-BR")}!`);
    } else {
      miss(); setFeedbackKind("hint"); setFeedback("Vamos conferir a ordem das sílabas? Você pode retirar a última ou limpar a palavra e tentar de novo.");
    }
  }

  const progress = round.kind === "memoria" ? matched.length / 2 : round.kind === "rotina" ? ordered.length : round.kind === "classificar" ? classifiedCount : roundIndex + (solved ? 1 : 0);
  const total = round.kind === "memoria" ? round.pairCount : round.kind === "rotina" ? round.correctOrder.length : round.kind === "classificar" ? round.items.length : roundCount;
  const progressText = round.kind === "memoria" ? `${progress} de ${total} pares encontrados` : round.kind === "rotina" ? `${ordered.length} de ${total} passos escolhidos` : round.kind === "classificar" ? `${classifiedCount} de ${round.items.length} imagens nos grupos` : `${roundIndex + 1} de ${roundCount} descobertas`;

  const [unit, units]: [string, number] = round.kind === "memoria" ? ["pares", round.pairCount] : round.kind === "rotina" ? ["passos", round.correctOrder.length] : round.kind === "classificar" ? ["imagens", round.items.length] : ["rodadas", roundCount];
  const result: GameResult = { done: units, total: units, ...stats };
  const completionActions = <div className={styles.completionActions}><button className={styles.primaryButton} onClick={restart}><RotateCcw size={18} aria-hidden="true" /> Jogar de novo</button><button className={styles.secondaryButton} onClick={onLeave}>Escolher outro jogo <ArrowRight size={18} aria-hidden="true" /></button></div>;

  if (finished) return <section className={styles.completion} aria-labelledby="game-finished">
    <div className={styles.completionPhotos} aria-hidden="true">{(["apple", "ball", "book"] as const).map((id) => <ObjectPhoto id={id} key={id} />)}</div>
    <span className={styles.completionMark}><Check size={26} aria-hidden="true" /></span>
    <h2 id="game-finished" ref={completionHeading} tabIndex={-1}>Uma descoberta para levar com você.</h2>
    <p>{game.id === "memoria" ? "Você encontrou todos os pares de imagens." : game.id === "rotina" ? "Você colocou cada passo no seu lugar." : game.id === "classificar" ? "Você organizou todas as imagens nos grupos." : "Você explorou as cinco propostas desta partida."} Podemos brincar de novo ou descobrir outro jogo.</p>
    {student ? <div className={styles.completionRecord}><GameRecordForm student={student} result={result} note={gameNote(game.title, levelKey, null, result, unit)} actions={completionActions} /></div> : completionActions}
  </section>;

  return <section className={styles.playArea} aria-label={`Partida de ${game.title}`}>
    <div className={styles.playToolbar}>
      <span className={styles.progressText}>{progressText}</span>
      <div className={styles.toolbarActions}><button className={styles.textButton} onClick={sayInstruction}><Volume2 size={18} aria-hidden="true" /> Ouvir instrução</button><button className={styles.iconButton} aria-label="Recomeçar esta partida" onClick={restart}><RotateCcw size={19} aria-hidden="true" /></button></div>
    </div>
    <progress className={styles.progress} value={progress} max={total} aria-label="Progresso da partida" />
    {audioMessage ? <p className={styles.audioMessage} role="status">{audioMessage}</p> : null}
    <div className={styles.prompt}>
      <h2 ref={promptHeading} tabIndex={-1}>{round.prompt}</h2>
      {round.kind === "rotina" ? <p className={styles.story}>{round.story}</p> : null}
    </div>

    {round.kind === "memoria" ? <>
      <div className={styles.memoryGrid} data-pairs={round.pairCount}>
        {round.cards.map((card, index) => {
          const found = matched.includes(card.id);
          const faceUp = found || revealed.includes(card.id) || hint;
          const object = objectById(card.objectId);
          return <button key={card.id} className={styles.memoryCard} data-open={faceUp || undefined} data-found={found || undefined} aria-label={`Carta ${index + 1}, ${faceUp ? `${object.label}${found ? ", par encontrado" : ""}` : "virada para baixo"}`} aria-pressed={faceUp} aria-disabled={found || hint || (revealed.length === 2 && !revealed.includes(card.id)) || undefined} onClick={() => reveal(card.id)}>
            {faceUp ? <><Image src={object.image} alt="" width={220} height={220} className={styles.objectPhoto} sizes="(max-width: 640px) 25vw, 180px" /><span className={styles.memoryCaption}>{object.label}</span>{found ? <span className={styles.foundMark}><Check size={16} aria-hidden="true" /></span> : null}</> : <><span className={styles.cardNumber}>{index + 1}</span><span className={styles.cardBackWord}>descobrir</span></>}
          </button>;
        })}
      </div>
      {revealed.length === 2 ? <button className={styles.secondaryButton} onClick={() => { setRevealed([]); setFeedback(""); }}>Virar as duas cartas <RotateCcw size={17} aria-hidden="true" /></button> : null}
    </> : round.kind === "rotina" ? <>
      <ol className={styles.routineSlots} aria-label="Sua sequência">{round.correctOrder.map((_, index) => {
        const option = round.options.find((item) => item.id === ordered[index]);
        return <li key={index}><span className={styles.slotNumber}>{index + 1}</span>{option ? <><Image src={option.image} alt="" width={140} height={140} className={styles.objectPhoto} /><span>{option.label}</span></> : <span className={styles.emptySlot}>Escolha o {index + 1}º passo</span>}</li>;
      })}</ol>
      <div className={styles.choiceGrid} data-count={round.options.length}>{round.options.map((option) => <button key={option.id} className={styles.choiceCard} aria-label={option.label} aria-pressed={ordered.includes(option.id)} disabled={solved || ordered.includes(option.id)} onClick={() => order(option.id)}><Image src={option.image} alt="" width={240} height={240} className={styles.objectPhoto} /><span>{option.label}</span>{ordered.includes(option.id) ? <Check className={styles.choiceCheck} size={20} aria-hidden="true" /> : null}</button>)}</div>
      {!solved ? <div className={styles.routineActions}><button className={styles.textButton} disabled={!ordered.length} onClick={() => { setOrdered((current) => current.slice(0, -1)); setFeedback(""); }}>Retirar último passo</button><button className={styles.textButton} disabled={!ordered.length} onClick={() => { setOrdered([]); setFeedback(""); }}>Limpar a ordem</button></div> : null}
    </> : round.kind === "classificar" ? <ClassificationGame key={roundRevision} round={round} onProgress={setClassifiedCount} onComplete={() => setSolved(true)} /> : round.kind === "silabas" ? <>
      <figure className={styles.targetObject} aria-label="Imagem para observar"><Image src={round.target.image} alt={round.target.label} width={240} height={240} sizes="(max-width: 639px) 160px, 200px" className={styles.objectPhoto} />{level === 1 || hint ? <figcaption>{round.target.label.toLocaleUpperCase("pt-BR")}</figcaption> : null}</figure>
      <SyllableBuilder key={roundRevision} round={round} hint={hint} solved={solved} onAnswer={answerSyllables} onEdit={() => setFeedback("")} />
    </> : <>
      {round.kind === "letras" || round.kind === "palavras" ? <figure className={styles.targetObject} aria-label="Imagem para observar">
        <Image src={round.target.image} alt={round.target.label} width={240} height={240} sizes="(max-width: 639px) 160px, 200px" className={styles.objectPhoto} />
        {round.kind === "letras" && (level === 1 || hint) ? <figcaption>{round.target.label.toLocaleUpperCase("pt-BR")}</figcaption> : round.kind === "palavras" && (level === 1 || hint) ? <figcaption>Começa com {round.target.label[0].toLocaleUpperCase("pt-BR")}</figcaption> : null}
      </figure> : null}
      {round.kind === "somar" ? <div className={styles.additionGroups} aria-label="Grupos para juntar">
        {round.addends.map((quantity, groupIndex) => <div className={styles.additionPart} key={groupIndex}>
          {groupIndex === 1 ? <span className={styles.additionOperator} aria-hidden="true">+</span> : null}
          <div className={styles.additionGroup} role="group" aria-label={`${groupIndex === 0 ? "Primeiro" : "Segundo"} grupo de objetos`}>
            {Array.from({ length: quantity }, (_, index) => <div className={styles.additionObject} key={index}><Image src={round.target.image} alt={`${round.target.label} ${groupIndex === 0 ? index + 1 : round.addends[0] + index + 1}`} width={110} height={110} sizes="(max-width: 639px) 55px, 80px" className={styles.objectPhoto} /><span>{hint ? (groupIndex === 0 ? index + 1 : round.addends[0] + index + 1) : ""}</span></div>)}
          </div>
          <span className={styles.additionCaption}>{hint ? `${quantity} ${quantity === 1 ? round.target.label.toLocaleLowerCase("pt-BR") : round.target.plural}` : groupIndex === 0 ? "Primeiro grupo" : "Segundo grupo"}</span>
        </div>)}
      </div> : null}
      {round.kind === "contar" ? <div className={styles.countObjects} aria-label={`Objetos para contar: ${round.quantity}`}>
        {Array.from({ length: round.quantity }, (_, index) => <div key={index}><Image src={round.target.image} alt={`${round.target.label} ${index + 1}`} width={150} height={150} className={styles.objectPhoto} /><span>{hint ? index + 1 : ""}</span></div>)}
      </div> : null}
      {round.kind === "subtrair" ? <div className={styles.subtractionObjects} role="group" aria-label="Objetos que ficaram e objetos retirados">
        {Array.from({ length: round.initialQuantity }, (_, index) => <div className={styles.subtractionObject} key={index} data-removed={index >= round.quantity || undefined}><Image src={round.target.image} alt={`${round.target.label} ${index + 1}${index >= round.quantity ? ", retirado" : ", ficou"}`} width={120} height={120} sizes="(max-width: 639px) 65px, 90px" className={styles.objectPhoto} /><span>{index >= round.quantity ? "Retirado" : hint ? index + 1 : "Ficou"}</span></div>)}
        {round.quantity === 0 ? <p className={styles.zeroObjects}>Todos os objetos foram retirados.</p> : null}
      </div> : null}
      {round.kind === "numeros" ? <ol className={styles.numberSequence} aria-label="Sequência de números">{round.sequence.map((number, index) => <li key={index} data-missing={number === null || undefined} data-solved={solved && number === null || undefined} aria-label={number === null ? solved ? `Número encontrado: ${round.answerId}` : "Espaço para completar" : String(number)}>{number ?? (solved ? round.answerId : "?")}</li>)}</ol> : null}
      {round.kind === "sequencia" ? <div className={styles.pattern} aria-label="Sequência para observar">
        {round.sequence.map((object, index) => <div className={styles.patternItem} key={index}><ObjectPhoto id={object.id} /><span>{level === 1 || hint ? object.label : index + 1}</span></div>)}<div className={styles.patternBlank} aria-label="Qual imagem vem agora?">?</div>
      </div> : null}
      {round.kind === "cores" ? <div className={styles.colorPrompt}><span className={styles.colorSwatch} style={{ backgroundColor: round.target.color }} aria-hidden="true" /><span>{round.target.colorLabel}</span></div> : null}
      <div className={styles.choiceGrid} data-count={round.options.length} data-kind={round.kind}>{round.options.map((option, optionIndex) => <button key={option.id} className={`${styles.choiceCard} ${round.kind === "palavras" ? styles.wordChoice : !option.image ? styles.numberChoice : ""}`} data-quantity={round.kind === "comparar" ? round.options[optionIndex].quantity : undefined} data-selected={selected === option.id || undefined} data-correct={solved && selected === option.id || undefined} data-hint={hint && option.id === round.answerId || undefined} aria-describedby={hint && option.id === round.answerId ? "game-answer-hint" : undefined} aria-label={round.kind === "comparar" ? `Grupo ${optionIndex + 1}: ${round.options[optionIndex].quantity} ${round.target.plural}` : round.kind === "cores" && option.objectId ? `${option.label}, ${objectById(option.objectId).colorLabel.toLocaleLowerCase("pt-BR")}` : option.label} aria-pressed={selected === option.id} disabled={solved} onClick={() => choose(option.id)}>
        {round.kind === "comparar" ? <div className={styles.comparisonObjects} aria-hidden="true">{Array.from({ length: round.options[optionIndex].quantity }, (_, index) => <Image src={round.target.image} alt="" key={index} width={100} height={100} sizes="(max-width: 639px) 48px, 70px" className={styles.objectPhoto} />)}</div> : option.image ? <Image src={option.image} alt="" width={280} height={280} sizes="(max-width: 640px) 40vw, 220px" className={styles.objectPhoto} /> : null}
        <span className={level === 2 && option.image && round.kind === "encontre" && !hint ? "sr-only" : undefined}>{round.kind === "comparar" ? `Grupo ${optionIndex + 1}${level === 1 || hint ? `: ${round.options[optionIndex].quantity}` : ""}` : option.label}</span>
        {solved && selected === option.id ? <Check className={styles.choiceCheck} size={24} aria-hidden="true" /> : null}
      </button>)}</div>
      {hint ? <span id="game-answer-hint" className="sr-only">Pista: esta opção corresponde ao pedido.</span> : null}
    </>}

    {round.kind !== "classificar" ? <div className={styles.feedback} role="status" aria-live="polite" aria-atomic="true" data-kind={feedback ? feedbackKind : undefined}>{feedback ? <>{feedbackKind === "success" ? <Check size={20} aria-hidden="true" /> : <Lightbulb size={20} aria-hidden="true" />}<p>{feedback}</p></> : <p>{round.kind === "memoria" ? "Toque em duas cartas para observar as imagens." : round.kind === "rotina" ? "Toque nas imagens na ordem da história." : round.kind === "silabas" ? "Toque nas sílabas na ordem da palavra. Você pode desfazer e tentar de novo." : "Toque na sua escolha. Você pode tentar quantas vezes quiser."}</p>}</div> : null}
    {round.kind !== "classificar" || solved ? <div className={styles.playFooter}>
      {!solved ? round.kind !== "classificar" ? <button className={styles.textButton} aria-pressed={hint} onClick={() => { if (!hint) setStats((current) => ({ ...current, hints: current.hints + 1 })); setHint(!hint); }}><Lightbulb size={18} aria-hidden="true" />{hint ? "Esconder pista" : "Ver uma pista"}</button> : null : <span className={styles.successLabel}><Check size={18} aria-hidden="true" /> Descoberta concluída</span>}
      {solved ? <button ref={nextButton} className={styles.primaryButton} onClick={next}>{roundIndex + 1 === roundCount ? "Concluir partida" : "Próxima descoberta"}<ArrowRight size={18} aria-hidden="true" /></button> : null}
    </div> : null}
    {hint && round.kind !== "classificar" ? <p className={styles.hintNote}>{HINT_TEXT[round.kind] ?? "Uma das opções tem uma pista para ajudar a encontrar a resposta."}</p> : null}
  </section>;
}
