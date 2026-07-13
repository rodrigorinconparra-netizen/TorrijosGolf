import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Torrijos Golf",
    short_name: "Torrijos Golf",
    description:
      "La app del Club de Golf Torrijos: clases, escuela, eventos y comunicación.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7faf8",
    theme_color: "#1f6c5c",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
