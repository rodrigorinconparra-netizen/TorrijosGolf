"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { createTeacherAction, type ActionState } from "../actions";

/** Alta de profesor: crea la cuenta con rol profesor y tarifa/hora opcional. */
export function TeacherForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createTeacherAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Nombre completo" className="field" />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="field"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Contraseña provisional"
          className="field"
        />
        <input name="phone" type="tel" placeholder="Teléfono" className="field" />
        <input name="license" placeholder="Nº de licencia" className="field" />
        <input
          name="hourlyRate"
          type="number"
          step="0.5"
          min="0"
          placeholder="Tarifa €/hora"
          className="field"
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
        {pending ? "Creando…" : "Registrar profesor"}
      </button>
    </form>
  );
}
