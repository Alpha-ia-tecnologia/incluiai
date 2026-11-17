import { currentTenant, platformDb } from "@/lib/prisma";
import { LOGO_RESPONSE_HEADERS, type Logo } from "@/lib/branding/logo";

export async function GET(request: Request) {
  const tenant = await currentTenant();
  if (tenant.kind !== "municipio" || !tenant.municipality?.logoType) return new Response("Não encontrado.", { status: 404 });
  const row = await platformDb().municipality.findUnique({ where: { id: tenant.municipality.id }, select: { logo: true, logoType: true, updatedAt: true } });
  if (!row?.logo || !row.logoType) return new Response("Não encontrado.", { status: 404 });
  const logo: Logo = { data: Buffer.from(row.logo), type: row.logoType as Logo["type"] };
  const current = new URL(request.url).searchParams.get("v") === String(row.updatedAt.getTime());
  return new Response(new Uint8Array(row.logo), {
    headers: { ...LOGO_RESPONSE_HEADERS(logo), "Cache-Control": current ? "public, max-age=31536000, immutable" : "public, max-age=300" },
  });
}
