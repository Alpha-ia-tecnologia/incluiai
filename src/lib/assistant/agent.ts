import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../prisma";
import { hasApiKey } from "../env";
import type { SessionUser } from "../auth";
import { describeAgentError } from "../agents/generate";
import { buildSystemPrompt } from "./prompt";
import { buildTools } from "./tools";
import { TOOL_LABELS } from "./labels";
import { loadPseudonymizer, parsePseudonyms } from "./privacy";
import { decidedSinceLastTurn, historyLength, MAX_HISTORY_MESSAGES, toConversationView, toMessageView } from "./store";
import type { AssistantEvent, ToolStep } from "./types";

// Um turno do assistente: a mensagem da pessoa entra anonimizada, o modelo
// usa as ferramentas (laço do SDK, com transmissão) e a resposta volta à tela
// com os nomes restaurados. O histórico enviado ao modelo é guardado como
// está, sem edições: os blocos de raciocínio ficam vinculados à conversa.

export const ASSISTANT_MODEL = process.env.ASSISTANT_MODEL || process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const MAX_ITERATIONS = 8;
const HOLD_BACK = 24;

export function isAssistantEnabled(): boolean {
  return hasApiKey("ANTHROPIC_API_KEY");
}

type History = Anthropic.Beta.Messages.BetaMessageParam[];
let client: Anthropic | null = null;
// Uma resposta por conversa de cada vez: duas ao mesmo tempo corromperiam o histórico.
const busy = new Set<string>();

// Corte seguro do texto transmitido: não parte um marcador ([ESTUDANTE 1])
// nem uma palavra ao meio, para a restauração dos nomes valer no trecho enviado.
export function safeCut(text: string): number {
  if (text.length <= HOLD_BACK) return 0;
  let cut = text.length - HOLD_BACK;
  const space = text.lastIndexOf(" ", cut);
  if (space > 0) cut = space;
  const prefix = text.slice(0, cut);
  const open = prefix.lastIndexOf("[");
  if (open > prefix.lastIndexOf("]")) cut = open;
  const bare = prefix.search(/\b(?:estudante|escola)\s*\d*$/i);
  if (bare >= 0) cut = Math.min(cut, bare);
  return Math.max(0, cut);
}

// Depois do limite de passos, um pedido de ferramenta pode ficar sem resposta;
// o histórico precisa fechá-lo para o próximo turno ser válido.
function closeDanglingToolUses(history: History): History {
  const last = history.at(-1);
  if (!last || last.role !== "assistant" || typeof last.content === "string") return history;
  const pending = last.content.filter((block) => block.type === "tool_use");
  if (!pending.length) return history;
  return [...history, {
    role: "user",
    content: pending.map((block) => ({ type: "tool_result" as const, tool_use_id: block.id, is_error: true, content: "Limite de passos do turno atingido; a ferramenta não foi executada." })),
  }];
}

export async function runAssistantTurn(input: {
  user: SessionUser;
  conversationId?: string | null;
  text: string;
  studentId?: string | null;
  emit: (event: AssistantEvent) => void;
}): Promise<void> {
  const { user, emit } = input;
  const text = input.text.trim().slice(0, 4000);
  if (!text) {
    emit({ type: "error", message: "Escreva uma mensagem." });
    return;
  }
  if (!isAssistantEnabled()) {
    emit({ type: "error", message: "O assistente precisa da chave da Anthropic (ANTHROPIC_API_KEY) configurada no servidor." });
    return;
  }

  const conversation = input.conversationId
    ? await prisma.assistantConversation.findFirst({ where: { id: input.conversationId, userId: user.id } })
    : await prisma.assistantConversation.create({ data: { userId: user.id, title: text.length > 60 ? `${text.slice(0, 57)}...` : text } });
  if (!conversation) {
    emit({ type: "error", message: "Conversa não encontrada." });
    return;
  }
  emit({ type: "conversation", conversation: toConversationView(conversation) });
  if (busy.has(conversation.id)) {
    emit({ type: "error", message: "Aguarde a resposta anterior terminar." });
    return;
  }
  if (historyLength(conversation) >= MAX_HISTORY_MESSAGES) {
    emit({ type: "error", message: "Esta conversa ficou longa. Comece uma nova conversa para continuar." });
    return;
  }
  busy.add(conversation.id);
  const steps: ToolStep[] = [];
  const track = (event: AssistantEvent) => {
    if (event.type === "tool_start") steps.push(event.step);
    if (event.type === "tool_end") {
      const step = steps.find((item) => item.id === event.step.id);
      if (step) Object.assign(step, event.step);
      else steps.push(event.step);
    }
    emit(event);
  };

  try {
    const privacy = await loadPseudonymizer(user, parsePseudonyms(conversation.pseudonyms));
    if (privacy.changed) {
      await prisma.assistantConversation.update({ where: { id: conversation.id }, data: { pseudonyms: JSON.stringify(privacy.map) } });
    }
    await prisma.assistantMessage.create({ data: { conversationId: conversation.id, role: "usuario", text } });

    // Contexto do turno: ações decididas desde a última resposta e a página aberta.
    const notes: string[] = [];
    for (const action of await decidedSinceLastTurn(conversation)) {
      notes.push(`[A pessoa ${action.status === "confirmada" ? "confirmou" : "cancelou"} a ação ${action.kind}${action.result ? `: ${privacy.apply(action.result)}` : ""}]`);
    }
    if (input.studentId && privacy.studentIds.includes(input.studentId)) {
      notes.push(`[Contexto da tela: a pessoa está na página de ${privacy.studentLabel(input.studentId)} (id ${input.studentId}).]`);
    }
    const history: History = JSON.parse(conversation.history);
    const userMessage: Anthropic.Beta.Messages.BetaMessageParam = { role: "user", content: [...notes, privacy.apply(text)].join("\n\n") };

    client ??= new Anthropic();
    const tools = buildTools({ user, privacy, studentIds: privacy.studentIds, conversationId: conversation.id, emit: track });
    let runner = client.beta.messages.toolRunner({
      model: ASSISTANT_MODEL,
      max_tokens: 8000,
      // O raciocínio guardado fica preso às instruções e ferramentas da versão
      // que o produziu. Quando uma conversa atravessa uma atualização da
      // plataforma, drop_block descarta só os blocos que não batem (e avisa em
      // input_transformations) em vez de recusar o pedido com 400. Dentro da
      // mesma versão o histórico só cresce e nada é descartado.
      betas: ["server-side-fallback-2026-07-01", "thinking-binding-controls-2026-08-01"],
      fallbacks: "default",
      thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
      output_config: { effort: "medium" },
      system: [{ type: "text", text: buildSystemPrompt(user.role), cache_control: { type: "ephemeral" } }],
      messages: [...history, userMessage],
      tools,
      stream: true,
      max_iterations: MAX_ITERATIONS,
    });

    const texts: string[] = [];
    let finalNote: string | null = null;
    for (let attempt = 0; ; attempt++) {
      try {
        for await (const stream of runner) {
          let raw = "";
          let sent = 0;
          for await (const event of stream) {
            if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
              track({ type: "tool_start", step: { id: event.content_block.id, name: event.content_block.name, label: TOOL_LABELS[event.content_block.name] ?? event.content_block.name } });
            } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              raw += event.delta.text;
              const cut = safeCut(raw);
              if (cut > sent) {
                emit({ type: "text", delta: privacy.restore(raw.slice(sent, cut)) });
                sent = cut;
              }
            }
          }
          const message = await stream.finalMessage();
          if (raw.length > sent) emit({ type: "text", delta: privacy.restore(raw.slice(sent)) });
          console.info(`[assistente] ${message.model}: ${message.usage.input_tokens} tokens de entrada (${message.usage.cache_read_input_tokens ?? 0} do cache), ${message.usage.output_tokens} de saída`);
          const dropped = (message.input_transformations ?? []).filter((item) => item.type === "thinking_dropped").length;
          if (dropped) console.info(`[assistente] ${dropped} bloco(s) de raciocínio antigo(s) descartado(s): a conversa começou em outra versão das instruções ou das ferramentas.`);
          const messageText = message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
          if (messageText.trim()) texts.push(messageText);
          const hasToolUse = message.content.some((block) => block.type === "tool_use");
          if (message.stop_reason === "refusal") {
            finalNote = "Não posso ajudar com esse pedido.";
            break;
          }
          if (message.stop_reason === "max_tokens" && hasToolUse) {
            finalNote = "A resposta ficou longa demais e foi interrompida. Tente um pedido mais específico.";
            break;
          }
        }
        break;
      } catch (error) {
        if (error instanceof Anthropic.APIError || attempt >= 2) throw error;
        console.error("[assistente] turno refeito após erro de leitura da resposta:", error);
        runner = client.beta.messages.toolRunner({ ...runner.params });
      }
    }

    // Histórico: tudo o que o modelo viu e disse, sem edição. Se o turno foi
    // interrompido antes de o modelo responder, a nota entra como resposta.
    let newHistory: History = [...runner.params.messages];
    if (newHistory.at(-1)?.role !== "assistant" || finalNote) {
      if (newHistory.at(-1)?.role === "assistant") newHistory = closeDanglingToolUses(newHistory);
      if (finalNote) newHistory.push({ role: "assistant", content: finalNote });
    }
    newHistory = closeDanglingToolUses(newHistory);
    if (finalNote) emit({ type: "text", delta: `\n\n${finalNote}` });

    const displayText = privacy.restore([...texts, ...(finalNote ? [finalNote] : [])].join("\n\n")).trim()
      || "Não consegui formular uma resposta. Tente perguntar de outra forma.";
    const [, saved] = await prisma.$transaction([
      prisma.assistantConversation.update({ where: { id: conversation.id }, data: { history: JSON.stringify(newHistory) } }),
      prisma.assistantMessage.create({ data: { conversationId: conversation.id, role: "assistente", text: displayText, steps: steps.length ? JSON.stringify(steps) : null } }),
    ]);
    const updated = await prisma.assistantConversation.findUniqueOrThrow({ where: { id: conversation.id }, select: { id: true, title: true, updatedAt: true } });
    emit({ type: "done", message: toMessageView(saved), conversation: toConversationView(updated), long: newHistory.length >= MAX_HISTORY_MESSAGES });
  } catch (error) {
    console.error("[assistente] turno falhou:", error);
    const reason = describeAgentError(error);
    const message = `Não consegui responder agora (${reason}). Tente de novo em instantes.`;
    await prisma.assistantMessage.create({ data: { conversationId: conversation.id, role: "sistema", text: message } }).catch(() => undefined);
    emit({ type: "error", message });
  } finally {
    busy.delete(conversation.id);
  }
}
