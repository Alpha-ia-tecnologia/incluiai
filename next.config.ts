import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    // Foto ou PDF da atividade da turma (até 10 MB) chega por ação de servidor.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
