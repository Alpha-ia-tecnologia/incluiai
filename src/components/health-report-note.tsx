import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Faixa do estudo de caso que leva aos laudos: convite discreto quando não há
// nenhum (é opcional) e aviso quando há sugestões esperando revisão.
export function HealthReportsNote({ studentId, reports }: { studentId: string; reports: { status: string; reviewedAt: Date | null }[] }) {
  const pending = reports.filter((report) => report.status === "lido" && !report.reviewedAt).length;
  const total = reports.length;
  const text = pending
    ? `${pending} ${pending === 1 ? "laudo com sugestões" : "laudos com sugestões"} para revisar.`
    : total
      ? `${total} ${total === 1 ? "laudo anexado" : "laudos anexados"} a este estudo de caso.`
      : "Tem um laudo ou relatório de saúde? Anexe para a IA sugerir o que juntar a este estudo. É opcional.";
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-paper-raised px-4 py-2 print:hidden">
      <span aria-hidden className="size-3.5 shrink-0 rounded-[3px] bg-paper-pink" />
      <p className="min-w-0 flex-1 py-2 text-sm text-ink">{text}</p>
      <Link href={`/estudantes/${studentId}/estudo-de-caso/laudos`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-pen underline underline-offset-4">
        {pending ? "Revisar sugestões" : total ? "Ver laudos" : "Anexar laudo"} <ArrowRight size={16} aria-hidden />
      </Link>
    </div>
  );
}
