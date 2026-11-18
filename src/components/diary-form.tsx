"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type Ref } from "react";
import Link from "next/link";
import { ArrowRight, Check, LoaderCircle, Sprout } from "lucide-react";
import { CRITERION_MET, PARTICIPATION, SUPPORT_LEVELS } from "@/lib/scale";
import { roleLabel, rolesWith } from "@/lib/roles";
import { RECOMMENDATION_OPTIONS, WHAT_WORKED_OPTIONS } from "@/lib/form-options";
import { lessonOutcome, lessonProblems, missingAnswers, supportFromInput, type LessonOutcome, type SavedLesson } from "@/lib/lesson-log";
import { VoiceNote } from "@/components/voice-note";
import { ChoiceField, MultiChoiceField } from "@/components/choice-field";
import { Field, FieldError, FormResult, errorIdOf } from "@/components/form-kit";
import { BUTTON_CLS, inputCls, labelCls, choiceCls } from "@/components/form-styles";
import { SupportSteps } from "@/components/viz/support-steps";
import type { ActionResult } from "@/lib/action-result";

type Failure = Extract<ActionResult, { ok: false }>;

const participationChoices = Object.entries(PARTICIPATION).map(([value, term]) => [value, term.answer]);
const criterionChoices = Object.entries(CRITERION_MET).map(([value, term]) => [value, term.answer]);
const roleOptions = rolesWith("editRecord").map((value) => ({ value, label: roleLabel(value) }));
const NO_ANSWER = "Não foi possível confirmar o salvamento. Suas respostas foram mantidas. Confira o histórico antes de tentar novamente.";
const FIELD_IDS: Record<string, string> = {
  participation: `participation-${participationChoices[0][0]}`,
  supportLevel: "supportLevel",
  criterionMet: `criterionMet-${criterionChoices[0][0]}`,
  authorRole: "authorRole",
};
const invalidCls = "aria-invalid:border-coral";
const fieldName = (target: EventTarget) => (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement ? target.name : "");

export function DiaryForm({
  saveAction, studentId, studentName, objectives, activities, initialActivityId, initialObjectiveId, accountRole,
}: {
  saveAction: (formData: FormData) => Promise<ActionResult<SavedLesson>>;
  studentId: string;
  studentName: string;
  objectives: { id: string; label: string; criterion: string }[];
  activities: { id: string; title: string }[];
  initialActivityId: string;
  initialObjectiveId: string;
  accountRole: string;
}) {
  const savedRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [saved, setSaved] = useState<SavedLesson | null>(null);
  const problemOf = (field: string) => failure?.problems?.find((problem) => problem.field === field)?.message;
  const [objectiveId, setObjectiveId] = useState(initialObjectiveId);
  const [activityId, setActivityId] = useState(initialActivityId);
  const [authorRole, setAuthorRole] = useState(accountRole);
  const [choosingRole, setChoosingRole] = useState(!accountRole);
  const selectedObjective = objectives.find((objective) => objective.id === objectiveId);

  // O cartão entra numa transição: o foco vai para o título quando ele já está na página.
  useEffect(() => {
    if (!saved) return;
    savedRef.current?.focus({ preventScroll: true });
    savedRef.current?.closest("section")?.scrollIntoView({ block: "start" });
  }, [saved]);

  // O resumo de erros recebe o foco quando aparece (e não quando um erro é corrigido).
  const focusSummary = useRef(false);
  useEffect(() => {
    if (!failure || !focusSummary.current) return;
    focusSummary.current = false;
    summaryRef.current?.focus({ preventScroll: true });
    summaryRef.current?.scrollIntoView({ block: "start" });
  }, [failure]);

  function answered(field: string) {
    setFailure((current) => {
      if (!current?.problems?.length) return null;
      const problems = current.problems.filter((problem) => problem.field !== field);
      if (problems.length === current.problems.length) return current;
      return problems.length ? { ...current, message: missingAnswers(problems.length), problems } : null;
    });
  }

  function anotherLesson() {
    setSaved(null);
    setObjectiveId(initialObjectiveId);
    requestAnimationFrame(() => {
      const first = document.getElementById(objectives.length ? "objectiveId" : FIELD_IDS.participation);
      first?.focus({ preventScroll: true });
      first?.closest("section")?.scrollIntoView({ block: "start" });
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const formData = new FormData(event.currentTarget);
    const problems = lessonProblems({
      participation: String(formData.get("participation") ?? ""),
      supportLevel: supportFromInput(formData.get("supportLevel")),
      criterionMet: String(formData.get("criterionMet") ?? ""),
      authorRole: String(formData.get("authorRole") ?? ""),
    });
    if (problems.length) {
      focusSummary.current = true;
      setFailure({ ok: false, message: missingAnswers(problems.length), problems });
      return;
    }
    submitting.current = true;
    setFailure(null);
    startTransition(async () => {
      let outcome: ActionResult<SavedLesson>;
      try {
        outcome = await saveAction(formData);
      } catch {
        outcome = { ok: false, message: NO_ANSWER };
      }
      submitting.current = false;
      if (outcome.ok) {
        setActivityId("");
        setSaved(outcome.value);
      } else {
        focusSummary.current = true;
        setFailure(outcome);
      }
    });
  }

  if (saved) {
    const objective = objectives.find((item) => item.id === saved.objectiveId);
    return <SavedLessonCard headingRef={savedRef} saved={saved} objectiveLabel={objective?.label ?? null} studentId={studentId} studentName={studentName} onAnother={anotherLesson} />;
  }

  return (
    <form noValidate onSubmit={submit} onChange={(event) => answered(fieldName(event.target))} aria-busy={pending} className="space-y-6">
      {failure ? <FormResult ref={summaryRef} result={failure} fields={FIELD_IDS} /> : null}
      <fieldset disabled={pending} className="space-y-6 disabled:opacity-65">
        <section aria-labelledby="diary-step-1" className="space-y-4 rounded-2xl bg-surface-muted/60 p-4 sm:p-5">
          <h3 id="diary-step-1" className="flex items-center gap-3 text-base font-semibold text-ink">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">1</span>
            O que foi trabalhado
          </h3>
          {objectives.length ? (
            <Field id="objectiveId" label="Objetivo do plano" note="opcional">
              {(control) => (
                <select {...control} name="objectiveId" value={objectiveId} onChange={(event) => setObjectiveId(event.target.value)} className={inputCls}>
                  {objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.label}</option>)}
                  <option value="">Sem objetivo do plano neste registro</option>
                </select>
              )}
            </Field>
          ) : (
            <p className="text-sm leading-relaxed text-ink-soft">
              Ainda não há um objetivo ativo. Você pode registrar a aula agora e <Link href={`/estudantes/${studentId}/ppi`} className="font-medium text-brand-strong underline underline-offset-4">preparar o plano depois</Link>.
            </p>
          )}
          {activities.length > 0 ? (
            <Field id="activityId" label="Atividade usada" note="opcional" hint="Se escolher uma atividade, ela será marcada como realizada ao salvar.">
              {(control) => (
                <select {...control} name="activityId" value={activityId} onChange={(event) => setActivityId(event.target.value)} className={inputCls}>
                  <option value="">Outra atividade ou sem atividade selecionada</option>
                  {activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
                </select>
              )}
            </Field>
          ) : null}
        </section>

        <section aria-labelledby="diary-step-2" className="space-y-4 rounded-2xl border border-line p-4 sm:p-5">
          <h3 id="diary-step-2" className="flex items-center gap-3 text-base font-semibold text-ink">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">2</span>
            Como o estudante participou
          </h3>
          <ChoiceGroup name="participation" legend="Participação" note="obrigatório" choices={participationChoices} error={problemOf("participation")} />
          <Field id="supportLevel" label="Quanto apoio foi necessário?" note="obrigatório" error={problemOf("supportLevel")}>
            {(control) => (
              <select {...control} name="supportLevel" defaultValue="" required className={`${inputCls} ${invalidCls}`}>
                <option value="" disabled>Escolha o apoio que o estudante precisou</option>
                {SUPPORT_LEVELS.map((level) => <option key={level.level} value={level.level}>{level.description}</option>)}
              </select>
            )}
          </Field>
        </section>

        <section aria-labelledby="diary-step-3" className="space-y-4 rounded-2xl border border-line p-4 sm:p-5">
          <h3 id="diary-step-3" className="flex items-center gap-3 text-base font-semibold text-ink">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">3</span>
            O que aconteceu
          </h3>
          {selectedObjective?.criterion ? (
            <p className="rounded-xl bg-brand-soft p-3 text-sm leading-relaxed text-ink">
              <span className="font-medium">O que observar neste objetivo: </span>{selectedObjective.criterion}
            </p>
          ) : null}
          <ChoiceGroup name="criterionMet" legend="Conseguiu realizar o que era esperado?" note="obrigatório" choices={criterionChoices} error={problemOf("criterionMet")} />
          <VoiceNote name="note" label="Conte o que você observou (opcional)" placeholder="Ex.: reconheceu o próprio nome entre três opções com ajuda de imagens." />
        </section>

        <details className="rounded-2xl border border-line p-4 sm:p-5">
          <summary className="cursor-pointer py-1 text-sm font-semibold text-brand-strong">Adicionar mais detalhes (opcional)</summary>
          <div className="mt-4 space-y-6">
            <MultiChoiceField name="whatWorked" label="O que ajudou o estudante?" options={WHAT_WORKED_OPTIONS} />
            <MultiChoiceField name="recommendation" label="O que tentar no próximo encontro?" options={RECOMMENDATION_OPTIONS} />
          </div>
        </details>

        {choosingRole ? (
          <ChoiceField
            id={FIELD_IDS.authorRole}
            name="authorRole"
            label="Seu papel neste registro (obrigatório)"
            options={roleOptions}
            defaultValue={authorRole}
            required
            placeholder="Escolha seu papel"
            otherPlaceholder="Ex.: intérprete de Libras"
            inputClassName={`${inputCls} ${invalidCls}`}
            error={problemOf("authorRole")}
            onValueChange={(value) => {
              setAuthorRole(value);
              if (value) answered("authorRole");
            }}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-x-3">
            <p className="text-sm text-ink-soft">Seu papel neste registro: <span className="font-medium text-ink" data-papel={authorRole}>{roleLabel(authorRole)}</span></p>
            <button
              type="button"
              aria-label="Alterar o papel neste registro"
              onClick={() => {
                setChoosingRole(true);
                requestAnimationFrame(() => document.getElementById(FIELD_IDS.authorRole)?.focus());
              }}
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand-strong underline underline-offset-4"
            >
              Alterar
            </button>
            <input type="hidden" name="authorRole" value={authorRole} />
          </div>
        )}
      </fieldset>

      <div className="save-bar flex flex-col items-start gap-3 border-t border-line pt-5">
        <p role="status" aria-live="polite" className="text-sm leading-relaxed text-brand-strong">{pending ? "Salvando seu registro…" : null}</p>
        <button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60 sm:w-auto">
          {pending ? <LoaderCircle size={18} className="animate-spin" aria-hidden /> : null}
          {pending ? "Salvando…" : "Salvar registro"}
        </button>
      </div>
    </form>
  );
}

function SavedLessonCard({ headingRef, saved, objectiveLabel, studentId, studentName, onAnother }: {
  headingRef: Ref<HTMLHeadingElement>;
  saved: SavedLesson;
  objectiveLabel: string | null;
  studentId: string;
  studentName: string;
  onAnother: () => void;
}) {
  const outcome = saved.steps ? lessonOutcome(saved.steps) : null;
  return (
    <section aria-labelledby="registro-salvo" data-resultado-registro className="space-y-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-soft text-green"><Sprout size={20} className="sprout-mark" /></span>
        <div className="min-w-0">
          <h3 ref={headingRef} id="registro-salvo" tabIndex={-1} className="text-base font-semibold text-ink">Registro salvo</h3>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-soft [overflow-wrap:anywhere]">{objectiveLabel ?? "Sem objetivo do plano"}</p>
        </div>
      </div>
      {saved.steps ? (
        <div className="min-w-0 rounded-2xl border border-line p-4 sm:p-5">
          <SupportSteps data={saved.steps} size="regular" highlightLast name={objectiveLabel ?? undefined} />
          {outcome ? <OutcomeLine outcome={outcome} /> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link href="/estudantes?acao=registrar" className={BUTTON_CLS.primary}>Registrar outro estudante</Link>
        <button type="button" onClick={onAnother} className={BUTTON_CLS.secondary}>Outra aula de {studentName}</button>
        <Link href={`/estudantes/${studentId}/linha-do-tempo`} className={BUTTON_CLS.quiet}>Ver evolução</Link>
      </div>
    </section>
  );
}

function OutcomeLine({ outcome }: { outcome: LessonOutcome }) {
  if (outcome.reached) {
    return (
      <p data-resultado-frase className="mt-4 flex items-start gap-2 text-base font-medium text-green">
        <Check size={18} aria-hidden className="mt-0.5 shrink-0" />
        <span>Meta alcançada!{outcome.streak > 1 ? <span className="font-normal text-ink"> {outcome.level}, {outcome.note}.</span> : null}</span>
      </p>
    );
  }
  return (
    <p data-resultado-frase className="mt-4 text-base text-ink">
      <span className="font-medium">{outcome.level}</span>
      {outcome.goal ? <> <ArrowRight size={16} aria-hidden className="inline-block align-[-3px] text-ink-soft" /><span className="sr-only">rumo à</span> meta {outcome.goal}</> : null}
      {outcome.note ? `: ${outcome.note}` : ""}.
    </p>
  );
}

function ChoiceGroup({ name, legend, note, choices, error }: { name: string; legend: string; note: string; choices: string[][]; error?: string }) {
  const errorId = errorIdOf(name);
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className={labelCls}>{legend}<span className="font-normal text-ink-soft"> ({note})</span></legend>
      <div className="grid gap-2">
        {choices.map(([value, label]) => (
          <label key={value} className={choiceCls}>
            <input id={`${name}-${value}`} type="radio" name={name} value={value} required className="size-4 shrink-0 accent-[var(--brand)]" />
            {label}
          </label>
        ))}
      </div>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </fieldset>
  );
}
