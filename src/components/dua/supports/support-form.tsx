"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save } from "lucide-react";
import { createDuaSupport, updateDuaSupport } from "@/actions/dua";
import { BARRIER_STATUSES, BARRIER_STATUS_LABEL, type DuaSupportData } from "@/lib/dua/domain";
import { Field, ResultMessage, buttonCls, hintCls, inputCls, labelCls, textareaCls } from "../dua-ui";

// Formulário do apoio individual (RF04), para criar e para editar. As opções de
// perfil e de objetivos chegam já filtradas pelo servidor no recorte do estudante;
// a ação recebe só identificadores e confere tudo de novo ao gravar.

// Item do perfil que pode embasar o apoio. A data vem formatada do servidor.
export type ProfileOption = { field: string; label: string; value: string; source: string; dateLabel: string; version: string };
export type ObjectiveOption = { id: string; description: string; status: string };

export type Outcome = { ok: boolean; message?: string; problems?: { field: string; message: string }[] };

const OBJECTIVE_STATUS: Record<string, string> = { ativo: "ativo", alcancado: "alcançado", em_revisao: "em revisão" };

type Props = {
  planningId: string;
  student: { id: string; name: string };
  profileOptions: ProfileOption[];
  objectives: ObjectiveOption[];
  // Sem `existing`, o formulário cria um apoio novo.
  existing?: { id: string; revision: number; state: "rascunho" | "validado"; data: DuaSupportData };
};

export function SupportForm(props: Props) {
  const [result, setResult] = useState<Outcome | null>(null);
  const [round, setRound] = useState(0);
  // Na edição, o formulário recomeça a cada revisão salva no servidor: mostra o
  // texto atual (inclusive sugestões aceitas) e não grava por cima de mudanças.
  const formKey = props.existing ? `revisao-${props.existing.revision}` : `novo-${round}`;
  return (
    <div className="min-w-0">
      <SupportFields
        key={formKey}
        {...props}
        onResult={(outcome) => {
          setResult(outcome);
          if (outcome.ok && !props.existing) setRound((value) => value + 1);
        }}
      />
      <ResultMessage result={result} />
    </div>
  );
}

function SupportFields({ planningId, student, profileOptions, objectives, existing, onResult }: Props & { onResult: (outcome: Outcome) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const data = existing?.data;
  const [individualText, setIndividualText] = useState(data?.individualObjective?.text ?? "");
  const [showIndividual, setShowIndividual] = useState(Boolean(data?.individualObjective?.text));
  const prefix = existing ? `apoio-${existing.id}` : `novo-apoio-${student.id}`;

  const chosenRefs = new Map((data?.profileRefs ?? []).map((ref) => [ref.field, ref]));
  const linked = new Set((data?.planLinks ?? []).map((link) => link.objectiveId));
  // Referências que sumiram do perfil ou objetivos fora do plano ativo saem ao salvar.
  const goneRefs = (data?.profileRefs ?? []).filter((ref) => !profileOptions.some((option) => option.field === ref.field));
  const goneLinks = (data?.planLinks ?? []).filter((link) => !objectives.some((objective) => objective.id === link.objectiveId));
  const hasIndividual = individualText.trim().length > 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const text = (name: string) => String(form.get(name) ?? "");
    const justification = hasIndividual ? text("individualObjectiveJustification") : "";
    const individualObjectiveId = hasIndividual ? text("individualObjectiveId") : "";
    // Objetivo individual: explícito, justificado e ligado ao plano. Conferido aqui
    // para orientar logo; o servidor confere de novo ao validar.
    if (hasIndividual && (!justification.trim() || !individualObjectiveId)) {
      setShowIndividual(true);
      onResult({
        ok: false,
        message: "Complete o objetivo individual antes de salvar.",
        problems: [
          ...(!justification.trim() ? [{ field: "individualObjective.justification", message: "Explique por que o objetivo individual é diferente do coletivo." }] : []),
          ...(!individualObjectiveId ? [{ field: "individualObjective.objectiveId", message: "Escolha o objetivo do Plano de ensino ao qual ele se liga." }] : []),
        ],
      });
      return;
    }
    // O objetivo do plano escolhido para o objetivo individual também fica vinculado ao apoio.
    const objectiveIds = [...new Set([...form.getAll("objectiveIds").map(String), individualObjectiveId].filter(Boolean))];
    const fields = {
      barrierDescription: text("barrierDescription"),
      barrierStatus: text("barrierStatus") || "prevista",
      support: text("support"),
      purpose: text("purpose"),
      usageContext: text("usageContext"),
      profileFields: form.getAll("profileFields").map(String),
      objectiveIds,
      individualObjectiveText: individualText,
      individualObjectiveJustification: justification,
      individualObjectiveId,
    };
    start(async () => {
      const outcome = existing
        ? await updateDuaSupport({ planningId, studentId: student.id, supportId: existing.id, revision: existing.revision, ...fields })
        : await createDuaSupport({ planningId, studentId: student.id, ...fields });
      if (!outcome.ok) {
        onResult(outcome);
        return;
      }
      onResult({
        ok: true,
        message: existing
          ? existing.state === "validado"
            ? "Alterações salvas. O apoio voltou para rascunho e precisa ser validado de novo."
            : "Alterações salvas no rascunho do apoio."
          : `Apoio de ${student.name} salvo como rascunho. Ele aparece na lista de apoios planejados.`,
      });
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-5" aria-busy={pending}>
      <fieldset className="min-w-0">
        <legend className={labelCls}>O que do perfil embasa este apoio</legend>
        <p className={hintCls}>Marque só o que importa para esta atividade. Cada item guarda a fonte e a data consultadas. Diagnóstico e dados de saúde não aparecem aqui.</p>
        {profileOptions.length ? (
          <ul className="grid min-w-0 gap-1 sm:grid-cols-2">
            {profileOptions.map((option) => {
              const previous = chosenRefs.get(option.field);
              return (
                <li key={option.field} className="min-w-0">
                  <label className="flex min-h-11 items-start gap-2 rounded-lg p-2 text-sm text-ink hover:bg-surface-muted">
                    <input type="checkbox" name="profileFields" value={option.field} defaultChecked={Boolean(previous)} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
                    <span className="min-w-0 break-words">
                      <span className="font-medium">{option.label}:</span> {option.value}
                      <span className="mt-0.5 block text-xs text-ink-soft">{option.source} · {option.dateLabel}</span>
                      {previous && previous.version !== option.version ? <span className="mt-0.5 block text-xs text-amber-900">O perfil mudou depois da escolha. Ao salvar, vale a versão atual.</span> : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Ainda não há itens de Como aprende nem do estudo de caso de {student.name}. O apoio pode ser planejado assim mesmo.</p>
        )}
        {goneRefs.length ? <p className="mt-2 text-xs text-ink-soft">Não estão mais no perfil e saem ao salvar: {goneRefs.map((ref) => ref.label).join(", ")}.</p> : null}
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={labelCls}>Objetivos do Plano de ensino ligados a este apoio</legend>
        {objectives.length ? (
          <ul className="grid min-w-0 gap-1">
            {objectives.map((objective) => (
              <li key={objective.id} className="min-w-0">
                <label className="flex min-h-11 items-start gap-2 rounded-lg p-2 text-sm text-ink hover:bg-surface-muted">
                  <input type="checkbox" name="objectiveIds" value={objective.id} defaultChecked={linked.has(objective.id)} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
                  <span className="min-w-0 break-words">
                    {objective.description}
                    {objective.status !== "ativo" ? <span className="text-ink-soft"> ({OBJECTIVE_STATUS[objective.status] ?? objective.status})</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">{student.name} não tem objetivos no Plano de ensino ativo. O apoio pode ser planejado sem esse vínculo.</p>
        )}
        {goneLinks.length ? <p className="mt-2 text-xs text-ink-soft">Objetivos que não estão mais no plano ativo saem ao salvar: {goneLinks.map((link) => link.description).join("; ")}.</p> : null}
      </fieldset>

      <div className="grid min-w-0 gap-4 rounded-xl bg-surface-muted/60 p-3 sm:p-4">
        <Field id={`${prefix}-barreira`} label="Barreira nesta atividade" hint="Descreva a barreira na tarefa, no material ou no ambiente, e não no estudante.">
          <textarea id={`${prefix}-barreira`} name="barrierDescription" aria-describedby={`${prefix}-barreira-dica`} defaultValue={data?.barrier.description ?? ""} maxLength={600} className={`${textareaCls} min-h-16`} placeholder="Ex.: o enunciado só aparece por escrito, em um bloco longo" />
        </Field>
        <fieldset className="min-w-0">
          <legend className={labelCls}>Situação da barreira</legend>
          <div className="flex flex-wrap gap-x-5">
            {BARRIER_STATUSES.map((status) => (
              <label key={status} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input type="radio" name="barrierStatus" value={status} defaultChecked={(data?.barrier.status ?? "prevista") === status} className="size-4 accent-[var(--brand)]" />
                {BARRIER_STATUS_LABEL[status]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <Field id={`${prefix}-recurso`} label="Recurso ou intervenção planejada" required hint="O que será oferecido ao estudante nesta atividade.">
        <textarea id={`${prefix}-recurso`} name="support" aria-describedby={`${prefix}-recurso-dica`} defaultValue={data?.support ?? ""} maxLength={1200} className={textareaCls} placeholder="Ex.: enunciado em passos curtos, com leitura em voz alta pelo colega" />
      </Field>
      <Field id={`${prefix}-finalidade`} label="Finalidade do apoio" required hint="Para que o apoio serve nesta atividade.">
        <textarea id={`${prefix}-finalidade`} name="purpose" aria-describedby={`${prefix}-finalidade-dica`} defaultValue={data?.purpose ?? ""} maxLength={600} className={`${textareaCls} min-h-16`} placeholder="Ex.: compreender a proposta sem depender só da leitura" />
      </Field>
      <Field id={`${prefix}-uso`} label="Quando e onde usar" hint="Momento da atividade e espaço, como sala comum ou AEE.">
        <input id={`${prefix}-uso`} name="usageContext" aria-describedby={`${prefix}-uso-dica`} defaultValue={data?.usageContext ?? ""} maxLength={300} className={inputCls} placeholder="Ex.: na leitura do enunciado, na sala comum" />
      </Field>

      <details open={showIndividual} onToggle={(event) => setShowIndividual(event.currentTarget.open)} className="min-w-0 rounded-xl border border-line px-4">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-brand-strong">Objetivo individual diferente do coletivo (opcional)</summary>
        <div className="grid min-w-0 gap-4 pb-4">
          <p className="text-sm leading-relaxed text-ink-soft">Use só quando o estudante precisar de um objetivo diferente do da turma. Ele precisa ser explícito, justificado e ligado a um objetivo do Plano de ensino. Para retirar, apague o texto.</p>
          {!objectives.length && !hasIndividual ? (
            <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber-900">Sem objetivos no Plano de ensino ativo, não há como ligar um objetivo individual. Mantenha o objetivo da turma com apoios, ou defina antes o objetivo no plano.</p>
          ) : (
            <>
              <Field id={`${prefix}-objetivo`} label="Objetivo individual nesta atividade">
                <textarea id={`${prefix}-objetivo`} value={individualText} onChange={(event) => setIndividualText(event.target.value)} maxLength={600} className={`${textareaCls} min-h-16`} />
              </Field>
              <Field id={`${prefix}-justificativa`} label={hasIndividual ? "Justificativa (obrigatória)" : "Justificativa"} hint="Por que o objetivo da turma, com apoios, não atende este estudante nesta atividade.">
                <textarea id={`${prefix}-justificativa`} name="individualObjectiveJustification" aria-describedby={`${prefix}-justificativa-dica`} aria-required={hasIndividual} defaultValue={data?.individualObjective?.justification ?? ""} maxLength={600} className={`${textareaCls} min-h-16`} />
              </Field>
              <Field id={`${prefix}-vinculo`} label={hasIndividual ? "Objetivo do Plano de ensino ligado (obrigatório)" : "Objetivo do Plano de ensino ligado"} hint="Ele também fica marcado entre os objetivos ligados ao apoio.">
                <select id={`${prefix}-vinculo`} name="individualObjectiveId" aria-describedby={`${prefix}-vinculo-dica`} aria-required={hasIndividual} defaultValue={data?.individualObjective?.objectiveId ?? ""} className={inputCls}>
                  <option value="">Escolha o objetivo do plano</option>
                  {objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.description}</option>)}
                </select>
              </Field>
            </>
          )}
        </div>
      </details>

      <div>
        <button type="submit" disabled={pending} className={buttonCls}>
          {existing ? <Save size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
          {pending ? "Salvando…" : existing ? "Salvar alterações" : "Salvar apoio como rascunho"}
        </button>
      </div>
    </form>
  );
}
