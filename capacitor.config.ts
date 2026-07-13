import type { CapacitorConfig } from "@capacitor/cli";

/**
 * TorrijosGolf es una app Next.js renderizada en servidor (DB, auth, server
 * actions), así que no puede exportarse estáticamente. El shell nativo
 * (iOS/Android) carga la web DESPLEGADA por HTTPS.
 *
 * Antes de compilar/sincronizar las apps nativas, configura la URL de producción:
 *   - edita `server.url` abajo, o
 *   - exporta la variable:  CAP_SERVER_URL=https://tu-dominio  (y `npm run cap:sync`)
 */
const SERVER_URL =
  process.env.CAP_SERVER_URL ?? "https://torrijos-golf.vercel.app";

const config: CapacitorConfig = {
  appId: "com.torrijosgolf.app",
  appName: "Torrijos Golf",
  webDir: "capacitor-www",
  server: {
    url: SERVER_URL,
    cleartext: false,
  },
};

export default config;
