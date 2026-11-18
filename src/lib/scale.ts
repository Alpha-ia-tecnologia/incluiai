export type Tone = "good" | "mid" | "alert" | "info" | "neutral";
export type Term = { label: string; short?: string; tone: Tone };
export const toneOf = (table: Readonly<Record<string, Term>>, key: string | null | undefined): Tone => (key && table[key]?.tone) || "neutral";
export const labelOf = (table: Readonly<Record<string, Term>>, key: string) => table[key]?.label ?? key;
export const shortOf = (table: Readonly<Record<string, Term>>, key: string) => table[key]?.short ?? table[key]?.label ?? key;
export const legendOf = (table: Readonly<Record<string, Term>>) => Object.entries(table).map(([key, term]) => ({ key, tone: term.tone, label: term.short ?? term.label }));

export const SUPPORT_LEVELS = [
  { level: 0, code: "IND", label: "Independente", description: "Realiza de forma independente" },
  { level: 1, code: "SUP", label: "Supervisão", description: "Precisa apenas de supervisão ou lembrete" },
  { level: 2, code: "VERB", label: "Instrução verbal", description: "Precisa de instrução verbal ou pista visual" },
  { level: 3, code: "MOD", label: "Modelo", description: "Precisa de modelo ou demonstração" },
  { level: 4, code: "FIS-P", label: "Apoio físico parcial", description: "Precisa de apoio físico parcial" },
  { level: 5, code: "FIS-T", label: "Apoio físico total", description: "Precisa de apoio físico total ou não realiza" },
] as const;

export const clampSupport = (level: number) => Math.min(5, Math.max(0, Math.round(level)));
export function supportInfo(level: number) {
  return SUPPORT_LEVELS[clampSupport(level)];
}
export const supportOffset = (level: number) => (5 - Math.min(5, Math.max(0, level))) / 5;
export const supportTone = (level: number): Tone => (clampSupport(level) <= 1 ? "good" : clampSupport(level) <= 3 ? "mid" : "alert");

export const CHANNELS: Record<string, string> = {
  fala: "Fala",
  libras: "Libras",
  gestos: "Gestos",
  caa_prancha: "CAA (prancha)",
  caa_pecs: "CAA (PECS)",
  caa_alta_tecnologia: "CAA (alta tecnologia)",
  vocalizacoes: "Vocalizações",
  olhar_acionador: "Olhar / acionador",
};

export const STAGES: Record<string, string> = {
  educacao_infantil: "Educação Infantil",
  anos_iniciais: "Anos Iniciais",
  anos_finais: "Anos Finais",
  ensino_medio: "Ensino Médio",
  eja: "EJA",
};

export const SHIFTS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  integral: "Integral",
  noite: "Noite",
};

export const DIMENSIONS: Record<string, string> = {
  comunicacao: "Comunicação",
  leitura: "Leitura",
  escrita: "Escrita",
  matematica: "Matemática",
  interacao: "Interação",
  autonomia: "Autonomia",
  regulacao: "Regulação",
};

// Os cinco tipos de barreira que o INEP lista no estudo de caso. A chave
// "fisica" ficou da versão anterior; o nome é o do INEP (arquitetônica).
export const BARRIERS: Record<string, string> = {
  fisica: "Arquitetônica",
  comunicacional: "Comunicacional",
  pedagogica: "Pedagógica",
  atitudinal: "Atitudinal",
  tecnologica: "Tecnológica",
};

export const SENSORY_AREAS = ["auditiva", "visual", "tatil", "vestibular", "proprioceptiva"] as const;

export const SENSORY_LABELS: Record<string, string> = {
  auditiva: "Auditiva",
  visual: "Visual",
  tatil: "Tátil",
  vestibular: "Vestibular",
  proprioceptiva: "Proprioceptiva",
};

export const SENSORY_VALUES: Record<string, string> = {
  hiper: "Hipersensível",
  hipo: "Hipossensível",
  tipica: "Típica",
};

export const PARTICIPATION: Record<string, Term & { answer: string }> = {
  total: { label: "Participou de toda a atividade", short: "Toda a atividade", answer: "Participou de toda a atividade", tone: "good" },
  parcial: { label: "Participou de parte", short: "Parte", answer: "Participou de parte da atividade", tone: "mid" },
  recusou: { label: "Recusou", answer: "Recusou participar", tone: "alert" },
};

export const CRITERION_MET: Record<string, Term & { answer: string }> = {
  sim: { label: "Atingiu o critério", short: "Atingiu", answer: "Sim, realizou o que era esperado", tone: "good" },
  parcial: { label: "Atingiu em parte", short: "Em parte", answer: "Realizou uma parte", tone: "mid" },
  nao: { label: "Ainda não atingiu", answer: "Ainda não realizou o esperado", tone: "alert" },
};

export type Trend = "avancando" | "estavel" | "atencao" | "sem_dados";
export const TREND: Record<Trend, Term> = {
  avancando: { label: "Avançando", tone: "good" },
  estavel: { label: "Estável", tone: "info" },
  atencao: { label: "Pede atenção", tone: "alert" },
  sem_dados: { label: "Poucos registros", tone: "neutral" },
};

export const OBJECTIVE_STATUSES = ["ativo", "alcancado", "em_revisao"] as const;

export const OBJECTIVE_STATUS: Record<string, Term> = {
  ativo: { label: "Ativo", tone: "info" },
  alcancado: { label: "Alcançado", tone: "good" },
  em_revisao: { label: "Em revisão", tone: "mid" },
};

export const CONTEXTS: Record<string, Term & { long?: string }> = {
  sala_comum: { label: "Sala comum", tone: "info" },
  aee: { label: "AEE", long: "Atendimento educacional especializado (AEE)", tone: "mid" },
  casa: { label: "Casa", tone: "good" },
};

export const ACTIVITY_STATUS: Record<string, Term> = {
  sugerida: { label: "Sugerida", tone: "mid" },
  aceita: { label: "Aceita", tone: "info" },
  aplicada: { label: "Aplicada", tone: "good" },
  rejeitada: { label: "Rejeitada", tone: "alert" },
};
export const PREPARED_ACTIVITY_STATUSES = ["aceita", "aplicada"];

export const MATERIAL_STATUS: Record<string, Term> = {
  sugerido: { label: "Aguarda aprovação", tone: "mid" },
  aprovado: { label: "Aprovado para uso", tone: "good" },
};

export const REPORT_STATUS: Record<string, Term> = {
  rascunho: { label: "Rascunho", tone: "mid" },
  validado: { label: "Validado", tone: "good" },
};

export const ADAPTED_TASK_STATUS: Record<string, Term> = {
  rascunho: { label: "Rascunho", tone: "mid" },
  aprovada: { label: "Aprovada", tone: "good" },
};

export const AEE_SESSION_STATUSES = ["realizado", "falta", "cancelamento"] as const;
export type AeeSessionStatus = (typeof AEE_SESSION_STATUSES)[number];
export const AEE_SESSION_STATUS: Record<AeeSessionStatus, Term & { hint: string }> = {
  realizado: { label: "Realizado", hint: "Aconteceu.", tone: "good" },
  falta: { label: "Falta", hint: "Estava previsto e o estudante não veio.", tone: "mid" },
  cancelamento: { label: "Cancelamento", hint: "Foi desmarcado.", tone: "neutral" },
};

export const TIMELINE_TYPES: Record<string, Term> = {
  avaliacao: { label: "Avaliação", tone: "info" },
  plano: { label: "Plano", tone: "info" },
  atendimento: { label: "Atendimento", tone: "neutral" },
  reuniao: { label: "Reunião", tone: "neutral" },
  transferencia: { label: "Transferência", tone: "mid" },
  alerta: { label: "Alerta", tone: "alert" },
  conquista: { label: "Conquista", tone: "good" },
  recurso: { label: "Recurso", tone: "mid" },
  familia: { label: "Família", tone: "neutral" },
};

