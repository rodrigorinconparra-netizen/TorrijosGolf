"use client";

import { useActionState } from "react";
import { Save, Globe } from "lucide-react";

export interface ProfileFormState {
  error?: string;
  ok?: string;
}

export interface TeacherProfileDefaults {
  title: string;
  specialties: string;
  experienceYears: string;
  bio: string;
}

type ProfileAction = (
  prev: ProfileFormState,
  formData: FormData,
) => Promise<ProfileFormState>;

/**
 * Formulario del perfil público de profesor. Se usa tanto para que el admin
 * edite a un profesor (con `userId`) como para que el profesor se edite a sí
 * mismo. Los datos son visibles para todo el mundo.
 */
export function TeacherProfileForm({
  action,
  defaults,
  userId,
}: {
  action: ProfileAction;
  defaults: TeacherProfileDefaults;
  userId?: number;
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      {userId ? <input type="hidden" name="userId" value={userId} /> : null}

      <div className="flex items-center gap-1.5 rounded-2xl bg-accent/8 px-3 py-2 text-xs text-accent-deep">
        <Globe className="h-3.5 w-3.5 shrink-0" />
        Esta información es <span className="font-semibold">pública</span>: la ven
        todos los usuarios en tu ficha de profesor.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">
            Titulación / cargo
          </label>
          <input
            name="title"
            defaultValue={defaults.title}
            placeholder="p. ej. Profesional PGA"
            className="field"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">
            Años de experiencia
          </label>
          <input
            name="experienceYears"
            type="number"
            min="0"
            max="80"
            defaultValue={defaults.experienceYears}
            placeholder="p. ej. 10"
            className="field"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-soft">
          Especialidades
        </label>
        <input
          name="specialties"
          defaultValue={defaults.specialties}
          placeholder="Separadas por comas: Putt, Juego corto, Iniciación…"
          className="field"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-soft">
          Descripción
        </label>
        <textarea
          name="bio"
          rows={4}
          defaultValue={defaults.bio}
          placeholder="Preséntate: método, experiencia, para quién son tus clases…"
          className="field resize-y"
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
        <Save className="h-4 w-4" />
        {pending ? "Guardando…" : "Guardar perfil"}
      </button>
    </form>
  );
}
