"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { editLeagueAction, type LeagueState } from "../../liga-actions";

/**
 * Edición de la liga (admin). Con vueltas ya registradas, el recorrido y la
 * fecha de inicio quedan bloqueados (cambiarían tarjetas y jornadas ya jugadas).
 */
export function LeagueEditForm({
  league,
  hasRounds,
}: {
  league: {
    id: number;
    title: string;
    description: string;
    holes: string;
    startDate: string;
    minRounds: number;
    countRounds: number;
  };
  hasRounds: boolean;
}) {
  const [state, action, pending] = useActionState<LeagueState, FormData>(
    editLeagueAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leagueId" value={league.id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-muted">
          Nombre
          <input
            name="title"
            required
            defaultValue={league.title}
            className="field mt-1"
          />
        </label>
        <label className="text-xs font-medium text-muted">
          Descripción
          <input
            name="description"
            defaultValue={league.description}
            className="field mt-1"
          />
        </label>
        <label className="text-xs font-medium text-muted">
          Recorrido
          <select
            name="holes"
            defaultValue={league.holes}
            disabled={hasRounds}
            className="field mt-1 disabled:opacity-50"
          >
            <option value="1-9">9 hoyos (1 al 9)</option>
            <option value="10-18">9 hoyos (10 al 18)</option>
            <option value="18">18 hoyos</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Inicio de la jornada 1
          <input
            name="startDate"
            type="date"
            defaultValue={league.startDate}
            disabled={hasRounds}
            className="field mt-1 disabled:opacity-50"
          />
        </label>
        <label className="text-xs font-medium text-muted">
          Mínimo de jornadas para clasificar
          <input
            name="minRounds"
            type="number"
            min="1"
            max="50"
            required
            defaultValue={league.minRounds}
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
            required
            defaultValue={league.countRounds}
            className="field mt-1"
          />
        </label>
      </div>

      {hasRounds ? (
        <p className="text-xs text-faint">
          El recorrido y la fecha de inicio están bloqueados porque ya hay vueltas
          registradas.
        </p>
      ) : null}

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
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
