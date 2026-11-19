import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/prisma";
import { studentContext } from "@/lib/page-context";
import { ageFrom, formatTime } from "@/lib/dates";
import { STAGES, SHIFTS } from "@/lib/scale";
import { Badge } from "@/components/ui";
import { StudentTabs } from "@/components/student-tabs";
import { StudentJourney, StudentNextStepLink } from "@/components/student-journey";
import { StudentHead } from "@/components/student-head";
import { HEAD_PART } from "@/components/student-head-parts";
import { JOURNEY_SELECT, journeyFacts } from "@/lib/student-journey";
import { headSignature } from "./head-signature";

export default async function StudentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const prisma = await db();
  const { id } = await params;
  const { student, grant, can } = await studentContext(id);
  const journey = can.edit ? { id, ...journeyFacts(await prisma.student.findUniqueOrThrow({ where: { id }, select: JOURNEY_SELECT })) } : null;
  const signature = can.edit ? await headSignature(id) : null;

  return (
    <>
      <StudentHead>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-surface-muted px-3 py-3 sm:px-4">
          <Link href="/estudantes" aria-label="Voltar para estudantes" title="Voltar para estudantes" className="circle-link size-11 bg-paper-raised print:hidden">
            <ArrowLeft size={18} aria-hidden />
          </Link>
          <span
            aria-hidden
            className={`${HEAD_PART.avatar} flex size-12 shrink-0 items-center justify-center rounded-full font-display text-xl font-medium text-ink`}
            style={{ backgroundColor: `oklch(88% 0.07 ${student.avatarHue})` }}
          >
            {student.name[0]}
          </span>
          {signature ? <div className="ml-auto sm:hidden">{signature}</div> : null}
          <div className="min-w-0 flex-1 basis-64">
            <h1 className={`${HEAD_PART.name} font-display text-2xl font-medium leading-tight tracking-tight text-ink`}>{student.name}</h1>
            <p className={`${HEAD_PART.detail} mt-0.5 text-sm text-ink-soft`}>
              {ageFrom(student.birthDate)} anos · {student.gradeYear} ({student.className}) · {SHIFTS[student.shift] ?? student.shift} · {STAGES[student.stage] ?? student.stage} · {student.school.name}
            </p>
            {student.aeeFrequency || student.supportProfessional || student.accessibilityNotes ? (
              <div className={`${HEAD_PART.detail} mt-2 flex min-w-0 flex-wrap gap-1.5`}>
                {student.aeeFrequency ? <Badge tone="info">AEE {student.aeeFrequency}</Badge> : null}
                {student.supportProfessional ? <Badge tone="info">Profissional de apoio</Badge> : null}
                {student.accessibilityNotes ? <Badge tone="mid">{student.accessibilityNotes}</Badge> : null}
              </div>
            ) : null}
          </div>
          {journey || signature ? (
            <div className="flex shrink-0 flex-col items-end gap-2 empty:hidden max-sm:contents">
              {journey ? <StudentNextStepLink progress={journey} /> : null}
              {signature ? <div className="max-sm:hidden">{signature}</div> : null}
            </div>
          ) : null}
        </div>
        <StudentTabs studentId={student.id} can={{ edit: can.edit, dua: can.dua }} />
      </StudentHead>

      {grant ? (
        <p role="status" className="mb-6 rounded-2xl bg-amber-soft px-4 py-3 text-sm leading-relaxed text-amber">
          Acesso de leitura com motivo registrado, válido até {formatTime(grant.expiresAt)}. A família vê este acesso; a Secretaria não altera a ficha.
        </p>
      ) : null}
      {journey ? <StudentJourney progress={journey} /> : null}

      {children}
    </>
  );
}
