import Link from "next/link";
import { BookOpen } from "lucide-react";
import { pillBySlug, readingMinutes } from "@/lib/learning-pills";

export function PillLink({ slug }: { slug: string }) {
  const pill = pillBySlug(slug);
  if (!pill) return null;
  const minutes = readingMinutes(pill);
  return (
    <Link href={`/ajuda/pilulas/${pill.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-action-ink hover:bg-action-soft">
      <BookOpen size={16} aria-hidden className="shrink-0" /> Saiba mais ({minutes} min)<span className="sr-only">: {pill.title}</span>
    </Link>
  );
}
