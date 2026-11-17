// Segue o roteiro usual da educação especial (identificação do caso, coleta de informações em
// diferentes fontes, análise e encaminhamentos). Não depende de laudo: o AEE é
// atendimento pedagógico (Nota Técnica MEC/SECADI/DPEE nº 04/2014). Segue também
// o que o INEP descreve para o Censo Escolar: impedimentos observados na escola,
// potencialidades e demandas de apoio; as cinco barreiras; estratégias e recursos;
// conduzido pelo professor do AEE (src/lib/federal-guidance.ts).

import {
  COMMUNICATION_OPTIONS,
  INTEREST_OPTIONS,
  STRENGTH_OPTIONS,
  type ChoiceOption,
} from "./form-options";
import { BARRIERS } from "./scale";
import { AEE_TEACHER, REGULAR_TEACHER } from "./federal-guidance";

export { AEE_TEACHER, REGULAR_TEACHER };

export type CaseStudyField = {
  key: string;
  label: string;
  type: "choice" | "multi" | "textarea";
  options?: ChoiceOption[];
  hint?: string;
  placeholder?: string;
  requiredToConclude?: boolean;
  wide?: boolean;
};

export type CaseStudySection = {
  id: string;
  title: string;
  source: string;
  description: string;
  fields: CaseStudyField[];
};

export type CaseStudyContent = Record<string, string>;

export const CASE_STUDY_SECTIONS: CaseStudySection[] = [
  {
    id: "motivo",
    title: "Motivo do estudo de caso",
    source: "Equipe escolar",
    description: "Por que o caso chegou ao AEE e qual é a principal preocupação.",
    fields: [
      {
        key: "encaminhadoPor", label: "Quem encaminhou o caso", type: "choice",
        options: ["Professor(a) da sala comum", "Família", "Coordenação pedagógica", "Professor(a) do AEE", "Rede de saúde", "Assistência social", "Conselho Tutelar", "Transferência de outra escola"],
      },
      {
        key: "motivos", label: "Motivos do encaminhamento", type: "multi", wide: true,
        options: [
          "Dificuldade na leitura e na escrita", "Dificuldade em matemática", "Dificuldade de comunicação",
          "Dificuldade de interação com os colegas", "Comportamento que dificulta a participação", "Dificuldade de atenção",
          "Dificuldade motora", "Baixa visão ou cegueira", "Surdez ou perda auditiva", "Indícios de altas habilidades",
          "Aprendizagem abaixo do esperado para a turma", "Reavaliação anual do AEE",
        ],
      },
      { key: "situacao", label: "Descreva a situação (opcional)", type: "textarea", wide: true, placeholder: "Ex.: tem dificuldade em acompanhar as atividades escritas e se afasta dos colegas no recreio." },
    ],
  },
  {
    id: "familia",
    title: "Entrevista com a família",
    source: "Família ou responsáveis",
    description: "Contexto familiar, desenvolvimento e rotina. Registre apenas o que ajuda a entender a participação na escola.",
    fields: [
      { key: "entrevistados", label: "Quem participou da entrevista", type: "multi", options: ["Mãe", "Pai", "Avó", "Avô", "Responsável legal", "Cuidador(a)"] },
      { key: "moraCom", label: "Com quem mora", type: "multi", options: ["Mãe", "Pai", "Avós", "Irmãos", "Tios", "Padrasto ou madrasta", "Família acolhedora", "Acolhimento institucional"] },
      {
        key: "saude", label: "Questões de saúde que afetam a rotina escolar", type: "multi", wide: true,
        hint: "Registre só o que a escola precisa saber para cuidar e incluir.",
        options: ["Convulsões ou epilepsia", "Alergia alimentar", "Restrição alimentar", "Medicação no horário escolar", "Problema de visão", "Problema de audição", "Dificuldade para dormir", "Nenhuma"],
      },
      {
        key: "acompanhamentos", label: "Acompanhamentos fora da escola", type: "multi", wide: true,
        options: ["Fonoaudiologia", "Terapia ocupacional", "Psicologia", "Fisioterapia", "Neurologia", "Psiquiatria", "Psicopedagogia", "CAPS infantil", "Nenhum"],
      },
      {
        key: "diagnostico", label: "Diagnóstico informado pela família ou em laudo (opcional)", type: "multi", wide: true,
        hint: "Não é obrigatório: laudo não pode ser exigido para matrícula, AEE ou Censo (Portaria MEC nº 421/2026, art. 7º, § 4º).",
        options: ["Deficiência intelectual", "Deficiência física", "Deficiência visual", "Deficiência auditiva ou surdez", "Surdocegueira", "Deficiência múltipla", "Transtorno do espectro autista", "Altas habilidades ou superdotação", "Em investigação", "Sem diagnóstico"],
      },
      { key: "interessesCasa", label: "Do que gosta em casa", type: "multi", wide: true, options: INTEREST_OPTIONS },
    ],
  },
  {
    id: "estudante",
    title: "Escuta do estudante",
    source: "O próprio estudante",
    description: "O que o estudante conta sobre si e sobre a escola, do jeito que consegue se expressar.",
    fields: [
      { key: "formaEscuta", label: "Como a escuta foi feita", type: "choice", options: ["Conversa", "Desenho", "Prancha de comunicação", "Observação das escolhas", "Não foi possível"] },
      { key: "comoSeSente", label: "Como se sente na escola", type: "choice", options: ["Bem e à vontade", "Às vezes desconfortável", "Com medo ou ansioso(a)", "Não quer vir para a escola", "Não foi possível identificar"] },
      {
        key: "gostaEscola", label: "O que mais gosta na escola", type: "multi", wide: true,
        options: ["Brincar no recreio", "Educação física", "Artes", "Música", "Ouvir histórias", "Usar o computador ou tablet", "Estar com os colegas", "Merenda"],
      },
      {
        key: "achaDificil", label: "O que acha difícil ou não gosta", type: "multi", wide: true,
        options: ["Ler", "Escrever", "Fazer contas", "Barulho", "Ficar sentado muito tempo", "Trabalhos em grupo", "Mudanças na rotina", "Recreio"],
      },
    ],
  },
  {
    id: "observacao",
    title: "Observação na escola",
    source: "Sala comum, recreio e outros espaços",
    description: "Como o estudante participa nos diferentes espaços da escola.",
    fields: [
      { key: "espacos", label: "Espaços observados", type: "multi", wide: true, options: ["Sala comum", "Recreio", "Refeitório", "Educação física", "Biblioteca", "Entrada e saída", "Sala de recursos"] },
      { key: "participacao", label: "Participação nas atividades", type: "choice", options: ["Participa com autonomia", "Participa com apoio", "Participa pouco", "Não participa"] },
      { key: "comunicacaoEscola", label: "Como se comunica na escola", type: "multi", options: COMMUNICATION_OPTIONS },
      {
        key: "interacao", label: "Interação", type: "multi", wide: true,
        options: ["Busca os colegas", "Aceita a aproximação dos colegas", "Prefere ficar sozinho(a)", "Interage mais com adultos", "Tem um colega de referência", "Tem conflitos frequentes"],
      },
      {
        key: "impedimentos", label: "Impedimentos de longo prazo observados na escola", type: "multi", requiredToConclude: true, wide: true,
        hint: "O que se vê na participação, sem diagnóstico.",
        options: [
          "Na visão", "Na audição", "Na fala e na comunicação", "Na mobilidade e na locomoção", "Na coordenação motora",
          "Na interação social", "Na atenção e na autorregulação", "Na compreensão e na aprendizagem", "Na autonomia na rotina",
          "Nenhum impedimento de longo prazo observado",
        ],
      },
      { key: "barreiras", label: "Barreiras observadas", type: "multi", requiredToConclude: true, wide: true, hint: "Do contexto escolar, não do estudante.", options: Object.values(BARRIERS) },
    ],
  },
  {
    id: "pedagogica",
    title: "Avaliação pedagógica",
    source: "Professor(a) do AEE",
    description: "O que o estudante já sabe e como aprende melhor.",
    fields: [
      { key: "leitura", label: "Leitura", type: "choice", options: ["Ainda não reconhece letras", "Reconhece algumas letras", "Lê palavras simples", "Lê frases", "Lê textos curtos com compreensão", "Lê com fluência"] },
      {
        key: "escrita", label: "Escrita (hipótese de escrita)", type: "choice",
        options: ["Pré-silábica", "Silábica sem valor sonoro", "Silábica com valor sonoro", "Silábico-alfabética", "Alfabética", "Ortográfica"],
      },
      { key: "matematica", label: "Matemática", type: "choice", options: ["Ainda não conta", "Conta até 10 com apoio", "Conta até 10", "Reconhece números até 100", "Resolve adição e subtração simples", "Resolve problemas com as quatro operações"] },
      {
        key: "aprendeMelhor", label: "Aprende melhor", type: "multi", wide: true,
        options: ["Com apoio visual", "Com material concreto", "Com repetição", "Com modelo", "Com instrução curta", "Com tecnologia", "Com movimento", "Com música"],
      },
      { key: "potencialidades", label: "Potencialidades", type: "multi", requiredToConclude: true, wide: true, options: STRENGTH_OPTIONS },
    ],
  },
  {
    id: "sintese",
    title: "Síntese e encaminhamentos",
    source: "Equipe escolar",
    description: "O que o estudo mostrou e por onde começar o atendimento.",
    fields: [
      {
        key: "publicoAlvo", label: "Público da educação especial", type: "choice", requiredToConclude: true,
        hint: "Público do AEE: estudantes com deficiência, transtorno do espectro autista ou altas habilidades/superdotação.",
        options: ["Sim: estudante com deficiência", "Sim: transtorno do espectro autista", "Sim: altas habilidades ou superdotação", "Em avaliação pela equipe", "Não é público do AEE: acompanhar na sala comum"],
      },
      {
        key: "necessidades", label: "Necessidades educacionais identificadas", type: "multi", requiredToConclude: true, wide: true,
        hint: "As que são tipo de AEE no Censo já vêm marcadas no PEI.",
        options: [
          "Comunicação alternativa e aumentativa", "Ensino de Libras", "Ensino da Língua Portuguesa como segunda língua", "Ensino do braille",
          "Ensino do cálculo no Soroban", "Orientação e mobilidade", "Recursos ópticos e não ópticos", "Ensino da informática acessível",
          "Adequação de materiais", "Tecnologia assistiva", "Enriquecimento curricular", "Desenvolvimento de funções cognitivas",
          "Desenvolvimento da autonomia", "Apoio à interação social", "Apoio à autorregulação",
        ],
      },
      {
        key: "recursos", label: "Recursos e serviços indicados", type: "multi", requiredToConclude: true, wide: true,
        options: ["AEE na sala de recursos", "Profissional de apoio", "Intérprete de Libras", "Guia-intérprete", "Transporte acessível", "Mobiliário adaptado", "Material ampliado", "Prancha de comunicação"],
      },
      {
        key: "encaminhamentos", label: "Encaminhamentos para outros serviços", type: "multi", wide: true,
        options: ["Rede de saúde", "Avaliação oftalmológica", "Avaliação auditiva", "Assistência social (CRAS ou CREAS)", "Conselho Tutelar", "Nenhum"],
      },
      {
        key: "participantes", label: "Quem participou do estudo de caso", type: "multi", requiredToConclude: true, wide: true,
        hint: "Conduz: professor(a) do AEE, com a sala comum e a família (INEP).",
        options: [AEE_TEACHER, REGULAR_TEACHER, "Coordenação pedagógica", "Gestão escolar", "Família", "O próprio estudante", "Profissional de apoio", "Terapeuta"],
      },
      {
        key: "sintese", label: "Síntese do caso", type: "textarea", requiredToConclude: true, wide: true,
        hint: "Em poucas linhas: quem é o estudante, o que o estudo mostrou e por onde começar.",
        placeholder: "Ex.: O estudante se comunica pela prancha e aprende melhor com apoio visual e temas de dinossauros. A prioridade é ampliar a comunicação funcional e a autonomia na rotina.",
      },
      { key: "reavaliacao", label: "Quando reavaliar o caso", type: "choice", options: ["Em 3 meses", "Em 6 meses", "No fim do ano letivo"] },
    ],
  },
];

export const CASE_STUDY_FIELDS = CASE_STUDY_SECTIONS.flatMap((section) => section.fields);

// O que o INEP diz que o estudo de caso documenta para respaldar a declaração no Censo
// Escolar (src/lib/federal-guidance.ts): (i) impedimentos de longo prazo,
// potencialidades e demandas de apoio; (ii) barreiras do contexto escolar;
// (iii) estratégias e recursos de acessibilidade.
export const ESSENTIAL_GROUPS: { title: string; hint: string; keys: string[] }[] = [
  { title: "Impedimentos, potencialidades e demandas de apoio", hint: "O que se observa na participação, o que o estudante já faz bem e do que ele precisa.", keys: ["impedimentos", "potencialidades", "necessidades"] },
  { title: "Barreiras do contexto escolar", hint: "Arquitetônicas, comunicacionais, pedagógicas, tecnológicas ou atitudinais.", keys: ["barreiras"] },
  { title: "Estratégias e recursos de acessibilidade", hint: "O que a escola vai oferecer para o estudante participar.", keys: ["recursos"] },
  { title: "Conclusão do estudo", hint: "Quem participou, se o estudante é público da educação especial e a síntese do caso.", keys: ["participantes", "publicoAlvo", "sintese"] },
];

const RENAMED: Record<string, Record<string, string>> = { barreiras: { "Física": BARRIERS.fisica } };

export const RETIRED_CASE_FIELDS: readonly string[] = [
  "idadeEntrada", "frequencia", "reprovacoes", "jaFrequentou", "apoiosAnteriores",
  "andou", "falou", "comunicacaoCasa", "autonomiaCasa", "expectativas", "comportamento", "frequenciaAee",
];

export function parseCaseStudy(content: string | null | undefined): CaseStudyContent {
  if (!content) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const study = { ...(parsed as CaseStudyContent) };
  for (const [key, names] of Object.entries(RENAMED)) {
    if (typeof study[key] === "string") study[key] = study[key].split(";").map((item) => names[item.trim()] ?? item.trim()).join("; ");
  }
  return study;
}

export function sectionProgress(section: CaseStudySection, content: CaseStudyContent) {
  const filled = section.fields.filter((field) => content[field.key]?.trim()).length;
  return { filled, total: section.fields.length };
}

export const CLINICAL_CASE_FIELDS: ReadonlySet<string> = new Set(["diagnostico", "saude", "acompanhamentos", "moraCom"]);
// Para a IA vai só a parte pedagógica: os campos clínicos e quem foi entrevistado ficam na plataforma.
export const caseFieldLeavesPlatform = (key: string) => !CLINICAL_CASE_FIELDS.has(key) && key !== "entrevistados";

export function missingToConclude(content: CaseStudyContent): CaseStudyField[] {
  return CASE_STUDY_FIELDS.filter((field) => field.requiredToConclude && !content[field.key]?.trim());
}

// O INEP descreve o estudo de caso conduzido pelo professor do AEE.
const participantsOf = (content: CaseStudyContent) => (content.participantes ?? "").split(/[;\n]/).map((item) => item.trim());
export const conductedByAee = (content: CaseStudyContent) => participantsOf(content).includes(AEE_TEACHER);
export const withRegularTeacher = (content: CaseStudyContent) => participantsOf(content).includes(REGULAR_TEACHER);

export const CASE_STUDY_REQUIRED_MESSAGE =
  "Conclua o estudo de caso do estudante antes de criar o plano de ensino. O plano parte do que o estudo de caso levantou.";

export function isCaseStudyConcluded(caseStudy: { status: string } | null | undefined): boolean {
  return caseStudy?.status === "concluido";
}

