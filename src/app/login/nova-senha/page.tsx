import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getCurrentUser, getPendingLogin } from "@/lib/auth";
import { setPasswordAtLogin } from "@/actions/account";
import { LoginStepFrame } from "@/components/login-step-frame";
import { PasswordForm } from "@/components/password-form";

export const dynamic = "force-dynamic";

// Primeiro acesso (ou senha redefinida pela gestão): a senha temporária já foi
// conferida; a pessoa cria a própria antes de entrar.
export default async function NewPasswordPage() {
  if (await getCurrentUser()) redirect("/");
  const pending = await getPendingLogin();
  if (!pending) redirect("/login");
  if (!pending.user.mustChangePassword) redirect("/login/duas-etapas");

  return (
    <LoginStepFrame
      badge="Primeiro acesso"
      icon={<KeyRound size={14} strokeWidth={1.7} aria-hidden="true" />}
      title="Crie a sua senha"
      lede={`A senha temporária de ${pending.user.email} está certa. Agora crie uma senha que só você saiba: ela substitui a temporária.`}
    >
      <PasswordForm action={setPasswordAtLogin} button="Salvar a senha e continuar" pendingLabel="Salvando…" />
    </LoginStepFrame>
  );
}
