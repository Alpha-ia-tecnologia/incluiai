import Link from "next/link";
import { HandHelping, Layers, Lightbulb, ShieldCheck, UserCheck, Users } from "lucide-react";
import { orNotFound, requireStudentPage } from "@/lib/page-context";
import { listPlannings } from "@/lib/dua/plannings";
import { listStudentSupports } from "@/lib/dua/supports";
import { listStudentEvidence, studentFollowUp, type StudentEvidenceView } from "@/lib/dua/applications";
import { APPLICATION_CONTEXTS, CRITERION_STATUS, OBSERVATION, RESULT_STATUS, REVIEW_STATE, type ApplicationResult, type CriterionStatus } from "@/lib/dua/domain";
import { formatDate } from "@/lib/dates";
import { plural } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { ReviewBadge } from "@/components/dua/badges";
import { linkCls } from "@/components/form-styles";
import { SupportSummary } from "@/components/dua/supports/support-summary";
import { ParticipationStart } from "@/components/dua/student/participation-start";
import { BarList, DotStrip, StackedBar, Swatch, TONE_COLOR, withSegmentColors } from "@/components/viz/charts";
import { DataBoard, DataCard } from "@/components/viz/cards";
import { CONTEXTS, labelOf, toneOf, type Tone } from "@/lib/scale";
import { Assurances, HowToRead, Steps } from "@/components/explain";

const resultTerm = (result: ApplicationResult) => CRITERION_STATUS[RESULT_STATUS[result]];

export default async function StudentDuaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireStudentPage(id, "Atividades com DUA", { tab: "dua" });
  const [plannings, supports, evidence, followUp] = await orNotFound(Promise.all([
    listPlannings(user),
    listStudentSupports(user, id),
    listStudentEvidence(user, id),
    studentFollowUp(user, id),
  ]));
  const planningOptions = plannings.map((planning) => ({
    id: planning.id,
    label: `${planning.title}${planning.className ? ` · ${planning.className}` : ""} (versão ${planning.version}, ${REVIEW_STATE[planning.state].label.toLowerCase()})`,
  }));

  return (
    <>
      <PageHeader level={2} title="Atividades com DUA" />

      <div className="grid min-w-0 gap-8">
        <EvidenceSummary evidence={evidence} />

        <Card className="min-w-0 max-w-3xl">
          <SectionTitle>Planejar participação em atividade</SectionTitle>
          <Steps
            label="Como funciona"
            className="mb-5"
            items={[
              { icon: Layers, label: "Escolha ou crie a atividade" },
              { icon: Users, label: "Mesmo planejamento da turma" },
              { icon: HandHelping, label: "Planeje o apoio deste estudante" },
            ]}
          />
          <ParticipationStart studentId={id} plannings={planningOptions} />
        </Card>

        <section aria-labelledby="dua-apoios" className="min-w-0 max-w-3xl">
          <h2 id="dua-apoios" className="mb-3 text-xl font-semibold text-ink">Apoios nas atividades</h2>
          {supports.length ? (
            <>
              <Assurances label="O que o apoio não muda" className="mb-4" items={[{ icon: ShieldCheck, text: "Não muda perfil nem Plano de ensino" }]} />
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
            </>
          ) : (
            <EmptyState character="planning" title="Nenhum apoio individual ainda" hint="Use “Planejar participação em atividade” para começar." />
          )}
        </section>

        <section aria-labelledby="dua-evidencias" className="min-w-0 max-w-3xl">
          <h2 id="dua-evidencias" className="mb-1 text-xl font-semibold text-ink">Evidências</h2>
          {evidence.length ? (
            <>
              <HowToRead summary="Como ler os critérios" className="mb-3">
                “Não houve oportunidade de observar” e “Ainda não registrado” não querem dizer “ainda não demonstrou”: não contam como progresso nem como dificuldade. Só o que foi observado forma o resultado.
              </HowToRead>
              <ul className="grid min-w-0 gap-3">
                {evidence.map((item) => <EvidenceItem key={item.id} item={item} />)}
              </ul>
            </>
          ) : (
            <EmptyState character="planning" title="Nenhuma evidência registrada" hint="Aparecem aqui depois que a atividade for aplicada." />
          )}
        </section>

        <section aria-labelledby="dua-proximos" className="min-w-0 max-w-3xl">
          <h2 id="dua-proximos" className="mb-3 text-xl font-semibold text-ink">Próximos passos sugeridos</h2>
          {followUp.length ? (
            <>
              <Assurances
                label="Sobre as recomendações"
                items={[
                  { icon: Lightbulb, text: "Sugestão, não decisão nem resultado" },
                  { icon: UserCheck, text: "A equipe revisa e decide" },
                ]}
              />
              <HowToRead summary="Recomendação, decisão e resultado" className="mb-3">
                <dl className="grid gap-1.5">
                  <div><dt className="inline font-medium text-ink">Recomendação: </dt><dd className="inline">sugestão para a equipe conversar, a partir das evidências e dos apoios.</dd></div>
                  <div><dt className="inline font-medium text-ink">Decisão profissional: </dt><dd className="inline">o que a equipe combina e registra no planejamento ou no Plano de ensino.</dd></div>
                  <div><dt className="inline font-medium text-ink">Resultado observado: </dt><dd className="inline">o que foi visto na aplicação, registrado nas evidências.</dd></div>
                </dl>
              </HowToRead>
              <ul className="grid min-w-0 gap-3">
                {followUp.map((suggestion) => (
                  <li key={suggestion.text} className="min-w-0">
                    <Card className="min-w-0">
                      <Badge tone="info">Recomendação para a equipe</Badge>
                      <p className="mt-2 text-sm font-medium text-ink">{suggestion.text}</p>
                      <dl className="mt-2 grid gap-1 text-sm">
                        <div className="min-w-0"><dt className="inline font-medium text-ink">Com base em: </dt><dd className="inline break-words text-ink-soft">{suggestion.basis}</dd></div>
                        <div className="min-w-0"><dt className="inline font-medium text-ink">O que falta observar: </dt><dd className="inline break-words text-ink-soft">{suggestion.pending}</dd></div>
                      </dl>
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-ink-soft">Nenhuma recomendação ainda: elas surgem das evidências.</p>
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
            <Badge tone={toneOf(CONTEXTS, item.context)}>{CONTEXTS[item.context]?.long ?? labelOf(CONTEXTS, item.context)}</Badge>
            <Badge tone="neutral">{formatDate(item.date)}</Badge>
          </div>
        </div>
        <p className="mt-1 text-xs text-ink-soft">Versão {item.versionNumber} da atividade · registrado por {item.authorName}</p>

        <p className="mt-3 text-sm text-ink">
          <span className="font-medium">{labelOf(OBSERVATION, item.observation)}.</span>{" "}
          {item.result ? `${resultTerm(item.result).label} os critérios observados.` : "Sem resultado: nenhum critério observado (não conta como progresso)."}
        </p>

        {item.criteria.length ? (
          <ul className="mt-3 grid min-w-0 gap-2">
            {item.criteria.map((criterion) => (
              <li key={criterion.criterionId} className="flex min-w-0 flex-wrap items-start justify-between gap-2 rounded-lg bg-surface-muted/60 px-3 py-2 text-sm">
                <span className="min-w-0 break-words text-ink">{criterion.description}</span>
                <Badge tone={toneOf(CRITERION_STATUS, criterion.status)}>{labelOf(CRITERION_STATUS, criterion.status)}</Badge>
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

const RESULT_LEGEND: { tone: Tone; label: string }[] = [
  ...(Object.keys(RESULT_STATUS) as ApplicationResult[]).map((result) => ({ tone: resultTerm(result).tone, label: resultTerm(result).label })),
  { tone: "neutral", label: "Sem resultado (não conta)" },
];

function EvidenceSummary({ evidence }: { evidence: ReadonlyArray<StudentEvidenceView> }) {
  if (!evidence.length) return null;
  const criteria = evidence.flatMap((item) => item.criteria);
  const count = (status: CriterionStatus) => criteria.filter((criterion) => criterion.status === status).length;
  const observed = withSegmentColors((["demonstrado", "parcial", "ainda_nao_demonstrado"] as const).map((status) => ({ key: status, ...CRITERION_STATUS[status], value: count(status) })));
  const notObserved = (["sem_oportunidade", "nao_registrado"] as const).map((status) => ({ status, ...CRITERION_STATUS[status], value: count(status) }));
  const ordered = [...evidence].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-30);
  const results = { sim: 0, parcial: 0, nao: 0, none: 0 };
  for (const item of ordered) results[item.result ?? "none"] += 1;
  const contexts = APPLICATION_CONTEXTS.map((context) => ({ key: context, label: CONTEXTS[context].long ?? CONTEXTS[context].label, value: evidence.filter((item) => item.context === context).length }));

  return (
    <section aria-labelledby="dua-resumo" className="min-w-0 max-w-3xl">
      <h2 id="dua-resumo" className="mb-1 text-xl font-semibold text-ink">Resumo das evidências</h2>
      <p className="mb-4 text-sm tabular-nums text-ink-soft">{plural(evidence.length, "evidência", "evidências")} · {plural(criteria.length, "critério", "critérios")}</p>
      <DataBoard className="sm:grid-cols-2">
        <DataCard title="Critérios observados" hint="Somando todas as evidências." className="sm:col-span-2">
          <StackedBar segments={observed} empty="Nenhum critério foi observado ainda." />
          <div className="mt-4 rounded-xl border border-dashed border-line p-3">
            <p className="text-xs font-medium text-ink">Fora da conta</p>
            <ul className="mt-2 grid gap-1.5 text-sm">
              {notObserved.map((item) => (
                <li key={item.status} className="flex min-w-0 items-center gap-2.5">
                  <Swatch color={TONE_COLOR[item.tone]} />
                  <span className="min-w-0 flex-1 text-ink">{item.label}</span>
                  <span className="text-xs tabular-nums text-ink-soft">{item.value}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">Não observados: não contam como progresso nem dificuldade.</p>
          </div>
        </DataCard>
        <DataCard title="Resultado de cada registro" hint={ordered.length < evidence.length ? `Os ${ordered.length} mais recentes, do mais antigo ao mais novo.` : "Do mais antigo ao mais novo."}>
          <DotStrip
            label="Resultado de cada evidência, da mais antiga à mais nova"
            legend={RESULT_LEGEND}
            items={ordered.map((item) => ({
              key: item.id,
              title: `${formatDate(item.date)}, ${labelOf(CONTEXTS, item.context)}, ${item.planningTitle}: ${item.result ? resultTerm(item.result).label.toLowerCase() : "sem resultado, nenhum critério observado"}`,
              tone: item.result ? resultTerm(item.result).tone : "neutral",
            }))}
          />
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            {results.sim} demonstrou, {results.parcial} em parte, {results.nao} ainda não{results.none ? `; ${results.none} sem resultado (não conta)` : ""}.
          </p>
        </DataCard>
        <DataCard title="Onde a atividade foi aplicada">
          <BarList rows={contexts} />
        </DataCard>
      </DataBoard>
    </section>
  );
}
