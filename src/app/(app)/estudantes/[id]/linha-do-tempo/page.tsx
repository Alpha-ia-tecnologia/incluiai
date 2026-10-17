import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { TIMELINE_TYPES } from "@/lib/scale";
import { PageHeader, Badge, EmptyState } from "@/components/ui";
import {
  ClipboardList, FileText, HeartHandshake, Users, ArrowLeftRight,
  AlertTriangle, Trophy, Package, type LucideIcon,
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
};

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const events = await prisma.timelineEvent.findMany({
    where: { studentId: id },
    orderBy: { date: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Evolução"
        lede="Veja o histórico de planos, atendimentos e conquistas, do mais recente ao mais antigo."
        actions={
          <Link href={`/estudantes/${id}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 py-2.5 text-sm font-medium text-brand-strong hover:bg-brand-soft">
            Ver objetivos e avanços no resumo
          </Link>
        }
      />
      {events.length === 0 ? (
        <EmptyState title="O histórico começa aqui" hint="Os planos de ensino e as conquistas registrados na plataforma aparecerão nesta lista." />
      ) : (
        <ol className="relative ml-3 max-w-2xl space-y-6 border-l-2 border-line pl-8">
          {events.map((e) => {
            const meta = TYPE_META[e.type] ?? TYPE_META.atendimento;
            const Icon = meta.icon;
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[45px] flex size-7 items-center justify-center rounded-full border border-line bg-paper-raised text-brand-strong">
                  <Icon size={14} aria-hidden />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-ink-soft">{formatDate(e.date)}</span>
                  <Badge tone={meta.tone}>{TIMELINE_TYPES[e.type]}</Badge>
                </div>
                <h3 className="mt-1 font-medium text-ink">{e.title}</h3>
                {e.description ? <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{e.description}</p> : null}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

