// Vocabulário estruturado da plataforma (item 17.2 da proposta).
// A escala única de nível de apoio permite medir progresso sem nota:
// avanço = redução do nível de apoio na mesma tarefa.

export const SUPPORT_LEVELS = [
  { level: 0, code: "IND", label: "Independente", description: "Realiza de forma independente" },
  { level: 1, code: "SUP", label: "Supervisão", description: "Precisa apenas de supervisão ou lembrete" },
  { level: 2, code: "VERB", label: "Instrução verbal", description: "Precisa de instrução verbal ou pista visual" },
  { level: 3, code: "MOD", label: "Modelo", description: "Precisa de modelo ou demonstração" },
  { level: 4, code: "FIS-P", label: "Apoio físico parcial", description: "Precisa de apoio físico parcial" },
  { level: 5, code: "FIS-T", label: "Apoio físico total", description: "Precisa de apoio físico total ou não realiza" },
] as const;

export function supportInfo(level: number) {
  return SUPPORT_LEVELS[Math.min(5, Math.max(0, level))];
}

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

export const BARRIERS: Record<string, string> = {
  fisica: "Física",
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

export const PARTICIPATION: Record<string, string> = {
  total: "Participou",
  parcial: "Parcial",
  recusou: "Recusou",
};

export const CRITERION_MET: Record<string, string> = {
  sim: "Atingiu",
  parcial: "Parcial",
  nao: "Não atingiu",
};

export const CONTEXTS: Record<string, string> = {
  sala_comum: "Sala comum",
  aee: "AEE",
  casa: "Casa",
};

export const ACTIVITY_STATUS: Record<string, string> = {
  sugerida: "Sugerida",
  aceita: "Aceita",
  aplicada: "Aplicada",
  rejeitada: "Rejeitada",
};

export const TIMELINE_TYPES: Record<string, string> = {
  avaliacao: "Avaliação",
  plano: "Plano",
  atendimento: "Atendimento",
  reuniao: "Reunião",
  transferencia: "Transferência",
  alerta: "Alerta",
  conquista: "Conquista",
  recurso: "Recurso",
};

export const ROLES: Record<string, string> = {
  professor_sala: "Professor(a) da sala comum",
  professor_aee: "Professor(a) do AEE",
  apoio: "Profissional de apoio",
  coordenacao: "Coordenação pedagógica",
  gestao: "Gestão escolar",
  secretaria: "Secretaria de Educação",
  familia: "Família",
};

export const AI_DISCLAIMER =
  "Sugestão para análise do profissional: não substitui avaliação pedagógica ou clínica.";
