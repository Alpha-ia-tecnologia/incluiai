import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod/v4";
import type { AdaptationRule } from "../rules";
import { ACTIVITY_AGENT_SYSTEM, BASE_SYSTEM } from "./prompts.ts";
import { CONTEXT_KEYS, type ActivityContext, type TraceStep } from "./schemas.ts";
import type { AgentModel } from "./types";
import {
  ACCESSIBILITY_BY_KIND, MATERIAL_CONTEXT_LABEL, MATERIAL_KINDS, MATERIAL_KIND_LABEL,
  checkMaterialActivity, checkMaterialCards, finalizeMaterial, hasClinicalLanguage, normalizeMaterialContent, profileAdaptations,
  type MaterialContent, type MaterialContext, type MaterialKind, type ProfileFacts,
} from "../material-content.ts";

// Material de apoio por agentes, orquestrado com LangGraph (como o plano e as
// atividades):
//
//                         ┌→ sala_comum ┐
//   início → criador ─────→ aee ───────→ revisor ─┬─ aprovado ou limite → fim
//               ↑         └→ casa ──────┘         ├─ atividade reprovada → refaz só ela
//               └──────── material reprovado ─────┘   (o material novo refaz as três)
//
// O criador faz o material em si (cartões, preparo, uso, adaptações). Os três
// especialistas de contexto, os mesmos papéis das atividades do plano, criam a
// atividade que aplica os cartões na sala comum, no AEE e em casa (item 17.3,
// Etapa C da proposta). O revisor confere a aderência ao pedido (tipo, situação,
// objetivo), ao perfil, às regras de adaptação e às salvaguardas, e soma as
// verificações de src/lib/material-content.ts. O que continuar pendente depois de
// uma correção vira ponto para o professor conferir. Nada é usado sem aprovação.

export const MATERIAL_AGENT = "Criador de materiais";
export const MATERIAL_REVIEWER = "Revisor do material";
export const MATERIAL_ACTIVITY_AGENTS: Record<ActivityContext, string> = {
  sala_comum: "Agente da sala comum",
  aee: "Agente do AEE",
  casa: "Agente da família",
};
export const MAX_MATERIAL_RETRIES = 1;

type Part = "material" | ActivityContext;
const PARTS: Part[] = ["material", ...CONTEXT_KEYS];

// Sem restrições numéricas nos esquemas (como os demais agentes): os limites são
// aplicados depois, em finalizeMaterial.
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
  steps: z.array(z.string()).describe("De 3 a 6 passos, uma ação por passo, usando os cartões pelo texto deles."),
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
    parte: z.enum(["material", ...CONTEXT_KEYS]),
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
- em casa, dura até 10 minutos, usa só o que a família já tem e está escrita para quem não é professor;
- é diferente das outras duas no formato.

Em todas as partes: sem linguagem clínica, sem diagnóstico e sem rebaixar a expectativa em vez de remover a barreira.
Para cada problema, diga onde está e a correção esperada. Não aponte preferências de estilo: se a parte atende ao pedido, aprove.`;

export type MaterialAgentInput = {
  kind: MaterialKind;
  topic: string;
  context: MaterialContext;
  contextText: string; // estudante, objetivo, perfil, estudo de caso e registros, já sem dados pessoais
  rules: AdaptationRule[];
  facts: ProfileFacts;
};

const MaterialState = Annotation.Root({
  request: Annotation<string>(),
  kind: Annotation<MaterialKind>(),
  toleranceMinutes: Annotation<number>(),
  design: Annotation<MaterialDesign | null>({ reducer: (_current, next) => next, default: () => null }),
  // Os especialistas escrevem em paralelo: cada um acrescenta a sua atividade.
  activities: Annotation<Partial<Record<ActivityContext, MaterialActivityProposal>>>({ reducer: (current, next) => ({ ...current, ...next }), default: () => ({}) }),
  feedback: Annotation<Partial<Record<Part, string[]>>>({ reducer: (_current, next) => next, default: () => ({}) }),
  redo: Annotation<Part[]>({ reducer: (_current, next) => next, default: () => [] }),
  rounds: Annotation<number>({ reducer: (_current, next) => next, default: () => 0 }),
  trace: Annotation<TraceStep[]>({ reducer: (current, next) => current.concat(next), default: () => [] }),
});
type MaterialStateType = typeof MaterialState.State;

const bullets = (items: string[]) => items.map((item) => `- ${item}`).join("\n");
const rulesText = (rules: AdaptationRule[]) => rules.map((rule) => `- [${rule.id}] ${rule.then}`).join("\n") || "- Nenhuma regra específica.";
const mainContext = (context: MaterialContext) => (context === "sala_comum" ? "sala comum, com a turma" : context === "aee" ? "atendimento educacional especializado (AEE)" : "casa, com a família");

// O pedido, igual para todos os agentes: o que a professora pediu, as regras e o contexto.
function requestText(input: MaterialAgentInput) {
  const range = MATERIAL_KINDS.find((item) => item.kind === input.kind)!.cards;
  return [
    `## Material pedido\nTipo: ${MATERIAL_KIND_LABEL[input.kind]} (${range[0]} a ${range[1]} cartões). ${KIND_GUIDE[input.kind]}`,
    `Situação ou conteúdo: ${input.topic.trim() || "não informado — escolha uma situação comum da rotina escolar"}.`,
    `Contexto principal de uso: ${mainContext(input.context)}.`,
    `Tempo de tarefa: até ${input.facts.toleranceMinutes} min.`,
    `Recursos de acessibilidade esperados para este tipo: ${ACCESSIBILITY_BY_KIND[input.kind].join("; ")}.`,
    `\n## Regras de adaptação obrigatórias\n${rulesText(input.rules)}`,
    `\n${input.contextText}`,
  ].join("\n");
}

const toActivity = (context: ActivityContext, proposal: MaterialActivityProposal) => ({ ...proposal, context, classParticipation: proposal.classParticipation ?? undefined });

// Os cartões como as atividades e o revisor precisam ver: texto, sem a descrição do pictograma.
const cardsText = (design: MaterialDesign) => design.cards.map((card, index) => `${index + 1}. ${card.label}${card.caption ? ` (${card.caption})` : ""}`).join("\n");

// Checagens que não dependem do modelo, parte a parte.
export function checkDesign(design: MaterialDesign, kind: MaterialKind): string[] {
  const problems = checkMaterialCards(design.cards.map((card) => ({ ...card, caption: card.caption ?? undefined })), kind);
  if (design.adaptations.some((item) => !item.basis.trim())) problems.push("Cada adaptação precisa dizer em que item do perfil ou regra se baseia.");
  if (!design.preparation.length) problems.push("Diga como preparar o material (imprimir, recortar, onde deixar).");
  if (!design.howToUse.length) problems.push("Diga como usar o material.");
  if (hasClinicalLanguage(design)) problems.push("Retire linguagem clínica ou menção a diagnóstico.");
  return problems;
}

export function checkActivity(context: ActivityContext, proposal: MaterialActivityProposal, toleranceMinutes: number): string[] {
  const problems = checkMaterialActivity(toActivity(context, proposal), toleranceMinutes);
  if (!proposal.record.trim()) problems.push("Diga o que observar e registrar depois da atividade.");
  if (context === "casa" && /\b(compr(ar|e|ado)|loja|papelaria)\b/i.test(proposal.materials.join(" "))) problems.push("Em casa, use apenas objetos que a família já tem, sem compras.");
  if (hasClinicalLanguage(proposal)) problems.push("Retire linguagem clínica ou menção a diagnóstico.");
  return problems;
}

function designAgent(model: AgentModel) {
  return async (state: MaterialStateType) => {
    const feedback = state.feedback.material;
    const revision = feedback?.length && state.design
      ? `\n\nSeu material anterior foi devolvido pelo revisor. Corrija:\n${bullets(feedback)}\n\nMaterial anterior:\n${JSON.stringify(state.design)}`
      : "";
    const design = await model({ agent: MATERIAL_AGENT, system: MATERIAL_SYSTEM, schema: MaterialDesignSchema, effort: "medium", prompt: `${state.request}${revision}\n\nCrie o material.` });
    return {
      design,
      trace: [{ agent: MATERIAL_AGENT, summary: revision ? `Refez "${design.title}" com as correções do revisor (${design.cards.length} cartões).` : `Propôs "${design.title}" com ${design.cards.length} cartões.` }],
    };
  };
}

function activityAgent(model: AgentModel, context: ActivityContext) {
  return async (state: MaterialStateType) => {
    const design = state.design!;
    const previous = state.activities[context];
    const feedback = state.feedback[context] ?? [];
    // Material refeito: a atividade anterior se apoiava em cartões que mudaram.
    const materialChanged = state.redo.includes("material");
    const revision = previous && (feedback.length || materialChanged)
      ? [
        materialChanged ? "\n\nO material foi refeito depois da revisão: ajuste a atividade aos cartões acima." : "",
        feedback.length ? `\n\nSua atividade anterior foi devolvida pelo revisor. Corrija:\n${bullets(feedback)}` : "",
        `\n\nAtividade anterior:\n${JSON.stringify(previous)}`,
      ].join("")
      : "";
    const activity = await model({
      agent: MATERIAL_ACTIVITY_AGENTS[context], system: MATERIAL_ACTIVITY_SYSTEM[context], schema: MaterialActivitySchema, effort: "medium",
      prompt: `${state.request}\n\n## Material de apoio a aplicar\n${design.title}: ${design.purpose}\nCartões, em ordem:\n${cardsText(design)}${revision}\n\nCrie a atividade para ${MATERIAL_CONTEXT_LABEL[context].toLowerCase()}.`,
    });
    return {
      activities: { [context]: activity },
      trace: [{ agent: MATERIAL_ACTIVITY_AGENTS[context], summary: revision ? `Refez "${activity.title}" com as correções.` : `Propôs "${activity.title}" para aplicar o material.` }],
    };
  };
}

function reviewer(model: AgentModel) {
  return async (state: MaterialStateType) => {
    const design = state.design!;
    const review = await model({
      agent: MATERIAL_REVIEWER, system: MATERIAL_REVIEWER_SYSTEM, schema: MaterialReviewSchema, effort: "medium",
      prompt: `${state.request}\n\n## Material a revisar\n${JSON.stringify(design)}\n\n## Atividades a revisar\n${JSON.stringify(state.activities)}`,
    });
    const fromModel = (part: Part) => review.avaliacoes.filter((item) => item.parte === part && !item.aprovado).flatMap((item) => item.problemas);
    const feedback: Partial<Record<Part, string[]>> = {};
    const designProblems = [...fromModel("material"), ...checkDesign(design, state.kind)];
    if (designProblems.length) feedback.material = designProblems;
    for (const context of CONTEXT_KEYS) {
      const activity = state.activities[context];
      if (!activity) continue;
      const problems = [...fromModel(context), ...checkActivity(context, activity, state.toleranceMinutes)];
      if (problems.length) feedback[context] = problems;
    }
    const rejected = PARTS.filter((part) => feedback[part]?.length);
    const canRetry = state.rounds < MAX_MATERIAL_RETRIES;
    const names = rejected.map((part) => (part === "material" ? "o material" : MATERIAL_ACTIVITY_AGENTS[part])).join(", ");
    return {
      feedback,
      redo: canRetry ? rejected : [],
      rounds: state.rounds + 1,
      trace: [{
        agent: MATERIAL_REVIEWER,
        summary: rejected.length === 0
          ? "Aprovou o material e as três atividades: aderentes ao pedido, ao perfil e às regras."
          : canRetry
            ? `Devolveu para correção: ${names}.`
            : `Ainda há pontos a conferir em: ${names}. A professora decide na revisão.`,
      }],
    };
  };
}

export function buildMaterialGraph(model: AgentModel) {
  return new StateGraph(MaterialState)
    .addNode("criador", designAgent(model))
    .addNode("sala_comum", activityAgent(model, "sala_comum"))
    .addNode("aee", activityAgent(model, "aee"))
    .addNode("casa", activityAgent(model, "casa"))
    .addNode("revisor", reviewer(model))
    .addEdge(START, "criador")
    .addEdge("criador", "sala_comum")
    .addEdge("criador", "aee")
    .addEdge("criador", "casa")
    .addEdge("sala_comum", "revisor")
    .addEdge("aee", "revisor")
    .addEdge("casa", "revisor")
    .addConditionalEdges(
      "revisor",
      // Material reprovado volta ao criador (e as três atividades são refeitas com
      // os cartões novos); senão, só as atividades reprovadas são refeitas.
      (state: MaterialStateType) => (!state.redo.length ? END : state.redo.includes("material") ? "criador" : state.redo.filter((part): part is ActivityContext => part !== "material")),
      ["criador", "sala_comum", "aee", "casa", END],
    )
    .compile();
}

const PART_LABEL: Record<Part, string> = { material: "Material", sala_comum: "Atividade da sala comum", aee: "Atividade do AEE", casa: "Atividade de casa" };

export async function runMaterialAgent(input: MaterialAgentInput, model: AgentModel): Promise<{ title: string; content: MaterialContent; trace: TraceStep[] }> {
  const rules = { kind: input.kind, toleranceMinutes: input.facts.toleranceMinutes };
  const result = await buildMaterialGraph(model).invoke({ request: requestText(input), kind: input.kind, toleranceMinutes: input.facts.toleranceMinutes });
  const design = result.design;
  // A atividade do contexto principal do pedido vem primeiro.
  const order = [input.context, ...CONTEXT_KEYS.filter((context) => context !== input.context)];
  const activities = order.filter((context) => result.activities[context]).map((context) => toActivity(context, result.activities[context]!));
  if (!design || activities.length !== 3) throw new Error("Os agentes não completaram o material e as três atividades.");

  // Adaptações rastreáveis (item 17.4): as do material, com a base no perfil, e as
  // regras obrigatórias da plataforma, pelo código. Sem nenhuma, entram as do perfil.
  const fromRules = input.rules.filter((rule) => rule.id !== "R00-ANTISSEGREGACAO").map((rule) => ({ text: rule.then, basis: `Regra ${rule.id}: ${rule.when}.` }));
  const adaptations = [...design.adaptations.filter((item) => item.text.trim() && item.basis.trim()), ...fromRules];
  const content = finalizeMaterial(normalizeMaterialContent({
    ...design,
    cards: design.cards.map((card) => ({ ...card, caption: card.caption ?? undefined })),
    activities,
    adaptations: adaptations.length ? adaptations : profileAdaptations(input.facts, input.kind),
    familyTip: design.familyTip ?? "",
    // O que continuou pendente depois da correção: a professora confere.
    reviewNotes: PARTS.flatMap((part) => (result.feedback[part] ?? []).map((problem) => `${PART_LABEL[part]}: ${problem}`)),
  }), rules);
  const trace = [...result.trace, { agent: "Finalização", summary: "Juntou o material e as atividades, aplicou os limites de tamanho e de tempo e listou as adaptações com a base de cada uma." }];
  return { title: design.title.trim() || MATERIAL_KIND_LABEL[input.kind], content, trace };
}
