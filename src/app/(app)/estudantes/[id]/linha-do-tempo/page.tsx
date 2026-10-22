import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canSeePedagogicalDetail, requireStudentPage } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { TIMELINE_TYPES } from "@/lib/scale";
import { DuaError } from "@/lib/dua/shared";
import { listStudentEvidence } from "@/lib/dua/applications";
import { listAeeSessions } from "@/lib/aee-sessions";
import { AEE_SESSION_STATUS_LABEL, OBSERVATION_LABEL, type AeeSessionStatus } from "@/lib/dua/domain";
import { PageHeader, Badge, EmptyState } from "@/components/ui";
import { CountChips, DataBoard, DataCard } from "@/components/data-viz";
import { ColumnChart } from "@/components/charts";
import {
  ClipboardList, FileText, HeartHandshake, Users, ArrowLeftRight,
  AlertTriangle, Trophy, Package, Layers, CalendarCheck, CalendarX, House, type LucideIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

const TYPE_META: Record<string, { icon: LucideIcon; tone: "brand" | "amber" | "coral" | "green" | "neutral" }> = {
  avaliacao: { icon: ClipboardList, tone: "brand" },
  plano: { icon: FileText, tone: "brand" },
  atendimento: { icon: HeartHandshake, tone: "neutral" },
  reuniao: { icon: Users, tone: "neutral" },
  transferencia: { icon: ArrowLeftRight, tone: "amber" },
  alerta: { icon: AlertTriangle, tone: "coral" },
  conquista: { icon: Trophy, tone: "green" },
  recurso: { icon: Package, tone: "amber" },
  familia: { icon: House, tone: "neutral" },
  // Lidos dos registros do DUA e da frequência do AEE, sem criar evento novo.
  dua: { icon: Layers, tone: "brand" },
  aee_realizado: { icon: CalendarCheck, tone: "green" },
  aee_falta: { icon: CalendarX, tone: "amber" },
  aee_cancelamento: { icon: CalendarX, tone: "neutral" },
};

const EXTRA_TYPES: Record<string, string> = {
  dua: "Atividade com DUA",
  aee_realizado: "Frequência do AEE",
  aee_falta: "Frequência do AEE",
  aee_cancelamento: "Frequência do AEE",
};

type Entry = { key: string; date: Date; type: string; title: string; description: string | null; context?: string; link?: { href: string; label: string } };

// Mês no mesmo fuso de formatDate (o do servidor), para que o cabeçalho do mês,
// a coluna do gráfico e a data de cada evento sempre concordem.
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const monthName = (date: Date) => {
  const text = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// Eventos em cada um dos últimos `months` meses (o atual por último).
function monthlyEvents(entries: ReadonlyArray<Entry>, months: number, now: Date) {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(monthKey(entry.date), (counts.get(monthKey(entry.date)) ?? 0) + 1);
  return Array.from({ length: months }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
    return { label: MONTH_SHORT[month.getMonth()], title: monthName(month), value: counts.get(monthKey(month)) ?? 0 };
  });
}

// Agrupa a lista (já do mais recente ao mais antigo) por mês.
function groupByMonth(entries: ReadonlyArray<Entry>) {
  const groups: { key: string; label: string; entries: Entry[] }[] = [];
  for (const entry of entries) {
    const key = monthKey(entry.date);
    const last = groups.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else groups.push({ key, label: monthName(entry.date), entries: [entry] });
  }
  return groups;
}

// Fora do recorte do estudante, a página segue só com os eventos de sempre.
async function withinReach<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof DuaError || (error instanceof Error && /permissão/i.test(error.message))) return fallback;
    throw error;
  }
}

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStudentPage(id, "Evolução");
  const user = await getCurrentUser();
  // Atividades com DUA e frequência do AEE são da equipe pedagógica: família e
  // terapeuta continuam vendo a linha do tempo como antes.
  const pedagogical = user && canSeePedagogicalDetail(user.role) ? user : null;
  const [events, evidences, sessions] = await Promise.all([
    prisma.timelineEvent.findMany({
      where: { studentId: id },
      orderBy: { date: "desc" },
    }),
    pedagogical ? withinReach(() => listStudentEvidence(pedagogical, id), []) : Promise.resolve([]),
    pedagogical ? withinReach(async () => (await listAeeSessions(pedagogical, id)).sessions, []) : Promise.resolve([]),
  ]);

  const entries: Entry[] = [
    ...events.map((e) => ({ key: e.id, date: e.date, type: e.type, title: e.title, description: e.description })),
    ...evidences.map((evidence) => ({
      key: `dua-${evidence.id}`,
      date: evidence.date,
      type: "dua",
      title: `Atividade com DUA: ${evidence.planningTitle}`,
      description: `${OBSERVATION_LABEL[evidence.observation] ?? evidence.observation} · versão ${evidence.versionNumber} · registrado por ${evidence.authorName}`,
      context: evidence.context === "aee" ? "AEE" : "Sala comum",
      link: evidence.canOpenPlanning ? { href: `/planejamento/${evidence.planningId}/aplicacao`, label: evidence.planningTitle } : undefined,
    })),
    ...sessions.map((session) => ({
      key: `aee-${session.id}`,
      date: session.date,
      type: `aee_${session.status}`,
      title: `Atendimento do AEE: ${AEE_SESSION_STATUS_LABEL[session.status as AeeSessionStatus] ?? session.status}`,
      description: [session.reason ? `Motivo: ${session.reason}` : "", `registrado por ${session.authorName}`].filter(Boolean).join(" · "),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  // O gráfico e os grupos usam só o que a lista mostra para este perfil.
  const months = monthlyEvents(entries, 12, new Date());
  const lastYear = months.reduce((sum, month) => sum + month.value, 0);
  const groups = groupByMonth(entries);
  const byType = new Map<string, number>();
  for (const entry of entries) {
    const label = TIMELINE_TYPES[entry.type] ?? EXTRA_TYPES[entry.type] ?? "Outro";
    byType.set(label, (byType.get(label) ?? 0) + 1);
  }
  const typeCounts = [...byType].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));

  return (
    <>
      <PageHeader level={2}
        title="Evolução"
        lede={pedagogical
          ? "Veja o histórico de planos, atendimentos, atividades com DUA, frequência do AEE e conquistas, do mais recente ao mais antigo."
          : "Veja o histórico de planos, atendimentos e conquistas, do mais recente ao mais antigo."}
        actions={
          <Link href={`/estudantes/${id}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 py-2.5 text-sm font-medium text-brand-strong hover:bg-brand-soft">
            Ver objetivos e avanços no resumo
          </Link>
        }
      />
      {entries.length === 0 ? (
        <EmptyState character="learning" title="O histórico começa aqui" hint="Os planos de ensino e as conquistas registrados na plataforma aparecerão nesta lista." />
      ) : (
        <>
          <h2 className="sr-only">Resumo do histórico</h2>
          <DataBoard className="mb-8 max-w-2xl">
            <DataCard title="Eventos por mês" hint={lastYear ? `${plural(lastYear, "evento", "eventos")} nos últimos 12 meses · ${plural(entries.length, "evento", "eventos")} no histórico.` : `Nenhum evento nos últimos 12 meses · ${plural(entries.length, "evento", "eventos")} no histórico, logo abaixo.`}>
              {lastYear ? <ColumnChart rows={months} caption="Eventos por mês, nos últimos 12 meses" /> : null}
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
                    const meta = TYPE_META[e.type] ?? TYPE_META.atendimento;
                    const Icon = meta.icon;
                    return (
                      <li key={e.key} className="relative">
                        <span className="absolute -left-[45px] flex size-7 items-center justify-center rounded-full border border-line bg-paper-raised text-brand-strong">
                          <Icon size={14} aria-hidden />
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-ink-soft">{formatDate(e.date)}</span>
                          <Badge tone={meta.tone}>{TIMELINE_TYPES[e.type] ?? EXTRA_TYPES[e.type]}</Badge>
                          {e.context ? <Badge tone="neutral">{e.context}</Badge> : null}
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

