import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { loadImport, maskCpf } from "@/lib/census";
import { brMoment, type FieldDiff, type PlanItem } from "@/lib/census-rules";
import { STAGES } from "@/lib/scale";
import { STAGE_GROUPS } from "@/lib/educacenso";
import { applyCensusImport, decideCensusPerson, discardCensusImport, undoCensusDecision } from "@/actions/census";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { DataBoard, StatTile } from "@/components/data-viz";
import { CensusApplyForm, CensusDecisionForm } from "@/components/census/census-forms";
import { quietButtonCls } from "@/components/form-styles";

export const dynamic = "force-dynamic";

const brDay = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "sem data");
const shown = (diff: FieldDiff, value: string) => (diff.field === "cpf" ? maskCpf(value) || "vazio" : diff.field === "birthDate" ? (value ? brDay(value) : "vazio") : value || "vazio");
const DECISION_LABEL = { link: "Vínculo escolhido na revisão", create: "Cadastrar: decidido na revisão", ignore: "Ignorado" };

function Warnings({ item }: { item: PlanItem }) {
  if (!item.warnings.length) return null;
  return <ul className="mt-2 grid gap-1">{item.warnings.map((warning) => <li key={warning} className="flex gap-1.5 text-xs leading-relaxed text-amber-800"><TriangleAlert size={14} aria-hidden className="mt-0.5 shrink-0" /> {warning}</li>)}</ul>;
}

function Undo({ importId, personKey }: { importId: string; personKey: string }) {
  return <form action={undoCensusDecision.bind(null, importId, personKey)}><button type="submit" className={quietButtonCls}>Desfazer a decisão</button></form>;
}

// Prévia da importação: o que o arquivo traz, o que muda no cadastro e o que
// pede revisão. Nada é gravado até "Aplicar".
export default async function CensusImportPage({ params }: { params: Promise<{ importId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { importId } = await params;
  const loaded = await loadImport(user, importId);
  if (!loaded) notFound();
  const { censusImport, plan, stats, schoolNote } = loaded;
  const back = <Link href={`/censo/escolas/${censusImport.schoolId}`} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-strong hover:underline"><ArrowLeft size={16} aria-hidden /> {censusImport.school.name}</Link>;
  if (!plan) {
    return (
      <>
        {back}
        <PageHeader title="Prévia encerrada" lede={censusImport.status === "aplicada" ? "Esta importação já foi aplicada. Os dados das pessoas saíram da prévia e ficou só o resumo." : "Esta prévia foi descartada."} />
      </>
    );
  }
  const by = (action: PlanItem["action"]) => plan.items.filter((item) => item.action === action);
  const review = by("review");
  const decided = plan.items.filter((item) => item.decision);

  return (
    <>
      {back}
      <PageHeader title={`Prévia do Censo: ${censusImport.fileSchoolName}`} lede={`INEP ${censusImport.fileSchoolCode} · leiaute ${stats?.edition ?? "?"} · enviado por ${censusImport.createdByName} em ${brMoment(censusImport.createdAt)}. Nada muda no cadastro até você aplicar.`} />
      <div className="grid min-w-0 max-w-4xl gap-6">
        <p className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${schoolNote.tone === "ok" ? "bg-green-soft text-green" : "bg-amber-soft text-amber"}`}>{schoolNote.text}</p>
        <DataBoard className="sm:grid-cols-4">
          <StatTile label="Alunos e pessoas no arquivo" value={stats?.persons ?? 0} hint={`${stats?.special ?? 0} do público do AEE`} />
          <StatTile label="Cadastrar" value={plan.totals.create} />
          <StatTile label="Atualizar" value={plan.totals.update} hint={`${plan.totals.unchanged} sem mudança`} />
          <StatTile label="Para revisar" value={plan.totals.review} hint={plan.totals.ignored ? `${plan.totals.ignored} ignorados` : undefined} />
        </DataBoard>

        {review.length ? (
          <section aria-labelledby="previa-revisar" className="grid min-w-0 gap-3">
            <h2 id="previa-revisar" className="text-base font-medium text-ink">Para revisar ({review.length})</h2>
            {review.map((item) => (
              <Card key={item.key}>
                <h3 className="text-sm font-medium text-ink">{item.censusName}</h3>
                <p className="mt-1 text-xs text-ink-soft">{item.create?.birthDate ? `Nascimento ${brDay(item.create.birthDate)}` : "Sem data de nascimento válida no arquivo"}{item.create?.inepId ? ` · ID INEP ${item.create.inepId}` : ""}</p>
                <Warnings item={item} />
                <div className="mt-4"><CensusDecisionForm action={decideCensusPerson.bind(null, importId, item.key)} personKey={item.key} candidates={item.candidates ?? []} canCreate={Boolean(item.create?.birthDate)} /></div>
              </Card>
            ))}
          </section>
        ) : null}

        {by("create").length ? (
          <section aria-labelledby="previa-cadastrar" className="grid min-w-0 gap-3">
            <h2 id="previa-cadastrar" className="text-base font-medium text-ink">Cadastrar ({by("create").length})</h2>
            <p className="text-sm text-ink-soft">Entram na escola com a etapa estimada pela idade. Ano, turno e responsável ficam como &ldquo;A informar&rdquo; para a escola completar.</p>
            <ul className="grid min-w-0 gap-3">
              {by("create").map((item) => (
                <li key={item.key} className="min-w-0 rounded-2xl border border-line bg-paper-raised p-4">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-ink">{item.create?.name}</span>{item.person.hasAee ? <Badge tone="brand">AEE</Badge> : null}{item.decision ? <Badge>{DECISION_LABEL[item.decision]}</Badge> : null}</div>
                  <p className="mt-1 text-xs text-ink-soft">Nascimento {brDay(item.create?.birthDate ?? "")} · {STAGES[item.create?.stage ?? ""] ?? "Etapa a informar"} · turma {item.create?.className}{STAGE_GROUPS[item.person.stageGroup] ? ` (${STAGE_GROUPS[item.person.stageGroup]})` : ""}</p>
                  <Warnings item={item} />
                  {item.decision ? <div className="mt-2"><Undo importId={importId} personKey={item.key} /></div> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {by("update").length ? (
          <section aria-labelledby="previa-atualizar" className="grid min-w-0 gap-3">
            <h2 id="previa-atualizar" className="text-base font-medium text-ink">Atualizar ({by("update").length})</h2>
            <ul className="grid min-w-0 gap-3">
              {by("update").map((item) => (
                <li key={item.key} className="min-w-0 rounded-2xl border border-line bg-paper-raised p-4">
                  <div className="flex flex-wrap items-center gap-2"><Link href={`/estudantes/${item.studentId}`} className="text-sm font-medium text-brand-strong underline underline-offset-4">{item.studentName}</Link>{item.decision ? <Badge>{DECISION_LABEL[item.decision]}</Badge> : null}</div>
                  <ul className="mt-2 grid gap-1 text-sm text-ink">
                    {item.diffs.map((diff) => <li key={diff.field}><span className="font-medium">{diff.label}:</span> de {shown(diff, diff.from)} para {shown(diff, diff.to)}</li>)}
                  </ul>
                  <Warnings item={item} />
                  {item.decision ? <div className="mt-2"><Undo importId={importId} personKey={item.key} /></div> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {by("unchanged").length || plan.ignored.length || plan.missing.length ? (
          <section aria-labelledby="previa-demais" className="grid min-w-0 gap-3">
            <h2 id="previa-demais" className="text-base font-medium text-ink">Sem mudança, ignorados e fora do arquivo</h2>
            {by("unchanged").length ? (
              <details className="rounded-2xl border border-line bg-paper-raised p-4">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-ink">Sem mudança no cadastro ({by("unchanged").length})</summary>
                <ul className="mt-2 grid gap-2 text-sm text-ink">{by("unchanged").map((item) => <li key={item.key}>{item.studentName}<Warnings item={item} /></li>)}</ul>
              </details>
            ) : null}
            {plan.ignored.length ? (
              <Card>
                <SectionTitle>Ignorados ({plan.ignored.length})</SectionTitle>
                <ul className="grid gap-2 text-sm text-ink">{plan.ignored.map((item) => <li key={item.key} className="flex flex-wrap items-center gap-2">{item.censusName}: <span className="text-ink-soft">{item.reason}</span><Undo importId={importId} personKey={item.key} /></li>)}</ul>
              </Card>
            ) : null}
            {plan.missing.length ? (
              <Card>
                <SectionTitle>Com AEE na plataforma e fora do arquivo ({plan.missing.length})</SectionTitle>
                <p className="mb-2 text-sm text-ink-soft">Confira se o estudante tem matrícula no Censo desta escola e se nome, nascimento, CPF ou ID INEP batem.</p>
                <ul className="grid gap-1 text-sm">{plan.missing.map((student) => <li key={student.id}><Link href={`/estudantes/${student.id}`} className="text-brand-strong underline underline-offset-4">{student.name}</Link></li>)}</ul>
              </Card>
            ) : null}
          </section>
        ) : null}

        {stats?.skipped.length ? (
          <details className="rounded-2xl border border-line bg-paper-raised p-4">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-ink">Linhas que não deu para ler ({stats.skipped.length})</summary>
            <ul className="mt-2 grid gap-1 text-sm text-ink-soft">{stats.skipped.map((item) => <li key={`${item.line}-${item.reason}`}>Linha {item.line}: {item.reason}</li>)}</ul>
          </details>
        ) : null}

        <Card>
          <SectionTitle>Aplicar a prévia</SectionTitle>
          <p className="mb-3 text-sm leading-relaxed text-ink-soft">Cadastra e atualiza os estudantes, liga o código INEP à escola e guarda o arquivo como referência para as verificações. Ficam guardados só os alunos do público do AEE; o arquivo não fica.</p>
          <CensusApplyForm action={applyCensusImport.bind(null, importId)} blocked={plan.totals.review ? `Resolva ${plan.totals.review === 1 ? "a revisão" : `as ${plan.totals.review} revisões`} acima para aplicar.` : null} />
          <form action={discardCensusImport.bind(null, importId)} className="mt-3"><button type="submit" className={quietButtonCls}>Descartar a prévia</button></form>
          {decided.length ? <p className="mt-3 text-xs text-ink-soft">{decided.length === 1 ? "1 decisão de revisão registrada" : `${decided.length} decisões de revisão registradas`}.</p> : null}
        </Card>
      </div>
    </>
  );
}
