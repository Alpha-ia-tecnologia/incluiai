import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { generateMaterial, deleteMaterial } from "@/actions/materials";
import { parseJson, formatDate } from "@/lib/format";
import { MATERIAL_KINDS, type MaterialContent } from "@/lib/materials";
import { PrintButton } from "@/components/print-button";
import { PageHeader, Card, SectionTitle, Badge, EmptyState, AIDisclaimer } from "@/components/ui";
import { Wand2, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

const KIND_LABELS = Object.fromEntries(MATERIAL_KINDS.map((k) => [k.kind, k.label]));

export default async function MaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, materials] = await Promise.all([
    prisma.functionalProfile.findUnique({ where: { studentId: id } }),
    prisma.material.findMany({ where: { studentId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  const generate = generateMaterial.bind(null, id);

  return (
    <>
      <PageHeader
        title="Materiais de apoio"
        lede="Crie materiais para apoiar a rotina, a comunicação e a participação do estudante. Revise o conteúdo antes de imprimir e usar."
      />

      <Card className="mb-8 max-w-3xl print:hidden">
        <SectionTitle>Criar um material</SectionTitle>
        {!profile ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Primeiro, conte como o estudante aprende. Essas informações ajudam a preparar os materiais.{" "}
            <Link href={`/estudantes/${id}/perfil`} className="font-medium text-brand-strong underline underline-offset-4">
              Preencher Como aprende
            </Link>
          </p>
        ) : (
          <form action={generate} className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 basis-full sm:basis-56 sm:flex-1">
              <label htmlFor="kind" className="mb-1 block text-xs font-medium text-ink-soft">Tipo de material</label>
              <select id="kind" name="kind" className="min-h-11 w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink sm:text-sm">
                {MATERIAL_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label} — {k.description}</option>)}
              </select>
            </div>
            <button type="submit" className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-e1 transition-all hover:bg-brand-strong hover:shadow-e2 active:translate-y-px">
              <Wand2 size={15} aria-hidden /> Criar material
            </button>
          </form>
        )}
        <AIDisclaimer />
      </Card>

      {materials.length === 0 ? (
        <EmptyState title="Seus materiais aparecerão aqui" hint={profile ? "Escolha um tipo de material acima e toque em Criar material." : "Preencha Como aprende para começar a criar materiais para este estudante."} />
      ) : (
        <div className="space-y-5">
          {materials.map((m) => {
            const content = parseJson<MaterialContent>(m.content, { intro: "", cards: [] });
            const remove = deleteMaterial.bind(null, id, m.id);
            return (
              <div key={m.id} className="rounded-xl border border-line bg-paper-raised p-5 shadow-e1 print:break-inside-avoid">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="brand">{KIND_LABELS[m.kind] ?? m.kind}</Badge>
                    <h3 className="font-display text-lg font-semibold text-ink">{m.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 print:hidden">
                    <PrintButton />
                    <form action={remove}>
                      <button type="submit" aria-label={`Excluir material: ${m.title}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-2 text-sm text-ink-soft hover:bg-coral-soft hover:text-coral">
                        <Trash2 size={15} aria-hidden /> Excluir
                      </button>
                    </form>
                  </div>
                </div>
                <p className="mb-4 text-sm text-ink-soft">{content.intro}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {content.cards.map((c, i) => (
                    <div key={i} className="flex flex-col items-center justify-center rounded-lg border border-line bg-paper px-3 py-5 text-center">
                      <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft font-display text-lg font-semibold text-brand-strong" aria-hidden>{i + 1}</span>
                      <span className="mt-2 text-sm font-medium text-ink">{c.label}</span>
                      {c.hint ? <span className="mt-0.5 text-[11px] text-ink-soft">{c.hint}</span> : null}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-ink-soft print:hidden">Gerado em {formatDate(m.createdAt)}</p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

