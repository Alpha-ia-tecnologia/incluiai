export type SearchParams = Record<string, string | string[] | undefined>;

export const param = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value) ?? "";

const flag = (query: SearchParams, key: string) => param(query[key]) === "1";
const withQuery = (path: string, values: Record<string, string>, hash = "") => {
  const query = new URLSearchParams(values).toString();
  return `${path}${query ? `?${query}` : ""}${hash}`;
};

export type MaterialCreated = { source: "ia" | "regras"; images: number | null; failed: boolean };
export const materialCreatedHref = (path: string, { source, images, failed }: MaterialCreated) =>
  withQuery(path, { criado: source, ...(images === null ? {} : { imagens: String(images), ...(failed ? { falhas: "1" } : {}) }) });
export function readMaterialCreated(query: SearchParams): MaterialCreated | null {
  const source = param(query.criado);
  if (source !== "ia" && source !== "regras") return null;
  const images = Number.parseInt(param(query.imagens), 10);
  return { source, images: Number.isFinite(images) && images >= 0 ? images : null, failed: flag(query, "falhas") };
}

export const activitiesBatchHref = (students: number) => withQuery("/estudantes", { lote: String(students) });
export const readActivitiesBatch = (query: SearchParams): number | null => (/^\d+$/.test(param(query.lote)) ? Number(param(query.lote)) : null);

export const levelsHref = (planningId: string, batchId?: string | null) => withQuery(`/planejamento/${planningId}/niveis`, batchId ? { lote: batchId } : {});
export const readLevelsBatch = (query: SearchParams) => param(query.lote);

export const censusAppliedHref = (schoolId: string, created: number, updated: number) => withQuery(`/censo/escolas/${schoolId}`, { aplicado: `${created}-${updated}` });
export function readCensusApplied(query: SearchParams): { created: number; updated: number } | null {
  const match = param(query.aplicado).match(/^(\d+)-(\d+)$/);
  return match ? { created: Number(match[1]), updated: Number(match[2]) } : null;
}

export const profileSavedHref = (studentId: string) => withQuery(`/estudantes/${studentId}/perfil`, { salvo: String(Date.now()) });
export const readProfileSaved = (query: SearchParams) => (/^\d+$/.test(param(query.salvo)) ? param(query.salvo) : null);

export type CaseStudyNotice = "salvo" | "concluido" | "faltaAee";
export const caseStudyHref = (studentId: string, { notice, editing = false, hash = "" }: { notice?: CaseStudyNotice; editing?: boolean; hash?: string } = {}) =>
  withQuery(`/estudantes/${studentId}/estudo-de-caso`, { ...(editing ? { editar: "1" } : {}), ...(notice ? { [notice]: "1" } : {}) }, hash);
export const readCaseStudy = (query: SearchParams) => ({ editing: flag(query, "editar"), saved: flag(query, "salvo"), concluded: flag(query, "concluido"), missingAee: flag(query, "faltaAee") });

export type HealthReportNotice = "revisado" | "excluido";
export const healthReportsHref = (studentId: string, reportId?: string, notice?: HealthReportNotice) =>
  withQuery(`/estudantes/${studentId}/estudo-de-caso/laudos${reportId ? `/${reportId}` : ""}`, notice ? { [notice]: "1" } : {});
export const readHealthReportNotice = (query: SearchParams, notice: HealthReportNotice) => flag(query, notice);

export const RECOVERY_CODE_USED_HREF = withQuery("/conta/seguranca", { aviso: "recuperacao" });
export const readRecoveryCodeUsed = (query: SearchParams) => param(query.aviso) === "recuperacao";
