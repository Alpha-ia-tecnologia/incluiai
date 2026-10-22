import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canEditStudentRecord, requireStudentPage } from "@/lib/auth";
import { aiAllowedFor } from "@/lib/consent";
import { hasApiKey } from "@/lib/env";
import { isAIEnabled } from "@/lib/agents/model";
import { adaptForStudent } from "@/actions/adapted-tasks";
import { Card, PageHeader } from "@/components/ui";
import { ConsentNote } from "@/components/consent-note";
import { AdaptForm } from "@/components/adapted/adapt-form";
import { linkCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

// Adaptar a atividade ou a prova da turma para o estudante (item 1 do plano).
export default async function AdaptTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudentPage(id, "Adaptar atividade da turma");
  if (!canEditStudentRecord(user.role)) redirect(`/estudantes/${id}`);
  const [aiOn, objectives] = await Promise.all([
    aiAllowedFor(id),
    prisma.objective.findMany({ where: { plan: { studentId: id, status: "ativo" }, status: "ativo" }, select: { id: true, description: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <>
      <Link href={`/estudantes/${id}/atividades`} className={`mb-4 inline-flex min-h-11 items-center gap-2 text-sm ${linkCls}`}><ArrowLeft size={16} aria-hidden /> Atividades</Link>
      <PageHeader level={2} title="Adaptar uma atividade ou prova da turma" lede="Envie a foto ou o PDF da folha que a turma vai usar (ou cole o texto). A plataforma adapta a apresentação ao jeito de aprender do estudante, e você revisa antes de usar." />
      <Card className="max-w-3xl">
        <ConsentNote show={isAIEnabled() && !aiOn} />
        <AdaptForm action={adaptForStudent.bind(null, id)} canRead={aiOn && hasApiKey("ANTHROPIC_API_KEY")} aiOn={aiOn} objectives={objectives} adaptLabel="Adaptar para o estudante" />
      </Card>
    </>
  );
}
