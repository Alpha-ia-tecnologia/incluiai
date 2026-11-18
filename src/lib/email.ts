import "server-only";
import nodemailer from "nodemailer";
import { emailSettings } from "./env-config";

export const emailConfigured = () => emailSettings() !== null;

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const settings = emailSettings();
  if (!settings) return false;
  try {
    transport ??= nodemailer.createTransport(settings.smtpUrl);
    await transport.sendMail({ from: settings.from, to, subject, text });
    return true;
  } catch (error) {
    console.warn(`[avisos] e-mail não enviado: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    return false;
  }
}
