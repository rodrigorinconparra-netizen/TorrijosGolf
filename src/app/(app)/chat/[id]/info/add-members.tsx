"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { initials } from "@/lib/utils";
import { addMembersToGroupAction } from "../../actions";

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

/** Busca personas y las añade al chat de grupo actual. */
export function AddMembers({
  conversationId,
  existingIds,
}: {
  conversationId: number;
  existingIds: number[];
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const existing = new Set(existingIds);

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

  const candidates = results.filter((r) => !existing.has(r.id));

  return (
    <div>
      <div className="flex items-center gap-2 rounded-2xl border border-black/8 bg-white/80 px-3">
        <Search className="h-4 w-4 shrink-0 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar personas para añadir…"
          className="w-full bg-transparent py-3 text-[15px] text-ink outline-none placeholder:text-faint"
        />
      </div>

      {candidates.length > 0 ? (
        <ul className="mt-2 max-h-72 space-y-1 overflow-auto">
          {candidates.map((p) => (
            <li key={p.id}>
              <form action={addMembersToGroupAction} className="w-full">
                <input type="hidden" name="conversationId" value={conversationId} />
                <input type="hidden" name="memberIds" value={p.id} />
                <button
                  type="submit"
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
                  <UserPlus className="h-4 w-4 shrink-0 text-accent" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : q ? (
        <p className="mt-2 px-1 text-sm text-muted">Nadie más coincide.</p>
      ) : null}
    </div>
  );
}
