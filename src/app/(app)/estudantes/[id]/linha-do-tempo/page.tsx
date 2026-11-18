import Link from "next/link";
import { db } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/page-context";
import { brYmd, formatDate, formatMonth, monthKey } from "@/lib/dates";
import { plural } from "@/lib/format";
import { monthlyCounts } from "@/lib/series";
import { AEE_SESSION_STATUS, CONTEXTS, TIMELINE_TYPES, labelOf, toneOf, type Term } from "@/lib/scale";
import { listStudentEvidence } from "@/lib/dua/applications";
import { listAeeSessions } from "@/lib/aee-sessions";
import { OBSERVATION } from "@/lib/dua/domain";
import { PageHeader, Badge, EmptyState } from "@/components/ui";
import { ColumnChart, CountChips } from "@/components/viz/charts";
import { DataBoard, DataCard } from "@/components/viz/cards";
import {
  ClipboardList, FileText, HeartHandshake, Users, ArrowLeftRight,
  AlertTriangle, Trophy, Package, Layers, CalendarCheck, CalendarX, House, type LucideIcon,
} from "lucide-react";

const TYPE_ICON: Record<string, LucideIcon> = {
  avaliacao: ClipboardList, plano: FileText, atendimento: HeartHandshake, reuniao: Users, transferencia: ArrowLeftRight,
  alerta: AlertTriangle, conquista: Trophy, recurso: Package, familia: House,
  dua: Layers, aee_realizado: CalendarCheck, aee_falta: CalendarX, aee_cancelamento: CalendarX,
};
const OTHER: Term = { label: "Outro", tone: "neutral" };
const DUA_ENTRY: Term = { label: "Atividade com DUA", tone: "info" };
const aeeEntry = (status: string): Term => ({ label: "Frequência do AEE", tone: toneOf(AEE_SESSION_STATUS, status) });

type Entry = { key: string; date: Date; type: string; term: Term; title: string; description: string | null; context?: Term; link?: { href: string; label: string } };

const monthName = (date: Date) => {
  const text = formatMonth(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function groupByMonth(entries: ReadonlyArray<Entry>) {
  const groups: { key: string; label: string; entries: Entry[] }[] = [];
  for (const entry of entries) {
    const { year, month } = brYmd(entry.date);
    const key = monthKey(year, month);
    const last = groups.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else groups.push({ key, label: monthName(entry.date), entries: [entry] });
  }
  return groups;
}

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const prisma = await db();
  const { id } = await params;
  const { user, can } = await requireStudentPage(id, "Evolução");
  const [events, evidences, sessions] = await Promise.all([
    prisma.timelineEvent.findMany({
      where: { studentId: id },
      orderBy: { date: "desc" },
    }),
    can.edit ? listStudentEvidence(user, id) : [],
    can.edit ? listAeeSessions(user, id).then((result) => result.sessions) : [],
  ]);

  const entries: Entry[] = [
    ...events.map((e) => ({ key: e.id, date: e.date, type: e.type, term: TIMELINE_TYPES[e.type] ?? OTHER, title: e.title, description: e.description })),
    ...evidences.map((evidence) => ({
      key: `dua-${evidence.id}`,
      date: evidence.date,
      type: "dua",
      term: DUA_ENTRY,
      title: `${DUA_ENTRY.label}: ${evidence.planningTitle}`,
      description: `${labelOf(OBSERVATION, evidence.observation)} · versão ${evidence.versionNumber} · registrado por ${evidence.authorName}`,
      context: CONTEXTS[evidence.context],
      link: evidence.canOpenPlanning ? { href: `/planejamento/${evidence.planningId}/aplicacao`, label: evidence.planningTitle } : undefined,
    })),
    ...sessions.map((session) => ({
      key: `aee-${session.id}`,
      date: session.date,
      type: `aee_${session.status}`,
      term: aeeEntry(session.status),
      title: `Atendimento do AEE: ${labelOf(AEE_SESSION_STATUS, session.status)}`,
      description: [session.reason ? `Motivo: ${session.reason}` : "", `registrado por ${session.authorName}`].filter(Boolean).join(" · "),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const months = monthlyCounts(entries.map((entry) => entry.date), 12);
  const lastYear = months.reduce((sum, month) => sum + month.value, 0);
  const groups = groupByMonth(entries);
  const byType = new Map<string, number>();
  for (const entry of entries) {
    const label = entry.term.label;
    byType.set(label, (byType.get(label) ?? 0) + 1);
  }
  const typeCounts = [...byType].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));

  return (
    <>
      <PageHeader level={2} title="Evolução" />
      {entries.length === 0 ? (
        <EmptyState character="learning" title="O histórico começa aqui" hint="Planos, atendimentos e conquistas aparecem aqui." />
      ) : (
        <>
          <h2 className="sr-only">Resumo do histórico</h2>
          <DataBoard className="mb-8 max-w-2xl">
            <DataCard title="Eventos por mês" hint={`${lastYear ? plural(lastYear, "evento", "eventos") : "Nenhum evento"} nos últimos 12 meses · ${entries.length} no total.`}>
              {lastYear ? <ColumnChart rows={months} label="Eventos por mês, nos últimos 12 meses" /> : null}
              <div className={lastYear ? "mt-4" : ""}>
                <h4 className="mb-2 text-xs font-medium text-ink-soft">Por tipo, em todo o histórico</h4>
                <CountChips items={typeCounts} tone="neutral" unit="" />
              </div>
            </DataCard>
          </DataBoard>
          <div className="max-w-2xl space-y-8">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`mes-${group.key}`}>
                <h2 id={`mes-${group.key}`} className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-medium text-ink">{group.label}</span>
                  <span className="text-xs text-ink-soft">{plural(group.entries.length, "evento", "eventos")}</span>
                </h2>
                <ol className="relative ml-3 space-y-6 border-l-2 border-line pl-8">
                  {group.entries.map((e) => {
                    const Icon = TYPE_ICON[e.type] ?? HeartHandshake;
                    return (
                      <li key={e.key} className="relative">
                        <span className="absolute -left-[45px] flex size-7 items-center justify-center rounded-full border border-line bg-paper-raised text-brand-strong">
                          <Icon size={14} aria-hidden />
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-ink-soft">{formatDate(e.date)}</span>
                          <Badge tone={e.term.tone}>{e.term.label}</Badge>
                          {e.context ? <Badge tone={e.context.tone}>{e.context.label}</Badge> : null}
                        </div>
                        <h3 className="mt-1 font-medium text-ink">{e.title}</h3>
                        {e.description ? <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{e.description}</p> : null}
                        {e.link ? (
                          <Link href={e.link.href} className="inline-flex min-h-11 items-center text-sm font-medium text-brand-strong underline underline-offset-4">
                            Abrir a atividade<span className="sr-only">: {e.link.label}</span>
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}

