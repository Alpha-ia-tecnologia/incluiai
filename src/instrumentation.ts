// Ao subir o servidor, só no runtime Node e fora do build:
// - conexões de saída mais tolerantes a rede lenta (src/lib/server-network.ts);
// - o monitor da janela do Censo (verificações nos horários configurados).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { tolerateSlowNetwork } = await import("./lib/server-network");
  tolerateSlowNetwork();
  const { startCensusMonitor } = await import("./lib/census-core");
  startCensusMonitor();
}
