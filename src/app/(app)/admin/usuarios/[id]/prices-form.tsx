"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateTeacherPricesAction, type ActionState } from "../../actions";

interface Prices {
  priceIndividualPuntual: string;
  priceIndividualMensual: string;
  priceGrupalPuntual: string;
  priceGrupalMensual: string;
}

/** Los 4 precios de clase del profesor: individual/grupal × puntual/mensual. */
export function TeacherPricesForm({
  userId,
  defaults,
}: {
  userId: number;
  defaults: Prices;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateTeacherPricesAction,
    {},
  );

  const Field = ({ name, value }: { name: keyof Prices; value: string }) => (
    <div className="relative">
      <input
        name={name}
        defaultValue={value}
        inputMode="decimal"
        placeholder="—"
        className="field !py-2 pr-7 text-sm"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">
        €
      </span>
    </div>
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[380px] border-separate border-spacing-2 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="font-medium"></th>
              <th className="font-medium">Puntual</th>
              <th className="font-medium">Mensual</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="pr-2 text-left text-xs font-medium text-ink-soft">
                Individual
              </th>
              <td>
                <Field name="priceIndividualPuntual" value={defaults.priceIndividualPuntual} />
              </td>
              <td>
                <Field name="priceIndividualMensual" value={defaults.priceIndividualMensual} />
              </td>
            </tr>
            <tr>
              <th className="pr-2 text-left text-xs font-medium text-ink-soft">
                Grupal <span className="text-faint">(por persona)</span>
              </th>
              <td>
                <Field name="priceGrupalPuntual" value={defaults.priceGrupalPuntual} />
              </td>
              <td>
                <Field name="priceGrupalMensual" value={defaults.priceGrupalMensual} />
              </td>
            </tr>
          </tbody>
        </table>
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

      <button type="submit" disabled={pending} className="btn-primary !px-4 !py-2 text-sm">
        <Save className="h-4 w-4" />
        {pending ? "Guardando…" : "Guardar precios"}
      </button>
    </form>
  );
}
