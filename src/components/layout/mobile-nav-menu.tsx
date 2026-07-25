"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { navItemsFor } from "./nav";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/jwt";

/** Navegación móvil: vive en la barra superior (navbar) como botón de menú. */
export function MobileNavMenu({
  role,
  requestsPending = 0,
}: {
  role: Role;
  requestsPending?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al pulsar fuera del menú o con Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // La barra inferior tiene los destinos principales; este menú, el resto.
  const items = navItemsFor(role).filter((i) => !i.primary);
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        onClick={(e) => {
          setOpen((o) => !o);
          e.currentTarget.blur();
        }}
        aria-label="Menú"
        aria-expanded={open}
        className={cn(
          "relative grid h-9 w-9 place-items-center rounded-xl border border-black/8 text-ink-soft outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-accent/40",
          open ? "bg-white text-accent" : "bg-white/70",
        )}
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        {!open && requestsPending > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-negative ring-2 ring-white" />
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 origin-top-left animate-[menuIn_140ms_ease-out]">
          <div className="max-h-[75vh] space-y-0.5 overflow-auto rounded-2xl border border-black/10 bg-white p-1.5 shadow-[0_18px_44px_rgba(28,28,30,0.18)]">
            {items.map((item) => {
              const { href, icon: Icon } = item;
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-accent text-on-accent shadow-[0_6px_16px_rgba(31,108,92,0.28)]"
                      : "text-ink-soft hover:bg-sand-deep/40",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-on-accent" : "text-muted",
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {href === "/solicitudes" && requestsPending > 0 ? (
                    <span
                      className={cn(
                        "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold",
                        active ? "bg-white/25 text-on-accent" : "bg-negative text-on-accent",
                      )}
                    >
                      {requestsPending > 9 ? "9+" : requestsPending}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
