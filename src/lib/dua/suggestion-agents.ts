import { z } from "zod/v4";
import type { AgentModel, TraceStep } from "../agents/types.ts";
import { DUA_PIPELINE } from "../agents/descriptors.ts";
import { runReviewedGraph, type ReviewedGraph } from "../agents/reviewed-graph.ts";
import { BlockSchema, checkBlocks, principleEnum, type DuaAiContext, type RawBlock, type RawBlocks } from "./checks.ts";
import { DUA_PRINCIPLES, MAX_AI_BLOCKS, PRINCIPLE_LABEL, type DuaPrinciple } from "./domain.ts";
import { SAFEGUARDS } from "../pedagogy-rules.ts";
import { ANONYMIZED_DATA } from "../agents/prompts.ts";

const MAX_PER_PRINCIPLE = 2;

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

export const DUA_POLICY = `Você apoia professores brasileiros a planejar atividades com o Desenho Universal para a Aprendizagem
(DUA, Diretrizes 3.0 do CAST): engajamento, representação e ação e expressão. Use só o contexto pedagógico recebido.
Refira-se a quem aprende como "o estudante" ou "a turma".

Princípios que valem para tudo o que você escrever:
${SAFEGUARDS}
- ${ANONYMIZED_DATA}

Regras do DUA: não invente falas ou características; não cite deficiência nem reduza a complexidade do objetivo por causa
dela; preserve o objetivo informado pelo professor (se propuser mudança, deixe-a explícita em objectiveConsidered); não
transforme frequência em evidência de aprendizagem. Toda resposta é sugestão para revisão profissional: quem decide é o
professor, bloco a bloco. Alterar a forma de apresentação ou de resposta precisa manter a possibilidade de observar a
habilidade definida.`;

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

Seu papel: ${DUA_PIPELINE.writers[principle]} (${PRINCIPLE_GUIDE[principle]}).
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

export function distributeFoci(analysis: DuaAnalysis, context: DuaAiContext): Record<DuaPrinciple, Focus[]> {
  const known = new Set(context.barriers.map((item) => item.id));
  const clean = analysis.focos.filter((item) => DUA_PRINCIPLES.includes(item.principle) && item.direction?.trim()).map((item) => {
    const valid = Boolean(item.barrierId && known.has(item.barrierId));
    return { ...item, barrierId: valid ? item.barrierId : null, hypothesis: valid ? null : item.hypothesis?.trim() || null };
  });
  const byPrinciple = Object.fromEntries(DUA_PRINCIPLES.map((principle) => [principle, clean.filter((item) => item.principle === principle).slice(0, MAX_PER_PRINCIPLE)])) as Record<DuaPrinciple, Focus[]>;
  for (const principle of DUA_PRINCIPLES) {
    if (byPrinciple[principle].length) continue;
    const barrier = context.barriers[0];
    byPrinciple[principle] = [{
      principle, barrierId: barrier?.id ?? null, hypothesis: null,
      direction: `Oferecer uma opção de ${PRINCIPLE_LABEL[principle].toLowerCase()} para ${context.individual ? "a barreira do apoio individual" : barrier ? "esta barreira" : "a participação de todos na atividade"}.`,
    }];
  }
  for (const principle of [...DUA_PRINCIPLES].reverse()) {
    if (DUA_PRINCIPLES.reduce((total, key) => total + byPrinciple[key].length, 0) <= MAX_AI_BLOCKS) break;
    if (byPrinciple[principle].length > 1) byPrinciple[principle] = byPrinciple[principle].slice(0, 1);
  }
  return byPrinciple;
}

export type DuaAgentsInput = {
  prompt: string;
  context: DuaAiContext;
  people: string[];
  schools: string[];
};

const fociText = (foci: Focus[]) => foci.map((focus, index) => `${index + 1}. ${focus.barrierId ? `Barreira ${focus.barrierId}` : focus.hypothesis ? `Hipótese a verificar: ${focus.hypothesis}` : "Sem barreira registrada"} — ${focus.direction}`).join("\n");

export function checkPrincipleBlocks(principle: DuaPrinciple, blocks: RawBlock[], expected: number, input: Pick<DuaAgentsInput, "context" | "people" | "schools">): string[] {
  const problems: string[] = [];
  if (blocks.length !== expected) problems.push(`Traga um bloco para cada foco recebido (${expected}); vieram ${blocks.length}.`);
  if (blocks.some((block) => !block.principles.includes(principle))) problems.push(`Todo bloco deste especialista inclui o princípio "${principle}".`);
  const checked = checkBlocks({ blocks }, input.context, input.people, input.schools);
  if (checked.blocks.length < Math.min(blocks.length, MAX_AI_BLOCKS)) problems.push("Há bloco sem estratégia concreta.");
  problems.push(...checked.blocks.flatMap((block) => block.flags.problems));
  return [...new Set(problems)];
}

type Prepared = { preserve: string; foci: Record<DuaPrinciple, Focus[]> };

const DUA_GRAPH: ReviewedGraph<DuaAgentsInput, DuaPrinciple, Record<DuaPrinciple, RawBlock[]>, Prepared, string> = {
  pipeline: DUA_PIPELINE,
  parts: DUA_PRINCIPLES,
  prepare: async (input, model) => {
    const analysis = await model({ agent: DUA_PIPELINE.preparer, system: DUA_ANALYST_SYSTEM, schema: DuaAnalysisSchema, effort: "medium", prompt: `${input.prompt}\n\nAnalise o planejamento e distribua os focos.` });
    const foci = distributeFoci(analysis, input.context);
    const total = DUA_PRINCIPLES.reduce((sum, principle) => sum + foci[principle].length, 0);
    return { prepared: { preserve: analysis.preservar.trim(), foci }, summary: `Distribuiu ${total} focos entre os três princípios do DUA.` };
  },
  write: async (principle, { input, prepared, revision }, model) => {
    const response = await model({
      agent: DUA_PIPELINE.writers[principle], system: DUA_SPECIALIST_SYSTEM[principle], schema: DuaBlocksSchema, effort: "medium",
      prompt: `${input.prompt}\n\nO que preservar: ${prepared.preserve || "a habilidade descrita no objetivo."}\n\nFocos de ${PRINCIPLE_LABEL[principle].toLowerCase()}:\n${fociText(prepared.foci[principle])}${revision}\n\nEscreva os blocos.`,
    });
    return { draft: response.blocks, summary: revision ? `Refez ${response.blocks.length} bloco(s) com as correções do revisor.` : `Propôs ${response.blocks.length} bloco(s).` };
  },
  review: async ({ input, prepared, drafts }, model) => {
    const review = await model({
      agent: DUA_PIPELINE.reviewer, system: DUA_REVIEWER_SYSTEM, schema: DuaReviewSchema, effort: "medium",
      prompt: `${input.prompt}\n\nO que preservar: ${prepared.preserve || "a habilidade descrita no objetivo."}\n\nFocos e blocos a revisar:\n${JSON.stringify(DUA_PRINCIPLES.map((principle) => ({ principle, focos: prepared.foci[principle], blocks: drafts[principle] ?? [] })))}`,
    });
    return Object.fromEntries(DUA_PRINCIPLES.map((principle) => [principle, review.avaliacoes.filter((item) => item.principle === principle && !item.aprovado).flatMap((item) => item.problemas).map((item) => item.trim()).filter(Boolean)]));
  },
  check: (principle, blocks, { input, prepared }) => checkPrincipleBlocks(principle, blocks, prepared.foci[principle].length, input),
  partLabel: (principle) => PRINCIPLE_LABEL[principle].toLowerCase(),
  approved: "Não encontrou pontos a corrigir nos blocos dos três princípios.",
};

export type DuaAgentsResult = {
  raw: RawBlocks;
  trace: TraceStep[];
  review: { pending: DuaPrinciple[]; rounds: number };
};

export async function runDuaSuggestionAgents(input: DuaAgentsInput, model: AgentModel): Promise<DuaAgentsResult> {
  const result = await runReviewedGraph(DUA_GRAPH, input, model);
  const foci = result.prepared?.foci;
  if (!foci) throw new Error("Os agentes não concluíram a análise do planejamento.");
  const perPrinciple = DUA_PRINCIPLES.map((principle) => (result.drafts[principle] ?? []).slice(0, Math.max(1, foci[principle].length)).map((block): RawBlock => ({
    ...block,
    principles: block.principles.includes(principle) ? block.principles : [principle, ...block.principles],
    reviewerNotes: result.modelNotes[principle] ?? [],
  })));
  const blocks: RawBlock[] = [];
  for (let index = 0; index < MAX_PER_PRINCIPLE; index++) for (const list of perPrinciple) if (list[index]) blocks.push(list[index]);
  return {
    raw: { blocks: blocks.slice(0, MAX_AI_BLOCKS) },
    trace: result.trace,
    review: { pending: DUA_PRINCIPLES.filter((principle) => result.modelNotes[principle]?.length), rounds: result.rounds },
  };
}
