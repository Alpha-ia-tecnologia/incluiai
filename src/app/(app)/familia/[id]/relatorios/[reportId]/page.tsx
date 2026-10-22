import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, getCurrentUser, hasNominalAccess } from "@/lib/auth";
import { recordView } from "@/lib/access-log";
import { reportData } from "@/lib/reports";
import { PageHeader, Card } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { ReadAloud } from "@/components/read-aloud";
import { ReportView } from "@/components/reports/report-view";

export const dynamic = "force-dynamic";

// O relatório validado, no portal da família (devolutiva do período).
export default async function FamilyReportPage({ params }: { params: Promise<{ id: string; reportId: string }> }) {
  const { id, reportId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const student = await prisma.student.findUnique({ where: { id }, select: { id: true, schoolId: true, name: true } });
  if (!student || !canAccessStudent(user, student.schoolId, id) || user.role === "terapeuta" || !(await hasNominalAccess(user, id))) notFound();
  const report = await prisma.studentReport.findFirst({ where: { id: reportId, studentId: id, status: "validado" } });
  if (!report) notFound();
  await recordView(user, id, "Relatório do período (portal da família)");
  return (
    <>
      <Link href={`/familia/${id}`} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline print:hidden"><ArrowLeft size={16} aria-hidden /> Acompanhamento de {student.name.split(" ")[0]}</Link>
      <PageHeader title="Relatório da escola" lede="O que a escola registrou no período e o parecer da equipe sobre o acompanhamento." actions={<div className="flex flex-wrap gap-2"><ReadAloud targetId="relatorio-familia" label="Ouvir o relatório" /><PrintButton label="Imprimir" /></div>} />
      <Card className="max-w-3xl">
        <div id="relatorio-familia">
          <ReportView data={reportData(report.data)} opinion={report.opinion} status={report.status} validatedByName={report.validatedByName} validatedAt={report.validatedAt} />
        </div>
      </Card>
    </>
  );
}
