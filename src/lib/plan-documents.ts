// PAEE e PEI no plano de ensino: o documento único que a Portaria MEC nº 421/2026
// permite (art. 7º, § 2º), com o conteúdo mínimo de cada um (arts. 10 e 11) e
// quem elabora, como orienta o INEP (src/lib/federal-guidance.ts).
import { AEE_SERVICE_LABELS, ASSESSMENT_RESOURCE_LABELS } from "./educacenso.ts";
import { ACCESSIBILITY_RESOURCE_OPTIONS, AEE_STRATEGY_OPTIONS, COMMON_ROOM_STRATEGY_OPTIONS } from "./form-options.ts";
import { joinItems, splitItems } from "./format.ts";
import { FAMILY_PARTICIPANT, STUDENT_PARTICIPANT } from "./case-study.ts";

// "Avaliado e não precisa" também é registro: a Portaria pede a avaliação da necessidade.
const NO_NEED = "Avaliado: não há necessidade";

const PLAN_PARTICIPANT_OPTIONS = [FAMILY_PARTICIPANT, STUDENT_PARTICIPANT, "Coordenação pedagógica", "Gestão escolar", "Profissional de apoio"];
const ASSISTIVE_TECH_OPTIONS = [NO_NEED, "Prancha de comunicação", "Tablet com aplicativo de CAA", "Acionador", "Engrossador de lápis", "Lupa ou ampliação de tela", "Leitor de tela", "Material em braille", "Mobiliário adaptado"];
export const SUPPORT_STAFF_OPTIONS = [NO_NEED, "Profissional de apoio escolar", "Tradutor e intérprete de Libras", "Guia-intérprete"];
const NO_DEMAND = "Nenhuma demanda";
const NETWORK_DEMAND_OPTIONS = [NO_DEMAND, "Formação da equipe em Educação Especial Inclusiva", "Formação em comunicação alternativa", "Formação em Libras", "Rede de saúde", "Assistência social (CRAS ou CREAS)", "Conselho Tutelar"];
// Os tipos de AEE do Educacenso: o Censo recusa vínculo de AEE sem nenhum.
export const AEE_SERVICE_OPTIONS = AEE_SERVICE_LABELS;
const NO_RESOURCE = "Nenhum recurso";
const ASSESSMENT_ACCESSIBILITY_OPTIONS = [...ASSESSMENT_RESOURCE_LABELS, "Formas variadas de resposta", "Resposta com comunicação alternativa", "Ambiente mais silencioso", NO_RESOURCE];
const MONITORING_OPTIONS = ["Registro de aula no diário", "Sondagem a cada revisão", "Reunião entre AEE e classe comum", "Revisão do plano com a equipe", "Portfólio de atividades"];
const FAMILY_FEEDBACK_OPTIONS = ["Relatório do período a cada semestre", "Reunião com a família a cada bimestre", "Avisos no portal da família", "Agenda ou caderno de recados"];

type PlanFieldSpec = {
  key: string;
  part: "paee" | "pei" | "equipe";
  kind: "teacher" | "list";
  label: string;
  norm?: string;
  hint?: string;
  options?: readonly string[];
  // Declarado no Censo Escolar: tipos de AEE (registro 60) e recursos na avaliação (registro 30).
  census?: boolean;
  strict?: boolean;
  limit?: number;
  ai?: string;
};

// Os campos do PAEE (art. 10) e do PEI (art. 11), com quem elabora cada um.
export const PLAN_FIELDS = [
  { key: "aeeTeacher", part: "paee", kind: "teacher", label: "Professor(a) do AEE" },
  { key: "regularTeacher", part: "pei", kind: "teacher", label: "Professor(a) da classe comum" },
  { key: "participants", part: "equipe", kind: "list", label: "Também participaram", options: PLAN_PARTICIPANT_OPTIONS },
  { key: "accessibilityResources", part: "paee", kind: "list", label: "Materiais e recursos", norm: "art. 10, I", options: ACCESSIBILITY_RESOURCE_OPTIONS, ai: "Art. 10, I: materiais e recursos de acessibilidade para o estudante participar." },
  { key: "assistiveTech", part: "paee", kind: "list", label: "Tecnologia assistiva e CAA", norm: "art. 10, II", options: ASSISTIVE_TECH_OPTIONS, ai: "Art. 10, II: tecnologia assistiva e comunicação alternativa. Lista vazia se o caso não permite avaliar." },
  { key: "supportStaff", part: "paee", kind: "list", label: "Profissional de apoio e intérpretes", norm: "art. 10, III", options: SUPPORT_STAFF_OPTIONS, strict: true, ai: "Art. 10, III: profissional de apoio escolar, intérprete de Libras, guia-intérprete. Lista vazia se o caso não permite avaliar." },
  { key: "networkDemands", part: "paee", kind: "list", label: "Formação e rede de proteção", norm: "art. 10, IV", options: NETWORK_DEMAND_OPTIONS, ai: "Art. 10, IV: formação da equipe e articulação com a rede de proteção social." },
  { key: "aeeServices", part: "pei", kind: "list", label: "Atendimentos do AEE", norm: "art. 11, I", hint: "Os tipos do Censo Escolar.", options: AEE_SERVICE_OPTIONS, census: true, strict: true, limit: AEE_SERVICE_OPTIONS.length, ai: "Art. 11, I: tipos de atendimento do AEE, com os nomes do Censo Escolar, exatamente como na lista recebida." },
  { key: "aeeStrategies", part: "pei", kind: "list", label: "Atividades no AEE", norm: "art. 11, I", options: AEE_STRATEGY_OPTIONS, ai: "Art. 11, I: atividades no AEE." },
  { key: "commonRoomStrategies", part: "pei", kind: "list", label: "Na classe comum", norm: "art. 11, I e II", options: COMMON_ROOM_STRATEGY_OPTIONS, ai: "Art. 11, I e II: o que muda na classe comum para o estudante aprender com a turma." },
  { key: "assessmentAccessibility", part: "pei", kind: "list", label: "Recursos na avaliação", norm: "art. 11, II", hint: "Os recursos do Censo (sala de aula e Saeb) vêm primeiro.", options: ASSESSMENT_ACCESSIBILITY_OPTIONS, census: true, ai: "Art. 11, II: recursos de acessibilidade na avaliação." },
  { key: "monitoring", part: "pei", kind: "list", label: "Acompanhamento", norm: "art. 11, III", options: MONITORING_OPTIONS, limit: 4, ai: "Art. 11, III: como a equipe acompanha o plano." },
  { key: "familyFeedback", part: "pei", kind: "list", label: "Devolutiva à família", norm: "art. 11, IV", options: FAMILY_FEEDBACK_OPTIONS, limit: 4, ai: "Art. 11, IV: como e quando a família recebe a devolutiva." },
] as const satisfies readonly PlanFieldSpec[];

export type PlanField = (typeof PLAN_FIELDS)[number];
export type PlanDocumentKey = PlanField["key"];
export type PlanDocuments = Record<PlanDocumentKey, string | null>;
export type PlanItem = Extract<PlanField, { norm: string }>;
export type ProposalListKey = Extract<PlanField, { ai: string }>["key"];
type PartItem<P extends "paee" | "pei"> = Extract<PlanItem, { part: P }>;

export const PLAN_DOCUMENT_KEYS: readonly PlanDocumentKey[] = PLAN_FIELDS.map((field) => field.key);
export const PLAN_FIELD_LABEL = Object.fromEntries(PLAN_FIELDS.map((field) => [field.key, field.label])) as Record<PlanDocumentKey, string>;
const isItem = (field: PlanField): field is PlanItem => "norm" in field;
export const PAEE_ITEMS = PLAN_FIELDS.filter((field): field is PartItem<"paee"> => isItem(field) && field.part === "paee");
export const PEI_ITEMS = PLAN_FIELDS.filter((field): field is PartItem<"pei"> => isItem(field) && field.part === "pei");
export const PROPOSAL_FIELDS = PLAN_FIELDS.filter((field): field is Extract<PlanField, { ai: string }> => "ai" in field);
const PROPOSAL_LIST_KEYS: readonly ProposalListKey[] = PROPOSAL_FIELDS.map((field) => field.key);
export const emptyProposalLists = () => Object.fromEntries(PROPOSAL_LIST_KEYS.map((key) => [key, [] as string[]])) as Record<ProposalListKey, string[]>;

const MAX_LENGTH = 600;
const filled = (value: string | null | undefined) => Boolean(value?.trim());

export function planDocumentsFromForm(get: (name: string) => unknown): PlanDocuments {
  const entries = PLAN_DOCUMENT_KEYS.map((key) => [key, String(get(key) ?? "").trim().slice(0, MAX_LENGTH) || null] as const);
  return Object.fromEntries(entries) as PlanDocuments;
}

type TeacherField = Extract<PlanField, { kind: "teacher" }>;
type AuthorshipGap = { key: TeacherField["key"] | "participants"; label: string };
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export function missingPlanItems(plan: Partial<PlanDocuments>): { paee: PlanItem[]; pei: PlanItem[]; authorship: AuthorshipGap[] } {
  const authorship: AuthorshipGap[] = [
    ...PLAN_FIELDS.filter((field): field is TeacherField => field.kind === "teacher" && !filled(plan[field.key])).map((field) => ({ key: field.key, label: lowerFirst(field.label) })),
    ...(splitItems(plan.participants).includes(FAMILY_PARTICIPANT) ? [] : [{ key: "participants" as const, label: "participação da família" }]),
  ];
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
const mapped = (values: string[], table: Record<string, string>) => joinItems([...new Set(values.map((value) => table[value]).filter(Boolean))]) || null;

export function planDefaultsFromCaseStudy(content: Record<string, string>, aeeTeacher: string | null = null): Partial<PlanDocuments> {
  const resources = splitItems(content.recursos);
  const services = new Set(splitItems(content.necessidades).map((need) => NEED_TO_SERVICE[need]).filter(Boolean));
  return {
    aeeTeacher,
    participants: joinItems(splitItems(content.participantes).filter((item) => PLAN_PARTICIPANT_OPTIONS.includes(item))) || null,
    assistiveTech: mapped(resources, RESOURCE_TO_TECH),
    supportStaff: mapped(resources, RESOURCE_TO_STAFF),
    networkDemands: mapped(splitItems(content.encaminhamentos), REFERRAL_TO_NETWORK),
    aeeServices: joinItems(AEE_SERVICE_LABELS.filter((label) => services.has(label))) || null,
    assessmentAccessibility: mapped(resources, RESOURCE_TO_ASSESSMENT),
  };
}

const EXCLUSIVE = [NO_NEED, NO_DEMAND, NO_RESOURCE];
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const dropExclusive = (items: string[]) => (items.length > 1 ? items.filter((item) => !EXCLUSIVE.includes(item)) : items);

export const outsideOptions = (items: readonly string[], options: readonly string[]) => items.filter((item) => item.trim() && !options.some((option) => fold(option) === fold(item)));

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
    const items = dropExclusive([...new Set([...splitItems(base[key]), ...(proposal[key] ?? []).map((item) => item.trim()).filter(Boolean)])]);
    merged[key] = joinItems(items) || null;
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
    const planned = splitItems(plan.aeeServices).filter((item) => AEE_SERVICE_LABELS.includes(item));
    if (!sameSet(planned, census.services)) differences.push({ key: "aeeServices", label: "Atendimentos do AEE", plan: planned, census: census.services });
  }
  if (census.resources && filled(plan.assessmentAccessibility)) {
    const planned = splitItems(plan.assessmentAccessibility).filter((item) => ASSESSMENT_RESOURCE_LABELS.includes(item));
    if (!sameSet(planned, census.resources)) differences.push({ key: "assessmentAccessibility", label: "Recursos nas avaliações do INEP", plan: planned, census: census.resources });
  }
  return differences;
}
