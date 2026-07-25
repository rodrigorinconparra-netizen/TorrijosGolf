import Link from "next/link";
import { LogOut, Bell } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { MobileNavMenu } from "@/components/layout/mobile-nav-menu";
import { TorrijosMark } from "@/components/torrijos-mark";
import { unreadNotificationCount } from "@/lib/queries";
import { pendingRequestsForStudent } from "@/lib/requests";
import { initials } from "@/lib/utils";
import type { SessionPayload } from "@/lib/auth/jwt";

const ROLE_LABEL = { admin: "Admin", profesor: "Profesor", alumno: "Alumno" } as const;

export async function Topbar({ user }: { user: SessionPayload }) {
  const unread = await unreadNotificationCount(user.userId);
  const requestsPending =
    user.role === "alumno" ? await pendingRequestsForStudent(user.userId) : 0;

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-6 px-4 pt-[calc(1rem_+_env(safe-area-inset-top))] sm:-mx-6 sm:px-6">
      <div className="glass flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <MobileNavMenu role={user.role} requestsPending={requestsPending} />
          <div className="flex items-center md:hidden">
            <TorrijosMark height={30} />
          </div>
          <p className="hidden text-sm text-muted md:block">
            Hola,{" "}
            <span className="font-medium text-ink">{user.name.split(" ")[0]}</span> 👋
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user.role !== "alumno" ? (
            <span className="hidden sm:block">
              <Badge tone="accent">{ROLE_LABEL[user.role]}</Badge>
            </span>
          ) : null}
          <Link
            href="/notificaciones"
            title="Notificaciones"
            className="relative grid h-9 w-9 place-items-center rounded-full border border-black/8 bg-white/70 text-ink-soft transition hover:bg-white"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-negative px-1 text-[10px] font-semibold text-on-accent">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>
          <Link
            href="/ajustes"
            title="Tu perfil"
            className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-semibold text-on-accent transition hover:bg-accent-deep"
          >
            {initials(user.name)}
          </Link>
          <form action={logoutAction}>
            <button type="submit" title="Cerrar sesión" className="btn-ghost h-9 w-9 !px-0">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
