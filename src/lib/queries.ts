import "server-only";
import { and, eq, isNull, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bookingRequests,
  classRequests,
  groupMembers,
  groups,
  notifications,
  scheduleChangeRequests,
  slots,
  teacherStudents,
  users,
} from "@/lib/db/schema";

/** Nº total de solicitudes pendientes para el admin (badge del panel). */
export async function pendingAdminRequests(): Promise<number> {
  const [[cReq], [sReq], [bReq]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(classRequests)
      .where(eq(classRequests.status, "pendiente")),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(scheduleChangeRequests)
      .where(eq(scheduleChangeRequests.status, "pendiente")),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookingRequests)
      .where(eq(bookingRequests.status, "pendiente")),
  ]);
  return (cReq?.n ?? 0) + (sReq?.n ?? 0) + (bReq?.n ?? 0);
}

/** Nº de notificaciones sin leer (para el badge de la campana). */
export async function unreadNotificationCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

/* ----------------------------------------------------------------------------
 * Padres / hijos (cuentas de menores gestionadas)
 * ------------------------------------------------------------------------- */

export interface ChildLite {
  id: number;
  name: string;
  birthdate: string | null;
}

/** Hijos (menores gestionados) de un padre/tutor. */
export async function childrenOf(guardianId: number): Promise<ChildLite[]> {
  return db
    .select({ id: users.id, name: users.name, birthdate: users.birthdate })
    .from(users)
    .where(eq(users.guardianId, guardianId))
    .orderBy(users.name);
}

/** ¿`guardianId` es el padre/tutor de `childId`? */
export async function isGuardianOf(
  guardianId: number,
  childId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, childId), eq(users.guardianId, guardianId)))
    .limit(1);
  return Boolean(row);
}

/**
 * Reemplaza los ids de menores por los de sus padres/tutores (para dirigirles a
 * ellos los avisos y la participación en el chat). Los adultos quedan igual.
 */
export async function mapToResponsibleUsers(userIds: number[]): Promise<number[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ id: users.id, guardianId: users.guardianId })
    .from(users)
    .where(inArray(users.id, userIds));
  const guardianById = new Map(rows.map((r) => [r.id, r.guardianId]));
  const out = new Set<number>();
  for (const id of userIds) out.add(guardianById.get(id) ?? id);
  return [...out];
}

export interface UserLite {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "profesor" | "alumno";
}

const userLite = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  role: users.role,
};

/**
 * Con quién puede chatear/llamar un usuario:
 *  - admin: todo el mundo
 *  - profesor: sus alumnos (asignados directamente o vía sus grupos o sus horas) + admins
 *  - alumno: sus profesores (por asignación, grupos u horas) + admins
 */
export async function chatContacts(
  userId: number,
  role: "admin" | "profesor" | "alumno",
): Promise<UserLite[]> {
  if (role === "admin") {
    const rows = await db
      .select(userLite)
      .from(users)
      .where(sql`${users.id} <> ${userId}`)
      .orderBy(users.name);
    return rows;
  }

  if (role === "profesor") {
    const direct = db
      .select({ id: teacherStudents.studentId })
      .from(teacherStudents)
      .where(eq(teacherStudents.teacherId, userId));
    const viaGroups = db
      .select({ id: groupMembers.studentId })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groups.teacherId, userId));
    const viaSlots = db
      .select({ id: slots.studentId })
      .from(slots)
      .where(and(eq(slots.teacherId, userId), sql`${slots.studentId} is not null`));

    const rows = await db
      .select(userLite)
      .from(users)
      .where(
        or(
          inArray(users.id, direct),
          inArray(users.id, viaGroups),
          inArray(users.id, viaSlots),
          eq(users.role, "admin"),
        ),
      )
      .orderBy(users.name);
    return rows.filter((u) => u.id !== userId);
  }

  // alumno
  const direct = db
    .select({ id: teacherStudents.teacherId })
    .from(teacherStudents)
    .where(eq(teacherStudents.studentId, userId));
  const viaGroups = db
    .select({ id: groups.teacherId })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(
      and(eq(groupMembers.studentId, userId), sql`${groups.teacherId} is not null`),
    );
  const viaSlots = db
    .select({ id: slots.teacherId })
    .from(slots)
    .where(eq(slots.studentId, userId));

  const rows = await db
    .select(userLite)
    .from(users)
    .where(
      or(
        inArray(users.id, direct),
        inArray(users.id, viaGroups),
        inArray(users.id, viaSlots),
        eq(users.role, "admin"),
      ),
    )
    .orderBy(users.name);
  return rows.filter((u) => u.id !== userId);
}

/** Todos los alumnos de un profesor (asignación directa + grupos + horas). */
export async function studentIdsOfTeacher(teacherId: number): Promise<number[]> {
  const contacts = await chatContacts(teacherId, "profesor");
  return contacts.filter((c) => c.role === "alumno").map((c) => c.id);
}
