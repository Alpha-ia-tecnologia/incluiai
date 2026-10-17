"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CloudCheck, CloudUpload, TriangleAlert } from "lucide-react";
import { saveDuaDraft, openDuaNewVersion } from "@/actions/dua";
import type { DuaContent, ReviewState } from "@/lib/dua/domain";
import type { PlanningAccess } from "@/lib/dua/access";
import type { SuggestionView } from "@/lib/dua/suggestions";
import { StepObjective } from "./step-objective";
import { StepBarriers } from "./step-barriers";
import { StepOptions } from "./step-options";
import { StepReview } from "./step-review";
import { buttonCls, secondaryCls } from "./dua-ui";

// Formulário em quatro etapas (RF02) com salvamento automático. As gravações saem
// uma de cada vez (o Next despacha ações em série) e sempre com a revisão
// conhecida: se outro profissional salvou antes, a tela avisa ANTES de sobrescrever.

export const STEPS = [
  { key: "objetivo", label: "Objetivo e evidência" },
  { key: "barreiras", label: "Contexto e barreiras" },
  { key: "opcoes", label: "Opções e apoios" },
  { key: "revisao", label: "Revisão para aplicação" },
] as const;

type SaveStatus = { kind: "salvo"; at: string | null } | { kind: "alterado" } | { kind: "salvando" } | { kind: "erro"; message: string } | { kind: "conflito"; byName: string; at: string; content: DuaContent; revision: number } | { kind: "validado"; message: string };

export type EditorProps = {
  planningId: string;
  access: PlanningAccess;
  version: number;
  revision: number;
  state: ReviewState;
  content: DuaContent;
  updatedAt: string;
  ownerName: string;
  sharing: string;
  hasValidated: boolean;
  supportsCount: number;
  suggestions: SuggestionView[];
  aiOn: boolean;
  initialStep: number;
};

export function DuaEditor(props: EditorProps) {
  const router = useRouter();
  const [content, setContent] = useState<DuaContent>(props.content);
  const [step, setStep] = useState(Math.min(3, Math.max(0, props.initialStep)));
  const [status, setStatus] = useState<SaveStatus>({ kind: "salvo", at: props.updatedAt });
  const [opening, startOpening] = useTransition();
  const revision = useRef(props.revision);
  const latest = useRef(content);
  const dirty = useRef(false);
  const saving = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const readOnly = !props.access.edit || props.state === "validado";

  // Uma gravação por vez; o que mudar durante ela sai na seguinte.
  const save = useCallback(async () => {
    if (saving.current) await saving.current;
    if (!dirty.current) return;
    dirty.current = false;
    const snapshot = latest.current;
    setStatus({ kind: "salvando" });
    const work = (async () => {
      const result = await saveDuaDraft({ planningId: props.planningId, version: props.version, revision: revision.current, content: snapshot });
      if (!result.ok) {
        dirty.current = true;
        setStatus({ kind: "erro", message: result.message });
        return;
      }
      const value = result.value;
      if (value.ok) {
        revision.current = value.revision;
        setStatus(dirty.current ? { kind: "alterado" } : { kind: "salvo", at: value.savedAt });
      } else if (value.reason === "conflito") {
        dirty.current = true;
        setStatus({ kind: "conflito", byName: value.updatedByName, at: value.updatedAt, content: value.content, revision: value.revision });
      } else {
        setStatus({ kind: "validado", message: value.message });
      }
    })();
    saving.current = work;
    await work;
    saving.current = null;
  }, [props.planningId, props.version]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await save();
  }, [save]);

  const update = useCallback((next: DuaContent) => {
    if (readOnly) return;
    latest.current = next;
    dirty.current = true;
    setContent(next);
    setStatus((current) => (current.kind === "conflito" || current.kind === "validado" ? current : { kind: "alterado" }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(); }, 1200);
  }, [readOnly, save]);

  // Depois de uma decisão (sugestão aceita, envio para revisão, validação) a página
  // é atualizada com uma revisão mais nova do servidor: o editor passa a usá-la.
  // As ações gravam o pendente antes (flush), então não há edição local a perder.
  useEffect(() => {
    if (props.revision > revision.current && !dirty.current) {
      revision.current = props.revision;
      latest.current = props.content;
      setContent(props.content);
      setStatus({ kind: "salvo", at: props.updatedAt });
    }
  }, [props.revision, props.content, props.updatedAt]);

  // Ao sair da página com alteração pendente, o navegador avisa.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty.current) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // Trocar de etapa leva o foco ao título dela (leitor de tela e teclado).
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
    const url = new URL(window.location.href);
    url.searchParams.set("etapa", String(step + 1));
    window.history.replaceState(null, "", url);
  }, [step]);

  function keepMine() {
    if (status.kind !== "conflito") return;
    revision.current = status.revision;
    dirty.current = true;
    void save();
  }

  function takeTheirs() {
    if (status.kind !== "conflito") return;
    revision.current = status.revision;
    latest.current = status.content;
    dirty.current = false;
    setContent(status.content);
    setStatus({ kind: "salvo", at: status.at });
  }

  function openNewVersion() {
    startOpening(async () => {
      const result = await openDuaNewVersion({ planningId: props.planningId });
      if (result.ok) router.refresh();
      else setStatus({ kind: "erro", message: result.message });
    });
  }

  const stepProps = { content, update, readOnly };

  return (
    <div className="min-w-0">
      {props.state === "validado" ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green/20 bg-green-soft/60 p-4">
          <p className="max-w-xl text-sm leading-relaxed text-ink">
            <strong className="font-medium">A versão {props.version} está validada e não muda mais.</strong> As aplicações registradas continuam presas a ela. Para ajustar, abra a versão {props.version + 1}.
          </p>
          {props.access.edit ? (
            <button type="button" onClick={openNewVersion} disabled={opening} className={buttonCls}>
              {opening ? "Abrindo…" : `Abrir a versão ${props.version + 1} para editar`}
            </button>
          ) : null}
        </div>
      ) : !props.access.edit ? (
        <p className="mb-5 rounded-2xl bg-surface-muted p-4 text-sm text-ink-soft">Você pode ler e aplicar este planejamento, mas só a equipe responsável edita.</p>
      ) : null}

      <nav aria-label="Etapas do planejamento" className="mb-5">
        <ol className="grid gap-2 sm:grid-cols-4">
          {STEPS.map((item, index) => (
            <li key={item.key} className="min-w-0">
              <button
                type="button"
                onClick={() => setStep(index)}
                aria-current={index === step ? "step" : undefined}
                className={`flex min-h-12 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${index === step ? "bg-brand font-medium text-white" : "bg-surface-muted text-ink-soft hover:bg-line hover:text-ink"}`}
              >
                <span aria-hidden className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs ${index === step ? "bg-white/20" : "bg-paper-raised"}`}>{index + 1}</span>
                <span className="min-w-0">{item.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <SaveIndicator status={status} readOnly={readOnly} onKeepMine={keepMine} onUseTheirs={takeTheirs} onRetry={() => void flush()} />

      <section aria-labelledby="etapa-titulo" className="ui-card min-w-0">
        <h2 id="etapa-titulo" ref={headingRef} tabIndex={-1} className="mb-1 font-display text-xl font-medium text-ink outline-none">
          {step + 1}. {STEPS[step].label}
        </h2>
        {step === 0 ? <StepObjective {...stepProps} /> : null}
        {step === 1 ? <StepBarriers {...stepProps} /> : null}
        {step === 2 ? <StepOptions {...stepProps} planningId={props.planningId} access={props.access} suggestions={props.suggestions} aiOn={props.aiOn} flush={flush} supportsCount={props.supportsCount} /> : null}
        {step === 3 ? <StepReview {...stepProps} planningId={props.planningId} access={props.access} version={props.version} state={props.state} sharing={props.sharing} hasValidated={props.hasValidated} ownerName={props.ownerName} flush={flush} revision={() => revision.current} goTo={setStep} /> : null}
      </section>

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className={secondaryCls}>
          <ArrowLeft size={16} aria-hidden /> Etapa anterior
        </button>
        <button type="button" onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))} disabled={step === STEPS.length - 1} className={buttonCls}>
          Próxima etapa <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function SaveIndicator({ status, readOnly, onKeepMine, onUseTheirs, onRetry }: { status: SaveStatus; readOnly: boolean; onKeepMine: () => void; onUseTheirs: () => void; onRetry: () => void }) {
  if (readOnly && status.kind === "salvo") return null;
  if (status.kind === "conflito") {
    return (
      <div role="alert" className="mb-4 rounded-2xl border border-amber-800/20 bg-amber-soft p-4 text-sm text-amber-900">
        <p className="flex items-start gap-2 font-medium"><TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" /> {status.byName} salvou este planejamento enquanto você editava. Suas últimas alterações ainda não foram gravadas.</p>
        <p className="mt-1 leading-relaxed">Escolha antes de continuar: ficar com a versão salva por {status.byName} (as suas alterações desde então se perdem) ou gravar a sua por cima da dele(a).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onUseTheirs} className={secondaryCls}>Ficar com a versão de {status.byName}</button>
          <button type="button" onClick={onKeepMine} className={secondaryCls}>Gravar a minha por cima</button>
        </div>
      </div>
    );
  }
  if (status.kind === "validado") return <p role="alert" className="mb-4 rounded-2xl bg-amber-soft p-4 text-sm text-amber-900">{status.message}</p>;
  if (status.kind === "erro") {
    return (
      <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-coral-soft p-3 text-sm text-coral">
        <span>Não foi possível salvar: {status.message}</span>
        <button type="button" onClick={onRetry} className={secondaryCls}>Tentar salvar de novo</button>
      </div>
    );
  }
  const text = status.kind === "salvando" ? "Salvando…" : status.kind === "alterado" ? "Alterações ainda não salvas" : "Tudo salvo";
  const Icon = status.kind === "salvo" ? CloudCheck : CloudUpload;
  return (
    <p role="status" aria-live="polite" className="mb-4 inline-flex items-center gap-2 text-xs text-ink-soft">
      <Icon size={14} aria-hidden /> {text}
    </p>
  );
}
