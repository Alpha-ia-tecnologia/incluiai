// PAEE e PEI no plano de ensino: o documento único que a Portaria MEC nº 421/2026
// permite (art. 7º, § 2º), com o conteúdo mínimo de cada um (arts. 10 e 11) e
// quem elabora, como orienta o INEP (src/lib/federal-guidance.ts).
import { AEE_SERVICE_LABELS, ASSESSMENT_RESOURCE_LABELS } from "./educacenso.ts";

export type PlanDocuments = {
  aeeTeacher: string | null;
  regularTeacher: string | null;
  participants: string | null;
  // PAEE (art. 10)
  accessibilityResources: string | null;
  assistiveTech: string | null;
  supportStaff: string | null;
  networkDemands: string | null;
  // PEI (art. 11)
  aeeServices: string | null; // tipos de atendimento do AEE no Educacenso (registro 60)
  aeeStrategies: string | null;
  commonRoomStrategies: string | null;
  assessmentAccessibility: string | null;
  monitoring: string | null;
  familyFeedback: string | null;
};
export type PlanDocumentKey = keyof PlanDocuments;
export const PLAN_DOCUMENT_KEYS: readonly PlanDocumentKey[] = [
  "aeeTeacher", "regularTeacher", "participants",
  "accessibilityResources", "assistiveTech", "supportStaff", "networkDemands",
  "aeeServices", "aeeStrategies", "commonRoomStrategies", "assessmentAccessibility", "monitoring", "familyFeedback",
];

export type PlanItem = { key: PlanDocumentKey; label: string; norm: string };

export const PAEE_ITEMS: readonly PlanItem[] = [
  { key: "accessibilityResources", label: "Materiais e recursos", norm: "art. 10, I" },
  { key: "assistiveTech", label: "Tecnologia assistiva e CAA", norm: "art. 10, II" },
  { key: "supportStaff", label: "Profissional de apoio e intérpretes", norm: "art. 10, III" },
  { key: "networkDemands", label: "Formação e rede de proteção", norm: "art. 10, IV" },
];
export const PEI_ITEMS: readonly PlanItem[] = [
  { key: "aeeServices", label: "Atendimentos do AEE", norm: "art. 11, I" },
  { key: "aeeStrategies", label: "Atividades no AEE", norm: "art. 11, I" },
  { key: "commonRoomStrategies", label: "Na classe comum", norm: "art. 11, I e II" },
  { key: "assessmentAccessibility", label: "Na avaliação", norm: "art. 11, II" },
  { key: "monitoring", label: "Acompanhamento", norm: "art. 11, III" },
  { key: "familyFeedback", label: "Devolutiva à família", norm: "art. 11, IV" },
];

// "Avaliado e não precisa" também é registro: a Portaria pede a avaliação da necessidade.
export const NO_NEED = "Avaliado: não há necessidade";

export const PLAN_PARTICIPANT_OPTIONS = ["Família", "O próprio estudante", "Coordenação pedagógica", "Gestão escolar", "Profissional de apoio"];
export const ASSISTIVE_TECH_OPTIONS = [NO_NEED, "Prancha de comunicação", "Tablet com aplicativo de CAA", "Acionador", "Engrossador de lápis", "Lupa ou ampliação de tela", "Leitor de tela", "Material em braille", "Mobiliário adaptado"];
export const SUPPORT_STAFF_OPTIONS = [NO_NEED, "Profissional de apoio escolar", "Tradutor e intérprete de Libras", "Guia-intérprete"];
export const NO_DEMAND = "Nenhuma demanda";
export const NETWORK_DEMAND_OPTIONS = [NO_DEMAND, "Formação da equipe em Educação Especial Inclusiva", "Formação em comunicação alternativa", "Formação em Libras", "Rede de saúde", "Assistência social (CRAS ou CREAS)", "Conselho Tutelar"];
// Os tipos de AEE do Educacenso: o Censo recusa vínculo de AEE sem nenhum.
export const AEE_SERVICE_OPTIONS = AEE_SERVICE_LABELS;
export const NO_RESOURCE = "Nenhum recurso";
export const ASSESSMENT_ACCESSIBILITY_OPTIONS = [...ASSESSMENT_RESOURCE_LABELS, "Formas variadas de resposta", "Resposta com comunicação alternativa", "Ambiente mais silencioso", NO_RESOURCE];
export const MONITORING_OPTIONS = ["Registro de aula no diário", "Sondagem a cada revisão", "Reunião entre AEE e classe comum", "Revisão do plano com a equipe", "Portfólio de atividades"];
export const FAMILY_FEEDBACK_OPTIONS = ["Relatório do período a cada semestre", "Reunião com a família a cada bimestre", "Avisos no portal da família", "Agenda ou caderno de recados"];

const MAX_LENGTH = 600;
const filled = (value: string | null | undefined) => Boolean(value?.trim());
const list = (value: string | null | undefined) => (value ?? "").split(/[;\n]/).map((item) => item.trim()).filter(Boolean);

export function planDocumentsFromForm(get: (name: string) => unknown): PlanDocuments {
  const entries = PLAN_DOCUMENT_KEYS.map((key) => [key, String(get(key) ?? "").trim().slice(0, MAX_LENGTH) || null] as const);
  return Object.fromEntries(entries) as PlanDocuments;
}

export function missingPlanItems(plan: Partial<PlanDocuments>): { paee: PlanItem[]; pei: PlanItem[]; authorship: string[] } {
  const authorship = [
    !filled(plan.aeeTeacher) && "professor(a) do AEE",
    !filled(plan.regularTeacher) && "professor(a) da classe comum",
    !list(plan.participants).includes("Família") && "participação da família",
  ].filter((item): item is string => Boolean(item));
  return {
    paee: PAEE_ITEMS.filter((item) => !filled(plan[item.key])),
    pei: PEI_ITEMS.filter((item) => !filled(plan[item.key])),
    authorship,
  };
}

export function missingCount(plan: Partial<PlanDocuments>): number {
  const missing = missingPlanItems(plan);
  return missing.paee.length + missing.pei.length + missing.authorship.length;
}

const RESOURCE_TO_STAFF: Record<string, string> = { "Profissional de apoio": "Profissional de apoio escolar", "Intérprete de Libras": "Tradutor e intérprete de Libras", "Guia-intérprete": "Guia-intérprete" };
const RESOURCE_TO_TECH: Record<string, string> = { "Prancha de comunicação": "Prancha de comunicação", "Mobiliário adaptado": "Mobiliário adaptado" };
const REFERRAL_TO_NETWORK: Record<string, string> = {
  "Rede de saúde": "Rede de saúde", "Avaliação oftalmológica": "Rede de saúde", "Avaliação auditiva": "Rede de saúde",
  "Assistência social (CRAS ou CREAS)": "Assistência social (CRAS ou CREAS)", "Conselho Tutelar": "Conselho Tutelar",
};
const RESOURCE_TO_ASSESSMENT: Record<string, string> = { "Intérprete de Libras": "Tradutor-intérprete de Libras", "Guia-intérprete": "Guia-intérprete" };
const NEED_TO_SERVICE: Record<string, string> = {
  ...Object.fromEntries(AEE_SERVICE_LABELS.map((label) => [label, label])),
  "Comunicação alternativa e aumentativa": "Comunicação alternativa e aumentativa (CAA)",
  "Ensino do braille": "Ensino do Sistema Braille",
  "Desenvolvimento da autonomia": "Desenvolvimento de vida autônoma",
};
const mapped = (values: string[], table: Record<string, string>) => [...new Set(values.map((value) => table[value]).filter(Boolean))].join("; ") || null;

export function planDefaultsFromCaseStudy(content: Record<string, string>, aeeTeacher: string | null = null): Partial<PlanDocuments> {
  const resources = list(content.recursos);
  const services = new Set(list(content.necessidades).map((need) => NEED_TO_SERVICE[need]).filter(Boolean));
  return {
    aeeTeacher,
    participants: list(content.participantes).filter((item) => PLAN_PARTICIPANT_OPTIONS.includes(item)).join("; ") || null,
    assistiveTech: mapped(resources, RESOURCE_TO_TECH),
    supportStaff: mapped(resources, RESOURCE_TO_STAFF),
    networkDemands: mapped(list(content.encaminhamentos), REFERRAL_TO_NETWORK),
    aeeServices: AEE_SERVICE_LABELS.filter((label) => services.has(label)).join("; ") || null,
    assessmentAccessibility: mapped(resources, RESOURCE_TO_ASSESSMENT),
  };
}

export const PROPOSAL_LIST_KEYS = [
  "accessibilityResources", "assistiveTech", "supportStaff", "networkDemands",
  "aeeServices", "aeeStrategies", "commonRoomStrategies", "assessmentAccessibility", "monitoring", "familyFeedback",
] as const satisfies readonly PlanDocumentKey[];
export type ProposalListKey = (typeof PROPOSAL_LIST_KEYS)[number];

const EXCLUSIVE = [NO_NEED, NO_DEMAND, NO_RESOURCE];
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const dropExclusive = (items: string[]) => (items.length > 1 ? items.filter((item) => !EXCLUSIVE.includes(item)) : items);

export function canonicalItems(items: readonly string[], options: readonly string[], config: { strict?: boolean; limit?: number } = {}): string[] {
  const byFold = new Map(options.map((option) => [fold(option), option]));
  const out: string[] = [];
  for (const raw of items) {
    const text = String(raw ?? "").replace(/;/g, ",").replace(/\s+/g, " ").trim().replace(/[.,]+$/, "");
    const item = byFold.get(fold(text)) ?? (config.strict ? "" : text);
    if (item && !out.includes(item)) out.push(item);
  }
  return dropExclusive(out).slice(0, config.limit ?? 8);
}

export function mergeProposalDefaults(base: Partial<PlanDocuments>, proposal: Partial<Record<ProposalListKey, readonly string[]>>): Partial<PlanDocuments> {
  const merged: Partial<PlanDocuments> = { ...base };
  for (const key of PROPOSAL_LIST_KEYS) {
    const items = dropExclusive([...new Set([...list(base[key]), ...(proposal[key] ?? []).map((item) => item.trim()).filter(Boolean)])]);
    merged[key] = items.join("; ") || null;
  }
  return merged;
}

// Tipos de AEE (registro 60) e recursos nas avaliações (registro 30) do Censo.
export type CensusDeclared = { aee: boolean; services: string[]; resources?: string[] };
export type CensusDifference = { key: "aeeServices" | "assessmentAccessibility"; label: string; plan: string[]; census: string[] };

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((item) => b.includes(item));

export function censusDifferences(plan: Partial<PlanDocuments>, census: CensusDeclared | null): CensusDifference[] {
  if (!census) return [];
  const differences: CensusDifference[] = [];
  if (census.aee && filled(plan.aeeServices)) {
    const planned = list(plan.aeeServices).filter((item) => AEE_SERVICE_LABELS.includes(item));
    if (!sameSet(planned, census.services)) differences.push({ key: "aeeServices", label: "Atendimentos do AEE", plan: planned, census: census.services });
  }
  if (census.resources && filled(plan.assessmentAccessibility)) {
    const planned = list(plan.assessmentAccessibility).filter((item) => ASSESSMENT_RESOURCE_LABELS.includes(item));
    if (!sameSet(planned, census.resources)) differences.push({ key: "assessmentAccessibility", label: "Recursos nas avaliações do INEP", plan: planned, census: census.resources });
  }
  return differences;
}
