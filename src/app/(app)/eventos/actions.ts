"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventRsvps } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";

/** El usuario se apunta (o se borra) de un evento. */
export async function toggleRsvpAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const eventId = Number(formData.get("eventId"));
  const going = formData.get("going") === "true";
  if (!eventId) return;

  const [existing] = await db
    .select()
    .from(eventRsvps)
    .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, user.userId)))
    .limit(1);

  if (existing) {
    await db
      .update(eventRsvps)
      .set({ going })
      .where(eq(eventRsvps.id, existing.id));
  } else {
    await db.insert(eventRsvps).values({ eventId, userId: user.userId, going });
  }

  revalidatePath("/eventos");
}
