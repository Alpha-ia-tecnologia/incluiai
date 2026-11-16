// Sugestões do planejamento com DUA por agentes, orquestradas com LangGraph. É o
// mesmo desenho do material de apoio (src/lib/agents/material-agent.ts):
//
//                          ┌→ engajamento ────┐
//   início → analista ─────→ representação ───→ revisor ─┬─ aprovado ou limite → fim
//                          └→ ação e expressão┘    ↑     └─ princípio reprovado → refaz só ele
//
// O analista lê o planejamento e distribui os focos (barreira e lacuna) entre os
// três princípios do DUA. Cada especialista escreve os blocos do seu princípio,
// em paralelo. O revisor confere a aderência ao objetivo, aos critérios e às
// barreiras, e soma as verificações de checks.ts (6.3). O que continuar pendente
// depois de uma correção acompanha o bloco como ponto para o professor conferir.
//
// Puro (sem banco e sem servidor): recebe o contexto já preparado e conferido
// (6.1) e um AgentModel, para rodar com node --test (suggestion-agents.test.mjs).
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod/v4";
import { firstAgentError, type AgentModel } from "../agents/types.ts";
import { checkBlocks, type DuaAiContext, type RawBlock, type RawBlocks } from "./checks.ts";
import { DUA_PRINCIPLES, PRINCIPLE_LABEL, type DuaPrinciple } from "./domain.ts";

export const DUA_ANALYST = "Analista das barreiras";
export const DUA_REVIEWER = "Revisor das sugestões";
export const DUA_SPECIALISTS: Record<DuaPrinciple, string> = {
  engajamento: "Especialista em engajamento",
  representacao: "Especialista em representação",
  acao_expressao: "Especialista em ação e expressão",
};
export const MAX_DUA_RETRIES = 1;
const MAX_BLOCKS = 5; // limite da resposta (6.2)
const MAX_PER_PRINCIPLE = 2;

const principleEnum = z.enum(DUA_PRINCIPLES as unknown as [DuaPrinciple, ...DuaPrinciple[]]);

// ------------------------------------------------------------- estrutura das respostas (6.2)

const BlockSchema = z.object({
  objectiveConsidered: z.string().describe("O objetivo do professor, preservando o sentido. Se propuser mudança, escreva a mudança aqui."),
  barrierId: z.string().nullable().describe("Id de uma barreira recebida, ou null."),
  hypothesis: z.string().nullable().describe("Hipótese a verificar quando a barreira não estiver na lista, ou null."),
  strategy: z.string().describe("Ação concreta e verificável: quais materiais, para qual finalidade, em que momento e como."),
  principles: z.array(principleEnum),
  justification: z.string().describe("Relação entre a estratégia, a barreira e o objetivo."),
  resources: z.array(z.string()).describe("Materiais, organização ou apoios necessários."),
  suggestedEvidence: z.string().describe("O que poderá ser observado durante a atividade, ligado aos critérios."),
  pendingInformation: z.array(z.string()).describe("Dados ou decisões que dependem do professor."),
  criterionProposal: z.string().nullable().describe("Novo critério observável, ou null."),
});
export const DuaBlocksSchema = z.object({ blocks: z.array(BlockSchema).describe("Um bloco para cada foco recebido, na mesma ordem.") });

export const DuaAnalysisSchema = z.object({
  preservar: z.string().describe("O que a atividade precisa continuar permitindo observar (a habilidade do objetivo), em uma frase."),
  focos: z.array(z.object({
    principle: principleEnum,
    barrierId: z.string().nullable().describe("Id de uma barreira recebida, ou null."),
    hypothesis: z.string().nullable().describe("Barreira provável que não está na lista, a verificar; ou null."),
    direction: z.string().describe("A lacuna que a opção deve cobrir neste princípio, sem repetir o que o professor já planejou."),
  })).describe("De 3 a 5 focos, ao menos um por princípio."),
});
export type DuaAnalysis = z.infer<typeof DuaAnalysisSchema>;
type Focus = DuaAnalysis["focos"][number];

export const DuaReviewSchema = z.object({
  avaliacoes: z.array(z.object({
    principle: principleEnum,
    aprovado: z.boolean(),
    problemas: z.array(z.string()).describe("Cada problema diz o bloco e a correção esperada."),
  })).describe("Uma avaliação para cada princípio."),
});

// ------------------------------------------------------------- instruções

export const DUA_POLICY = `Você apoia professores brasileiros a planejar atividades com o Desenho Universal para a Aprendizagem
(DUA, Diretrizes 3.0 do CAST): engajamento, representação e ação e expressão. Use só o contexto pedagógico recebido,
que já vem sem dados pessoais. Refira-se a quem aprende como "o estudante" ou "a turma".
Regras: não invente observações, falas, resultados ou características; não emita diagnóstico clínico nem cite
deficiência; não reduza a complexidade do objetivo por causa de deficiência; preserve o objetivo informado pelo
professor (se propuser mudança, deixe-a explícita em objectiveConsidered); não transforme frequência em evidência de
aprendizagem. Toda resposta é sugestão para revisão profissional: quem decide é o professor, bloco a bloco.
Alterar a forma de apresentação ou de resposta precisa manter a possibilidade de observar a habilidade definida.`;

export const DUA_ANALYST_SYSTEM = `${DUA_POLICY}

Seu papel: Analista das barreiras. Você não escreve as opções: prepara o trabalho de três especialistas, um para cada princípio do DUA.
- Leia o objetivo, os critérios, as barreiras, a organização da atividade, os recursos disponíveis e as opções que o professor já planejou.
- Em "preservar", diga o que a atividade precisa continuar permitindo observar, para nenhuma opção trocar a habilidade por outra mais fácil.
- Em "focos", distribua de 3 a 5 focos, ao menos um por princípio. Cada foco aponta a barreira pelo id recebido e a lacuna que a opção deve cobrir naquele princípio, sem repetir o que já está planejado.
- Cubra as barreiras registradas antes de levantar outra. Barreira que não está na lista entra como hypothesis, com o id nulo: é algo a verificar, nunca uma observação.
- No apoio individual, todos os focos tratam da barreira do apoio e usam apenas os itens do perfil recebidos.`;

const PRINCIPLE_GUIDE: Record<DuaPrinciple, string> = {
  engajamento: "o porquê da aprendizagem: acolher interesses e identidades, sustentar o esforço e a persistência, apoiar a autorregulação. Opções típicas: escolha, relevância, metas claras, colaboração, pausas e retorno sobre o progresso",
  representacao: "o quê da aprendizagem: oferecer mais de uma forma de perceber a informação, apoiar a linguagem e os símbolos, e ajudar a construir o conhecimento. Opções típicas: imagem, áudio, objeto concreto, vocabulário antecipado, organizadores e exemplos",
  acao_expressao: "o como da aprendizagem: variar as formas de agir sobre o material, de se expressar e comunicar, e apoiar o planejamento da tarefa. Opções típicas: mais de uma forma de resposta, ferramentas e tecnologia assistiva, modelos, listas de etapas",
};

export const DUA_SPECIALIST_SYSTEM = Object.fromEntries(DUA_PRINCIPLES.map((principle) => [principle, `${DUA_POLICY}

Seu papel: ${DUA_SPECIALISTS[principle]} (${PRINCIPLE_GUIDE[principle]}).
Você recebe o planejamento, o que a análise mandou preservar e os focos que cabem ao seu princípio. Escreva um bloco para cada foco, na ordem em que vieram.
- A estratégia é uma ação concreta que o professor consegue aplicar sem adivinhar: quais materiais, para qual finalidade, em que momento da atividade e como.
- Use os recursos disponíveis informados. O que depender de algo que a escola pode não ter, ou de uma decisão do professor, vai em pendingInformation.
- A evidência sugerida é algo observável durante a atividade e se liga a um critério do planejamento.
- Em barrierId, repita o id do foco; se o foco for uma hipótese, mantenha-a em hypothesis.
- principles inclui "${principle}"; acrescente outro princípio só se a opção de fato o atender.
- Não repita o que o professor já planejou.
Quando o revisor devolver seus blocos, corrija todos os pontos e mantenha o que estava bom.`])) as Record<DuaPrinciple, string>;

export const DUA_REVIEWER_SYSTEM = `${DUA_POLICY}

Seu papel: Revisor das sugestões. Você recebe o planejamento, a análise e os blocos de cada princípio. Avalie princípio por princípio e aprove apenas se os blocos:
- respondem ao foco e à barreira indicada, ou deixam claro que a barreira é uma hipótese a verificar;
- preservam o objetivo e o que a análise mandou preservar, sem reduzir a complexidade;
- trazem estratégia concreta: materiais, finalidade, momento e como fazer;
- sugerem evidência observável durante a atividade, ligada a um critério do planejamento;
- não repetem opções já planejadas nem os blocos dos outros princípios;
- usam os recursos disponíveis ou apontam a pendência;
- não afirmam observações, falas ou resultados que não vieram no contexto;
- no apoio individual, usam apenas os itens do perfil recebidos.
Sua avaliação apoia a revisão do professor e não a substitui. Para cada problema, diga o bloco e a correção esperada. Não aponte preferências de estilo: se os blocos atendem ao planejamento, aprove.`;

// ------------------------------------------------------------- focos

// Ajusta o que o analista trouxe, sem confiar no modelo: barreira inexistente
// vira hipótese, cada princípio fica com 1 ou 2 focos e o total cabe na resposta.
export function distributeFoci(analysis: DuaAnalysis, context: DuaAiContext): Record<DuaPrinciple, Focus[]> {
  const known = new Set(context.barriers.map((item) => item.id));
  const clean = analysis.focos.filter((item) => DUA_PRINCIPLES.includes(item.principle) && item.direction?.trim()).map((item) => {
    const valid = Boolean(item.barrierId && known.has(item.barrierId));
    return { ...item, barrierId: valid ? item.barrierId : null, hypothesis: valid ? null : item.hypothesis?.trim() || null };
  });
  const byPrinciple = Object.fromEntries(DUA_PRINCIPLES.map((principle) => [principle, clean.filter((item) => item.principle === principle).slice(0, MAX_PER_PRINCIPLE)])) as Record<DuaPrinciple, Focus[]>;
  for (const principle of DUA_PRINCIPLES) {
    if (byPrinciple[principle].length) continue;
    // Princípio sem foco: recebe a primeira barreira do planejamento (ou a do apoio individual).
    const barrier = context.barriers[0];
    byPrinciple[principle] = [{
      principle, barrierId: barrier?.id ?? null, hypothesis: null,
      direction: `Oferecer uma opção de ${PRINCIPLE_LABEL[principle].toLowerCase()} para ${context.individual ? "a barreira do apoio individual" : barrier ? "esta barreira" : "a participação de todos na atividade"}.`,
    }];
  }
  // Total acima do limite: sai o segundo foco, do último princípio para o primeiro.
  for (const principle of [...DUA_PRINCIPLES].reverse()) {
    if (DUA_PRINCIPLES.reduce((total, key) => total + byPrinciple[key].length, 0) <= MAX_BLOCKS) break;
    if (byPrinciple[principle].length > 1) byPrinciple[principle] = byPrinciple[principle].slice(0, 1);
  }
  return byPrinciple;
}

// ------------------------------------------------------------- grafo

export type DuaAgentsInput = {
  prompt: string; // contexto pedagógico já anonimizado e conferido (prepareContext)
  context: DuaAiContext; // o mesmo contexto, para as verificações da plataforma
  people: string[];
  schools: string[];
};
export type DuaTraceStep = { agent: string; summary: string };

const DuaState = Annotation.Root({
  prompt: Annotation<string>(),
  context: Annotation<DuaAiContext>(),
  people: Annotation<string[]>(),
  schools: Annotation<string[]>(),
  preserve: Annotation<string>({ reducer: (_current, next) => next, default: () => "" }),
  foci: Annotation<Record<DuaPrinciple, Focus[]> | null>({ reducer: (_current, next) => next, default: () => null }),
  // Os especialistas escrevem em paralelo: cada um acrescenta os seus blocos.
  blocks: Annotation<Partial<Record<DuaPrinciple, RawBlock[]>>>({ reducer: (current, next) => ({ ...current, ...next }), default: () => ({}) }),
  feedback: Annotation<Partial<Record<DuaPrinciple, string[]>>>({ reducer: (_current, next) => next, default: () => ({}) }),
  // Só o que o revisor (modelo) apontou: as verificações da plataforma são refeitas no fim.
  reviewerNotes: Annotation<Partial<Record<DuaPrinciple, string[]>>>({ reducer: (_current, next) => next, default: () => ({}) }),
  redo: Annotation<DuaPrinciple[]>({ reducer: (_current, next) => next, default: () => [] }),
  rounds: Annotation<number>({ reducer: (_current, next) => next, default: () => 0 }),
  trace: Annotation<DuaTraceStep[]>({ reducer: (current, next) => current.concat(next), default: () => [] }),
});
type DuaStateType = typeof DuaState.State;

const bullets = (items: string[]) => items.map((item) => `- ${item}`).join("\n");
const fociText = (foci: Focus[]) => foci.map((focus, index) => `${index + 1}. ${focus.barrierId ? `Barreira ${focus.barrierId}` : focus.hypothesis ? `Hipótese a verificar: ${focus.hypothesis}` : "Sem barreira registrada"} — ${focus.direction}`).join("\n");

// Verificações que não dependem do modelo, por princípio.
export function checkPrincipleBlocks(principle: DuaPrinciple, blocks: RawBlock[], expected: number, input: Pick<DuaAgentsInput, "context" | "people" | "schools">): string[] {
  const problems: string[] = [];
  if (blocks.length !== expected) problems.push(`Traga um bloco para cada foco recebido (${expected}); vieram ${blocks.length}.`);
  if (blocks.some((block) => !block.principles.includes(principle))) problems.push(`Todo bloco deste especialista inclui o princípio "${principle}".`);
  const checked = checkBlocks({ blocks }, input.context, input.people, input.schools);
  if (checked.blocks.length < Math.min(blocks.length, MAX_BLOCKS)) problems.push("Há bloco sem estratégia concreta.");
  problems.push(...checked.blocks.flatMap((block) => block.flags.problems));
  return [...new Set(problems)];
}

function analyst(model: AgentModel) {
  return async (state: DuaStateType) => {
    const analysis = await model({ agent: DUA_ANALYST, system: DUA_ANALYST_SYSTEM, schema: DuaAnalysisSchema, effort: "medium", prompt: `${state.prompt}\n\nAnalise o planejamento e distribua os focos.` });
    const foci = distributeFoci(analysis, state.context);
    const total = DUA_PRINCIPLES.reduce((sum, principle) => sum + foci[principle].length, 0);
    return { preserve: analysis.preservar.trim(), foci, trace: [{ agent: DUA_ANALYST, summary: `Distribuiu ${total} focos entre os três princípios do DUA.` }] };
  };
}

function specialist(model: AgentModel, principle: DuaPrinciple) {
  return async (state: DuaStateType) => {
    const foci = state.foci![principle];
    const previous = state.blocks[principle];
    const feedback = state.feedback[principle];
    const revision = feedback?.length && previous
      ? `\n\nSeus blocos anteriores foram devolvidos pelo revisor. Corrija:\n${bullets(feedback)}\n\nBlocos anteriores:\n${JSON.stringify(previous)}`
      : "";
    const response = await model({
      agent: DUA_SPECIALISTS[principle], system: DUA_SPECIALIST_SYSTEM[principle], schema: DuaBlocksSchema, effort: "medium",
      prompt: `${state.prompt}\n\nO que preservar: ${state.preserve || "a habilidade descrita no objetivo."}\n\nFocos de ${PRINCIPLE_LABEL[principle].toLowerCase()}:\n${fociText(foci)}${revision}\n\nEscreva os blocos.`,
    });
    return {
      blocks: { [principle]: response.blocks },
      trace: [{ agent: DUA_SPECIALISTS[principle], summary: revision ? `Refez ${response.blocks.length} bloco(s) com as correções do revisor.` : `Propôs ${response.blocks.length} bloco(s).` }],
    };
  };
}

function reviewer(model: AgentModel) {
  return async (state: DuaStateType) => {
    const review = await model({
      agent: DUA_REVIEWER, system: DUA_REVIEWER_SYSTEM, schema: DuaReviewSchema, effort: "medium",
      prompt: `${state.prompt}\n\nO que preservar: ${state.preserve || "a habilidade descrita no objetivo."}\n\nFocos e blocos a revisar:\n${JSON.stringify(DUA_PRINCIPLES.map((principle) => ({ principle, focos: state.foci![principle], blocks: state.blocks[principle] ?? [] })))}`,
    });
    const feedback: Partial<Record<DuaPrinciple, string[]>> = {};
    const reviewerNotes: Partial<Record<DuaPrinciple, string[]>> = {};
    for (const principle of DUA_PRINCIPLES) {
      const fromModel = review.avaliacoes.filter((item) => item.principle === principle && !item.aprovado).flatMap((item) => item.problemas).map((item) => item.trim()).filter(Boolean);
      const problems = [...fromModel, ...checkPrincipleBlocks(principle, state.blocks[principle] ?? [], state.foci![principle].length, state)];
      if (fromModel.length) reviewerNotes[principle] = fromModel;
      if (problems.length) feedback[principle] = problems;
    }
    const rejected = DUA_PRINCIPLES.filter((principle) => feedback[principle]?.length);
    const canRetry = state.rounds < MAX_DUA_RETRIES;
    const names = rejected.map((principle) => PRINCIPLE_LABEL[principle].toLowerCase()).join(", ");
    return {
      feedback,
      reviewerNotes,
      redo: canRetry ? rejected : [],
      rounds: state.rounds + 1,
      trace: [{
        agent: DUA_REVIEWER,
        summary: rejected.length === 0
          ? "Não encontrou pontos a corrigir nos blocos dos três princípios."
          : canRetry
            ? `Devolveu para correção: ${names}.`
            : `Ainda há pontos a conferir em: ${names}.`,
      }],
    };
  };
}

export function buildDuaSuggestionGraph(model: AgentModel) {
  return new StateGraph(DuaState)
    .addNode("analista", analyst(model))
    .addNode("engajamento", specialist(model, "engajamento"))
    .addNode("representacao", specialist(model, "representacao"))
    .addNode("acao_expressao", specialist(model, "acao_expressao"))
    .addNode("revisor", reviewer(model))
    .addEdge(START, "analista")
    .addEdge("analista", "engajamento")
    .addEdge("analista", "representacao")
    .addEdge("analista", "acao_expressao")
    .addEdge("engajamento", "revisor")
    .addEdge("representacao", "revisor")
    .addEdge("acao_expressao", "revisor")
    .addConditionalEdges("revisor", (state: DuaStateType) => (state.redo.length ? state.redo : END), ["engajamento", "representacao", "acao_expressao", END])
    .compile();
}

export type DuaAgentsResult = {
  raw: RawBlocks;
  trace: DuaTraceStep[];
  // Resultado do revisor depois da última rodada, para as verificações da sugestão.
  review: { pending: DuaPrinciple[]; rounds: number };
};

export async function runDuaSuggestionAgents(input: DuaAgentsInput, model: AgentModel): Promise<DuaAgentsResult> {
  const result = await buildDuaSuggestionGraph(model).invoke(input).catch((error: unknown) => { throw firstAgentError(error); });
  if (!result.foci) throw new Error("Os agentes não concluíram a análise do planejamento.");
  // Cada princípio fica com os blocos dos seus focos; o que o revisor ainda apontou acompanha o bloco.
  const perPrinciple = DUA_PRINCIPLES.map((principle) => (result.blocks[principle] ?? []).slice(0, Math.max(1, result.foci![principle].length)).map((block): RawBlock => ({
    ...block,
    principles: block.principles.includes(principle) ? block.principles : [principle, ...block.principles],
    reviewerNotes: result.reviewerNotes[principle] ?? [],
  })));
  // Intercalados, para a resposta começar com um bloco de cada princípio.
  const blocks: RawBlock[] = [];
  for (let index = 0; index < MAX_PER_PRINCIPLE; index++) for (const list of perPrinciple) if (list[index]) blocks.push(list[index]);
  return {
    raw: { blocks: blocks.slice(0, MAX_BLOCKS) },
    trace: result.trace,
    review: { pending: DUA_PRINCIPLES.filter((principle) => result.reviewerNotes[principle]?.length), rounds: result.rounds },
  };
}
