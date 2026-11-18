import Link from "next/link";
import { db } from "@/lib/prisma";
import { focusObjective, stepsFor } from "@/lib/support-steps";
import { SupportSteps, TrendChip } from "@/components/viz/support-steps";
import { HEAD_PART } from "@/components/student-head-parts";

export async function headSignature(studentId: string) {
  const prisma = await db();
  const objectives = await prisma.objective.findMany({
    where: { plan: { studentId, status: "ativo" }, status: "ativo" },
    orderBy: { createdAt: "asc" },
    select: { id: true, action: true, targetSupport: true },
  });
  if (!objectives.length) return null;
  const entries = await prisma.diaryEntry.findMany({
    where: { studentId, objectiveId: { in: objectives.map((objective) => objective.id) } },
    select: { id: true, date: true, supportLevel: true, participation: true, objectiveId: true },
  });
  const focus = focusObjective(objectives, entries)!;
  const data = stepsFor(focus, entries);
  return (
    <Link
      href={`/estudantes/${studentId}/linha-do-tempo#objetivo-${focus.id}`}
      title={`Evolução: ${focus.action}`}
      className={`${HEAD_PART.detail} flex min-h-11 shrink-0 items-center gap-3 rounded-2xl px-2 hover:bg-paper-raised`}
    >
      <span className="sr-only">Evolução do objetivo em foco: </span>
      <SupportSteps data={data} size="mini" name={focus.action} />
      <span className="max-sm:hidden"><TrendChip reading={data.trend} /></span>
    </Link>
  );
}
