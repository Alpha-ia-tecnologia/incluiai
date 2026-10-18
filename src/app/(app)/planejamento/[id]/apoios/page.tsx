import Form from "next/form";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { isAIEnabled } from "@/lib/agents/model";
import { DuaError, studentsInReach } from "@/lib/dua/shared";
import { loadPlanning } from "@/lib/dua/plannings";
import { listSuggestions } from "@/lib/dua/suggestions";
import { listSupports, planObjectives, profileReferences } from "@/lib/dua/supports";
import { formatDate } from "@/lib/format";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { Field, inputCls, linkCls, secondaryCls } from "@/components/dua/dua-ui";
import { SupportCard } from "@/components/dua/supports/support-card";
import { SupportForm, type ObjectiveOption, type ProfileOption } from "@/components/dua/supports/support-form";

export const dynamic = "force-dynamic";

type StudentOptions = { profileOptions: ProfileOption[]; objectives: ObjectiveOption[] };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

// Data local do servidor no formato do <input type="date">.
function todayInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Perfil e objetivos do estudante para o formulário. A camada de dados confere o
// recorte; fora dele, o formulário simplesmente não aparece.
async function optionsFor(user: SessionUser, studentId: string): Promise<StudentOptions | null> {
  try {
    const [refs, objectives] = await Promise.all([profileReferences(user, studentId), planObjectives(user, studentId)]);
    return {
      profileOptions: refs.map((ref) => ({ field: ref.field, label: ref.label, value: ref.value, source: ref.source, version: ref.version, dateLabel: ref.updatedAt ? formatDate(ref.updatedAt) : "sem data" })),
      objectives: objectives.map((objective) => ({ id: objective.id, description: objective.description, status: objective.status })),
    };
  } catch (error) {
    if (error instanceof DuaError) return null;
    throw error;
  }
}

// Apoios individuais (RF04): acesso restrito ao recorte do estudante. A lista,
// os estudantes e as sugestões já saem filtrados pela camada de dados.
export default async function SupportsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ estudante?: string | string[]; todos?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const wanted = first(query.estudante);

  let data;
  try {
    const { planning } = await loadPlanning(user, id);
    const [supports, suggestions, everyone] = await Promise.all([listSupports(user, id), listSuggestions(user, id), studentsInReach(user)]);
    // ?estudante= só vale para quem está no recorte (é assim que chega a entrada pelo estudante).
    const selected = everyone.find((student) => student.id === wanted) ?? null;
    const studentIds = [...new Set([...supports.filter((support) => support.canEdit).map((support) => support.student.id), ...(selected ? [selected.id] : [])])];
    const options = new Map(await Promise.all(studentIds.map(async (studentId) => [studentId, await optionsFor(user, studentId)] as const)));
    data = { planning, supports, suggestions, everyone, selected, options };
  } catch (error) {
    if (error instanceof DuaError) notFound();
    throw error;
  }
  const { planning, supports, suggestions, everyone, selected, options } = data;

  // A turma do planejamento vem primeiro; "todos" mostra os demais estudantes que a
  // pessoa acompanha (por exemplo, no AEE). Mesmo filtro de studentsInReach por turma.
  const className = planning.className;
  const classmates = className ? everyone.filter((student) => student.className === className) : everyone;
  const showAll = !className || first(query.todos) === "1" || Boolean(selected && selected.className !== className);
  const choices = showAll ? everyone : classmates;
  const base = `/planejamento/${id}/apoios`;
  const selectedOptions = selected ? options.get(selected.id) ?? null : null;
  const selectedCount = selected ? supports.filter((support) => support.student.id === selected.id).length : 0;
  const aiOn = isAIEnabled();
  const today = todayInput();

  return (
    <div className="grid min-w-0 gap-6">
      <Card className="min-w-0 bg-sky-soft/60">
        <SectionTitle>Apoios individuais desta atividade</SectionTitle>
        <div className="grid gap-2 text-sm leading-relaxed text-ink">
          <p>Cada apoio liga esta atividade às necessidades e potencialidades de um estudante. Só quem acompanha o estudante vê o apoio dele.</p>
          <p>Planejar um apoio não altera o perfil (Como aprende) nem o Plano de ensino do estudante. Para mudar esses registros, use as páginas do próprio estudante.</p>
          <p>Validar um apoio confirma o que foi planejado para esta atividade. Não altera a matrícula nem a classificação na educação especial.</p>
        </div>
      </Card>

      <Card className="min-w-0">
        <SectionTitle>Planejar um apoio</SectionTitle>
        {everyone.length ? (
          <>
            {choices.length ? (
              <Form action={base} scroll={false} className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                {showAll && className ? <input type="hidden" name="todos" value="1" /> : null}
                <Field id="apoio-estudante" label={showAll ? "Estudante (todos os que você acompanha)" : `Estudante da turma ${className}`}>
                  <select key={selected?.id ?? "nenhum"} id="apoio-estudante" name="estudante" required defaultValue={selected?.id ?? ""} className={inputCls}>
                    <option value="" disabled>Escolha o estudante</option>
                    {choices.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.gradeYear} ({student.className})</option>)}
                  </select>
                </Field>
                <button type="submit" className={secondaryCls}>
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
          <p className="text-sm text-ink-soft">Nenhum estudante ativo está no seu acompanhamento. Apoios individuais são planejados só para estudantes que você acompanha.</p>
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
        <h2 id="apoios-lista" className="mb-1 text-xl font-semibold text-ink">Apoios planejados</h2>
        <p className="mb-4 text-sm text-ink-soft">Aparecem só os apoios dos estudantes que você acompanha.</p>
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
