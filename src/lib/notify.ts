import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { sendPushToUsers } from "@/lib/push";
import { sendMail, mailTemplate } from "@/lib/mail";
import { mapToResponsibleUsers } from "@/lib/queries";

type NotificationType = "general" | "clase" | "entrenamiento" | "evento" | "chat";

interface NotifyOptions {
  type?: NotificationType;
  title: string;
  body: string;
  /** Ruta interna, p. ej. "/eventos". La push la lleva en data.link. */
  link?: string;
  /** Además de in-app + push, enviar también email. */
  email?: boolean;
}

/**
 * Notifica a un conjunto de usuarios por todos los canales:
 * in-app (siempre), push nativa (si FCM está configurado) y email (opcional,
 * si Resend está configurado). Best-effort: nunca lanza.
 */
export async function notifyUsers(
  userIds: number[],
  opts: NotifyOptions,
): Promise<void> {
  // Los avisos dirigidos a un menor gestionado los recibe su padre/tutor.
  const ids = await mapToResponsibleUsers([...new Set(userIds)]);
  if (ids.length === 0) return;

  await db.insert(notifications).values(
    ids.map((userId) => ({
      userId,
      type: opts.type ?? "general",
      title: opts.title,
      body: opts.body,
      link: opts.link,
    })),
  );

  await sendPushToUsers(ids, {
    title: opts.title,
    body: opts.body,
    data: opts.link ? { link: opts.link } : undefined,
  });

  if (opts.email) {
    const rows = await db
      .select({ email: users.email })
      .from(users)
      .where(inArray(users.id, ids));
    await sendMail(
      rows.map((r) => r.email),
      `Torrijos Golf — ${opts.title}`,
      mailTemplate(opts.title, opts.body),
    );
  }
}

export async function notifyUser(
  userId: number,
  opts: NotifyOptions,
): Promise<void> {
  await notifyUsers([userId], opts);
}
