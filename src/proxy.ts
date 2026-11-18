import { NextResponse, type NextRequest } from "next/server";
import { PLATFORM_HEADER, TENANT_HEADER, parseHost, requestHost, routeRequest, STATUS_PATH, type HostArea } from "@/lib/tenancy-core";
import { platformDomain } from "@/lib/env-config";
import { findMunicipality } from "@/lib/prisma";

// Navegação de página (documento ou payload RSC do roteador); fetch de API, imagens e ações seguem para a rota.
const isPageRequest = (request: NextRequest) =>
  (request.method === "GET" || request.method === "HEAD")
  && (request.headers.get("rsc") === "1" || (request.headers.get("accept") ?? "").includes("text/html"));

// O destino do redirect fica no endereço público (o do município ou do admin), mesmo
// quando o Next refaz o pedido internamente em localhost; fora da plataforma, o Host.
function publicUrl(request: NextRequest, area: HostArea, path: string): URL {
  const forwarded = area.kind === "neutro" ? null : requestHost((name) => request.headers.get(name));
  const host = forwarded ?? request.headers.get("host") ?? request.nextUrl.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || request.nextUrl.protocol.replace(":", "");
  return new URL(path, `${protocol}://${host}`);
}

export async function proxy(request: NextRequest) {
  const domain = platformDomain();
  const headers = new Headers(request.headers);
  headers.delete(TENANT_HEADER);
  headers.delete(PLATFORM_HEADER);
  if (!domain) {
    const forged = request.headers.has(TENANT_HEADER) || request.headers.has(PLATFORM_HEADER);
    return forged ? NextResponse.next({ request: { headers } }) : NextResponse.next();
  }
  const host = parseHost(requestHost((name) => request.headers.get(name)), domain);
  const decision = routeRequest(host, request.nextUrl.pathname);
  if (decision.action === "redirecionar") return NextResponse.redirect(publicUrl(request, host, decision.path));
  const { area } = decision;
  if (area.kind === "municipio") headers.set(TENANT_HEADER, area.slug);
  if (area.kind === "plataforma") headers.set(PLATFORM_HEADER, "1");
  const unavailable = area.kind === "neutro" || (area.kind === "municipio" && (await findMunicipality(area.slug))?.status !== "ativo");
  // Redireciona, em vez de reescrever: no mesmo endereço, o roteador do Next guardaria
  // no histórico a árvore da página de aviso e, ao recarregar depois da reativação,
  // hidrataria o início com ela.
  if (unavailable && isPageRequest(request) && request.nextUrl.pathname !== STATUS_PATH) {
    return NextResponse.redirect(publicUrl(request, area, STATUS_PATH));
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|__nextjs|favicon\\.ico|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|map|txt|xml|json|webmanifest|woff2?|ttf|otf|mp3|mp4|webm|vtt|wav|flac|pdf)$).*)"],
};
