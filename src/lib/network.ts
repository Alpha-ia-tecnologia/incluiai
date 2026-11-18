import { headers } from "next/headers";
import { currentTenant } from "./prisma";
import { requestHost } from "./tenancy-core";
import { configuredAppUrl, configuredNetworkName, platformDomain } from "./env-config";

// Nome da rede de ensino no cabeçalho dos documentos impressos (NETWORK_NAME,
// ex.: "Secretaria Municipal de Educação de …"; com vários municípios, o do
// cadastro do município). Sem ele, o cabeçalho sai com a linha em branco para
// preencher à mão.
export async function networkName(): Promise<string | null> {
  const tenant = await currentTenant();
  if (tenant.kind === "municipio") return tenant.municipality?.networkName.trim() || null;
  return configuredNetworkName();
}

// Endereço público da plataforma, para os links dos e-mails e o QR da carteirinha:
// APP_URL; sem ele, o do pedido. Com vários municípios, sempre o do pedido (o do município).
export async function publicAddress(): Promise<string> {
  const configured = platformDomain() ? null : configuredAppUrl();
  if (configured) return configured;
  const list = await headers();
  const host = requestHost((name) => list.get(name)) ?? "localhost:3000";
  const local = /^(localhost|127\.|\[::1\])|\.localhost(:\d+)?$/.test(host);
  const protocol = list.get("x-forwarded-proto")?.split(",")[0].trim() || (local ? "http" : "https");
  return `${protocol}://${host}`;
}
