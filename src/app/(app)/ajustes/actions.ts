"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession, destroySession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { parseTeacherProfile } from "@/lib/teacher-profile";
import { fetchHandicapByLicense, handicapForLicense } from "@/lib/rfeg";

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

  const [current] = await db
    .select({ license: users.license })
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);

  await db
    .update(users)
    .set({
      name: parsed.data.name,
      phone: parsed.data.phone,
      license: parsed.data.license,
    })
    .where(eq(users.id, user.userId));

  // Si la licencia es nueva o ha cambiado, intenta traer el hándicap de la RFEG
  // (best-effort: si falla, el perfil se guarda igual).
  let hcpNote = "";
  if (parsed.data.license && parsed.data.license !== current?.license) {
    const hcp = await handicapForLicense(parsed.data.license);
    if (hcp !== null) {
      await db
        .update(users)
        .set({ handicapIndex: hcp })
        .where(eq(users.id, user.userId));
      hcpNote = ` Hándicap actualizado: ${hcp}.`;
    }
  }

  revalidatePath("/ajustes");
  return { ok: `Perfil actualizado.${hcpNote}` };
}

/** Botón manual: refresca el hándicap del usuario desde la RFEG por su licencia. */
export async function refreshMyHandicapAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const user = await requireSession();
  const [row] = await db
    .select({ license: users.license })
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);
  if (!row?.license) {
    return { error: "Añade primero tu número de licencia en el perfil." };
  }

  const res = await fetchHandicapByLicense(row.license);
  const hcp = res ? res.handicap : null;
  if (hcp === null) {
    return {
      error:
        "No hemos podido obtener tu hándicap de la RFEG. Comprueba que tu licencia es correcta.",
    };
  }

  await db.update(users).set({ handicapIndex: hcp }).where(eq(users.id, user.userId));
  revalidatePath("/ajustes");
  return {
    ok: `Hándicap actualizado: ${hcp}${res?.name ? ` · ${res.name}` : ""}.`,
  };
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

const deleteSchema = z.object({
  password: z.string().min(1, "Escribe tu contraseña para confirmar"),
});

/**
 * Elimina permanentemente la cuenta del usuario y todos sus datos. Requiere la
 * contraseña como confirmación. Las claves foráneas borran/anulan en cascada
 * (reservas, mensajes, solicitudes, hijos menores…). Cierra la sesión al acabar.
 */
export async function deleteAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireSession();
  const parsed = deleteSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }

  const [row] = await db.select().from(users).where(eq(users.id, user.userId)).limit(1);
  if (!row || !(await verifyPassword(parsed.data.password, row.passwordHash))) {
    return { error: "La contraseña no es correcta" };
  }

  // No dejar al club sin acceso: no permitir borrar al único administrador.
  if (row.role === "admin") {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "admin"));
    if (n <= 1) {
      return {
        error:
          "Eres el único administrador. Nombra a otro administrador antes de eliminar tu cuenta.",
      };
    }
  }

  await db.delete(users).where(eq(users.id, user.userId));
  await destroySession();
  redirect("/cuenta-eliminada");
}
