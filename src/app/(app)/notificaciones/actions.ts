"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";

export async function markAllReadAction(): Promise<void> {
  const user = await requireSession();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.userId), isNull(notifications.readAt)));
  revalidatePath("/notificaciones");
}
