import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, CircleSlash, Lightbulb, Scale, ShieldCheck, UserCheck } from "lucide-react";
import { REASSESS_WEEKS, smallNumber } from "@/lib/assessment";
import { AUDIT_ACTION } from "@/lib/audit";
import { PERIODS, type Dashboard } from "@/lib/dashboard";
import { formatDate } from "@/lib/dates";
import type { duaIndicators } from "@/lib/dua/indicators";
import { AI_BLOCK_DECISION } from "@/lib/dua/domain";
import { decimal, plural } from "@/lib/format";
import { roleLabel } from "@/lib/roles";
import { supportInfo } from "@/lib/scale";
import { Assurances, HowToRead } from "@/components/explain";
import { BarList, type ChartSegment, ColumnChart, HatchedDonut, Legend, Meter, RingStat, SIGNAL, ShareRing, StackedBar, StatusPill, TONE_COLOR, withSegmentColors } from "@/components/viz/charts";
import { StatTile } from "@/components/viz/cards";
import { SCALE_MARKER, SupportScale } from "@/components/viz/student-viz";
import { MonthGrid } from "./charts";

type Dua = Awaited<ReturnType<typeof duaIndicators>>;

const ACCESS_LABELS: Record<string, string> = { [AUDIT_ACTION.viewed]: "Consultas", [AUDIT_ACTION.created]: "Inclusões", [AUDIT_ACTION.edited]: "Alterações", [AUDIT_ACTION.sent]: "Envios à IA de reserva" };

function CardHeader({ title, hint, help, href, linkLabel }: { title: string; hint?: string; help?: ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-medium tracking-tight text-ink">{title}</h3>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-ink-soft">{hint}</p> : null}
        {help ? <HowToRead>{help}</HowToRead> : null}
      </div>
      {href ? <Link href={href} className="circle-link !size-11" aria-label={linkLabel ?? `Abrir ${title.toLowerCase()}`}><ArrowUpRight size={16} aria-hidden /></Link> : null}
    </div>
  );
}

function View({ id, title, description, help, note, children }: { id: string; title: string; description?: string; help?: ReactNode; note?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-24">
      <div className="mb-3.5 px-1">
        <h2 id={`${id}-titulo`} className="font-display text-xl font-medium tracking-tight text-ink sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft">{description}</p> : null}
        {note ? <div className="mt-2">{note}</div> : null}
        {help ? <HowToRead>{help}</HowToRead> : null}
      </div>
      {children}
    </section>
  );
}

function CountList({ label, items }: { label: string; items: { key: string; value: number; label: string }[] }) {
  return (
    <ul aria-label={label} className="flex min-w-0 flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item.key} className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-full bg-surface-muted/70 py-1 pl-1 pr-3 text-xs text-ink">
          <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-accent-sky px-1.5 text-sm font-semibold tabular-nums text-ink-strong">{item.value}</span>
          <span className="min-w-0">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function AiStat({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-x-4 py-2.5">
      <dt className="min-w-0 text-sm text-ink">{label}{detail ? <span className="block text-xs text-ink-soft">{detail}</span> : null}</dt>
      <dd className="shrink-0 font-display text-2xl font-semibold leading-none tracking-tight text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function DuaIndicatorCard({ ringId, label, definition, unit, numerator, denominator, value, noBaseText }: {
  ringId: string; label: string; definition: string; unit: string; numerator: number; denominator: number; value: number | null; noBaseText: string;
}) {
  return (
    <article className="dash-card flex min-w-0 flex-col">
      <CardHeader title={label} help={definition} />
      <div className="flex min-w-0 items-center gap-4">
        <div aria-hidden className="shrink-0">
          <RingStat id={ringId} value={value} label={label} size={64}><span /></RingStat>
        </div>
        <div className="min-w-0">
          {value === null
            ? <p className="text-sm font-medium leading-snug text-ink-soft">{noBaseText}</p>
            : <p className="font-display text-3xl font-bold leading-none tracking-tight text-ink">{decimal(value)}%</p>}
          <p className="mt-2 text-sm text-ink">{numerator} de {denominator} {unit}</p>
        </div>
      </div>
    </article>
  );
}

export function ObjectivesView({ data, periodText }: { data: Dashboard; periodText: string }) {
  const { learning: l } = data;
  const support = l.support;
  return (
    <View id="objetivos" title="Objetivos e aprendizagem" help="Avançar é precisar de menos apoio na mesma tarefa (0 é independente; 5, apoio físico total).">
      <div className="dash-board grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        <section aria-labelledby="apoio-titulo" className="dash-card">
          <h3 id="apoio-titulo" className="text-base font-medium tracking-tight">Nível de apoio</h3>
          {support.initial !== null && support.latest !== null && support.target !== null ? (
            <>
              <p className="mt-1 text-xs text-ink-soft">Média de {plural(support.objectives, "objetivo", "objetivos")} com registro</p>
              <SupportScale initial={support.initial} latest={support.latest} target={support.target} />
              <dl className="mt-4 flex min-w-0 flex-wrap gap-1.5">
                {([["No início", support.initial, SCALE_MARKER.initial], ["Agora", support.latest, SCALE_MARKER.latest], ["Meta", support.target, SCALE_MARKER.target]] as const).map(([label, value, marker]) => (
                  <div key={label} className="inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5 rounded-full bg-surface-muted/70 py-1.5 pl-2.5 pr-3 text-xs">
                    <dt className="inline-flex items-center gap-1.5 self-center text-ink-soft"><span aria-hidden className={`inline-block size-2.5 shrink-0 ${marker}`} />{label}</dt>
                    <dd className="font-display font-bold text-base leading-none tracking-tight text-ink tabular-nums">{decimal(value, { fixed: true })}</dd>
                    <dd className="text-ink-soft">{supportInfo(Math.round(value)).label}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : <p className="mt-2 text-sm text-ink-soft">Ainda não há registros de aula ligados a objetivos.</p>}
        </section>
        <div className="dash-card">
          <CardHeader title="Objetivos por área" />
          <BarList rows={l.byDimension.map((row) => ({ ...row, detail: plural(row.achieved, "alcançado", "alcançados") }))} empty="Nenhum objetivo cadastrado." />
        </div>
        <div className="dash-card">
          <CardHeader title="Critério de sucesso" hint={`Registros de aula · ${periodText}.`} />
          <StackedBar segments={withSegmentColors(l.criterion)} />
        </div>
        <div className="dash-card">
          <CardHeader title="Sondagem" hint={`${smallNumber(l.assessment.withBaseline)} de ${plural(l.assessment.total, "estudante", "estudantes")} com linha de base`} help={`Em dia: sondagem reaplicada nas últimas ${REASSESS_WEEKS} semanas.`} />
          <p className="font-display text-3xl font-bold tracking-tight text-ink"><span className="tabular-nums">{smallNumber(l.assessment.upToDate)}</span> <span className="text-base text-ink-soft">em dia</span></p>
          {l.assessment.improved.some((row) => row.value > 0) ? (
            <ul className="mt-3 grid gap-1 text-sm text-ink-soft">
              {l.assessment.improved.filter((row) => row.value > 0).map((row) => <li key={row.label}><span className="text-ink">{row.label}:</span> {smallNumber(row.value)} com menos apoio que na linha de base</li>)}
            </ul>
          ) : null}
        </div>
        <div className="dash-card">
          <CardHeader title="Relatórios do período" hint="Validados para a família · últimos 6 meses" />
          <p className="font-display text-3xl font-bold tracking-tight text-ink"><span className="tabular-nums">{l.reports.covered}</span> <span className="text-base text-ink-soft">de {plural(l.reports.total, "estudante", "estudantes")}</span></p>
        </div>
        <div className="dash-card">
          <CardHeader title="Objetivos por componente da BNCC" hint={l.bncc.total ? `${l.bncc.linked} de ${l.bncc.total} objetivos com habilidade da BNCC` : undefined} />
          <BarList rows={l.bncc.byComponent} empty="Nenhum objetivo ligado à BNCC ainda." />
        </div>
      </div>
    </View>
  );
}

export function LessonsView({ data, periodText }: { data: Dashboard; periodText: string }) {
  const { overview: o, records: r, calendar: cal, scope } = data;
  const participation = withSegmentColors(r.participation);
  const participationTotal = participation.reduce((sum, segment) => sum + segment.value, 0);
  const strategyMax = Math.max(1, ...r.strategies.map((item) => item.value));
  const strategyHalf = Math.ceil(r.strategies.length / 2);
  return (
    <View id="aulas" title="Aulas e registros">
      <div className="dash-board grid gap-3.5 xl:grid-cols-3">
        <div className="dash-card xl:col-span-2">
          <CardHeader title={r.weekly ? "Registros por semana" : "Registros por mês"} hint={`${PERIODS[scope.period]}.`} />
          {r.series.some((row) => row.value > 0) ? <ColumnChart rows={r.series} label={r.weekly ? "Registros de aula por semana" : "Registros de aula por mês"} /> : <p className="text-sm text-ink-soft">Nenhum registro de aula · {periodText}.</p>}
        </div>
        <div className="dash-card">
          <CardHeader title="Quem registrou" />
          <BarList rows={r.byAuthor.map((row) => ({ ...row, label: roleLabel(row.key, { short: true }) }))} />
        </div>
        <section aria-labelledby="participacao-titulo" className="dash-card">
          <h3 id="participacao-titulo" className="text-base font-medium tracking-tight">Participação nas aulas</h3>
          {participationTotal ? (
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <HatchedDonut id="rosca-participacao" segments={participation} label={`Participação: ${participation.map((segment) => `${segment.label} ${segment.value}`).join(", ")}`} size={140} thickness={18}>
                <span className="font-display text-3xl leading-none tracking-tight">{o.fullParticipationPct ?? 0}%</span>
                <span className="mt-1 text-xs leading-tight text-ink-soft">{o.fullParticipation} de {o.records}<br />plenas</span>
              </HatchedDonut>
              <div className="min-w-[150px] flex-1"><Legend segments={participation} /></div>
            </div>
          ) : <p className="mt-2 text-sm text-ink-soft">Nenhum registro de aula · {periodText}.</p>}
        </section>
        <section aria-labelledby="meses-titulo" className="dash-card min-w-0 xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id="meses-titulo" className="text-base font-medium tracking-tight">Meses com registro de aula</h3>
              <p className="mt-1 text-xs text-ink-soft">
                {cal.schoolMonths
                  ? <><strong className="text-sm font-semibold text-ink tabular-nums">{cal.monthsWithRecords} de {cal.schoolMonths}</strong> {cal.schoolMonths === 1 ? "mês letivo" : "meses letivos"} · todo o histórico</>
                  : "Ainda não há registros de aula · todo o histórico"}
              </p>
              <HowToRead>Meses letivos desde o primeiro registro de aula. Este quadro não segue o filtro de período.</HowToRead>
            </div>
            {cal.gaps ? <StatusPill tone="alert">{plural(cal.gaps, "mês sem registro", "meses sem registro")}</StatusPill> : null}
          </div>
          <MonthGrid years={cal.years} />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-soft">
            <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full border-2 border-signal-lime-soft bg-signal-lime" />Com registro</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className="flex size-3 items-center justify-center rounded-full bg-signal-orange" />Mês letivo sem registro</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full border border-dashed border-line" />Mês atual</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full border border-line bg-paper" />Recesso (janeiro)</li>
          </ul>
        </section>
        <div className="dash-card xl:col-span-3">
          <CardHeader title="Estratégias que mais funcionaram" hint={`Marcadas em “o que funcionou” · ${periodText}`} />
          {r.strategies.length ? (
            <div className="grid min-w-0 gap-x-8 gap-y-3 md:grid-cols-2">
              <BarList rows={r.strategies.slice(0, strategyHalf)} max={strategyMax} />
              {r.strategies.length > strategyHalf ? <BarList rows={r.strategies.slice(strategyHalf)} max={strategyMax} /> : null}
            </div>
          ) : <p className="text-sm text-ink-soft">Sem estratégias registradas no período.</p>}
        </div>
      </div>
    </View>
  );
}

export function ActivitiesView({ data, dua, periodText, canConfigureAi, canPlanDua }: { data: Dashboard; dua: Dua; periodText: string; canConfigureAi: boolean; canPlanDua: boolean }) {
  const { activities: act, ai, resources: res, scope } = data;
  const statusSegments = withSegmentColors(act.byStatus);
  const topUses = Math.max(1, ...res.top.map((item) => item.uses));
  const duaPeriod = dua ? `${PERIODS[scope.period]}${dua.period.start ? ` (de ${formatDate(dua.period.start)} a ${formatDate(dua.period.end)})` : ` (até ${formatDate(dua.period.end)})`}` : "";
  const duaDecisions: ChartSegment[] = dua ? (["aceito", "editado", "recusado"] as const).map((key) => ({ key, label: AI_BLOCK_DECISION[key].label, value: dua.decisions[key], color: TONE_COLOR[AI_BLOCK_DECISION[key].tone] })) : [];
  return (
    <>
      <View id="atividades" title="Atividades" description={`Criadas · ${periodText}.`}>
        <div className="dash-board grid gap-3.5 md:grid-cols-2">
          <div className="dash-card">
            <CardHeader title="Situação das atividades" />
            {act.created ? (
              <div className="flex flex-wrap items-center gap-5">
                <HatchedDonut id="rosca-atividades" segments={statusSegments} label={`Atividades: ${statusSegments.map((segment) => `${segment.label} ${segment.value}`).join(", ")}`} size={132} thickness={17}>
                  <span className="font-display text-3xl leading-none tracking-tight">{act.created}</span>
                  <span className="mt-1 text-xs text-ink-soft">criadas</span>
                </HatchedDonut>
                <div className="min-w-[160px] flex-1"><Legend segments={statusSegments} /></div>
              </div>
            ) : <p className="text-sm text-ink-soft">Nenhuma atividade criada no período.</p>}
          </div>
          <div className="dash-card">
            <CardHeader title="Onde acontecem" />
            <BarList rows={act.byContext} empty="Nenhuma atividade criada no período." />
          </div>
          <div className="dash-card">
            <CardHeader title="Origem e adesão" help="Adesão: atividades aceitas ou aplicadas entre as avaliadas." />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Atividades por origem e adesão</caption>
                <thead>
                  <tr className="text-xs text-ink-soft">
                    <th scope="col" className="pb-2.5 text-left font-normal">Origem</th>
                    <th scope="col" className="pb-2.5 pl-3 text-right font-normal">Criadas</th>
                    <th scope="col" className="pb-2.5 pl-3 text-right font-normal">Avaliadas</th>
                    <th scope="col" className="pb-2.5 pl-3 text-right font-normal">Adesão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line border-t border-line">
                  {act.sources.map((source) => (
                    <tr key={source.source}>
                      <th scope="row" className="py-3 pr-2 text-left font-normal">{source.label}</th>
                      <td className="py-3 pl-3 text-right tabular-nums">{source.total}</td>
                      <td className="py-3 pl-3 text-right tabular-nums">{source.decided}</td>
                      <td className="py-3 pl-3 text-right">{source.adhesion === null ? <span className="text-ink-soft">—</span> : <StatusPill tone={source.adhesion >= 70 ? "good" : source.adhesion >= 40 ? "mid" : "alert"}>{source.adhesion}%</StatusPill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {act.rejectReasons.length ? (
              <>
                <h4 className="mb-3 mt-6 text-sm font-medium text-ink">Por que as sugestões são rejeitadas</h4>
                <BarList rows={act.rejectReasons.map((reason) => ({ label: `“${reason.label}”`, value: reason.value }))} color={SIGNAL.yellow} />
              </>
            ) : null}
          </div>
          <section id="ia" aria-labelledby="ia-titulo" className="dash-card min-w-0 scroll-mt-24">
            <CardHeader title="Uso da IA" hint={PERIODS[scope.period]} />
            <Assurances className="-mt-1 mb-3" label="Cuidados com a IA" items={[{ icon: UserCheck, text: "A IA propõe, o professor decide" }, { icon: ShieldCheck, text: "Dados pessoais saem como marcadores" }]} />
            <dl className="divide-y divide-line">
              <AiStat label="Planos propostos pela IA" value={ai.planProposals.ia} detail={`${plural(ai.planProposals.regras, "proposto", "propostos")} pelo motor de regras`} />
              <AiStat label="Propostas aguardando revisão" value={ai.draftsPending} detail={ai.draftsPending ? "o professor decide" : undefined} />
              <AiStat label="Imagens geradas" value={ai.images} />
            </dl>
            {canConfigureAi ? <Link href="/configuracao-ia" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-strong hover:underline">Configuração da IA <ArrowRight size={15} aria-hidden /></Link> : null}
          </section>
          <section id="recursos" aria-labelledby="recursos-titulo" className="dash-card min-w-0 scroll-mt-24">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id="recursos-titulo" className="text-base font-medium tracking-tight text-ink">Recursos mais usados</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">Banco municipal · o mesmo para toda a rede</p>
              </div>
              <Link href="/recursos" className="circle-link !size-11" aria-label="Abrir o banco de recursos"><ArrowUpRight size={16} aria-hidden /></Link>
            </div>
            <div className="-mt-1 mb-3">
              <CountList
                label="Banco municipal em números"
                items={[
                  { key: "recursos", value: res.total, label: res.total === 1 ? "recurso" : "recursos" },
                  { key: "propostas", value: res.activities, label: res.activities === 1 ? "proposta prática" : "propostas práticas" },
                  { key: "usos", value: res.uses, label: res.uses === 1 ? "uso registrado" : "usos registrados" },
                ]}
              />
            </div>
            {res.top.length ? (
              <ol className="divide-y divide-line">
                {res.top.map((item) => (
                  <li key={item.id}>
                    <Link href={`/recursos/${item.id}`} className="group block min-h-12 py-2.5 text-sm">
                      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span className="min-w-0 group-hover:underline">{item.title}</span>
                        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs tabular-nums text-ink-soft">{plural(item.uses, "uso", "usos")}{item.positive !== null ? <StatusPill tone={item.positive >= 70 ? "good" : item.positive >= 40 ? "mid" : "alert"}>{item.positive}% bom resultado</StatusPill> : null}</span>
                      </span>
                      <Meter value={item.uses} max={topUses} className="mt-2" />
                    </Link>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-ink-soft">Nenhum uso registrado ainda.</p>}
          </section>
        </div>
      </View>

      {dua ? (
        <div className="mt-10">
          <View
            id="dua" title="Planejamento com DUA — uso e documentação" description={`${duaPeriod} · ${dua.scopeLabel}.`}
            note={
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Assurances
                  label="Como ler os indicadores do DUA"
                  items={[
                    { icon: Scale, text: "Medem uso, não aprendizagem" },
                    { icon: ShieldCheck, text: "Não avaliam professor, escola nem estudante" },
                    { icon: CircleSlash, text: "Sem base, nunca 0%" },
                  ]}
                />
                {canPlanDua ? <Link href="/planejamento" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink underline">Abrir o planejamento <ArrowRight size={15} aria-hidden /></Link> : null}
              </div>
            }
          >
            <div className="dash-board grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {dua.indicators.map(({ key, ...indicator }) => (
                <DuaIndicatorCard key={key} ringId={`anel-dua-${key}`} {...indicator} noBaseText={dua.noBaseText} />
              ))}
              <div className="dash-card min-w-0">
                <CardHeader title="Decisões sobre as sugestões" hint={dua.decisions.total ? `${plural(dua.decisions.total, "bloco revisado", "blocos revisados")} pela equipe` : undefined} />
                <StackedBar segments={duaDecisions} empty={`${dua.noBaseText}: nenhum bloco de sugestão revisado.`} />
              </div>
            </div>
          </View>
        </div>
      ) : null}
    </>
  );
}

export function ProfileView({ data, periodText }: { data: Dashboard; periodText: string }) {
  const { profile: p } = data;
  return (
    <View id="perfil" title="Perfil dos estudantes" note={<Assurances label="Privacidade" items={[{ icon: ShieldCheck, text: "Dados agregados, sem identificar ninguém" }]} />}>
      {p.caa.withoutResources > 0 ? (
        <div className="mb-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-signal-yellow-soft p-4 sm:p-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal-yellow text-ink-strong"><Lightbulb size={17} aria-hidden /></span>
          <p className="shrink-0 font-display text-3xl font-bold leading-none tracking-tight text-ink tabular-nums">{p.caa.withoutResources} <span className="text-base font-medium">de {p.caa.total}</span></p>
          <div className="min-w-0 flex-1 basis-60 text-sm text-ink">
            <p><strong className="font-medium">Sem recursos de acessibilidade registrados</strong>, entre quem usa comunicação alternativa ou acionador</p>
            <p className="mt-0.5 text-xs">Leitura para a gestão: indicativo para compra de materiais e formação.</p>
          </div>
        </div>
      ) : null}
      <div className="dash-board grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {p.bySchool.length > 1 ? <div className="dash-card"><CardHeader title="Estudantes por escola" /><BarList rows={p.bySchool} /></div> : null}
        <div className="dash-card"><CardHeader title="Etapa de ensino" /><BarList rows={p.byStage} /></div>
        <div className="dash-card"><CardHeader title="Canais de comunicação" /><BarList rows={p.channels} empty="Nenhum perfil preenchido." /></div>
        <div className="dash-card"><CardHeader title="Barreiras ativas" /><BarList rows={p.barriers} color={SIGNAL.yellow} empty="Nenhuma barreira registrada." /></div>
        <div className="dash-card"><CardHeader title="Hipersensibilidade sensorial" /><BarList rows={p.hypersensitivity} empty="Nenhuma hipersensibilidade registrada." /></div>
      </div>
      {p.withoutProfile ? <p className="mt-3 px-1 text-xs text-ink-soft">{plural(p.withoutProfile, "estudante sem perfil de aprendizagem fica", "estudantes sem perfil de aprendizagem ficam")} fora destes números.</p> : null}
      {p.practices.length ? (
        <>
          <h3 className="mb-1 mt-7 px-1 text-base font-medium">Banco de práticas por perfil</h3>
          <p className="mb-3.5 px-1 text-sm text-ink-soft">Estratégias de aulas com boa resposta · {periodText}</p>
          <div className="dash-board grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {p.practices.map((cluster) => (
              <div key={cluster.label} className="dash-card">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium text-ink">{cluster.label}</h4>
                  <span className="shrink-0 text-xs tabular-nums text-ink-soft">{plural(cluster.records, "registro", "registros")}</span>
                </div>
                <BarList rows={cluster.top} empty="Sem estratégias marcadas para este perfil." />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </View>
  );
}

export function FamilyView({ data }: { data: Dashboard }) {
  const { overview: o, family: f, scope } = data;
  return (
    <View id="familia" title="Família e rede de apoio">
      <div className="dash-board grid gap-3.5 lg:grid-cols-3">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:col-span-2">
          <StatTile label="Conquistas registradas pela família" value={f.notes} hint={PERIODS[scope.period]} />
          <StatTile
            label="Registros de aula feitos em casa" value={f.records} hint={PERIODS[scope.period]}
            chart={<ShareRing id="anel-familia-registros" part={f.records} whole={o.records} label="Registros de aula feitos em casa" caption={`dos ${plural(o.records, "registro", "registros")} de aula do período foram feitos em casa.`} />}
          />
          <StatTile
            label="Famílias com acesso à plataforma" value={`${f.withAccess} de ${o.students}`}
            chart={<ShareRing id="anel-familia-acesso" part={f.withAccess} whole={o.students} label="Famílias com acesso à plataforma" caption="dos estudantes têm a família com acesso." />}
          />
          <StatTile
            label="Relatórios intersetoriais" value={f.reports} hint={`${f.reportsInPeriod} no período`}
            chart={<ShareRing id="anel-familia-relatorios" part={f.studentsWithReport} whole={o.students} label="Estudantes com orientações da rede de apoio" caption={`dos estudantes (${f.studentsWithReport}) têm orientações da rede de apoio.`} />}
          />
        </div>
        <div className="dash-card">
          <CardHeader title="Materiais acessíveis" hint={`${f.materialsInPeriod} produzidos no período`} />
          <BarList rows={f.materials} empty="Nenhum material produzido ainda." />
        </div>
      </div>
    </View>
  );
}

export function TeamView({ data, periodText }: { data: Dashboard; periodText: string }) {
  const { team, scope } = data;
  return (
    <View id="equipe" title="Equipe e privacidade">
      <div className="dash-board grid gap-3.5 lg:grid-cols-2">
        <div className="dash-card">
          <CardHeader title="Pessoas com acesso" hint={scope.schoolId ? "Equipe da escola, famílias e terapeutas dos estudantes" : "Todos os usuários da rede"} />
          <BarList rows={team.byRole.map((row) => ({ ...row, label: roleLabel(row.key, { short: true }) }))} empty="Nenhum usuário cadastrado." />
        </div>
        <div className="dash-card">
          <CardHeader title="Acessos registrados" hint={`${plural(team.actors, "pessoa acessou", "pessoas acessaram")} dados de estudantes · ${periodText}`} />
          <BarList rows={team.access.map((row) => ({ ...row, label: ACCESS_LABELS[row.key] }))} empty="Nenhum acesso registrado no período." />
        </div>
      </div>
    </View>
  );
}
