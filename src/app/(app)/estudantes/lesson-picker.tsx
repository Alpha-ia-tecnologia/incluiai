import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { lastRecordLabel, lessonLogHref } from "@/lib/lesson-log";

type PickerStudent = { id: string; name: string; gradeYear: string; className: string; status: string; avatarHue: number };

const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("");

export function LessonPicker({ students, lastRecords }: { students: PickerStudent[]; lastRecords: ReadonlyMap<string, Date | null> }) {
  const now = new Date();
  return (
    <ul aria-label="Estudantes" className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised">
      {students.map((student) => (
        <li key={student.id}>
          <Link href={lessonLogHref(student.id)} className="group flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-brand-soft/50 sm:px-5">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium text-ink" style={{ backgroundColor: `oklch(88% 0.07 ${student.avatarHue})` }}>{initials(student.name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium leading-snug text-ink [overflow-wrap:anywhere]">{student.name}</span>
              <span className="mt-0.5 block text-sm text-ink-soft">
                {[student.gradeYear, student.className, student.status === "ativo" ? "" : student.status, lastRecordLabel(lastRecords.get(student.id), now)].filter(Boolean).join(" · ")}
              </span>
            </span>
            <ArrowRight size={18} aria-hidden className="shrink-0 text-brand-strong transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
