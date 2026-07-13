"use client";

import { useEffect, useState } from "react";
import { Search, MessageSquarePlus } from "lucide-react";
import { initials } from "@/lib/utils";
import { startDmAction } from "./actions";

interface Person {
  id: number;
  name: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Club",
  profesor: "Profesor",
  alumno: "Alumno",
};

/** Buscador para iniciar un DM con cualquier persona visible del club. */
export function PeopleSearch() {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/chat/search?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { people: Person[] };
        if (active) setPeople(data.people ?? []);
      } catch {
        if (active) setPeople([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [q, open]);

  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2 rounded-2xl border border-black/8 bg-white/80 px-3">
        <Search className="h-4 w-4 shrink-0 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Buscar una persona para escribirle…"
          className="w-full bg-transparent py-3 text-[15px] text-ink outline-none placeholder:text-faint"
        />
      </div>

      {open ? (
        <div className="mt-3">
          {loading && people.length === 0 ? (
            <p className="px-1 py-2 text-sm text-faint">Buscando…</p>
          ) : people.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted">
              {q
                ? "Nadie coincide (o han ocultado su perfil en Ajustes)."
                : "Escribe un nombre para buscar."}
            </p>
          ) : (
            <ul className="space-y-1">
              {people.map((p) => (
                <li key={p.id}>
                  <form action={startDmAction} className="flex items-center gap-3">
                    <input type="hidden" name="otherId" value={p.id} />
                    <button
                      type="submit"
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-black/5"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-on-accent">
                        {initials(p.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {p.name}
                        </span>
                        <span className="block text-xs text-muted">
                          {ROLE_LABEL[p.role] ?? p.role}
                        </span>
                      </span>
                      <MessageSquarePlus className="h-4 w-4 shrink-0 text-accent" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
