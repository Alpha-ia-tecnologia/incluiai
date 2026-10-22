// Ao subir o servidor: liga o monitor da janela do Censo (verificações nos horários
// configurados). Fora do build e só no runtime Node.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { startCensusMonitor } = await import("./lib/census-core");
  startCensusMonitor();
}
