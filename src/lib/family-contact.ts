export type NoticeKind = "material_aprovado" | "relatorio_validado" | "plano_revisado" | "checkin_respondido" | "terapeuta_relatorio";

export function noticeTitle(kind: NoticeKind, firstName: string): string {
  switch (kind) {
    case "material_aprovado": return `Novo material de apoio para usar em casa com ${firstName}`;
    case "relatorio_validado": return `O relatório do período de ${firstName} está disponível`;
    case "plano_revisado": return `A escola revisou o plano de ensino de ${firstName}`;
    case "checkin_respondido": return `A família de ${firstName} respondeu a pergunta da semana`;
    case "terapeuta_relatorio": return `Nova orientação do terapeuta para ${firstName}`;
  }
}

export function noticeEmail(appUrl: string): { subject: string; text: string } {
  const base = appUrl.replace(/\/$/, "");
  return {
    subject: "IncluiEdu: há uma novidade no acompanhamento",
    text: [
      "Olá!",
      "",
      "Há uma novidade no acompanhamento na plataforma IncluiEdu.",
      `Entre para ver: ${base}/avisos`,
      "",
      "Você recebe este e-mail porque escolheu ser avisado. Para parar, desligue em Avisos, na plataforma.",
    ].join("\n"),
  };
}

export const CHECKIN_OPTIONS = [
  "Dormiu bem",
  "Comeu bem",
  "Fez a atividade de casa",
  "Teve uma conquista",
  "Ficou mais calmo(a)",
  "Teve um dia difícil",
  "Teve mudança na rotina",
  "Falou da escola",
] as const;

export function cleanCheckIn(answers: readonly string[], note: string): { answers: string[]; note: string | null } | { error: string } {
  const chosen = [...new Set(answers.map((item) => item.trim()).filter(Boolean))].slice(0, 12).map((item) => item.slice(0, 80));
  const text = note.trim().slice(0, 1000);
  if (!chosen.length && !text) return { error: "Marque pelo menos uma opção ou escreva como foi a semana." };
  return { answers: chosen, note: text || null };
}
