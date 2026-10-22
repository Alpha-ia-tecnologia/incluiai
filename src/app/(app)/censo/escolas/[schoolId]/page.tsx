import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canOpenSchool } from "@/lib/census";
import { schoolCoverage } from "@/lib/census-core";
import { BLOCKING_ISSUES, COVERAGE_HINT, COVERAGE_LABEL, ISSUE_LABEL, MATCH_LABEL, brMoment, schoolFundebNote, type CoverageRow, type CoverageStatus } from "@/lib/census-rules";
import { parseJson } from "@/lib/format";
import { saveSchoolInep, saveStudentInep, uploadCensusFile } from "@/actions/census";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { CensusUploadForm, InepForm } from "@/components/census/census-forms";

export const dynamic = "force-dynamic";

const PENDING: Exclude<CoverageStatus, "dupla">[] = ["ausente", "sem_aee", "sem_comum", "sem_marcacao"];
const blocked = (row: CoverageRow) => row.issues.some((issue) => BLOCKING_ISSUES.has(issue));

function Issues({ row }: { row: CoverageRow }) {
  if (!row.issues.length) return null;
  return (
    <ul className="grid gap-1">
      {row.issues.map((issue) => <li key={issue} className="flex gap-1.5 text-xs leading-relaxed text-amber-800"><TriangleAlert size={14} aria-hidden className="mt-0.5 shrink-0" /> {ISSUE_LABEL[issue]}</li>)}
    </ul>
  );
}
const IMPORT_STATUS: Record<string, string> = { previa: "Prévia aberta", aplicada: "Aplicada", descartada: "Descartada" };

// O Censo de uma escola: código INEP, importação do arquivo e a dupla matrícula
// de cada estudante do AEE. Só a coordenação e a gestão da escola (com nomes).
export default async function CensusSchoolPage({ params, searchParams }: { params: Promise<{ schoolId: string }>; searchParams: Promise<{ aplicado?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { schoolId } = await params;
  if (!canOpenSchool(user, schoolId)) redirect("/censo");
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, inepCode: true } });
  if (!school) notFound();
  const [result, imports] = await Promise.all([
    schoolCoverage(schoolId),
    prisma.censusImport.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, status: true, createdAt: true, createdByName: true, result: true } }),
  ]);
  const applied = (await searchParams).aplicado?.match(/^(\d+)-(\d+)$/);
  const open = imports.find((item) => item.status === "previa");
  const rows = result?.coverage.rows ?? [];
  const note = result ? schoolFundebNote(result.info) : null;
  // Com dupla matrícula, mas com alerta no vínculo: aparecem à parte para conferir no Educacenso.
  const alerts = rows.filter((row) => row.status === "dupla" && row.issues.length);

  return (
    <>
      <Link href="/censo" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline"><ArrowLeft size={16} aria-hidden /> Censo Escolar</Link>
      <PageHeader title={`Censo: ${school.name}`} lede="O arquivo de migração da escola atualiza o cadastro e vira a referência para conferir a dupla matrícula dos estudantes do AEE." />
      <div className="grid min-w-0 max-w-4xl gap-6">
        {applied ? <p role="status" className="flex items-center gap-2 rounded-2xl bg-green-soft px-4 py-3 text-sm font-medium text-green"><Check size={18} aria-hidden /> Arquivo aplicado: {applied[1]} {applied[1] === "1" ? "estudante cadastrado" : "estudantes cadastrados"} e {applied[2]} {applied[2] === "1" ? "atualizado" : "atualizados"}. A referência da escola foi atualizada.</p> : null}

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <Card>
            <SectionTitle>Código INEP da escola</SectionTitle>
            <InepForm action={saveSchoolInep.bind(null, schoolId)} id="escola-inep" label="Código INEP (8 números)" name="inepCode" length={8} value={school.inepCode} />
            <p className="mt-2 text-xs text-ink-soft">Liga o arquivo do Censo a esta escola. Sem o código, ele é preenchido ao aplicar o primeiro arquivo.</p>
          </Card>
          <Card>
            <SectionTitle>Importar o arquivo do Censo</SectionTitle>
            {open ? <p className="mb-3 text-sm"><Link href={`/censo/importacoes/${open.id}`} className="font-medium text-brand-strong underline underline-offset-4">Continuar a prévia de {brMoment(open.createdAt)}</Link></p> : null}
            <CensusUploadForm action={uploadCensusFile.bind(null, schoolId)} />
          </Card>
        </div>

        <section aria-labelledby="censo-dupla" className="grid min-w-0 gap-3">
          <h2 id="censo-dupla" className="text-base font-medium text-ink">Dupla matrícula dos estudantes do AEE</h2>
          {result ? (
            <>
              <p className="text-sm text-ink-soft">Conferido com o arquivo aplicado em {brMoment(result.importedAt)}: {result.coverage.confirmed} de {rows.length} {rows.length === 1 ? "estudante confirmado" : "estudantes confirmados"} no Censo com classe comum presencial e AEE, sem impedimento no vínculo.</p>
              {note ? <p className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${note.tone === "ok" ? "bg-green-soft text-green" : "bg-amber-soft text-amber"}`}>{note.text}</p> : null}
              {PENDING.map((status) => {
                const list = rows.filter((row) => row.status === status);
                if (!list.length) return null;
                return (
                  <Card key={status}>
                    <SectionTitle>{COVERAGE_LABEL[status]} ({list.length})</SectionTitle>
                    <p className="mb-3 text-sm text-ink-soft">{COVERAGE_HINT[status]}</p>
                    <ul className="grid gap-3">
                      {list.map((row) => (
                        <li key={row.id} className="grid min-w-0 gap-2 rounded-xl bg-surface-muted/60 p-3">
                          <Link href={`/estudantes/${row.id}`} className="w-fit text-sm font-medium text-brand-strong underline underline-offset-4">{row.name}</Link>
                          <Issues row={row} />
                          {status === "ausente" ? <InepForm action={saveStudentInep.bind(null, row.id, schoolId)} id={`inep-${row.id}`} label="ID INEP do estudante (12 números)" name="inepId" length={12} /> : null}
                        </li>
                      ))}
                    </ul>
                  </Card>
                );
              })}
              {alerts.length ? (
                <Card>
                  <SectionTitle>Com dupla matrícula, mas com alerta no vínculo ({alerts.length})</SectionTitle>
                  <p className="mb-3 text-sm text-ink-soft">{alerts.some(blocked) ? "Os vínculos com impedimento não chegam ao Fundeb: o Educacenso recusa o arquivo ou não importa a pessoa. " : ""}Confira no Educacenso antes do fechamento.</p>
                  <ul className="grid gap-3">
                    {alerts.map((row) => (
                      <li key={row.id} className="grid min-w-0 gap-2 rounded-xl bg-surface-muted/60 p-3">
                        <Link href={`/estudantes/${row.id}`} className="w-fit text-sm font-medium text-brand-strong underline underline-offset-4">{row.name}</Link>
                        <Issues row={row} />
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
              {result.coverage.confirmed ? (
                <details className="rounded-2xl border border-line bg-paper-raised p-4">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-ink">Confirmados ({result.coverage.confirmed})</summary>
                  <ul className="mt-2 grid gap-1 text-sm text-ink">
                    {rows.filter((row) => row.status === "dupla" && !blocked(row)).map((row) => <li key={row.id}>{row.name} <span className="text-ink-soft">(pelo {row.matchedBy ? MATCH_LABEL[row.matchedBy] : "cadastro"}{row.regularAt ? `; classe comum em ${row.regularAt}` : ""})</span></li>)}
                  </ul>
                </details>
              ) : null}
            </>
          ) : (
            <EmptyState character="care" title="Nenhum arquivo aplicado" hint="Importe o arquivo de migração da escola para conferir a dupla matrícula dos estudantes do AEE." />
          )}
        </section>

        {imports.length ? (
          <section aria-labelledby="censo-importacoes" className="grid min-w-0 gap-2">
            <h2 id="censo-importacoes" className="text-base font-medium text-ink">Importações</h2>
            <ul className="grid gap-2 text-sm text-ink">
              {imports.map((item) => {
                const summary = parseJson<{ created: number; updated: number } | null>(item.result, null);
                return (
                  <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-muted/60 px-4 py-2.5">
                    <span className="font-medium">{brMoment(item.createdAt)}</span> · {item.createdByName}
                    <Badge tone={item.status === "aplicada" ? "green" : item.status === "previa" ? "brand" : "neutral"}>{IMPORT_STATUS[item.status] ?? item.status}</Badge>
                    {summary ? <span className="text-ink-soft">{summary.created} cadastrados, {summary.updated} atualizados</span> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
