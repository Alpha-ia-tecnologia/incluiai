export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { tolerateSlowNetwork } = await import("./lib/server-network");
  tolerateSlowNetwork();
  const { startCensusMonitor } = await import("./lib/census-monitor");
  startCensusMonitor();
}
