import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessStudent, canEditStudentRecord, canSeePedagogicalDetail, hasNominalAccess, needsNominalJustification } from "@/lib/auth";
import { ageFrom } from "@/lib/format";
import { STAGES, SHIFTS } from "@/lib/scale";
import { Badge } from "@/components/ui";
import { StudentTabs } from "@/components/student-tabs";
import { StudentJourney, StudentNextStepLink } from "@/components/student-journey";
import { StudentHead } from "@/components/student-head";
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
  // A ficha é da equipe. Família e terapeuta têm o portal deles (seções 8 e 12
  // da proposta): pelo endereço, as abas mostravam notas e o diário pedagógico.
  if (user.role === "familia") redirect(`/familia/${student.id}`);
  if (user.role === "terapeuta") redirect("/terapeuta");
  // A Secretaria abre a ficha com nome só depois de informar o motivo.
  if (!(await hasNominalAccess(user, student.id))) redirect(`/acesso-nominal/${student.id}`);

  const showJourney = canSeePedagogicalDetail(user.role);
  // Secretaria com motivo registrado: leitura, sem as abas de trabalho.
  const readOnly = !canEditStudentRecord(user.role);
  const grant = needsNominalJustification(user.role)
    ? await prisma.accessGrant.findFirst({ where: { userId: user.id, studentId: student.id, expiresAt: { gt: new Date() } }, orderBy: { expiresAt: "desc" }, select: { expiresAt: true } })
    : null;
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

  const journey = progress ? {
    id: student.id,
    caseStudy: (progress.caseStudy?.status as "rascunho" | "concluido" | undefined) ?? null,
    hasProfile: Boolean(progress.profile),
    hasPlan: progress.plans.length > 0,
    hasObjective: (progress.plans[0]?.objectives.length ?? 0) > 0,
    hasPreparedActivity: progress.activities.length > 0,
    hasDiary: progress.diaryEntries.length > 0,
  } : null;

  // Cabeçalho numa linha (identidade, selos e próximo passo) e abas numa linha:
  // o conteúdo da aba começa logo na primeira tela.
  return (
    <>
      <StudentHead>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-surface-muted px-3 py-3 sm:px-4">
          <Link href="/estudantes" aria-label="Voltar para estudantes" title="Voltar para estudantes" className="circle-link size-11 bg-paper-raised print:hidden">
            <ArrowLeft size={18} aria-hidden />
          </Link>
          <span
            aria-hidden
            className="student-head-avatar flex size-12 shrink-0 items-center justify-center rounded-full font-display text-xl font-medium text-ink"
            style={{ backgroundColor: `oklch(88% 0.07 ${student.avatarHue})` }}
          >
            {student.name[0]}
          </span>
          <div className="min-w-0 flex-1 basis-64">
            <h1 className="student-head-name font-display text-2xl font-medium leading-tight tracking-tight text-ink">{student.name}</h1>
            <p className="student-head-detail mt-0.5 text-sm text-ink-soft">
              {ageFrom(student.birthDate)} anos · {student.gradeYear} ({student.className}) · {SHIFTS[student.shift] ?? student.shift} · {STAGES[student.stage] ?? student.stage} · {student.school.name}
            </p>
            {/* Selos embaixo da identidade: o nome e a turma ficam numa linha só. */}
            {student.hasAEE || student.supportProfessional || student.accessibilityNotes ? (
              <div className="student-head-detail mt-2 flex min-w-0 flex-wrap gap-1.5">
                {student.hasAEE ? <Badge tone="brand">AEE {student.aeeFrequency ?? ""}</Badge> : null}
                {student.supportProfessional ? <Badge tone="green">Profissional de apoio</Badge> : null}
                {student.accessibilityNotes ? <Badge tone="amber">{student.accessibilityNotes}</Badge> : null}
              </div>
            ) : null}
          </div>
          {journey && !readOnly ? <StudentNextStepLink progress={journey} /> : null}
        </div>
        <StudentTabs studentId={student.id} showCaseStudy={showJourney} showDua={showJourney && canPlanDua(user)} readOnly={readOnly} />
      </StudentHead>

      {grant ? (
        <p role="status" className="mb-6 rounded-2xl bg-amber-soft px-4 py-3 text-sm leading-relaxed text-amber">
          Acesso de leitura com motivo registrado, válido até {grant.expiresAt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}. A família vê este acesso; a Secretaria não altera a ficha.
        </p>
      ) : null}
      {journey && !readOnly ? <StudentJourney progress={journey} /> : null}

      {children}
    </>
  );
}
