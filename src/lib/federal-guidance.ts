// Orientações do Governo Federal que a plataforma segue no PAEE, no PEI e na
// declaração do público da educação especial no Censo Escolar. Puro, para teste
// com node --test (src/lib/plan-documents.test.mjs).
//
// Fonte: INEP, Perguntas frequentes do Censo Escolar, "Quais são os registros
// administrativos que podem ser utilizados como referência para a declaração dos
// alunos público da Educação Especial (...) no Censo Escolar?", publicada em
// 31/08/2026, que aplica o Decreto nº 12.686/2025 e a Portaria MEC nº 421/2026.

export const INEP_CENSUS_GUIDANCE = {
  url: "https://www.gov.br/inep/pt-br/acesso-a-informacao/perguntas-frequentes/censo-escolar/educacao-especial/quais-sao-os-registros-administrativos",
  publishedAt: "31/08/2026",
} as const;

export const FEDERAL_NORMS = ["Decreto nº 12.686/2025", "Portaria MEC nº 421/2026"] as const;

// Linha de fonte para telas impressas e para o rodapé dos documentos.
export const FEDERAL_SOURCE_LINE = `INEP/MEC, Censo Escolar (${INEP_CENSUS_GUIDANCE.publishedAt}); ${FEDERAL_NORMS.join("; ")}`;

// O que o INEP orienta para declarar o estudante no Censo (resumo fiel da página).
export const CENSUS_RULES = [
  "Basta um registro de referência: estudo de caso, PAEE, PEI, avaliação biopsicossocial ou laudo, quando existir.",
  "O estudo de caso ou o PAEE já bastam.",
  "Laudo médico não pode ser exigido para a matrícula, o AEE ou o Censo (Portaria, art. 7º, § 4º).",
  "Os registros não são obrigatórios para declarar, mas são essenciais ao atendimento.",
] as const;

// Quem elabora cada plano (INEP) e o que a Portaria pede dos dois (art. 7º).
export const PLAN_RULES = [
  "PAEE: professor(a) do AEE, com o(a) da classe comum, a família e, quando possível, o estudante.",
  "PEI: professor(a) da classe comum, com o apoio do AEE e da equipe escolar.",
  "Os dois partem do estudo de caso e são revistos todo ano (art. 7º, § 3º).",
  "Um só documento pode reunir os dois, com o conteúdo mínimo de cada um (art. 7º, § 2º).",
] as const;

// O INEP descreve o estudo de caso conduzido pelo professor do AEE, com a
// participação do professor da classe comum, da família e, quando possível, do
// estudante. São os nomes das opções de "Quem participou" (src/lib/case-study.ts).
export const AEE_TEACHER = "Professor(a) do AEE";
export const REGULAR_TEACHER = "Professor(a) da sala comum";

export type CensusReferenceRecord = "Estudo de caso" | "PAEE" | "PEI";

// O que o estudo de caso respondeu em "Público da educação especial"
// (src/lib/case-study.ts). null: estudo sem essa resposta, de antes de ela existir.
export type SpecialEducationAnswer = "sim" | "em_avaliacao" | "nao" | null;
export function specialEducationAnswer(value: string | null | undefined): SpecialEducationAnswer {
  const text = (value ?? "").trim();
  return text.startsWith("Sim") ? "sim" : text.startsWith("Em avaliação") ? "em_avaliacao" : text.startsWith("Não") ? "nao" : null;
}

// Registro de referência para declarar o estudante no Censo: o estudo de caso
// concluído ou o plano ativo (PAEE e PEI no mesmo documento). O laudo fica de
// fora de propósito: é dado clínico e não pode ser exigido. O estudo só respalda
// a declaração quando conclui que o estudante é público da educação especial:
// "em avaliação" ou "não é público" não respaldam, e `pending` diz por quê.
export function censusReference(input: { caseStudyConcluded: boolean; hasActivePlan: boolean; specialEducation?: SpecialEducationAnswer }): { backed: boolean; records: CensusReferenceRecord[]; pending: string | null } {
  const records: CensusReferenceRecord[] = [];
  const answer = input.specialEducation ?? null;
  const studyCounts = input.caseStudyConcluded && answer !== "em_avaliacao" && answer !== "nao";
  if (studyCounts) records.push("Estudo de caso");
  if (input.hasActivePlan) records.push("PAEE", "PEI");
  const pending = !input.caseStudyConcluded || studyCounts ? null
    : answer === "em_avaliacao" ? "O estudo de caso está concluído, mas registra que a equipe ainda avalia se o estudante é público da educação especial."
      : "O estudo de caso concluiu que o estudante não é público da educação especial.";
  return { backed: records.length > 0, records, pending };
}
