import { getCurrentUser } from "@/lib/auth";
import { IMPORT_TEMPLATE } from "@/lib/student-import";
import { unavailableResponse } from "@/lib/tenant";

export async function GET() {
  const unavailable = await unavailableResponse();
  if (unavailable) return unavailable;
  if (!(await getCurrentUser())) return new Response("Entre na plataforma para baixar o modelo.", { status: 401 });
  return new Response(IMPORT_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modelo-estudantes.csv"',
      "Cache-Control": "no-store",
    },
  });
}
