"use client";

import { useActionState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { registerAction, type AuthFormState } from "../actions";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    registerAction,
    {},
  );

  return (
    <div className="glass p-8">
      <h1 className="text-xl font-semibold tracking-tight">Crea tu cuenta</h1>
      <p className="mt-1 text-sm text-muted">
        Únete a la escuela y al club Torrijos Golf.
      </p>

      <form action={action} className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Nombre completo
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            placeholder="Nombre y apellidos"
            className="field"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@email.com"
            className="field"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="license" className="mb-1.5 block text-sm font-medium text-ink-soft">
              Nº de licencia
            </label>
            <input
              id="license"
              name="license"
              type="text"
              required
              placeholder="Licencia RFEG"
              className="field"
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-ink-soft">
              Teléfono <span className="text-faint">(opcional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="600 000 000"
              className="field"
            />
          </div>
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
            className="field"
          />
        </div>

        {state.error ? (
          <p className="rounded-2xl bg-negative/10 px-4 py-2.5 text-sm text-negative">
            {state.error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-primary w-full">
          <UserPlus className="h-4 w-4" />
          {pending ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
