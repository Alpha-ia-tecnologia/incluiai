import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer, RefreshCw, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canEditStudentRecord, requireStudentPage } from "@/lib/auth";
import { refreshReportData, removeReportDraft, saveReport } from "@/actions/reports";
import { canValidateReport, reportData } from "@/lib/reports";
import { Card } from "@/components/ui";
import { ReportView } from "@/components/reports/report-view";
import { OpinionEditor } from "@/components/reports/report-forms";
import { dangerButtonCls, linkCls, quietButtonCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string; reportId: string }> }) {
  const { id, reportId } = await params;
  const user = await requireStudentPage(id, "Relatório do período");
  const team = canEditStudentRecord(user.role);
  const report = await prisma.studentReport.findFirst({ where: { id: reportId, studentId: id, ...(team ? {} : { status: "validado" }) } });
  if (!report) notFound();
  const data = reportData(report.data);
  const draft = report.status !== "validado";
  const editing = draft && team;

  return (
    <div className="grid min-w-0 max-w-3xl gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/estudantes/${id}/relatorios`} className={`inline-flex min-h-11 items-center gap-2 text-sm ${linkCls}`}><ArrowLeft size={16} aria-hidden /> Relatórios do período</Link>
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <form action={refreshReportData.bind(null, id, report.id)}>
              <button type="submit" className={quietButtonCls}><RefreshCw size={16} aria-hidden /> Atualizar com os registros</button>
            </form>
          ) : null}
          <Link href={`/estudantes/${id}/relatorios/${report.id}/imprimir`} className={quietButtonCls}><Printer size={16} aria-hidden /> Imprimir ou salvar em PDF</Link>
        </div>
      </div>
      <Card>
        <ReportView data={data} opinion={report.opinion} status={report.status} validatedByName={report.validatedByName} validatedAt={report.validatedAt} showOpinion={!editing} />
      </Card>
      {editing ? (
        <Card>
          <OpinionEditor action={saveReport.bind(null, id, report.id)} opinion={report.opinion} canValidate={canValidateReport(user.role)} />
          <details className="mt-6 rounded-2xl bg-surface-muted p-4">
            <summary className="min-h-6 cursor-pointer text-sm font-medium text-ink">Excluir este rascunho</summary>
            <p className="my-3 text-sm text-ink-soft">O rascunho e o parecer escrito saem. Os registros do período continuam na ficha.</p>
            <form action={removeReportDraft.bind(null, id, report.id)}>
              <button type="submit" className={dangerButtonCls}><Trash2 size={16} aria-hidden /> Excluir o rascunho</button>
            </form>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
