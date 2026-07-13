"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateGolfDataAction, type ActionState } from "../../actions";

/** Datos de juego del jugador (hándicap índice y sexo), para las ligas. */
export function GolfDataForm({
  userId,
  handicapIndex,
  sex,
}: {
  userId: number;
  handicapIndex: string;
  sex: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateGolfDataAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-muted">
          Hándicap (índice)
          <input
            name="handicapIndex"
            defaultValue={handicapIndex}
            inputMode="decimal"
            placeholder="p. ej. 12,4"
            className="field mt-1 !py-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-muted">
          Sexo (CR/SR del campo)
          <select name="sex" defaultValue={sex} className="field mt-1 !py-2 text-sm">
            <option value="">Sin indicar</option>
            <option value="hombre">Hombre</option>
            <option value="mujer">Mujer</option>
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

      <button type="submit" disabled={pending} className="btn-primary !px-4 !py-2 text-sm">
        <Save className="h-4 w-4" />
        {pending ? "Guardando…" : "Guardar datos de juego"}
      </button>
    </form>
  );
}
