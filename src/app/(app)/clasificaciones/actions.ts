"use server";

import { revalidatePath } from "next/cache";
import { eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { rankings, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { notifyUsers } from "@/lib/notify";

export interface RankingState {
  error?: string;
  ok?: string;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Lee y valida el PDF de un FormData. Devuelve base64 o un mensaje de error. */
async function readPdf(
  file: FormDataEntryValue | null,
): Promise<{ data: string; fileName: string } | { error: string } | null> {
  if (!(file instanceof File) || file.size === 0) return null; // sin archivo
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return { error: "El archivo debe ser un PDF" };
  if (file.size > MAX_BYTES) return { error: "El PDF es demasiado grande (máx. 10 MB)" };
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  return { data, fileName: file.name };
}

/** El admin sube una clasificación (PDF) y avisa a todos los usuarios. */
export async function uploadRankingAction(
  _prev: RankingState,
  formData: FormData,
): Promise<RankingState> {
  const admin = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (title.length < 2) return { error: "Escribe un título" };

  const pdf = await readPdf(formData.get("file"));
  if (pdf === null) return { error: "Adjunta el PDF de la clasificación" };
  if ("error" in pdf) return { error: pdf.error };

  await db.insert(rankings).values({
    title,
    description,
    fileName: pdf.fileName,
    mimeType: "application/pdf",
    data: pdf.data,
    createdBy: admin.userId,
  });

  // Aviso a todos los usuarios (in-app + push).
  const everyone = await db
    .select({ id: users.id })
    .from(users)
    .where(ne(users.id, admin.userId));
  await notifyUsers(
    everyone.map((u) => u.id),
    {
      type: "general",
      title: "Nueva clasificación publicada",
      body: title,
      link: "/clasificaciones",
    },
  );

  revalidatePath("/clasificaciones");
  return { ok: `Clasificación "${title}" publicada y notificada` };
}

/** Edita una clasificación: nombre, descripción y, opcionalmente, el PDF. */
export async function editRankingAction(
  _prev: RankingState,
  formData: FormData,
): Promise<RankingState> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return { error: "Clasificación no válida" };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (title.length < 2) return { error: "Escribe un título" };

  const pdf = await readPdf(formData.get("file"));
  if (pdf && "error" in pdf) return { error: pdf.error };

  const values: {
    title: string;
    description: string | null;
    data?: string;
    fileName?: string;
  } = { title, description };
  if (pdf && "data" in pdf) {
    values.data = pdf.data;
    values.fileName = pdf.fileName;
  }

  await db.update(rankings).set(values).where(eq(rankings.id, id));
  revalidatePath("/clasificaciones");
  return { ok: "Clasificación actualizada" };
}

export async function deleteRankingAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(rankings).where(eq(rankings.id, id));
  revalidatePath("/clasificaciones");
}
