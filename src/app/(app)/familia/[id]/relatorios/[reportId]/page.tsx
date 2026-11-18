import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/prisma";
import { requireFamilyPortal } from "@/lib/page-context";
import { reportData } from "@/lib/reports";
import { PageHeader, Card } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { ReadAloud } from "@/components/read-aloud";
import { ReportView } from "@/components/reports/report-view";
import { firstName } from "@/lib/format";

const REPORT_ID = "relatorio-familia";

export default async function FamilyReportPage({ params }: { params: Promise<{ id: string; reportId: string }> }) {
  const prisma = await db();
  const { id, reportId } = await params;
  const { student } = await requireFamilyPortal(id, "Relatório do período (portal da família)");
  const report = await prisma.studentReport.findFirst({ where: { id: reportId, studentId: id, status: "validado" } });
  if (!report) notFound();
  return (
    <>
      <Link href={`/familia/${id}`} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline print:hidden"><ArrowLeft size={16} aria-hidden /> Acompanhamento de {firstName(student.name)}</Link>
      <PageHeader title="Relatório da escola" lede="O que a escola registrou no período e o parecer da equipe sobre o acompanhamento." actions={<div className="flex flex-wrap gap-2"><ReadAloud targetId={REPORT_ID} label="Ouvir o relatório" /><PrintButton label="Imprimir" /></div>} />
      <Card className="max-w-3xl">
        <div id={REPORT_ID}>
          <ReportView data={reportData(report.data)} opinion={report.opinion} status={report.status} validatedByName={report.validatedByName} validatedAt={report.validatedAt} />
        </div>
      </Card>
    </>
  );
}
