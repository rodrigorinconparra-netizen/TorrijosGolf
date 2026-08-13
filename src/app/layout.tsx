import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Torrijos Golf",
    template: "%s · Torrijos Golf",
  },
  description:
    "La app del Club de Golf Torrijos: clases, escuela, eventos y comunicación con tu profesor.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1f6c5c",
};

/**
 * Aplica el tema (claro/oscuro) antes del primer paint para evitar un flash de
 * color. Lee la preferencia guardada en localStorage; si no hay ninguna, usa
 * modo día (light). "system" sigue la preferencia del sistema operativo.
 */
const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem("torrijos-theme");
    var mode = t === "dark" || t === "light" || t === "system" ? t : "light";
    var dark = mode === "dark" ||
      (mode === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch (_e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${geistSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
