import { Card } from "@/components/ui";
import { OriginBadge, ReviewBadge } from "@/components/dua/dua-ui";
import { SuggestionReview } from "@/components/dua/suggestion-review";
import type { SupportView } from "@/lib/dua/supports";
import type { SuggestionView } from "@/lib/dua/suggestions";
import { formatDate } from "@/lib/format";
import { SupportForm, type ObjectiveOption, type ProfileOption } from "./support-form";
import { SupportSummary } from "./support-summary";
import { StudentVoice } from "./student-voice";
import { ValidateSupport } from "./validate-support";

// Cartão de um apoio individual (RF04). Renderiza no servidor e junta as partes
// interativas: edição, validação, participação do estudante e sugestões.

type Props = {
  support: SupportView;
  // Opções do estudante para editar; só chegam quando a pessoa pode editar.
  options: { profileOptions: ProfileOption[]; objectives: ObjectiveOption[] } | null;
  suggestions: SuggestionView[];
  aiOn: boolean;
  today: string;
};

export function SupportCard({ support, options, suggestions, aiOn, today }: Props) {
  const headingId = `apoio-${support.id}-titulo`;
  return (
    <li id={`apoio-${support.id}`} className="min-w-0 scroll-mt-6">
      <Card className="min-w-0">
        <article aria-labelledby={headingId} className="grid min-w-0 gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 id={headingId} className="min-w-0 break-words text-base font-medium text-ink">{support.student.name}</h3>
              <div className="flex flex-wrap gap-1.5">
                <ReviewBadge state={support.state} />
                {support.data.origin ? <OriginBadge origin={support.data.origin} /> : null}
              </div>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Responsável: {support.responsibleName} · atualizado em {formatDate(support.updatedAt)}
              {support.state === "validado" && support.validatedByName && support.validatedAt ? ` · validado por ${support.validatedByName} em ${formatDate(support.validatedAt)}` : ""}
            </p>
          </div>

          <SupportSummary data={support.data} />

          {support.canValidate ? (
            <ValidateSupport planningId={support.planningId} studentId={support.student.id} supportId={support.id} revision={support.revision} validated={support.state === "validado"} />
          ) : null}

          {support.canEdit && options ? (
            <details className="min-w-0 rounded-xl border border-line px-4">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-brand-strong">Editar o apoio</summary>
              <div className="pb-4">
                {support.state === "validado" ? <p className="mb-4 rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber-900">Este apoio está validado. Salvar uma alteração devolve o apoio para rascunho, até nova validação.</p> : null}
                <SupportForm
                  planningId={support.planningId}
                  student={support.student}
                  profileOptions={options.profileOptions}
                  objectives={options.objectives}
                  existing={{ id: support.id, revision: support.revision, state: support.state, data: support.data }}
                />
              </div>
            </details>
          ) : null}

          <section aria-labelledby={`${headingId}-voz`} className="min-w-0 border-t border-line pt-4">
            <h4 id={`${headingId}-voz`} className="mb-1 text-sm font-medium text-ink">Participação do estudante</h4>
            <StudentVoice planningId={support.planningId} studentId={support.student.id} supportId={support.id} entries={support.data.studentVoice ?? []} canEdit={support.canEdit} today={today} />
          </section>

          {support.canEdit || suggestions.length ? (
            <SuggestionReview
              planningId={support.planningId}
              purpose="apoio_individual"
              supportId={support.id}
              profileRefs={support.data.profileRefs ?? []}
              suggestions={suggestions}
              canRequest={support.canEdit}
              canDecide={support.canEdit}
              aiOn={aiOn}
            />
          ) : null}
        </article>
      </Card>
    </li>
  );
}
