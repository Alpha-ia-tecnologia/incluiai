import { getPlatformUser } from "@/lib/auth";
import { isPlatformArea, platformDb } from "@/lib/prisma";
import { LOGO_RESPONSE_HEADERS, type Logo } from "@/lib/branding/logo";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await isPlatformArea()) || !(await getPlatformUser())) return new Response("Não encontrado.", { status: 404 });
  const row = await platformDb().municipality.findUnique({ where: { slug }, select: { logo: true, logoType: true } });
  if (!row?.logo || !row.logoType) return new Response("Não encontrado.", { status: 404 });
  const logo: Logo = { data: Buffer.from(row.logo), type: row.logoType as Logo["type"] };
  return new Response(new Uint8Array(row.logo), { headers: { ...LOGO_RESPONSE_HEADERS(logo), "Cache-Control": "private, max-age=300" } });
}
