"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";

export interface AuthFormState {
  error?: string;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email no válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Email o contraseña incorrectos" };
  }

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  redirect("/dashboard");
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre completo"),
  email: z.string().trim().toLowerCase().email("Email no válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  license: z
    .string()
    .trim()
    .min(3, "Escribe tu número de licencia")
    .max(20, "Licencia demasiado larga"),
  phone: z.string().trim().max(20, "Teléfono demasiado largo").optional(),
});

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    license: formData.get("license"),
    phone: formData.get("phone") || undefined,
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

  // El primer usuario registrado se convierte en admin para poder configurar
  // el club; el resto entran como alumnos (el admin luego crea profesores).
  const [{ n: userCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users);

  const [user] = await db
    .insert(users)
    .values({
      name: data.name,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      license: data.license,
      phone: data.phone,
      role: userCount === 0 ? "admin" : "alumno",
    })
    .returning();

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
