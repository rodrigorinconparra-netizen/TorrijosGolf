"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { loginAction, type AuthFormState } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    loginAction,
    {},
  );

  return (
    <div className="glass p-8">
      <h1 className="text-xl font-semibold tracking-tight">Inicia sesión</h1>
      <p className="mt-1 text-sm text-muted">
        Accede con tu cuenta del club.
      </p>

      <form action={action} className="mt-6 space-y-4">
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
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="field"
          />
        </div>

        {state.error ? (
          <p className="rounded-2xl bg-negative/10 px-4 py-2.5 text-sm text-negative">
            {state.error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-primary w-full">
          <LogIn className="h-4 w-4" />
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
