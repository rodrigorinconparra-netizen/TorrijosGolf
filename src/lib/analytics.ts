import "server-only";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  attendance,
  bookingRequests,
  sessions,
  slots,
  teacherAvailability,
  users,
} from "@/lib/db/schema";
import { studentIdsOfTeacher } from "@/lib/queries";
import { teacherReports } from "@/lib/classes";
import { toDateKey } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Helpers de fechas
 * ------------------------------------------------------------------------- */

function monthBounds(offset = 0): { from: string; to: string; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return {
    from: toDateKey(start),
    to: toDateKey(end),
    label: start.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
  };
}

/* ----------------------------------------------------------------------------
 * KPIs del mes (y comparación con el mes anterior)
 * ------------------------------------------------------------------------- */

export interface MonthKpis {
  income: number;
  sessions: number;
  hours: number;
  activeStudents: number;
  newUsers: number;
  bookings: number;
}

async function kpisForRange(from: string, to: string): Promise<MonthKpis> {
  const [rev] = await db
    .select({
      income: sql<number>`coalesce(sum(coalesce(${sessions.price}, ${slots.price})), 0)::real`,
      sessions: sql<number>`count(*)::int`,
      minutes: sql<number>`coalesce(sum(coalesce(${sessions.durationMin}, ${slots.durationMin})), 0)::int`,
    })
    .from(sessions)
    .innerJoin(slots, eq(slots.id, sessions.slotId))
    .where(
      and(
        eq(sessions.status, "impartida"),
        gte(sessions.date, from),
        lte(sessions.date, to),
      ),
    );

  const [active] = await db
    .select({ n: sql<number>`count(distinct ${attendance.studentId})::int` })
    .from(attendance)
    .innerJoin(sessions, eq(sessions.id, attendance.sessionId))
    .where(
      and(
        eq(attendance.attended, true),
        eq(sessions.status, "impartida"),
        gte(sessions.date, from),
        lte(sessions.date, to),
      ),
    );

  const [nu] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(
      and(
        gte(users.createdAt, new Date(`${from}T00:00:00`)),
        lte(users.createdAt, new Date(`${to}T23:59:59`)),
      ),
    );

  const [bk] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.status, "aceptada"),
        gte(bookingRequests.createdAt, new Date(`${from}T00:00:00`)),
        lte(bookingRequests.createdAt, new Date(`${to}T23:59:59`)),
      ),
    );

  return {
    income: Math.round((rev?.income ?? 0) * 100) / 100,
    sessions: rev?.sessions ?? 0,
    hours: Math.round(((rev?.minutes ?? 0) / 60) * 10) / 10,
    activeStudents: active?.n ?? 0,
    newUsers: nu?.n ?? 0,
    bookings: bk?.n ?? 0,
  };
}

export async function monthKpis(): Promise<{ current: MonthKpis; previous: MonthKpis }> {
  const cur = monthBounds(0);
  const prev = monthBounds(-1);
  const [current, previous] = await Promise.all([
    kpisForRange(cur.from, cur.to),
    kpisForRange(prev.from, prev.to),
  ]);
  return { current, previous };
}

/* ----------------------------------------------------------------------------
 * Serie mensual de ingresos / clases (para el gráfico)
 * ------------------------------------------------------------------------- */

export interface MonthPoint {
  key: string;
  label: string;
  income: number;
  sessions: number;
  hours: number;
}

export async function monthlySeries(months = 12): Promise<MonthPoint[]> {
  const first = monthBounds(-(months - 1));
  const rows = await db
    .select({
      ym: sql<string>`to_char(${sessions.date}::date, 'YYYY-MM')`,
      income: sql<number>`coalesce(sum(coalesce(${sessions.price}, ${slots.price})), 0)::real`,
      sessions: sql<number>`count(*)::int`,
      minutes: sql<number>`coalesce(sum(coalesce(${sessions.durationMin}, ${slots.durationMin})), 0)::int`,
    })
    .from(sessions)
    .innerJoin(slots, eq(slots.id, sessions.slotId))
    .where(and(eq(sessions.status, "impartida"), gte(sessions.date, first.from)))
    .groupBy(sql`to_char(${sessions.date}::date, 'YYYY-MM')`);

  const byKey = new Map(rows.map((r) => [r.ym, r]));
  const out: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const b = monthBounds(-i);
    const key = b.from.slice(0, 7);
    const r = byKey.get(key);
    out.push({
      key,
      label: b.label,
      income: Math.round((r?.income ?? 0) * 100) / 100,
      sessions: r?.sessions ?? 0,
      hours: Math.round(((r?.minutes ?? 0) / 60) * 10) / 10,
    });
  }
  return out;
}

/* ----------------------------------------------------------------------------
 * Rendimiento por profesor
 * ------------------------------------------------------------------------- */

export interface TeacherPerf {
  teacherId: number;
  teacherName: string;
  hourlyRate: number | null;
  students: number;
  sessionsMonth: number;
  hoursMonth: number;
  incomeMonth: number;
  incomeTotal: number;
  freeHours: number;
}

export async function teacherPerformance(): Promise<TeacherPerf[]> {
  const cur = monthBounds(0);
  const [monthRep, totalRep] = await Promise.all([
    teacherReports(cur.from, cur.to),
    teacherReports("1900-01-01", "2999-12-31"),
  ]);
  const totalById = new Map(totalRep.map((r) => [r.teacherId, r.income]));
  const monthById = new Map(monthRep.map((r) => [r.teacherId, r]));

  const teachers = await db
    .select({ id: users.id, name: users.name, hourlyRate: users.hourlyRate })
    .from(users)
    .where(eq(users.role, "profesor"))
    .orderBy(users.name);

  const free = await db
    .select({
      teacherId: teacherAvailability.teacherId,
      n: sql<number>`count(*)::int`,
    })
    .from(teacherAvailability)
    .where(eq(teacherAvailability.active, true))
    .groupBy(teacherAvailability.teacherId);
  const freeById = new Map(free.map((f) => [f.teacherId, f.n]));

  const out: TeacherPerf[] = [];
  for (const t of teachers) {
    const m = monthById.get(t.id);
    const students = (await studentIdsOfTeacher(t.id)).length;
    out.push({
      teacherId: t.id,
      teacherName: t.name,
      hourlyRate: t.hourlyRate,
      students,
      sessionsMonth: m?.sessionsGiven ?? 0,
      hoursMonth: m?.hoursWorked ?? 0,
      incomeMonth: m?.income ?? 0,
      incomeTotal: Math.round((totalById.get(t.id) ?? 0) * 100) / 100,
      freeHours: freeById.get(t.id) ?? 0,
    });
  }
  return out.sort((a, b) => b.incomeTotal - a.incomeTotal);
}

/* ----------------------------------------------------------------------------
 * Actividad por alumno
 * ------------------------------------------------------------------------- */

export interface StudentActivity {
  studentId: number;
  name: string;
  attended: number;
  noShows: number;
  spent: number;
  lastDate: string | null;
}

export async function studentActivity(): Promise<StudentActivity[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      attended: sql<number>`count(*) filter (where ${sessions.status} = 'impartida' and ${attendance.attended} = true)::int`,
      noShows: sql<number>`count(*) filter (where ${sessions.status} = 'impartida' and ${attendance.attended} = false)::int`,
      spent: sql<number>`coalesce(sum(coalesce(${sessions.price}, ${slots.price})) filter (where ${sessions.status} = 'impartida' and ${attendance.attended} = true), 0)::real`,
      lastDate: sql<string | null>`max(${sessions.date}) filter (where ${sessions.status} = 'impartida' and ${attendance.attended} = true)`,
    })
    .from(users)
    .leftJoin(attendance, eq(attendance.studentId, users.id))
    .leftJoin(sessions, eq(sessions.id, attendance.sessionId))
    .leftJoin(slots, eq(slots.id, sessions.slotId))
    .where(eq(users.role, "alumno"))
    .groupBy(users.id, users.name);

  return rows
    .map((r) => ({
      studentId: r.id,
      name: r.name,
      attended: r.attended,
      noShows: r.noShows,
      spent: Math.round(r.spent * 100) / 100,
      lastDate: r.lastDate,
    }))
    .sort((a, b) => b.spent - a.spent);
}

/* ----------------------------------------------------------------------------
 * Control de usuarios y ocupación
 * ------------------------------------------------------------------------- */

export interface UserBreakdown {
  alumnos: number;
  profesores: number;
  admins: number;
  minors: number;
  newThisMonth: number;
  activeThisMonth: number;
  total: number;
}

export async function userBreakdown(): Promise<UserBreakdown> {
  const roles = await db
    .select({ role: users.role, n: sql<number>`count(*)::int` })
    .from(users)
    .groupBy(users.role);
  const byRole = Object.fromEntries(roles.map((r) => [r.role, r.n]));

  const [minors] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.guardianId} is not null`);

  const cur = monthBounds(0);
  const [nu] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(gte(users.createdAt, new Date(`${cur.from}T00:00:00`)));

  const [active] = await db
    .select({ n: sql<number>`count(distinct ${attendance.studentId})::int` })
    .from(attendance)
    .innerJoin(sessions, eq(sessions.id, attendance.sessionId))
    .where(
      and(
        eq(attendance.attended, true),
        eq(sessions.status, "impartida"),
        gte(sessions.date, cur.from),
        lte(sessions.date, cur.to),
      ),
    );

  const total = (byRole["alumno"] ?? 0) + (byRole["profesor"] ?? 0) + (byRole["admin"] ?? 0);
  return {
    alumnos: byRole["alumno"] ?? 0,
    profesores: byRole["profesor"] ?? 0,
    admins: byRole["admin"] ?? 0,
    minors: minors?.n ?? 0,
    newThisMonth: nu?.n ?? 0,
    activeThisMonth: active?.n ?? 0,
    total,
  };
}

export interface Occupancy {
  totalSlots: number;
  assigned: number;
  free: number;
  freeAvailability: number;
}

export async function occupancy(): Promise<Occupancy> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      assigned: sql<number>`count(*) filter (where ${slots.studentId} is not null or ${slots.groupId} is not null)::int`,
    })
    .from(slots)
    .where(and(eq(slots.active, true), sql`${slots.oneOffDate} is null`));

  const [av] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(teacherAvailability)
    .where(eq(teacherAvailability.active, true));

  const total = row?.total ?? 0;
  const assigned = row?.assigned ?? 0;
  return {
    totalSlots: total,
    assigned,
    free: total - assigned,
    freeAvailability: av?.n ?? 0,
  };
}
