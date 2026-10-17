"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Check, CircleAlert, Expand, LoaderCircle, MessageSquarePlus, Sparkles, Sprout, Trash2, X } from "lucide-react";
import type { ActionView, AssistantEvent, ConversationDetail, ConversationView, MessageView, ToolStep } from "@/lib/assistant/types";
import type { GardenOutcome } from "@/lib/assistant/garden-scenes";
import { ACTION_KIND_LABELS, STEP_DONE_LABELS } from "@/lib/assistant/labels";
import { GardenWait } from "@/components/garden-wait/garden-wait";
import { Markdown } from "./markdown";

// Chat do assistente, usado no popup e na página. A resposta chega por
// eventos: texto, ferramentas em andamento, cartões de confirmação e o fim.

type Live = { text: string; steps: ToolStep[] };
// Referência estável para a faixa de espera não renderizar à toa.
const NO_STEPS: ToolStep[] = [];
const INTERRUPTED = "A conexão caiu antes de a resposta chegar. Ela continua sendo preparada e fica salva nesta conversa.";

type Props = {
  layout: "popup" | "page";
  enabled: boolean;
  suggestions: string[];
  initial: ConversationDetail | null;
  conversations?: ConversationView[];
  studentId?: string | null;
  onClose?: () => void;
  // O popup usa para marcar o botão flutuante enquanto o painel está fechado.
  onActivity?: (activity: "ocupado" | "pronto" | "aviso" | "interrompida") => void;
};

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const formatDay = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
// Erros do navegador (rede, resposta que não é JSON) chegam em inglês: viram o
// aviso em português. As mensagens do servidor passam como estão.
const failure = (caught: unknown, fallback: string) =>
  caught instanceof Error && !(caught instanceof TypeError) && !(caught instanceof SyntaxError) ? caught.message : fallback;

function Steps({ steps, live }: { steps: ToolStep[]; live: boolean }) {
  if (!steps.length) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="O que o assistente consultou">
      {steps.map((step) => {
        const running = live && step.ok === undefined;
        return (
          <li key={step.id} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${step.ok === false ? "bg-coral-soft text-coral" : running ? "bg-sky-soft text-sky-ink" : "bg-surface-muted text-ink-soft"}`}>
            {running ? <Sprout size={12} aria-hidden /> : step.ok === false ? <CircleAlert size={12} aria-hidden /> : <Check size={12} aria-hidden />}
            {running ? step.label : step.ok === false ? `Falhou: ${step.summary ?? step.label}` : STEP_DONE_LABELS[step.name] ?? step.label}
          </li>
        );
      })}
    </ul>
  );
}

function ActionCard({ action, busy, onDecide }: { action: ActionView; busy: boolean; onDecide: (decision: "confirmar" | "cancelar") => void }) {
  const pending = action.status === "pendente";
  return (
    <article className={`my-2 rounded-2xl border p-3.5 ${pending ? "border-brand/40 bg-brand-soft/60" : action.status === "confirmada" ? "border-green/40 bg-green-soft/60" : "border-line bg-surface-muted/60"}`} aria-live="polite">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{ACTION_KIND_LABELS[action.kind] ?? action.kind} · {pending ? "aguardando sua confirmação" : action.status === "confirmada" ? "confirmada" : "cancelada"}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink">{action.summary}</p>
      {pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => onDecide("confirmar")} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60">{busy ? <LoaderCircle size={15} className="animate-spin" aria-hidden /> : <Check size={15} aria-hidden />} Confirmar</button>
          <button type="button" disabled={busy} onClick={() => onDecide("cancelar")} className="inline-flex min-h-10 items-center rounded-full border border-line bg-paper-raised px-4 text-sm text-ink hover:border-ink disabled:opacity-60">Cancelar</button>
        </div>
      ) : action.result ? <div className="mt-2"><Markdown text={action.result} /></div> : null}
    </article>
  );
}

export function AssistantChat({ layout, enabled, suggestions, initial, conversations = [], studentId = null, onClose, onActivity }: Props) {
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationView | null>(initial ? { id: initial.id, title: initial.title, updatedAt: initial.updatedAt } : null);
  const [messages, setMessages] = useState<MessageView[]>(initial?.messages ?? []);
  const [actions, setActions] = useState<ActionView[]>(initial?.actions ?? []);
  const [long, setLong] = useState(initial?.long ?? false);
  const [list, setList] = useState<ConversationView[]>(conversations);
  const [live, setLive] = useState<Live | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [turnEnd, setTurnEnd] = useState<GardenOutcome | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  // O broto da resposta nova cresce uma vez: reabrir o popup não o repete.
  const [settledId, setSettledId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const newConversationRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const announced = useRef("");
  const pinned = useRef(true);
  const longFocus = useRef(false);
  const recheckFocus = useRef(false);
  // Cada leitura de conversa tem um número: se a pessoa começa outra conversa
  // ou envia uma mensagem enquanto ela chega, o resultado velho é descartado.
  const loadSeq = useRef(0);

  // Só desce até o fim quem já estava no fim: quem rolou para cima continua lendo.
  useEffect(() => {
    const element = scrollRef.current;
    if (element && pinned.current) element.scrollTop = element.scrollHeight;
  }, [messages, actions, live]);

  // A faixa de espera muda a altura da conversa; quem está no fim continua no fim.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => { if (pinned.current) element.scrollTop = element.scrollHeight; });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Para onde o foco volta quando algo some da tela: o campo de mensagem ou,
  // se a conversa ficou longa (campo desligado), o botão de nova conversa.
  const focusTarget = useCallback((): HTMLElement | null => {
    const field = inputRef.current;
    return field && !field.disabled ? field : newConversationRef.current;
  }, []);

  // A conversa ficou longa no fim do turno: quem estava no campo passa ao botão.
  useEffect(() => {
    if (!long || !longFocus.current) return;
    longFocus.current = false;
    newConversationRef.current?.focus({ preventScroll: true });
  }, [long]);

  // "Ver se a resposta ficou pronta" some ao recarregar a conversa.
  useEffect(() => {
    if (!recheckFocus.current) return;
    recheckFocus.current = false;
    const focused = document.activeElement;
    if (!focused || focused === document.body) focusTarget()?.focus({ preventScroll: true });
  }, [messages, focusTarget]);

  // Região de status fora da conversa (que fica aria-busy durante o turno).
  const announce = useCallback((text: string) => {
    if (text === announced.current) return;
    announced.current = text;
    if (statusRef.current) statusRef.current.textContent = text;
  }, []);

  const reset = useCallback(() => {
    loadSeq.current++;
    recheckFocus.current = false;
    setLoadingId(null);
    setConversation(null);
    setMessages([]);
    setActions([]);
    setLong(false);
    setError(null);
    announce("");
    pinned.current = true;
    if (layout === "page") window.history.replaceState(null, "", "/assistente");
    // Depois de aplicar o estado: numa conversa longa o campo ainda está desligado.
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [announce, layout]);

  const open = useCallback(async (id: string) => {
    if (live) return;
    const seq = ++loadSeq.current;
    setLoadingId(id);
    try {
      const response = await fetch(`/api/assistente/conversas/${id}`);
      const data = await response.json() as { conversation?: ConversationDetail; error?: string };
      if (seq !== loadSeq.current) return;
      if (!response.ok || !data.conversation) throw new Error(data.error ?? "Conversa não encontrada.");
      const loaded = data.conversation;
      setConversation({ id: loaded.id, title: loaded.title, updatedAt: loaded.updatedAt });
      // Mensagens que já estavam na tela, na mesma posição, mantêm a chave: a
      // região polite da conversa não as anuncia de novo.
      setMessages((current) => loaded.messages.map((message, index) => {
        const shown = current[index];
        return shown && shown.role === message.role && shown.text === message.text ? { ...message, id: shown.id } : message;
      }));
      setActions(loaded.actions);
      setLong(loaded.long);
      setError(null);
      announce("");
      pinned.current = true;
      if (layout === "page") window.history.replaceState(null, "", `/assistente?c=${id}`);
    } catch (caught) {
      if (seq !== loadSeq.current) return;
      recheckFocus.current = false;
      setError(failure(caught, "Não foi possível abrir a conversa."));
    } finally {
      if (seq === loadSeq.current) setLoadingId(null);
    }
  }, [announce, layout, live]);

  const remove = useCallback(async (id: string) => {
    if (!window.confirm("Apagar esta conversa? As ações já confirmadas continuam salvas no acompanhamento.")) return;
    const response = await fetch(`/api/assistente/conversas/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    setList((items) => items.filter((item) => item.id !== id));
    if (conversation?.id === id) reset();
  }, [conversation?.id, reset]);

  const handle = useCallback((event: AssistantEvent) => {
    switch (event.type) {
      case "conversation":
        setConversation(event.conversation);
        setList((items) => (items.some((item) => item.id === event.conversation.id) ? items : [event.conversation, ...items]));
        if (layout === "page") window.history.replaceState(null, "", `/assistente?c=${event.conversation.id}`);
        break;
      case "text":
        setLive((current) => ({ text: (current?.text ?? "") + event.delta, steps: current?.steps ?? [] }));
        break;
      case "tool_start":
        setLive((current) => ({ text: current?.text ?? "", steps: [...(current?.steps ?? []), event.step] }));
        break;
      case "tool_progress":
        setLive((current) => current && { ...current, steps: current.steps.map((step) => (step.id === event.id ? { ...step, progress: [...(step.progress ?? []), event.progress] } : step)) });
        break;
      case "tool_end":
        setLive((current) => ({ text: current?.text ?? "", steps: (current?.steps ?? []).some((step) => step.id === event.step.id) ? (current?.steps ?? []).map((step) => (step.id === event.step.id ? { ...step, ...event.step } : step)) : [...(current?.steps ?? []), event.step] }));
        break;
      case "action":
        setActions((items) => [...items, event.action]);
        break;
      case "done":
        if (event.long && document.activeElement === inputRef.current) longFocus.current = true;
        setMessages((items) => [...items, event.message]);
        setConversation(event.conversation);
        setList((items) => [event.conversation, ...items.filter((item) => item.id !== event.conversation.id)]);
        setLong(event.long);
        setTurnEnd("pronto");
        setFreshId(event.message.id);
        setLive(null);
        onActivity?.("pronto");
        break;
      case "error":
        // Um anúncio só: a mensagem entra na conversa (região polite), sem o
        // alerta do compositor.
        setMessages((items) => [...items, { id: `erro-${Date.now()}`, role: "sistema", text: event.message, steps: [], createdAt: new Date().toISOString() }]);
        setTurnEnd("erro");
        setLive(null);
        onActivity?.("aviso");
        break;
    }
  }, [layout, onActivity]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || live || !enabled) return;
    loadSeq.current++;
    recheckFocus.current = false;
    setLoadingId(null);
    setError(null);
    setInput("");
    setMessages((items) => [...items, { id: `local-${Date.now()}`, role: "usuario", text, steps: [], createdAt: new Date().toISOString() }]);
    setTurnEnd(null);
    setLive({ text: "", steps: [] });
    pinned.current = true;
    onActivity?.("ocupado");
    // Todo turno termina com "done" ou "error". Se a conexão cair depois que o
    // servidor começou, o turno segue lá e fica salvo: é "interrompida", não
    // falha, e não há reenvio (repetiria agentes pagos).
    let ended = false;
    let started = false;
    let turnConversation = conversation?.id ?? null;
    const deliver = (event: AssistantEvent) => {
      if (event.type === "conversation") turnConversation = event.conversation.id;
      if (event.type === "done" || event.type === "error") ended = true;
      handle(event);
    };
    const interrupt = () => {
      ended = true;
      setMessages((items) => [...items, { id: `interrompida-${Date.now()}`, role: "sistema", text: INTERRUPTED, steps: [], createdAt: new Date().toISOString() }]);
      setTurnEnd("interrompida");
      setLive(null);
      onActivity?.("interrompida");
    };
    try {
      const response = await fetch("/api/assistente/turno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, conversationId: conversation?.id ?? null, studentId }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Não foi possível enviar a mensagem.");
      }
      started = true;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const line = chunk.split("\n").find((item) => item.startsWith("data: "));
          if (line) deliver(JSON.parse(line.slice(6)) as AssistantEvent);
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (caught) {
      if (!ended) {
        if (started && turnConversation) interrupt();
        else deliver({ type: "error", message: failure(caught, "Falha na conexão com o assistente.") });
      }
    } finally {
      if (!ended) {
        if (turnConversation) interrupt();
        else deliver({ type: "error", message: "A resposta não chegou. Tente de novo." });
      }
      setLive(null);
      router.refresh();
    }
  }, [conversation?.id, enabled, handle, live, onActivity, router, studentId]);

  const decide = useCallback(async (action: ActionView, decision: "confirmar" | "cancelar") => {
    setBusyAction(action.id);
    try {
      const response = await fetch(`/api/assistente/acoes/${action.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decisao: decision }) });
      const data = await response.json() as { action?: ActionView; error?: string };
      if (data.action) setActions((items) => items.map((item) => (item.id === data.action!.id ? data.action! : item)));
      if (data.error) setError(data.error);
      else if (data.action && data.action.status !== "pendente") router.refresh();
    } catch {
      setError("Não foi possível registrar a decisão. Tente de novo.");
    } finally {
      setBusyAction(null);
    }
  }, [router]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(input);
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  };
  // Enviar pelo teclado (detail 0) leva o foco ao campo de mensagem, que fica
  // só leitura durante o turno: o botão desligado ou a sugestão que some não
  // deixam o foco cair no início da página.
  const keepFocus = (detail: number) => {
    if (detail === 0) inputRef.current?.focus({ preventScroll: true });
  };

  // Cartões de ação logo depois da resposta em que o assistente os preparou.
  const cardsAfter = (message: MessageView, index: number) => {
    if (message.role !== "assistente") return [];
    const previous = messages.slice(0, index).reverse().find((item) => item.role === "assistente");
    return actions.filter((action) => action.createdAt <= message.createdAt && (!previous || action.createdAt > previous.createdAt));
  };
  // Depois de um erro local, a mesma mensagem volta ao campo; a pessoa decide reenviar.
  const retry = () => {
    const lastUser = [...messages].reverse().find((item) => item.role === "usuario");
    if (!lastUser) return;
    setInput(lastUser.text);
    inputRef.current?.focus();
  };
  const lastAssistant = [...messages].reverse().find((item) => item.role === "assistente");
  const cardsPending = actions.filter((action) => !lastAssistant || action.createdAt > lastAssistant.createdAt);
  const empty = messages.length === 0 && !live;
  const lastMessage = messages.at(-1);
  // Conversa aberta com a última mensagem ainda sem resposta (turno em
  // andamento noutra tela, ou consultado cedo demais depois de uma queda).
  const replyMissing = !live && !!conversation && lastMessage?.role === "usuario";
  // Depois de uma queda, enquanto nenhuma resposta chegar, a última mensagem do
  // sistema oferece consultar a resposta em vez de reenviar (ex.: "Aguarde a
  // resposta anterior terminar."): o turno pode ter terminado no servidor, e
  // reenviar repetiria os agentes pagos.
  const dropAt = messages.findLastIndex((message) => message.id.startsWith("interrompida-"));
  const dropOpen = dropAt >= 0 && !messages.slice(dropAt + 1).some((message) => message.role === "assistente");
  const recheck = conversation && !live ? (
    <button
      type="button"
      onClick={() => { if (loadingId) return; recheckFocus.current = true; void open(conversation.id); }}
      aria-disabled={loadingId !== null ? true : undefined}
      className="mt-1 inline-flex min-h-11 items-center rounded-full px-3 font-medium text-brand-strong underline underline-offset-4 hover:bg-paper-raised aria-disabled:opacity-60"
    >
      {loadingId === conversation.id ? "Verificando..." : "Ver se a resposta ficou pronta"}
    </button>
  ) : null;
  const pendingCards = cardsPending.map((action) => <ActionCard key={action.id} action={action} busy={busyAction === action.id} onDecide={(decision) => void decide(action, decision)} />);
  const liveBody = live && (live.text || live.steps.length) ? (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Sparkles size={15} aria-hidden /></span>
      <div className="min-w-0 max-w-[88%] rounded-2xl rounded-tl-md bg-paper-raised px-4 py-3 shadow-e1">
        <Steps steps={live.steps} live />
        {live.text ? <Markdown text={live.text} /> : null}
      </div>
    </div>
  ) : null;

  const thread = (
    <div ref={scrollRef} onScroll={(event) => { const element = event.currentTarget; pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite" aria-busy={!!live}>
      {!enabled ? (
        <div className="rounded-2xl bg-amber-soft p-4 text-sm leading-relaxed text-amber-900">O assistente ainda não está ativo nesta instalação: falta a chave da Anthropic no servidor. Enquanto isso, a <Link href="/ajuda" className="font-medium underline">Ajuda</Link> explica cada tarefa.</div>
      ) : empty ? (
        <div className="flex h-full flex-col justify-end">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Sparkles size={17} aria-hidden /></span>
            <div className="rounded-2xl rounded-tl-md bg-paper-raised px-4 py-3 text-sm leading-relaxed text-ink shadow-e1">
              <p>Olá! Posso tirar dúvidas, consultar o acompanhamento, preparar planos e atividades e registrar aulas com você. O que vamos fazer?</p>
              <p className="mt-1.5 text-xs text-ink-soft">Tudo o que altera o acompanhamento passa por um cartão de confirmação. Os dados chegam à IA sem nomes.</p>
            </div>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Sugestões">
            {suggestions.map((suggestion) => (
              <li key={suggestion}><button type="button" onClick={(event) => { keepFocus(event.detail); void send(suggestion); }} className="min-h-10 rounded-full border border-line bg-paper-raised px-3.5 text-left text-sm text-ink transition-colors hover:border-brand hover:text-brand-strong">{suggestion}</button></li>
            ))}
          </ul>
        </div>
      ) : (
        <ol className="space-y-3">
          {messages.map((message, index) => (
            <li key={message.id}>
              {message.role === "usuario" ? (
                <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand px-4 py-2.5 text-sm leading-relaxed text-white"><p className="whitespace-pre-wrap">{message.text}</p><p className="mt-1 text-right text-[10px] text-white/70">{formatTime(message.createdAt)}</p></div></div>
              ) : message.role === "sistema" ? (
                <div className="mx-auto max-w-[90%] rounded-xl bg-surface-muted px-3 py-2 text-center text-xs leading-relaxed text-ink-soft">
                  <Markdown text={message.text} />
                  {index === messages.length - 1 && message.id.startsWith("erro-") && !live && !dropOpen ? <button type="button" onClick={retry} className="mt-1 inline-flex min-h-11 items-center rounded-full px-3 font-medium text-brand-strong underline underline-offset-4 hover:bg-paper-raised">Usar a mesma mensagem</button> : null}
                  {index === messages.length - 1 && (message.id.startsWith("interrompida-") || dropOpen) ? recheck : null}
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Sparkles size={15} aria-hidden /></span>
                  <div className="min-w-0 max-w-[88%] rounded-2xl rounded-tl-md bg-paper-raised px-4 py-3 shadow-e1">
                    <Steps steps={message.steps} live={false} />
                    <Markdown text={message.text} />
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-ink-soft">{formatTime(message.createdAt)}{message.id === freshId ? <Sprout size={12} className={message.id === settledId ? "text-brand" : "assistant-sprout-mark text-brand"} onAnimationEnd={() => setSettledId(message.id)} aria-hidden /> : null}</p>
                  </div>
                </div>
              )}
              {cardsAfter(message, index).map((action) => <ActionCard key={action.id} action={action} busy={busyAction === action.id} onDecide={(decision) => void decide(action, decision)} />)}
            </li>
          ))}
          {replyMissing ? (
            <li>
              <div className="mx-auto max-w-[90%] rounded-xl bg-surface-muted px-3 py-2 text-center text-xs leading-relaxed text-ink-soft">
                <p>A resposta a esta mensagem ainda não apareceu. Se o assistente ainda estiver trabalhando, ela fica salva aqui.</p>
                {recheck}
              </div>
            </li>
          ) : null}
          {/* Só com conteúdo: um item vazio seria contado pelo leitor de tela. */}
          {liveBody || pendingCards.length ? <li>{liveBody}{pendingCards}</li> : null}
        </ol>
      )}
    </div>
  );

  const garden = (
    <GardenWait
      variant="faixa"
      active={!!live}
      steps={live?.steps ?? NO_STEPS}
      writing={!!live?.text}
      outcome={turnEnd}
      awaiting={actions.filter((action) => action.status === "pendente").length}
      layout={layout}
      announce={announce}
      returnFocusTo={focusTarget}
    />
  );

  const composer = (
    <form onSubmit={submit} className="border-t border-line bg-paper-raised px-3 py-3">
      <p ref={statusRef} role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="espera-status" />
      {error ? <p role="alert" className="mb-2 text-xs text-coral">{error}</p> : null}
      {long ? <p className="mb-2 text-xs text-amber-900">Esta conversa ficou longa. <button ref={newConversationRef} type="button" onClick={reset} className="font-medium underline">Comece uma nova conversa</button> para continuar.</p> : null}
      <div className="flex items-end gap-2">
        {/* Durante o turno o campo fica só leitura (não desligado): o foco de
            quem está nele não se perde e volta a valer quando a resposta chega. */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={keyDown}
          rows={1}
          disabled={!enabled || long}
          readOnly={!!live}
          aria-disabled={live ? true : undefined}
          placeholder={live ? "Aguarde a resposta..." : "Escreva sua mensagem"}
          aria-label="Mensagem para o assistente"
          className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-paper px-3.5 py-2.5 text-sm leading-relaxed text-ink disabled:opacity-60 aria-disabled:opacity-60"
          style={{ height: "auto" }}
          onInput={(event) => { const element = event.currentTarget; element.style.height = "auto"; element.style.height = `${Math.min(160, element.scrollHeight)}px`; }}
        />
        <button type="submit" onClick={(event) => keepFocus(event.detail)} disabled={!enabled || !!live || !input.trim() || long} aria-label="Enviar" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-strong disabled:opacity-50">
          <ArrowUp size={18} aria-hidden />
        </button>
      </div>
      <p className={`mt-2 text-[11px] leading-relaxed text-ink-soft ${live ? "assistant-note-busy" : ""}`}>O assistente propõe; você decide. Confira antes de usar com o estudante.</p>
    </form>
  );

  if (layout === "popup") {
    return (
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-line bg-paper-raised px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Sparkles size={15} aria-hidden /></span>
            <div className="min-w-0"><p className="text-sm font-semibold">Assistente</p><p className="truncate text-[11px] text-ink-soft">{conversation?.title ?? "Nova conversa"}</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={reset} disabled={!!live} aria-label="Nova conversa" title="Nova conversa" className="flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-surface-muted disabled:opacity-50"><MessageSquarePlus size={18} aria-hidden /></button>
            {/* Durante o turno a página inteira mostraria a conversa sem a
                resposta que ainda chega aqui: o link espera o fim. */}
            <Link
              href={conversation ? `/assistente?c=${conversation.id}` : "/assistente"}
              onClick={(event) => { if (live) event.preventDefault(); }}
              aria-disabled={live ? "true" : undefined}
              aria-label="Abrir em página inteira"
              title={live ? "Disponível quando a resposta chegar" : "Abrir em página inteira"}
              className="flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-surface-muted aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              <Expand size={17} aria-hidden />
            </Link>
            <button type="button" onClick={onClose} aria-label="Fechar o assistente" className="flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-surface-muted"><X size={18} aria-hidden /></button>
          </div>
        </header>
        {thread}
        {garden}
        {composer}
      </div>
    );
  }

  return (
    <div className="grid min-h-[calc(100dvh-180px)] gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex flex-col rounded-[22px] bg-surface-muted p-3" aria-label="Conversas">
        <button type="button" onClick={reset} disabled={!!live} className="task-action !min-h-11 !py-2"><MessageSquarePlus size={17} aria-hidden /> Nova conversa</button>
        <ul className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto lg:max-h-none lg:flex-1">
          {list.length === 0 ? <li className="px-2 py-3 text-xs text-ink-soft">Suas conversas aparecem aqui.</li> : null}
          {list.map((item) => (
            <li key={item.id} className="group flex items-center gap-1">
              <button type="button" onClick={() => void open(item.id)} aria-current={conversation?.id === item.id ? "true" : undefined} className="min-w-0 flex-1 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-paper-raised aria-[current=true]:bg-paper-raised aria-[current=true]:font-medium">
                <span className="block truncate">{loadingId === item.id ? "Abrindo..." : item.title}</span>
                <span className="block text-[11px] text-ink-soft">{formatDay(item.updatedAt)}</span>
              </button>
              <button type="button" onClick={() => void remove(item.id)} aria-label={`Apagar a conversa ${item.title}`} className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-soft opacity-0 transition-opacity hover:bg-coral-soft hover:text-coral focus:opacity-100 group-hover:opacity-100"><Trash2 size={15} aria-hidden /></button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="flex min-h-[60vh] flex-col overflow-hidden rounded-[22px] border border-line bg-paper" aria-label="Conversa com o assistente">
        <header className="flex items-center gap-3 border-b border-line bg-paper-raised px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Sparkles size={17} aria-hidden /></span>
          <div className="min-w-0"><h2 className="truncate text-base font-medium">{conversation?.title ?? "Nova conversa"}</h2><p className="text-xs text-ink-soft">Dúvidas, acompanhamento, planos, atividades e registros.</p></div>
        </header>
        {thread}
        {garden}
        {composer}
      </section>
    </div>
  );
}
