"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  attendance,
  classRequests,
  classRequestStudents,
  groupMembers,
  scheduleChangeRequests,
  sessions,
  slots,
  trainingAssignments,
  trainings,
  users,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { getOrCreateSession, slotParticipants } from "@/lib/classes";
import { conversationIdForGroup, postGroupTrainingMessage } from "@/lib/chat";
import { studentIdsOfTeacher, isGuardianOf } from "@/lib/queries";
import { notifyUser, notifyUsers } from "@/lib/notify";
import { formatDate } from "@/lib/utils";

export interface ActionState {
  error?: string;
  ok?: string;
}

/* ----------------------------------------------------------------------------
 * Alumno: confirmar asistencia
 * ------------------------------------------------------------------------- */

const planSchema = z.object({
  slotId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plan: z.enum(["asistire", "no_asistire"]),
  // Opcional: confirmar en nombre de un hijo menor.
  studentId: z.coerce.number().int().positive().optional(),
});

export async function setAttendancePlanAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const parsed = planSchema.safeParse({
    slotId: formData.get("slotId"),
    date: formData.get("date"),
    plan: formData.get("plan"),
    studentId: formData.get("studentId") || undefined,
  });
  if (!parsed.success) return;
  const { slotId, date, plan } = parsed.data;

  // Por defecto el propio usuario; si se pasa un hijo, debe ser su tutor.
  let studentId = user.userId;
  let studentName = user.name;
  if (parsed.data.studentId && parsed.data.studentId !== user.userId) {
    if (!(await isGuardianOf(user.userId, parsed.data.studentId))) return;
    studentId = parsed.data.studentId;
    const [child] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);
    studentName = child?.name ?? studentName;
  }

  // El alumno debe participar en esa hora (directamente o por grupo).
  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId)).limit(1);
  if (!slot) return;
  let participates = slot.studentId === studentId;
  if (!participates && slot.groupId) {
    const [m] = await db
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, slot.groupId), eq(groupMembers.studentId, studentId)),
      )
      .limit(1);
    participates = Boolean(m);
  }
  if (!participates) return;

  const sessionId = await getOrCreateSession(slotId, date);
  await db
    .insert(attendance)
    .values({ sessionId, studentId, plan })
    .onConflictDoUpdate({
      target: [attendance.sessionId, attendance.studentId],
      set: { plan, updatedAt: new Date() },
    });

  // Aviso al profesor si el alumno no va a venir.
  if (plan === "no_asistire") {
    await notifyUser(slot.teacherId, {
      type: "clase",
      title: "Baja en una clase",
      body: `${studentName} no asistirá a la clase del ${formatDate(date)} a las ${slot.startTime}.`,
      link: "/clases",
    });
  }

  revalidatePath("/clases");
  revalidatePath("/dashboard");
  if (studentId !== user.userId) revalidatePath(`/hijos/${studentId}`);
}

/* ----------------------------------------------------------------------------
 * Profesor: pasar lista y marcar la clase impartida / cancelada
 * ------------------------------------------------------------------------- */

const completeSchema = z.object({
  slotId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function completeSessionAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const parsed = completeSchema.safeParse({
    slotId: formData.get("slotId"),
    date: formData.get("date"),
  });
  if (!parsed.success) return;
  const { slotId, date } = parsed.data;

  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId)).limit(1);
  if (!slot) return;
  // Solo el profesor de la hora (o un admin) puede marcarla impartida.
  if (user.role !== "admin" && slot.teacherId !== user.userId) return;

  const sessionId = await getOrCreateSession(slotId, date);
  await db
    .update(sessions)
    .set({ status: "impartida", price: slot.price, durationMin: slot.durationMin })
    .where(eq(sessions.id, sessionId));

  // Pasar lista: checkbox "attended-<studentId>" por participante.
  const participants = await slotParticipants(slotId);
  for (const p of participants) {
    const attended = formData.get(`attended-${p.id}`) === "on";
    await db
      .insert(attendance)
      .values({ sessionId, studentId: p.id, attended })
      .onConflictDoUpdate({
        target: [attendance.sessionId, attendance.studentId],
        set: { attended, updatedAt: new Date() },
      });
  }

  revalidatePath("/clases");
  revalidatePath("/dashboard");
  revalidatePath("/admin/informes");
}

/**
 * Marca la clase como impartida sin pasar lista manualmente: la asistencia se
 * deriva del plan de cada alumno (asistiré/pendiente → asistió; no asistiré → no).
 * Pensado para el acceso rápido desde el panel de Inicio.
 */
export async function quickCompleteSessionAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const parsed = completeSchema.safeParse({
    slotId: formData.get("slotId"),
    date: formData.get("date"),
  });
  if (!parsed.success) return;
  const { slotId, date } = parsed.data;

  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId)).limit(1);
  if (!slot) return;
  if (user.role !== "admin" && slot.teacherId !== user.userId) return;

  const sessionId = await getOrCreateSession(slotId, date);
  await db
    .update(sessions)
    .set({ status: "impartida", price: slot.price, durationMin: slot.durationMin })
    .where(eq(sessions.id, sessionId));

  const participants = await slotParticipants(slotId);
  const plans = await db
    .select({ studentId: attendance.studentId, plan: attendance.plan })
    .from(attendance)
    .where(eq(attendance.sessionId, sessionId));
  const planBy = new Map(plans.map((p) => [p.studentId, p.plan]));

  for (const p of participants) {
    const attended = planBy.get(p.id) !== "no_asistire";
    await db
      .insert(attendance)
      .values({ sessionId, studentId: p.id, attended })
      .onConflictDoUpdate({
        target: [attendance.sessionId, attendance.studentId],
        set: { attended, updatedAt: new Date() },
      });
  }

  revalidatePath("/clases");
  revalidatePath("/dashboard");
  revalidatePath("/admin/informes");
}

export async function cancelSessionAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const parsed = completeSchema.safeParse({
    slotId: formData.get("slotId"),
    date: formData.get("date"),
  });
  if (!parsed.success) return;
  const { slotId, date } = parsed.data;

  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId)).limit(1);
  if (!slot) return;
  if (user.role !== "admin" && slot.teacherId !== user.userId) return;

  const sessionId = await getOrCreateSession(slotId, date);
  await db
    .update(sessions)
    .set({ status: "cancelada" })
    .where(eq(sessions.id, sessionId));

  const participants = await slotParticipants(slotId);
  await notifyUsers(
    participants.map((p) => p.id),
    {
      type: "clase",
      title: "Clase cancelada",
      body: `La clase del ${formatDate(date)} a las ${slot.startTime} se ha cancelado.`,
      link: "/clases",
    },
  );

  revalidatePath("/clases");
  revalidatePath("/dashboard");
  revalidatePath("/admin/informes");
}

/* ----------------------------------------------------------------------------
 * Entrenamientos
 * ------------------------------------------------------------------------- */

const trainingSchema = z.object({
  title: z.string().trim().min(2, "Escribe un título"),
  description: z.string().trim().min(2, "Describe el entrenamiento"),
  target: z.string().min(1, "Elige un destinatario"),
});

/**
 * El profesor envía un entrenamiento. `target` es "todos", "grupo:<id>" o
 * "alumno:<id>".
 */
export async function sendTrainingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireSession();
  if (user.role === "alumno") return { error: "Solo para profesores" };

  const parsed = trainingSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    target: formData.get("target"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const { title, description, target } = parsed.data;

  let studentIds: number[] = [];
  let groupId: number | null = null;
  if (target === "todos") {
    studentIds = await studentIdsOfTeacher(user.userId);
  } else if (target.startsWith("grupo:")) {
    groupId = Number(target.slice(6));
    const members = await db
      .select({ id: groupMembers.studentId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
    studentIds = members.map((m) => m.id);
  } else if (target.startsWith("alumno:")) {
    studentIds = [Number(target.slice(7))];
  }
  studentIds = studentIds.filter(Boolean);
  if (studentIds.length === 0) {
    return { error: "No hay alumnos a los que enviar este entrenamiento" };
  }

  const [training] = await db
    .insert(trainings)
    .values({ teacherId: user.userId, title, description })
    .returning();

  await db
    .insert(trainingAssignments)
    .values(studentIds.map((studentId) => ({ trainingId: training.id, studentId })))
    .onConflictDoNothing();

  // Si el destino es un grupo con chat, publicamos el entrenamiento como una
  // tarjeta en la conversación del grupo, donde se ve quién lo ha completado.
  let link = "/clases";
  if (groupId != null) {
    const convId = await conversationIdForGroup(groupId);
    if (convId != null) {
      await postGroupTrainingMessage(convId, user.userId, training.id, title);
      link = `/chat/${convId}`;
      revalidatePath(`/chat/${convId}`);
    }
  }

  await notifyUsers(studentIds, {
    type: "entrenamiento",
    title: "Nuevo entrenamiento",
    body: `${user.name} te ha enviado: ${title}`,
    link,
  });

  revalidatePath("/clases");
  revalidatePath("/chat");
  return { ok: `Entrenamiento enviado a ${studentIds.length} ${studentIds.length === 1 ? "alumno" : "alumnos"}` };
}

/** El alumno (o el padre en su nombre) marca un entrenamiento como completado. */
export async function toggleTrainingAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const assignmentId = Number(formData.get("assignmentId"));
  if (!assignmentId) return;

  const [assignment] = await db
    .select()
    .from(trainingAssignments)
    .where(eq(trainingAssignments.id, assignmentId))
    .limit(1);
  if (!assignment) return;
  // El propio alumno, o su padre/tutor si es un menor gestionado.
  const owns =
    assignment.studentId === user.userId ||
    (await isGuardianOf(user.userId, assignment.studentId));
  if (!owns) return;

  const completed = !assignment.completed;
  await db
    .update(trainingAssignments)
    .set({ completed, completedAt: completed ? new Date() : null })
    .where(eq(trainingAssignments.id, assignmentId));

  if (completed) {
    const [training] = await db
      .select()
      .from(trainings)
      .where(eq(trainings.id, assignment.trainingId))
      .limit(1);
    const [student] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, assignment.studentId))
      .limit(1);
    if (training) {
      await notifyUser(training.teacherId, {
        type: "entrenamiento",
        title: "Entrenamiento completado",
        body: `${student?.name ?? "Un alumno"} ha completado "${training.title}".`,
        link: "/clases",
      });
    }
  }

  revalidatePath("/clases");
  revalidatePath("/dashboard");
  if (assignment.studentId !== user.userId) {
    revalidatePath(`/hijos/${assignment.studentId}`);
  }
}

/** El profesor elimina un entrenamiento que envió. */
export async function deleteTrainingAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const trainingId = Number(formData.get("trainingId"));
  if (!trainingId) return;
  await db
    .delete(trainings)
    .where(
      user.role === "admin"
        ? eq(trainings.id, trainingId)
        : and(eq(trainings.id, trainingId), eq(trainings.teacherId, user.userId)),
    );
  revalidatePath("/clases");
}

/* ----------------------------------------------------------------------------
 * Solicitud de nueva clase (profesor → admin)
 * ------------------------------------------------------------------------- */

const classRequestSchema = z.object({
  kind: z.enum(["individual", "grupal"]),
  groupName: z.string().trim().optional(),
  studentId: z.coerce.number().int().optional(),
  studentIds: z.array(z.coerce.number().int().positive()).optional(),
  weekday: z.coerce.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida"),
  durationMin: z.coerce.number().int().min(15).max(240),
  price: z.coerce.number().min(0).default(0),
  note: z.string().trim().max(500).optional(),
});

/**
 * El profesor propone una nueva clase (individual o grupo con alumnos). No se
 * crea nada real: queda pendiente de que un admin la acepte.
 */
export async function createClassRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireSession();
  if (user.role !== "profesor") return { error: "Solo para profesores" };

  const parsed = classRequestSchema.safeParse({
    kind: formData.get("kind"),
    groupName: formData.get("groupName") || undefined,
    studentId: formData.get("studentId") || undefined,
    studentIds: formData.getAll("studentIds"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    durationMin: formData.get("durationMin"),
    price: formData.get("price") || 0,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const d = parsed.data;

  const studentIds = (d.studentIds ?? []).filter(Boolean);
  if (d.kind === "grupal") {
    if (!d.groupName || d.groupName.length < 2) {
      return { error: "Ponle un nombre al grupo" };
    }
    if (studentIds.length === 0) return { error: "Añade al menos un alumno al grupo" };
  } else if (!d.studentId) {
    return { error: "Elige el alumno de la clase individual" };
  }

  const [req] = await db
    .insert(classRequests)
    .values({
      teacherId: user.userId,
      kind: d.kind,
      groupName: d.kind === "grupal" ? d.groupName : null,
      studentId: d.kind === "individual" ? d.studentId : null,
      weekday: d.weekday,
      startTime: d.startTime,
      durationMin: d.durationMin,
      price: d.price,
      note: d.note,
    })
    .returning();

  if (d.kind === "grupal" && studentIds.length) {
    await db
      .insert(classRequestStudents)
      .values(studentIds.map((studentId) => ({ requestId: req.id, studentId })));
  }

  // Avisa a todos los admins.
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));
  await notifyUsers(
    admins.map((a) => a.id),
    {
      type: "clase",
      title: "Nueva clase por confirmar",
      body: `${user.name} propone una clase ${d.kind === "grupal" ? "grupal" : "individual"}. Revísala para aceptarla o rechazarla.`,
      link: "/admin/solicitudes",
    },
  );

  revalidatePath("/admin/solicitudes");
  return { ok: "Solicitud enviada al club. Te avisaremos cuando la revisen." };
}

const scheduleChangeSchema = z.object({
  slotId: z.coerce.number().int().positive(),
  weekday: z.coerce.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida"),
  durationMin: z.coerce.number().int().min(15).max(240),
  note: z.string().trim().max(500).optional(),
});

/** El profesor propone cambiar el horario de una de sus horas. */
export async function requestScheduleChangeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireSession();
  if (user.role !== "profesor") return { error: "Solo para profesores" };

  const parsed = scheduleChangeSchema.safeParse({
    slotId: formData.get("slotId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    durationMin: formData.get("durationMin"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const d = parsed.data;

  // La hora debe ser del profesor.
  const [slot] = await db.select().from(slots).where(eq(slots.id, d.slotId)).limit(1);
  if (!slot || slot.teacherId !== user.userId) {
    return { error: "Esa hora no es tuya" };
  }

  await db.insert(scheduleChangeRequests).values({
    slotId: d.slotId,
    teacherId: user.userId,
    weekday: d.weekday,
    startTime: d.startTime,
    durationMin: d.durationMin,
    note: d.note,
  });

  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));
  await notifyUsers(
    admins.map((a) => a.id),
    {
      type: "clase",
      title: "Cambio de horario propuesto",
      body: `${user.name} propone cambiar el horario de una clase. Revísalo para aceptarlo o rechazarlo.`,
      link: "/admin/solicitudes",
    },
  );

  revalidatePath("/admin/solicitudes");
  return { ok: "Propuesta de cambio enviada al club." };
}
