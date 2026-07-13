"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createGroupAction, type ActionState } from "../actions";

export function GroupForm({
  teachers,
}: {
  teachers: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createGroupAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          name="name"
          required
          placeholder="Nombre (p. ej. Infantil martes)"
          className="field"
        />
        <input name="description" placeholder="Descripción (opcional)" className="field" />
        <select name="teacherId" className="field" defaultValue="">
          <option value="">Sin profesor</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
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
        <Plus className="h-4 w-4" />
        {pending ? "Creando…" : "Crear grupo"}
      </button>
    </form>
  );
}
