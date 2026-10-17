"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { registerDuaEvidence } from "@/actions/dua";
import { CRITERION_STATUSES, CRITERION_STATUS_LABEL, type CriterionStatus } from "@/lib/dua/domain";
import { Field, ResultMessage, buttonCls, hintCls, inputCls, labelCls, textareaCls } from "../dua-ui";

type Feedback = { ok: boolean; message?: string; problems?: { field: string; message: string }[] } | null;

export type EvidenceDefaults = {
  date: string;
  statuses: Record<string, CriterionStatus>;
  optionIds: string[];
  participationForm: string;
  studentChoice: string;
  supportProvided: string;
  observedResponse: string;
  remainingBarriers: string;
  nextStep: string;
};

const TEXT_FIELDS: Array<{ key: keyof Omit<EvidenceDefaults, "date" | "statuses" | "optionIds">; label: string; hint?: string; max: number }> = [
  { key: "participationForm", label: "Forma de participação", hint: "Como participou: falando, apontando, escrevendo, em dupla…", max: 600 },
  { key: "studentChoice", label: "Escolha ou manifestação do estudante", hint: "O que escolheu, disse ou mostrou nesta atividade.", max: 600 },
  { key: "supportProvided", label: "Apoio oferecido", hint: "O apoio que esteve de fato disponível.", max: 600 },
  { key: "observedResponse", label: "Resposta observada", max: 1200 },
  { key: "remainingBarriers", label: "Barreiras que permaneceram", hint: "Da tarefa, do material ou da organização — não do estudante.", max: 600 },
  { key: "nextStep", label: "Próximo passo sugerido pelo profissional", max: 600 },
];

// Registro rápido depois da atividade (RF07). Um registro por estudante e
// aplicação: registrar de novo atualiza o mesmo, sem duplicar.
export function EvidenceForm({ planningId, applicationId, student, criteria, strategies, defaults, existing }: {
  planningId: string;
  applicationId: string;
  student: { id: string; name: string };
  criteria: { id: string; description: string }[];
  strategies: { id: string; description: string }[];
  defaults: EvidenceDefaults;
  existing: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const prefix = `ev-${applicationId}-${student.id}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? "");
    start(async () => {
      const outcome = await registerDuaEvidence({
        planningId,
        applicationId,
        studentId: student.id,
        date: field("date"),
        criteria: criteria.map((item) => ({ criterionId: item.id, status: String(data.get(`criterio-${item.id}`) ?? "nao_registrado") })),
        optionsOffered: data.getAll("options").map(String),
        participationForm: field("participationForm"),
        studentChoice: field("studentChoice"),
        supportProvided: field("supportProvided"),
        observedResponse: field("observedResponse"),
        remainingBarriers: field("remainingBarriers"),
        nextStep: field("nextStep"),
      });
      setFeedback(outcome.ok ? { ok: true, message: `Registro de ${student.name} salvo.` } : outcome);
      if (outcome.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-4">
      <p className="rounded-xl bg-sky-soft px-3 py-2 text-sm leading-relaxed text-sky-ink">
        O registro deve corresponder a uma observação real desta aplicação, com a data em que foi feita. Ele fica com o seu nome como autor{existing ? " e substitui o registro anterior deste estudante nesta aplicação" : ""}.
      </p>
      <div className="max-w-xs">
        <Field id={`${prefix}-data`} label="Data da observação">
          <input id={`${prefix}-data`} name="date" type="date" defaultValue={defaults.date} className={inputCls} />
        </Field>
      </div>

      {criteria.length ? (
        <div className="grid min-w-0 gap-3">
          <p className="text-xs leading-relaxed text-ink-soft">
            “Não houve oportunidade de observar” e “Ainda não registrado” não são “Ainda não demonstrou”: não contam como resultado nem como conclusão sobre a aprendizagem.
          </p>
          {criteria.map((criterion, index) => (
            <div key={criterion.id} className="min-w-0 rounded-xl border border-line bg-paper p-3">
              <fieldset className="min-w-0">
                <legend className="mb-1 text-sm font-medium text-ink">Critério {index + 1}: {criterion.description || "sem descrição"}</legend>
                <div className="grid min-w-0 gap-x-4 sm:grid-cols-2">
                  {CRITERION_STATUSES.map((status) => (
                    <label key={status} className="flex min-h-11 min-w-0 items-center gap-2 text-sm text-ink">
                      <input type="radio" name={`criterio-${criterion.id}`} value={status} defaultChecked={(defaults.statuses[criterion.id] ?? "nao_registrado") === status} className="size-4 shrink-0 accent-[var(--brand)]" />
                      <span className="min-w-0">{CRITERION_STATUS_LABEL[status]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-ink-soft">A versão aplicada não tem critérios observáveis registrados.</p>}

      {strategies.length ? (
        <fieldset className="min-w-0">
          <legend className={labelCls}>Opções efetivamente oferecidas</legend>
          <p className={hintCls}>Marque só o que esteve disponível nesta aplicação.</p>
          <ul className="grid min-w-0 gap-1">
            {strategies.map((strategy, index) => (
              <li key={strategy.id} className="min-w-0">
                <label className="flex min-h-11 min-w-0 items-start gap-2 py-1 text-sm text-ink">
                  <input type="checkbox" name="options" value={strategy.id} defaultChecked={defaults.optionIds.includes(strategy.id)} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
                  <span className="min-w-0 break-words">Opção {index + 1}: {strategy.description || "sem descrição"}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {TEXT_FIELDS.map((item) => (
          <Field key={item.key} id={`${prefix}-${item.key}`} label={item.label} hint={item.hint}>
            <textarea id={`${prefix}-${item.key}`} name={item.key} defaultValue={defaults[item.key]} maxLength={item.max} className={textareaCls} aria-describedby={item.hint ? `${prefix}-${item.key}-dica` : undefined} />
          </Field>
        ))}
      </div>

      <div>
        <button type="submit" disabled={pending} aria-busy={pending} className={buttonCls}>
          <ClipboardCheck size={16} aria-hidden /> {pending ? "Salvando…" : existing ? "Atualizar o registro" : "Registrar a evidência"}
        </button>
        <ResultMessage result={feedback} />
      </div>
    </form>
  );
}
