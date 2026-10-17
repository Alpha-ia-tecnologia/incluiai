// Estudo de caso do AEE: etapa de diagnóstico pedagógico que reúne escuta da
// família, da escola e do próprio estudante antes de planejar. Segue o roteiro
// usual da educação especial (identificação do caso, coleta de informações em
// diferentes fontes, análise e encaminhamentos). Não depende de laudo: o AEE é
// atendimento pedagógico (Nota Técnica MEC/SECADI/DPEE nº 04/2014).

import {
  AEE_FREQUENCY_OPTIONS,
  COMMUNICATION_OPTIONS,
  INTEREST_OPTIONS,
  STRENGTH_OPTIONS,
  type ChoiceOption,
} from "./form-options";
import { BARRIERS } from "./scale";

export type CaseStudyField = {
  key: string;
  label: string;
  type: "choice" | "multi" | "textarea";
  options?: ChoiceOption[];
  hint?: string;
  placeholder?: string;
  // Obrigatório apenas para concluir; o rascunho pode ficar incompleto.
  requiredToConclude?: boolean;
  wide?: boolean;
};

export type CaseStudySection = {
  id: string;
  title: string;
  source: string; // com quem/onde a informação é levantada
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
        key: "encaminhadoPor", label: "Quem encaminhou o caso", type: "choice", requiredToConclude: true,
        options: ["Professor(a) da sala comum", "Família", "Coordenação pedagógica", "Professor(a) do AEE", "Rede de saúde", "Assistência social", "Conselho Tutelar", "Transferência de outra escola"],
      },
      {
        key: "motivos", label: "Motivos do encaminhamento", type: "multi", requiredToConclude: true, wide: true,
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
    id: "historico",
    title: "Histórico escolar",
    source: "Secretaria da escola e família",
    description: "Trajetória escolar e apoios que o estudante já recebeu.",
    fields: [
      { key: "idadeEntrada", label: "Com que idade entrou na escola", type: "choice", options: ["Antes dos 2 anos", "Entre 2 e 3 anos", "Entre 4 e 5 anos", "Com 6 anos ou mais", "Não sabe informar"] },
      { key: "frequencia", label: "Frequência escolar", type: "choice", options: ["Regular", "Faltas ocasionais", "Faltas frequentes", "Afastamento prolongado"] },
      { key: "reprovacoes", label: "Reprovações", type: "choice", options: ["Nenhuma", "1 reprovação", "2 reprovações", "3 ou mais"] },
      { key: "jaFrequentou", label: "Já frequentou", type: "multi", options: ["Creche", "Pré-escola", "Outra escola regular", "Escola especial", "Classe especial", "AEE em outra escola"] },
      { key: "apoiosAnteriores", label: "Apoios que já recebeu", type: "multi", wide: true, options: ["AEE", "Profissional de apoio", "Reforço escolar", "Intérprete de Libras", "Material adaptado", "Comunicação alternativa", "Nenhum"] },
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
      { key: "andou", label: "Quando começou a andar", type: "choice", options: ["Antes de 1 ano", "Entre 1 e 2 anos", "Depois dos 2 anos", "Ainda não anda", "Não sabe informar"] },
      { key: "falou", label: "Quando começou a falar", type: "choice", options: ["Até 2 anos", "Entre 2 e 3 anos", "Depois dos 3 anos", "Ainda não fala", "Não sabe informar"] },
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
        key: "diagnostico", label: "Diagnóstico informado pela família (opcional)", type: "multi", wide: true,
        hint: "Não é obrigatório. O AEE é pedagógico e não depende de laudo (Nota Técnica MEC/SECADI/DPEE nº 04/2014).",
        options: ["Deficiência intelectual", "Deficiência física", "Deficiência visual", "Deficiência auditiva ou surdez", "Surdocegueira", "Deficiência múltipla", "Transtorno do espectro autista", "Altas habilidades ou superdotação", "Em investigação", "Sem diagnóstico"],
      },
      { key: "comunicacaoCasa", label: "Como se comunica em casa", type: "multi", wide: true, options: COMMUNICATION_OPTIONS },
      {
        key: "autonomiaCasa", label: "O que faz sozinho(a) em casa", type: "multi", wide: true,
        options: ["Come sem ajuda", "Veste-se sem ajuda", "Usa o banheiro sem ajuda", "Escova os dentes", "Guarda os brinquedos", "Ajuda em tarefas da casa", "Brinca com outras crianças"],
      },
      { key: "interessesCasa", label: "Do que gosta em casa", type: "multi", wide: true, options: INTEREST_OPTIONS },
      {
        key: "expectativas", label: "O que a família espera da escola", type: "multi", wide: true,
        options: ["Que aprenda a ler e escrever", "Que faça amigos", "Que se comunique melhor", "Que ganhe autonomia", "Que se sinta bem na escola", "Que acompanhe a turma"],
      },
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
        key: "comportamento", label: "Durante as atividades", type: "multi", wide: true,
        options: ["Mantém a atenção na tarefa", "Distrai-se com facilidade", "Movimenta-se muito", "Fica agitado(a) com barulho", "Segue os combinados", "Precisa de lembretes frequentes", "Organiza o próprio material"],
      },
      { key: "barreiras", label: "Barreiras observadas", type: "multi", wide: true, options: Object.values(BARRIERS) },
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
      { key: "potencialidades", label: "Potencialidades", type: "multi", wide: true, options: STRENGTH_OPTIONS },
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
      { key: "frequenciaAee", label: "Frequência sugerida para o AEE", type: "choice", options: AEE_FREQUENCY_OPTIONS },
      {
        key: "necessidades", label: "Necessidades educacionais identificadas", type: "multi", requiredToConclude: true, wide: true,
        options: [
          "Comunicação alternativa e aumentativa", "Ensino de Libras", "Ensino do braille", "Orientação e mobilidade",
          "Adequação de materiais", "Tecnologia assistiva", "Enriquecimento curricular", "Desenvolvimento da autonomia",
          "Apoio à interação social", "Apoio à autorregulação",
        ],
      },
      {
        key: "recursos", label: "Recursos e serviços indicados", type: "multi", wide: true,
        options: ["AEE na sala de recursos", "Profissional de apoio", "Intérprete de Libras", "Guia-intérprete", "Transporte acessível", "Mobiliário adaptado", "Material ampliado", "Prancha de comunicação"],
      },
      {
        key: "encaminhamentos", label: "Encaminhamentos para outros serviços", type: "multi", wide: true,
        options: ["Rede de saúde", "Avaliação oftalmológica", "Avaliação auditiva", "Assistência social (CRAS ou CREAS)", "Conselho Tutelar", "Nenhum"],
      },
      {
        key: "participantes", label: "Quem participou do estudo de caso", type: "multi", requiredToConclude: true, wide: true,
        options: ["Professor(a) do AEE", "Professor(a) da sala comum", "Coordenação pedagógica", "Gestão escolar", "Família", "O próprio estudante", "Profissional de apoio", "Terapeuta"],
      },
      {
        key: "sintese", label: "Síntese do caso", type: "textarea", requiredToConclude: true, wide: true,
        hint: "Em poucas linhas: quem é o estudante, o que o estudo mostrou e por onde começar.",
        placeholder: "Ex.: Dante se comunica pela prancha e aprende melhor com apoio visual e temas de dinossauros. A prioridade é ampliar a comunicação funcional e a autonomia na rotina.",
      },
      { key: "reavaliacao", label: "Quando reavaliar o caso", type: "choice", options: ["Em 3 meses", "Em 6 meses", "No fim do ano letivo"] },
    ],
  },
];

export const CASE_STUDY_FIELDS = CASE_STUDY_SECTIONS.flatMap((section) => section.fields);

export function parseCaseStudy(content: string | null | undefined): CaseStudyContent {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as CaseStudyContent) : {};
  } catch {
    return {};
  }
}

export function sectionProgress(section: CaseStudySection, content: CaseStudyContent) {
  const filled = section.fields.filter((field) => content[field.key]?.trim()).length;
  return { filled, total: section.fields.length };
}

export function missingToConclude(content: CaseStudyContent): CaseStudyField[] {
  return CASE_STUDY_FIELDS.filter((field) => field.requiredToConclude && !content[field.key]?.trim());
}

// O Plano de ensino (PPI/PAEE) parte do estudo de caso CONCLUÍDO — inclusive a
// proposta preparada pela IA ou pelas regras (descritivo DUA, CA02). O planejamento
// de atividade da turma com DUA não depende disso.
export const CASE_STUDY_REQUIRED_MESSAGE =
  "Conclua o estudo de caso do estudante antes de criar o plano de ensino. O plano parte do que o estudo de caso levantou.";

export function isCaseStudyConcluded(caseStudy: { status: string } | null | undefined): boolean {
  return caseStudy?.status === "concluido";
}

