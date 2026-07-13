"use client";

import { useActionState, useState } from "react";
import { Trophy } from "lucide-react";
import { createLeagueAction, type LeagueState } from "./liga-actions";

/**
 * Crear competición (admin). De momento el tipo "Eliminatoria" está en camino:
 * la Liga automática (jornadas semanales) es la disponible.
 */
export function LeagueForm() {
  const [state, action, pending] = useActionState<LeagueState, FormData>(
    createLeagueAction,
    {},
  );
  const [tipo, setTipo] = useState<"liga" | "eliminatoria">("liga");

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setTipo("liga")}
          className={
            tipo === "liga"
              ? "btn-primary !px-3.5 !py-2 text-sm"
              : "btn-ghost !px-3.5 !py-2 text-sm"
          }
        >
          Liga
        </button>
        <button
          type="button"
          disabled
          title="Próximamente"
          className="btn-ghost !px-3.5 !py-2 text-sm opacity-50"
        >
          Eliminatoria (próximamente)
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked
          readOnly
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        Liga automática: una jornada por semana; los jugadores crean sus partidas
        cuando quieran eligiendo marcador.
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="title"
          required
          placeholder='Nombre (p. ej. Liga 9 hoyos "Elige tu barra" 2026)'
          className="field"
        />
        <input name="description" placeholder="Descripción (opcional)" className="field" />
        <label className="text-xs font-medium text-muted">
          Recorrido
          <select name="holes" className="field mt-1" defaultValue="1-9">
            <option value="1-9">9 hoyos (1 al 9)</option>
            <option value="10-18">9 hoyos (10 al 18)</option>
            <option value="18">18 hoyos</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Inicio de la jornada 1
          <input name="startDate" type="date" required className="field mt-1" />
        </label>
        <label className="text-xs font-medium text-muted">
          Mínimo de jornadas para clasificar
          <input
            name="minRounds"
            type="number"
            min="1"
            max="50"
            defaultValue="10"
            required
            className="field mt-1"
          />
        </label>
        <label className="text-xs font-medium text-muted">
          Jornadas que cuentan (las mejores)
          <input
            name="countRounds"
            type="number"
            min="1"
            max="50"
            defaultValue="15"
            required
            className="field mt-1"
          />
        </label>
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
        <Trophy className="h-4 w-4" />
        {pending ? "Creando…" : "Crear liga"}
      </button>
    </form>
  );
}
