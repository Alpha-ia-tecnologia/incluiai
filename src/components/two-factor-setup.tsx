import { totpQrSvg } from "@/lib/two-factor";
import { groupSecret } from "@/lib/totp";
import { SetupFlow } from "@/components/two-factor-forms";

// Ligar as duas etapas: o QR code é desenhado no servidor (nada sai para
// serviço externo) e a tela segue no cliente até a confirmação.
export async function TwoFactorSetup({ secret, account, finish }: { secret: string; account: string; finish: "refresh" | "enter" }) {
  const svg = await totpQrSvg(secret, account);
  return <SetupFlow svg={svg} secret={groupSecret(secret)} account={account} finish={finish} />;
}
