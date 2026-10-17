// Chaves de API opcionais: vazias ou com o valor de exemplo do .env
// (ex.: "sk-...") contam como não configuradas.
export function hasApiKey(name: string): boolean {
  const value = process.env[name]?.trim();
  return Boolean(value) && !value!.includes("...");
}
