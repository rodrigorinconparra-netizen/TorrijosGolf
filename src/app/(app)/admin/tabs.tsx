"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/negocio", label: "Negocio" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/grupos", label: "Grupos" },
  { href: "/admin/horarios", label: "Horarios" },
  { href: "/admin/disponibilidad", label: "Disponibilidad" },
  { href: "/admin/pista", label: "Pista" },
  { href: "/admin/solicitudes", label: "Solicitudes" },
  { href: "/admin/informes", label: "Informes" },
  { href: "/admin/avisos", label: "Avisos" },
  { href: "/admin/eventos", label: "Eventos" },
];

export function AdminTabs({ pendingRequests = 0 }: { pendingRequests?: number }) {
  const pathname = usePathname();
  return (
    <nav className="glass-soft flex gap-1 overflow-x-auto p-1.5">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        const badge = t.href === "/admin/solicitudes" ? pendingRequests : 0;
        return (
          <Link
            key={t.href}
            href={t.href}
            prefetch={false}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition",
              active
                ? "bg-accent text-on-accent shadow-[0_6px_16px_rgba(31,108,92,0.25)]"
                : "text-ink-soft hover:bg-black/5",
            )}
          >
            {t.label}
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
  );
}
