import { SUPPORT_LEVELS } from "./scale.ts";

export const ACTIVITY_CONTEXTS = ["sala_comum", "aee", "casa"] as const;
export type ActivityContext = (typeof ACTIVITY_CONTEXTS)[number];
export const isActivityContext = (value: string): value is ActivityContext => (ACTIVITY_CONTEXTS as readonly string[]).includes(value);

export const HOME_MAX_MINUTES = 10;
const DEFAULT_MAX_MINUTES = 25;
export const activityMinutesLimit = (context: ActivityContext, toleranceMinutes: number) =>
  context === "casa" ? Math.min(HOME_MAX_MINUTES, toleranceMinutes || HOME_MAX_MINUTES) : toleranceMinutes || DEFAULT_MAX_MINUTES;
export const ACTIVITY_STEPS = { min: 3, max: 6 } as const;
const STEP_MAX_WORDS = 30;
const NEEDS_SHOPPING = /\b(compr(ar|e|ado)|loja|papelaria)\b/i;

export const OBJECTIVES_PER_PLAN = { min: 2, max: 3 } as const;
export const OBJECTIVE_DEADLINE_WEEKS = { min: 4, max: 12 } as const;
export const MATERIAL_ACTIVITIES = { min: 2, max: 3 } as const;

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Diagnóstico, CID (inclusive F84), condições, medicação e terapia: o AEE é
// pedagógico e não depende de laudo (Nota Técnica MEC/SECADI/DPEE nº 04/2014).
const CLINICAL_TERMS = /\b(diagnos\w*|laudo\w*|cid\b|cid[- ]?\d{1,2}\b|cid[- ]?[a-z]\d|f\d{2}(?:\.\d)?\b|tea\b|tdah\b|autis\w*|sindrome\w*|transtorno\w*|deficiencia intelectual|deficit\w*|patolog\w*|epileps\w*|medicament\w*|medicac\w*|medicad[oa]s?\b|remedio\w*|doses?\b|terapia\w*)/;
export const hasClinicalTerm = (value: unknown) => CLINICAL_TERMS.test(fold(typeof value === "string" ? value : JSON.stringify(value)));

// A regra permanente de não segregação (item 17.7) vale para toda atividade,
// mas não é uma adaptação do estudante.
export const PERMANENT_RULE_ID = "R00-ANTISSEGREGACAO";
export const studentAdaptations = <Rule extends { id: string }>(rules: Rule[]) => rules.filter((rule) => rule.id !== PERMANENT_RULE_ID);

export const usesAac = (channel: string) => channel.startsWith("caa") || channel === "olhar_acionador";

export const SUPPORT_SCALE = SUPPORT_LEVELS.map((item) => `${item.level} ${item.code} (${item.description.toLowerCase()})`).join("; ");

export type ActivityToCheck = {
  title: string;
  context: ActivityContext;
  durationMinutes: number;
  materials: string[];
  steps: string[];
  successCriterion: string;
  classParticipation?: string | null;
};

export function checkActivity(activity: ActivityToCheck, toleranceMinutes: number): string[] {
  const problems: string[] = [];
  const max = activityMinutesLimit(activity.context, toleranceMinutes);
  if (activity.durationMinutes > max) problems.push(`"${activity.title}" dura ${activity.durationMinutes} min; o limite é ${max} min.`);
  if (activity.steps.length < ACTIVITY_STEPS.min || activity.steps.length > ACTIVITY_STEPS.max) problems.push(`"${activity.title}" tem ${activity.steps.length} passos; use de ${ACTIVITY_STEPS.min} a ${ACTIVITY_STEPS.max}.`);
  if (activity.steps.some((step) => step.trim().split(/\s+/).length > STEP_MAX_WORDS)) problems.push(`"${activity.title}" tem passo longo demais: uma ação por passo.`);
  if (!activity.successCriterion.trim()) problems.push(`"${activity.title}" precisa de um critério de sucesso observável.`);
  if (activity.context === "sala_comum" && !activity.classParticipation?.trim()) problems.push(`"${activity.title}" é na sala comum: diga como a turma participa junto.`);
  if (activity.context === "casa" && NEEDS_SHOPPING.test(activity.materials.join(" "))) problems.push(`"${activity.title}" é em casa: use apenas objetos que a família já tem, sem compras.`);
  return problems;
}

export const SAFEGUARDS = `- Você propõe; a pessoa decide. Nada do que você produz é aplicado sem revisão humana.
- Trabalhe com informações funcionais e pedagógicas. Não infira diagnóstico, prognóstico nem capacidade cognitiva, e não use linguagem clínica.
- Adapte o acesso, nunca reduza o currículo: o estudante aprende o mesmo conteúdo da turma com os apoios de que precisa.
- Inclusão sem segregação: na sala comum, o estudante participa da mesma aula, com a turma (Desenho Universal para a Aprendizagem).
- Baseie-se apenas nas informações recebidas e não invente dados, observações ou resultados. Quando faltar informação, diga o que a equipe precisa observar.`;
