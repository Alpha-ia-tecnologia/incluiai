"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, Pencil, ShieldAlert, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { decideDuaBlock, requestDuaSuggestion, type DuaResult } from "@/actions/dua";
import {
  AI_BLOCK_DECISION_LABEL, AI_STATE_LABEL, AI_SUGGESTION_LABEL, BARRIER_STATUS_LABEL, DUA_PRINCIPLES, PRINCIPLE_LABEL,
  type AiBlock, type AiPurpose, type DuaPrinciple, type ProfileRef,
} from "@/lib/dua/domain";
import type { SuggestionView } from "@/lib/dua/suggestions";
import { ResultMessage, buttonCls, dangerCls, hintCls, inputCls, labelCls, secondaryCls, textareaCls } from "./dua-ui";
import { newId } from "./step-objective";

// "Sugestão para revisão" (RF05): cada bloco é aceito, editado ou recusado pelo
// profissional. Mudança de objetivo, critério novo e apoio individual aparecem
// destacados (CA04). Aceitar só incorpora ao rascunho; validar é outra decisão.

type Props = {
  planningId: string;
  purpose: AiPurpose;
  supportId?: string;
  profileRefs?: ProfileRef[];
  suggestions: SuggestionView[];
  canRequest: boolean;
  canDecide: boolean;
  aiOn: boolean;
  beforeChange?: () => Promise<void>;
};

export function SuggestionReview({ planningId, purpose, supportId, profileRefs = [], suggestions, canRequest, canDecide, aiOn, beforeChange }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<DuaResult<{ id: string }> | null>(null);
  const [fields, setFields] = useState<string[]>([]);

  function request() {
    start(async () => {
      await beforeChange?.();
      const outcome = await requestDuaSuggestion({ planningId, purpose, supportId, profileFields: fields, requestId: newId() });
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  return (
    <section aria-labelledby={`sugestoes-${purpose}-${supportId ?? "turma"}`} className="min-w-0 rounded-2xl border border-brand/25 bg-brand-soft/30 p-4 sm:p-5">
      <h3 id={`sugestoes-${purpose}-${supportId ?? "turma"}`} className="flex items-center gap-2 text-sm font-medium text-ink">
        <Bot size={16} aria-hidden /> {purpose === "opcoes" ? "Sugestões de opções para revisão (opcional)" : "Sugestões para este apoio (opcional)"}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        {aiOn
          ? "A IA recebe só campos pedagógicos, sem nomes nem dados que identifiquem pessoas. Se não for possível tirar essas informações, nada é enviado. Você decide cada bloco: aceitar, editar ou recusar."
          : "A IA está desligada nesta instalação. As sugestões vêm das regras da plataforma (barreira → opções conhecidas) e passam pela mesma revisão, bloco a bloco."}
      </p>

      {canRequest ? (
        <div className="mt-4 grid gap-3">
          {purpose === "apoio_individual" && profileRefs.length ? (
            <fieldset className="min-w-0">
              <legend className={labelCls}>Itens do perfil que podem ir para a sugestão</legend>
              <p className={hintCls}>Só os marcados vão, sem o nome do estudante. Diagnóstico e saúde nunca são enviados.</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {profileRefs.map((ref) => (
                  <label key={ref.field} className="flex min-h-11 items-start gap-2 text-sm text-ink">
                    <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" checked={fields.includes(ref.field)} onChange={(event) => setFields((list) => (event.target.checked ? [...list, ref.field] : list.filter((item) => item !== ref.field)))} />
                    <span className="min-w-0">{ref.label}: <span className="text-ink-soft">{ref.value}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <button type="button" onClick={request} disabled={pending} aria-busy={pending} className={`${buttonCls} justify-self-start`}>
            <Sparkles size={16} aria-hidden /> {pending ? (aiOn ? "Preparando sugestões… pode levar alguns segundos" : "Preparando sugestões…") : aiOn ? "Pedir sugestões para revisão" : "Pedir sugestões pelas regras da plataforma"}
          </button>
          <ResultMessage result={result && !result.ok ? result : null} />
        </div>
      ) : null}

      {suggestions.length ? (
        <ol className="mt-5 grid gap-4">
          {suggestions.map((suggestion) => <SuggestionCard key={suggestion.id} planningId={planningId} suggestion={suggestion} canDecide={canDecide} beforeChange={beforeChange} />)}
        </ol>
      ) : null}
    </section>
  );
}

function SuggestionCard({ planningId, suggestion, canDecide, beforeChange }: { planningId: string; suggestion: SuggestionView; canDecide: boolean; beforeChange?: () => Promise<void> }) {
  const waiting = suggestion.state === "aguardando_revisao";
  return (
    <li className="min-w-0 rounded-xl bg-paper-raised p-4 shadow-e1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">{AI_SUGGESTION_LABEL}</Badge>
        <Badge tone={suggestion.state === "bloqueado" || suggestion.state === "falhou" ? "coral" : waiting ? "amber" : "neutral"}>{AI_STATE_LABEL[suggestion.state]}</Badge>
        {suggestion.studentName ? <Badge tone="neutral">Apoio de {suggestion.studentName}</Badge> : null}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        Pedida por {suggestion.requestedByName} em {new Date(suggestion.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · versão {suggestion.versionNumber} do planejamento · {suggestion.provider === "ia" ? `IA (${suggestion.model ?? "sem resposta"})` : "regras da plataforma"} · instruções {suggestion.promptVersion}
        {suggestion.removedCount ? ` · ${suggestion.removedCount} identificador(es) trocado(s) antes do envio` : ""}
      </p>
      {suggestion.error ? <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-coral-soft px-3 py-2 text-sm text-coral"><ShieldAlert size={16} aria-hidden className="mt-0.5 shrink-0" /> {suggestion.error}</p> : null}
      {suggestion.stale ? (
        <p className="mt-3 rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber-900">
          <strong className="font-medium">Volte a conferir:</strong> o objetivo, os critérios ou as barreiras mudaram depois desta sugestão. Para aceitar um bloco, confirme que ele ainda faz sentido.
        </p>
      ) : null}
      {suggestion.checks.length ? (
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-brand-strong">Verificações automáticas ({suggestion.checks.filter((check) => check.passed).length} de {suggestion.checks.length} sem alerta)</summary>
          <ul className="mt-1 grid gap-1 text-sm">
            {suggestion.checks.map((check) => (
              <li key={check.name} className="flex items-start gap-2">
                {check.passed ? <Check size={16} aria-hidden className="mt-0.5 shrink-0 text-green" /> : <X size={16} aria-hidden className="mt-0.5 shrink-0 text-coral" />}
                <span><span className="font-medium text-ink">{check.name}{check.passed ? "" : " (alerta)"}:</span> <span className="text-ink-soft">{check.detail}</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">As verificações apoiam a sua revisão; não a substituem.</p>
        </details>
      ) : null}
      {suggestion.blocks.length ? (
        <ol className="mt-3 grid gap-3">
          {suggestion.blocks.map((block, index) => (
            <BlockCard key={block.id} index={index} planningId={planningId} suggestionId={suggestion.id} block={block} stale={suggestion.stale} canDecide={canDecide && waiting} beforeChange={beforeChange} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function BlockCard({ index, planningId, suggestionId, block, stale, canDecide, beforeChange }: { index: number; planningId: string; suggestionId: string; block: AiBlock; stale: boolean; canDecide: boolean; beforeChange?: () => Promise<void> }) {
  const router = useRouter();
  const [mode, setMode] = useState<"ver" | "editar" | "recusar">("ver");
  const [strategy, setStrategy] = useState(block.strategy);
  const [principles, setPrinciples] = useState<DuaPrinciple[]>(block.principles);
  const [includeCriterion, setIncludeCriterion] = useState(false);
  const [confirmStale, setConfirmStale] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<DuaResult | null>(null);
  const base = `bloco-${block.id}`;
  // Decidido aqui, os botões somem: o foco vai para a decisão registrada (teclado e leitor de tela).
  const decisionRef = useRef<HTMLParagraphElement>(null);
  const justDecided = useRef(false);
  useEffect(() => {
    if (block.decision !== "pendente" && justDecided.current) {
      justDecided.current = false;
      decisionRef.current?.focus();
    }
  }, [block.decision]);

  function decide(decision: "aceito" | "editado" | "recusado") {
    start(async () => {
      await beforeChange?.();
      const outcome = await decideDuaBlock({ planningId, suggestionId, blockId: block.id, decision, strategy: decision === "editado" ? strategy : undefined, principles: decision === "editado" ? principles : undefined, includeCriterion, reason, confirmStale });
      setResult(outcome);
      if (outcome.ok) {
        justDecided.current = true;
        router.refresh();
      }
    });
  }

  const decided = block.decision !== "pendente";
  const highlight = block.flags.changesObjective || block.flags.changesCriterion || block.flags.individual;
  return (
    <li className={`min-w-0 rounded-xl border p-3 sm:p-4 ${block.flags.blocked ? "border-coral/40 bg-coral-soft/30" : highlight ? "border-amber-800/30 bg-amber-soft/30" : "border-line bg-paper"}`}>
      <p className="text-sm font-medium text-ink">Bloco {index + 1}</p>
      {block.flags.changesObjective ? (
        <p className="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber-900"><strong className="font-medium">Altera o objetivo:</strong> “{block.objectiveConsidered}”. O objetivo do planejamento não muda ao aceitar; se quiser usar esta formulação, edite-o na etapa 1.</p>
      ) : null}
      {block.flags.changesCriterion && block.criterionProposal ? (
        <p className="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber-900"><strong className="font-medium">Propõe critério novo:</strong> “{block.criterionProposal}”. Só entra se você marcar ao aceitar.</p>
      ) : null}
      {block.flags.individual ? <p className="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber-900"><strong className="font-medium">Altera um apoio individual:</strong> ao aceitar, o texto entra no apoio e ele volta para rascunho até nova validação.</p> : null}
      {block.flags.problems.length ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-coral">
          {block.flags.problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      ) : null}

      <dl className="mt-3 grid gap-2 text-sm">
        <div><dt className="font-medium text-ink">Barreira considerada</dt><dd className="text-ink-soft">{block.barrierConsidered.text || "Não informada"}{block.barrierConsidered.hypothesis ? ` (${BARRIER_STATUS_LABEL.hipotese.toLowerCase()})` : ""}</dd></div>
        <div><dt className="font-medium text-ink">Estratégia proposta</dt><dd className="text-ink">{block.strategy}</dd></div>
        <div><dt className="font-medium text-ink">Princípio relacionado</dt><dd className="text-ink-soft">{block.principles.map((principle) => PRINCIPLE_LABEL[principle]).join(", ") || "Não indicado"}</dd></div>
        <div><dt className="font-medium text-ink">Justificativa pedagógica</dt><dd className="text-ink-soft">{block.justification || "—"}</dd></div>
        {block.resources.length ? <div><dt className="font-medium text-ink">Recursos necessários</dt><dd className="text-ink-soft">{block.resources.join("; ")}</dd></div> : null}
        <div><dt className="font-medium text-ink">Evidência sugerida</dt><dd className="text-ink-soft">{block.suggestedEvidence || "—"}</dd></div>
        {block.pendingInformation.length ? <div><dt className="font-medium text-ink">Informações pendentes</dt><dd className="text-ink-soft">{block.pendingInformation.join("; ")}</dd></div> : null}
      </dl>

      {decided ? (
        <p ref={decisionRef} tabIndex={-1} className="mt-3 text-sm text-ink outline-none">
          <Badge tone={block.decision === "recusado" ? "neutral" : "green"}>{AI_BLOCK_DECISION_LABEL[block.decision]}</Badge>{" "}
          <span className="text-ink-soft">por {block.decidedBy?.name} em {block.decidedAt ? new Date(block.decidedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}{block.reason ? ` · motivo: ${block.reason}` : ""}</span>
        </p>
      ) : canDecide ? (
        <div className="mt-4 grid gap-3">
          {stale && !block.flags.blocked ? (
            <label className="flex min-h-11 items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" checked={confirmStale} onChange={(event) => setConfirmStale(event.target.checked)} />
              Conferi: este bloco ainda faz sentido com o objetivo, os critérios e as barreiras atuais.
            </label>
          ) : null}
          {block.criterionProposal && !block.flags.blocked ? (
            <label className="flex min-h-11 items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" checked={includeCriterion} onChange={(event) => setIncludeCriterion(event.target.checked)} />
              Incluir o critério proposto no planejamento
            </label>
          ) : null}
          {mode === "editar" ? (
            <div className="grid gap-3 rounded-xl bg-surface-muted/60 p-3">
              <div>
                <label htmlFor={`${base}-texto`} className={labelCls}>Estratégia, com a sua edição</label>
                <textarea id={`${base}-texto`} className={textareaCls} value={strategy} maxLength={1200} onChange={(event) => setStrategy(event.target.value)} />
              </div>
              <fieldset>
                <legend className={labelCls}>Princípio(s)</legend>
                <div className="flex flex-wrap gap-x-5">
                  {DUA_PRINCIPLES.map((principle) => (
                    <label key={principle} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                      <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={principles.includes(principle)} onChange={(event) => setPrinciples((list) => (event.target.checked ? [...new Set([...list, principle])] : list.filter((item) => item !== principle)))} />
                      {PRINCIPLE_LABEL[principle]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending || (stale && !confirmStale)} onClick={() => decide("editado")} className={buttonCls}><Check size={16} aria-hidden /> Aceitar com esta edição</button>
                <button type="button" onClick={() => setMode("ver")} className={secondaryCls}>Cancelar edição</button>
              </div>
            </div>
          ) : mode === "recusar" ? (
            <div className="grid gap-3 rounded-xl bg-surface-muted/60 p-3">
              <div>
                <label htmlFor={`${base}-motivo`} className={labelCls}>Motivo da recusa (opcional)</label>
                <input id={`${base}-motivo`} className={inputCls} value={reason} maxLength={600} onChange={(event) => setReason(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={() => decide("recusado")} className={dangerCls}><X size={16} aria-hidden /> Confirmar recusa</button>
                <button type="button" onClick={() => setMode("ver")} className={secondaryCls}>Voltar</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {block.flags.blocked ? (
                <p className="w-full text-sm text-coral">Barrado pelas verificações: este bloco só pode ser recusado.</p>
              ) : (
                <>
                  <button type="button" disabled={pending || (stale && !confirmStale)} onClick={() => decide("aceito")} className={buttonCls}><Check size={16} aria-hidden /> Aceitar no rascunho</button>
                  <button type="button" disabled={pending} onClick={() => setMode("editar")} className={secondaryCls}><Pencil size={16} aria-hidden /> Editar e aceitar</button>
                </>
              )}
              <button type="button" disabled={pending} onClick={() => setMode("recusar")} className={dangerCls}><X size={16} aria-hidden /> Recusar</button>
            </div>
          )}
          <ResultMessage result={result && !result.ok ? result : null} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">{AI_BLOCK_DECISION_LABEL.pendente}.</p>
      )}
    </li>
  );
}
