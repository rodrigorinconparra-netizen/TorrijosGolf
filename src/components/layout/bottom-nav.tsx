"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItemsFor } from "./nav";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/jwt";

/** Barra inferior móvil: los destinos principales. Lo secundario vive en el menú de la navbar. */
export function BottomNav({
  role,
  chatUnread = 0,
  adminPending = 0,
  requestsPending = 0,
}: {
  role: Role;
  chatUnread?: number;
  adminPending?: number;
  requestsPending?: number;
}) {
  const pathname = usePathname();
  const items = navItemsFor(role).filter((i) => i.primary);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] md:hidden">
      <div className="glass flex items-center justify-around px-2 py-2">
        {items.map((item) => {
          const { href, icon: Icon } = item;
          const active = pathname === href || pathname.startsWith(href + "/");
          const badge =
            href === "/chat"
              ? chatUnread
              : href === "/admin"
                ? adminPending
                : href === "/solicitudes"
                  ? requestsPending
                  : 0;
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition",
                active ? "text-accent" : "text-faint",
              )}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {badge > 0 ? (
                  <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-negative px-1 text-[9px] font-semibold text-on-accent">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
