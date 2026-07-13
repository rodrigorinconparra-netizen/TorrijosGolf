"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { parseTeacherProfile } from "@/lib/teacher-profile";

export interface ActionState {
  error?: string;
  ok?: string;
}

/** El profesor edita su propio perfil público. */
export async function updateMyTeacherProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireSession();
  if (user.role !== "profesor") return { error: "Solo para profesores" };
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
    .where(eq(users.id, user.userId));
  revalidatePath("/ajustes");
  revalidatePath(`/clases/profesor/${user.userId}`);
  return { ok: "Perfil de profesor actualizado" };
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto"),
  phone: z.string().trim().max(20).optional(),
  license: z.string().trim().max(20).optional(),
});

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireSession();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    license: formData.get("license") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  await db
    .update(users)
    .set({
      name: parsed.data.name,
      phone: parsed.data.phone,
      license: parsed.data.license,
    })
    .where(eq(users.id, user.userId));
  revalidatePath("/ajustes");
  return { ok: "Perfil actualizado" };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Escribe tu contraseña actual"),
    next: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
  });

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireSession();
  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }

  const [row] = await db.select().from(users).where(eq(users.id, user.userId)).limit(1);
  if (!row || !(await verifyPassword(parsed.data.current, row.passwordHash))) {
    return { error: "La contraseña actual no es correcta" };
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.next) })
    .where(eq(users.id, user.userId));
  return { ok: "Contraseña actualizada" };
}

export async function togglePushAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const enabled = formData.get("enabled") === "true";
  await db.update(users).set({ pushEnabled: enabled }).where(eq(users.id, user.userId));
  revalidatePath("/ajustes");
}

/** Controla si el usuario aparece en el buscador de personas del chat. */
export async function toggleDiscoverableAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const enabled = formData.get("enabled") === "true";
  await db.update(users).set({ discoverable: enabled }).where(eq(users.id, user.userId));
  revalidatePath("/ajustes");
}

/** Controla si otras personas pueden añadir al usuario a grupos de chat. */
export async function toggleGroupAddableAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const enabled = formData.get("enabled") === "true";
  await db.update(users).set({ groupAddable: enabled }).where(eq(users.id, user.userId));
  revalidatePath("/ajustes");
}
