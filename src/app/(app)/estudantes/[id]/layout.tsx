import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessStudent, canSeePedagogicalDetail } from "@/lib/auth";
import { ageFrom } from "@/lib/format";
import { STAGES, SHIFTS } from "@/lib/scale";
import { Badge } from "@/components/ui";
import { StudentTabs } from "@/components/student-tabs";
import { StudentJourney } from "@/components/student-journey";
import { canPlanDua } from "@/lib/dua/access";

export default async function StudentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const student = await prisma.student.findUnique({
    where: { id },
    include: { school: true },
  });
  if (!student) notFound();
  // Necessidade de saber (item 7): bloqueia acesso fora do escopo do perfil.
  if (!canAccessStudent(user, student.schoolId, student.id)) redirect("/");

  const showJourney = canSeePedagogicalDetail(user.role);
  const progress = showJourney ? await prisma.student.findUniqueOrThrow({
    where: { id },
    select: {
      caseStudy: { select: { status: true } },
      profile: { select: { id: true } },
      plans: {
        where: { status: "ativo" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { objectives: { where: { status: "ativo" }, take: 1, select: { id: true } } },
      },
      activities: { where: { status: { in: ["aceita", "aplicada"] } }, take: 1, select: { id: true } },
      diaryEntries: { take: 1, select: { id: true } },
    },
  }) : null;

  return (
    <>
      <Link href="/estudantes" className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline print:hidden">
        <ArrowLeft size={16} aria-hidden /> Voltar para estudantes
      </Link>
      <div className="mb-4 flex items-start gap-3 rounded-[24px] bg-surface-muted p-4 sm:gap-4 sm:p-5">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full font-display text-xl font-medium text-ink sm:size-14"
          style={{ backgroundColor: `oklch(88% 0.07 ${student.avatarHue})` }}
        >
          {student.name[0]}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-medium tracking-tight text-ink sm:text-3xl">{student.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {ageFrom(student.birthDate)} anos · {student.gradeYear} ({student.className}) · {SHIFTS[student.shift] ?? student.shift} · {STAGES[student.stage] ?? student.stage}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">{student.school.name}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {student.hasAEE ? <Badge tone="brand">AEE {student.aeeFrequency ?? ""}</Badge> : null}
            {student.supportProfessional ? <Badge tone="green">Profissional de apoio</Badge> : null}
            {student.accessibilityNotes ? <Badge tone="amber">{student.accessibilityNotes}</Badge> : null}
          </div>
        </div>
      </div>

      {progress ? (
        <StudentJourney progress={{
          id: student.id,
          caseStudy: (progress.caseStudy?.status as "rascunho" | "concluido" | undefined) ?? null,
          hasProfile: Boolean(progress.profile),
          hasPlan: progress.plans.length > 0,
          hasObjective: (progress.plans[0]?.objectives.length ?? 0) > 0,
          hasPreparedActivity: progress.activities.length > 0,
          hasDiary: progress.diaryEntries.length > 0,
        }} />
      ) : null}

      <div className="mb-6">
        <StudentTabs studentId={student.id} showCaseStudy={showJourney} showDua={showJourney && canPlanDua(user)} />
      </div>

      {children}
    </>
  );
}
