import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Site 100% estático: `next build` gera HTML/JS em out/, sem servidor.
  output: "export",
  // O otimizador de imagens exige runtime, que um export estático não tem.
  images: { unoptimized: true },
};

export default nextConfig;
