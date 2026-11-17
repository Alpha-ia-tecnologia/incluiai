export function hasApiKey(name: string): boolean {
  const value = process.env[name]?.trim();
  return Boolean(value) && !value!.includes("...");
}

// A DeepSeek processa e guarda dados na China (LGPD).
export function isDeepSeekEnabled(): boolean {
  return hasApiKey("DEEPSEEK_API_KEY") && process.env.DEEPSEEK_ENABLED === "1";
}
