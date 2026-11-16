// PAEE e PEI no plano de ensino: o documento único que a Portaria MEC nº 421/2026
// permite (art. 7º, § 2º), com o conteúdo mínimo de cada um (arts. 10 e 11) e
// quem elabora, como orienta o INEP (src/lib/federal-guidance.ts). Puro, para
// teste com node --test (src/lib/plan-documents.test.mjs). Os atendimentos do
// AEE e os recursos nas avaliações usam os nomes do Educacenso, para a escola
// declarar no Censo o que o plano registra.
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
export const NETWORK_DEMAND_OPTIONS = ["Nenhuma demanda", "Formação da equipe em Educação Especial Inclusiva", "Formação em comunicação alternativa", "Formação em Libras", "Rede de saúde", "Assistência social (CRAS ou CREAS)", "Conselho Tutelar"];
// Os tipos de AEE do Educacenso: o Censo recusa vínculo de AEE sem nenhum.
export const AEE_SERVICE_OPTIONS = AEE_SERVICE_LABELS;
// Na avaliação: primeiro os recursos do Educacenso (sala de aula e Saeb), depois
// medidas da escola que o Censo não lista.
export const NO_RESOURCE = "Nenhum recurso";
export const ASSESSMENT_ACCESSIBILITY_OPTIONS = [...ASSESSMENT_RESOURCE_LABELS, "Formas variadas de resposta", "Resposta com comunicação alternativa", "Ambiente mais silencioso", NO_RESOURCE];
export const MONITORING_OPTIONS = ["Registro de aula no diário", "Sondagem a cada revisão", "Reunião entre AEE e classe comum", "Revisão do plano com a equipe", "Portfólio de atividades"];
export const FAMILY_FEEDBACK_OPTIONS = ["Relatório do período a cada semestre", "Reunião com a família a cada bimestre", "Avisos no portal da família", "Agenda ou caderno de recados"];

const MAX_LENGTH = 600;
const filled = (value: string | null | undefined) => Boolean(value?.trim());
const list = (value: string | null | undefined) => (value ?? "").split(/[;\n]/).map((item) => item.trim()).filter(Boolean);

// Campos do formulário (criar, ativar a proposta ou completar): vazio vira null.
export function planDocumentsFromForm(get: (name: string) => unknown): PlanDocuments {
  const entries = PLAN_DOCUMENT_KEYS.map((key) => [key, String(get(key) ?? "").trim().slice(0, MAX_LENGTH) || null] as const);
  return Object.fromEntries(entries) as PlanDocuments;
}

// O que falta no plano para o conteúdo mínimo e a autoria. A participação da
// família é pedida; a do estudante, "quando possível", não entra na conta.
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

// Sugestões para o formulário a partir do que o estudo de caso já registrou: a
// equipe confere antes de salvar. Monitoramento e devolutiva não vêm prontos.
const RESOURCE_TO_STAFF: Record<string, string> = { "Profissional de apoio": "Profissional de apoio escolar", "Intérprete de Libras": "Tradutor e intérprete de Libras", "Guia-intérprete": "Guia-intérprete" };
const RESOURCE_TO_TECH: Record<string, string> = { "Prancha de comunicação": "Prancha de comunicação", "Mobiliário adaptado": "Mobiliário adaptado" };
const REFERRAL_TO_NETWORK: Record<string, string> = {
  "Rede de saúde": "Rede de saúde", "Avaliação oftalmológica": "Rede de saúde", "Avaliação auditiva": "Rede de saúde",
  "Assistência social (CRAS ou CREAS)": "Assistência social (CRAS ou CREAS)", "Conselho Tutelar": "Conselho Tutelar",
};
const RESOURCE_TO_ASSESSMENT: Record<string, string> = { "Intérprete de Libras": "Tradutor-intérprete de Libras", "Guia-intérprete": "Guia-intérprete" };
// Necessidades do estudo de caso que correspondem a um tipo de AEE do Educacenso.
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

// O plano e o último arquivo do Censo aplicado: tipos de AEE (registro 60) e
// recursos nas avaliações (registro 30). Só compara o que os dois têm: plano sem
// o campo, estudante sem AEE no arquivo ou arquivo anterior a este campo ficam de fora.
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
