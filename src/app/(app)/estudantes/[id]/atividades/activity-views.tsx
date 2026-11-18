import Link from "next/link";
import { activityViews, type StudentTabAccess } from "@/lib/student-tab-list";

export function ActivityViews({ studentId, can, current }: { studentId: string; can: StudentTabAccess; current: string }) {
  const views = activityViews(can);
  if (views.length < 2) return null;
  return (
    <nav aria-label="Vistas do passo Atividade" className="mb-6 print:hidden">
      <ul className="flex flex-wrap gap-2">
        {views.map((view) => (
          <li key={view.slug}>
            <Link
              href={`/estudantes/${studentId}/${view.slug}`}
              aria-current={view.slug === current ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-4 py-3 text-sm transition-colors ${view.slug === current ? "bg-brand font-medium text-white" : "bg-surface-muted text-ink-soft hover:bg-line hover:text-ink"}`}
            >
              {view.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
