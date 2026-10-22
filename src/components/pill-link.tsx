import Link from "next/link";
import { BookOpen } from "lucide-react";
import { pillBySlug, readingMinutes } from "@/lib/learning-pills";

// "Saiba mais" ao lado do passo em que a dúvida aparece (formação em pílulas, item 9).
export function PillLink({ slug }: { slug: string }) {
  const pill = pillBySlug(slug);
  if (!pill) return null;
  const minutes = readingMinutes(pill);
  return (
    <Link href={`/ajuda/pilulas/${pill.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-brand-strong hover:bg-brand-soft">
      <BookOpen size={16} aria-hidden className="shrink-0" /> Saiba mais ({minutes} min)<span className="sr-only">: {pill.title}</span>
    </Link>
  );
}
