import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    // PostCSS/Tailwind roda em worker threads dentro do next-server, e não em
    // processos Node separados. Com processos, o `next dev` chegou a acumular
    // 600–800 workers órfãos (~23 GB) e o OOM killer derrubava o VSCode.
    turbopackPluginRuntimeStrategy: "workerThreads",
    // Cache em disco do Turbopack desligado no dev: crescia ~1 GB a cada poucos
    // minutos (o disco enchia) e restaurar um cache antigo triplicava a memória.
    turbopackFileSystemCacheForDev: false,
    // Laudos anexados ao estudo de caso chegam por Server Action (até 10 MB,
    // conferido de novo na ação) e o envio multipart soma alguns KB.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
