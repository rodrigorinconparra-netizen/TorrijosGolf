import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  attendance,
  classRequests,
  groupMembers,
  groups,
  scheduleChangeRequests,
  sessions,
  slots,
  trainingAssignments,
  trainings,
  users,
} from "@/lib/db/schema";
import { chatContacts, studentIdsOfTeacher } from "@/lib/queries";
import { toDateKey } from "@/lib/utils";

function monthStartKey(): string {
  const n = new Date();
  return toDateKey(new Date(n.getFullYear(), n.getMonth(), 1));
}

export interface BasicUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  license: string | null;
  role: "admin" | "profesor" | "alumno";
  hourlyRate: number | null;
  pushEnabled: boolean;
  discoverable: boolean;
  groupAddable: boolean;
  guardianId: number | null;
  birthdate: string | null;
  title: string | null;
  bio: string | null;
  specialties: string | null;
  experienceYears: number | null;
  handicapIndex: number | null;
  sex: "hombre" | "mujer" | null;
  createdAt: Date;
}

export async function getUserBasic(userId: number): Promise<BasicUser | null> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    license: u.license,
    role: u.role,
    hourlyRate: u.hourlyRate,
    pushEnabled: u.pushEnabled,
    discoverable: u.discoverable,
    groupAddable: u.groupAddable,
    guardianId: u.guardianId,
    birthdate: u.birthdate,
    title: u.title,
    bio: u.bio,
    specialties: u.specialties,
    experienceYears: u.experienceYears,
    handicapIndex: u.handicapIndex,
    sex: u.sex,
    createdAt: u.createdAt,
  };
}

/** Relación familiar: padre/tutor de este usuario y sus hijos gestionados. */
export async function familyOf(userId: number): Promise<{
  guardian: { id: number; name: string } | null;
  children: { id: number; name: string }[];
}> {
  const [me] = await db
    .select({ guardianId: users.guardianId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  let guardian: { id: number; name: string } | null = null;
  if (me?.guardianId) {
    const [g] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, me.guardianId))
      .limit(1);
    guardian = g ?? null;
  }

  const children = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.guardianId, userId))
    .orderBy(users.name);

  return { guardian, children };
}

/* ----------------------------------------------------------------------------
 * CRM de alumno
 * ------------------------------------------------------------------------- */

export interface StudentClassRow {
  date: string;
  startTime: string;
  className: string;
  teacherName: string;
  price: number;
  attended: boolean | null;
  status: "programada" | "impartida" | "cancelada";
}

export interface StudentCrm {
  attendedCount: number;
  noShowCount: number;
  upcomingCount: number;
  spent: number;
  groups: string[];
  teachers: string[];
  trainings: {
    total: number;
    completed: number;
    list: { title: string; teacherName: string; completed: boolean; createdAt: Date }[];
  };
  classes: StudentClassRow[];
}

export async function studentCrm(userId: number): Promise<StudentCrm> {
  const teacher = alias(users, "teacher");
  const rows = await db
    .select({
      date: sessions.date,
      startTime: slots.startTime,
      kind: slots.kind,
      groupName: groups.name,
      teacherName: teacher.name,
      studentName: users.name,
      price: sql<number>`coalesce(${sessions.price}, ${slots.price})::real`,
      attended: attendance.attended,
      plan: attendance.plan,
      status: sessions.status,
    })
    .from(attendance)
    .innerJoin(sessions, eq(sessions.id, attendance.sessionId))
    .innerJoin(slots, eq(slots.id, sessions.slotId))
    .innerJoin(teacher, eq(teacher.id, slots.teacherId))
    .leftJoin(groups, eq(groups.id, slots.groupId))
    .innerJoin(users, eq(users.id, attendance.studentId))
    .where(eq(attendance.studentId, userId))
    .orderBy(desc(sessions.date), desc(slots.startTime));

  let attendedCount = 0;
  let noShowCount = 0;
  let upcomingCount = 0;
  let spent = 0;
  const classes: StudentClassRow[] = [];

  for (const r of rows) {
    const className =
      r.kind === "grupal" ? (r.groupName ?? "Grupo") : "Clase individual";
    if (r.status === "impartida") {
      if (r.attended) {
        attendedCount++;
        spent += r.price;
      } else if (r.attended === false) {
        noShowCount++;
      }
    } else if (r.status === "programada") {
      upcomingCount++;
    }
    classes.push({
      date: r.date,
      startTime: r.startTime,
      className,
      teacherName: r.teacherName,
      price: r.price,
      attended: r.attended,
      status: r.status,
    });
  }

  const groupRows = await db
    .select({ name: groups.name })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.studentId, userId));

  const contacts = await chatContacts(userId, "alumno");
  const teachers = contacts.filter((c) => c.role === "profesor").map((c) => c.name);

  const trainingRows = await db
    .select({
      title: trainings.title,
      teacherName: users.name,
      completed: trainingAssignments.completed,
      createdAt: trainings.createdAt,
    })
    .from(trainingAssignments)
    .innerJoin(trainings, eq(trainings.id, trainingAssignments.trainingId))
    .innerJoin(users, eq(users.id, trainings.teacherId))
    .where(eq(trainingAssignments.studentId, userId))
    .orderBy(desc(trainings.createdAt));

  return {
    attendedCount,
    noShowCount,
    upcomingCount,
    spent,
    groups: groupRows.map((g) => g.name),
    teachers,
    trainings: {
      total: trainingRows.length,
      completed: trainingRows.filter((t) => t.completed).length,
      list: trainingRows,
    },
    classes,
  };
}

/* ----------------------------------------------------------------------------
 * CRM de profesor: "absolutamente todo lo que hace"
 * ------------------------------------------------------------------------- */

export interface TeacherSessionRow {
  date: string;
  startTime: string;
  className: string;
  kind: "individual" | "grupal";
  price: number;
  attendees: number;
  absents: number;
  status: "programada" | "impartida" | "cancelada";
}

export interface TeacherCrm {
  sessionsGiven: number;
  hoursWorked: number;
  income: number;
  incomeMonth: number;
  hoursMonth: number;
  sessionsMonth: number;
  studentsCount: number;
  students: string[];
  groups: { name: string; members: number }[];
  slots: {
    weekday: number;
    startTime: string;
    durationMin: number;
    kind: "individual" | "grupal";
    price: number;
    target: string;
  }[];
  trainings: {
    count: number;
    list: { title: string; done: number; total: number; createdAt: Date }[];
  };
  classRequests: { pending: number; accepted: number; rejected: number };
  scheduleChanges: { pending: number; accepted: number; rejected: number };
  sessions: TeacherSessionRow[];
}

export async function teacherCrm(userId: number): Promise<TeacherCrm> {
  const monthKey = monthStartKey();

  // Todas las sesiones de las horas de este profesor, con recuento de asistencia.
  const student = alias(users, "student");
  const sessionRows = await db
    .select({
      date: sessions.date,
      startTime: slots.startTime,
      kind: slots.kind,
      groupName: groups.name,
      studentName: student.name,
      status: sessions.status,
      durationMin: sql<number>`coalesce(${sessions.durationMin}, ${slots.durationMin})::int`,
      price: sql<number>`coalesce(${sessions.price}, ${slots.price})::real`,
      attendees: sql<number>`(select count(*) from attendance a where a.session_id = ${sessions.id} and a.attended = true)::int`,
      absents: sql<number>`(select count(*) from attendance a where a.session_id = ${sessions.id} and a.attended = false)::int`,
    })
    .from(sessions)
    .innerJoin(slots, eq(slots.id, sessions.slotId))
    .leftJoin(groups, eq(groups.id, slots.groupId))
    .leftJoin(student, eq(student.id, slots.studentId))
    .where(eq(slots.teacherId, userId))
    .orderBy(desc(sessions.date), desc(slots.startTime));

  let income = 0;
  let incomeMonth = 0;
  let minutes = 0;
  let minutesMonth = 0;
  let sessionsGiven = 0;
  let sessionsMonth = 0;
  const sessionList: TeacherSessionRow[] = [];

  for (const r of sessionRows) {
    const className =
      r.kind === "grupal" ? (r.groupName ?? "Grupo") : (r.studentName ?? "Individual");
    if (r.status === "impartida") {
      sessionsGiven++;
      income += r.price;
      minutes += r.durationMin;
      if (r.date >= monthKey) {
        sessionsMonth++;
        incomeMonth += r.price;
        minutesMonth += r.durationMin;
      }
    }
    sessionList.push({
      date: r.date,
      startTime: r.startTime,
      className,
      kind: r.kind,
      price: r.price,
      attendees: r.attendees,
      absents: r.absents,
      status: r.status,
    });
  }

  const studentNames = (await chatContacts(userId, "profesor"))
    .filter((c) => c.role === "alumno")
    .map((c) => c.name);
  const studentIds = await studentIdsOfTeacher(userId);

  const groupRows = await db
    .select({
      name: groups.name,
      members: sql<number>`count(${groupMembers.id})::int`,
    })
    .from(groups)
    .leftJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(eq(groups.teacherId, userId))
    .groupBy(groups.id, groups.name);

  const slotRows = await db
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
    .where(and(eq(slots.teacherId, userId), eq(slots.active, true)));

  const trainingRows = await db
    .select({
      id: trainings.id,
      title: trainings.title,
      createdAt: trainings.createdAt,
      total: sql<number>`count(${trainingAssignments.id})::int`,
      done: sql<number>`count(*) filter (where ${trainingAssignments.completed})::int`,
    })
    .from(trainings)
    .leftJoin(trainingAssignments, eq(trainingAssignments.trainingId, trainings.id))
    .where(eq(trainings.teacherId, userId))
    .groupBy(trainings.id, trainings.title, trainings.createdAt)
    .orderBy(desc(trainings.createdAt));

  const reqRows = await db
    .select({ status: classRequests.status })
    .from(classRequests)
    .where(eq(classRequests.teacherId, userId));
  const schedRows = await db
    .select({ status: scheduleChangeRequests.status })
    .from(scheduleChangeRequests)
    .where(eq(scheduleChangeRequests.teacherId, userId));

  const countBy = (rows: { status: string }[]) => ({
    pending: rows.filter((r) => r.status === "pendiente").length,
    accepted: rows.filter((r) => r.status === "aceptada").length,
    rejected: rows.filter((r) => r.status === "rechazada").length,
  });

  return {
    sessionsGiven,
    hoursWorked: Math.round((minutes / 60) * 10) / 10,
    income,
    incomeMonth,
    hoursMonth: Math.round((minutesMonth / 60) * 10) / 10,
    sessionsMonth,
    studentsCount: studentIds.length,
    students: studentNames,
    groups: groupRows,
    slots: slotRows.map((s) => ({
      weekday: s.weekday,
      startTime: s.startTime,
      durationMin: s.durationMin,
      kind: s.kind,
      price: s.price,
      target:
        s.kind === "grupal"
          ? (s.groupName ?? "Libre")
          : (s.studentName ?? "Libre"),
    })),
    trainings: { count: trainingRows.length, list: trainingRows },
    classRequests: countBy(reqRows),
    scheduleChanges: countBy(schedRows),
    sessions: sessionList,
  };
}
