import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  Bell,
  CalendarDays,
  CheckCheck,
  Dumbbell,
  GraduationCap,
  MessageCircle,
  Megaphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils";
import { markAllReadAction } from "./actions";

export const metadata = { title: "Notificaciones" };

const ICONS: Record<string, LucideIcon> = {
  general: Megaphone,
  clase: GraduationCap,
  entrenamiento: Dumbbell,
  evento: CalendarDays,
  chat: MessageCircle,
};

export default async function NotificationsPage() {
  const user = await requireSession();

  const list = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.userId))
    .orderBy(desc(notifications.createdAt))
    .limit(100);

  const hasUnread = list.some((n) => !n.readAt);

  return (
    <>
      <PageHeader
        title="Notificaciones"
        action={
          hasUnread ? (
            <form action={markAllReadAction}>
              <button type="submit" className="btn-ghost text-sm">
                <CheckCheck className="h-4 w-4" /> Marcar todas leídas
              </button>
            </form>
          ) : undefined
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Sin notificaciones"
          description="Aquí verás avisos del club, clases, entrenamientos y mensajes."
        />
      ) : (
        <div className="glass divide-y divide-black/5 p-2">
          {list.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            const inner = (
              <div
                className={`flex items-start gap-3 rounded-2xl p-3 transition ${
                  n.readAt ? "" : "bg-accent/5"
                } ${n.link ? "hover:bg-black/5" : ""}`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {n.title}
                    {!n.readAt ? (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-accent align-middle" />
                    ) : null}
                  </p>
                  {n.body ? (
                    <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{n.body}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-faint">
                    {formatDateTime(n.createdAt)}
                  </p>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className="block">
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </>
  );
}
