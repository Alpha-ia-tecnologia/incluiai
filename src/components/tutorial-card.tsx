import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { formatDuration, type Tutorial } from "@/lib/tutorials-core";

// Cartão de um vídeo tutorial: capa, duração e título. Leva à página do vídeo.
export function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
  return (
    <Link href={`/ajuda/videos/${tutorial.id}`} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-paper-raised transition-colors hover:border-brand">
      <span className="relative block aspect-video bg-surface-muted">
        {tutorial.poster ? <Image src={`/tutoriais/${tutorial.poster}`} alt="" width={1920} height={1080} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="size-full object-cover" /> : null}
        <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-ink-strong/10">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand text-white shadow-e2 transition-colors group-hover:bg-brand-strong"><Play size={22} className="ml-0.5" fill="currentColor" /></span>
        </span>
        <span className="absolute bottom-2 right-2 rounded-full bg-ink-strong/85 px-2 py-0.5 text-xs font-medium tabular-nums text-white">{formatDuration(tutorial.seconds)}</span>
      </span>
      <span className="p-4 text-base font-medium leading-snug">{tutorial.title}</span>
    </Link>
  );
}
