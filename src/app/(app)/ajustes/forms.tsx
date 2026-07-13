"use client";

import { useActionState } from "react";
import { Save, KeyRound } from "lucide-react";
import {
  changePasswordAction,
  updateProfileAction,
  type ActionState,
} from "./actions";

export function ProfileForm({
  defaults,
}: {
  defaults: { name: string; phone: string; license: string };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateProfileAction,
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">Nombre</label>
          <input name="name" defaultValue={defaults.name} required className="field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">Teléfono</label>
          <input name="phone" type="tel" defaultValue={defaults.phone} className="field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">
            Nº de licencia
          </label>
          <input name="license" defaultValue={defaults.license} className="field" />
        </div>
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
        <Save className="h-4 w-4" /> {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    changePasswordAction,
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">
            Contraseña actual
          </label>
          <input name="current" type="password" required className="field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">
            Nueva contraseña
          </label>
          <input name="next" type="password" required minLength={8} className="field" />
        </div>
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
      <button type="submit" disabled={pending} className="btn-ghost">
        <KeyRound className="h-4 w-4" /> {pending ? "Actualizando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
