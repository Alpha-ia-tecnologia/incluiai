import Image from "next/image";
import { ArrowRight, CircleCheck } from "lucide-react";
import { Badge, ButtonLink } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { PictogramKey } from "@/lib/pictograms";
import { Pictogram } from "./pictogram";
import { materialImageUrl } from "./material-view";

// Cartão da galeria de materiais: miniatura (a imagem do primeiro cartão ou o
// pictograma dele), tipo, situação e o tamanho do material. O material inteiro
// abre na página própria; a galeria fica curta mesmo com muitos materiais.

export type MaterialSummary = {
  id: string;
  title: string;
  kindLabel: string;
  approved: boolean;
  createdAt: Date;
  cards: number;
  activities: number;
  // Imagem desenhada do primeiro cartão ou, sem ela, o pictograma de reserva.
  thumb: { at: Date } | null;
  pictogram: PictogramKey;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function MaterialGalleryCard({ studentId, material }: { studentId: string; material: MaterialSummary }) {
  const titleId = `material-${material.id}-cartao`;
  return (
    <article id={`material-${material.id}`} aria-labelledby={titleId} className="flex w-full min-w-0 scroll-mt-24 flex-col rounded-2xl border border-line bg-paper-raised p-4 shadow-e1">
      {/* Miniatura decorativa: o título e os dados abaixo dizem o que é. */}
      <div className="flex h-36 items-center justify-center rounded-xl bg-brand-soft">
        {material.thumb ? (
          <Image src={materialImageUrl(material.id, 0, material.thumb.at)} alt="" width={1024} height={1024} unoptimized className="size-28 rounded-xl bg-paper-raised object-contain" />
        ) : (
          <Pictogram pictogram={material.pictogram} className="size-28" />
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Badge tone="brand">{material.kindLabel}</Badge>
        {material.approved ? <Badge tone="green"><CircleCheck size={12} aria-hidden /> Aprovado para uso</Badge> : <Badge tone="amber">Aguarda aprovação</Badge>}
      </div>
      <h3 id={titleId} className="mt-2 break-words font-display text-xl font-medium leading-snug text-ink">{material.title}</h3>
      <p className="mt-1 text-sm tabular-nums text-ink-soft">
        Criado em {formatDate(material.createdAt)} · {plural(material.cards, "cartão", "cartões")} · {plural(material.activities, "atividade", "atividades")}
      </p>
      <div className="mt-auto pt-4">
        <ButtonLink href={`/estudantes/${studentId}/materiais/${material.id}`} variant="secondary">
          Abrir material<span className="sr-only">: {material.title}</span> <ArrowRight size={16} aria-hidden />
        </ButtonLink>
      </div>
    </article>
  );
}
