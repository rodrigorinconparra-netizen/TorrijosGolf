import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  attendance,
  groupMembers,
  groups,
  sessions,
  slots,
  users,
} from "@/lib/db/schema";
import { isoWeekday, toDateKey } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Modelo: los `slots` son horas semanales recurrentes. Una "clase" concreta es
 * un slot en una fecha (ocurrencia). Las filas de `sessions` se crean de forma
 * perezosa cuando alguien interactúa con la ocurrencia; hasta entonces la
 * ocurrencia existe solo calculada en memoria.
 * ------------------------------------------------------------------------- */

export interface SlotInfo {
  id: number;
  teacherId: number;
  teacherName: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  kind: "individual" | "grupal";
  groupId: number | null;
  groupName: string | null;
  studentId: number | null;
  studentName: string | null;
  price: number;
  /** Si está definida, la clase es de un solo día en esa fecha (reserva puntual). */
  oneOffDate: string | null;
}

export interface Occurrence extends SlotInfo {
  /** YYYY-MM-DD */
  date: string;
  sessionId: number | null;
  status: "programada" | "impartida" | "cancelada";
  /** Plan de asistencia del alumno actual (si se pidió para un alumno). */
  myPlan?: "pendiente" | "asistire" | "no_asistire";
}

const slotInfoSelect = {
  id: slots.id,
  teacherId: slots.teacherId,
  teacherName: users.name,
  weekday: slots.weekday,
  startTime: slots.startTime,
  durationMin: slots.durationMin,
  kind: slots.kind,
  groupId: slots.groupId,
  groupName: groups.name,
  studentId: slots.studentId,
  price: slots.price,
  oneOffDate: slots.oneOffDate,
};

async function slotsWithNames(where: ReturnType<typeof and>): Promise<SlotInfo[]> {
  const student = alias(users, "student");
  const rows = await db
    .select({ ...slotInfoSelect, studentUser: student.name })
    .from(slots)
    .innerJoin(users, eq(users.id, slots.teacherId))
    .leftJoin(groups, eq(groups.id, slots.groupId))
    .leftJoin(student, eq(student.id, slots.studentId))
    .where(where)
    .orderBy(asc(slots.weekday), asc(slots.startTime));

  return rows.map((r) => ({
    id: r.id,
    teacherId: r.teacherId,
    teacherName: r.teacherName,
    weekday: r.weekday,
    startTime: r.startTime,
    durationMin: r.durationMin,
    kind: r.kind,
    groupId: r.groupId,
    groupName: r.groupName,
    studentId: r.studentId,
    studentName: r.studentUser,
    price: r.price,
    oneOffDate: r.oneOffDate,
  }));
}

/** Horario semanal de un profesor (solo horas activas). */
export async function teacherSlots(teacherId: number): Promise<SlotInfo[]> {
  return slotsWithNames(and(eq(slots.teacherId, teacherId), eq(slots.active, true)));
}

/** Todas las horas activas (vista admin). */
export async function allSlots(): Promise<SlotInfo[]> {
  return slotsWithNames(and(eq(slots.active, true)));
}

/** Horas en las que participa un alumno (individuales suyas o de sus grupos). */
export async function studentSlots(studentId: number): Promise<SlotInfo[]> {
  const myGroups = db
    .select({ id: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.studentId, studentId));

  return slotsWithNames(
    and(
      eq(slots.active, true),
      or(eq(slots.studentId, studentId), inArray(slots.groupId, myGroups)),
    ),
  );
}

/**
 * Expande horas semanales a ocurrencias concretas entre hoy y `days` días,
 * y las cruza con las filas de `sessions`/`attendance` ya existentes.
 */
export async function upcomingOccurrences(
  slotList: SlotInfo[],
  days: number,
  forStudentId?: number,
  opts?: { includePastToday?: boolean },
): Promise<Occurrence[]> {
  if (slotList.length === 0) return [];

  const today = new Date();
  const from = toDateKey(today);
  const until = new Date(today);
  until.setDate(until.getDate() + days);
  const to = toDateKey(until);

  const slotIds = slotList.map((s) => s.id);
  const existing = await db
    .select({
      id: sessions.id,
      slotId: sessions.slotId,
      date: sessions.date,
      status: sessions.status,
    })
    .from(sessions)
    .where(
      and(
        inArray(sessions.slotId, slotIds),
        gte(sessions.date, from),
        lte(sessions.date, to),
      ),
    );
  const byKey = new Map(existing.map((s) => [`${s.slotId}|${s.date}`, s]));

  const plans = forStudentId
    ? await db
        .select({
          sessionId: attendance.sessionId,
          plan: attendance.plan,
        })
        .from(attendance)
        .where(
          and(
            eq(attendance.studentId, forStudentId),
            inArray(
              attendance.sessionId,
              existing.map((s) => s.id).concat(-1),
            ),
          ),
        )
    : [];
  const planBySession = new Map(plans.map((p) => [p.sessionId, p.plan]));

  const out: Occurrence[] = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const weekday = isoWeekday(d);
    const dateKey = toDateKey(d);
    for (const slot of slotList) {
      // Clase de un solo día: solo aparece en su fecha exacta.
      if (slot.oneOffDate) {
        if (slot.oneOffDate !== dateKey) continue;
      } else if (slot.weekday !== weekday) {
        continue;
      }
      // Hoy: por defecto ocultamos clases ya pasadas de hora. Los profesores
      // (includePastToday) las ven para poder marcarlas como impartidas.
      if (i === 0 && slot.startTime < nowHHMM() && !opts?.includePastToday) continue;
      const session = byKey.get(`${slot.id}|${dateKey}`);
      out.push({
        ...slot,
        date: dateKey,
        sessionId: session?.id ?? null,
        status: session?.status ?? "programada",
        myPlan: session ? (planBySession.get(session.id) ?? "pendiente") : "pendiente",
      });
    }
  }
  return out.sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );
}

function nowHHMM(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

/** Crea (o recupera) la fila de sesión para una ocurrencia slot+fecha. */
export async function getOrCreateSession(
  slotId: number,
  date: string,
): Promise<number> {
  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId)).limit(1);
  if (!slot) throw new Error("La hora ya no existe");

  const [row] = await db
    .insert(sessions)
    .values({
      slotId,
      date,
      price: slot.price,
      durationMin: slot.durationMin,
    })
    .onConflictDoNothing({ target: [sessions.slotId, sessions.date] })
    .returning({ id: sessions.id });
  if (row) return row.id;

  const [existing] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.slotId, slotId), eq(sessions.date, date)))
    .limit(1);
  return existing.id;
}

/** Alumnos que participan en una hora (el asignado o los miembros del grupo). */
export async function slotParticipants(
  slotId: number,
): Promise<{ id: number; name: string; phone: string | null }[]> {
  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId)).limit(1);
  if (!slot) return [];

  if (slot.kind === "individual") {
    if (!slot.studentId) return [];
    return db
      .select({ id: users.id, name: users.name, phone: users.phone })
      .from(users)
      .where(eq(users.id, slot.studentId));
  }

  if (!slot.groupId) return [];
  return db
    .select({ id: users.id, name: users.name, phone: users.phone })
    .from(users)
    .innerJoin(groupMembers, eq(groupMembers.studentId, users.id))
    .where(eq(groupMembers.groupId, slot.groupId))
    .orderBy(asc(users.name));
}

/* ----------------------------------------------------------------------------
 * Informes (admin): horas trabajadas, ingresos, asistencias
 * ------------------------------------------------------------------------- */

export interface TeacherReport {
  teacherId: number;
  teacherName: string;
  sessionsGiven: number;
  hoursWorked: number;
  income: number;
}

/** Resumen por profesor de sesiones impartidas en un rango de fechas. */
export async function teacherReports(
  from: string,
  to: string,
): Promise<TeacherReport[]> {
  const rows = await db
    .select({
      teacherId: slots.teacherId,
      teacherName: users.name,
      sessionsGiven: sql<number>`count(*)::int`,
      minutes: sql<number>`coalesce(sum(coalesce(${sessions.durationMin}, ${slots.durationMin})), 0)::int`,
      income: sql<number>`coalesce(sum(coalesce(${sessions.price}, ${slots.price})), 0)::real`,
    })
    .from(sessions)
    .innerJoin(slots, eq(slots.id, sessions.slotId))
    .innerJoin(users, eq(users.id, slots.teacherId))
    .where(
      and(
        eq(sessions.status, "impartida"),
        gte(sessions.date, from),
        lte(sessions.date, to),
      ),
    )
    .groupBy(slots.teacherId, users.name)
    .orderBy(desc(sql`count(*)`));

  return rows.map((r) => ({
    teacherId: r.teacherId,
    teacherName: r.teacherName,
    sessionsGiven: r.sessionsGiven,
    hoursWorked: Math.round((r.minutes / 60) * 10) / 10,
    income: r.income,
  }));
}

export interface SessionLog {
  sessionId: number;
  date: string;
  startTime: string;
  teacherName: string;
  kind: "individual" | "grupal";
  className: string;
  status: "programada" | "impartida" | "cancelada";
  price: number;
  attendees: number;
  absents: number;
}

/** Historial de sesiones con recuento de asistencia, para los informes. */
export async function sessionLog(from: string, to: string): Promise<SessionLog[]> {
  const student = alias(users, "student");
  const rows = await db
    .select({
      sessionId: sessions.id,
      date: sessions.date,
      startTime: slots.startTime,
      teacherName: users.name,
      kind: slots.kind,
      groupName: groups.name,
      studentName: student.name,
      status: sessions.status,
      price: sql<number>`coalesce(${sessions.price}, ${slots.price})::real`,
      attendees: sql<number>`(select count(*) from attendance a where a.session_id = ${sessions.id} and a.attended = true)::int`,
      absents: sql<number>`(select count(*) from attendance a where a.session_id = ${sessions.id} and a.attended = false)::int`,
    })
    .from(sessions)
    .innerJoin(slots, eq(slots.id, sessions.slotId))
    .innerJoin(users, eq(users.id, slots.teacherId))
    .leftJoin(groups, eq(groups.id, slots.groupId))
    .leftJoin(student, eq(student.id, slots.studentId))
    .where(and(gte(sessions.date, from), lte(sessions.date, to)))
    .orderBy(desc(sessions.date), asc(slots.startTime));

  return rows.map((r) => ({
    sessionId: r.sessionId,
    date: r.date,
    startTime: r.startTime,
    teacherName: r.teacherName,
    kind: r.kind,
    className:
      r.kind === "grupal" ? (r.groupName ?? "Grupo") : (r.studentName ?? "Individual"),
    status: r.status,
    price: r.price,
    attendees: r.attendees,
    absents: r.absents,
  }));
}
