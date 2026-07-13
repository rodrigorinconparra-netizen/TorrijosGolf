"use client";

import { useActionState, useEffect, useState } from "react";
import { Search, X, UsersRound, Check } from "lucide-react";
import { initials } from "@/lib/utils";
import { createGroupChatAction, type ChatActionState } from "../actions";

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

/** Formulario para crear un chat de grupo: nombre + miembros por búsqueda. */
export function GroupChatForm() {
  const [state, action, pending] = useActionState<ChatActionState, FormData>(
    createGroupChatAction,
    {},
  );
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person[]>([]);

  useEffect(() => {
    let active = true;
    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/chat/search?mode=group&q=${encodeURIComponent(q)}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as { people: Person[] };
        if (active) setResults(data.people ?? []);
      } catch {
        if (active) setResults([]);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [q]);

  const selectedIds = new Set(selected.map((s) => s.id));
  const visibleResults = results.filter((r) => !selectedIds.has(r.id));

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-soft">
          Nombre del grupo
        </label>
        <input name="title" required placeholder="p. ej. Amigos del club" className="field" />
      </div>

      {selected.map((p) => (
        <input key={p.id} type="hidden" name="memberIds" value={p.id} />
      ))}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-soft">
          Miembros ({selected.length})
        </label>
        {selected.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selected.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected((s) => s.filter((x) => x.id !== p.id))}
                className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-deep transition hover:bg-negative/10 hover:text-negative"
              >
                {p.name}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-2 rounded-2xl border border-black/8 bg-white/80 px-3">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar personas para añadir…"
            className="w-full bg-transparent py-3 text-[15px] text-ink outline-none placeholder:text-faint"
          />
        </div>

        {visibleResults.length > 0 ? (
          <ul className="mt-2 max-h-64 space-y-1 overflow-auto">
            {visibleResults.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected((s) => [...s, p]);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-black/5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-on-accent">
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
                  <Check className="h-4 w-4 shrink-0 text-faint" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {state.error ? (
        <p className="rounded-2xl bg-negative/10 px-4 py-2.5 text-sm text-negative">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || selected.length === 0}
        className="btn-primary"
      >
        <UsersRound className="h-4 w-4" />
        {pending ? "Creando…" : "Crear grupo"}
      </button>
    </form>
  );
}
