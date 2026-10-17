"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { Sparkles, X } from "lucide-react";
import type { ConversationDetail } from "@/lib/assistant/types";
import { AssistantChat } from "./assistant-chat";

// Botão flutuante e painel do assistente, presentes em todas as telas. O
// painel continua montado depois da primeira abertura (escondido também na
// página do assistente), para uma resposta em andamento não se perder;
// fechado, usa o atributo hidden (some da tela e da leitura de tela).
// Fechado, o botão mostra se há resposta em preparo (anel vazado), pronta
// (ponto cheio) ou um aviso (losango), também no nome.
type Activity = "livre" | "ocupado" | "pronto" | "aviso" | "interrompida";
const FAB_LABELS: Record<Activity, string> = {
  livre: "Abrir o assistente",
  ocupado: "Abrir o assistente (resposta em preparo)",
  pronto: "Abrir o assistente (resposta pronta)",
  aviso: "Abrir o assistente (a resposta não veio)",
  interrompida: "Abrir o assistente (a conexão caiu)",
};
const FAB_STATUS: Partial<Record<Activity, string>> = {
  pronto: "A resposta do assistente está pronta.",
  aviso: "O assistente não conseguiu responder. Abra o painel para ver o aviso.",
  interrompida: "A conexão com o assistente caiu. Abra o painel para ver se a resposta ficou pronta.",
};

export function AssistantPopup({ enabled, suggestions }: { enabled: boolean; suggestions: string[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [initial, setInitial] = useState<ConversationDetail | null | undefined>(undefined);
  const [activity, setActivity] = useState<Activity>("livre");
  // Com o foco no botão, o nome fica como estava: o status é o único anúncio
  // da mudança (leitores de tela também falam a troca de nome do foco).
  const [heldActivity, setHeldActivity] = useState<Activity | null>(null);
  const openRef = useRef(open);
  const activityRef = useRef(activity);
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const offPage = pathname.startsWith("/assistente") || pathname === "/login";
  const student = pathname.match(/^\/(?:estudantes|familia)\/([^/]+)/)?.[1];
  const studentId = student && student !== "novo" ? student : null;
  // Na página do assistente o painel fecha (sem desmontar): um turno em
  // andamento termina nele e o botão avisa na volta. O botão some sem blur do
  // React, então o nome guardado também é liberado aqui.
  if (offPage && open) setOpen(false);
  if (offPage && heldActivity !== null) setHeldActivity(null);

  // Fechar devolve o foco ao botão, para quem usa teclado não se perder. O
  // nome passa a valer o estado de agora (o foco pode já estar no botão).
  const close = useCallback(() => {
    setHeldActivity(activityRef.current);
    setOpen(false);
    fabRef.current?.focus();
  }, []);

  useEffect(() => {
    openRef.current = open;
    activityRef.current = activity;
  }, [open, activity]);
  // Com o painel aberto a pessoa já vê a resposta: nada a marcar no botão.
  const onActivity = useCallback((next: Exclude<Activity, "livre">) => {
    setActivity(next !== "ocupado" && openRef.current ? "livre" : next);
  }, []);

  useEffect(() => {
    if (!open || initial !== undefined) return;
    fetch("/api/assistente/conversas?ultima=1")
      .then((response) => response.json())
      .then((data: { conversation?: ConversationDetail | null }) => setInitial(data.conversation ?? null))
      .catch(() => setInitial(null));
  }, [open, initial]);

  // Ao abrir, o foco vai para o painel (sem abrir o teclado do celular).
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Um link dentro da conversa leva a outra página: no celular o painel
  // cobriria a página aberta, então fecha; a página inteira do assistente
  // também fecha o painel, para ele não reabrir sozinho na volta.
  const onPanelClick = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest("a");
    const href = link?.getAttribute("href") ?? "";
    if (!href.startsWith("/") || link?.getAttribute("aria-disabled") === "true") return;
    if (href.startsWith("/assistente") || window.matchMedia("(max-width: 1023px)").matches) setOpen(false);
  };

  return (
    <>
      {offPage ? null : (
        <>
          <button
            ref={fabRef}
            type="button"
            onClick={() => {
              setMounted(true);
              setOpen((value) => !value);
              setActivity((value) => (value === "ocupado" ? value : "livre"));
              setHeldActivity(activityRef.current === "ocupado" ? "ocupado" : "livre");
            }}
            onFocus={() => setHeldActivity(activityRef.current)}
            onBlur={() => setHeldActivity(null)}
            aria-expanded={open}
            aria-controls="assistente-painel"
            aria-label={open ? "Fechar o assistente" : FAB_LABELS[heldActivity ?? activity]}
            className="assistant-fab print:hidden"
          >
            {open ? <X size={22} aria-hidden /> : <Sparkles size={22} aria-hidden />}
            <span className="hidden sm:inline">{open ? "Fechar" : "Assistente"}</span>
            {!open && activity !== "livre" ? <span className="assistant-fab-mark" data-activity={activity} aria-hidden="true" /> : null}
          </button>
          <p role="status" className="sr-only">{open ? "" : FAB_STATUS[activity] ?? ""}</p>
        </>
      )}
      {mounted ? (
        <div
          ref={panelRef}
          id="assistente-painel"
          role="dialog"
          aria-label="Assistente IncluiEdu"
          aria-modal="false"
          tabIndex={-1}
          hidden={!open}
          onClick={onPanelClick}
          className="assistant-panel outline-none print:hidden"
        >
          {initial === undefined ? (
            <p className="p-6 text-sm text-ink-soft">Abrindo o assistente...</p>
          ) : (
            <AssistantChat layout="popup" enabled={enabled} suggestions={suggestions} initial={initial} studentId={studentId} onClose={close} onActivity={onActivity} />
          )}
        </div>
      ) : null}
    </>
  );
}
