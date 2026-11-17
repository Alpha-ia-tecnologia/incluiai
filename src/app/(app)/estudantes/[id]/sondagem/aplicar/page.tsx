import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/page-context";
import { answersOf } from "@/lib/assessments";
import { applyAssessment } from "@/actions/assessments";
import { Card, PageHeader } from "@/components/ui";
import { AssessmentForm } from "@/components/assessment/assessment-form";
import { linkCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

export default async function ApplyAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const prisma = await db();
  const { id } = await params;
  await requireStudentPage(id, "Aplicar sondagem", { need: "edit", otherwise: `/estudantes/${id}/sondagem` });
  const latest = await prisma.assessment.findFirst({ where: { studentId: id }, orderBy: { appliedAt: "desc" } });
  return (
    <>
      <Link href={`/estudantes/${id}/sondagem`} className={`mb-4 inline-flex min-h-11 items-center gap-2 text-sm ${linkCls}`}><ArrowLeft size={16} aria-hidden /> Sondagem</Link>
      <PageHeader level={2} title={latest ? "Reavaliação" : "Linha de base"} lede="Para cada item, marque o apoio de que o estudante precisa hoje, do que você observou nas aulas e no AEE. Aplicam juntos o AEE e o professor da sala comum." />
      <Card className="max-w-3xl">
        <AssessmentForm action={applyAssessment.bind(null, id)} previous={latest ? answersOf(latest.answers) : null} />
      </Card>
    </>
  );
}
