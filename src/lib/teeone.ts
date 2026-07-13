import "server-only";

/**
 * Integración con teeone.golf — el sistema con el que el club gestiona las
 * reservas de pista.
 *
 * Modelo de API descubierto desde el propio front-end de `reservas.teeone.golf`:
 *   - Base:  https://api.teeone.golf/InternalRepwin/v2   (dev: devapi.teeone.golf)
 *   - Login: POST /Acceso/ObtenerToken  (form-urlencoded)
 *            body: usuarioNombre=<usuario>&usuarioClave=<clave>&cultura=es-ES
 *            → { cod:1, token, idBBDD, ... }   (cod 1 = OK)
 *   - Salidas/disponibilidad del día: /Salidas, /DisponibilidadFromCuadrante, …
 *   - El `token` (+ idBBDD) se envían en las llamadas siguientes.
 *
 * ⚠️  Es la API interna ("InternalRepwin"), no la "API abierta" documentada.
 *   Funciona replicando el login de la web de reservas, pero:
 *     · teeone puede restringir por IP (endpoint Acceso/ComprobarIP) → habría que
 *       pedirles que autoricen la IP del servidor.
 *     · el formato exacto de la respuesta de /Salidas hay que confirmarlo con una
 *       llamada real y ajustar `normalizeTeeSheet` (abajo).
 *   Lo ideal sigue siendo pedir a teeone acceso oficial a su API.
 *
 * Config por entorno (no-op si falta → la sección "Pista" muestra "no configurado"):
 *   TEEONE_BASE_URL          (por defecto https://api.teeone.golf/InternalRepwin/v2)
 *   TEEONE_USER              tu usuario de teeone (el de reservas.teeone.golf)
 *   TEEONE_PASS              tu contraseña de teeone
 *   TEEONE_SALIDAS_PATH      ruta del tee-sheet, admite {date} (por defecto "/Salidas?fecha={date}")
 *   TEEONE_TOKEN_PARAM       cómo se manda el token: "header" o "query" (por defecto "header")
 *   TEEONE_TOKEN_HEADER      nombre de cabecera del token (por defecto "token")
 */

export interface TeeSlot {
  time: string;
  status: "libre" | "ocupado" | "parcial";
  available: number | null;
  capacity: number | null;
  players?: string[];
}

export interface TeeSheet {
  configured: boolean;
  error?: string;
  date: string;
  slots: TeeSlot[];
}

interface TeeoneConfig {
  baseUrl: string;
  user: string;
  pass: string;
  salidasPath: string;
  tokenParam: "header" | "query";
  tokenHeader: string;
}

function config(): TeeoneConfig | null {
  const user = process.env.TEEONE_USER;
  const pass = process.env.TEEONE_PASS;
  if (!user || !pass) return null;
  return {
    baseUrl: (
      process.env.TEEONE_BASE_URL || "https://api.teeone.golf/InternalRepwin/v2"
    ).replace(/\/$/, ""),
    user,
    pass,
    salidasPath: process.env.TEEONE_SALIDAS_PATH || "/Salidas?fecha={date}",
    tokenParam: process.env.TEEONE_TOKEN_PARAM === "query" ? "query" : "header",
    tokenHeader: process.env.TEEONE_TOKEN_HEADER || "token",
  };
}

export function isTeeoneConfigured(): boolean {
  return config() != null;
}

/* --- Token cacheado en memoria del proceso (login perezoso) --- */
let cachedToken: { value: string; idBBDD?: string; exp: number } | null = null;

async function getToken(cfg: TeeoneConfig): Promise<{ token: string; idBBDD?: string } | null> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) {
    return { token: cachedToken.value, idBBDD: cachedToken.idBBDD };
  }
  const body = `usuarioNombre=${encodeURIComponent(cfg.user)}&usuarioClave=${encodeURIComponent(
    cfg.pass,
  )}&cultura=es-ES`;
  const res = await fetch(`${cfg.baseUrl}/Acceso/ObtenerToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    cod?: number;
    token?: string;
    idBBDD?: string;
  };
  if (data.cod !== 1 || !data.token) return null;
  // Sin fecha de expiración fiable: cacheamos 30 min y renovamos.
  cachedToken = { value: data.token, idBBDD: data.idBBDD, exp: Date.now() + 30 * 60_000 };
  return { token: data.token, idBBDD: data.idBBDD };
}

/**
 * Normaliza la respuesta de /Salidas a `TeeSlot[]`.
 * ⚠️  AJUSTAR con una respuesta real: los nombres de campo de teeone pueden
 * diferir. Es tolerante con las formas más habituales.
 */
export function normalizeTeeSheet(raw: unknown): TeeSlot[] {
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { salidas?: unknown[] })?.salidas)
      ? (raw as { salidas: unknown[] }).salidas
      : Array.isArray((raw as { data?: unknown[] })?.data)
        ? (raw as { data: unknown[] }).data
        : Array.isArray((raw as { result?: unknown[] })?.result)
          ? (raw as { result: unknown[] }).result
          : [];

  return arr
    .map((item): TeeSlot | null => {
      const o = item as Record<string, unknown>;
      const time = String(
        o.hora ?? o.time ?? o.horaSalida ?? o.start ?? "",
      ).slice(0, 5);
      if (!time) return null;
      const capacity = numberOrNull(o.plazas ?? o.capacity ?? o.max ?? 4);
      const available = numberOrNull(o.libres ?? o.available ?? o.plazasLibres);
      const players = Array.isArray(o.jugadores ?? o.players)
        ? ((o.jugadores ?? o.players) as unknown[])
            .map((p) =>
              typeof p === "string" ? p : String((p as { nombre?: string })?.nombre ?? ""),
            )
            .filter(Boolean)
        : undefined;

      let status: TeeSlot["status"];
      if (typeof o.estado === "string" || typeof o.status === "string") {
        const s = String(o.estado ?? o.status).toLowerCase();
        status = /libre|free|disponible|open/.test(s)
          ? "libre"
          : /parc|partial/.test(s)
            ? "parcial"
            : "ocupado";
      } else if (available != null && capacity != null) {
        status = available <= 0 ? "ocupado" : available >= capacity ? "libre" : "parcial";
      } else {
        status = players && players.length > 0 ? "ocupado" : "libre";
      }
      return { time, status, available, capacity, players };
    })
    .filter((s): s is TeeSlot => s != null)
    .sort((a, b) => a.time.localeCompare(b.time));
}

function numberOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tee-sheet de un día (horas ocupadas y libres). No-op si falta config; nunca
 * lanza (los errores van en `error`).
 */
export async function getDayTeeSheet(date: string): Promise<TeeSheet> {
  const cfg = config();
  if (!cfg) return { configured: false, date, slots: [] };

  try {
    const auth = await getToken(cfg);
    if (!auth) {
      return {
        configured: true,
        date,
        slots: [],
        error: "No se pudo iniciar sesión en teeone (usuario/clave o IP no autorizada).",
      };
    }

    const path = cfg.salidasPath.replace("{date}", encodeURIComponent(date));
    const url = new URL(`${cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (cfg.tokenParam === "query") {
      url.searchParams.set(cfg.tokenHeader, auth.token);
      if (auth.idBBDD) url.searchParams.set("idBBDD", auth.idBBDD);
    } else {
      headers[cfg.tokenHeader] = auth.token;
      if (auth.idBBDD) headers.idBBDD = auth.idBBDD;
    }

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) {
      // Token caducado → forzamos re-login la próxima vez.
      if (res.status === 401 || res.status === 403) cachedToken = null;
      return {
        configured: true,
        date,
        slots: [],
        error: `teeone respondió ${res.status}. Revisa la ruta de salidas o la autorización de IP.`,
      };
    }
    const raw = await res.json();
    return { configured: true, date, slots: normalizeTeeSheet(raw) };
  } catch (e) {
    return {
      configured: true,
      date,
      slots: [],
      error: `No se pudo contactar con teeone: ${e instanceof Error ? e.message : "error de red"}`,
    };
  }
}
