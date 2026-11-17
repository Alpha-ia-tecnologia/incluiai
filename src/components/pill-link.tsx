import Link from "next/link";
import { BookOpen } from "lucide-react";
import { pillBySlug, readingMinutes } from "@/lib/learning-pills";

export function PillLink({ slug, onNavy = false }: { slug: string; onNavy?: boolean }) {
  const pill = pillBySlug(slug);
  if (!pill) return null;
  const minutes = readingMinutes(pill);
  return (
    <Link href={`/ajuda/pilulas/${pill.slug}`} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium ${onNavy ? "text-on-navy hover:bg-navy-hover" : "text-brand-strong hover:bg-brand-soft"}`}>
      <BookOpen size={16} aria-hidden className="shrink-0" /> Saiba mais ({minutes} min)<span className="sr-only">: {pill.title}</span>
    </Link>
  );
}
