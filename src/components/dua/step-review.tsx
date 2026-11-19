"use client";

import Link from "next/link";
import { CircleCheck, Send, Share2, Undo2 } from "lucide-react";
import { returnDuaToDraft, setDuaSharing, submitDuaForReview, validateDuaVersion } from "@/actions/dua";
import type { ActionResult } from "@/lib/action-result";
import { PRINCIPLE_LABEL, SHARING, strategiesWithoutBarrier, validationProblems, type ReviewState } from "@/lib/dua/domain";
import { labelOf } from "@/lib/scale";
import type { PlanningAccess } from "@/lib/dua/access";
import { Field, FormResult } from "@/components/form-kit";
import { BUTTON_CLS, linkCls, textareaCls } from "@/components/form-styles";
import { useActionResult } from "@/components/use-action-result";
import { OriginBadge, ReviewBadge } from "./badges";
import { ContentSummary } from "./content-summary";
import { stepOfField, type StepProps } from "./editor-steps";

export function StepReview({ content, update, readOnly, planningId, access, version, state, sharing, hasValidated, ownerName, flush, revision, goTo }: StepProps & {
  planningId: string; access: PlanningAccess; version: number; state: ReviewState; sharing: string; hasValidated: boolean; ownerName: string;
  flush: () => Promise<void>; revision: () => number; goTo: (step: number) => void;
}) {
  const { result, pending, submit } = useActionResult();
  const problems = validationProblems(content);
  const withoutBarrier = strategiesWithoutBarrier(content);
  const barrierText = new Map(content.barriers.map((item, index) => [item.id, `${index + 1}. ${item.description}`]));
  const criterionText = new Map(content.criteria.map((item, index) => [item.id, `${index + 1}. ${item.description}`]));

  function act(action: () => Promise<ActionResult>, success: string) {
    submit(async () => {
      await flush();
      return action();
    }, { message: success });
  }
  const ref = () => ({ planningId, version, revision: revision() });

  return (
    <div className="mt-4 grid min-w-0 gap-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
        <span>Versão {version}</span> <ReviewBadge state={state} /> <span>· responsável: {ownerName}</span>
      </div>

      {problems.length ? (
        <div className="rounded-xl bg-amber-soft p-4 text-sm text-amber">
          <p className="font-medium">Para validar, ainda falta:</p>
          <ul className="mt-2 grid gap-1">
            {problems.map((problem) => (
              <li key={`${problem.field}-${problem.message}`}>
                <button type="button" onClick={() => goTo(stepOfField(problem.field))} className="min-h-11 text-left underline underline-offset-4">{problem.message}</button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-xl bg-green-soft p-4 text-sm text-green">O planejamento tem o necessário para ser validado: objetivo, barreiras, opções e critérios observáveis.</p>
      )}
      {withoutBarrier.length ? <p className="text-sm text-ink-soft">Atenção: {withoutBarrier.length} opção(ões) ainda não dizem a qual barreira respondem. Isso não impede validar, mas ajuda quem vai aplicar.</p> : null}

      <section aria-labelledby="sintese-titulo" className="grid min-w-0 gap-4">
        <h3 id="sintese-titulo" className="text-sm font-medium text-ink">Síntese do planejamento</h3>
        <ContentSummary content={content}>
          {content.context.organization || content.context.resources.length ? <div className="min-w-0"><dt className="font-medium text-ink">Organização e recursos</dt><dd className="break-words text-ink-soft">{[content.context.organization, content.context.resources.join(", ")].filter(Boolean).join(" · ")}</dd></div> : null}
        </ContentSummary>
        <ol className="grid gap-3">
          {content.strategies.map((strategy, index) => (
            <li key={strategy.id} className="min-w-0 rounded-xl border border-line bg-paper-raised p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-ink">Opção {index + 1}: {strategy.description || "sem descrição"}</span><OriginBadge origin={strategy.origin} /></div>
              <p className="mt-1 text-ink-soft">Princípio: {strategy.principles.map((item) => PRINCIPLE_LABEL[item]).join(", ") || "não indicado"}</p>
              <p className="text-ink-soft">Responde a: {strategy.barrierIds.map((id) => barrierText.get(id)).filter(Boolean).join("; ") || "nenhuma barreira relacionada"}</p>
              <p className="text-ink-soft">Ajuda a observar: {strategy.criterionIds.map((id) => criterionText.get(id)).filter(Boolean).join("; ") || "nenhum critério relacionado"}</p>
              {strategy.resources.length ? <p className="text-ink-soft">Recursos: {strategy.resources.join(", ")}</p> : null}
            </li>
          ))}
        </ol>
        <Field id="dua-acompanhamento" label="Como a equipe vai acompanhar" hint="Quem observa, em que momentos e como os registros serão feitos.">
          {(control) => <textarea {...control} className={textareaCls} value={content.followUp} readOnly={readOnly} maxLength={2000} onChange={(event) => update({ ...content, followUp: event.target.value })} />}
        </Field>
        <p className="text-sm text-ink-soft">Materiais e apoios individuais ficam nas abas <Link href={`/planejamento/${planningId}/materiais`} className={linkCls}>Materiais</Link> e <Link href={`/planejamento/${planningId}/apoios`} className={linkCls}>Apoios individuais</Link>.</p>
      </section>

      <section aria-labelledby="decisoes-titulo" className="grid min-w-0 gap-3 rounded-2xl bg-surface-muted/60 p-4">
        <h3 id="decisoes-titulo" className="text-sm font-medium text-ink">Decisões sobre esta versão</h3>
        <p className="text-sm leading-relaxed text-ink-soft">Aceitar sugestões só muda o rascunho. <strong className="font-medium text-ink">Validar para aplicação</strong> é a decisão pedagógica final: fica registrada com quem validou, a data e a versão, e a versão deixa de mudar. Validar não altera matrícula, classificação nem dados do Censo.</p>
        <div className="flex flex-wrap gap-2">
          {access.edit && state === "rascunho" ? (
            <button type="button" disabled={pending} onClick={() => act(() => submitDuaForReview(ref()), "Enviado para revisão.")} className={BUTTON_CLS.quiet}><Send size={16} aria-hidden /> Enviar para revisão</button>
          ) : null}
          {access.edit && state === "em_revisao" ? (
            <button type="button" disabled={pending} onClick={() => act(() => returnDuaToDraft(ref()), "A versão voltou para rascunho.")} className={BUTTON_CLS.quiet}><Undo2 size={16} aria-hidden /> Voltar para rascunho</button>
          ) : null}
          {access.validate && state !== "validado" ? (
            <button type="button" disabled={pending} onClick={() => act(() => validateDuaVersion(ref()), `Versão ${version} validada para aplicação.`)} className={BUTTON_CLS.primary}><CircleCheck size={16} aria-hidden /> Validar para aplicação</button>
          ) : null}
          {!access.validate && state !== "validado" ? <p className="text-sm text-ink-soft">A validação é feita por professor(a) responsável ou pela coordenação.</p> : null}
        </div>
        {access.share ? (
          <div className="mt-2 grid gap-2 border-t border-line pt-3">
            <p className="text-sm text-ink"><span className="font-medium">Compartilhamento:</span> {labelOf(SHARING, sharing)}</p>
            <p className="text-sm leading-relaxed text-ink-soft">Compartilhar é uma decisão separada da validação. Compartilhado, o planejamento pode ser lido e aplicado pela equipe da escola, sem edição. Apoios individuais e evidências nunca são compartilhados.</p>
            {sharing === "compartilhado" ? (
              <button type="button" disabled={pending} onClick={() => act(() => setDuaSharing({ planningId, sharing: "privado" }), "O planejamento deixou de ser compartilhado.")} className={`${BUTTON_CLS.quiet} justify-self-start`}><Share2 size={16} aria-hidden /> Deixar de compartilhar</button>
            ) : (
              <button type="button" disabled={pending || !hasValidated} onClick={() => act(() => setDuaSharing({ planningId, sharing: "compartilhado" }), "Compartilhado com a equipe da escola.")} className={`${BUTTON_CLS.quiet} justify-self-start`}><Share2 size={16} aria-hidden /> Compartilhar com a equipe da escola</button>
            )}
            {!hasValidated && sharing !== "compartilhado" ? <p className="text-sm text-ink-soft">Disponível depois da primeira validação.</p> : null}
          </div>
        ) : null}
        <FormResult result={result} />
      </section>
    </div>
  );
}
