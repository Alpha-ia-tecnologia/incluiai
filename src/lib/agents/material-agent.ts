import { z } from "zod/v4";
import { BASE_SYSTEM } from "./prompts";
import type { AgentModel } from "./types";
import type { TraceStep } from "./schemas";
import {
  ACCESSIBILITY_BY_KIND, MATERIAL_KINDS, MATERIAL_KIND_LABEL, checkMaterial, finalizeMaterial, normalizeMaterialContent, profileAdaptations,
  type MaterialContent, type MaterialContext, type MaterialKind, type ProfileFacts,
} from "../material-content";

// Agente que cria o material de apoio: cartões (com a descrição do pictograma),
// como apresentar, como usar, 2 a 3 atividades para aplicar o material e o
// porquê de cada adaptação. As regras de src/lib/material-content.ts conferem a
// resposta; se algo não passar, o agente corrige uma vez. O que ainda faltar
// vira ponto para o professor conferir. Nada é usado sem aprovação humana.

export const MATERIAL_AGENT = "Criador de materiais";
export const MAX_MATERIAL_RETRIES = 1;

// Sem restrições numéricas no esquema (como os demais agentes): os limites são
// aplicados depois, em finalizeMaterial.
export const MaterialProposalSchema = z.object({
  title: z.string().describe("Título curto do material, sem nome de pessoa. Ex.: Rotina da hora do lanche"),
  purpose: z.string().describe("Para que serve o material, em uma frase ligada ao perfil e à situação."),
  intro: z.string().describe("Como apresentar o material ao estudante, em 1 ou 2 frases."),
  cards: z.array(z.object({
    label: z.string().describe("Texto do cartão: curto, concreto, no presente (história social em 1ª pessoa)."),
    caption: z.string().nullable().describe("Frase de apoio opcional, para o adulto ou para a família."),
    visual: z.string().describe("Descrição do pictograma deste cartão para um ilustrador: cena ou objeto, sem pedir texto na imagem."),
    alt: z.string().describe("Texto alternativo da imagem, para leitor de tela."),
  })).describe("Os cartões, em ordem."),
  howToUse: z.array(z.string()).describe("De 3 a 6 orientações práticas para o professor usar o material."),
  activities: z.array(z.object({
    title: z.string(),
    context: z.enum(["sala_comum", "aee", "casa"]),
    durationMinutes: z.number().int(),
    goal: z.string().describe("O que se quer desenvolver com a atividade."),
    materials: z.array(z.string()),
    steps: z.array(z.string()).describe("De 3 a 6 passos, uma ação por passo, usando o material."),
    responseForms: z.array(z.string()).describe("Formas de resposta aceitas, coerentes com a comunicação do estudante."),
    supportBelow: z.string().describe("Degrau de apoio abaixo (mais ajuda), se a atividade ficar difícil."),
    supportTarget: z.string().describe("Apoio previsto para hoje."),
    supportAbove: z.string().describe("Degrau acima (menos ajuda), quando o estudante estiver pronto."),
    successCriterion: z.string().describe("Critério observável de sucesso."),
    planB: z.string().describe("O que fazer se não der certo, respeitando a regulação do estudante."),
    classParticipation: z.string().nullable().describe("Na sala comum: como a turma participa junto. Nos outros contextos, null."),
  })).describe("De 2 a 3 atividades para aplicar o material."),
  adaptations: z.array(z.object({
    text: z.string().describe("A adaptação feita no material ou nas atividades."),
    basis: z.string().describe("O item do perfil que a justifica, citando a fonte. Ex.: Como aprende: compreende comandos de 1 etapa."),
  })),
  accessibility: z.array(z.string()).describe("Recursos de acessibilidade do material."),
  familyTip: z.string().nullable().describe("Uma dica curta para a família usar o material em casa."),
});
export type MaterialProposal = z.infer<typeof MaterialProposalSchema>;

const KIND_GUIDE: Record<MaterialKind, string> = {
  rotina_visual: "Rotina visual: um cartão por momento da situação, em ordem; o último cartão marca o fim. Antecipe as trocas.",
  sequencia_tarefa: "Passo a passo (análise de tarefa): uma ação observável por cartão, verbo no início, na ordem em que a tarefa é feita.",
  historia_social: "História social: frases curtas em 1ª pessoa, tom tranquilo e positivo, descrevendo a situação, o que os outros fazem e o que o estudante pode fazer. Sem regras punitivas.",
  prancha_caa: "Prancha de comunicação: palavras essenciais para pedir, recusar, pedir ajuda e pausa, mais o vocabulário da situação. Uma palavra ou expressão curta por cartão.",
  quadro_escolhas: "Quadro de escolhas: de 2 a 6 opções visuais equivalentes (como participar, com quem, com qual material, o que fazer primeiro), todas aceitáveis para o professor.",
  regulacao: "Cartões de autorregulação: um termômetro simples de como estou (3 a 4 níveis) e cartões com estratégias de calma concretas, vindas do perfil.",
};

export const MATERIAL_SYSTEM = `${BASE_SYSTEM}

Você cria materiais de apoio acessíveis para um estudante da educação especial, prontos para imprimir, e as atividades para aplicar o material.
- O material precisa ser específico para a situação pedida e para este estudante: use a comunicação, as etapas de comando, o tempo de tarefa, o perfil sensorial, a regulação e os interesses informados.
- Os cartões têm texto curto e uma descrição visual (visual) para um ilustrador desenhar um pictograma: cena ou objeto simples, pessoas genéricas, sem texto escrito na imagem e sem identificar ninguém.
- Proponha de 2 a 3 atividades para aplicar o material em contextos diferentes (sala comum com a turma, AEE, casa), cada uma com 3 a 6 passos, escada de apoio (abaixo, hoje, acima), formas de resposta, critério de sucesso observável e plano B.
- Respeite o tempo de tarefa do estudante na duração. Em casa, no máximo 10 minutos e só objetos que a família já tem.
- Cada adaptação diz o item do perfil em que se baseia. Não invente informação que não veio no perfil.
- Não use nomes: escreva "o estudante". Não use linguagem clínica nem mencione diagnóstico.`;

export type MaterialAgentInput = {
  kind: MaterialKind;
  topic: string;
  context: MaterialContext;
  objective: string | null;
  contextText: string; // perfil e estudo de caso, já sem dados pessoais
  facts: ProfileFacts;
};

const toContent = (proposal: MaterialProposal): MaterialContent => normalizeMaterialContent({
  ...proposal,
  cards: proposal.cards.map((card) => ({ ...card, caption: card.caption ?? undefined })),
  activities: proposal.activities.map((activity) => ({ ...activity, classParticipation: activity.classParticipation ?? undefined })),
  familyTip: proposal.familyTip ?? "",
  reviewNotes: [],
});

export async function runMaterialAgent(input: MaterialAgentInput, model: AgentModel): Promise<{ title: string; content: MaterialContent; trace: TraceStep[] }> {
  const range = MATERIAL_KINDS.find((item) => item.kind === input.kind)!.cards;
  const rules = { kind: input.kind, toleranceMinutes: input.facts.toleranceMinutes };
  const request = [
    `## Material pedido\nTipo: ${MATERIAL_KIND_LABEL[input.kind]} (${range[0]} a ${range[1]} cartões). ${KIND_GUIDE[input.kind]}`,
    `Situação ou conteúdo: ${input.topic.trim() || "não informado — escolha uma situação comum da rotina escolar"}.`,
    `Contexto principal de uso: ${input.context === "sala_comum" ? "sala comum, com a turma" : input.context === "aee" ? "atendimento educacional especializado (AEE)" : "casa, com a família"}.`,
    input.objective ? `Objetivo do plano do estudante a apoiar: ${input.objective}` : "",
    `Tempo de tarefa: até ${input.facts.toleranceMinutes} min.`,
    `Recursos de acessibilidade esperados para este tipo: ${ACCESSIBILITY_BY_KIND[input.kind].join("; ")}.`,
    `\n${input.contextText}`,
  ].filter(Boolean).join("\n");

  const trace: TraceStep[] = [];
  let proposal = await model({ agent: MATERIAL_AGENT, system: MATERIAL_SYSTEM, schema: MaterialProposalSchema, effort: "medium", prompt: `${request}\n\nCrie o material.` });
  let content = finalizeMaterial(toContent(proposal), rules);
  let problems = checkMaterial(content, rules);
  trace.push({ agent: MATERIAL_AGENT, summary: `Propôs "${proposal.title}" com ${content.cards.length} cartões e ${content.activities.length} atividades.` });
  for (let attempt = 0; attempt < MAX_MATERIAL_RETRIES && problems.length; attempt++) {
    proposal = await model({
      agent: MATERIAL_AGENT, system: MATERIAL_SYSTEM, schema: MaterialProposalSchema, effort: "medium",
      prompt: `${request}\n\nSua proposta anterior não passou nas verificações. Corrija:\n${problems.map((item) => `- ${item}`).join("\n")}\n\nProposta anterior:\n${JSON.stringify(proposal)}`,
    });
    content = finalizeMaterial(toContent(proposal), rules);
    problems = checkMaterial(content, rules);
    trace.push({ agent: MATERIAL_AGENT, summary: problems.length ? `Corrigiu a proposta; ficaram ${problems.length} ponto(s) para conferir.` : "Corrigiu a proposta com as verificações." });
  }
  // Toda adaptação precisa de base no perfil: se a IA não trouxe, entram as do perfil.
  if (!content.adaptations.length) content.adaptations = profileAdaptations(input.facts, input.kind);
  content.reviewNotes = problems;
  return { title: proposal.title.trim() || MATERIAL_KIND_LABEL[input.kind], content, trace };
}
