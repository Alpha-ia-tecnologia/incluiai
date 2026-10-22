import { z } from "zod/v4";
import type { AgentAttachment, AgentModel } from "./types";
import { ANSWER_FORMATS, ADAPT_OPTIONS, normalizeAdapted, type AdaptedContent, type LevelKey, type TaskKind } from "../task-adaptation";

// Agente de adaptação (item 1 do plano): lê a foto ou o PDF da atividade da
// turma e adapta a apresentação ao perfil do estudante; no DUA, faz a mesma
// atividade em três níveis. Sempre revisado e aprovado pelo professor.

const itemSchema = z.object({
  prompt: z.string().describe("Enunciado da questão adaptada. Quebras de linha separam as ordens."),
  answerFormat: z.enum(ANSWER_FORMATS as [string, ...string[]]),
  options: z.array(z.string()).describe("Alternativas, quando a resposta for por escolha. Vazio nas demais."),
  support: z.string().describe("Apoio para o professor oferecer nesta questão, em uma frase."),
});
const contentSchema = z.object({
  title: z.string(),
  instructions: z.array(z.string()).describe("Orientações curtas para o estudante, no início da folha."),
  items: z.array(itemSchema),
  teacherNotes: z.array(z.string()).describe("O que mudou em relação ao original e por quê, para o professor conferir."),
  preserved: z.string().describe("O que continua igual ao original (na prova: o que é avaliado)."),
});

const READ_SYSTEM = `Você transcreve atividades e provas escolares fotografadas ou em PDF, para uma professora adaptá-las.
Transcreva o texto como está, na ordem, com a numeração das questões e as alternativas (a), b)...) em linhas próprias.
Não resolva as questões. Não transcreva nomes de pessoas (estudantes, professores): troque por [nome].
Descreva figuras em uma linha entre colchetes, por exemplo [figura: três maçãs].`;

export async function readTaskFile(model: AgentModel, file: AgentAttachment): Promise<{ title: string; text: string }> {
  return model({
    agent: "leitor_de_atividade",
    system: READ_SYSTEM,
    prompt: "Transcreva a atividade do arquivo anexo. No campo title, o título da atividade (ou um título curto que a descreva).",
    schema: z.object({ title: z.string(), text: z.string() }),
    effort: "low",
    attachments: [file],
  });
}

const ADAPT_SYSTEM = `Você adapta atividades e provas escolares para um estudante público da educação especial, com base no perfil de como ele aprende.
Regras:
- Adapte a forma, não o conteúdo avaliado: mesma quantidade de questões, mesmas habilidades, mesmo assunto da turma.
- Não dê a resposta nem simplifique a ponto de a questão deixar de avaliar o que avaliava.
- Use frases curtas e diretas, uma ordem por linha, quando pedido.
- Em "resposta por escolha", troque respostas escritas abertas por 2 a 4 alternativas, com uma correta e distratores plausíveis.
- O apoio de cada questão é para o professor oferecer (ex.: ler junto, fichas, prancha), em uma frase.
- Escreva em português do Brasil, sem nomes de pessoas.`;

const optionText = (options: readonly string[]) => ADAPT_OPTIONS.filter((option) => options.includes(option.key)).map((option) => `- ${option.label}`).join("\n") || "- Apenas organizar a apresentação.";

export async function adaptTaskWithAI(model: AgentModel, input: { title: string; text: string; kind: TaskKind; options: readonly string[]; profile: string; objective: string | null }): Promise<AdaptedContent> {
  const raw = await model({
    agent: "adaptador_de_atividade",
    system: ADAPT_SYSTEM,
    prompt: [
      `## ${input.kind === "prova" ? "Prova" : "Atividade"} da turma: ${input.title}`,
      input.text,
      `\n## Adaptações pedidas\n${optionText(input.options)}`,
      input.objective ? `\n## Objetivo do plano ligado a esta atividade\n${input.objective}` : "",
      `\n## Como o estudante aprende\n${input.profile}`,
    ].filter(Boolean).join("\n"),
    schema: contentSchema,
    effort: "medium",
  });
  return normalizeAdapted(raw as Partial<AdaptedContent>, input.title);
}

const LEVELS_SYSTEM = `Você prepara a mesma atividade da turma em três níveis de complexidade, no planejamento com Desenho Universal para a Aprendizagem (DUA).
- Os três níveis têm o mesmo tema, o mesmo objetivo de aprendizagem e a mesma habilidade.
- "mais_apoio": enunciados curtos, uma ordem por linha, apoios explícitos (exemplos, fichas, escolha entre alternativas).
- "padrao": a atividade como a turma faria, organizada.
- "desafio": a mesma atividade com uma exigência a mais (explicar, justificar, criar).
- Nada na folha diz o nível ao estudante. Escreva em português do Brasil, sem nomes de pessoas.`;

export async function levelsWithAI(model: AgentModel, input: { title: string; text: string; objective: string }): Promise<Record<LevelKey, AdaptedContent>> {
  const raw = await model({
    agent: "niveis_dua",
    system: LEVELS_SYSTEM,
    prompt: `## Objetivo de aprendizagem\n${input.objective}\n\n## Atividade da turma: ${input.title}\n${input.text}`,
    schema: z.object({ mais_apoio: contentSchema, padrao: contentSchema, desafio: contentSchema }),
    effort: "medium",
  });
  const levels = raw as Record<LevelKey, Partial<AdaptedContent>>;
  return {
    mais_apoio: normalizeAdapted(levels.mais_apoio, input.title),
    padrao: normalizeAdapted(levels.padrao, input.title),
    desafio: normalizeAdapted(levels.desafio, input.title),
  };
}
