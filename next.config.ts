import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake icon imports so the dev compiler doesn't process the whole barrel.
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      // Subida de PDFs de clasificaciones (van en el cuerpo del server action).
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
