"use client";

import { useActionState, useState } from "react";
import { Save, Minus, Plus } from "lucide-react";
import { adminUpsertRoundAction, type LeagueState } from "../../liga-actions";
import type { HoleInfo } from "./round-card";

interface Option {
  id: number;
  name: string;
}

/**
 * El admin registra o corrige la vuelta de cualquier jugador (p. ej. tarjeta
 * en papel). Si el jugador ya tenía vuelta en esa jornada, se sobrescribe.
 */
export function AdminRoundForm({
  leagueId,
  holes,
  people,
}: {
  leagueId: number;
  holes: HoleInfo[];
  people: Option[];
}) {
  const [state, action, pending] = useActionState<LeagueState, FormData>(
    adminUpsertRoundAction,
    {},
  );
  const [scores, setScores] = useState<number[]>(new Array(holes.length).fill(0));

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="scores" value={JSON.stringify(scores)} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-muted">
          Jugador
          <select name="playerId" required className="field mt-1" defaultValue="">
            <option value="" disabled>
              Elige jugador…
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Fecha de la vuelta
          <input name="date" type="date" required className="field mt-1" />
        </label>
        <label className="text-xs font-medium text-muted">
          Barra
          <select name="barra" className="field mt-1" defaultValue="amarillas">
            <option value="amarillas">Amarillas</option>
            <option value="rojas">Rojas</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {holes.map((h, i) => (
          <div key={h.n} className="rounded-xl bg-white/60 px-2 py-2 text-center">
            <p className="text-[11px] text-muted">
              Hoyo {h.n} <span className="text-faint">· par {h.par}</span>
            </p>
            <div className="mt-1 flex items-center justify-center gap-1">
              <button
                type="button"
                disabled={scores[i] <= 0}
                onClick={() =>
                  setScores((prev) => prev.map((s, j) => (j === i ? s - 1 : s)))
                }
                className="grid h-6 w-6 place-items-center rounded-lg bg-black/5 text-ink-soft disabled:opacity-30"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span
                className={`w-7 text-lg font-semibold ${
                  scores[i] === 0 ? "text-faint" : "text-ink"
                }`}
              >
                {scores[i] === 0 ? "·" : scores[i]}
              </span>
              <button
                type="button"
                onClick={() =>
                  setScores((prev) =>
                    prev.map((s, j) => (j === i ? (s === 0 ? h.par : s + 1) : s)),
                  )
                }
                className="grid h-6 w-6 place-items-center rounded-lg bg-accent/10 text-accent"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {state.error ? (
        <p className="rounded-2xl bg-negative/10 px-4 py-2.5 text-sm text-negative">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-2xl bg-positive/10 px-4 py-2.5 text-sm text-positive">
          {state.ok}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-primary">
        <Save className="h-4 w-4" />
        {pending ? "Guardando…" : "Guardar vuelta"}
      </button>
    </form>
  );
}
