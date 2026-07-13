"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { registerChildAction, type ChildActionState } from "./actions";

/** Alta de un hijo/a menor gestionado por el usuario. */
export function ChildForm() {
  const [state, action, pending] = useActionState<ChildActionState, FormData>(
    registerChildAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input name="name" required placeholder="Nombre del hijo/a" className="field" />
        <input name="license" placeholder="Nº de licencia (opcional)" className="field" />
        <input
          name="birthdate"
          type="date"
          className="field"
          aria-label="Fecha de nacimiento"
        />
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
        <UserPlus className="h-4 w-4" />
        {pending ? "Añadiendo…" : "Añadir hijo/a"}
      </button>
    </form>
  );
}
