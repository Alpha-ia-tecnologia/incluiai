import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { getCurrentUser, isStaffOrNetwork } from "@/lib/auth";
import { PILLS, pillBySlug, readingMinutes } from "@/lib/learning-pills";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { ReadAloud } from "@/components/read-aloud";
import { linkCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

// Uma pílula de formação (item 9): por que importa, como fazer, um exemplo,
// o que evitar e onde fazer na plataforma. Para a equipe da escola e da rede.
export default async function PillPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaffOrNetwork(user.role)) redirect("/ajuda");
  const pill = pillBySlug((await params).slug);
  if (!pill) notFound();
  const others = PILLS.filter((other) => other.slug !== pill.slug);
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/ajuda#pilulas" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline"><ArrowLeft size={16} aria-hidden /> Formação em pílulas</Link>
      <PageHeader title={pill.title} lede={pill.summary} actions={<ReadAloud targetId="pilula" label="Ouvir esta pílula" />} />
      <article id="pilula" className="grid min-w-0 gap-6">
        <p className="flex flex-wrap gap-2"><Badge tone="brand"><BookOpen size={12} aria-hidden /> Leitura de {readingMinutes(pill)} min</Badge></p>
        <section aria-labelledby="pilula-porque">
          <h2 id="pilula-porque" className="mb-2 text-base font-medium text-ink">Por que importa</h2>
          <p className="text-sm leading-relaxed text-ink">{pill.why}</p>
        </section>
        <section aria-labelledby="pilula-como">
          <h2 id="pilula-como" className="mb-2 text-base font-medium text-ink">Como fazer</h2>
          <ol className="grid gap-2">
            {pill.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink">
                <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-medium text-brand-strong">{index + 1}</span>
                <span className="min-w-0 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>
        <Card className="bg-sky-soft/60">
          <SectionTitle>Um exemplo</SectionTitle>
          <p className="text-sm leading-relaxed text-ink">{pill.example}</p>
        </Card>
        <section aria-labelledby="pilula-cuidado">
          <h2 id="pilula-cuidado" className="mb-2 text-base font-medium text-ink">Cuidado com</h2>
          <ul className="grid list-disc gap-1 pl-5 text-sm leading-relaxed text-ink">
            {pill.avoid.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
        <section aria-labelledby="pilula-onde" className="rounded-2xl bg-brand-soft p-4 sm:p-5">
          <h2 id="pilula-onde" className="mb-2 text-base font-medium text-ink">Na plataforma</h2>
          <p className="text-sm leading-relaxed text-ink">{pill.where.text}</p>
          <p className="mt-2 text-sm"><Link href={pill.where.href} className={linkCls}>Ir para lá</Link></p>
        </section>
        {pill.norm ? <p className="text-xs text-ink-soft">Base: {pill.norm}.</p> : null}
      </article>
      <section aria-labelledby="pilula-outras" className="mt-10">
        <h2 id="pilula-outras" className="mb-3 text-base font-medium text-ink">Outras pílulas</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {others.map((other) => (
            <li key={other.slug}>
              <Link href={`/ajuda/pilulas/${other.slug}`} className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-line bg-paper-raised px-4 py-3 text-sm hover:border-brand">
                <span className="min-w-0">{other.title}</span><ArrowRight size={16} aria-hidden className="shrink-0 text-brand-strong" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
