"use client";

import { useActionState } from "react";
import { CalendarClock } from "lucide-react";
import { requestScheduleChangeAction, type ActionState } from "./actions";
import { WEEKDAYS } from "@/lib/utils";

interface SlotLite {
  id: number;
  weekday: number;
  startTime: string;
  durationMin: number;
  label: string;
}

/** Propuesta de cambio de horario para una hora concreta del profesor. */
export function ScheduleChangeForm({ slot }: { slot: SlotLite }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    requestScheduleChangeAction,
    {},
  );

  return (
    <details className="group">
      <summary className="flex w-fit cursor-pointer items-center gap-1 text-xs font-medium text-accent">
        <CalendarClock className="h-3 w-3" /> Proponer otro horario
      </summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="slotId" value={slot.id} />
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            Día
            <select
              name="weekday"
              defaultValue={slot.weekday}
              className="field mt-0.5 !w-32 !px-2.5 !py-1.5 text-xs"
            >
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Hora
            <input
              name="startTime"
              type="time"
              defaultValue={slot.startTime}
              className="field mt-0.5 !w-28 !px-2.5 !py-1.5 text-xs"
            />
          </label>
          <label className="text-xs text-muted">
            Duración
            <select
              name="durationMin"
              defaultValue={slot.durationMin}
              className="field mt-0.5 !w-28 !px-2.5 !py-1.5 text-xs"
            >
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">1 hora</option>
              <option value="90">1 h 30</option>
              <option value="120">2 horas</option>
            </select>
          </label>
        </div>
        <input
          name="note"
          placeholder="Motivo (opcional)"
          className="field !py-1.5 text-xs"
        />

        {state.error ? (
          <p className="rounded-xl bg-negative/10 px-3 py-1.5 text-xs text-negative">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="rounded-xl bg-positive/10 px-3 py-1.5 text-xs text-positive">
            {state.ok}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-primary !px-3 !py-1.5 text-xs">
          {pending ? "Enviando…" : "Enviar propuesta"}
        </button>
      </form>
    </details>
  );
}
