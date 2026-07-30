"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookingRequests, offerRequests } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";

/** El alumno elimina una reserva de clase que había enviado (solo la suya). */
export async function deleteMyBookingRequestAction(
  formData: FormData,
): Promise<void> {
  const user = await requireSession();
  const id = Number(formData.get("id"));
  if (!id) return;
  await db
    .delete(bookingRequests)
    .where(
      and(eq(bookingRequests.id, id), eq(bookingRequests.studentId, user.userId)),
    );
  revalidatePath("/solicitudes");
  revalidatePath("/admin/solicitudes");
}

/** El alumno elimina una solicitud de oferta que había enviado (solo la suya). */
export async function deleteMyOfferRequestAction(
  formData: FormData,
): Promise<void> {
  const user = await requireSession();
  const id = Number(formData.get("id"));
  if (!id) return;
  await db
    .delete(offerRequests)
    .where(and(eq(offerRequests.id, id), eq(offerRequests.studentId, user.userId)));
  revalidatePath("/solicitudes");
  revalidatePath("/admin/ofertas");
}
