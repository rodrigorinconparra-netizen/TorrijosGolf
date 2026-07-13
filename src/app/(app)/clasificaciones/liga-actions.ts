"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  leagueMatches,
  leagueMatchPlayers,
  leagueRounds,
  leagues,
  users,
} from "@/lib/db/schema";
import { requireAdmin, requireSession } from "@/lib/auth/session";
import {
  courseHandicapForHoles,
  holesFor,
  type Barra,
  type LeagueHoles,
  type Sexo,
} from "@/lib/course";
import { currentJornada, jornadaForDate } from "@/lib/league";
import { notifyUser, notifyUsers } from "@/lib/notify";
import { toDateKey } from "@/lib/utils";

export interface LeagueState {
  error?: string;
  ok?: string;
}

/* ----------------------------------------------------------------------------
 * Admin: crear / finalizar / borrar liga
 * ------------------------------------------------------------------------- */

const leagueSchema = z.object({
  title: z.string().trim().min(2, "Escribe un nombre para la liga"),
  description: z.string().trim().max(300).optional(),
  holes: z.enum(["1-9", "10-18", "18"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha de inicio"),
  minRounds: z.coerce.number().int().min(1).max(50),
  countRounds: z.coerce.number().int().min(1).max(50),
});

export async function createLeagueAction(
  _prev: LeagueState,
  formData: FormData,
): Promise<LeagueState> {
  const admin = await requireAdmin();
  const parsed = leagueSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    holes: formData.get("holes"),
    startDate: formData.get("startDate"),
    minRounds: formData.get("minRounds"),
    countRounds: formData.get("countRounds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const d = parsed.data;
  if (d.minRounds > d.countRounds) {
    return { error: "El mínimo de jornadas no puede ser mayor que las que cuentan" };
  }

  await db.insert(leagues).values({
    title: d.title,
    description: d.description,
    holes: d.holes,
    startDate: d.startDate,
    minRounds: d.minRounds,
    countRounds: d.countRounds,
    createdBy: admin.userId,
  });

  const everyone = await db
    .select({ id: users.id })
    .from(users)
    .where(ne(users.id, admin.userId));
  await notifyUsers(
    everyone.map((u) => u.id),
    {
      type: "evento",
      title: "Nueva liga del club",
      body: `${d.title} — apúntate jugando tu primera jornada.`,
      link: "/clasificaciones",
    },
  );

  revalidatePath("/clasificaciones");
  return { ok: `Liga "${d.title}" creada` };
}

const editLeagueSchema = z.object({
  leagueId: z.coerce.number().int().positive(),
  title: z.string().trim().min(2, "Escribe un nombre para la liga"),
  description: z.string().trim().max(300).optional(),
  holes: z.enum(["1-9", "10-18", "18"]).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  minRounds: z.coerce.number().int().min(1).max(50),
  countRounds: z.coerce.number().int().min(1).max(50),
});

/**
 * El admin edita la liga. Nombre, descripción, mínimo y jornadas que cuentan se
 * pueden cambiar siempre (la clasificación se recalcula al vuelo). El recorrido
 * (9/18) y la fecha de inicio solo si aún NO hay vueltas: cambiarlos con
 * tarjetas ya registradas rompería los hoyos anotados y la numeración de
 * jornadas.
 */
export async function editLeagueAction(
  _prev: LeagueState,
  formData: FormData,
): Promise<LeagueState> {
  await requireAdmin();
  const parsed = editLeagueSchema.safeParse({
    leagueId: formData.get("leagueId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    holes: formData.get("holes") || undefined,
    startDate: formData.get("startDate") || undefined,
    minRounds: formData.get("minRounds"),
    countRounds: formData.get("countRounds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const d = parsed.data;
  if (d.minRounds > d.countRounds) {
    return { error: "El mínimo de jornadas no puede ser mayor que las que cuentan" };
  }

  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, d.leagueId))
    .limit(1);
  if (!league) return { error: "La liga no existe" };

  const [existingRound] = await db
    .select({ id: leagueRounds.id })
    .from(leagueRounds)
    .where(eq(leagueRounds.leagueId, d.leagueId))
    .limit(1);
  const hasRounds = Boolean(existingRound);

  if (hasRounds) {
    if (d.holes && d.holes !== league.holes) {
      return {
        error:
          "No se puede cambiar el recorrido: ya hay vueltas registradas con estos hoyos.",
      };
    }
    if (d.startDate && d.startDate !== league.startDate) {
      return {
        error:
          "No se puede cambiar la fecha de inicio: ya hay vueltas asignadas a jornadas.",
      };
    }
  }

  await db
    .update(leagues)
    .set({
      title: d.title,
      description: d.description ?? null,
      minRounds: d.minRounds,
      countRounds: d.countRounds,
      ...(hasRounds ? {} : { holes: d.holes ?? league.holes, startDate: d.startDate ?? league.startDate }),
    })
    .where(eq(leagues.id, d.leagueId));

  revalidatePath("/clasificaciones");
  revalidatePath(`/clasificaciones/liga/${d.leagueId}`);
  return { ok: "Liga actualizada" };
}

export async function finishLeagueAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("leagueId"));
  if (!id) return;
  await db.update(leagues).set({ status: "finalizada" }).where(eq(leagues.id, id));
  revalidatePath("/clasificaciones");
  revalidatePath(`/clasificaciones/liga/${id}`);
}

export async function deleteLeagueAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("leagueId"));
  if (!id) return;
  await db.delete(leagues).where(eq(leagues.id, id));
  revalidatePath("/clasificaciones");
}

/* ----------------------------------------------------------------------------
 * Jugador: crear partida (jornada actual) y meter la tarjeta
 * ------------------------------------------------------------------------- */

async function playerGolfData(playerId: number) {
  const [u] = await db
    .select({
      id: users.id,
      name: users.name,
      handicapIndex: users.handicapIndex,
      sex: users.sex,
    })
    .from(users)
    .where(eq(users.id, playerId))
    .limit(1);
  return u ?? null;
}

/* --- Partidas (grupo que sale a jugar; los marcadores salen de aquí) --- */

/** Comprueba liga activa y jornada en curso. */
async function activeLeagueAndJornada(leagueId: number) {
  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1);
  if (!league || league.status !== "activa") return null;
  const jornada = currentJornada(league.startDate);
  if (jornada < 1) return null;
  return { league, jornada };
}

/** ¿En qué partida de esta jornada está el jugador? */
async function matchOf(leagueId: number, jornada: number, playerId: number) {
  const [m] = await db
    .select({ matchId: leagueMatchPlayers.matchId })
    .from(leagueMatchPlayers)
    .innerJoin(leagueMatches, eq(leagueMatches.id, leagueMatchPlayers.matchId))
    .where(
      and(
        eq(leagueMatches.leagueId, leagueId),
        eq(leagueMatches.jornada, jornada),
        eq(leagueMatchPlayers.playerId, playerId),
      ),
    )
    .limit(1);
  return m?.matchId ?? null;
}

/** Crea una partida para la jornada actual (el creador entra automáticamente). */
export async function createMatchAction(
  _prev: LeagueState,
  formData: FormData,
): Promise<LeagueState> {
  const user = await requireSession();
  const leagueId = Number(formData.get("leagueId"));
  const ctx = await activeLeagueAndJornada(leagueId);
  if (!ctx) return { error: "La liga no está activa o aún no ha empezado" };

  if (await matchOf(leagueId, ctx.jornada, user.userId)) {
    return { error: "Ya estás en una partida esta jornada" };
  }

  const [match] = await db
    .insert(leagueMatches)
    .values({
      leagueId,
      jornada: ctx.jornada,
      date: toDateKey(new Date()),
      createdBy: user.userId,
    })
    .returning({ id: leagueMatches.id });
  await db
    .insert(leagueMatchPlayers)
    .values({ matchId: match.id, playerId: user.userId });

  revalidatePath(`/clasificaciones/liga/${leagueId}`);
  return { ok: "Partida creada. Cuando se unan tus compañeros, elige marcador." };
}

/** Unirse a una partida abierta de la jornada actual. */
export async function joinMatchAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const matchId = Number(formData.get("matchId"));
  if (!matchId) return;

  const [match] = await db
    .select()
    .from(leagueMatches)
    .where(eq(leagueMatches.id, matchId))
    .limit(1);
  if (!match) return;
  const ctx = await activeLeagueAndJornada(match.leagueId);
  if (!ctx || ctx.jornada !== match.jornada) return;
  if (await matchOf(match.leagueId, match.jornada, user.userId)) return;

  await db
    .insert(leagueMatchPlayers)
    .values({ matchId, playerId: user.userId })
    .onConflictDoNothing();
  revalidatePath(`/clasificaciones/liga/${match.leagueId}`);
}

const createRoundSchema = z.object({
  matchId: z.coerce.number().int().positive(),
  markerId: z.coerce.number().int().positive("Elige quién te marca"),
  barra: z.enum(["amarillas", "rojas"]),
});

/** El jugador empieza su vuelta dentro de la partida (marcador ∈ partida). */
export async function createRoundAction(
  _prev: LeagueState,
  formData: FormData,
): Promise<LeagueState> {
  const user = await requireSession();
  const parsed = createRoundSchema.safeParse({
    matchId: formData.get("matchId"),
    markerId: formData.get("markerId"),
    barra: formData.get("barra"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const d = parsed.data;
  if (d.markerId === user.userId) {
    return { error: "El marcador debe ser otra persona" };
  }

  const [match] = await db
    .select()
    .from(leagueMatches)
    .where(eq(leagueMatches.id, d.matchId))
    .limit(1);
  if (!match) return { error: "La partida no existe" };
  const ctx = await activeLeagueAndJornada(match.leagueId);
  if (!ctx || ctx.jornada !== match.jornada) {
    return { error: "La partida no es de la jornada actual" };
  }
  const { league, jornada } = ctx;

  // Jugador y marcador deben ser miembros de la partida.
  const members = await db
    .select({ playerId: leagueMatchPlayers.playerId })
    .from(leagueMatchPlayers)
    .where(eq(leagueMatchPlayers.matchId, d.matchId));
  const memberIds = new Set(members.map((m) => m.playerId));
  if (!memberIds.has(user.userId)) return { error: "No estás en esta partida" };
  if (!memberIds.has(d.markerId)) {
    return { error: "El marcador debe ser de tu partida" };
  }

  const me = await playerGolfData(user.userId);
  if (me?.handicapIndex == null) {
    return {
      error:
        "El club aún no te ha asignado hándicap. Pídeselo para poder jugar la liga.",
    };
  }

  const [existing] = await db
    .select({ id: leagueRounds.id })
    .from(leagueRounds)
    .where(
      and(
        eq(leagueRounds.leagueId, match.leagueId),
        eq(leagueRounds.playerId, user.userId),
        eq(leagueRounds.jornada, jornada),
      ),
    )
    .limit(1);
  if (existing) return { error: "Ya tienes una vuelta en esta jornada" };

  const nHoles = holesFor(league.holes as LeagueHoles).length;
  const empty = JSON.stringify(new Array(nHoles).fill(0));
  await db.insert(leagueRounds).values({
    leagueId: match.leagueId,
    matchId: d.matchId,
    playerId: user.userId,
    markerId: d.markerId,
    jornada,
    date: toDateKey(new Date()),
    barra: d.barra,
    scores: empty,
    scoresMarker: empty,
  });

  await notifyUser(d.markerId, {
    type: "evento",
    title: "Te han elegido de marcador",
    body: `${user.name} te ha elegido para marcar su vuelta de "${league.title}".`,
    link: `/clasificaciones/liga/${league.id}?t=jugar`,
  });

  revalidatePath(`/clasificaciones/liga/${match.leagueId}`);
  return { ok: "Vuelta creada. ¡A jugar!" };
}

function parseScores(raw: unknown, nHoles: number): number[] | null {
  try {
    const arr = JSON.parse(String(raw));
    if (!Array.isArray(arr) || arr.length !== nHoles) return null;
    const nums = arr.map((v) => Number(v));
    if (nums.some((v) => !Number.isInteger(v) || v < 0 || v > 20)) return null;
    return nums;
  } catch {
    return null;
  }
}

/**
 * Guarda los golpes de la tarjeta mientras está en juego. El jugador escribe su
 * cuenta (`scores`) y el marcador la oficial (`scoresMarker`). Cualquier cambio
 * anula las firmas.
 */
export async function saveScoresAction(
  _prev: LeagueState,
  formData: FormData,
): Promise<LeagueState> {
  const user = await requireSession();
  const roundId = Number(formData.get("roundId"));
  if (!roundId) return { error: "Vuelta no válida" };

  const [round] = await db
    .select()
    .from(leagueRounds)
    .where(eq(leagueRounds.id, roundId))
    .limit(1);
  if (!round) return { error: "La vuelta no existe" };
  if (round.status !== "en_juego") return { error: "La vuelta ya está finalizada" };

  const isPlayer = round.playerId === user.userId;
  const isMarker = round.markerId === user.userId;
  if (!isPlayer && !isMarker) return { error: "No puedes editar esta tarjeta" };

  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, round.leagueId))
    .limit(1);
  if (!league) return { error: "La liga no existe" };

  const nHoles = holesFor(league.holes as LeagueHoles).length;
  const scores = parseScores(formData.get("scores"), nHoles);
  if (!scores) return { error: "Tarjeta no válida" };

  await db
    .update(leagueRounds)
    .set({
      ...(isPlayer
        ? { scores: JSON.stringify(scores) }
        : { scoresMarker: JSON.stringify(scores) }),
      // Cambiar la tarjeta invalida las firmas de ambos.
      playerSigned: false,
      markerSigned: false,
    })
    .where(eq(leagueRounds.id, roundId));

  revalidatePath(`/clasificaciones/liga/${round.leagueId}`);
  return { ok: "Tarjeta guardada" };
}

/**
 * Firma de la vuelta. Firman el jugador y el marcador, y solo cuando ambas
 * tarjetas están completas y COINCIDEN. Con las dos firmas, la vuelta se
 * finaliza (bruto, hándicap de juego y neto) y suma a la clasificación.
 */
export async function signRoundAction(
  _prev: LeagueState,
  formData: FormData,
): Promise<LeagueState> {
  const user = await requireSession();
  const roundId = Number(formData.get("roundId"));
  if (!roundId) return { error: "Vuelta no válida" };

  const [round] = await db
    .select()
    .from(leagueRounds)
    .where(eq(leagueRounds.id, roundId))
    .limit(1);
  if (!round) return { error: "La vuelta no existe" };
  if (round.status !== "en_juego") return { error: "La vuelta ya está finalizada" };

  const isPlayer = round.playerId === user.userId;
  const isMarker = round.markerId === user.userId;
  if (!isPlayer && !isMarker) return { error: "Esta tarjeta no es tuya" };

  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, round.leagueId))
    .limit(1);
  if (!league) return { error: "La liga no existe" };

  const nHoles = holesFor(league.holes as LeagueHoles).length;
  const mine = parseScores(round.scores, nHoles);
  const theirs = parseScores(round.scoresMarker, nHoles);
  if (!mine || !theirs || mine.some((s) => s === 0) || theirs.some((s) => s === 0)) {
    return { error: "Las dos tarjetas deben estar completas antes de firmar" };
  }
  if (mine.some((s, i) => s !== theirs[i])) {
    return {
      error:
        "Las tarjetas no coinciden. Revisad juntos los hoyos marcados en rojo antes de firmar.",
    };
  }

  const playerSigned = isPlayer ? true : round.playerSigned;
  const markerSigned = isMarker ? true : round.markerSigned;

  if (playerSigned && markerSigned) {
    // Segunda firma → finalizar.
    const player = await playerGolfData(round.playerId);
    if (player?.handicapIndex == null) {
      return { error: "El jugador no tiene hándicap asignado" };
    }
    const gross = mine.reduce((a, b) => a + b, 0);
    const courseHcp = courseHandicapForHoles(
      player.handicapIndex,
      round.barra as Barra,
      (player.sex ?? "hombre") as Sexo,
      league.holes as LeagueHoles,
    );
    const net = gross - courseHcp;

    await db
      .update(leagueRounds)
      .set({ playerSigned, markerSigned, gross, courseHcp, net, status: "finalizada" })
      .where(eq(leagueRounds.id, roundId));

    await notifyUser(round.playerId, {
      type: "evento",
      title: "Vuelta firmada",
      body: `Tu vuelta de "${league.title}": ${gross} golpes, neto ${net}. Ya suma en la clasificación.`,
      link: `/clasificaciones/liga/${league.id}`,
    });

    revalidatePath(`/clasificaciones/liga/${round.leagueId}`);
    return { ok: `Vuelta cerrada: ${gross} golpes (neto ${net})` };
  }

  await db
    .update(leagueRounds)
    .set({ playerSigned, markerSigned })
    .where(eq(leagueRounds.id, roundId));

  // Avisa al que falta por firmar.
  const otherId = isPlayer ? round.markerId : round.playerId;
  await notifyUser(otherId, {
    type: "evento",
    title: "Falta tu firma",
    body: `${user.name} ya ha firmado la tarjeta de "${league.title}". Revisa y firma la tuya.`,
    link: `/clasificaciones/liga/${league.id}?t=jugar`,
  });

  revalidatePath(`/clasificaciones/liga/${round.leagueId}`);
  return { ok: "Firma registrada. Falta la otra firma para cerrar la vuelta." };
}

/** Borra una vuelta: su jugador mientras esté en juego, o el admin siempre. */
export async function deleteRoundAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const roundId = Number(formData.get("roundId"));
  if (!roundId) return;

  const [round] = await db
    .select()
    .from(leagueRounds)
    .where(eq(leagueRounds.id, roundId))
    .limit(1);
  if (!round) return;

  const canDelete =
    user.role === "admin" ||
    (round.playerId === user.userId && round.status === "en_juego");
  if (!canDelete) return;

  await db.delete(leagueRounds).where(eq(leagueRounds.id, roundId));
  revalidatePath(`/clasificaciones/liga/${round.leagueId}`);
}

/* ----------------------------------------------------------------------------
 * Admin: añadir/editar una vuelta de cualquier jugador (tarjeta en papel, etc.)
 * ------------------------------------------------------------------------- */

const adminRoundSchema = z.object({
  leagueId: z.coerce.number().int().positive(),
  playerId: z.coerce.number().int().positive("Elige el jugador"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha"),
  barra: z.enum(["amarillas", "rojas"]),
  scores: z.string(),
});

/** El admin registra (o corrige) la vuelta de un jugador en la jornada de la fecha. */
export async function adminUpsertRoundAction(
  _prev: LeagueState,
  formData: FormData,
): Promise<LeagueState> {
  const admin = await requireAdmin();
  const parsed = adminRoundSchema.safeParse({
    leagueId: formData.get("leagueId"),
    playerId: formData.get("playerId"),
    date: formData.get("date"),
    barra: formData.get("barra"),
    scores: formData.get("scores"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const d = parsed.data;

  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, d.leagueId))
    .limit(1);
  if (!league) return { error: "La liga no existe" };

  const jornada = jornadaForDate(league.startDate, d.date);
  if (jornada < 1) return { error: "La fecha es anterior al inicio de la liga" };

  const nHoles = holesFor(league.holes as LeagueHoles).length;
  const scores = parseScores(d.scores, nHoles);
  if (!scores || scores.some((s) => s === 0)) {
    return { error: "Faltan hoyos por anotar (ningún hoyo puede quedar a 0)" };
  }

  const player = await playerGolfData(d.playerId);
  if (player?.handicapIndex == null) {
    return { error: "Ese jugador no tiene hándicap asignado (ficha del CRM)" };
  }
  const gross = scores.reduce((a, b) => a + b, 0);
  const courseHcp = courseHandicapForHoles(
    player.handicapIndex,
    d.barra as Barra,
    (player.sex ?? "hombre") as Sexo,
    league.holes as LeagueHoles,
  );
  const net = gross - courseHcp;

  await db
    .insert(leagueRounds)
    .values({
      leagueId: d.leagueId,
      playerId: d.playerId,
      markerId: admin.userId,
      jornada,
      date: d.date,
      barra: d.barra,
      scores: JSON.stringify(scores),
      scoresMarker: JSON.stringify(scores),
      playerSigned: true,
      markerSigned: true,
      gross,
      courseHcp,
      net,
      status: "finalizada",
    })
    .onConflictDoUpdate({
      target: [leagueRounds.leagueId, leagueRounds.playerId, leagueRounds.jornada],
      set: {
        date: d.date,
        barra: d.barra,
        scores: JSON.stringify(scores),
        scoresMarker: JSON.stringify(scores),
        playerSigned: true,
        markerSigned: true,
        gross,
        courseHcp,
        net,
        status: "finalizada",
        markerId: admin.userId,
      },
    });

  revalidatePath(`/clasificaciones/liga/${d.leagueId}`);
  return {
    ok: `Vuelta de ${player.name} guardada: ${gross} golpes (neto ${net}), jornada ${jornada}`,
  };
}