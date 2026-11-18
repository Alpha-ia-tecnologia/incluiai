import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { studentScopeWhere } from "@/lib/policy";
import { can, isAccountManager } from "@/lib/roles";
import { JOURNEY_SELECT, JOURNEY_STEPS, LAST_STEP, STEP, getStudentNextStep, journeyFacts } from "@/lib/student-journey";
import { generateBatchForClass } from "@/actions/activities";
import { SHIFTS } from "@/lib/scale";
import { ChoiceField } from "@/components/choice-field";
import { ActionForm } from "@/components/action-form";
import { LESSON_TOPIC_OPTIONS } from "@/lib/form-options";
import { PageHero, Badge, EmptyState } from "@/components/ui";
import { BUTTON_CLS } from "@/components/form-styles";
import { Character } from "@/components/character";
import { StepTrack } from "./step-track";
import { LessonPicker } from "./lesson-picker";
import { percentOf } from "@/lib/series";
import { ArrowLeft, ArrowRight, FileSpreadsheet, Layers, Plus, Search, Sprout } from "lucide-react";
import { param, readActivitiesBatch, type SearchParams } from "@/lib/search-params";

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

export default async function StudentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const prisma = await db();
  const params = await searchParams;
  const query = param(params.q).trim();
  const selectedClass = param(params.turma);
  const requestedAction = param(params.acao);
  const action = ["registrar", "preparar", "acompanhar"].includes(requestedAction) ? requestedAction : "";
  const lote = readActivitiesBatch(params);
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "pedagogical")) redirect("/");
  const allStudents = await prisma.student.findMany({
    where: studentScopeWhere(user),
    include: {
      school: true,
      ...JOURNEY_SELECT,
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
  const rows = students.map((student) => {
    const progress = { id: student.id, ...journeyFacts(student) };
    const steps = JOURNEY_STEPS.map((step) => ({ label: step.label, done: step.done(progress) }));
    return { student, progress, next: getStudentNextStep(progress), steps };
  });
  const byStep = JOURNEY_STEPS.map((step) => {
    const value = rows.filter((row) => row.next.step === step.step).length;
    const pct = percentOf(value, rows.length);
    return { key: step.key, label: `${step.step}. ${step.label}`, value, detail: pct === null ? undefined : `${pct}%` };
  });
  const inRoutine = rows.filter((row) => row.next.step === LAST_STEP && row.progress.hasDiary).length;
  const nominal = can(user.role, "seeNames");
  const searching = query.length >= 3;
  const listed = nominal || searching ? rows : [];
  const title = action === "registrar" ? "Para quem você quer registrar a aula?" : action === "preparar" ? "Para quem vamos preparar uma atividade?" : action === "acompanhar" ? "Quem você quer acompanhar?" : "Estudantes";
  const resetHref = action ? `/estudantes?acao=${action}` : "/estudantes";
  const registering = action === "registrar";
  const lastRecords = registering && listed.length
    ? new Map((await prisma.diaryEntry.groupBy({ by: ["studentId"], where: { studentId: { in: listed.map((row) => row.student.id) } }, _max: { date: true } })).map((row) => [row.studentId, row._max.date]))
    : new Map<string, Date | null>();

  return (
    <>
      {action ? <Link href="/" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-brand-strong"><ArrowLeft size={16} aria-hidden /> Voltar para o início</Link> : null}
      <PageHero
        character="learning"
        title={title}
        lede={registering ? undefined : action ? "Procure pelo nome ou escolha uma turma. Depois, selecione o estudante para continuar." : "Encontre um estudante e veja qual é o próximo passo do acompanhamento."}
        actions={registering ? undefined : (
          <div className="flex flex-wrap gap-2">
            <Link href="/estudantes/novo" className={BUTTON_CLS.primary}><Plus size={18} aria-hidden /> Cadastrar estudante</Link>
            {isAccountManager(user.role) ? <Link href="/estudantes/importar" className={BUTTON_CLS.secondary}><FileSpreadsheet size={18} aria-hidden /> Importar planilha</Link> : null}
          </div>
        )}
      />

      {lote !== null ? <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl bg-green-soft p-5 text-sm leading-relaxed"><Sprout size={20} className="sprout-mark shrink-0 text-green" aria-hidden /><p>{lote} estudante(s) receberam sugestões de atividade. Abra as atividades de cada estudante para avaliar o que será aplicado.</p></div> : null}

      {allStudents.length ? (
        <>
          <form method="get" action="/estudantes" role="search" aria-label="Buscar estudante" className="mb-6 grid gap-4 rounded-2xl bg-surface-muted p-5 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
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
          {nominal || searching ? <p role="status" className="mb-4 text-sm text-ink-soft">{students.length} {students.length === 1 ? "estudante encontrado" : "estudantes encontrados"}{query ? ` para “${query}”` : ""}{selectedClass ? " na turma selecionada" : ""}.</p> : null}
          {!nominal && !searching ? (
            <p role="status" className="mb-6 rounded-2xl bg-surface-muted px-5 py-4 text-sm leading-relaxed text-ink-soft">
              A Secretaria acompanha a rede pelos números do <Link href="/painel" className="font-medium text-brand-strong underline underline-offset-4">Painel</Link>. Para abrir a ficha de um estudante, digite pelo menos 3 letras do nome: ao abrir, você informa o motivo, que fica registrado e a família vê.
            </p>
          ) : null}
          {nominal && !action && students.length ? (
            <section aria-labelledby="etapas-resumo" className="dash-board mb-6">
              <div className="dash-card min-w-0">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <h2 id="etapas-resumo" className="text-base font-medium tracking-tight text-ink">Em que etapa estão</h2>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">Pelo próximo passo sugerido de cada estudante desta lista.</p>
                  </div>
                  <p className="text-xs text-ink-soft"><span className="font-display font-bold text-2xl leading-none text-ink tabular-nums">{inRoutine}</span> de {rows.length} na rotina de registros</p>
                </div>
                <ol className="grid grid-cols-5 gap-1">
                  {byStep.map((step, index) => (
                    <li key={step.key} className="relative flex min-w-0 flex-col items-center text-center">
                      {index < byStep.length - 1 ? <span aria-hidden className="absolute left-[calc(50%+24px)] right-[calc(-50%+24px)] top-5 border-t-[1.5px] border-dashed border-line" /> : null}
                      <span className={`relative flex size-10 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${step.value ? "bg-brand text-white" : "bg-surface-muted text-ink-soft"}`}>{step.value}</span>
                      <span className="sr-only">{step.value === 1 ? "estudante na etapa" : "estudantes na etapa"}</span>
                      <span className="mt-2 text-xs font-medium leading-snug text-ink [overflow-wrap:anywhere]">{step.label}</span>
                      <span className="text-xs text-ink-soft tabular-nums">{step.detail ?? "sem base"}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ) : null}
          {listed.length && registering ? <LessonPicker students={listed.map((row) => row.student)} lastRecords={lastRecords} /> : listed.length ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {listed.map(({ student, progress, next, steps }) => {
                const base = `/estudantes/${student.id}`;
                const selected = action === "acompanhar"
                  ? { href: base, label: "Ver acompanhamento", description: "Veja o plano, as aulas registradas e os próximos passos." }
                  : action === "preparar" && next.step >= STEP.atividade
                    ? { href: `${base}/atividades`, label: "Preparar atividade", description: "Veja as sugestões e escolha uma atividade para aplicar." }
                    : next;
                return (
                  <article key={student.id} className="flex min-w-0 flex-col rounded-2xl border border-line bg-paper-raised p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full text-base font-medium" style={{ backgroundColor: `oklch(88% 0.07 ${student.avatarHue})` }}>{student.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("")}</span>
                      <div className="min-w-0"><h2 className="text-xl font-medium leading-snug">{student.name}</h2><p className="mt-1 text-sm text-ink-soft">{student.gradeYear} · {student.className} · {SHIFTS[student.shift] ?? student.shift}</p></div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-ink-soft">{student.school.name}</p>
                    <div className="mt-3"><StepTrack steps={steps} current={next.step} note={next.step === LAST_STEP && progress.hasDiary ? "Na rotina de registros" : undefined} /></div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {student.status !== "ativo" ? <Badge>{student.status}</Badge> : null}
                      {!progress.hasPlan ? <Badge tone="mid">{progress.caseStudy === "concluido" ? "Plano de ensino a criar" : "Estudo de caso a concluir"}</Badge> : !progress.hasObjective ? <Badge tone="mid">Objetivo a definir</Badge> : !progress.hasProfile ? <Badge tone="mid">Falta preencher como aprende</Badge> : <Badge tone="info">Plano de ensino ativo</Badge>}
                    </div>
                    <p className="mb-4 mt-4 text-sm leading-relaxed text-ink-soft">{action === "preparar" && next.step < STEP.atividade ? `Antes de preparar a atividade: ${next.description}` : selected.description}</p>
                    <Link href={selected.href} className="task-action mt-auto">{selected.label}<ArrowRight size={16} className="shrink-0" aria-hidden /></Link>
                    {selected.href !== base ? <Link href={base} className="mt-2 inline-flex min-h-11 items-center justify-center text-sm font-medium text-brand-strong">Ver acompanhamento</Link> : null}
                  </article>
                );
              })}
            </div>
          ) : !nominal && !searching ? null : <EmptyState character="learning" title="Nenhum estudante encontrado" hint="Confira o nome digitado ou use “Limpar filtros” para ver todos os estudantes disponíveis." action={<Link href={resetHref} className={BUTTON_CLS.quiet}>Limpar filtros</Link>} />}
        </>
      ) : <EmptyState character="learning" title="Cadastre o primeiro estudante" hint="Comece com nome, escola e turma. Depois, você poderá completar as informações de aprendizagem." action={<Link href="/estudantes/novo" className={BUTTON_CLS.primary}><Plus size={18} aria-hidden /> Cadastrar primeiro estudante</Link>} />}

      {nominal && classes.length && !registering ? (
        <details id="planejar-turma" className="mt-8 rounded-2xl border border-line bg-teal-soft/60">
          <summary className="min-h-14 cursor-pointer px-5 py-5 text-base font-medium sm:px-6">Preparar atividades para uma turma inteira</summary>
          <div className="px-5 pb-6 sm:px-6">
            <div className="mb-5 flex items-center gap-5"><div className="flex-1"><h2 className="text-base font-medium">Planejamento da turma</h2><p className="mt-2 text-sm leading-relaxed text-ink-soft">Use esta opção quando já tiver preenchido como os estudantes aprendem e definido seus objetivos no plano de ensino.</p></div><Character variant="planning" className="hidden w-28 sm:block" /></div>
            <ActionForm action={generateBatchForClass} className="grid gap-4 sm:grid-cols-2 [&>[role=alert]]:col-span-full">
              <div className="min-w-0"><label htmlFor="batch-class" className="mb-2 block text-sm font-medium">Turma (obrigatório)</label><select id="batch-class" name="turma" required defaultValue="" className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-paper-raised px-3 text-base"><option value="" disabled>Escolha a turma</option>{classes.map((item) => <option key={item.key} value={item.key}>{item.className} — {item.school}</option>)}</select></div>
              <ChoiceField name="lessonTopic" label="Conteúdo da aula (opcional)" options={LESSON_TOPIC_OPTIONS} placeholder="Escolha um conteúdo (opcional)" otherPlaceholder="Ex.: sistema solar" labelClassName="mb-2 block text-sm font-medium" inputClassName="min-h-12 w-full min-w-0 rounded-xl border border-line bg-paper-raised px-3 text-base" />
              <div className="sm:col-span-2"><button type="submit" className="task-action"><Layers size={18} aria-hidden /> Criar sugestões para a turma</button><p className="mt-3 text-sm leading-relaxed text-ink-soft">Serão criadas 3 sugestões por estudante com perfil e objetivo ativo. Você analisa cada sugestão antes de aplicar.</p></div>
            </ActionForm>
          </div>
        </details>
      ) : null}
    </>
  );
}