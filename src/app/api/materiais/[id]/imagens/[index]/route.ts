import { prisma } from "@/lib/prisma";
import { canAccessStudent, getCurrentUser } from "@/lib/auth";

// Entrega o pictograma de um cartão do material a quem tem acesso ao estudante,
// do mesmo jeito que a imagem de apoio das atividades.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const cardIndex = Number(index);
  if (!Number.isInteger(cardIndex) || cardIndex < 0) return new Response("Imagem não encontrada", { status: 404 });

  const image = await prisma.materialImage.findUnique({
    where: { materialId_cardIndex: { materialId: id, cardIndex } },
    include: { material: { select: { studentId: true, status: true, student: { select: { schoolId: true } } } } },
  });
  if (!image || !canAccessStudent(user, image.material.student.schoolId, image.material.studentId)) {
    return new Response("Imagem não encontrada", { status: 404 });
  }
  // A família só vê material aprovado pela equipe; o terapeuta não usa materiais.
  if (user.role === "terapeuta" || (user.role === "familia" && image.material.status !== "aprovado")) {
    return new Response("Imagem não encontrada", { status: 404 });
  }
  return new Response(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mimeType, "Cache-Control": "private, max-age=86400" },
  });
}
