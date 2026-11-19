import { brDay, daysBetween } from "./dates.ts";
import { plural } from "./format.ts";
import type { Trend } from "./scale.ts";
import { RECORD_GAP_DAYS, type AlertKind } from "./student-alerts.ts";
import type { TrendReason } from "./support-trend.ts";

/** As vistas do Painel, na ordem das abas. A Visão geral é o endereço sem `?vista=`. */
export const PANEL_VIEWS = [
  { key: "geral", label: "Visão geral" },
  { key: "objetivos", label: "Objetivos" },
  { key: "aulas", label: "Aulas" },
  { key: "atividades", label: "Atividades" },
  { key: "perfil", label: "Perfil" },
  { key: "familia", label: "Família" },
  { key: "equipe", label: "Equipe" },
] as const;
export type PanelView = (typeof PANEL_VIEWS)[number]["key"];

/** Equipe (pessoas com acesso e acessos registrados) é só da gestão da rede. */
export const panelViews = ({ network }: { network: boolean }) => PANEL_VIEWS.filter((view) => network || view.key !== "equipe");

export function parseView(value: unknown, { network }: { network: boolean }): PanelView {
  return panelViews({ network }).find((view) => view.key === value)?.key ?? "geral";
}

/** As seções do Painel de uma página só, para os endereços guardados (`/painel#aulas`) abrirem a vista certa. */
export const LEGACY_ANCHORS: Readonly<Record<string, Exclude<PanelView, "geral">>> = {
  objetivos: "objetivos",
  aulas: "aulas",
  atividades: "atividades",
  dua: "atividades",
  ia: "atividades",
  recursos: "atividades",
  perfil: "perfil",
  familia: "familia",
  equipe: "equipe",
};

/** Registro recente: o contrário do aviso "sem registro" (menos de 14 dias, contados em dias de Brasília). */
export const recentRecord = (lastRecord: Date | null, now: Date) => lastRecord !== null && daysBetween(brDay(lastRecord), brDay(now)) < RECORD_GAP_DAYS;

/** Uma escola precisa de ajuda quando 1 em cada 5 estudantes, ou mais, tem aviso (cada aviso já é um limite cruzado). */
export const SCHOOL_HELP_SHARE = 0.2;

export type SchoolAlerts = { id: string; name: string; students: number; withAlerts: number; byKind: ReadonlyArray<{ kind: AlertKind; value: number }> };

export const needsHelp = (school: Pick<SchoolAlerts, "students" | "withAlerts">) => school.students > 0 && school.withAlerts > 0 && school.withAlerts / school.students >= SCHOOL_HELP_SHARE;

/** As escolas acima do limite, da maior parte com aviso para a menor; as outras, em ordem de nome. */
export function schoolsNeedingHelp<T extends SchoolAlerts>(schools: ReadonlyArray<T>): { flagged: T[]; others: T[] } {
  const share = (school: T) => school.withAlerts / school.students;
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, "pt-BR");
  return {
    flagged: schools.filter(needsHelp).sort((a, b) => share(b) - share(a) || b.withAlerts - a.withAlerts || byName(a, b)),
    others: schools.filter((school) => !needsHelp(school)).sort(byName),
  };
}

/** Os grupos de "O que funciona", na ordem de leitura; o selo de cada grupo é o mesmo `TrendChip` da ficha. */
export const TREND_GROUPS = [
  { key: "meta", reading: { trend: "avancando", reason: "meta" }, phrase: ["com a meta alcançada", "com a meta alcançada"] },
  { key: "avancando", reading: { trend: "avancando", reason: "menos_apoio" }, phrase: ["avançando", "avançando"] },
  { key: "estavel", reading: { trend: "estavel", reason: "estavel" }, phrase: ["estável", "estáveis"] },
  { key: "atencao", reading: { trend: "atencao", reason: "recusas" }, phrase: ["pede atenção", "pedem atenção"] },
  { key: "sem_dados", reading: { trend: "sem_dados", reason: "poucos" }, phrase: ["com poucos registros", "com poucos registros"] },
] as const satisfies ReadonlyArray<{ key: string; reading: { trend: Trend; reason: TrendReason }; phrase: readonly [string, string] }>;
export type TrendGroupKey = (typeof TREND_GROUPS)[number]["key"];

/** "Meta alcançada" é avançar com a última aula já na meta: ganha grupo próprio. */
export const trendGroupOf = (reading: { trend: Trend; reason: TrendReason }): TrendGroupKey => (reading.reason === "meta" ? "meta" : reading.trend);

export function groupByTrend<T>(items: ReadonlyArray<T>, readingOf: (item: T) => { trend: Trend; reason: TrendReason }) {
  return TREND_GROUPS
    .map((group) => ({ ...group, items: items.filter((item) => trendGroupOf(readingOf(item)) === group.key) }))
    .filter((group) => group.items.length > 0);
}

/** Avançando conta também quem já chegou à meta. */
export const advancingCount = (groups: ReadonlyArray<{ key: TrendGroupKey; items: ReadonlyArray<unknown> }>) =>
  groups.filter((group) => group.key === "meta" || group.key === "avancando").reduce((sum, group) => sum + group.items.length, 0);

/** A frase que o leitor de tela ouve no lugar dos degraus agregados. */
export function trendGroupsSentence(groups: ReadonlyArray<{ key: TrendGroupKey; items: ReadonlyArray<unknown> }>): string {
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  if (!total) return "Nenhum objetivo em acompanhamento.";
  const parts = groups.map((group) => {
    const [one, many] = TREND_GROUPS.find((item) => item.key === group.key)!.phrase;
    return `${group.items.length} ${group.items.length === 1 ? one : many}`;
  });
  return `${plural(total, "objetivo em acompanhamento", "objetivos em acompanhamento")}: ${parts.join(", ")}.`;
}
