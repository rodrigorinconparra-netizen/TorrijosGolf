"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bookingRequests, teacherAvailability, users } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { isGuardianOf } from "@/lib/queries";
import { hasBookingConflict } from "@/lib/booking";
import { notifyUsers } from "@/lib/notify";
import { isoWeekday } from "@/lib/utils";

export interface BookingState {
  error?: string;
  ok?: string;
}

const bookingSchema = z.object({
  availabilityId: z.coerce.number().int().positive(),
  kind: z.enum(["puntual", "mensual"]),
  date: z.string().optional(),
  studentId: z.coerce.number().int().positive().optional(),
  note: z.string().trim().max(300).optional(),
});

/**
 * Un alumno (o un padre en nombre de su hijo) reserva una hora libre de un
 * profesor: puntual (un día) o mensual (clase semanal). Queda pendiente de que
 * el club la confirme.
 */
export async function requestBookingAction(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const user = await requireSession();
  const parsed = bookingSchema.safeParse({
    availabilityId: formData.get("availabilityId"),
    kind: formData.get("kind"),
    date: formData.get("date") || undefined,
    studentId: formData.get("studentId") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const d = parsed.data;

  // ¿Para quién es la clase? El propio alumno o un hijo suyo.
  let studentId = user.userId;
  if (d.studentId && d.studentId !== user.userId) {
    if (!(await isGuardianOf(user.userId, d.studentId))) {
      return { error: "No puedes reservar para esa persona" };
    }
    studentId = d.studentId;
  }

  const [av] = await db
    .select()
    .from(teacherAvailability)
    .where(eq(teacherAvailability.id, d.availabilityId))
    .limit(1);
  if (!av || !av.active) return { error: "Esa hora ya no está disponible" };

  let date: string | null = null;
  if (d.kind === "puntual") {
    if (!d.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) {
      return { error: "Elige el día de la clase" };
    }
    const chosen = new Date(`${d.date}T00:00:00`);
    if (isoWeekday(chosen) !== av.weekday) {
      return { error: "El día elegido no coincide con el día de esa hora libre" };
    }
    if (chosen < new Date(new Date().toDateString())) {
      return { error: "Elige una fecha futura" };
    }
    date = d.date;
  }

  // Evita dobles reservas: si esa hora (ese día) ya está cogida, no dejar.
  if (
    await hasBookingConflict({
      teacherId: av.teacherId,
      weekday: av.weekday,
      startTime: av.startTime,
      kind: d.kind,
      date,
    })
  ) {
    return {
      error:
        d.kind === "puntual"
          ? "Esa hora ya está reservada ese día. Elige otra fecha."
          : "Esa hora semanal ya está reservada.",
    };
  }

  await db.insert(bookingRequests).values({
    studentId,
    teacherId: av.teacherId,
    availabilityId: av.id,
    weekday: av.weekday,
    startTime: av.startTime,
    durationMin: av.durationMin,
    price: av.price,
    kind: d.kind,
    date,
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
      title: "Nueva reserva por confirmar",
      body: `${user.name} ha reservado una clase ${d.kind === "mensual" ? "semanal" : "puntual"}. Revísala en Solicitudes.`,
      link: "/admin/solicitudes",
    },
  );

  revalidatePath("/admin/solicitudes");
  return {
    ok: "Reserva enviada. El club la confirmará y te avisaremos.",
  };
}
