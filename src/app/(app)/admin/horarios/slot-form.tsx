"use client";

import { useActionState, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { createSlotAction, type ActionState } from "../actions";
import { WEEKDAYS } from "@/lib/utils";

interface Option {
  id: number;
  name: string;
}

interface GroupOption extends Option {
  /** Profesor responsable del grupo (para autoseleccionarlo). */
  teacherId: number | null;
}

/**
 * Alta de una hora en el horario semanal de un profesor. El admin marca si es
 * individual o grupal y asocia el alumno o el grupo (puede dejarse libre).
 */
export function SlotForm({
  teachers,
  students,
  groups,
}: {
  teachers: Option[];
  students: Option[];
  groups: GroupOption[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createSlotAction,
    {},
  );
  const [kind, setKind] = useState<"individual" | "grupal">("individual");
  // Profesor seleccionado (controlado, para poder autoseleccionarlo con el grupo).
  const [teacherId, setTeacherId] = useState<string>("");

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <select
          name="teacherId"
          required
          className="field"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
        >
          <option value="" disabled>
            Profesor…
          </option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select name="weekday" required className="field" defaultValue="1">
          {WEEKDAYS.map((d, i) => (
            <option key={d} value={i + 1}>
              {d}
            </option>
          ))}
        </select>

        <input name="startTime" type="time" required className="field" defaultValue="10:00" />

        <select name="durationMin" className="field" defaultValue="60">
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60">1 hora</option>
          <option value="90">1 h 30 min</option>
          <option value="120">2 horas</option>
        </select>

        <select
          name="kind"
          className="field"
          value={kind}
          onChange={(e) => setKind(e.target.value as "individual" | "grupal")}
        >
          <option value="individual">Individual</option>
          <option value="grupal">Grupal</option>
        </select>

        {kind === "grupal" ? (
          <select
            name="groupId"
            className="field"
            defaultValue=""
            onChange={(e) => {
              const g = groups.find((x) => String(x.id) === e.target.value);
              if (g?.teacherId != null) setTeacherId(String(g.teacherId));
            }}
          >
            <option value="">Grupo sin asignar (hora libre)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        ) : (
          <select name="studentId" className="field" defaultValue="">
            <option value="">Alumno sin asignar (hora libre)</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}

        <input
          name="price"
          type="number"
          step="0.5"
          min="0"
          placeholder="Precio de la clase (€)"
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
        <CalendarPlus className="h-4 w-4" />
        {pending ? "Añadiendo…" : "Añadir hora"}
      </button>
    </form>
  );
}
