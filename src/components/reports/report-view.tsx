import { CircleCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { brDate, lessSupport, type ReportData, type ReportObjective } from "@/lib/period-report";
import { supportInfo } from "@/lib/scale";

// O relatório do período como a família e a equipe leem (tela e impressão).
// O parecer entra por `opinion` (validado) ou fica a cargo do editor (rascunho).

const decimal = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const STATUS_LABEL: Record<string, string> = { ativo: "Em andamento", alcancado: "Alcançado", em_revisao: "Em revisão" };

function Objective({ objective }: { objective: ReportObjective }) {
  const start = supportInfo(objective.supportStart);
  const end = objective.supportEnd === null ? null : supportInfo(objective.supportEnd);
  return (
    <li className="min-w-0 rounded-2xl border border-line bg-paper p-4 print:break-inside-avoid">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{objective.dimension}</Badge>
        <Badge tone={objective.status === "alcancado" ? "green" : "neutral"}>{STATUS_LABEL[objective.status] ?? objective.status}</Badge>
        {lessSupport(objective) ? <Badge tone="green">Menos apoio no período</Badge> : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink">{objective.description}</p>
      {objective.bncc ? <p className="mt-1 text-xs leading-relaxed text-ink-soft"><span className="font-medium text-ink">BNCC <span className="font-mono">{objective.bncc.code}</span> · {objective.bncc.component}:</span> {objective.bncc.description}</p> : null}
      <p className="mt-2 text-sm text-ink-soft">
        {end ? <>Apoio de que precisava: <span className="text-ink">{start.label}</span> no começo do período, <span className="text-ink">{end.label}</span> no fim. </> : <>Apoio no começo do período: <span className="text-ink">{start.label}</span>. </>}
        {objective.records ? `${objective.records} ${objective.records === 1 ? "registro de aula" : "registros de aula"} no período.` : "Sem registro de aula no período."}
      </p>
    </li>
  );
}

export function ReportView({ data, opinion, status, validatedByName, validatedAt, showOpinion = true }: {
  data: ReportData;
  opinion: string;
  status: string;
  validatedByName: string | null;
  validatedAt: Date | null;
  showOpinion?: boolean;
}) {
  const name = data.student.name.split(" ")[0];
  const sessions = data.aee.done + data.aee.absences;
  return (
    <article aria-labelledby="relatorio-titulo" className="grid min-w-0 gap-6">
      <header className="min-w-0">
        <p className="text-sm text-ink-soft">{data.student.school} · {data.student.gradeYear} · {data.student.className}</p>
        <h2 id="relatorio-titulo" className="mt-1 break-words font-display text-2xl font-normal tracking-tight text-ink sm:text-3xl">Relatório do período: {data.student.name}</h2>
        <p className="mt-1 text-sm text-ink-soft">De {brDate(data.period.start)} a {brDate(data.period.end)}</p>
        <p className="mt-3">
          {status === "validado"
            ? <Badge tone="green"><CircleCheck size={12} aria-hidden /> Validado{validatedByName ? ` por ${validatedByName}` : ""}{validatedAt ? ` em ${formatDate(validatedAt)}` : ""}</Badge>
            : <Badge tone="amber"><TriangleAlert size={12} aria-hidden /> Rascunho: a família ainda não vê</Badge>}
        </p>
      </header>

      {data.caseStudy.synthesis || data.caseStudy.needs.length ? (
        <section aria-labelledby="relatorio-quem" className="min-w-0">
          <h3 id="relatorio-quem" className="mb-2 text-base font-medium text-ink">Quem é {name}, pelo estudo de caso</h3>
          {data.caseStudy.synthesis ? <p className="text-sm leading-relaxed text-ink">{data.caseStudy.synthesis}</p> : null}
          {data.caseStudy.needs.length ? <p className="mt-2 text-sm text-ink-soft"><span className="font-medium text-ink">Apoios necessários:</span> {data.caseStudy.needs.join(", ")}.</p> : null}
        </section>
      ) : null}

      <section aria-labelledby="relatorio-objetivos" className="min-w-0">
        <h3 id="relatorio-objetivos" className="mb-2 text-base font-medium text-ink">Objetivos do plano de ensino</h3>
        {data.objectives.length ? <ul className="grid min-w-0 gap-3">{data.objectives.map((objective, index) => <Objective key={index} objective={objective} />)}</ul> : <p className="text-sm text-ink-soft">O plano não tinha objetivos neste período.</p>}
      </section>

      {data.assessment?.length ? (
        <section aria-labelledby="relatorio-sondagem" className="min-w-0">
          <h3 id="relatorio-sondagem" className="mb-2 text-base font-medium text-ink">Sondagem: apoio médio por área</h3>
          <p className="mb-2 text-xs text-ink-soft">Escala de 0 (independente) a 5 (apoio físico total): menor é melhor.</p>
          <ul className="grid gap-1 text-sm text-ink">
            {data.assessment.map((row) => (
              <li key={row.label}><span className="font-medium">{row.label}:</span> {row.start !== null && row.end !== null && row.start !== row.end ? `${decimal(row.start)} no começo, ${decimal(row.end)} no fim` : decimal((row.end ?? row.start) as number)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="relatorio-aee" className="min-w-0">
        <h3 id="relatorio-aee" className="mb-2 text-base font-medium text-ink">Atendimento educacional especializado</h3>
        <p className="text-sm leading-relaxed text-ink">
          {sessions
            ? `${data.aee.done} ${data.aee.done === 1 ? "atendimento realizado" : "atendimentos realizados"}, ${data.aee.absences} ${data.aee.absences === 1 ? "falta" : "faltas"} e ${data.aee.cancelled} ${data.aee.cancelled === 1 ? "cancelamento" : "cancelamentos"} no período.`
            : "Nenhum atendimento do AEE registrado no período."}
        </p>
      </section>

      {data.strategies.length || data.activities.length || data.materials.length ? (
        <section aria-labelledby="relatorio-funcionou" className="grid min-w-0 gap-2">
          <h3 id="relatorio-funcionou" className="text-base font-medium text-ink">O que funcionou e o que foi usado</h3>
          {data.strategies.length ? <p className="text-sm text-ink"><span className="font-medium">O que mais ajudou:</span> {data.strategies.join(", ")}.</p> : null}
          {data.activities.length ? <p className="text-sm text-ink-soft"><span className="font-medium text-ink">Atividades registradas em aula:</span> {data.activities.join("; ")}.</p> : null}
          {data.materials.length ? <p className="text-sm text-ink-soft"><span className="font-medium text-ink">Materiais de apoio aprovados:</span> {data.materials.join("; ")}.</p> : null}
        </section>
      ) : null}

      {data.familyNotes || data.therapistReports ? (
        <section aria-labelledby="relatorio-familia" className="min-w-0">
          <h3 id="relatorio-familia" className="mb-2 text-base font-medium text-ink">Família e rede de apoio</h3>
          <p className="text-sm text-ink">
            {data.familyNotes ? `A família registrou ${data.familyNotes} ${data.familyNotes === 1 ? "observação" : "observações"} de casa. ` : ""}
            {data.therapistReports ? `O terapeuta enviou ${data.therapistReports} ${data.therapistReports === 1 ? "orientação" : "orientações"} à escola.` : ""}
          </p>
        </section>
      ) : null}

      {showOpinion ? (
        <section aria-labelledby="relatorio-parecer" className="min-w-0 rounded-2xl bg-surface-muted/60 p-4 print:break-inside-avoid sm:p-5">
          <h3 id="relatorio-parecer" className="mb-2 text-base font-medium text-ink">Parecer da equipe</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{opinion || "O parecer ainda não foi escrito."}</p>
        </section>
      ) : null}
    </article>
  );
}
