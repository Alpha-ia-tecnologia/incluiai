import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { anonymizeForLibras } from "@/lib/libras-anonymize";
import { LIBRAS_MAX_CHARS } from "@/lib/vlibras-core";

// Antes da tradução para Libras (VLibras): devolve o texto sem nomes, documentos,
// datas e contatos. O navegador só envia ao governo o que voltar daqui.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  if (typeof body?.text !== "string") return NextResponse.json({ error: "Envie o texto." }, { status: 400 });
  const text = await anonymizeForLibras(await getCurrentUser(), body.text.slice(0, LIBRAS_MAX_CHARS));
  return NextResponse.json({ text }, { headers: { "Cache-Control": "no-store" } });
}
