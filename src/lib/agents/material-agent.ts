import { z } from "zod/v4";
import type { AdaptationRule } from "../rules";
import { ACTIVITY_CONTEXTS, ACTIVITY_STEPS, HOME_MAX_MINUTES, checkActivity, hasClinicalTerm, studentAdaptations, type ActivityContext } from "../pedagogy-rules.ts";
import { CONTEXTS } from "../scale.ts";
import { ACTIVITY_AGENT_SYSTEM, BASE_SYSTEM, adaptationRulesText } from "./prompts.ts";
import type { AgentModel, TraceStep } from "./types.ts";
import { MATERIAL_PIPELINE } from "./descriptors.ts";
import { runReviewedGraph, type ReviewedGraph } from "./reviewed-graph.ts";
import {
  ACCESSIBILITY_BY_KIND, MATERIAL_KINDS, MATERIAL_KIND_LABEL,
  checkMaterialCards, finalizeMaterial, normalizeMaterialContent, profileAdaptations,
  type MaterialContent, type MaterialKind, type ProfileFacts,
} from "../material-content.ts";

type Part = "material" | ActivityContext;
const PARTS: Part[] = ["material", ...ACTIVITY_CONTEXTS];

export const MaterialDesignSchema = z.object({
  title: z.string().describe("Título curto do material, sem nome de pessoa. Ex.: Rotina da hora do lanche"),
  purpose: z.string().describe("Para que serve o material, em uma frase ligada ao perfil, à situação e, se houver, ao objetivo do plano."),
  intro: z.string().describe("Como apresentar o material ao estudante, em 1 ou 2 frases."),
  cards: z.array(z.object({
    label: z.string().describe("Texto do cartão: curto, concreto, no presente (história social em 1ª pessoa)."),
    caption: z.string().nullable().describe("Frase de apoio opcional, para o adulto ou para a família."),
    visual: z.string().describe("Descrição do pictograma deste cartão para um ilustrador: cena ou objeto, sem pedir texto na imagem."),
    alt: z.string().describe("Texto alternativo da imagem, para leitor de tela."),
  })).describe("Os cartões, em ordem, cobrindo a situação do começo ao fim."),
  preparation: z.array(z.string()).describe("De 2 a 4 passos para montar o material: como imprimir e recortar, se plastifica, onde fica durante a situação."),
  howToUse: z.array(z.string()).describe("De 3 a 6 orientações práticas para o professor usar o material."),
  adaptations: z.array(z.object({
    text: z.string().describe("A adaptação feita no material."),
    basis: z.string().describe("O que a justifica: o item do perfil (Ex.: Como aprende: compreende comandos de 1 etapa) ou a regra de adaptação, pelo código."),
  })).describe("De 3 a 6 adaptações deste material, cada uma com a base."),
  accessibility: z.array(z.string()).describe("Recursos de acessibilidade do material."),
  familyTip: z.string().nullable().describe("Uma dica curta para a família usar o material em casa."),
});
export type MaterialDesign = z.infer<typeof MaterialDesignSchema>;

export const MaterialActivitySchema = z.object({
  title: z.string(),
  durationMinutes: z.number().int(),
  goal: z.string().describe("O que se quer desenvolver, ligado ao objetivo do plano quando houver."),
  materials: z.array(z.string()).describe("O material de apoio e o que mais for preciso, priorizando o que a escola ou a família já tem."),
  steps: z.array(z.string()).describe(`De ${ACTIVITY_STEPS.min} a ${ACTIVITY_STEPS.max} passos, uma ação por passo, usando os cartões pelo texto deles.`),
  responseForms: z.array(z.string()).describe("Formas de resposta aceitas, coerentes com a comunicação do estudante."),
  supportBelow: z.string().describe("Degrau de apoio abaixo (mais ajuda), se a atividade ficar difícil."),
  supportTarget: z.string().describe("Apoio previsto para hoje."),
  supportAbove: z.string().describe("Degrau acima (menos ajuda), quando o estudante estiver pronto."),
  successCriterion: z.string().describe("Critério de sucesso numérico e observável."),
  record: z.string().describe("O que observar e registrar depois de aplicar, em uma frase, ligado ao critério de sucesso."),
  planB: z.string().describe("O que fazer em caso de recusa ou desregulação, respeitando o que acalma o estudante."),
  classParticipation: z.string().nullable().describe("Na sala comum: como a turma participa junto. Nos outros contextos, null."),
});
export type MaterialActivityProposal = z.infer<typeof MaterialActivitySchema>;

export const MaterialReviewSchema = z.object({
  avaliacoes: z.array(z.object({
    parte: z.enum(["material", ...ACTIVITY_CONTEXTS]),
    aprovado: z.boolean(),
    problemas: z.array(z.string()).describe("Cada problema com a correção esperada."),
  })).describe("Uma avaliação para cada parte: material, sala_comum, aee e casa."),
});

const KIND_GUIDE: Record<MaterialKind, string> = {
  rotina_visual: "Rotina visual: um cartão por momento da situação, em ordem; o último cartão marca o fim. Antecipe as trocas.",
  sequencia_tarefa: "Passo a passo (análise de tarefa): uma ação observável por cartão, verbo no início, na ordem em que a tarefa é feita.",
  historia_social: "História social: frases curtas em 1ª pessoa, tom tranquilo e positivo, descrevendo a situação, o que os outros fazem e o que o estudante pode fazer. Sem regras punitivas.",
  prancha_caa: "Prancha de comunicação: palavras essenciais para pedir, recusar, pedir ajuda e pausa, mais o vocabulário da situação. Uma palavra ou expressão curta por cartão.",
  quadro_escolhas: "Quadro de escolhas: de 2 a 6 opções visuais equivalentes (como participar, com quem, com qual material, o que fazer primeiro), todas aceitáveis para o professor.",
  regulacao: "Cartões de autorregulação: um termômetro simples de como estou (3 a 4 níveis) e cartões com estratégias de calma concretas, vindas do perfil.",
};

export const MATERIAL_SYSTEM = `${BASE_SYSTEM}

Seu papel: Criador de materiais. Você cria o material de apoio em si, pronto para imprimir: os cartões, como preparar, como apresentar e como usar. As atividades que aplicam o material são feitas depois, por outros agentes, a partir dos seus cartões; por isso os cartões precisam se sustentar sozinhos.
- O material é para a situação pedida e para este estudante, não um modelo genérico: os cartões cobrem a situação do começo ao fim, com o vocabulário e os objetos dela, e usam a comunicação, as etapas de comando, o perfil sensorial, a regulação e os interesses informados.
- Quando houver objetivo do plano, o material existe para apoiar esse objetivo: diga isso no propósito e escolha os cartões pensando nele.
- Siga a estrutura do tipo de material pedido e a quantidade de cartões indicada.
- Cada cartão tem texto curto e uma descrição visual (visual) para um ilustrador desenhar um pictograma: cena ou objeto simples, pessoas genéricas, sem texto escrito na imagem e sem identificar ninguém.
- As regras de adaptação informadas são obrigatórias no material. Cada adaptação diz a base: o item do perfil ou o código da regra. Não invente informação que não veio no contexto.
- Não use nomes: escreva "o estudante". Não mencione diagnóstico.
Quando receber problemas apontados pelo revisor, corrija todos e mantenha o que estava bom.`;

const ACTIVITY_ADDENDUM = `

Nesta tarefa, a atividade serve para aplicar um material de apoio que já foi criado: os cartões vêm no pedido. Use esses cartões nos passos, citando o texto deles; não crie outro material nem mude os cartões. Se houver objetivo do plano, a atividade trabalha esse objetivo com o material; se não houver, liga-se à situação pedida. Em "record", diga o que o adulto observa e registra depois, para a equipe acompanhar o critério de sucesso. Quando o revisor devolver a atividade, corrija todos os pontos e mantenha o que estava bom.`;

export const MATERIAL_ACTIVITY_SYSTEM: Record<ActivityContext, string> = {
  sala_comum: `${ACTIVITY_AGENT_SYSTEM.sala_comum}${ACTIVITY_ADDENDUM}`,
  aee: `${ACTIVITY_AGENT_SYSTEM.aee}${ACTIVITY_ADDENDUM}`,
  casa: `${ACTIVITY_AGENT_SYSTEM.casa}${ACTIVITY_ADDENDUM}`,
};

export const MATERIAL_REVIEWER_SYSTEM = `${BASE_SYSTEM}

Seu papel: Revisor do material de apoio. Você recebe o pedido da professora, o contexto do estudante, as regras de adaptação, o material criado e as três atividades que o aplicam. Avalie cada parte (material, sala_comum, aee, casa) e aprove apenas se ela atende ao que foi pedido.

O material é aprovado quando:
- é do tipo pedido e segue a estrutura desse tipo;
- trata da situação pedida de forma específica, do começo ao fim, e não serviria igual para qualquer outra situação;
- apoia o objetivo do plano, quando há um;
- o texto dos cartões cabe na comunicação e na leitura do estudante, e cada descrição visual mostra uma cena ou objeto, sem texto na imagem;
- respeita as regras de adaptação e os cuidados sensoriais e de regulação do perfil;
- cada adaptação tem base no perfil ou em uma regra, sem informação inventada;
- traz como preparar e como usar de forma que a professora consiga montar e aplicar sem adivinhar.

Cada atividade é aprovada quando:
- usa os cartões do material nos passos, e não um recurso diferente;
- trabalha o objetivo do plano (ou a situação pedida, se não houver objetivo) e tem critério de sucesso numérico e observável, com o que registrar depois;
- a duração cabe no tempo de tarefa e cada passo tem uma ação só;
- as formas de resposta respeitam o canal de comunicação do estudante;
- na sala comum, o estudante faz a mesma aula, com a turma, e a turma participa junto: nada de tarefa separada nem de conteúdo reduzido;
- em casa, dura até ${HOME_MAX_MINUTES} minutos, usa só o que a família já tem e está escrita para quem não é professor;
- é diferente das outras duas no formato.

Em todas as partes: sem linguagem clínica, sem diagnóstico e sem rebaixar a expectativa em vez de remover a barreira.
Para cada problema, diga onde está e a correção esperada. Não aponte preferências de estilo: se a parte atende ao pedido, aprove.`;

export type MaterialAgentInput = {
  kind: MaterialKind;
  topic: string;
  context: ActivityContext;
  contextText: string;
  rules: AdaptationRule[];
  facts: ProfileFacts;
};

const mainContext = (context: ActivityContext) => (context === "sala_comum" ? "sala comum, com a turma" : context === "aee" ? "atendimento educacional especializado (AEE)" : "casa, com a família");

function requestText(input: MaterialAgentInput) {
  const range = MATERIAL_KINDS.find((item) => item.kind === input.kind)!.cards;
  return [
    `## Material pedido\nTipo: ${MATERIAL_KIND_LABEL[input.kind]} (${range[0]} a ${range[1]} cartões). ${KIND_GUIDE[input.kind]}`,
    `Situação ou conteúdo: ${input.topic.trim() || "não informado — escolha uma situação comum da rotina escolar"}.`,
    `Contexto principal de uso: ${mainContext(input.context)}.`,
    `Tempo de tarefa: até ${input.facts.toleranceMinutes} min.`,
    `Recursos de acessibilidade esperados para este tipo: ${ACCESSIBILITY_BY_KIND[input.kind].join("; ")}.`,
    `\n## Regras de adaptação obrigatórias\n${adaptationRulesText(input.rules)}`,
    `\n${input.contextText}`,
  ].join("\n");
}

const toActivity = (context: ActivityContext, proposal: MaterialActivityProposal) => ({ ...proposal, context, classParticipation: proposal.classParticipation ?? undefined });

const cardsText = (design: MaterialDesign) => design.cards.map((card, index) => `${index + 1}. ${card.label}${card.caption ? ` (${card.caption})` : ""}`).join("\n");

function checkDesign(design: MaterialDesign, kind: MaterialKind): string[] {
  const problems = checkMaterialCards(design.cards.map((card) => ({ ...card, caption: card.caption ?? undefined })), kind);
  if (design.adaptations.some((item) => !item.basis.trim())) problems.push("Cada adaptação precisa dizer em que item do perfil ou regra se baseia.");
  if (!design.preparation.length) problems.push("Diga como preparar o material (imprimir, recortar, onde deixar).");
  if (!design.howToUse.length) problems.push("Diga como usar o material.");
  if (hasClinicalTerm(design)) problems.push("Retire linguagem clínica ou menção a diagnóstico.");
  return problems;
}

function checkProposedActivity(context: ActivityContext, proposal: MaterialActivityProposal, toleranceMinutes: number): string[] {
  const problems = checkActivity(toActivity(context, proposal), toleranceMinutes);
  if (!proposal.record.trim()) problems.push("Diga o que observar e registrar depois da atividade.");
  if (hasClinicalTerm(proposal)) problems.push("Retire linguagem clínica ou menção a diagnóstico.");
  return problems;
}

type MaterialInput = { request: string; kind: MaterialKind; toleranceMinutes: number };
type MaterialDrafts = { material: MaterialDesign } & Record<ActivityContext, MaterialActivityProposal>;

const MATERIAL_GRAPH: ReviewedGraph<MaterialInput, Part, MaterialDrafts, null, string> = {
  pipeline: MATERIAL_PIPELINE,
  parts: PARTS,
  lead: { part: "material", redoneNote: "O material foi refeito depois da revisão: ajuste a atividade aos cartões acima." },
  write: async (part, { input, drafts, revision }, model) => {
    if (part === "material") {
      const design = await model({ agent: MATERIAL_PIPELINE.writers.material, system: MATERIAL_SYSTEM, schema: MaterialDesignSchema, effort: "medium", prompt: `${input.request}${revision}\n\nCrie o material.` });
      return {
        draft: design as MaterialDrafts[typeof part],
        summary: revision ? `Refez "${design.title}" com as correções do revisor (${design.cards.length} cartões).` : `Propôs "${design.title}" com ${design.cards.length} cartões.`,
      };
    }
    const context = part as ActivityContext;
    const design = drafts.material!;
    const activity = await model({
      agent: MATERIAL_PIPELINE.writers[context], system: MATERIAL_ACTIVITY_SYSTEM[context], schema: MaterialActivitySchema, effort: "medium",
      prompt: `${input.request}\n\n## Material de apoio a aplicar\n${design.title}: ${design.purpose}\nCartões, em ordem:\n${cardsText(design)}${revision}\n\nCrie a atividade para ${CONTEXTS[context].label.toLowerCase()}.`,
    });
    return { draft: activity as MaterialDrafts[typeof part], summary: revision ? `Refez "${activity.title}" com as correções.` : `Propôs "${activity.title}" para aplicar o material.` };
  },
  review: async ({ input, drafts }, model) => {
    const { material: design, ...activities } = drafts;
    const review = await model({
      agent: MATERIAL_PIPELINE.reviewer, system: MATERIAL_REVIEWER_SYSTEM, schema: MaterialReviewSchema, effort: "medium",
      prompt: `${input.request}\n\n## Material a revisar\n${JSON.stringify(design)}\n\n## Atividades a revisar\n${JSON.stringify(activities)}`,
    });
    return Object.fromEntries(PARTS.map((part) => [part, review.avaliacoes.filter((item) => item.parte === part && !item.aprovado).flatMap((item) => item.problemas)]));
  },
  check: (part, draft, { input }) => (part === "material"
    ? checkDesign(draft as MaterialDesign, input.kind)
    : checkProposedActivity(part as ActivityContext, draft as MaterialActivityProposal, input.toleranceMinutes)),
  partLabel: (part) => (part === "material" ? "o material" : MATERIAL_PIPELINE.writers[part]),
  approved: "Aprovou o material e as três atividades: aderentes ao pedido, ao perfil e às regras.",
  finish: () => "Juntou o material e as atividades, aplicou os limites de tamanho e de tempo e listou as adaptações com a base de cada uma.",
};

const PART_LABEL: Record<Part, string> = { material: "Material", sala_comum: "Atividade da sala comum", aee: "Atividade do AEE", casa: "Atividade de casa" };

export async function runMaterialAgent(input: MaterialAgentInput, model: AgentModel): Promise<{ title: string; content: MaterialContent; trace: TraceStep[] }> {
  const rules = { kind: input.kind, toleranceMinutes: input.facts.toleranceMinutes };
  const result = await runReviewedGraph(MATERIAL_GRAPH, { request: requestText(input), kind: input.kind, toleranceMinutes: input.facts.toleranceMinutes }, model);
  const design = result.drafts.material;
  const order = [input.context, ...ACTIVITY_CONTEXTS.filter((context) => context !== input.context)];
  const activities = order.filter((context) => result.drafts[context]).map((context) => toActivity(context, result.drafts[context]!));
  if (!design || activities.length !== 3) throw new Error("Os agentes não completaram o material e as três atividades.");

  const fromRules = studentAdaptations(input.rules).map((rule) => ({ text: rule.then, basis: `Regra ${rule.id}: ${rule.when}.` }));
  const adaptations = [...design.adaptations.filter((item) => item.text.trim() && item.basis.trim()), ...fromRules];
  const content = finalizeMaterial(normalizeMaterialContent({
    ...design,
    cards: design.cards.map((card) => ({ ...card, caption: card.caption ?? undefined })),
    activities,
    adaptations: adaptations.length ? adaptations : profileAdaptations(input.facts, input.kind),
    familyTip: design.familyTip ?? "",
    reviewNotes: PARTS.flatMap((part) => (result.feedback[part] ?? []).map((problem) => `${PART_LABEL[part]}: ${problem}`)),
  }), rules);
  return { title: design.title.trim() || MATERIAL_KIND_LABEL[input.kind], content, trace: result.trace };
}
