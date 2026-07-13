import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leagueRounds, leagues, users } from "@/lib/db/schema";
import { parFor, type LeagueHoles } from "@/lib/course";
import { toDateKey } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Jornadas: la jornada 1 empieza en league.startDate; cada jornada dura 7 días.
 * ------------------------------------------------------------------------- */

/** Nº de jornada al que pertenece una fecha (1, 2, 3…). 0 si es anterior al inicio. */
export function jornadaForDate(startDate: string, date: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const d = new Date(`${date}T00:00:00`);
  const days = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return 0;
  return Math.floor(days / 7) + 1;
}

/** Jornada actual de una liga (0 si aún no ha empezado). */
export function currentJornada(startDate: string): number {
  return jornadaForDate(startDate, toDateKey(new Date()));
}

/* ----------------------------------------------------------------------------
 * Clasificación en vivo
 * ------------------------------------------------------------------------- */

export interface StandingRow {
  playerId: number;
  playerName: string;
  license: string | null;
  /** Neto por jornada (índice 1..N; undefined = no jugada). */
  byJornada: Map<number, number>;
  played: number;
  /** Suma de las mejores `countRounds` jornadas. */
  total: number;
  /** total − par × jornadasQueCuentan. Solo si played >= minRounds. */
  vsPar: number | null;
  qualified: boolean;
}

export interface LeagueStandings {
  jornadas: number;
  rows: StandingRow[];
}

/**
 * Calcula la clasificación de una liga: para cada jugador, el neto de cada
 * jornada finalizada; el total son sus mejores `countRounds` netos; solo
 * clasifican (con +/-PAR) quienes hayan jugado al menos `minRounds`.
 */
export async function leagueStandings(leagueId: number): Promise<LeagueStandings> {
  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1);
  if (!league) return { jornadas: 0, rows: [] };

  const rounds = await db
    .select({
      playerId: leagueRounds.playerId,
      playerName: users.name,
      license: users.license,
      jornada: leagueRounds.jornada,
      net: leagueRounds.net,
    })
    .from(leagueRounds)
    .innerJoin(users, eq(users.id, leagueRounds.playerId))
    .where(
      and(eq(leagueRounds.leagueId, leagueId), eq(leagueRounds.status, "finalizada")),
    )
    .orderBy(asc(leagueRounds.jornada));

  const par = parFor(league.holes as LeagueHoles);
  const byPlayer = new Map<number, StandingRow>();
  let maxJornada = currentJornada(league.startDate);

  for (const r of rounds) {
    if (r.net == null) continue;
    maxJornada = Math.max(maxJornada, r.jornada);
    let row = byPlayer.get(r.playerId);
    if (!row) {
      row = {
        playerId: r.playerId,
        playerName: r.playerName,
        license: r.license,
        byJornada: new Map(),
        played: 0,
        total: 0,
        vsPar: null,
        qualified: false,
      };
      byPlayer.set(r.playerId, row);
    }
    row.byJornada.set(r.jornada, r.net);
  }

  for (const row of byPlayer.values()) {
    const nets = [...row.byJornada.values()].sort((a, b) => a - b);
    row.played = nets.length;
    const counted = nets.slice(0, league.countRounds);
    row.total = counted.reduce((a, b) => a + b, 0);
    row.qualified = row.played >= league.minRounds;
    if (row.qualified) {
      row.vsPar = row.total - par * counted.length;
    }
  }

  // Clasificados por total asc; después los no clasificados por jornadas jugadas.
  const rows = [...byPlayer.values()].sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    if (a.qualified) return a.total - b.total;
    return b.played - a.played || a.total - b.total;
  });

  return { jornadas: Math.max(maxJornada, 0), rows };
}
