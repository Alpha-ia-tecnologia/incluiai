import Link from "next/link";
import { ConsentNote } from "@/components/consent-note";
import { aiAllowedFor } from "@/lib/consent";
import { db } from "@/lib/prisma";
import { createPlan, createObjective, markObjectiveStatus, reviewPlan, closePlan, updatePlanDocuments } from "@/actions/plan";
import { activatePlanDraft, discardPlanDraft, generatePlanDraft } from "@/actions/plan-ai";
import { formatDate } from "@/lib/format";
import { SUPPORT_LEVELS, DIMENSIONS } from "@/lib/scale";
import { CONDITION_SUGGESTIONS, CRITERION_SUGGESTIONS, buildObjectiveDescription } from "@/lib/objective";
import { isAIEnabled } from "@/lib/agents/model";
import { CASE_STUDY_REQUIRED_MESSAGE, isCaseStudyConcluded, parseCaseStudy } from "@/lib/case-study";
import { PlanProposalSchema, type CaseAnalysis, type PlanProposal, type TraceStep } from "@/lib/agents/schemas";
import { DEADLINE_WEEKS, INITIAL_SITUATION_OPTIONS } from "@/lib/form-options";
import { PAEE_ITEMS, PEI_ITEMS, censusDifferences, mergeProposalDefaults, missingCount, missingPlanItems, planDefaultsFromCaseStudy, type CensusDifference, type PlanDocuments, type PlanItem } from "@/lib/plan-documents";
import { censusMetaOf } from "@/lib/census";
import { PLAN_RULES } from "@/lib/federal-guidance";
import { FederalGuidance } from "@/components/federal-guidance";
import { PlanDocumentFields } from "@/components/plan-document-fields";
import { PageHeader, Card, SectionTitle, Badge, SupportPill, AIDisclaimer } from "@/components/ui";
import { PillLink } from "@/components/pill-link";
import { PendingButton } from "@/components/pending-button";
import { ChoiceField, MultiChoiceField } from "@/components/choice-field";
import { ObjectiveFields } from "@/components/objective-fields";
import { BnccTag } from "@/components/bncc-tag";
import { Archive, ArrowRight, CalendarCheck, CircleCheck, ClipboardList, Cog, FilePen, FilePlus, History, ListChecks, ScanSearch, ShieldCheck, Sparkles, Target, Trash2, UserCheck } from "lucide-react";
import { Assurances, HowToRead, Steps } from "@/components/explain";
import { requireStudentPage } from "@/lib/page-context";
import { teachingContext } from "@/lib/roles";
import { listStudentSupports } from "@/lib/dua/supports";
import { ReviewBadge } from "@/components/dua/dua-ui";
import { percentOf } from "@/lib/series";
import { CLOSE_REASONS, reviewSummary, suggestedNextReview } from "@/lib/plan-lifecycle";
import { DataBoard, DataCard, RingStat, StatusPill, TONE_COLOR, withSegmentColors, type Tone } from "@/components/data-viz";
import { HatchedDonut, Legend } from "@/components/charts";
import { ObjectiveScale } from "@/components/viz/student-viz";
import { dangerButtonCls, hintCls, inputCls, labelCls, primaryButtonCls as buttonCls, textareaCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

const fieldStyle = { labelClassName: labelCls, inputClassName: inputCls };
const multiStyle = { legendClassName: labelCls, inputClassName: inputCls };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const prisma = await db();
  const { id } = await params;
  const { user: viewer, can } = await requireStudentPage(id, "Plano de ensino");
  const editable = can.edit;
  const plans = await prisma.plan.findMany({
    where: { studentId: id },
    include: { objectives: { orderBy: { createdAt: "asc" } }, reviews: { orderBy: { reviewedAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  const plan = plans.find((p) => p.status === "ativo");
  const pastPlans = plans.filter((p) => p.status === "encerrado");
  const overdue = plan && new Date(plan.reviewDate).getTime() < new Date().getTime();

  if (!plan && !editable) {
    return (
      <>
        <PageHeader level={2} title="Plano de ensino (PAEE e PEI)" lede="Sem plano ativo no momento." />
        <PastPlans plans={pastPlans} />
      </>
    );
  }

  if (!plan) {
    const create = createPlan.bind(null, id);
    const [draft, student] = await Promise.all([
      prisma.planDraft.findUnique({ where: { studentId: id } }),
      prisma.student.findUniqueOrThrow({ where: { id }, select: { name: true, profile: { select: { id: true } }, caseStudy: { select: { id: true, status: true, content: true } } } }),
    ]);
    if (!isCaseStudyConcluded(student.caseStudy)) {
      return (
        <>
          <PageHeader level={2} title="Plano de ensino (PAEE e PEI)" />
          <Card className="max-w-2xl border-amber/20 bg-amber-soft/50">
            <SectionTitle>Primeiro, conclua o estudo de caso</SectionTitle>
            <p className="text-sm leading-relaxed text-ink" role="status">{CASE_STUDY_REQUIRED_MESSAGE}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {student.caseStudy ? "O estudo de caso está em elaboração." : "O estudo de caso ainda não foi começado."} Atividades com DUA, em Planejamento, não dependem dele.
            </p>
            <Link href={`/estudantes/${id}/estudo-de-caso`} className={`${buttonCls} mt-4`}>
              {student.caseStudy ? "Continuar o estudo de caso" : "Começar o estudo de caso"} <ArrowRight size={16} aria-hidden />
            </Link>
          </Card>
        </>
      );
    }
    const hasData = Boolean(student.profile || student.caseStudy);
    const aiOn = await aiAllowedFor(id);
    const consentMissing = isAIEnabled() && !aiOn;
    const generate = generatePlanDraft.bind(null, id);
    const caseDefaults = planDefaultsFromCaseStudy(parseCaseStudy(student.caseStudy?.content), teachingContext(viewer.role) === "aee" ? viewer.name : null);
    const manualForm = (
        <Card className="max-w-2xl">
          <SectionTitle>{draft ? "Preencher o plano do zero" : "Comece o plano do estudante"}</SectionTitle>
          <p className={`${hintCls} mb-5`}>Campos com * são obrigatórios.</p>
          <form action={create} className="space-y-6">
            <MultiChoiceField name="initialSituation" label="O que o estudante já consegue fazer? *" options={INITIAL_SITUATION_OPTIONS} required hint="Marque o que se aplica e use Outro para acrescentar." {...multiStyle} />
            <PlanDocumentFields idPrefix="novo" defaults={caseDefaults} />
            <div>
              <label htmlFor="reviewDate" className={labelCls}>Quando a equipe vai revisar este plano? *</label>
              <input id="reviewDate" name="reviewDate" type="date" required className={inputCls} />
            </div>
            <button type="submit" className={buttonCls}>Salvar plano e definir objetivos <ArrowRight size={16} aria-hidden /></button>
          </form>
        </Card>
    );

    if (draft) {
      return (
        <>
          <PageHeader level={2} title="Plano de ensino (PAEE e PEI)" />
          <FederalGuidance rules={PLAN_RULES} summary="Quem elabora o PAEE e o PEI" className="mb-6 max-w-3xl" />
          <div className="mb-6 grid max-w-3xl gap-3">
            <Steps
              label="Como ativar o plano"
              items={[
                { icon: FilePen, label: "Revise a proposta" },
                { icon: ListChecks, label: "Marque os objetivos" },
                { icon: CircleCheck, label: "Ative o plano" },
              ]}
            />
            <Assurances label="Antes de ativar" items={[{ icon: UserCheck, text: "Só vale depois que você ativar" }]} />
          </div>
          <ProposalReview
            studentId={id}
            studentName={student.name}
            proposal={PlanProposalSchema.parse(JSON.parse(draft.content))}
            analysis={draft.analysis ? (JSON.parse(draft.analysis) as CaseAnalysis) : null}
            trace={JSON.parse(draft.trace) as TraceStep[]}
            source={draft.source}
            createdBy={draft.createdBy}
            createdAt={draft.createdAt}
            aiOn={aiOn}
            documentDefaults={caseDefaults}
          />
          <details className="mt-6 max-w-2xl">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-brand-strong">Prefere preencher o plano do zero?</summary>
            <div className="mt-3">{manualForm}</div>
          </details>
          <PastPlans plans={pastPlans} />
        </>
      );
    }

    return (
      <>
        <PageHeader level={2} title="Plano de ensino (PAEE e PEI)" />
        <FederalGuidance rules={PLAN_RULES} summary="Quem elabora o PAEE e o PEI" className="mb-6 max-w-3xl" />
        <Card className="mb-6 max-w-2xl border-brand/30 bg-brand-soft/40">
          <SectionTitle><span className="flex items-center gap-2"><Sparkles size={16} aria-hidden /> {aiOn ? "Peça uma proposta aos agentes de IA" : "Peça uma proposta automática"}</span></SectionTitle>
          <ConsentNote show={consentMissing} />
          <Steps
            label="Como a proposta é feita"
            items={aiOn
              ? [
                  { icon: ScanSearch, label: "Analista lê o estudo de caso" },
                  { icon: Target, label: "Três agentes propõem o PAEE, o PEI e os objetivos" },
                  { icon: ShieldCheck, label: "Revisor confere" },
                  { icon: UserCheck, label: "Você decide e ativa" },
                ]
              : [
                  { icon: ClipboardList, label: "Estudo de caso e perfil" },
                  { icon: Cog, label: "Motor de regras propõe" },
                  { icon: UserCheck, label: "Você decide e ativa" },
                ]}
          />
          {!aiOn && !consentMissing ? <p className="mt-3 text-xs leading-relaxed text-ink-soft">IA desligada nesta instalação: falta a chave ANTHROPIC_API_KEY no servidor.</p> : null}
          {hasData ? (
            <form action={generate} className="mt-4">
              <PendingButton className={buttonCls} pendingText={aiOn ? "Os agentes estão analisando o caso e montando o plano." : "Preparando a proposta…"} wait={aiOn ? "plano" : undefined}>
                <Sparkles size={16} aria-hidden /> Preparar proposta de plano
              </PendingButton>
            </form>
          ) : (
            <p className="mt-4 rounded-xl bg-paper-raised p-3 text-sm text-ink-soft">
              Para pedir uma proposta, faça antes o <Link href={`/estudantes/${id}/estudo-de-caso`} className="font-medium text-brand-strong underline underline-offset-4">estudo de caso</Link> ou preencha <Link href={`/estudantes/${id}/perfil`} className="font-medium text-brand-strong underline underline-offset-4">Como aprende</Link>.
            </p>
          )}
        </Card>
        {manualForm}
        <PastPlans plans={pastPlans} />
      </>
    );
  }

  const addObjective = createObjective.bind(null, id, plan.id);
  const review = reviewPlan.bind(null, id, plan.id);
  const close = closePlan.bind(null, id, plan.id);
  const updateDocuments = updatePlanDocuments.bind(null, id, plan.id);
  // Conteúdo mínimo e autoria do PAEE e do PEI (Portaria, arts. 10 e 11; INEP).
  const missing = missingPlanItems(plan);
  const missingTotal = missingCount(plan);
  const studentRecord = await prisma.student.findUniqueOrThrow({ where: { id }, select: { census: true, caseStudy: { select: { content: true } } } });
  const differences = censusDifferences(plan, censusMetaOf(studentRecord.census));
  const suggested = planDefaultsFromCaseStudy(parseCaseStudy(studentRecord.caseStudy?.content));
  const reviews = reviewSummary(plan.reviews);
  const hasActiveObjectives = plan.objectives.some((objective) => objective.status === "ativo");
  const dua = { supports: can.edit ? await listStudentSupports(viewer, id) : [], canPlan: can.dua };
  const duaByObjective = plan.objectives
    .map((objective) => ({ objective, supports: dua.supports.filter((support) => (support.data.planLinks ?? []).some((link) => link.planId === plan.id && link.objectiveId === objective.id)) }))
    .filter((group) => group.supports.length);
  const latestSupport = await latestSupportByObjective(id, plan.objectives.map((objective) => objective.id));
  const hasScale = plan.objectives.some((objective) => latestSupport.has(objective.id));

  const today = new Date();
  const elapsed = percentOf(today.getTime() - plan.createdAt.getTime(), new Date(plan.reviewDate).getTime() - plan.createdAt.getTime());
  const elapsedPct = elapsed === null ? null : Math.min(100, Math.max(0, elapsed));
  const daysLeft = daysUntil(new Date(plan.reviewDate), today);
  const reviewTone: Tone = overdue || daysLeft < 0 ? "alert" : daysLeft <= 14 ? "mid" : "info";
  const reviewStatus = daysLeft < 0 ? "Data de revisão passou" : daysLeft === 0 ? "Revisão hoje" : daysLeft <= 14 ? "Revisão próxima" : "No prazo";
  const countStatus = (status: string) => plan.objectives.filter((objective) => objective.status === status).length;
  const objectiveStatus = withSegmentColors([
    { key: "ativo", label: "Ativos", value: countStatus("ativo") },
    { key: "alcancado", label: "Alcançados", value: countStatus("alcancado") },
    { key: "em_revisao", label: "Em revisão", value: countStatus("em_revisao") },
  ]);

  return (
    <>
      <PageHeader level={2}
        title="Plano de ensino (PAEE e PEI)"
        lede={`Criado em ${formatDate(plan.createdAt)} · data de revisão: ${formatDate(plan.reviewDate)}`}
        actions={<div className="flex flex-wrap items-center gap-2"><PillLink slug="objetivo-bncc" />{overdue ? <Badge tone="coral">Hora de revisar com a equipe</Badge> : <Badge tone="green">Plano ativo</Badge>}</div>}
      />
      <FederalGuidance rules={PLAN_RULES} summary="Quem elabora o PAEE e o PEI" className="mb-6 max-w-3xl" />

      {editable && !hasActiveObjectives ? (
        <Card className="mb-6 border-brand/30 bg-brand-soft/50">
          <SectionTitle>Próximo passo: definir um objetivo</SectionTitle>
          <Link href="#novo-objetivo" className={buttonCls}>
            Definir o objetivo <ArrowRight size={16} aria-hidden />
          </Link>
        </Card>
      ) : null}

      <SectionTitle>Andamento do plano</SectionTitle>
      <DataBoard className="mb-6 md:grid-cols-2">
        <DataCard title="Até a revisão do plano">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <RingStat id="ppi-prazo" value={elapsedPct} label="Tempo do plano já percorrido" size={96} color={TONE_COLOR[reviewTone]} />
            <div className="min-w-0 flex-1 basis-40">
              <p className="font-display font-bold text-3xl leading-none tracking-tight text-ink tabular-nums">
                {daysLeft === 0 ? "Hoje" : Math.abs(daysLeft)}
                {daysLeft !== 0 ? <span className="ml-1 text-xl text-ink-soft">{Math.abs(daysLeft) === 1 ? "dia" : "dias"}</span> : null}
              </p>
              <p className="mt-2"><StatusPill tone={reviewTone}>{reviewStatus}</StatusPill></p>
              <p className="mt-2 text-xs text-ink-soft tabular-nums">Marcada para {formatDate(plan.reviewDate)}</p>
              <HowToRead summary="Como ler o anel">
                {elapsedPct === null ? "Sem base para calcular o tempo percorrido." : `O anel mostra o tempo já percorrido desde a criação do plano: ${elapsedPct}%.`}
              </HowToRead>
            </div>
          </div>
        </DataCard>
        <DataCard title="Situação dos objetivos">
          {plan.objectives.length ? (
            <div className="flex min-w-0 flex-wrap items-center gap-4">
              <HatchedDonut id="ppi-objetivos" segments={objectiveStatus} size={96} thickness={13} label={`Objetivos do plano: ${objectiveStatus.map((segment) => `${segment.label.toLowerCase()} ${segment.value}`).join(", ")}`}>
                <span className="font-display font-bold text-2xl leading-none text-ink tabular-nums">{plan.objectives.length}</span>
                <span className="mt-0.5 text-xs text-ink-soft">{plan.objectives.length === 1 ? "objetivo" : "objetivos"}</span>
              </HatchedDonut>
              <div className="min-w-0 flex-1 basis-40"><Legend segments={objectiveStatus} /></div>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Nenhum objetivo ainda.</p>
          )}
        </DataCard>
      </DataBoard>

      <Card id="revisao" className="mb-6 max-w-3xl scroll-mt-6">
        <SectionTitle>Revisão do plano</SectionTitle>
        <p className="mb-4 text-sm leading-relaxed text-ink-soft">
          {reviews.total
            ? `${reviews.total} ${reviews.total === 1 ? "revisão" : "revisões"}, ${reviews.onTime} no prazo · próxima em ${formatDate(plan.reviewDate)}`
            : `Nenhuma revisão ainda · primeira em ${formatDate(plan.reviewDate)}`}
        </p>
        {editable ? <details open={daysLeft <= 14} className="rounded-2xl bg-surface-muted p-4">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-brand-strong"><CalendarCheck size={16} aria-hidden /> Registrar a revisão feita com a equipe</summary>
          <form action={review} className="mt-3 grid gap-4">
            <div>
              <label htmlFor="review-summary" className={labelCls}>O que a equipe decidiu? (obrigatório)</label>
              <p id="review-summary-hint" className={hintCls}>Ex.: objetivos mantidos, apoio reduzido, nova estratégia na sala comum.</p>
              <textarea id="review-summary" name="summary" required maxLength={600} rows={4} aria-describedby="review-summary-hint" className={textareaCls} />
            </div>
            <div className="max-w-xs">
              <label htmlFor="next-review" className={labelCls}>Próxima revisão (obrigatório)</label>
              <input id="next-review" name="nextReviewDate" type="date" required defaultValue={suggestedNextReview()} className={inputCls} />
            </div>
            <div><PendingButton className={buttonCls} pendingText="Registrando a revisão…"><CalendarCheck size={16} aria-hidden /> Registrar revisão</PendingButton></div>
          </form>
        </details> : null}
        {plan.reviews.length ? (
          <ol aria-label="Revisões registradas" className="mt-4 grid gap-3">
            {plan.reviews.map((item) => (
              <li key={item.id} className="rounded-xl border border-line p-3.5">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  {formatDate(item.reviewedAt)}
                  {item.onTime ? <Badge tone="green">No prazo</Badge> : <Badge tone="amber">Fora do prazo (marcada para {formatDate(item.dueDate)})</Badge>}
                </p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink">{item.summary}</p>
                <p className="mt-1.5 text-xs text-ink-soft">{item.reviewerName} · próxima: {formatDate(item.nextReviewDate)}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </Card>

      <Card className="mb-4">
        <SectionTitle>O que o estudante já consegue fazer</SectionTitle>
        <p className="text-sm leading-relaxed text-ink">{plan.initialSituation}</p>
      </Card>
      <div className="mb-4 grid min-w-0 gap-4 lg:grid-cols-2">
        <PlanDocumentCard id="paee" title="PAEE" norm="art. 10" teacherLabel="Professor(a) do AEE" teacher={plan.aeeTeacher} participants={plan.participants} items={PAEE_ITEMS} plan={plan} missing={missing.paee} alsoMissing={missing.authorship.filter((item) => item === "participação da família")} showMissing={editable} />
        <PlanDocumentCard id="pei" title="PEI" norm="art. 11" teacherLabel="Professor(a) da classe comum" teacher={plan.regularTeacher} items={PEI_ITEMS} plan={plan} missing={missing.pei} showMissing={editable} differences={differences} />
      </div>
      {editable ? (
        <details id="completar-paee-pei" className="mb-6 max-w-3xl scroll-mt-6 rounded-2xl border border-line p-4">
          <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 py-2 text-sm font-medium text-brand-strong">
            <FilePen size={16} aria-hidden /> {missingTotal ? "Completar o PAEE e o PEI" : "Editar o PAEE e o PEI"}
            {missingTotal ? <Badge tone="amber">{missingTotal} a registrar</Badge> : null}
          </summary>
          <form action={updateDocuments} className="mt-4 grid gap-5">
            <PlanDocumentFields idPrefix="editar" defaults={{ ...plan, aeeServices: plan.aeeServices ?? suggested.aeeServices ?? null, assessmentAccessibility: plan.assessmentAccessibility ?? suggested.assessmentAccessibility ?? null }} />
            <div><PendingButton className={buttonCls} pendingText="Salvando o PAEE e o PEI…"><CircleCheck size={16} aria-hidden /> Salvar o PAEE e o PEI</PendingButton></div>
          </form>
        </details>
      ) : null}

      <SectionTitle>Objetivos de aprendizagem</SectionTitle>
      <HowToRead className="-mt-2 mb-3" summary="Como ler os objetivos">
        <p>Um objetivo observável descreve algo que o estudante faz e como você reconhece o resultado. Exemplo: identificar o próprio nome entre cinco opções, com pista visual, em quatro de cinco tentativas.</p>
        {hasScale ? <p className="mt-2">Na escala de apoio, ir para a direita é precisar de menos apoio.</p> : null}
      </HowToRead>
      <div className="mb-6 space-y-3">
        {plan.objectives.map((obj) => {
          const markDone = markObjectiveStatus.bind(null, id, obj.id, "alcancado");
          const markReview = markObjectiveStatus.bind(null, id, obj.id, "em_revisao");
          const latest = latestSupport.get(obj.id);
          return (
            <Card key={obj.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-xl text-sm leading-relaxed text-ink">{obj.description}</p>
                {obj.status === "alcancado" ? <Badge tone="green">Alcançado</Badge> :
                 obj.status === "em_revisao" ? <Badge tone="amber">Em revisão</Badge> : <Badge tone="brand">Ativo</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                <Badge>{DIMENSIONS[obj.dimension] ?? obj.dimension}</Badge>
                {obj.bnccCode ? <BnccTag code={obj.bnccCode} detail /> : null}
                {latest ? null : (
                  <>
                    <span>Apoio atual:</span> <SupportPill level={obj.currentSupport} />
                    <span>Apoio que queremos alcançar:</span> <SupportPill level={obj.targetSupport} />
                  </>
                )}
              </div>
              {latest ? (
                <div className="mt-4 max-w-xl">
                  <ObjectiveScale
                    initial={obj.currentSupport}
                    latest={latest.level}
                    target={obj.targetSupport}
                    caption={`Último registro de aula em ${formatDate(latest.date)} · ${latest.count} ${latest.count === 1 ? "registro" : "registros"}`}
                  />
                </div>
              ) : (
                <p className="mt-3 text-xs text-ink-soft">Ainda sem registro de aula para este objetivo.</p>
              )}
              {editable && obj.status === "ativo" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={markDone}><button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-green-soft px-4 text-sm font-medium text-green hover:opacity-80">Marcar como alcançado</button></form>
                  <form action={markReview}><button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-amber-soft px-4 text-sm font-medium text-amber hover:opacity-80">Marcar para revisão</button></form>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      {duaByObjective.length || dua.canPlan ? (
        <Card className="mb-6 min-w-0 max-w-3xl">
          <SectionTitle>Atividades com DUA ligadas a este plano</SectionTitle>
          {duaByObjective.length ? (
            <ul className="space-y-4">
              {duaByObjective.map(({ objective, supports }) => (
                <li key={objective.id} className="min-w-0">
                  <p className="break-words text-sm font-medium text-ink">{objective.description}</p>
                  <ul className="mt-1 space-y-1">
                    {supports.map((support) => (
                      <li key={support.id} className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                        {support.canOpenPlanning ? (
                          <Link href={`/planejamento/${support.planningId}/apoios#apoio-${support.id}`} className="inline-flex min-h-11 min-w-0 items-center break-words font-medium text-brand-strong underline underline-offset-4">{support.planningTitle}</Link>
                        ) : (
                          <span className="min-w-0 break-words py-2 text-ink">{support.planningTitle}</span>
                        )}
                        <ReviewBadge state={support.state} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed text-ink-soft">
              Nenhum apoio com DUA ligado ainda.{" "}
              <Link href={`/estudantes/${id}/dua`} className="font-medium text-brand-strong underline underline-offset-4">Planejar a participação em uma atividade</Link>
            </p>
          )}
          <Assurances className="mt-4" label="Sobre os apoios das atividades" items={[{ icon: ShieldCheck, text: "Apoios de atividade não mudam o plano" }]} />
        </Card>
      ) : null}

      {editable ? (
      <div id="novo-objetivo" className="max-w-3xl scroll-mt-6">
        <Card>
          <SectionTitle>Definir um objetivo de aprendizagem</SectionTitle>
          <p className={`${hintCls} mb-5`}>As respostas formam a frase do objetivo. Campos com * são obrigatórios.</p>
          <form action={addObjective} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <ObjectiveFields {...fieldStyle} studentId={id} />
            <ChoiceField name="condition" label="Com qual apoio ou condição? *" options={CONDITION_SUGGESTIONS} required otherPlaceholder="Ex.: com apoio de um colega" {...fieldStyle} />
            <ChoiceField name="criterion" label="Como saberemos que conseguiu? *" options={CRITERION_SUGGESTIONS} required otherPlaceholder="Ex.: 3 de 4 tentativas" {...fieldStyle} />
            <ChoiceField name="deadlineWeeks" label="Prazo para acompanhar" options={DEADLINE_WEEKS} defaultValue="6" required otherType="number" otherMin={1} otherMax={52} otherPlaceholder="Semanas" {...fieldStyle} />
            <div className="min-w-0">
              <label htmlFor="currentSupport" className={labelCls}>Apoio necessário hoje</label>
              <select id="currentSupport" name="currentSupport" defaultValue={2} className={inputCls}>
                {SUPPORT_LEVELS.map((l) => <option key={l.level} value={l.level}>{l.label}</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="targetSupport" className={labelCls}>Apoio que queremos alcançar</label>
              <select id="targetSupport" name="targetSupport" defaultValue={1} className={inputCls}>
                {SUPPORT_LEVELS.map((l) => <option key={l.level} value={l.level}>{l.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className={buttonCls}>Salvar objetivo no plano</button>
            </div>
          </form>
        </Card>
      </div>
      ) : null}

      {editable ? <details className="mt-8 max-w-3xl rounded-2xl border border-line p-4">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-ink">Encerrar este plano</summary>
        <Assurances
          className="mt-2"
          label="Ao encerrar"
          items={[
            { icon: History, text: "Plano e revisões ficam no histórico" },
            { icon: FilePlus, text: "Depois, a equipe faz outro plano" },
          ]}
        />
        <form action={close} className="mt-4 grid gap-4">
          <ChoiceField name="reason" label="Por que o plano está sendo encerrado? (obrigatório)" options={[...CLOSE_REASONS]} required otherPlaceholder="Descreva o motivo" {...fieldStyle} />
          <div><button type="submit" className={dangerButtonCls}><Archive size={16} aria-hidden /> Encerrar o plano</button></div>
        </form>
      </details> : null}

      <PastPlans plans={pastPlans} />
    </>
  );
}

async function latestSupportByObjective(studentId: string, objectiveIds: string[]): Promise<Map<string, { level: number; date: Date; count: number }>> {
  const prisma = await db();
  const latest = new Map<string, { level: number; date: Date; count: number }>();
  if (!objectiveIds.length) return latest;
  const entries = await prisma.diaryEntry.findMany({
    where: { studentId, objectiveId: { in: objectiveIds } },
    select: { objectiveId: true, supportLevel: true, date: true },
    orderBy: { date: "asc" },
  });
  for (const entry of entries) {
    if (!entry.objectiveId) continue;
    latest.set(entry.objectiveId, { level: entry.supportLevel, date: entry.date, count: (latest.get(entry.objectiveId)?.count ?? 0) + 1 });
  }
  return latest;
}

function daysUntil(date: Date, today: Date) {
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  return Math.round((start(date) - start(today)) / 86_400_000);
}

function dateInput(weeks: number) {
  const date = new Date();
  date.setDate(date.getDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function ProposalReview({ studentId, studentName, proposal, analysis, trace, source, createdBy, createdAt, aiOn, documentDefaults }: {
  studentId: string;
  studentName: string;
  proposal: PlanProposal;
  analysis: CaseAnalysis | null;
  trace: TraceStep[];
  source: string;
  createdBy: string;
  createdAt: Date;
  aiOn: boolean;
  documentDefaults: Partial<PlanDocuments>;
}) {
  const activate = activatePlanDraft.bind(null, studentId);
  const discard = discardPlanDraft.bind(null, studentId);
  const regenerate = generatePlanDraft.bind(null, studentId);
  return (
    <Card className="max-w-3xl scroll-mt-6 border-brand/30">
      <div id="proposta" className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle>Proposta de plano</SectionTitle>
          <p className="-mt-2 text-xs text-ink-soft">Pedida por {createdBy} em {formatDate(createdAt)}.</p>
        </div>
        <Badge tone={source === "ia" ? "brand" : "neutral"}>{source === "ia" ? <><Sparkles size={12} aria-hidden /> Agentes de IA</> : "Motor de regras"}</Badge>
      </div>

      {analysis ? (
        <section aria-labelledby="analise-titulo" className="mb-5 rounded-2xl bg-surface-muted p-4">
          <h3 id="analise-titulo" className="text-sm font-semibold">Análise do caso</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink">{analysis.sintese}</p>
          {analysis.prioridades.length ? (
            <ul className="mt-3 space-y-1 text-sm text-ink-soft">
              {analysis.prioridades.map((item) => <li key={item.dimension}><span className="font-medium text-ink">{DIMENSIONS[item.dimension] ?? item.dimension}:</span> {item.justificativa}</li>)}
            </ul>
          ) : null}
          {analysis.cuidados.length ? <p className="mt-3 text-sm text-ink-soft"><span className="font-medium text-ink">Cuidados:</span> {analysis.cuidados.join("; ")}</p> : null}
        </section>
      ) : null}

      <details className="mb-5 rounded-2xl border border-line px-4">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-ink-soft">Como esta proposta foi feita</summary>
        <ol className="mb-4 space-y-2 text-sm">
          {trace.map((step, index) => <li key={index} className="flex gap-2"><span className="font-medium text-ink">{step.agent}:</span><span className="text-ink-soft">{step.summary}</span></li>)}
        </ol>
      </details>

      <form action={activate} className="space-y-6">
        <MultiChoiceField name="initialSituation" label="O que o estudante já consegue fazer? *" options={INITIAL_SITUATION_OPTIONS} defaultValue={proposal.initialSituation} required {...multiStyle} />
        <PlanDocumentFields
          idPrefix="proposta"
          defaults={mergeProposalDefaults(documentDefaults, proposal)}
        />
        <div>
          <label htmlFor="proposal-review-date" className={labelCls}>Quando a equipe vai revisar este plano? *</label>
          <input id="proposal-review-date" name="reviewDate" type="date" required defaultValue={dateInput(proposal.reviewWeeks)} className={inputCls} />
        </div>
        <fieldset>
          <legend className={labelCls}>Objetivos propostos: marque os que entram no plano</legend>
          <div className="space-y-3">
            {proposal.objectives.map((objective, index) => (
              <label key={index} className="flex cursor-pointer gap-3 rounded-2xl border border-line bg-paper p-4 has-checked:border-brand has-checked:bg-brand-soft/40">
                <input type="checkbox" name="objetivo" value={index} defaultChecked className="mt-1 size-4 shrink-0 accent-[var(--brand)]" />
                <span className="min-w-0">
                  <span className="block text-sm leading-relaxed text-ink">{buildObjectiveDescription({ studentName, ...objective })}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                    <Badge>{DIMENSIONS[objective.dimension] ?? objective.dimension}</Badge>
                    {objective.bnccCode ? <BnccTag code={objective.bnccCode} /> : null}
                    <SupportPill level={objective.currentSupport} /> → <SupportPill level={objective.targetSupport} />
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-ink-soft">{objective.rationale}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">Depois de ativar, dá para acrescentar ou revisar objetivos.</p>
        </fieldset>
        <AIDisclaimer />
        <PendingButton className={buttonCls} pendingText="Ativando o plano…">Ativar plano com os objetivos marcados <ArrowRight size={16} aria-hidden /></PendingButton>
      </form>

      <div className="mt-6 flex flex-wrap items-start gap-3 border-t border-line pt-4">
        <form action={regenerate} className="has-[[data-testid=espera-jardim]]:basis-full">
          <PendingButton className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-soft px-4 text-sm font-medium text-brand-strong hover:bg-lilac" pendingText={aiOn ? "Os agentes estão preparando outra proposta." : "Preparando outra proposta…"} wait={aiOn ? "plano" : undefined}>
            <Sparkles size={16} aria-hidden /> Gerar outra proposta
          </PendingButton>
        </form>
        <form action={discard}>
          <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-ink-soft hover:bg-coral-soft hover:text-coral"><Trash2 size={16} aria-hidden /> Descartar proposta</button>
        </form>
      </div>
    </Card>
  );
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function PlanDocumentCard({ id, title, norm, teacherLabel, teacher, participants, items, plan, missing, alsoMissing = [], showMissing, differences = [] }: {
  id: string;
  title: string;
  norm: string;
  teacherLabel: string;
  teacher: string | null;
  participants?: string | null;
  items: readonly PlanItem[];
  plan: Partial<PlanDocuments>;
  missing: readonly PlanItem[];
  alsoMissing?: readonly string[];
  showMissing: boolean;
  differences?: readonly CensusDifference[];
}) {
  const recorded = items.filter((item) => plan[item.key]?.trim());
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="ui-card min-w-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={`${id}-titulo`} className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
        <span className="text-xs text-ink-soft">Portaria MEC nº 421/2026, {norm}</span>
      </div>
      <dl className="grid gap-3 text-sm">
        {teacher ? <div><dt className="font-medium text-ink">{teacherLabel}</dt><dd className="mt-1 break-words text-ink-soft">{teacher}</dd></div> : null}
        {participants ? <div><dt className="font-medium text-ink">Também participaram</dt><dd className="mt-1 break-words text-ink-soft">{participants}</dd></div> : null}
        {recorded.map((item) => <div key={item.key}><dt className="font-medium text-ink">{item.label}</dt><dd className="mt-1 break-words text-ink-soft">{plan[item.key]}</dd></div>)}
      </dl>
      {showMissing && (missing.length || alsoMissing.length || !teacher) ? (
        <p className="mt-3 text-sm text-amber">
          <a href="#completar-paee-pei" className="underline underline-offset-4">A registrar</a>: {[!teacher && teacherLabel, ...missing.map((item) => item.label), ...alsoMissing].filter((label): label is string => Boolean(label)).map(lowerFirst).join(", ")}.
        </p>
      ) : null}
      {/* Para conferir, sem impedir nada: o Educacenso recusa o vínculo no AEE sem tipo de atendimento. */}
      {showMissing && missing.some((item) => item.key === "aeeServices") ? (
        <p className="mt-3 rounded-xl bg-amber-soft px-3 py-2.5 text-sm text-amber">
          Para conferir: sem os atendimentos do AEE no plano, a escola fica sem referência para o tipo de atendimento, que o Educacenso exige no vínculo do AEE.
        </p>
      ) : null}
      {differences.length ? (
        <div className="mt-3 rounded-xl bg-amber-soft px-3 py-2.5 text-sm text-amber">
          <p className="font-medium">Diferente do último arquivo do Censo</p>
          <ul className="mt-1 grid gap-1">
            {differences.map((difference) => <li key={difference.key} className="break-words">{difference.label} no Censo: {difference.census.join(", ") || "nenhum"}.</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function PastPlans({ plans }: { plans: { id: string; createdAt: Date; closedAt: Date | null; closedReason: string | null; objectives: { status: string }[]; reviews: { onTime: boolean }[] }[] }) {
  if (!plans.length) return null;
  return (
    <section aria-labelledby="planos-anteriores" className="mt-8 max-w-3xl">
      <h2 id="planos-anteriores" className="mb-3 text-sm font-medium tracking-tight text-ink">Planos anteriores</h2>
      <ol className="grid gap-3">
        {plans.map((past) => {
          const reached = past.objectives.filter((objective) => objective.status === "alcancado").length;
          const reviews = reviewSummary(past.reviews);
          return (
            <li key={past.id} className="rounded-2xl border border-line bg-paper-raised p-4">
              <p className="text-sm font-medium text-ink">De {formatDate(past.createdAt)} a {past.closedAt ? formatDate(past.closedAt) : "data não registrada"}</p>
              <p className="mt-1 text-sm text-ink-soft">{past.closedReason ?? "Encerrado"}</p>
              <p className="mt-2 text-xs tabular-nums text-ink-soft">
                {reached} de {past.objectives.length} {past.objectives.length === 1 ? "objetivo alcançado" : "objetivos alcançados"} · {reviews.total} {reviews.total === 1 ? "revisão" : "revisões"}{reviews.total ? `, ${reviews.onTime} no prazo` : ""}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
