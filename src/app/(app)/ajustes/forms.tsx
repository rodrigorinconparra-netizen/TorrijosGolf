"use client";

import { useActionState, useState } from "react";
import { Save, KeyRound, Trash2, RefreshCw } from "lucide-react";
import {
  changePasswordAction,
  deleteAccountAction,
  refreshMyHandicapAction,
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

/** Muestra el hándicap actual y permite refrescarlo desde la RFEG. */
export function HandicapForm({ current }: { current: number | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    refreshMyHandicapAction,
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-ink-soft">
        Tu hándicap actual:{" "}
        <strong className="text-ink">
          {current ?? "—"}
        </strong>
      </p>
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
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Consultando RFEG…" : "Actualizar desde la RFEG"}
      </button>
    </form>
  );
}

/**
 * Eliminación de cuenta en dos pasos: primero pide confirmación, luego la
 * contraseña. Al confirmar, borra la cuenta y redirige a la pantalla de aviso.
 */
export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deleteAccountAction,
    {},
  );
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn-danger"
      >
        <Trash2 className="h-4 w-4" /> Eliminar mi cuenta
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <p className="rounded-2xl bg-negative/10 px-4 py-3 text-sm text-negative">
        Esta acción es <strong>permanente</strong>. Se eliminarán tu cuenta y todos
        tus datos (reservas, mensajes, solicitudes, entrenamientos…) y no se podrán
        recuperar.
      </p>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-soft">
          Confirma tu contraseña para continuar
        </label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="field"
        />
      </div>
      {state.error ? (
        <p className="rounded-2xl bg-negative/10 px-4 py-2.5 text-sm text-negative">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn-danger">
          <Trash2 className="h-4 w-4" />
          {pending ? "Eliminando…" : "Sí, eliminar definitivamente"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="btn-ghost"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
