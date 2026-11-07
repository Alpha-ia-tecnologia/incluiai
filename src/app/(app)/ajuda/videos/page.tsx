import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { tutorialsFor } from "@/lib/tutorials";
import { PageHeader } from "@/components/ui";
import { TutorialCard } from "@/components/tutorial-card";

export const dynamic = "force-dynamic";

// Todos os vídeos tutoriais do perfil de quem entrou.
export default async function TutorialsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const tutorials = await tutorialsFor(user.role);
  if (!tutorials.length) redirect("/ajuda");
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/ajuda" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline"><ArrowLeft size={16} aria-hidden /> Ajuda</Link>
      <PageHeader title="Vídeos" />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tutorials.map((tutorial) => <li key={tutorial.id} className="min-w-0"><TutorialCard tutorial={tutorial} /></li>)}
      </ul>
    </div>
  );
}
