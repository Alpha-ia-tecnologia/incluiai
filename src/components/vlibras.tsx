"use client";

import Script from "next/script";
import { useEffect } from "react";
import { requestKind, translationBody, translationText, VLIBRAS_ROOT } from "@/lib/vlibras-core";

// A estatística de uso do widget (PostHog) é enviada para os Estados Unidos.

declare global {
  interface Window {
    VLibras?: { Widget: new (options: { rootPath: string }) => unknown };
    VLibrasWidget?: { access?: HTMLElement };
    incluiLibrasGuard?: boolean;
  }
}

const blocked = (status: number) => new Response(null, { status });

function installGuard() {
  if (window.incluiLibrasGuard) return;
  window.incluiLibrasGuard = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
    const kind = requestKind(url, method, location.origin);
    if (kind === "outro") return original(input, init);
    if (kind === "analytics") return blocked(204);
    if (kind === "bloqueado") return blocked(403);
    const text = translationText(init?.body);
    if (text === null) return blocked(400);
    const response = await original("/api/libras/anonimizar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }).catch(() => null);
    if (!response?.ok) return blocked(503);
    const safe = (await response.json().catch(() => null)) as { text?: unknown } | null;
    if (typeof safe?.text !== "string") return blocked(503);
    return original(typeof input === "string" || input instanceof URL ? input : input.url, { ...init, body: translationBody(safe.text) });
  };
  // A biblioteca de estatística também sabe enviar por XMLHttpRequest e sendBeacon.
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    const target = requestKind(String(url), method, location.origin) === "outro" ? url : "data:,";
    return (open as (...args: unknown[]) => void).call(this, method, target, ...rest);
  } as typeof XMLHttpRequest.prototype.open;
  const beacon = navigator.sendBeacon?.bind(navigator);
  if (beacon) navigator.sendBeacon = (url, data) => (requestKind(String(url), "POST", location.origin) === "outro" ? beacon(url, data) : true);
}

// O botão do widget fica num shadow root com posição própria (meio da altura, à
// direita). O estilo na própria tag vale sobre o do widget e lê variáveis do
// globals.css ("Moldura"): no celular e no tablet o botão vai para o lugar
// reservado na navegação de baixo e não cobre o conteúdo. Sem as variáveis,
// fica onde o widget põe.
function placeButton() {
  const access = window.VLibrasWidget?.access ?? document.getElementById("vlibras-access-wrapper")?.shadowRoot?.getElementById("vlibras-access");
  if (!access) return;
  access.style.setProperty("top", "var(--vlibras-top, calc(50vh - 20px))");
  access.style.setProperty("bottom", "var(--vlibras-bottom, auto)");
  access.style.setProperty("right", "var(--vlibras-right, 10px)");
  access.style.setProperty("transition", "var(--vlibras-transition, all .5s ease)");
}

export function VLibras() {
  useEffect(() => installGuard(), []);
  if (process.env.NEXT_PUBLIC_VLIBRAS === "0") return null;
  return (
    <Script
      src={`${VLIBRAS_ROOT}/vlibras-plugin.js`}
      strategy="afterInteractive"
      onLoad={() => {
        installGuard();
        if (window.VLibras) new window.VLibras.Widget({ rootPath: VLIBRAS_ROOT });
        placeButton();
      }}
    />
  );
}
