"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItemsFor } from "./nav";
import { cn } from "@/lib/utils";
import { TorrijosMark } from "@/components/torrijos-mark";
import type { Role } from "@/lib/auth/jwt";

export function Sidebar({
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
  const items = navItemsFor(role);

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col p-4 md:flex">
      <div className="glass flex h-full flex-col p-4">
        <div className="flex items-center px-2 py-2">
          <TorrijosMark height={40} />
        </div>

        <nav className="mt-5 flex flex-1 flex-col gap-1">
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
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-accent text-on-accent shadow-[0_8px_20px_rgba(31,108,92,0.25)]"
                    : "text-ink-soft hover:bg-black/5",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="flex-1">{item.label}</span>
                {badge > 0 ? (
                  <span
                    className={cn(
                      "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold",
                      active ? "bg-white/25 text-on-accent" : "bg-negative text-on-accent",
                    )}
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <p className="px-2 text-[11px] text-faint">Torrijos Golf · v0.1</p>
      </div>
    </aside>
  );
}
