import Link from "next/link";
import { CalendarRange, CircleCheck, FilePen, ShieldCheck, Users, Wand2 } from "lucide-react";
import { db } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/page-context";
import { newReport } from "@/actions/reports";
import { currentSemester } from "@/lib/period-report";
import { periodLabel, reportData } from "@/lib/reports";
import { formatDate } from "@/lib/dates";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { NewReportForm } from "@/components/reports/report-forms";
import { Assurances, Steps } from "@/components/explain";
import { REPORT_STATUS, labelOf, toneOf } from "@/lib/scale";

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const prisma = await db();
  const { id } = await params;
  const { can } = await requireStudentPage(id, "Relatórios do período");
  const team = can.edit;
  const reports = await prisma.studentReport.findMany({
    where: { studentId: id, ...(team ? {} : { status: "validado" }) },
    orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
    select: { id: true, status: true, data: true, validatedByName: true, validatedAt: true, updatedAt: true },
  });
  const semester = currentSemester();

  return (
    <>
      <PageHeader level={2} title="Relatórios do período" />
      <div className="grid min-w-0 max-w-3xl gap-6">
        {team ? (
          <Card>
            <SectionTitle>Novo relatório</SectionTitle>
            <Steps
              label="Como o relatório é feito"
              className="mb-5"
              items={[
                { icon: CalendarRange, label: "Escolha o período" },
                { icon: Wand2, label: "Rascunho com os registros" },
                { icon: FilePen, label: "Você revisa o parecer" },
                { icon: CircleCheck, label: "Valida" },
                { icon: Users, label: "A família lê no portal" },
              ]}
            />
            <NewReportForm action={newReport.bind(null, id)} start={semester.start} end={semester.end} />
          </Card>
        ) : null}
        {reports.length ? (
          <section aria-labelledby="relatorios-lista" className="min-w-0">
            <h3 id="relatorios-lista" className="mb-3 text-base font-medium text-ink">Relatórios ({reports.length})</h3>
            <ul className="grid gap-3">
              {reports.map((report) => (
                <li key={report.id} className="ui-card flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink"><Link href={`/estudantes/${id}/relatorios/${report.id}`} className="underline-offset-4 hover:underline">Período de {periodLabel(reportData(report.data))}</Link></p>
                    <p className="mt-1 text-xs text-ink-soft">{report.status === "validado" ? `Validado por ${report.validatedByName} em ${formatDate(report.validatedAt!)}` : `Rascunho, atualizado em ${formatDate(report.updatedAt)}`}</p>
                  </div>
                  <Badge tone={toneOf(REPORT_STATUS, report.status)}>{report.status === "validado" ? <CircleCheck size={12} aria-hidden /> : null} {labelOf(REPORT_STATUS, report.status)}</Badge>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <EmptyState character="planning" title="Nenhum relatório ainda" hint={team ? "Escolha o período acima." : "Aparece aqui depois de validado."} action={undefined} />
        )}
        <Assurances label="O que não entra no relatório" items={[{ icon: ShieldCheck, text: "Sem diagnóstico, saúde nem dados da família" }]} />
      </div>
    </>
  );
}
