"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  bookingRequests,
  classRequests,
  classRequestStudents,
  events,
  groupMembers,
  groups,
  scheduleChangeRequests,
  slots,
  teacherAvailability,
  teacherStudents,
  users,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { notifyUser, notifyUsers } from "@/lib/notify";
import { ensureGroupConversation, syncGroupConversationMembers } from "@/lib/chat";
import { parseTeacherProfile } from "@/lib/teacher-profile";
import { formatDateTime } from "@/lib/utils";

export interface ActionState {
  error?: string;
  ok?: string;
}

/* ----------------------------------------------------------------------------
 * Perfil público de profesor
 * ------------------------------------------------------------------------- */

/** El admin edita el perfil público de un profesor. */
export async function updateTeacherProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  if (!userId) return { error: "Usuario no válido" };
  const parsed = parseTeacherProfile(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const d = parsed.data;
  await db
    .update(users)
    .set({
      title: d.title ?? null,
      specialties: d.specialties ?? null,
      experienceYears: d.experienceYears ?? null,
      bio: d.bio ?? null,
    })
    .where(eq(users.id, userId));
  revalidatePath(`/admin/usuarios/${userId}`);
  revalidatePath(`/clases/profesor/${userId}`);
  return { ok: "Perfil actualizado" };
}

/** El admin fija el hándicap (índice) y el sexo de un jugador (para ligas). */
export async function updateGolfDataAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  if (!userId) return { error: "Usuario no válido" };

  const rawIdx = String(formData.get("handicapIndex") ?? "").trim().replace(",", ".");
  const handicapIndex = rawIdx === "" ? null : Number(rawIdx);
  if (handicapIndex != null && (!Number.isFinite(handicapIndex) || handicapIndex < -10 || handicapIndex > 54)) {
    return { error: "Hándicap no válido (entre -10 y 54)" };
  }
  const rawSex = String(formData.get("sex") ?? "");
  const sex = rawSex === "hombre" || rawSex === "mujer" ? rawSex : null;

  await db
    .update(users)
    .set({ handicapIndex, sex })
    .where(eq(users.id, userId));
  revalidatePath(`/admin/usuarios/${userId}`);
  return { ok: "Datos de juego actualizados" };
}

/* ----------------------------------------------------------------------------
 * Usuarios y profesores
 * ------------------------------------------------------------------------- */

const teacherSchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto"),
  email: z.string().trim().toLowerCase().email("Email no válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  phone: z.string().trim().max(20).optional(),
  license: z.string().trim().max(20).optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
});

/** Alta de un profesor (solo admin). */
export async function createTeacherAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = teacherSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") || undefined,
    license: formData.get("license") || undefined,
    hourlyRate: formData.get("hourlyRate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const data = parsed.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);
  if (existing) return { error: "Ya existe una cuenta con ese email" };

  await db.insert(users).values({
    name: data.name,
    email: data.email,
    passwordHash: await hashPassword(data.password),
    phone: data.phone,
    license: data.license,
    hourlyRate: data.hourlyRate,
    role: "profesor",
  });

  revalidatePath("/admin/usuarios");
  return { ok: `Profesor ${data.name} creado` };
}

/** Cambia el rol de un usuario. */
export async function setRoleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  const role = String(formData.get("role"));
  if (!userId || !["admin", "profesor", "alumno"].includes(role)) return;
  // Un admin no puede quitarse el rol a sí mismo (evita quedarse fuera).
  if (userId === admin.userId) return;
  await db
    .update(users)
    .set({ role: role as "admin" | "profesor" | "alumno" })
    .where(eq(users.id, userId));
  revalidatePath("/admin/usuarios");
}

/** Elimina un usuario y toda su actividad (cascada). */
export async function deleteUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  if (!userId || userId === admin.userId) return;
  await db.delete(users).where(eq(users.id, userId));
  revalidatePath("/admin/usuarios");
}

/** Asigna un alumno a un profesor. */
export async function assignStudentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const teacherId = Number(formData.get("teacherId"));
  const studentId = Number(formData.get("studentId"));
  if (!teacherId || !studentId) return;
  await db
    .insert(teacherStudents)
    .values({ teacherId, studentId })
    .onConflictDoNothing();
  revalidatePath("/admin/usuarios");
}

export async function unassignStudentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const teacherId = Number(formData.get("teacherId"));
  const studentId = Number(formData.get("studentId"));
  if (!teacherId || !studentId) return;
  await db
    .delete(teacherStudents)
    .where(
      and(
        eq(teacherStudents.teacherId, teacherId),
        eq(teacherStudents.studentId, studentId),
      ),
    );
  revalidatePath("/admin/usuarios");
}

/* ----------------------------------------------------------------------------
 * Grupos
 * ------------------------------------------------------------------------- */

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const teacherId = Number(formData.get("teacherId")) || null;
  if (name.length < 2) return { error: "Escribe un nombre para el grupo" };

  const [group] = await db
    .insert(groups)
    .values({ name, description, teacherId })
    .returning({ id: groups.id });
  // Habilita el chat del grupo automáticamente (incluye al profesor si lo hay).
  await ensureGroupConversation(group.id);
  revalidatePath("/admin/grupos");
  return { ok: `Grupo "${name}" creado` };
}

export async function deleteGroupAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const groupId = Number(formData.get("groupId"));
  if (!groupId) return;
  await db.delete(groups).where(eq(groups.id, groupId));
  revalidatePath("/admin/grupos");
}

export async function setGroupTeacherAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const groupId = Number(formData.get("groupId"));
  const teacherId = Number(formData.get("teacherId")) || null;
  if (!groupId) return;
  await db.update(groups).set({ teacherId }).where(eq(groups.id, groupId));
  // El nuevo profesor entra al chat del grupo; el anterior sale.
  await ensureGroupConversation(groupId);
  revalidatePath("/admin/grupos");
}

export async function addGroupMemberAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const groupId = Number(formData.get("groupId"));
  const studentId = Number(formData.get("studentId"));
  if (!groupId || !studentId) return;
  await db.insert(groupMembers).values({ groupId, studentId }).onConflictDoNothing();
  // Al añadir a alguien al grupo, entra automáticamente en su chat.
  await ensureGroupConversation(groupId);
  revalidatePath("/admin/grupos");
}

export async function removeGroupMemberAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const groupId = Number(formData.get("groupId"));
  const studentId = Number(formData.get("studentId"));
  if (!groupId || !studentId) return;
  await db
    .delete(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.studentId, studentId)),
    );
  // Y sale del chat del grupo.
  await syncGroupConversationMembers(groupId);
  revalidatePath("/admin/grupos");
}

/* ----------------------------------------------------------------------------
 * Horarios (horas disponibles de los profesores)
 * ------------------------------------------------------------------------- */

const slotSchema = z.object({
  teacherId: z.coerce.number().int().positive("Elige un profesor"),
  weekday: z.coerce.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida"),
  durationMin: z.coerce.number().int().min(15).max(240),
  kind: z.enum(["individual", "grupal"]),
  groupId: z.coerce.number().int().optional(),
  studentId: z.coerce.number().int().optional(),
  price: z.coerce.number().min(0).default(0),
});

export async function createSlotAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = slotSchema.safeParse({
    teacherId: formData.get("teacherId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    durationMin: formData.get("durationMin"),
    kind: formData.get("kind"),
    groupId: formData.get("groupId") || undefined,
    studentId: formData.get("studentId") || undefined,
    price: formData.get("price") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const d = parsed.data;

  await db.insert(slots).values({
    teacherId: d.teacherId,
    weekday: d.weekday,
    startTime: d.startTime,
    durationMin: d.durationMin,
    kind: d.kind,
    groupId: d.kind === "grupal" ? (d.groupId ?? null) : null,
    studentId: d.kind === "individual" ? (d.studentId ?? null) : null,
    price: d.price,
  });

  revalidatePath("/admin/horarios");
  return { ok: "Hora añadida al horario" };
}

/** Desactiva una hora (se conserva el histórico de sesiones). */
export async function deactivateSlotAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const slotId = Number(formData.get("slotId"));
  if (!slotId) return;
  await db.update(slots).set({ active: false }).where(eq(slots.id, slotId));
  revalidatePath("/admin/horarios");
}

const updateSlotSchema = z.object({
  slotId: z.coerce.number().int().positive(),
  weekday: z.coerce.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida"),
  durationMin: z.coerce.number().int().min(15).max(240),
  price: z.coerce.number().min(0),
});

/** Edita el horario de una hora existente (día, hora, duración, precio). */
export async function updateSlotAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = updateSlotSchema.safeParse({
    slotId: formData.get("slotId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    durationMin: formData.get("durationMin"),
    price: formData.get("price") || 0,
  });
  if (!parsed.success) return;
  const { slotId, weekday, startTime, durationMin, price } = parsed.data;
  await db
    .update(slots)
    .set({ weekday, startTime, durationMin, price })
    .where(eq(slots.id, slotId));
  revalidatePath("/admin/horarios");
  revalidatePath("/clases");
}

/** Cambia el grupo/alumno asociado a una hora existente. */
export async function assignSlotAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const slotId = Number(formData.get("slotId"));
  if (!slotId) return;
  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId)).limit(1);
  if (!slot) return;

  if (slot.kind === "grupal") {
    const groupId = Number(formData.get("groupId")) || null;
    await db.update(slots).set({ groupId }).where(eq(slots.id, slotId));
  } else {
    const studentId = Number(formData.get("studentId")) || null;
    await db.update(slots).set({ studentId }).where(eq(slots.id, slotId));
  }
  revalidatePath("/admin/horarios");
}

/* ----------------------------------------------------------------------------
 * Avisos (notificaciones a todos)
 * ------------------------------------------------------------------------- */

const broadcastSchema = z.object({
  title: z.string().trim().min(2, "Escribe un título"),
  body: z.string().trim().min(2, "Escribe el mensaje"),
  audience: z.enum(["todos", "alumnos", "profesores"]),
  email: z.boolean(),
});

export async function broadcastAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = broadcastSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    audience: formData.get("audience"),
    email: formData.get("email") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const d = parsed.data;

  const targets = await db.select({ id: users.id, role: users.role }).from(users);
  const ids = targets
    .filter((u) =>
      d.audience === "todos"
        ? true
        : d.audience === "alumnos"
          ? u.role === "alumno"
          : u.role === "profesor",
    )
    .map((u) => u.id);

  await notifyUsers(ids, {
    type: "general",
    title: d.title,
    body: d.body,
    email: d.email,
  });

  return { ok: `Aviso enviado a ${ids.length} personas` };
}

/* ----------------------------------------------------------------------------
 * Eventos
 * ------------------------------------------------------------------------- */

const eventSchema = z.object({
  title: z.string().trim().min(2, "Escribe un título"),
  description: z.string().trim().optional(),
  location: z.string().trim().optional(),
  url: z.string().trim().url("Enlace no válido").optional().or(z.literal("")),
  startsAt: z.string().min(1, "Elige fecha y hora"),
  notify: z.boolean(),
  email: z.boolean(),
});

export async function createEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    url: formData.get("url") || undefined,
    startsAt: formData.get("startsAt"),
    notify: formData.get("notify") === "on",
    email: formData.get("email") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const d = parsed.data;
  const startsAt = new Date(d.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { error: "Fecha no válida" };

  await db.insert(events).values({
    title: d.title,
    description: d.description,
    location: d.location,
    url: d.url || null,
    startsAt,
    createdBy: admin.userId,
  });

  if (d.notify) {
    const everyone = await db.select({ id: users.id }).from(users);
    await notifyUsers(
      everyone.map((u) => u.id),
      {
        type: "evento",
        title: `Nuevo evento: ${d.title}`,
        body: `${formatDateTime(startsAt)}${d.location ? ` · ${d.location}` : ""}${
          d.description ? `\n${d.description}` : ""
        }`,
        link: "/eventos",
        email: d.email,
      },
    );
  }

  revalidatePath("/admin/eventos");
  revalidatePath("/eventos");
  return { ok: "Evento creado" };
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = Number(formData.get("eventId"));
  if (!eventId) return;
  await db.delete(events).where(eq(events.id, eventId));
  revalidatePath("/admin/eventos");
  revalidatePath("/eventos");
}

/* ----------------------------------------------------------------------------
 * Solicitudes de clase (aceptar/rechazar lo que proponen los profesores)
 * ------------------------------------------------------------------------- */

/** Acepta una solicitud: crea el grupo/hora reales y habilita su chat. */
export async function acceptClassRequestAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const requestId = Number(formData.get("requestId"));
  const price = Number(formData.get("price")) || 0;
  if (!requestId) return;

  const [req] = await db
    .select()
    .from(classRequests)
    .where(eq(classRequests.id, requestId))
    .limit(1);
  if (!req || req.status !== "pendiente") return;

  if (req.kind === "grupal") {
    const [group] = await db
      .insert(groups)
      .values({ name: req.groupName ?? "Grupo", teacherId: req.teacherId })
      .returning({ id: groups.id });

    const studs = await db
      .select({ id: classRequestStudents.studentId })
      .from(classRequestStudents)
      .where(eq(classRequestStudents.requestId, requestId));
    if (studs.length) {
      await db
        .insert(groupMembers)
        .values(studs.map((s) => ({ groupId: group.id, studentId: s.id })))
        .onConflictDoNothing();
      await db
        .insert(teacherStudents)
        .values(studs.map((s) => ({ teacherId: req.teacherId, studentId: s.id })))
        .onConflictDoNothing();
    }
    // Habilita el chat del grupo con profesor + alumnos.
    await ensureGroupConversation(group.id);
    await db.insert(slots).values({
      teacherId: req.teacherId,
      weekday: req.weekday,
      startTime: req.startTime,
      durationMin: req.durationMin,
      kind: "grupal",
      groupId: group.id,
      price,
    });
  } else {
    if (req.studentId) {
      await db
        .insert(teacherStudents)
        .values({ teacherId: req.teacherId, studentId: req.studentId })
        .onConflictDoNothing();
    }
    await db.insert(slots).values({
      teacherId: req.teacherId,
      weekday: req.weekday,
      startTime: req.startTime,
      durationMin: req.durationMin,
      kind: "individual",
      studentId: req.studentId,
      price,
    });
  }

  await db
    .update(classRequests)
    .set({ status: "aceptada", decidedBy: admin.userId, decidedAt: new Date(), price })
    .where(eq(classRequests.id, requestId));

  await notifyUser(req.teacherId, {
    type: "clase",
    title: "Clase aceptada",
    body: "El club ha aceptado tu clase propuesta. Ya está en tu horario.",
    link: "/clases",
  });

  revalidatePath("/admin/solicitudes");
  revalidatePath("/admin/horarios");
  revalidatePath("/admin/grupos");
  revalidatePath("/clases");
}

/** Rechaza una solicitud, con motivo opcional. */
export async function rejectClassRequestAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const requestId = Number(formData.get("requestId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!requestId) return;

  const [req] = await db
    .select()
    .from(classRequests)
    .where(eq(classRequests.id, requestId))
    .limit(1);
  if (!req || req.status !== "pendiente") return;

  await db
    .update(classRequests)
    .set({ status: "rechazada", decidedBy: admin.userId, decidedAt: new Date() })
    .where(eq(classRequests.id, requestId));

  await notifyUser(req.teacherId, {
    type: "clase",
    title: "Clase no aceptada",
    body: reason || "El club no ha aceptado la clase propuesta.",
    link: "/clases",
  });

  revalidatePath("/admin/solicitudes");
}

/* ----------------------------------------------------------------------------
 * Cambios de horario propuestos por profesores
 * ------------------------------------------------------------------------- */

/** Acepta un cambio de horario: actualiza la hora con los nuevos valores. */
export async function acceptScheduleChangeAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const requestId = Number(formData.get("requestId"));
  if (!requestId) return;

  const [req] = await db
    .select()
    .from(scheduleChangeRequests)
    .where(eq(scheduleChangeRequests.id, requestId))
    .limit(1);
  if (!req || req.status !== "pendiente") return;

  await db
    .update(slots)
    .set({
      weekday: req.weekday,
      startTime: req.startTime,
      durationMin: req.durationMin,
    })
    .where(eq(slots.id, req.slotId));

  await db
    .update(scheduleChangeRequests)
    .set({ status: "aceptada", decidedBy: admin.userId, decidedAt: new Date() })
    .where(eq(scheduleChangeRequests.id, requestId));

  await notifyUser(req.teacherId, {
    type: "clase",
    title: "Cambio de horario aceptado",
    body: "El club ha aceptado el nuevo horario de tu clase.",
    link: "/clases",
  });

  revalidatePath("/admin/solicitudes");
  revalidatePath("/admin/horarios");
  revalidatePath("/clases");
}

/** Rechaza un cambio de horario, con motivo opcional. */
export async function rejectScheduleChangeAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const requestId = Number(formData.get("requestId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!requestId) return;

  const [req] = await db
    .select()
    .from(scheduleChangeRequests)
    .where(eq(scheduleChangeRequests.id, requestId))
    .limit(1);
  if (!req || req.status !== "pendiente") return;

  await db
    .update(scheduleChangeRequests)
    .set({ status: "rechazada", decidedBy: admin.userId, decidedAt: new Date() })
    .where(eq(scheduleChangeRequests.id, requestId));

  await notifyUser(req.teacherId, {
    type: "clase",
    title: "Cambio de horario no aceptado",
    body: reason || "El club no ha aceptado el cambio de horario propuesto.",
    link: "/clases",
  });

  revalidatePath("/admin/solicitudes");
}

/* ----------------------------------------------------------------------------
 * Disponibilidad de profesores (horas libres reservables)
 * ------------------------------------------------------------------------- */

const availabilitySchema = z.object({
  teacherId: z.coerce.number().int().positive("Elige un profesor"),
  weekday: z.coerce.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida"),
  durationMin: z.coerce.number().int().min(15).max(240),
  price: z.coerce.number().min(0).default(0),
});

/** Marca una hora libre (disponible para reservar) de un profesor. */
export async function addAvailabilityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = availabilitySchema.safeParse({
    teacherId: formData.get("teacherId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    durationMin: formData.get("durationMin"),
    price: formData.get("price") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  await db.insert(teacherAvailability).values(parsed.data);
  revalidatePath("/admin/disponibilidad");
  revalidatePath("/reservar");
  return { ok: "Hora libre añadida" };
}

/** Elimina una hora libre. */
export async function deleteAvailabilityAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const availabilityId = Number(formData.get("availabilityId"));
  if (!availabilityId) return;
  await db
    .delete(teacherAvailability)
    .where(eq(teacherAvailability.id, availabilityId));
  revalidatePath("/admin/disponibilidad");
  revalidatePath("/reservar");
}

/* ----------------------------------------------------------------------------
 * Reservas de alumnos (aceptar/rechazar)
 * ------------------------------------------------------------------------- */

/** Acepta una reserva: crea la clase (mensual → hora semanal; puntual → un día). */
export async function acceptBookingAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const bookingId = Number(formData.get("bookingId"));
  const price = Number(formData.get("price")) || 0;
  if (!bookingId) return;

  const [b] = await db
    .select()
    .from(bookingRequests)
    .where(eq(bookingRequests.id, bookingId))
    .limit(1);
  if (!b || b.status !== "pendiente") return;

  // Evita duplicar si esa hora ya se asignó (otra reserva aceptada antes).
  const clash = await db
    .select({ weekday: slots.weekday, oneOffDate: slots.oneOffDate })
    .from(slots)
    .where(
      and(
        eq(slots.teacherId, b.teacherId),
        eq(slots.active, true),
        eq(slots.startTime, b.startTime),
      ),
    );
  const conflict = clash.some((s) =>
    b.kind === "mensual"
      ? s.oneOffDate == null && s.weekday === b.weekday
      : s.oneOffDate === b.date,
  );
  if (conflict) {
    await db
      .update(bookingRequests)
      .set({ status: "rechazada", decidedBy: admin.userId, decidedAt: new Date() })
      .where(eq(bookingRequests.id, bookingId));
    await notifyUser(b.studentId, {
      type: "clase",
      title: "Reserva no confirmada",
      body: "Esa hora ya se había asignado a otra reserva. Prueba con otra.",
      link: "/reservar",
    });
    revalidatePath("/admin/solicitudes");
    return;
  }

  await db.insert(slots).values({
    teacherId: b.teacherId,
    weekday: b.weekday,
    startTime: b.startTime,
    durationMin: b.durationMin,
    kind: "individual",
    studentId: b.studentId,
    price,
    oneOffDate: b.kind === "puntual" ? b.date : null,
  });

  // Una reserva mensual ocupa esa hora: retiramos la disponibilidad recurrente.
  if (b.kind === "mensual" && b.availabilityId) {
    await db
      .update(teacherAvailability)
      .set({ active: false })
      .where(eq(teacherAvailability.id, b.availabilityId));
  }

  // El alumno queda vinculado al profesor.
  await db
    .insert(teacherStudents)
    .values({ teacherId: b.teacherId, studentId: b.studentId })
    .onConflictDoNothing();

  await db
    .update(bookingRequests)
    .set({ status: "aceptada", decidedBy: admin.userId, decidedAt: new Date() })
    .where(eq(bookingRequests.id, bookingId));

  await notifyUser(b.studentId, {
    type: "clase",
    title: "Reserva confirmada",
    body:
      b.kind === "mensual"
        ? "El club ha confirmado tu clase semanal. Ya está en tu horario."
        : "El club ha confirmado tu clase. Ya está en tus próximas clases.",
    link: "/clases",
  });

  revalidatePath("/admin/solicitudes");
  revalidatePath("/admin/horarios");
  revalidatePath("/clases");
  revalidatePath("/reservar");
}

export async function rejectBookingAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const bookingId = Number(formData.get("bookingId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!bookingId) return;

  const [b] = await db
    .select()
    .from(bookingRequests)
    .where(eq(bookingRequests.id, bookingId))
    .limit(1);
  if (!b || b.status !== "pendiente") return;

  await db
    .update(bookingRequests)
    .set({ status: "rechazada", decidedBy: admin.userId, decidedAt: new Date() })
    .where(eq(bookingRequests.id, bookingId));

  await notifyUser(b.studentId, {
    type: "clase",
    title: "Reserva no confirmada",
    body: reason || "El club no ha podido confirmar tu reserva.",
    link: "/reservar",
  });

  revalidatePath("/admin/solicitudes");
}
