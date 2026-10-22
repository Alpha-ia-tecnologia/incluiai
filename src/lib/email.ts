import "server-only";
import nodemailer from "nodemailer";

// E-mail dos avisos (opcional): SMTP_URL (ex.: smtps://usuario:senha@smtp.prefeitura.gov.br)
// e EMAIL_FROM. Sem configuração, nenhum e-mail sai e a tela de Avisos explica.

export const emailConfigured = () => Boolean(process.env.SMTP_URL?.trim() && process.env.EMAIL_FROM?.trim());

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  try {
    transport ??= nodemailer.createTransport(process.env.SMTP_URL!);
    await transport.sendMail({ from: process.env.EMAIL_FROM, to, subject, text });
    return true;
  } catch (error) {
    // O aviso no portal já foi criado; o e-mail é só um lembrete.
    console.warn(`[avisos] e-mail não enviado: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    return false;
  }
}
