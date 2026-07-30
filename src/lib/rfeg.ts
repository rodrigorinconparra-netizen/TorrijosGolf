import "server-only";

/**
 * Consulta el hándicap de un jugador federado en el Servicio de Hándicap de la
 * RFEG (https://rfegolf.es/paginasservicios/serviciohandicap.aspx).
 *
 * La web es ASP.NET, pero admite una consulta directa por GET con `?HLic=<licencia>`
 * que devuelve la ficha del jugador en una tabla de resultados (`gvSearchResult`)
 * con las columnas: [icono] · Nombre · Licencia · Hándicap · Estado · Modificación.
 *
 * Todo es best-effort: ante cualquier error o formato inesperado devuelve null,
 * de modo que nunca rompe el registro/cron. Si la RFEG cambia la web habrá que
 * ajustar el parseo de la tabla.
 */

const BASE_URL =
  process.env.RFEG_HANDICAP_URL ??
  "https://rfegolf.es/paginasservicios/serviciohandicap.aspx";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125 Safari/537.36";

export interface RfegResult {
  name: string | null;
  /** Hándicap exacto (WHS) que publica la RFEG, p. ej. 2.4 (o -2.4 si es "+2,4"). */
  handicap: number | null;
  /** Estado de la licencia, p. ej. "Válido". */
  status: string | null;
  license: string | null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&#225;/g, "á")
    .replace(/&#233;/g, "é")
    .replace(/&#237;/g, "í")
    .replace(/&#243;/g, "ó")
    .replace(/&#250;/g, "ú")
    .replace(/&#241;/g, "ñ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"');
}

/** "2,4" → 2.4 ; "+2,4" → -2.4 (plus handicap) ; "-----"/"" → null. */
function parseHcp(text: string | null): number | null {
  if (!text) return null;
  const t = text.trim();
  if (!t || /^-+$/.test(t)) return null;
  const plus = t.startsWith("+");
  const n = parseFloat(t.replace(",", ".").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return null;
  return plus ? -n : n;
}

/** Extrae las celdas de texto de la primera fila de datos de la tabla de resultados. */
function firstResultRow(html: string): string[] | null {
  const gi = html.indexOf("gvSearchResult");
  if (gi < 0) return null;
  const tableStart = html.lastIndexOf("<table", gi);
  const tableEnd = html.indexOf("</table>", gi);
  if (tableStart < 0 || tableEnd < 0) return null;
  const table = html.slice(tableStart, tableEnd);

  for (const rowMatch of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = rowMatch[1];
    if (/<th[\s>]/i.test(row)) continue; // cabecera
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      decodeEntities(m[1].replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim(),
    );
    // Fila válida: nombre + licencia + hándicap (celdas 1..3).
    if (cells.length >= 4 && cells[1]) return cells;
  }
  return null;
}

async function fetchWithTimeout(
  url: string,
  ms: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Consulta completa (nombre + hándicap + estado) por número de licencia. */
export async function fetchHandicapByLicense(
  license: string,
): Promise<RfegResult | null> {
  const lic = (license ?? "").replace(/\s/g, "").trim();
  if (!lic) return null;

  try {
    const sep = BASE_URL.includes("?") ? "&" : "?";
    const url = `${BASE_URL}${sep}HLic=${encodeURIComponent(lic)}`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) return null;
    const html = await res.text();

    const cells = firstResultRow(html);
    if (!cells) return null; // sin resultados para esa licencia

    // Columnas: [icono, Nombre, Licencia, Hándicap, Estado, Modificación, ...]
    const name = cells[1] || null;
    const foundLicense = cells[2] || null;
    const handicap = parseHcp(cells[3]);
    const status = cells[4] || null;

    if (!name && handicap === null) return null;
    return { name, handicap, status, license: foundLicense };
  } catch {
    return null; // best-effort: cualquier fallo → sin cambios
  }
}

/**
 * Devuelve el índice de hándicap de una licencia, o null si no se pudo obtener.
 * Es lo que se guarda en `users.handicapIndex`.
 */
export async function handicapForLicense(license: string): Promise<number | null> {
  const r = await fetchHandicapByLicense(license);
  return r?.handicap ?? null;
}
