import Form from "next/form";
import Link from "next/link";
import { ArrowRight, BadgeCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { planningContext } from "@/lib/page-context";
import { isAIEnabled } from "@/lib/agents/capabilities";
import { studentsInReach } from "@/lib/dua/shared";
import { listSuggestions } from "@/lib/dua/suggestions";
import { listSupports, planObjectives, profileReferences } from "@/lib/dua/supports";
import { brDay, formatDate } from "@/lib/dates";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { Field } from "@/components/form-kit";
import { BUTTON_CLS, inputCls, linkCls } from "@/components/form-styles";
import { SupportCard } from "@/components/dua/supports/support-card";
import { SupportForm, type ObjectiveOption, type ProfileOption } from "@/components/dua/supports/support-form";
import { Assurances, HowToRead } from "@/components/explain";
import { param, type SearchParams } from "@/lib/search-params";

type StudentOptions = { profileOptions: ProfileOption[]; objectives: ObjectiveOption[] };


async function optionsFor(user: SessionUser, studentId: string): Promise<StudentOptions> {
  const [refs, objectives] = await Promise.all([profileReferences(user, studentId), planObjectives(user, studentId)]);
  return {
    profileOptions: refs.map((ref) => ({ field: ref.field, label: ref.label, value: ref.value, source: ref.source, version: ref.version, dateLabel: ref.updatedAt ? formatDate(ref.updatedAt) : "sem data" })),
    objectives: objectives.map((objective) => ({ id: objective.id, description: objective.description, status: objective.status })),
  };
}

export default async function SupportsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { user, planning } = await planningContext(id);
  const wanted = param(query.estudante);
  const [supports, suggestions, everyone] = await Promise.all([listSupports(user, id), listSuggestions(user, id), studentsInReach(user)]);
  const selected = everyone.find((student) => student.id === wanted) ?? null;
  const studentIds = [...new Set([...supports.filter((support) => support.canEdit).map((support) => support.student.id), ...(selected ? [selected.id] : [])])];
  const options = new Map(await Promise.all(studentIds.map(async (studentId) => [studentId, await optionsFor(user, studentId)] as const)));

  const className = planning.className;
  const classmates = className ? everyone.filter((student) => student.className === className) : everyone;
  const showAll = !className || param(query.todos) === "1" || Boolean(selected && selected.className !== className);
  const choices = showAll ? everyone : classmates;
  const base = `/planejamento/${id}/apoios`;
  const selectedOptions = selected ? options.get(selected.id) ?? null : null;
  const selectedCount = selected ? supports.filter((support) => support.student.id === selected.id).length : 0;
  const aiOn = isAIEnabled();
  const today = brDay();

  return (
    <div className="grid min-w-0 gap-6">
      <section aria-labelledby="apoios-titulo" className="min-w-0">
        <h2 id="apoios-titulo" className="mb-3 font-display text-xl font-medium text-ink">Apoios individuais desta atividade</h2>
        <Assurances
          label="Como o apoio individual é tratado"
          items={[
            { icon: LockKeyhole, text: "Só quem acompanha o estudante vê" },
            { icon: ShieldCheck, text: "Não muda perfil nem Plano de ensino" },
            { icon: BadgeCheck, text: "Não muda matrícula nem classificação" },
          ]}
        />
        <HowToRead summary="O que é um apoio individual" className="mt-1">
          Liga esta atividade às necessidades e potencialidades de um estudante. Validar confirma o que foi planejado para a atividade, sem mudar a classificação na educação especial. Para mudar o perfil (Como aprende) ou o Plano de ensino, use as páginas do próprio estudante.
        </HowToRead>
      </section>

      <Card className="min-w-0">
        <SectionTitle>Planejar um apoio</SectionTitle>
        {everyone.length ? (
          <>
            {choices.length ? (
              <Form action={base} scroll={false} className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                {showAll && className ? <input type="hidden" name="todos" value="1" /> : null}
                <Field id="apoio-estudante" label={showAll ? "Estudante (todos os que você acompanha)" : `Estudante da turma ${className}`}>
                  {(control) => (
                    <select key={selected?.id ?? "nenhum"} {...control} name="estudante" required defaultValue={selected?.id ?? ""} className={inputCls}>
                      <option value="" disabled>Escolha o estudante</option>
                      {choices.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.gradeYear} ({student.className})</option>)}
                    </select>
                  )}
                </Field>
                <button type="submit" className={BUTTON_CLS.quiet}>
                  {selected ? "Trocar de estudante" : "Escolher estudante"} <ArrowRight size={16} aria-hidden />
                </button>
              </Form>
            ) : (
              <p className="text-sm text-ink-soft">Nenhum estudante da turma {className} está no seu acompanhamento.</p>
            )}
            {className ? (
              <p className="mt-2 text-sm">
                {showAll ? (
                  <Link href={selected && selected.className === className ? `${base}?estudante=${encodeURIComponent(selected.id)}` : base} scroll={false} className={`${linkCls} inline-flex min-h-11 items-center`}>Mostrar só a turma {className}</Link>
                ) : (
                  <Link href={`${base}?todos=1${selected ? `&estudante=${encodeURIComponent(selected.id)}` : ""}`} scroll={false} className={`${linkCls} inline-flex min-h-11 items-center`}>Ver todos os seus estudantes</Link>
                )}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-ink-soft">Nenhum estudante ativo no seu acompanhamento. Apoios são só para quem você acompanha.</p>
        )}

        {selected ? (
          <section aria-labelledby="novo-apoio-titulo" className="mt-5 min-w-0 border-t border-line pt-5">
            <h3 id="novo-apoio-titulo" className="text-base font-medium text-ink">Novo apoio para {selected.name}</h3>
            {selectedCount ? (
              <p className="mt-1 text-sm text-ink-soft">
                {selectedCount === 1 ? "Já há 1 apoio" : `Já há ${selectedCount} apoios`} para este estudante nesta atividade, na lista abaixo. Confira antes de criar outro.
              </p>
            ) : null}
            <div className="mt-4">
              {selectedOptions ? (
                <SupportForm key={selected.id} planningId={id} student={{ id: selected.id, name: selected.name }} profileOptions={selectedOptions.profileOptions} objectives={selectedOptions.objectives} />
              ) : (
                <p className="text-sm text-ink-soft">Não foi possível abrir os dados deste estudante. Atualize a página e tente de novo.</p>
              )}
            </div>
          </section>
        ) : null}
      </Card>

      <section aria-labelledby="apoios-lista" className="min-w-0">
        <h2 id="apoios-lista" className="mb-4 text-xl font-semibold text-ink">Apoios planejados</h2>
        {supports.length ? (
          <ol className="grid min-w-0 gap-4">
            {supports.map((support) => (
              <SupportCard
                key={support.id}
                support={support}
                options={support.canEdit ? options.get(support.student.id) ?? null : null}
                suggestions={suggestions.filter((suggestion) => suggestion.purpose === "apoio_individual" && suggestion.supportId === support.id)}
                aiOn={aiOn}
                today={today}
              />
            ))}
          </ol>
        ) : (
          <EmptyState character="planning" title="Nenhum apoio individual que você possa ver" hint="Escolha um estudante acima para planejar o apoio dele nesta atividade." />
        )}
      </section>
    </div>
  );
}
