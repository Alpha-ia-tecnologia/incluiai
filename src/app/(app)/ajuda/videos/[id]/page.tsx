import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { tutorialsFor } from "@/lib/tutorials";
import { formatDuration } from "@/lib/tutorials-core";
import { Badge, PageHeader } from "@/components/ui";
import { TutorialCard } from "@/components/tutorial-card";

export const dynamic = "force-dynamic";

export default async function TutorialPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const tutorials = await tutorialsFor(user.role);
  const index = tutorials.findIndex((tutorial) => tutorial.id === id);
  if (index < 0) notFound();
  const tutorial = tutorials[index];
  const next = [...tutorials.slice(index + 1), ...tutorials.slice(0, index)].slice(0, 3);
  return (
    <div className="mx-auto max-w-4xl">
      <Link href={tutorials.length > 1 ? "/ajuda/videos" : "/ajuda"} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline"><ArrowLeft size={16} aria-hidden /> {tutorials.length > 1 ? "Vídeos" : "Ajuda"}</Link>
      <PageHeader title={tutorial.title} lede={tutorial.summary} />
      <p className="-mt-2 mb-5 flex flex-wrap gap-2">
        <Badge tone="brand"><Clock size={12} aria-hidden /> {formatDuration(tutorial.seconds)}</Badge>
        <Badge>{tutorial.audience}</Badge>
      </p>
      <video controls preload="metadata" playsInline poster={tutorial.poster ? `/tutoriais/${tutorial.poster}` : undefined} className="aspect-video w-full rounded-2xl border border-line bg-ink-strong" aria-label={`Vídeo: ${tutorial.title}`}>
        <source src={`/tutoriais/${tutorial.video}`} type="video/mp4" />
      </video>
      {next.length ? (
        <section aria-labelledby="proximos-videos" className="mt-10">
          <h2 id="proximos-videos" className="mb-4 text-xl font-medium">Próximos vídeos</h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {next.map((item) => <li key={item.id} className="min-w-0"><TutorialCard tutorial={item} /></li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
