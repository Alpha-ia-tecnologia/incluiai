import { currentTenant } from "./prisma";

// Nome da rede de ensino no cabeçalho dos documentos impressos (NETWORK_NAME,
// ex.: "Secretaria Municipal de Educação de …"; com vários municípios, o do
// cadastro do município). Sem ele, o cabeçalho sai com a linha em branco para
// preencher à mão.
export async function networkName(): Promise<string | null> {
  const tenant = await currentTenant();
  if (tenant.kind === "municipio") return tenant.municipality?.networkName.trim() || null;
  return process.env.NETWORK_NAME?.trim() || null;
}
