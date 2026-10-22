import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadEvidence, type StudentEvidence } from "@/lib/dossier";
import { itemTotals } from "@/lib/evidence";
import { smallNumber } from "@/lib/assessment";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { DataBoard, StatTile } from "@/components/data-viz";
import { EvidenceBadge } from "@/components/dossier/evidence-list";

export const dynamic = "force-dynamic";

// Dossiê da escola (item 8): a coordenação e o AEE veem, estudante a estudante,
// o que falta. A Secretaria vê a rede em números, sem nomes (seção 10).
const SCHOOL_ROLES = new Set(["coordenacao", "gestao", "professor_aee"]);
const FILTERS = [{ value: "", label: "Todos os estudantes" }, { value: "pendentes", label: "Só com pendências" }];

function Totals({ students, network }: { students: StudentEvidence[]; network: boolean }) {
  const totals = itemTotals(students).slice(0, 6);
  const count = (value: number) => (network ? smallNumber(value) : String(value));
  if (!totals.length) return null;
  return (
    <Card>
      <SectionTitle>O que mais falta</SectionTitle>
      <ul className="grid gap-2 text-sm text-ink">
        {totals.map((total) => (
          <li key={total.id} className="min-w-0"><span className="font-medium">{total.label}:</span> {[total.pendente && `${count(total.pendente)} ${total.pendente === 1 ? "pendente" : "pendentes"}`, total.conferir && `${count(total.conferir)} para conferir`].filter(Boolean).join(" e ")}.</li>
        ))}
      </ul>
    </Card>
  );
}

export default async function SchoolDossierPage({ searchParams }: { searchParams: Promise<{ filtro?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const network = user.role === "secretaria";
  if (!network && !SCHOOL_ROLES.has(user.role)) redirect("/");
  const filter = (await searchParams).filtro === "pendentes" ? "pendentes" : "";
  const students = await loadEvidence(!network && user.schoolId ? { schoolId: user.schoolId } : {});
  const clear = students.filter((student) => !student.summary.pendente).length;
  const lede = "O que o Decreto nº 12.686/2025 e a Portaria MEC nº 421/2026 pedem para cada estudante do AEE e o que ainda falta registrar.";

  if (network) {
    const schools = [...Map.groupBy(students, (student) => student.schoolId).values()].sort((a, b) => a[0].school.localeCompare(b[0].school, "pt-BR"));
    return (
      <>
        <PageHeader title="Dossiê de evidências" lede={`${lede} A rede vê os números, sem nomes; para abrir o dossiê de um estudante, a ficha pede o motivo.`} />
        <div className="grid min-w-0 max-w-4xl gap-6">
          <DataBoard className="sm:grid-cols-2">
            <StatTile label="Estudantes" value={students.length} />
            <StatTile label="Sem pendências" value={smallNumber(clear)} hint="Números abaixo de 5 aparecem como “menos de 5”." />
          </DataBoard>
          <Totals students={students} network />
          <section aria-labelledby="dossie-escolas" className="grid min-w-0 gap-3">
            <h2 id="dossie-escolas" className="text-base font-medium text-ink">Por escola</h2>
            {schools.map((school) => {
              const top = itemTotals(school).filter((total) => total.pendente).slice(0, 3);
              return (
                <Card key={school[0].schoolId} className="min-w-0">
                  <h3 className="text-sm font-medium text-ink">{school[0].school}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{school.length} {school.length === 1 ? "estudante" : "estudantes"}; sem pendências: {smallNumber(school.filter((student) => !student.summary.pendente).length)}.</p>
                  {top.length ? <p className="mt-2 text-sm text-ink"><span className="font-medium">Mais pendentes:</span> {top.map((total) => `${total.short} (${smallNumber(total.pendente)})`).join("; ")}.</p> : null}
                </Card>
              );
            })}
          </section>
        </div>
      </>
    );
  }

  const shown = students
    .filter((student) => !filter || student.summary.pendente)
    .sort((a, b) => b.summary.pendente - a.summary.pendente || b.summary.conferir - a.summary.conferir || a.name.localeCompare(b.name, "pt-BR"));
  return (
    <>
      <PageHeader title="Dossiê de evidências" lede={lede} />
      <div className="grid min-w-0 max-w-4xl gap-6">
        <DataBoard className="sm:grid-cols-3">
          <StatTile label="Estudantes" value={students.length} />
          <StatTile label="Sem pendências" value={clear} />
          <StatTile label="Com pendências" value={students.length - clear} />
        </DataBoard>
        <Totals students={students} network={false} />
        <section aria-labelledby="dossie-estudantes" className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="dossie-estudantes" className="text-base font-medium text-ink">Estudantes</h2>
            <nav aria-label="Filtrar estudantes" className="flex flex-wrap gap-2">
              {FILTERS.map((option) => (
                <Link key={option.value} href={option.value ? `/dossie?filtro=${option.value}` : "/dossie"} aria-current={filter === option.value ? "page" : undefined}
                  className="inline-flex min-h-11 items-center rounded-full border border-line bg-paper px-4 text-sm text-ink hover:border-brand aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:font-medium aria-[current=page]:text-brand-strong">{option.label}</Link>
              ))}
            </nav>
          </div>
          {shown.length ? (
            <ul className="grid min-w-0 gap-3">
              {shown.map((student) => {
                const missing = student.groups.flatMap((group) => group.items).filter((item) => item.status === "pendente");
                return (
                  <li key={student.id} className="min-w-0 rounded-2xl border border-line bg-paper-raised p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/estudantes/${student.id}/dossie`} className="min-w-0 break-words text-sm font-medium text-brand-strong underline underline-offset-4">{student.name}</Link>
                      <span className="flex flex-wrap gap-2">
                        {student.summary.pendente ? <Badge tone="coral">{student.summary.pendente} {student.summary.pendente === 1 ? "pendente" : "pendentes"}</Badge> : <EvidenceBadge status="ok" />}
                        {student.summary.conferir ? <Badge tone="amber">{student.summary.conferir} para conferir</Badge> : null}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">{student.className}{students.some((other) => other.schoolId !== student.schoolId) ? ` · ${student.school}` : ""}</p>
                    {missing.length ? <p className="mt-2 text-sm text-ink"><span className="font-medium">Falta:</span> {missing.map((item) => item.short).join(", ")}.</p> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState character="care" title={filter ? "Nenhum estudante com pendência" : "Nenhum estudante"} hint={filter ? "Todos os dossiês estão sem pendências." : "Os estudantes da escola aparecem aqui."} />
          )}
        </section>
      </div>
    </>
  );
}
