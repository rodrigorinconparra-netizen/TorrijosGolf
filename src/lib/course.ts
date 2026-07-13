/**
 * Datos oficiales del campo Torrijos Golf (recorrido 8820-3, RFEG, válido desde
 * 01/03/2019). Par 70, 18 hoyos, dos barras de salida: Amarillas y Rojas.
 *
 * Módulo puro (sin "server-only"): lo usan tanto la página como la calculadora
 * del cliente.
 */

export type Barra = "amarillas" | "rojas";
export type Sexo = "hombre" | "mujer";

export interface CourseHole {
  n: number;
  par: number;
  amarillas: { dist: number; si: number };
  rojas: { dist: number; si: number };
}

// Datos por hoyo (1..18), en orden.
const PAR = [4, 4, 4, 3, 5, 4, 3, 4, 4, 4, 3, 5, 3, 5, 4, 3, 4, 4];
const AM_DIST = [340, 272, 389, 143, 469, 324, 118, 277, 237, 340, 188, 422, 141, 469, 324, 118, 274, 237];
const AM_SI = [5, 18, 1, 9, 2, 7, 12, 14, 16, 6, 4, 11, 10, 3, 8, 13, 15, 17];
const RO_DIST = [321, 257, 320, 126, 368, 220, 71, 188, 213, 321, 148, 379, 120, 368, 220, 71, 185, 213];
const RO_SI = [6, 18, 3, 10, 1, 8, 13, 17, 15, 7, 4, 5, 11, 2, 9, 12, 16, 14];

export const TORRIJOS = {
  code: "8820-3",
  name: "Torrijos Golf",
  validFrom: "01/03/2019",
  par: 70,
  holes: 18,
  /** Course Rating (CR) y Slope Rating (SR) por barra y sexo. */
  rating: {
    amarillas: {
      hombre: { cr: 68.4, sr: 130 },
      mujer: { cr: 73.9, sr: 135 },
    },
    rojas: {
      hombre: { cr: 64.3, sr: 115 },
      mujer: { cr: 68.5, sr: 115 },
    },
  } as Record<Barra, Record<Sexo, { cr: number; sr: number }>>,
  scorecard: PAR.map(
    (par, i): CourseHole => ({
      n: i + 1,
      par,
      amarillas: { dist: AM_DIST[i], si: AM_SI[i] },
      rojas: { dist: RO_DIST[i], si: RO_SI[i] },
    }),
  ),
};

export const BARRA_LABEL: Record<Barra, string> = {
  amarillas: "Amarillas",
  rojas: "Rojas",
};

/**
 * Hándicap de juego (Course Handicap, Sistema Mundial de Hándicap):
 *   CH = redondeo( índice × (SR / 113) + (CR − Par) )
 */
export function courseHandicap(index: number, sr: number, cr: number, par: number): number {
  return Math.round(index * (sr / 113) + (cr - par));
}

/**
 * Golpes que recibe el jugador en cada hoyo según su hándicap de juego y el
 * índice de dificultad (stroke index) de cada hoyo. Reparte de forma estándar;
 * funciona también con hándicaps "plus" (negativos → devuelve golpes).
 */
export function strokesPerHole(courseHcp: number, strokeIndexByHole: number[]): number[] {
  const n = strokeIndexByHole.length;
  const base = Math.floor(courseHcp / n);
  const rem = courseHcp - base * n; // 0..n-1
  return strokeIndexByHole.map((si) => base + (si <= rem ? 1 : 0));
}

/* ----------------------------------------------------------------------------
 * Recorridos de liga: 9 hoyos (ida o vuelta) o 18 completos
 * ------------------------------------------------------------------------- */

export type LeagueHoles = "1-9" | "10-18" | "18";

export const LEAGUE_HOLES_LABEL: Record<LeagueHoles, string> = {
  "1-9": "9 hoyos (1 al 9)",
  "10-18": "9 hoyos (10 al 18)",
  "18": "18 hoyos",
};

/** Los hoyos del recorrido elegido, en orden de juego. */
export function holesFor(holes: LeagueHoles): CourseHole[] {
  if (holes === "1-9") return TORRIJOS.scorecard.slice(0, 9);
  if (holes === "10-18") return TORRIJOS.scorecard.slice(9, 18);
  return TORRIJOS.scorecard;
}

/** Par total del recorrido (35 en cada mitad, 70 el completo). */
export function parFor(holes: LeagueHoles): number {
  return holesFor(holes).reduce((a, h) => a + h.par, 0);
}

/**
 * Hándicap de juego para el recorrido elegido (Sistema Mundial de Hándicap):
 *  - 18 hoyos: redondeo( índice × SR/113 + (CR − 70) )
 *  - 9 hoyos:  redondeo( (índice ÷ 2) × SR/113 + (CR ÷ 2 − 35) )
 *    (el slope se aplica igualmente; el CR a 9 hoyos se aproxima como CR/2,
 *     al no publicar la RFEG un CR específico de 9 para este recorrido)
 */
export function courseHandicapForHoles(
  index: number,
  barra: Barra,
  sexo: Sexo,
  holes: LeagueHoles,
): number {
  const { cr, sr } = TORRIJOS.rating[barra][sexo];
  if (holes === "18") {
    return Math.round(index * (sr / 113) + (cr - TORRIJOS.par));
  }
  const par9 = parFor(holes); // 35 en ambas mitades
  return Math.round((index / 2) * (sr / 113) + (cr / 2 - par9));
}
