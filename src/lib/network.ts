// Nome da rede de ensino no cabeçalho dos documentos impressos (NETWORK_NAME,
// ex.: "Secretaria Municipal de Educação de …"). Sem a variável, o cabeçalho
// sai com a linha em branco para preencher à mão.
export function networkName(): string | null {
  return process.env.NETWORK_NAME?.trim() || null;
}
