"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { SUPPORT_LEVELS, ROLES } from "@/lib/scale";
import { RECOMMENDATION_OPTIONS, WHAT_WORKED_OPTIONS } from "@/lib/form-options";
import { VoiceNote } from "@/components/voice-note";
import { ChoiceField, MultiChoiceField } from "@/components/choice-field";

const inputCls = "min-h-12 w-full rounded-xl border border-line bg-paper px-3 py-3 text-sm text-ink";
const labelCls = "mb-2 block text-sm font-medium text-ink";
const choiceCls = "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper px-3 py-3 text-sm text-ink has-checked:border-brand has-checked:bg-brand-soft";

const participationChoices = [
  ["total", "Participou de toda a atividade"],
  ["parcial", "Participou de parte da atividade"],
  ["recusou", "Recusou participar"],
];
const criterionChoices = [
  ["sim", "Sim, realizou o que era esperado"],
  ["parcial", "Realizou uma parte"],
  ["nao", "Ainda não realizou o esperado"],
];
const roleOptions = Object.entries(ROLES).filter(([value]) => value !== "familia").map(([value, label]) => ({ value, label }));

export function DiaryForm({
  saveAction, studentId, objectives, activities, initialActivityId, initialObjectiveId,
}: {
  saveAction: (formData: FormData) => Promise<void>;
  studentId: string;
  objectives: { id: string; action: string; criterion: string }[];
  activities: { id: string; title: string }[];
  initialActivityId: string;
  initialObjectiveId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const submitting = useRef(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<"saved" | "error" | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [objectiveId, setObjectiveId] = useState(initialObjectiveId);
  const [activityId, setActivityId] = useState(initialActivityId);
  const selectedObjective = objectives.find((objective) => objective.id === objectiveId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const formData = new FormData(event.currentTarget);
    submitting.current = true;
    setResult(null);
    startTransition(async () => {
      try {
        await saveAction(formData);
        formRef.current?.reset();
        setObjectiveId("");
        setActivityId("");
        setSavedCount((count) => count + 1);
        setResult("saved");
      } catch {
        setResult("error");
      } finally {
        submitting.current = false;
        requestAnimationFrame(() => statusRef.current?.focus());
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} onChange={() => setResult(null)} aria-busy={pending} className="space-y-6">
      <p className="text-sm leading-relaxed text-ink-soft">
        Conte como foi a aula ou o atendimento. Os campos marcados como obrigatórios precisam de uma resposta.
      </p>
      <fieldset disabled={pending} className="space-y-6 disabled:opacity-65">
        <section aria-labelledby="diary-step-1" className="space-y-4 rounded-2xl bg-surface-muted/60 p-4 sm:p-5">
          <h3 id="diary-step-1" className="flex items-center gap-3 text-base font-semibold text-ink">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">1</span>
            O que foi trabalhado
          </h3>
          <div>
            <label htmlFor="objectiveId" className={labelCls}>Objetivo do plano (opcional)</label>
            <select id="objectiveId" name="objectiveId" value={objectiveId} onChange={(event) => setObjectiveId(event.target.value)} className={inputCls}>
              <option value="">Sem objetivo do plano neste registro</option>
              {objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.action}</option>)}
            </select>
            {objectives.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">
                Ainda não há um objetivo ativo. Você pode registrar a aula agora e <Link href={`/estudantes/${studentId}/ppi`} className="font-medium text-brand-strong underline underline-offset-4">preparar o plano depois</Link>.
              </p>
            ) : null}
          </div>
          {activities.length > 0 ? (
            <div>
              <label htmlFor="activityId" className={labelCls}>Atividade usada (opcional)</label>
              <select id="activityId" name="activityId" value={activityId} onChange={(event) => setActivityId(event.target.value)} className={inputCls} aria-describedby="activity-help">
                <option value="">Outra atividade ou sem atividade selecionada</option>
                {activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
              </select>
              <p id="activity-help" className="mt-2 text-sm text-ink-soft">Se escolher uma atividade, ela será marcada como realizada ao salvar.</p>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="diary-step-2" className="space-y-4 rounded-2xl border border-line p-4 sm:p-5">
          <h3 id="diary-step-2" className="flex items-center gap-3 text-base font-semibold text-ink">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">2</span>
            Como o estudante participou
          </h3>
          <fieldset>
            <legend className={labelCls}>Participação (obrigatório)</legend>
            <div className="grid gap-2">
              {participationChoices.map(([value, label]) => (
                <label key={value} className={choiceCls}>
                  <input type="radio" name="participation" value={value} required className="size-4 shrink-0 accent-[var(--brand)]" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="supportLevel" className={labelCls}>Quanto apoio foi necessário? (obrigatório)</label>
            <select id="supportLevel" name="supportLevel" defaultValue="" required className={inputCls}>
              <option value="" disabled>Escolha o apoio que o estudante precisou</option>
              {SUPPORT_LEVELS.map((level) => <option key={level.level} value={level.level}>{level.description}</option>)}
            </select>
          </div>
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
          <fieldset>
            <legend className={labelCls}>Conseguiu realizar o que era esperado? (obrigatório)</legend>
            <div className="grid gap-2">
              {criterionChoices.map(([value, label]) => (
                <label key={value} className={choiceCls}>
                  <input type="radio" name="criterionMet" value={value} required className="size-4 shrink-0 accent-[var(--brand)]" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <VoiceNote key={savedCount} name="note" label="Conte o que você observou (opcional)" placeholder="Ex.: reconheceu o próprio nome entre três opções com ajuda de imagens." />
          <p className="text-sm text-ink-soft">Pode escrever uma frase ou usar o botão Ditar texto. Leia o texto antes de salvar.</p>
        </section>

        <details className="rounded-2xl border border-line p-4 sm:p-5">
          <summary className="cursor-pointer py-1 text-sm font-semibold text-brand-strong">Adicionar mais detalhes (opcional)</summary>
          <div className="mt-4 space-y-6">
            <MultiChoiceField key={`worked-${savedCount}`} name="whatWorked" label="O que ajudou o estudante?" options={WHAT_WORKED_OPTIONS} legendClassName={labelCls} inputClassName={inputCls} />
            <MultiChoiceField key={`next-${savedCount}`} name="recommendation" label="O que tentar no próximo encontro?" options={RECOMMENDATION_OPTIONS} legendClassName={labelCls} inputClassName={inputCls} />
          </div>
        </details>

        <ChoiceField key={`role-${savedCount}`} name="authorRole" label="Seu papel neste registro (obrigatório)" options={roleOptions} required placeholder="Escolha seu papel" otherPlaceholder="Ex.: intérprete de Libras" labelClassName={labelCls} inputClassName={inputCls} />
      </fieldset>

      <div className="flex flex-col items-start gap-3 border-t border-line pt-5">
        <p ref={statusRef} tabIndex={-1} role={result === "error" ? "alert" : "status"} aria-live="polite" className={`text-sm leading-relaxed ${result === "error" ? "text-coral" : "text-brand-strong"}`}>
          {pending ? "Salvando seu registro…" : result === "saved" ? (
            <span className="flex items-start gap-2"><CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />Registro salvo. Ele já aparece no histórico abaixo.</span>
          ) : result === "error" ? "Não foi possível confirmar o salvamento. Suas respostas foram mantidas. Confira o histórico antes de tentar novamente." : "Depois de salvar, você poderá acompanhar este registro no histórico abaixo."}
        </p>
        <button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60 sm:w-auto">
          {pending ? <LoaderCircle size={18} className="animate-spin" aria-hidden /> : null}
          {pending ? "Salvando…" : "Salvar registro"}
        </button>
        {result === "saved" ? <a href="#historico-registros" className="inline-flex min-h-11 items-center text-sm font-medium text-brand-strong underline underline-offset-4">Ver registro no histórico</a> : null}
      </div>
    </form>
  );
}