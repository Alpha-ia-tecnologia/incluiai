import { totpQrSvg } from "@/lib/two-factor";
import { groupSecret } from "@/lib/totp";
import { SetupFlow } from "@/components/two-factor-forms";

export async function TwoFactorSetup({ secret, account, finish }: { secret: string; account: string; finish: "refresh" | "enter" }) {
  const svg = await totpQrSvg(secret, account);
  return <SetupFlow svg={svg} secret={groupSecret(secret)} account={account} finish={finish} />;
}
