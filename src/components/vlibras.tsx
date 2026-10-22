"use client";

import Script from "next/script";
import { useEffect } from "react";
import { requestKind, translationBody, translationText, VLIBRAS_ROOT } from "@/lib/vlibras-core";

// VLibras: o botão de Libras do governo federal em todas as telas. Antes de o
// texto sair para o tradutor, a plataforma troca os dados pessoais
// (/api/libras/anonimizar); se a troca falhar, nada é enviado. Qualquer outro
// envio de dados para fora da plataforma é bloqueado, inclusive a estatística de
// uso do widget (PostHog, nos Estados Unidos).
// NEXT_PUBLIC_VLIBRAS=0 desliga (instalação sem internet).

declare global {
  interface Window {
    VLibras?: { Widget: new (options: { rootPath: string }) => unknown };
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
      }}
    />
  );
}
