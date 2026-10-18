import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessStudent, canSeePedagogicalDetail, getCurrentUser, isStaffOrNetwork, requireStudentPage } from "@/lib/auth";
import { isAIEnabled } from "@/lib/agents/model";
import { isImageGenerationEnabled } from "@/lib/images/openai-images";
import { MATERIAL_KINDS, isMaterialKind } from "@/lib/material-content";
import { PageHeader, Card, SectionTitle, EmptyState, ButtonLink } from "@/components/ui";
import { linkCls } from "@/components/form-styles";
import { MaterialForm } from "@/components/materials/material-form";
import { MaterialGalleryCard, materialSummary, type MaterialSummary } from "@/components/materials/material-gallery";

export const dynamic = "force-dynamic";

type Query = { situacao?: string | string[]; tipo?: string | string[] };
type Status = "sugerido" | "aprovado";

const STATUS_FILTERS: { value: Status; label: string }[] = [
  { value: "sugerido", label: "Aguardam aprovação" },
  { value: "aprovado", label: "Aprovados" },
];

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

// Materiais de apoio do estudante: a IA (ou as regras) cria a partir do perfil
// um material completo — cartões com pictogramas, como usar e atividades para
// aplicar — que fica como sugestão até a equipe aprovar. Aqui fica a galeria;
// cada material abre na página própria (materiais/[materialId]).
export default async function MaterialsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await requireStudentPage(id);
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // O layout do estudante já confere o acesso; a página confere de novo, perto dos dados.
  const student = await prisma.student.findUnique({ where: { id }, select: { schoolId: true } });
  if (!student || !canAccessStudent(user, student.schoolId, id)) redirect("/");
  const team = isStaffOrNetwork(user.role) && canSeePedagogicalDetail(user.role);
  const [profile, materials, objectives] = await Promise.all([
    prisma.functionalProfile.findUnique({ where: { studentId: id }, select: { id: true } }),
    prisma.material.findMany({
      where: { studentId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, title: true, status: true, content: true, createdAt: true, images: { where: { cardIndex: 0 }, select: { createdAt: true } } },
    }),
    team ? prisma.objective.findMany({ where: { plan: { studentId: id, status: "ativo" }, status: "ativo" }, select: { id: true, description: true }, orderBy: { createdAt: "asc" } }) : [],
  ]);

  // Só o resumo vai para a galeria: o conteúdo inteiro fica na página do material.
  const summaries: (MaterialSummary & { kind: string; status: Status })[] = materials.map((material) => ({
    ...materialSummary(material),
    kind: material.kind,
    status: material.status === "aprovado" ? "aprovado" : "sugerido",
  }));

  // Filtro pela URL (?situacao=&tipo=): links simples, sem JavaScript.
  const statusFilter = STATUS_FILTERS.find((item) => item.value === one(query.situacao))?.value ?? null;
  const kindParam = one(query.tipo);
  const kindFilter = isMaterialKind(kindParam) ? kindParam : null;
  const byStatus = (status: Status | null) => (item: { status: Status }) => !status || item.status === status;
  const byKind = (kind: string | null) => (item: { kind: string }) => !kind || item.kind === kind;
  const shown = summaries.filter(byStatus(statusFilter)).filter(byKind(kindFilter));
  const kindsPresent = MATERIAL_KINDS.filter((item) => summaries.some((summary) => summary.kind === item.kind));
  const base = `/estudantes/${id}/materiais`;
  const href = (status: Status | null, kind: string | null) => {
    const search = new URLSearchParams();
    if (status) search.set("situacao", status);
    if (kind) search.set("tipo", kind);
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };
  const statusOptions = [{ value: null, label: "Todos" }, ...STATUS_FILTERS].map((item) => ({
    label: item.label,
    href: href(item.value, kindFilter),
    active: statusFilter === item.value,
    count: summaries.filter(byKind(kindFilter)).filter(byStatus(item.value)).length,
  }));
  const kindOptions = [{ kind: null, label: "Todos os tipos" }, ...kindsPresent].map((item) => ({
    label: item.label,
    href: href(statusFilter, item.kind),
    active: kindFilter === item.kind,
    count: summaries.filter(byStatus(statusFilter)).filter(byKind(item.kind)).length,
  }));
  const filtering = Boolean(statusFilter || kindFilter);

  return (
    <>
      <PageHeader
        level={2}
        title="Materiais de apoio"
        lede="Materiais feitos para este estudante, a partir de como ele aprende: cartões com pictogramas, orientações e atividades para aplicar na sala, no AEE e em casa."
      />

      {team ? (
        <Card className="mb-8 max-w-4xl print:hidden">
          <SectionTitle>Criar um material</SectionTitle>
          {!profile ? (
            <p className="text-sm leading-relaxed text-ink-soft">
              Primeiro, conte como o estudante aprende. É dali que saem os cartões, as adaptações e as atividades.{" "}
              <Link href={`/estudantes/${id}/perfil`} className={linkCls}>Preencher Como aprende</Link>
            </p>
          ) : (
            <MaterialForm
              studentId={id}
              objectives={objectives}
              defaultContext={user.role === "professor_sala" ? "sala_comum" : "aee"}
              aiOn={isAIEnabled()}
              imagesOn={isImageGenerationEnabled()}
            />
          )}
        </Card>
      ) : null}

      {summaries.length === 0 ? (
        <EmptyState
          character="ideas"
          title="Os materiais aparecerão aqui"
          hint={!team ? "Quando a equipe preparar materiais para este estudante, eles aparecem aqui." : profile ? "Escolha o tipo e a situação acima e toque em Criar material." : "Preencha Como aprende para começar a criar materiais para este estudante."}
          action={team && !profile ? <ButtonLink href={`/estudantes/${id}/perfil`}>Preencher Como aprende</ButtonLink> : undefined}
        />
      ) : (
        <section aria-labelledby="materiais-lista" className="min-w-0">
          <h2 id="materiais-lista" className="mb-4 font-display text-xl font-medium text-ink">
            Materiais deste estudante <span className="tabular-nums">({filtering ? `${shown.length} de ${summaries.length}` : summaries.length})</span>
          </h2>

          {summaries.length > 1 ? (
            <nav aria-label="Filtrar os materiais" className="mb-6 grid min-w-0 gap-3">
              <FilterRow id="filtro-situacao" label="Situação" options={statusOptions} />
              {kindsPresent.length > 1 ? <FilterRow id="filtro-tipo" label="Tipo" options={kindOptions} /> : null}
            </nav>
          ) : null}

          {shown.length ? (
            <ul className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((material) => (
                <li key={material.id} className="flex min-w-0">
                  <MaterialGalleryCard studentId={id} material={material} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-surface-muted p-4 text-sm text-ink-soft">
              Nenhum material com este filtro. <Link href={base} className={linkCls}>Ver todos os materiais</Link>
            </p>
          )}
        </section>
      )}
    </>
  );
}

// Uma linha de filtro: pílulas com a contagem em texto; a ativa fica marcada
// para o leitor de tela (aria-current) e pela cor.
function FilterRow({ id, label, options }: { id: string; label: string; options: { label: string; href: string; active: boolean; count: number }[] }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <p id={id} className="text-sm font-medium text-ink">{label}:</p>
      <ul aria-labelledby={id} className="flex min-w-0 flex-wrap gap-2">
        {options.map((option) => (
          <li key={option.href} className="min-w-0">
            <Link
              href={option.href}
              aria-current={option.active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm transition-colors ${option.active ? "bg-brand font-medium text-white" : "bg-surface-muted text-ink-soft hover:bg-line hover:text-ink"}`}
            >
              {option.label} <span className="tabular-nums">({option.count})</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
