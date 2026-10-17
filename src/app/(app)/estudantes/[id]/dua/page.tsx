import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canSeePedagogicalDetail, getCurrentUser } from "@/lib/auth";
import { canPlanDua } from "@/lib/dua/access";
import { DuaError } from "@/lib/dua/shared";
import { listPlannings } from "@/lib/dua/plannings";
import { listStudentSupports } from "@/lib/dua/supports";
import { listStudentEvidence, studentFollowUp, type StudentEvidenceView } from "@/lib/dua/applications";
import { APPLICATION_CONTEXTS, APPLICATION_CONTEXT_LABEL, CRITERION_STATUS_LABEL, OBSERVATION_LABEL, REVIEW_STATE_LABEL, type CriterionStatus } from "@/lib/dua/domain";
import { formatDate } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { ReviewBadge, linkCls } from "@/components/dua/dua-ui";
import { SupportSummary } from "@/components/dua/supports/support-summary";
import { ParticipationStart } from "@/components/dua/student/participation-start";
import { DataBoard, DataCard, DotStrip, withSegmentColors, type Tone } from "@/components/data-viz";
import { BarList, SIGNAL, StackedBar, Swatch } from "@/components/charts";

export const dynamic = "force-dynamic";

// O texto acompanha a cor: "sem oportunidade" e "não registrado" ficam neutros,
// porque não são análise da aprendizagem.
const CRITERION_TONE: Record<CriterionStatus, "green" | "amber" | "coral" | "neutral"> = {
  demonstrado: "green",
  parcial: "amber",
  ainda_nao_demonstrado: "coral",
  sem_oportunidade: "neutral",
  nao_registrado: "neutral",
};

const RESULT_TEXT: Record<"sim" | "parcial" | "nao", string> = {
  sim: "Demonstrou os critérios observados.",
  parcial: "Demonstrou em parte os critérios observados.",
  nao: "Ainda não demonstrou os critérios observados.",
};

// Aba "Atividades com DUA" (RF01, segunda entrada): planejar a participação do
// estudante e ver apoios, evidências e próximos passos de todas as atividades.
export default async function StudentDuaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Família e terapeuta não acessam o DUA. O layout já conferiu o acesso ao estudante.
  if (!canSeePedagogicalDetail(user.role) || !canPlanDua(user)) redirect(`/estudantes/${id}`);

  let data;
  try {
    const [plannings, supports, evidence, followUp] = await Promise.all([
      listPlannings(user),
      listStudentSupports(user, id),
      listStudentEvidence(user, id),
      studentFollowUp(user, id),
    ]);
    data = { plannings, supports, evidence, followUp };
  } catch (error) {
    if (error instanceof DuaError) notFound();
    throw error;
  }
  const { plannings, supports, evidence, followUp } = data;
  const planningOptions = plannings.map((planning) => ({
    id: planning.id,
    label: `${planning.title}${planning.className ? ` · ${planning.className}` : ""} (versão ${planning.version}, ${REVIEW_STATE_LABEL[planning.state].toLowerCase()})`,
  }));

  return (
    <>
      <PageHeader
        title="Atividades com DUA"
        lede="Atividades planejadas para a turma com o Desenho Universal para a Aprendizagem e o que foi planejado e observado para este estudante em cada uma."
      />

      <div className="grid min-w-0 gap-8">
        <EvidenceSummary evidence={evidence} />

        <Card className="min-w-0 max-w-3xl">
          <SectionTitle>Planejar participação em atividade</SectionTitle>
          <ParticipationStart studentId={id} plannings={planningOptions} />
        </Card>

        <section aria-labelledby="dua-apoios" className="min-w-0 max-w-3xl">
          <h2 id="dua-apoios" className="mb-1 text-lg font-semibold text-ink">Apoios nas atividades</h2>
          <p className="mb-4 text-sm text-ink-soft">Apoios individuais planejados para este estudante. Eles não mudam o perfil nem o Plano de ensino.</p>
          {supports.length ? (
            <ul className="grid min-w-0 gap-3">
              {supports.map((support) => (
                <li key={support.id} className="min-w-0">
                  <Card className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 break-words text-sm font-medium text-ink">
                        {support.canOpenPlanning ? (
                          <Link href={`/planejamento/${support.planningId}/apoios#apoio-${support.id}`} className={`${linkCls} inline-flex min-h-11 items-center`}>{support.planningTitle}</Link>
                        ) : support.planningTitle}
                      </h3>
                      <ReviewBadge state={support.state} />
                    </div>
                    <p className="mb-3 text-xs text-ink-soft">
                      Responsável: {support.responsibleName} · atualizado em {formatDate(support.updatedAt)}
                      {support.state === "validado" && support.validatedByName && support.validatedAt ? ` · validado por ${support.validatedByName} em ${formatDate(support.validatedAt)}` : ""}
                    </p>
                    <SupportSummary data={support.data} showProfile={false} />
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhum apoio individual ainda" hint="Use “Planejar participação em atividade” para começar." />
          )}
        </section>

        <section aria-labelledby="dua-evidencias" className="min-w-0 max-w-3xl">
          <h2 id="dua-evidencias" className="mb-1 text-lg font-semibold text-ink">Evidências</h2>
          <p className="mb-2 text-sm text-ink-soft">O que foi observado quando a atividade foi aplicada, na sala comum ou no AEE.</p>
          <p className="mb-4 rounded-xl bg-amber-soft px-3 py-2 text-sm leading-relaxed text-amber-900">
            “Não houve oportunidade de observar” e “Ainda não registrado” não querem dizer “ainda não demonstrou”. Esses critérios não contam como progresso nem como dificuldade: só o que foi observado forma o resultado.
          </p>
          {evidence.length ? (
            <ul className="grid min-w-0 gap-3">
              {evidence.map((item) => <EvidenceItem key={item.id} item={item} />)}
            </ul>
          ) : (
            <EmptyState title="Nenhuma evidência registrada" hint="As evidências aparecem aqui quando a atividade for aplicada e o registro for feito." />
          )}
        </section>

        <section aria-labelledby="dua-proximos" className="min-w-0 max-w-3xl">
          <h2 id="dua-proximos" className="mb-1 text-lg font-semibold text-ink">Próximos passos sugeridos</h2>
          <p className="mb-4 text-sm text-ink-soft">Recomendações para a equipe revisar, montadas a partir das evidências e dos apoios planejados.</p>
          <dl className="mb-4 grid min-w-0 gap-3 sm:grid-cols-3">
            <div className="min-w-0 rounded-xl bg-brand-soft/50 p-3">
              <dt className="text-sm font-medium text-ink">Recomendação</dt>
              <dd className="mt-1 text-xs leading-relaxed text-ink-soft">Sugestão para a equipe conversar. Não é decisão nem resultado.</dd>
            </div>
            <div className="min-w-0 rounded-xl bg-surface-muted p-3">
              <dt className="text-sm font-medium text-ink">Decisão profissional</dt>
              <dd className="mt-1 text-xs leading-relaxed text-ink-soft">O que a equipe combina fazer, registrado por ela no planejamento ou no Plano de ensino.</dd>
            </div>
            <div className="min-w-0 rounded-xl bg-green-soft/60 p-3">
              <dt className="text-sm font-medium text-ink">Resultado observado</dt>
              <dd className="mt-1 text-xs leading-relaxed text-ink-soft">O que foi visto na aplicação da atividade, registrado nas evidências.</dd>
            </div>
          </dl>
          {followUp.length ? (
            <ul className="grid min-w-0 gap-3">
              {followUp.map((suggestion) => (
                <li key={suggestion.text} className="min-w-0">
                  <Card className="min-w-0">
                    <Badge tone="brand">Recomendação para a equipe</Badge>
                    <p className="mt-2 text-sm font-medium text-ink">{suggestion.text}</p>
                    <dl className="mt-2 grid gap-1 text-sm">
                      <div className="min-w-0"><dt className="inline font-medium text-ink">Com base em: </dt><dd className="inline break-words text-ink-soft">{suggestion.basis}</dd></div>
                      <div className="min-w-0"><dt className="inline font-medium text-ink">O que falta observar: </dt><dd className="inline break-words text-ink-soft">{suggestion.pending}</dd></div>
                    </dl>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Ainda não há recomendação: elas surgem a partir das evidências registradas.</p>
          )}
        </section>
      </div>
    </>
  );
}

function EvidenceItem({ item }: { item: StudentEvidenceView }) {
  const details = [
    ["Opções oferecidas", item.optionsOffered.join("; ")],
    ["Forma de participação", item.participationForm],
    ["Escolha ou manifestação do estudante", item.studentChoice],
    ["Apoio disponibilizado", item.supportProvided],
    ["Resposta observada", item.observedResponse],
    ["Barreiras que permaneceram", item.remainingBarriers],
    ["Próximo passo registrado", item.nextStep],
  ].filter(([, value]) => value?.trim());

  return (
    <li className="min-w-0">
      <Card className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 break-words text-sm font-medium text-ink">
            {item.canOpenPlanning ? (
              <Link href={`/planejamento/${item.planningId}/aplicacao`} className={`${linkCls} inline-flex min-h-11 items-center`}>{item.planningTitle}</Link>
            ) : item.planningTitle}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="neutral">{APPLICATION_CONTEXT_LABEL[item.context] ?? item.context}</Badge>
            <Badge tone="neutral">{formatDate(item.date)}</Badge>
          </div>
        </div>
        <p className="mt-1 text-xs text-ink-soft">Versão {item.versionNumber} da atividade · registrado por {item.authorName}</p>

        <p className="mt-3 text-sm text-ink">
          <span className="font-medium">{OBSERVATION_LABEL[item.observation] ?? item.observation}.</span>{" "}
          {item.result ? RESULT_TEXT[item.result] : "Sem resultado: nenhum critério foi observado, e este registro não entra como progresso."}
        </p>

        {item.criteria.length ? (
          <ul className="mt-3 grid min-w-0 gap-2">
            {item.criteria.map((criterion) => (
              <li key={criterion.criterionId} className="flex min-w-0 flex-wrap items-start justify-between gap-2 rounded-lg bg-surface-muted/60 px-3 py-2 text-sm">
                <span className="min-w-0 break-words text-ink">{criterion.description}</span>
                <Badge tone={CRITERION_TONE[criterion.status] ?? "neutral"}>{CRITERION_STATUS_LABEL[criterion.status] ?? criterion.status}</Badge>
              </li>
            ))}
          </ul>
        ) : null}

        {details.length ? (
          <dl className="mt-3 grid gap-2 text-sm">
            {details.map(([term, value]) => (
              <div key={term} className="min-w-0">
                <dt className="font-medium text-ink">{term}</dt>
                <dd className="mt-0.5 whitespace-pre-line break-words text-ink-soft">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Card>
    </li>
  );
}

const RESULT_TONE: Record<"sim" | "parcial" | "nao", Tone> = { sim: "good", parcial: "mid", nao: "alert" };
const RESULT_SHORT: Record<"sim" | "parcial" | "nao", string> = { sim: "demonstrou", parcial: "demonstrou em parte", nao: "ainda não demonstrou" };
const RESULT_LEGEND: { tone: Tone; label: string }[] = [
  { tone: "good", label: "Demonstrou" },
  { tone: "mid", label: "Em parte" },
  { tone: "alert", label: "Ainda não demonstrou" },
  { tone: "neutral", label: "Sem resultado (não conta)" },
];
const CONTEXT_SHORT: Record<string, string> = { sala_comum: "Sala comum", aee: "AEE" };
const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

// Resumo das evidências do estudante, a partir da mesma lista mostrada abaixo.
// Só critério observado entra na barra; "sem oportunidade" e "não registrado"
// ficam à parte e não contam como progresso nem como dificuldade.
function EvidenceSummary({ evidence }: { evidence: ReadonlyArray<StudentEvidenceView> }) {
  if (!evidence.length) {
    return (
      <section aria-labelledby="dua-resumo" className="min-w-0 max-w-3xl">
        <h2 id="dua-resumo" className="mb-1 text-lg font-semibold text-ink">Resumo das evidências</h2>
        <p className="text-sm text-ink-soft">O resumo aparece depois da primeira evidência registrada na aplicação de uma atividade.</p>
      </section>
    );
  }
  const criteria = evidence.flatMap((item) => item.criteria);
  const count = (status: CriterionStatus) => criteria.filter((criterion) => criterion.status === status).length;
  const observed = withSegmentColors((["demonstrado", "parcial", "ainda_nao_demonstrado"] as const).map((status) => ({ key: status, label: CRITERION_STATUS_LABEL[status], value: count(status) })));
  const notObserved = (["sem_oportunidade", "nao_registrado"] as const).map((status) => ({ status, label: CRITERION_STATUS_LABEL[status], value: count(status) }));
  // Do registro mais antigo ao mais recente; os 30 últimos cabem sem rolagem.
  const ordered = [...evidence].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-30);
  const results = { sim: 0, parcial: 0, nao: 0, none: 0 };
  for (const item of ordered) results[item.result ?? "none"] += 1;
  const contexts = APPLICATION_CONTEXTS.map((context) => ({ key: context, label: APPLICATION_CONTEXT_LABEL[context], value: evidence.filter((item) => item.context === context).length }));

  return (
    <section aria-labelledby="dua-resumo" className="min-w-0 max-w-3xl">
      <h2 id="dua-resumo" className="mb-1 text-lg font-semibold text-ink">Resumo das evidências</h2>
      <p className="mb-4 text-sm text-ink-soft">{plural(evidence.length, "evidência registrada", "evidências registradas")}, com {plural(criteria.length, "critério", "critérios")} no total. Os detalhes estão na lista de evidências.</p>
      <DataBoard className="sm:grid-cols-2">
        <DataCard title="Critérios observados" hint="Como cada critério observado ficou, somando todas as evidências." className="sm:col-span-2">
          <StackedBar segments={observed} empty="Nenhum critério foi observado ainda." />
          <div className="mt-4 rounded-xl border border-dashed border-line p-3">
            <p className="text-xs font-medium text-ink">Fora da conta</p>
            <ul className="mt-2 grid gap-1.5 text-sm">
              {notObserved.map((item) => (
                <li key={item.status} className="flex min-w-0 items-center gap-2.5">
                  <Swatch color={SIGNAL.track} />
                  <span className="min-w-0 flex-1 text-ink">{item.label}</span>
                  <span className="text-xs tabular-nums text-ink-soft">{item.value}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">Esses critérios não foram observados: não contam como progresso nem como dificuldade.</p>
          </div>
        </DataCard>
        <DataCard title="Resultado de cada registro" hint={ordered.length < evidence.length ? `Os ${ordered.length} registros mais recentes, do mais antigo ao mais novo.` : "Uma marca por evidência, da mais antiga à mais nova."}>
          <DotStrip
            label="Resultado de cada evidência, da mais antiga à mais nova"
            legend={RESULT_LEGEND}
            items={ordered.map((item) => ({
              key: item.id,
              title: `${formatDate(item.date)}, ${CONTEXT_SHORT[item.context] ?? item.context}, ${item.planningTitle}: ${item.result ? RESULT_SHORT[item.result] : "sem resultado, nenhum critério observado"}`,
              tone: item.result ? RESULT_TONE[item.result] : "neutral",
            }))}
          />
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            {results.sim} demonstrou, {results.parcial} em parte, {results.nao} ainda não{results.none ? `; ${results.none} sem resultado, que não entra como progresso` : ""}.
          </p>
        </DataCard>
        <DataCard title="Onde a atividade foi aplicada" hint="Evidências na sala comum e no AEE.">
          <BarList rows={contexts} color={SIGNAL.cyan} />
        </DataCard>
      </DataBoard>
    </section>
  );
}
