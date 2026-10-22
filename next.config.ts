import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Pedidos a outros sites (VLibras, fontes) levam só o domínio, nunca o caminho
  // da página, que pode ter o código de um estudante.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] }];
  },
  experimental: {
    // Foto ou PDF da atividade da turma (até 10 MB) chega por ação de servidor.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
