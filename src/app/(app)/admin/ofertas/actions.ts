"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { classOffers, offerRequests, users } from "@/lib/db/schema";
import { requireAdmin, requireSession } from "@/lib/auth/session";
import { hasLiveRequest } from "@/lib/offers";
import { notifyUser, notifyUsers } from "@/lib/notify";

export interface OfferState {
  error?: string;
  ok?: string;
}

const MAX_IMG_BYTES = 5 * 1024 * 1024; // 5 MB
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Lee y valida la imagen del cartel. Devuelve base64 + mime, o error/null. */
async function readImage(
  file: FormDataEntryValue | null,
): Promise<{ data: string; mime: string } | { error: string } | null> {
  if (!(file instanceof File) || file.size === 0) return null; // sin imagen
  if (!IMG_TYPES.includes(file.type)) {
    return { error: "El cartel debe ser una imagen JPG, PNG o WEBP" };
  }
  if (file.size > MAX_IMG_BYTES) {
    return { error: "La imagen es demasiado grande (máx. 5 MB)" };
  }
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  return { data, mime: file.type };
}

/* ---------------------------------------------------------------- Admin ---- */

/** El admin publica una nueva oferta (con cartel opcional) y avisa a todos. */
export async function createOfferAction(
  _prev: OfferState,
  formData: FormData,
): Promise<OfferState> {
  const admin = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const classCount = Number(formData.get("classCount")) || null;
  const price = Number(formData.get("price")) || 0;
  if (title.length < 2) return { error: "Escribe un título para la oferta" };

  const img = await readImage(formData.get("image"));
  if (img && "error" in img) return { error: img.error };

  await db.insert(classOffers).values({
    title,
    description,
    classCount,
    price,
    imageData: img && "data" in img ? img.data : null,
    imageMime: img && "data" in img ? img.mime : null,
    createdBy: admin.userId,
  });

  // Aviso a los alumnos.
  const alumnos = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "alumno"));
  await notifyUsers(
    alumnos.map((u) => u.id),
    {
      type: "general",
      title: "Nueva oferta de clases",
      body: title,
      link: "/clases",
    },
  );

  revalidatePath("/admin/ofertas");
  revalidatePath("/clases");
  revalidatePath("/dashboard");
  return { ok: `Oferta "${title}" publicada` };
}

/** Activa o desactiva una oferta (sin borrarla). */
export async function toggleOfferAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("offerId"));
  const active = formData.get("active") === "true";
  if (!id) return;
  await db.update(classOffers).set({ active }).where(eq(classOffers.id, id));
  revalidatePath("/admin/ofertas");
  revalidatePath("/clases");
  revalidatePath("/dashboard");
}

export async function deleteOfferAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("offerId"));
  if (!id) return;
  await db.delete(classOffers).where(eq(classOffers.id, id));
  revalidatePath("/admin/ofertas");
  revalidatePath("/clases");
  revalidatePath("/dashboard");
}

/** Acepta la solicitud de un alumno para una oferta y le avisa. */
export async function acceptOfferRequestAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const requestId = Number(formData.get("requestId"));
  if (!requestId) return;

  const [r] = await db
    .select({
      studentId: offerRequests.studentId,
      status: offerRequests.status,
      title: classOffers.title,
    })
    .from(offerRequests)
    .innerJoin(classOffers, eq(classOffers.id, offerRequests.offerId))
    .where(eq(offerRequests.id, requestId))
    .limit(1);
  if (!r || r.status !== "pendiente") return;

  await db
    .update(offerRequests)
    .set({ status: "aceptada", decidedBy: admin.userId, decidedAt: new Date() })
    .where(eq(offerRequests.id, requestId));

  await notifyUser(r.studentId, {
    type: "clase",
    title: "Oferta confirmada",
    body: `El club ha confirmado tu solicitud de la oferta "${r.title}".`,
    link: "/clases",
  });

  revalidatePath("/admin/ofertas");
}

/** Rechaza la solicitud de un alumno para una oferta y le avisa. */
export async function rejectOfferRequestAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const requestId = Number(formData.get("requestId"));
  if (!requestId) return;

  const [r] = await db
    .select({
      studentId: offerRequests.studentId,
      status: offerRequests.status,
      title: classOffers.title,
    })
    .from(offerRequests)
    .innerJoin(classOffers, eq(classOffers.id, offerRequests.offerId))
    .where(eq(offerRequests.id, requestId))
    .limit(1);
  if (!r || r.status !== "pendiente") return;

  await db
    .update(offerRequests)
    .set({ status: "rechazada", decidedBy: admin.userId, decidedAt: new Date() })
    .where(eq(offerRequests.id, requestId));

  await notifyUser(r.studentId, {
    type: "clase",
    title: "Oferta no confirmada",
    body: `El club no ha podido confirmar tu solicitud de la oferta "${r.title}".`,
    link: "/clases",
  });

  revalidatePath("/admin/ofertas");
}

/* --------------------------------------------------------------- Alumno ---- */

const requestSchema = z.object({
  offerId: z.coerce.number().int().positive(),
  note: z.string().trim().max(300).optional(),
});

/**
 * Un alumno solicita acogerse a una oferta. Queda pendiente de que el club la
 * confirme (igual que una reserva normal), con las condiciones de esa oferta.
 */
export async function requestOfferAction(
  _prev: OfferState,
  formData: FormData,
): Promise<OfferState> {
  const user = await requireSession();
  const parsed = requestSchema.safeParse({
    offerId: formData.get("offerId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "Datos no válidos" };
  const { offerId, note } = parsed.data;

  const [offer] = await db
    .select()
    .from(classOffers)
    .where(eq(classOffers.id, offerId))
    .limit(1);
  if (!offer || !offer.active) return { error: "Esa oferta ya no está disponible" };

  if (await hasLiveRequest(offerId, user.userId)) {
    return { error: "Ya has solicitado esta oferta" };
  }

  await db.insert(offerRequests).values({
    offerId,
    studentId: user.userId,
    note: note ?? null,
  });

  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));
  await notifyUsers(
    admins.map((a) => a.id),
    {
      type: "clase",
      title: "Nueva solicitud de oferta",
      body: `${user.name} ha solicitado la oferta "${offer.title}". Revísala en Ofertas.`,
      link: "/admin/ofertas",
    },
  );

  revalidatePath("/admin/ofertas");
  revalidatePath("/clases");
  revalidatePath("/dashboard");
  return { ok: "Solicitud enviada. El club la confirmará y te avisaremos." };
}
