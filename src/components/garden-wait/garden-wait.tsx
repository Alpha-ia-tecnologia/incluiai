"use client";

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Droplet, Pause, Play } from "lucide-react";
import type { ToolStep } from "@/lib/assistant/types";
import {
  FINALE_MIN_SECONDS, LONG_THRESHOLDS, TIP_POOLS, TURN_THRESHOLDS,
  artFor, chatCaption, deriveGarden, endingCaption, inlineArt, inlineCaption, inlineThresholds, inlineTypical, longBudget, sunAngle,
  type ArtState, type GardenOutcome, type InlineScene, type TipPool,
} from "@/lib/assistant/garden-scenes";
import { GardenArt } from "./garden-art";
import styles from "./garden-wait.module.css";

// Espera dos agentes ("canteiro vivo"). Faixa do chat: sempre montada entre a
// conversa e o campo de mensagem; mostra o turno em andamento e um final
// curto. Cartão inline: montado pelo PendingButton enquanto a ação roda.
// Nada aqui pede foco sozinho; os anúncios vão para a região de status do
// hospedeiro, fora da conversa (aria-busy).

export type { InlineScene };

type ChatProps = {
  variant: "faixa";
  active: boolean;
  steps: ToolStep[];
  writing: boolean;
  outcome: GardenOutcome | null;
  awaiting: number;
  layout: "popup" | "page";
  announce: (text: string) => void;
  // Para onde o foco volta quando a faixa some (resolvido na hora).
  returnFocusTo: () => HTMLElement | null;
};
type InlineProps = { variant: "inline"; scene: InlineScene; withImages: boolean; announce: (text: string) => void };
export type GardenWaitProps = ChatProps | InlineProps;

export const GardenWait = memo(function GardenWait(props: GardenWaitProps) {
  return props.variant === "inline" ? <InlineWait {...props} /> : <ChatWait {...props} />;
});

// ---- tempo ----------------------------------------------------------------
// <html data-espera-escala="20"> acelera os relógios nos testes de navegador.
function timeScale(): number {
  const value = Number(document.documentElement.dataset.esperaEscala);
  return value > 0 ? value : 1;
}

// Faixa de tempo (em segundos) desde que `resetKey` mudou; null desliga.
function useBucket(resetKey: string | null, thresholds: readonly number[]): number {
  const [state, setState] = useState<{ key: string | null; bucket: number }>({ key: resetKey, bucket: 0 });
  if (state.key !== resetKey) setState({ key: resetKey, bucket: 0 });
  useEffect(() => {
    if (resetKey === null) return;
    const scale = timeScale();
    const start = performance.now();
    let timer = 0;
    const tick = () => {
      const elapsed = ((performance.now() - start) * scale) / 1000;
      const reached = thresholds.filter((value) => value <= elapsed).at(-1) ?? 0;
      setState((current) => (current.key === resetKey && current.bucket !== reached ? { key: resetKey, bucket: reached } : current));
      const next = thresholds.find((value) => value > elapsed);
      window.clearTimeout(timer);
      if (next !== undefined) timer = window.setTimeout(tick, ((next - elapsed) * 1000) / scale + 30);
    };
    if (thresholds.length) timer = window.setTimeout(tick, (thresholds[0] * 1000) / scale);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [resetKey, thresholds]);
  return state.key === resetKey ? state.bucket : 0;
}

// Liga data-entrada (semente e broto) por 1,4 s a cada turno novo.
function useEntrance(turn: number): boolean {
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (turn === 0) return;
    const timer = window.setTimeout(() => setDone(turn), 1400);
    return () => window.clearTimeout(timer);
  }, [turn]);
  return turn !== 0 && done !== turn;
}

// ---- pausa (vale para todas as esperas do aparelho) -------------------------
const PAUSE_KEY = "incluiedu:jardim-pausado";
const PAUSE_EVENT = "incluiedu:jardim";
// Sem armazenamento (bloqueado ou cheio), a pausa vale na memória até recarregar.
let memPaused = false;
let storageOk = true;
function readPaused(): boolean {
  if (!storageOk) return memPaused;
  try { return window.localStorage.getItem(PAUSE_KEY) === "1"; } catch { storageOk = false; return memPaused; }
}
function subscribePaused(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PAUSE_EVENT, onChange);
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener(PAUSE_EVENT, onChange); };
}
function usePaused(): boolean {
  return useSyncExternalStore(subscribePaused, readPaused, () => false);
}
function setPaused(value: boolean) {
  memPaused = value;
  try { window.localStorage.setItem(PAUSE_KEY, value ? "1" : "0"); } catch { storageOk = false; }
  window.dispatchEvent(new Event(PAUSE_EVENT));
}

// ---- rega e dicas -------------------------------------------------------------
const tipCursor: Partial<Record<TipPool, number>> = {};
function nextTip(pool: TipPool): string {
  const key = `incluiedu:jardim-dica-${pool}`;
  let index = tipCursor[pool];
  if (index === undefined) {
    try { index = Number(window.sessionStorage.getItem(key)) || 0; } catch { index = 0; }
  }
  tipCursor[pool] = index + 1;
  try { window.sessionStorage.setItem(key, String(index + 1)); } catch { /* segue só na memória */ }
  const tips = TIP_POOLS[pool];
  return tips[index % tips.length];
}

type Watering = { count: number; phase: "a" | "b" | null; wet: boolean; tip: string | null; tipKey: string };
// Regar é opcional: no máximo uma vez a cada 0,9 s. A dica fica até a próxima
// rega ou até a legenda trazer uma informação nova (tipKey muda).
function useWatering(pool: TipPool, tipKey: string) {
  const [state, setState] = useState<Watering>({ count: 0, phase: null, wet: false, tip: null, tipKey: "" });
  // Chave nova: a dica é descartada de vez, para não voltar (nem ser anunciada
  // de novo) quando uma chave igual reaparecer num turno seguinte.
  if (state.tip !== null && state.tipKey !== tipKey) setState({ ...state, tip: null });
  const last = useRef(-Infinity);
  const phaseTimer = useRef(0);
  const wetTimer = useRef(0);
  useEffect(() => () => { window.clearTimeout(phaseTimer.current); window.clearTimeout(wetTimer.current); }, []);
  const water = useCallback(() => {
    const now = performance.now();
    if (now - last.current < 900) return;
    last.current = now;
    const tip = nextTip(pool);
    setState((current) => ({ count: current.count + 1, phase: current.phase === "a" ? "b" : "a", wet: true, tip, tipKey }));
    window.clearTimeout(phaseTimer.current);
    window.clearTimeout(wetTimer.current);
    phaseTimer.current = window.setTimeout(() => setState((current) => ({ ...current, phase: null })), 1200);
    wetTimer.current = window.setTimeout(() => setState((current) => ({ ...current, wet: false })), 2400);
  }, [pool, tipKey]);
  return { count: state.count, phase: state.phase, wet: state.wet, tip: state.tip !== null && state.tipKey === tipKey ? state.tip : null, water };
}

// Fora da tela (página /assistente rolada): pausa a respiração sem estado React.
function useOffscreen(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => { element.dataset.offscreen = entry.isIntersecting ? "false" : "true"; });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
}

// ---- peças ----------------------------------------------------------------------
function Stage({ art, waterings, onWater }: { art: ArtState; waterings: number; onWater: () => void }) {
  const clipId = useId();
  const descId = useId();
  return (
    <>
      <button type="button" className={styles.stage} onClick={onWater} aria-label="Regar a planta e ver uma dica (opcional)" aria-describedby={descId} title="Regue a planta enquanto espera" data-testid="espera-regar" data-waterings={waterings}>
        <GardenArt {...art} clipId={clipId} />
        <span className={styles.badge} aria-hidden="true"><Droplet size={10} /></span>
      </button>
      {/* hidden: lida só como descrição do botão, não de novo como texto solto. */}
      <span id={descId} hidden>Brincadeira opcional: não muda nem acelera a resposta.</span>
    </>
  );
}

function PauseButton({ paused }: { paused: boolean }) {
  return (
    <button type="button" className={styles.pause} onClick={() => setPaused(!paused)} aria-label="Pausar a animação" aria-pressed={paused} title={paused ? "Retomar a animação" : "Pausar a animação"} data-testid="espera-pausar">
      {paused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
    </button>
  );
}

// ---- faixa do chat ----------------------------------------------------------------
type Ending = { outcome: GardenOutcome; finale: boolean; stage: "final" | "recolhendo"; awaiting: number };
type Memory = { active: boolean; turn: number; steps: ToolStep[]; writing: boolean; ending: Ending | null };

function ChatWait({ active, steps, writing, outcome, awaiting, layout, announce, returnFocusTo }: Omit<ChatProps, "variant">) {
  const [mem, setMem] = useState<Memory>({ active: false, turn: 0, steps, writing, ending: null });
  const visible = mem.active || mem.ending !== null;
  const turnBucket = useBucket(visible ? `turno-${mem.turn}` : null, TURN_THRESHOLDS);
  // Guarda o último quadro do turno para o final, comparando com o render anterior.
  if (active && (!mem.active || mem.steps !== steps || mem.writing !== writing)) {
    setMem({ active: true, turn: mem.active ? mem.turn : mem.turn + 1, steps, writing, ending: null });
  } else if (!active && mem.active) {
    const finale = turnBucket >= FINALE_MIN_SECONDS;
    setMem({ ...mem, active: false, ending: { outcome: outcome ?? "erro", finale, stage: finale ? "final" : "recolhendo", awaiting } });
  }

  const rootRef = useRef<HTMLDivElement>(null);
  const ending = mem.ending;
  useEffect(() => {
    if (!ending) return;
    const ms = ending.stage === "final" ? (ending.outcome !== "pronto" || ending.awaiting > 0 ? 2400 : 1600) : 300;
    const timer = window.setTimeout(() => {
      if (ending.stage === "final") {
        setMem((current) => (current.ending ? { ...current, ending: { ...current.ending, stage: "recolhendo" } } : current));
        return;
      }
      // Some a faixa: quem usava teclado volta ao campo de mensagem (já
      // liberado) ou, numa conversa longa, ao botão de nova conversa.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && rootRef.current?.contains(focused) && focused.matches(":focus-visible")) {
        returnFocusTo()?.focus({ preventScroll: true });
      }
      setMem((current) => (current.ending ? { ...current, ending: null } : current));
    }, ms);
    return () => window.clearTimeout(timer);
  }, [ending, returnFocusTo]);

  const garden = useMemo(() => deriveGarden(mem.steps, mem.writing), [mem.steps, mem.writing]);
  const longBucket = useBucket(mem.active && garden.long ? garden.long.id : null, LONG_THRESHOLDS);
  const entering = useEntrance(mem.turn);
  const paused = usePaused();
  const pool: TipPool = garden.long ? garden.long.kind : "pratica";
  // A dica fica até a linha 2 que ela cobre trazer informação nova; o convite
  // para regar (que some depois da primeira rega) não conta.
  const baseHint = chatCaption(garden, turnBucket, longBucket, layout, false).hint;
  const watering = useWatering(pool, `${mem.turn}|${ending ? "fim" : ""}|${garden.phase}|${garden.tool}|${garden.long?.stage ?? ""}|${baseHint}`);
  const caption = ending ? endingCaption(ending.outcome, ending.awaiting) : chatCaption(garden, turnBucket, longBucket, layout, watering.count === 0);
  // Um anúncio por mudança real (600 ms de espera, final na hora). Ociosa, a
  // faixa não mexe na região: "Resposta pronta." nunca é cortado.
  const immediate = ending !== null;
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => announce(caption.status), immediate ? 0 : 600);
    return () => window.clearTimeout(timer);
  }, [visible, caption.status, immediate, announce]);
  useOffscreen(rootRef);

  const art = artFor(garden, ending, mem.active && garden.long ? sunAngle(longBucket, longBudget(garden)) : null);
  const tip = ending ? null : watering.tip;
  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${styles.faixa}`}
      data-testid="espera-jardim"
      data-variant={garden.long && !ending ? "faixa" : mem.writing ? "compacta" : "faixa"}
      data-state={ending ? ending.outcome : mem.active ? garden.phase : "inativo"}
      data-aberta={mem.active || ending?.stage === "final" ? "true" : "false"}
      data-scene={garden.scene}
      data-tool={garden.tool}
      data-stage={garden.long?.stage ?? "nenhum"}
      data-elapsed={garden.long ? longBucket : turnBucket}
      data-grown={art.grown}
      data-ties={art.ties}
      data-stones={art.stones}
      data-finale={ending?.finale ? "true" : "false"}
      data-paused={paused ? "true" : "false"}
      data-respira={mem.active && (!mem.writing || garden.long !== null) ? "true" : "false"}
      data-entrada={entering ? "" : undefined}
      data-rega={watering.phase ?? undefined}
      data-molhado={watering.wet ? "" : undefined}
    >
      <div className={styles.faixaInner}>
        {visible ? (
          <div className={styles.faixaBody}>
            <Stage art={art} waterings={watering.count} onWater={watering.water} />
            {/* Legenda legível no modo de navegação; quem anuncia é a região de
                status do chat. A dica é lida em espera-dica, por isso a linha 2
                se esconde da leitura enquanto mostra uma. */}
            <div className={styles.caption} data-testid="espera-legenda">
              <p className={styles.l1}>{caption.label}</p>
              <p className={styles.l2} data-essencial={tip !== null || caption.keep} aria-hidden={tip !== null ? true : undefined}>{tip ?? caption.hint}</p>
            </div>
            <PauseButton paused={paused} />
          </div>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite" data-testid="espera-dica">{tip ?? ""}</p>
    </div>
  );
}

// ---- cartão dos formulários -------------------------------------------------------
function InlineWait({ scene, withImages, announce }: Omit<InlineProps, "variant">) {
  const bucket = useBucket("formulario", inlineThresholds(scene, withImages));
  const caption = inlineCaption(scene, bucket, withImages);
  const paused = usePaused();
  const entering = useEntrance(1);
  const watering = useWatering(scene === "imagem" || scene === "material" ? "pratica" : scene, "formulario");
  const rootRef = useRef<HTMLDivElement>(null);
  useOffscreen(rootRef);
  useEffect(() => { if (caption.late) announce(caption.late); }, [caption.late, announce]);
  const art = useMemo(() => inlineArt(scene, sunAngle(bucket, inlineTypical(scene, withImages))), [scene, bucket, withImages]);
  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${styles.inline}`}
      data-testid="espera-jardim"
      data-variant="inline"
      data-state="aguardando"
      data-scene={scene === "plano" ? "trelica" : scene === "atividades" ? "botoes" : "folha"}
      data-elapsed={bucket}
      data-paused={paused ? "true" : "false"}
      data-respira="true"
      data-entrada={entering ? "" : undefined}
      data-rega={watering.phase ?? undefined}
      data-molhado={watering.wet ? "" : undefined}
    >
      <div className={styles.inlineBody}>
        <Stage art={art} waterings={watering.count} onWater={watering.water} />
        <div className={styles.caption} data-testid="espera-legenda">
          <p className={styles.l1}>{caption.title}</p>
          <p className={styles.l2} aria-hidden={watering.tip !== null ? true : undefined}>{watering.tip ?? caption.explain}</p>
          <p className={styles.l2}>{caption.time}</p>
        </div>
        <PauseButton paused={paused} />
      </div>
      <p className="sr-only" aria-live="polite" data-testid="espera-dica">{watering.tip ?? ""}</p>
    </div>
  );
}
