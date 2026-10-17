import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSchoolStaff, isStaffOrNetwork } from "@/lib/auth";
import { getStudentNextStep } from "@/lib/student-journey";
import { generateBatchForClass } from "@/actions/activities";
import { SHIFTS } from "@/lib/scale";
import { ChoiceField } from "@/components/choice-field";
import { LESSON_TOPIC_OPTIONS } from "@/lib/form-options";
import { PageHeader, Badge, EmptyState } from "@/components/ui";
import { Character } from "@/components/character";
import { BarList } from "@/components/charts";
import { StepTrack } from "@/components/viz/step-track";
import { JOURNEY_STEPS } from "@/lib/dashboard";
import { percentOf } from "@/lib/series";
import { ArrowLeft, ArrowRight, Check, Layers, Plus, Search } from "lucide-react";

export const dynamic = "force-dynamic";

type Query = { [key: string]: string | string[] | undefined };
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  const query = first(params.q).trim();
  const selectedClass = first(params.turma);
  const requestedAction = first(params.acao);
  const action = ["registrar", "preparar", "acompanhar"].includes(requestedAction) ? requestedAction : "";
  const lote = first(params.lote);
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffOrNetwork(user.role)) redirect("/");
  const scoped = isSchoolStaff(user.role) && user.schoolId;
  const allStudents = await prisma.student.findMany({
    where: scoped ? { schoolId: user.schoolId! } : {},
    include: {
      school: true,
      caseStudy: { select: { status: true } },
      profile: { select: { id: true } },
      plans: { where: { status: "ativo" }, orderBy: { createdAt: "desc" }, take: 1, include: { objectives: { where: { status: "ativo" }, select: { id: true }, take: 1 } } },
      activities: { where: { status: { in: ["aceita", "aplicada"] } }, select: { id: true }, take: 1 },
      diaryEntries: { select: { id: true }, take: 1 },
    },
    orderBy: { name: "asc" },
  });
  const classes = Array.from(
    new Map(allStudents.map((student) => [`${student.schoolId}|${student.className}`, { key: `${student.schoolId}|${student.className}`, className: student.className, school: student.school.name }])).values()
  ).sort((a, b) => a.className.localeCompare(b.className, "pt-BR"));
  const students = allStudents.filter((student) =>
    (!query || normalized(student.name).includes(normalized(query))) &&
    (!selectedClass || `${student.schoolId}|${student.className}` === selectedClass)
  );
  // Próximo passo de cada estudante, calculado uma vez para o resumo e os cartões.
  const rows = students.map((student) => {
    const progress = {
      id: student.id, caseStudy: (student.caseStudy?.status as "rascunho" | "concluido" | undefined) ?? null, hasProfile: !!student.profile, hasPlan: !!student.plans.length,
      hasObjective: !!student.plans[0]?.objectives.length,
      hasPreparedActivity: !!student.activities.length, hasDiary: !!student.diaryEntries.length,
    };
    // Etapa feita é a que já tem registro; o próximo passo pode pular o estudo
    // de caso quando o perfil já foi preenchido, e a linha mostra isso.
    const steps = [
      { label: JOURNEY_STEPS[0].label, done: progress.caseStudy === "concluido" },
      { label: JOURNEY_STEPS[1].label, done: progress.hasProfile },
      { label: JOURNEY_STEPS[2].label, done: progress.hasPlan && progress.hasObjective },
      { label: JOURNEY_STEPS[3].label, done: progress.hasPreparedActivity },
      { label: JOURNEY_STEPS[4].label, done: progress.hasDiary },
    ];
    return { student, next: getStudentNextStep(progress), steps };
  });
  const byStep = JOURNEY_STEPS.map((step) => {
    const value = rows.filter((row) => row.next.step === step.step).length;
    const pct = percentOf(value, rows.length);
    return { key: step.key, label: `${step.step}. ${step.label}`, value, detail: pct === null ? undefined : `${pct}%` };
  });
  const inRoutine = rows.filter((row) => row.next.step === 5 && row.steps[4].done).length;
  const title = action === "registrar" ? "Para quem você quer registrar a aula?" : action === "preparar" ? "Para quem vamos preparar uma atividade?" : action === "acompanhar" ? "Quem você quer acompanhar?" : "Estudantes";
  const resetHref = action ? `/estudantes?acao=${action}` : "/estudantes";

  return (
    <>
      {action ? <Link href="/" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-brand-strong"><ArrowLeft size={16} aria-hidden /> Voltar para o início</Link> : null}
      <PageHeader title={title} lede={action ? "Procure pelo nome ou escolha uma turma. Depois, selecione o estudante para continuar." : "Encontre um estudante e veja qual é o próximo passo do acompanhamento."}
        actions={<Link href="/estudantes/novo" className="task-action task-action-secondary"><Plus size={18} aria-hidden /> Cadastrar estudante</Link>} />

      {lote && /^\d+$/.test(lote) ? <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl bg-green-soft p-5 text-sm leading-relaxed"><Check size={20} className="shrink-0" aria-hidden /><p>{lote} estudante(s) receberam sugestões de atividade. Abra as atividades de cada estudante para avaliar o que será aplicado.</p></div> : null}

      {allStudents.length ? (
        <>
          <form method="get" action="/estudantes" role="search" aria-label="Buscar estudante" className="mb-6 grid gap-4 rounded-[22px] bg-surface-muted p-5 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
            {action ? <input type="hidden" name="acao" value={action} /> : null}
            <div className="min-w-0">
              <label htmlFor="student-search" className="mb-2 block text-sm font-medium">Nome do estudante</label>
              <input id="student-search" name="q" type="search" defaultValue={query} placeholder="Digite o nome ou parte dele" className="min-h-12 w-full rounded-xl border border-line bg-paper-raised px-4 py-3 text-base" />
            </div>
            <div className="min-w-0">
              <label htmlFor="student-class" className="mb-2 block text-sm font-medium">Turma</label>
              <select id="student-class" name="turma" defaultValue={selectedClass} className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-paper-raised px-3 py-3 text-base">
                <option value="">Todas as turmas</option>
                {classes.map((item) => <option key={item.key} value={item.key}>{item.className} — {item.school}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-1">
              <button type="submit" className="task-action"><Search size={18} aria-hidden /> Buscar</button>
              {query || selectedClass ? <Link href={resetHref} className="task-action task-action-secondary">Limpar filtros</Link> : null}
            </div>
          </form>
          <p role="status" className="mb-4 text-sm text-ink-soft">{students.length} {students.length === 1 ? "estudante encontrado" : "estudantes encontrados"}{query ? ` para “${query}”` : ""}{selectedClass ? " na turma selecionada" : ""}.</p>
          {!action && students.length ? (
            // Resumo da lista atual (respeita a busca e a turma escolhidas).
            <section aria-labelledby="etapas-resumo" className="dash-board mb-6">
              <div className="dash-card min-w-0">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <h2 id="etapas-resumo" className="text-[15px] font-medium tracking-tight text-ink">Em que etapa estão</h2>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">Quantos estudantes desta lista estão em cada etapa do acompanhamento, pelo próximo passo sugerido.</p>
                  </div>
                  <p className="text-xs text-ink-soft"><span className="font-display text-2xl leading-none text-ink tabular-nums">{inRoutine}</span> de {rows.length} na rotina de registros</p>
                </div>
                <BarList rows={byStep} />
              </div>
            </section>
          ) : null}
          {students.length ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {rows.map(({ student, next, steps }) => {
                const base = `/estudantes/${student.id}`;
                const selected = action === "registrar"
                  ? { href: `${base}/diario`, label: "Registrar aula", description: "Conte como foi a aula deste estudante." }
                  : action === "acompanhar"
                    ? { href: base, label: "Ver acompanhamento", description: "Veja o plano, as aulas registradas e os próximos passos." }
                    : action === "preparar" && next.step >= 3
                      ? { href: `${base}/atividades`, label: "Preparar atividade", description: "Veja as sugestões e escolha uma atividade para aplicar." }
                      : next;
                return (
                  <article key={student.id} className="flex min-w-0 flex-col rounded-[22px] border border-line bg-paper-raised p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full text-base font-medium" style={{ backgroundColor: `oklch(88% 0.07 ${student.avatarHue})` }}>{student.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("")}</span>
                      <div className="min-w-0"><h2 className="text-lg font-medium leading-snug">{student.name}</h2><p className="mt-1 text-sm text-ink-soft">{student.gradeYear} · {student.className} · {SHIFTS[student.shift] ?? student.shift}</p></div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-ink-soft">{student.school.name}</p>
                    <div className="mt-3"><StepTrack steps={steps} current={next.step} note={next.step === 5 && steps[4].done ? "Na rotina de registros" : undefined} /></div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {student.status !== "ativo" ? <Badge>{student.status}</Badge> : null}
                      {!student.profile ? <Badge tone="amber">Falta preencher como aprende</Badge> : !student.plans.length ? <Badge tone="amber">Plano de ensino a criar</Badge> : !student.plans[0].objectives.length ? <Badge tone="amber">Objetivo a definir</Badge> : <Badge tone="brand">Plano de ensino ativo</Badge>}
                    </div>
                    <p className="mb-4 mt-4 text-sm leading-relaxed text-ink-soft">{action === "preparar" && next.step < 3 ? `Antes de preparar a atividade: ${next.description}` : selected.description}</p>
                    <Link href={selected.href} className="task-action mt-auto">{selected.label}<ArrowRight size={16} className="shrink-0" aria-hidden /></Link>
                    {selected.href !== base ? <Link href={base} className="mt-2 inline-flex min-h-11 items-center justify-center text-sm font-medium text-brand-strong">Ver acompanhamento</Link> : null}
                  </article>
                );
              })}
            </div>
          ) : <EmptyState title="Nenhum estudante encontrado" hint="Confira o nome digitado ou use “Limpar filtros” para ver todos os estudantes disponíveis." />}
        </>
      ) : <div><EmptyState title="Cadastre o primeiro estudante" hint="Comece com nome, escola e turma. Depois, você poderá completar as informações de aprendizagem." /><Link href="/estudantes/novo" className="task-action mt-4 w-fit"><Plus size={18} aria-hidden /> Cadastrar primeiro estudante</Link></div>}

      {classes.length ? (
        <details id="planejar-turma" className="mt-8 rounded-[22px] border border-line bg-teal-soft/60">
          <summary className="min-h-14 cursor-pointer px-5 py-5 text-base font-medium sm:px-6">Preparar atividades para uma turma inteira</summary>
          <div className="px-5 pb-6 sm:px-6">
            <div className="mb-5 flex items-center gap-5"><div className="flex-1"><h2 className="text-base font-medium">Planejamento da turma</h2><p className="mt-2 text-sm leading-relaxed text-ink-soft">Use esta opção quando já tiver preenchido como os estudantes aprendem e definido seus objetivos no plano de ensino.</p></div><Character variant="planning" className="hidden w-28 sm:block" /></div>
            <form action={generateBatchForClass} className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0"><label htmlFor="batch-class" className="mb-2 block text-sm font-medium">Turma (obrigatório)</label><select id="batch-class" name="turma" required defaultValue="" className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-paper-raised px-3 text-base"><option value="" disabled>Escolha a turma</option>{classes.map((item) => <option key={item.key} value={item.key}>{item.className} — {item.school}</option>)}</select></div>
              <ChoiceField name="lessonTopic" label="Conteúdo da aula (opcional)" options={LESSON_TOPIC_OPTIONS} placeholder="Escolha um conteúdo (opcional)" otherPlaceholder="Ex.: sistema solar" labelClassName="mb-2 block text-sm font-medium" inputClassName="min-h-12 w-full min-w-0 rounded-xl border border-line bg-paper-raised px-3 text-base" />
              <div className="sm:col-span-2"><button type="submit" className="task-action"><Layers size={18} aria-hidden /> Criar sugestões para a turma</button><p className="mt-3 text-sm leading-relaxed text-ink-soft">Serão criadas 3 sugestões por estudante com perfil e objetivo ativo. Você analisa cada sugestão antes de aplicar.</p></div>
            </form>
          </div>
        </details>
      ) : null}
    </>
  );
}