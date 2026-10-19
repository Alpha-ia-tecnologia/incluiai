import { getCurrentUser } from "@/lib/auth";
import { IMPORT_TEMPLATE } from "@/lib/student-import";

// Modelo da planilha de importação (só o cabeçalho e dois exemplos fictícios).
export async function GET() {
  if (!(await getCurrentUser())) return new Response("Entre na plataforma para baixar o modelo.", { status: 401 });
  return new Response(IMPORT_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modelo-estudantes.csv"',
      "Cache-Control": "no-store",
    },
  });
}
