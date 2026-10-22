import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canEditStudentRecord, requireStudentPage } from "@/lib/auth";
import { reportData } from "@/lib/reports";
import { PrintButton } from "@/components/print-button";
import { ReportView } from "@/components/reports/report-view";

export const dynamic = "force-dynamic";

// Versão para imprimir ou "Salvar como PDF" no navegador.
export default async function PrintReportPage({ params }: { params: Promise<{ id: string; reportId: string }> }) {
  const { id, reportId } = await params;
  const user = await requireStudentPage(id, "Impressão do relatório do período");
  const report = await prisma.studentReport.findFirst({ where: { id: reportId, studentId: id, ...(canEditStudentRecord(user.role) ? {} : { status: "validado" }) } });
  if (!report) notFound();
  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/estudantes/${id}/relatorios/${report.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline"><ArrowLeft size={16} aria-hidden /> Voltar para o relatório</Link>
        <PrintButton label="Imprimir ou salvar em PDF" />
      </div>
      <ReportView data={reportData(report.data)} opinion={report.opinion} status={report.status} validatedByName={report.validatedByName} validatedAt={report.validatedAt} />
    </div>
  );
}
