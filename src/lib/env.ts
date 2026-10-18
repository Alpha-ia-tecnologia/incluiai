// Chaves de API opcionais: vazias ou com o valor de exemplo do .env
// (ex.: "sk-...") contam como não configuradas.
export function hasApiKey(name: string): boolean {
  const value = process.env[name]?.trim();
  return Boolean(value) && !value!.includes("...");
}

// A DeepSeek processa e guarda dados na China (LGPD): só entra com a chave E a
// ligação explícita DEEPSEEK_ENABLED=1, decidida com o encarregado de dados.
export function isDeepSeekEnabled(): boolean {
  return hasApiKey("DEEPSEEK_API_KEY") && process.env.DEEPSEEK_ENABLED === "1";
}
