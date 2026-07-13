"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

export interface ChildActionState {
  error?: string;
  ok?: string;
}

const childSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del hijo/a"),
  license: z.string().trim().max(20).optional(),
  birthdate: z.string().optional(),
});

/**
 * Registra un hijo/a menor gestionado por el usuario actual. Es una cuenta de
 * alumno SIN login (email sintético y contraseña aleatoria): el padre actúa en
 * su nombre y recibe sus avisos.
 */
export async function registerChildAction(
  _prev: ChildActionState,
  formData: FormData,
): Promise<ChildActionState> {
  const parent = await requireSession();
  const parsed = childSchema.safeParse({
    name: formData.get("name"),
    license: formData.get("license") || undefined,
    birthdate: formData.get("birthdate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const d = parsed.data;
  const birthdate =
    d.birthdate && /^\d{4}-\d{2}-\d{2}$/.test(d.birthdate) ? d.birthdate : null;

  await db.insert(users).values({
    name: d.name,
    // Email sintético único (no se usa para login) y contraseña aleatoria.
    email: `menor-${randomUUID()}@torrijosgolf.local`,
    passwordHash: await hashPassword(randomUUID()),
    role: "alumno",
    license: d.license,
    birthdate,
    guardianId: parent.userId,
    // Un menor gestionado no aparece en búsquedas ni recibe push propias.
    discoverable: false,
    groupAddable: false,
    pushEnabled: false,
  });

  revalidatePath("/dashboard");
  return { ok: `${d.name} añadido/a como hijo/a` };
}

/** El padre/tutor elimina la cuenta de un hijo que gestiona. */
export async function deleteChildAction(formData: FormData): Promise<void> {
  const parent = await requireSession();
  const childId = Number(formData.get("childId"));
  if (!childId) return;
  // Solo puede borrar a sus propios hijos.
  await db
    .delete(users)
    .where(and(eq(users.id, childId), eq(users.guardianId, parent.userId)));
  revalidatePath("/dashboard");
}
