import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  bookingRequests,
  groups,
  slots,
  teacherAvailability,
  users,
} from "@/lib/db/schema";
import { toDateKey } from "@/lib/utils";

/**
 * Normaliza cualquier valor de fecha (string "yyyy-mm-dd", string ISO o `Date`
 * devuelta por Drizzle/Neon) a la clave "yyyy-mm-dd" que usa el cliente para
 * comparar. Sin esto, un `date` de Postgres serializado como
 * "2026-08-09T22:00:00.000Z" (UTC ≈ 2026-08-10 en España) no coincidiría con
 * la clave "2026-08-10" que genera el cliente, y una hora ya cogida seguiría
 * apareciendo como libre.
 */
function dateKey(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    // "yyyy-mm-dd" o "yyyy-mm-ddT..." → si trae hora la reinterpretamos en
    // zona local para no arrastrar el desfase UTC.
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
  }
  if (v instanceof Date) return toDateKey(v);
  return null;
}

export interface ScheduleEntry {
  weekday: number;
  startTime: string;
  durationMin: number;
  status: "ocupado" | "libre";
  /** Quién ocupa la hora, o "Libre". */
  label: string;
  price: number;
  /** Presente si la hora está libre y es reservable. */
  availabilityId?: number;
  /** Fechas (YYYY-MM-DD) ya reservadas en esa hora → no ofrecerlas como puntual. */
  takenDates?: string[];
  /** true si ya hay una clase/solicitud mensual en esa hora → no ofrecer mensual. */
  monthlyTaken?: boolean;
}

/**
 * Horario semanal de un profesor combinando sus clases (ocupadas) y sus horas
 * libres marcadas por el admin (reservables). Excluye clases de un solo día.
 */
export async function teacherWeeklySchedule(
  teacherId: number,
): Promise<ScheduleEntry[]> {
  const student = alias(users, "student");
  const occ = await db
    .select({
      weekday: slots.weekday,
      startTime: slots.startTime,
      durationMin: slots.durationMin,
      kind: slots.kind,
      price: slots.price,
      groupName: groups.name,
      studentName: student.name,
    })
    .from(slots)
    .leftJoin(groups, eq(groups.id, slots.groupId))
    .leftJoin(student, eq(student.id, slots.studentId))
    .where(
      and(
        eq(slots.teacherId, teacherId),
        eq(slots.active, true),
        isNull(slots.oneOffDate),
      ),
    );

  const occupiedKeys = new Set(occ.map((o) => `${o.weekday}|${o.startTime}`));
  const entries: ScheduleEntry[] = occ.map((o) => ({
    weekday: o.weekday,
    startTime: o.startTime,
    durationMin: o.durationMin,
    status: "ocupado" as const,
    label: o.kind === "grupal" ? (o.groupName ?? "Grupo") : (o.studentName ?? "Ocupado"),
    price: o.price,
  }));

  // Reservas ya ocupadas en horas concretas: clases de un solo día (oneOff) y
  // solicitudes/clases pendientes o aceptadas. Para no ofrecer una hora ya cogida.
  const oneOffs = await db
    .select({ startTime: slots.startTime, date: slots.oneOffDate })
    .from(slots)
    .where(
      and(
        eq(slots.teacherId, teacherId),
        eq(slots.active, true),
        sql`${slots.oneOffDate} is not null`,
      ),
    );
  const bks = await db
    .select({
      kind: bookingRequests.kind,
      weekday: bookingRequests.weekday,
      startTime: bookingRequests.startTime,
      date: bookingRequests.date,
    })
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.teacherId, teacherId),
        inArray(bookingRequests.status, ["pendiente", "aceptada"]),
      ),
    );

  // Por hora de inicio → fechas puntuales ocupadas; y días+hora con mensual cogida.
  const takenByTime = new Map<string, Set<string>>();
  const monthlyTakenKeys = new Set<string>();
  for (const o of oneOffs) {
    const key = dateKey(o.date);
    if (!key) continue;
    const set = takenByTime.get(o.startTime) ?? new Set<string>();
    set.add(key);
    takenByTime.set(o.startTime, set);
  }
  for (const b of bks) {
    if (b.kind === "puntual") {
      const key = dateKey(b.date);
      if (!key) continue;
      const set = takenByTime.get(b.startTime) ?? new Set<string>();
      set.add(key);
      takenByTime.set(b.startTime, set);
    } else if (b.kind === "mensual") {
      monthlyTakenKeys.add(`${b.weekday}|${b.startTime}`);
    }
  }

  const avail = await db
    .select()
    .from(teacherAvailability)
    .where(
      and(eq(teacherAvailability.teacherId, teacherId), eq(teacherAvailability.active, true)),
    );

  for (const a of avail) {
    if (occupiedKeys.has(`${a.weekday}|${a.startTime}`)) continue; // ya reservada (semanal)
    entries.push({
      weekday: a.weekday,
      startTime: a.startTime,
      durationMin: a.durationMin,
      status: "libre",
      label: "Libre",
      price: a.price,
      availabilityId: a.id,
      takenDates: [...(takenByTime.get(a.startTime) ?? [])],
      monthlyTaken: monthlyTakenKeys.has(`${a.weekday}|${a.startTime}`),
    });
  }

  entries.sort(
    (x, y) => x.weekday - y.weekday || x.startTime.localeCompare(y.startTime),
  );
  return entries;
}

/** Horas libres de un profesor (para la gestión del admin). */
export async function availabilityOf(teacherId: number) {
  return db
    .select()
    .from(teacherAvailability)
    .where(
      and(eq(teacherAvailability.teacherId, teacherId), eq(teacherAvailability.active, true)),
    )
    .orderBy(asc(teacherAvailability.weekday), asc(teacherAvailability.startTime));
}

/** Profesores con al menos una hora libre (para la reserva del alumno). */
export async function teachersWithAvailability(): Promise<
  { id: number; name: string; freeCount: number }[]
> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      freeCount: sql<number>`count(${teacherAvailability.id})::int`,
    })
    .from(users)
    .innerJoin(
      teacherAvailability,
      and(
        eq(teacherAvailability.teacherId, users.id),
        eq(teacherAvailability.active, true),
      ),
    )
    .groupBy(users.id, users.name)
    .orderBy(asc(users.name));
  return rows;
}

/**
 * ¿Está ya cogida esa hora? Evita dobles reservas. Considera clases activas
 * (semanales y de un solo día) y solicitudes pendientes/aceptadas.
 */
export async function hasBookingConflict(opts: {
  teacherId: number;
  weekday: number;
  startTime: string;
  kind: "puntual" | "mensual";
  date?: string | null;
}): Promise<boolean> {
  const { teacherId, weekday, startTime, kind, date } = opts;

  const activeSlots = await db
    .select({ weekday: slots.weekday, oneOffDate: slots.oneOffDate })
    .from(slots)
    .where(
      and(
        eq(slots.teacherId, teacherId),
        eq(slots.active, true),
        eq(slots.startTime, startTime),
      ),
    );
  for (const s of activeSlots) {
    if (s.oneOffDate == null) {
      // Clase semanal en ese día+hora: bloquea mensual y cualquier puntual ese día.
      if (s.weekday === weekday) return true;
    } else if (kind === "puntual" && s.oneOffDate === date) {
      return true; // ya hay una clase de un día en esa fecha+hora
    }
  }

  const pend = await db
    .select({
      kind: bookingRequests.kind,
      weekday: bookingRequests.weekday,
      date: bookingRequests.date,
    })
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.teacherId, teacherId),
        eq(bookingRequests.startTime, startTime),
        inArray(bookingRequests.status, ["pendiente", "aceptada"]),
      ),
    );
  for (const b of pend) {
    if (b.weekday !== weekday) continue;
    if (kind === "mensual") return true; // otra reserva ya toma ese día+hora
    if (b.kind === "mensual") return true; // una mensual cubre esa fecha
    if (b.kind === "puntual" && b.date === date) return true;
  }
  return false;
}

/** Todos los profesores (para el selector del admin y del alumno). */
export async function allTeachers(): Promise<{ id: number; name: string }[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "profesor"))
    .orderBy(asc(users.name));
}

export interface TeacherPrices {
  /** Individual (una persona) puntual/mensual. */
  individualPuntual: number | null;
  individualMensual: number | null;
  /** Grupal POR PERSONA, puntual/mensual. */
  grupalPuntual: number | null;
  grupalMensual: number | null;
}

const priceCols = {
  individualPuntual: users.priceIndividualPuntual,
  individualMensual: users.priceIndividualMensual,
  grupalPuntual: users.priceGrupalPuntual,
  grupalMensual: users.priceGrupalMensual,
} as const;

/** Precios de clase de un profesor (los que ve el alumno al reservar). */
export async function teacherPrices(teacherId: number): Promise<TeacherPrices> {
  const [row] = await db
    .select(priceCols)
    .from(users)
    .where(eq(users.id, teacherId))
    .limit(1);
  return (
    row ?? {
      individualPuntual: null,
      individualMensual: null,
      grupalPuntual: null,
      grupalMensual: null,
    }
  );
}

/** Devuelve el precio concreto para una combinación (server-side, fuente de verdad). */
export function priceFor(
  prices: TeacherPrices,
  classKind: "individual" | "grupal",
  kind: "puntual" | "mensual",
): number {
  const key = `${classKind}${kind === "puntual" ? "Puntual" : "Mensual"}` as keyof TeacherPrices;
  return prices[key] ?? 0;
}
