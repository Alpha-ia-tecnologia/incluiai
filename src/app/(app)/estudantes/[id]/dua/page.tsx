import { redirect } from "next/navigation";

// Endereço antigo da aba "Atividades com DUA", que agora é uma vista do passo Atividade.
export default async function OldStudentDuaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/estudantes/${id}/atividades/dua`);
}
