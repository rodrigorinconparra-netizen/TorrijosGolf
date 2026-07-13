"use client";

import { useActionState } from "react";
import { Flag, Users } from "lucide-react";
import {
  createRoundAction,
  createMatchAction,
  type LeagueState,
} from "../../liga-actions";

interface Option {
  id: number;
  name: string;
}

/** Crear la partida (grupo) de la jornada actual. */
export function CreateMatchForm({ leagueId }: { leagueId: number }) {
  const [state, action, pending] = useActionState<LeagueState, FormData>(
    createMatchAction,
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leagueId" value={leagueId} />
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
        <Users className="h-4 w-4" />
        {pending ? "Creando…" : "Crear partida"}
      </button>
    </form>
  );
}

/** El jugador empieza su vuelta: marcador (de su partida) y barra. */
export function CreateRoundForm({
  matchId,
  people,
}: {
  matchId: number;
  people: Option[];
}) {
  const [state, action, pending] = useActionState<LeagueState, FormData>(
    createRoundAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="matchId" value={matchId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-muted">
          ¿Quién de tu partida te marca?
          <select name="markerId" required className="field mt-1" defaultValue="">
            <option value="" disabled>
              Elige marcador…
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Barra de salida
          <select name="barra" className="field mt-1" defaultValue="amarillas">
            <option value="amarillas">Amarillas</option>
            <option value="rojas">Rojas</option>
          </select>
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
        <Flag className="h-4 w-4" />
        {pending ? "Creando…" : "Empezar mi vuelta"}
      </button>
    </form>
  );
}
