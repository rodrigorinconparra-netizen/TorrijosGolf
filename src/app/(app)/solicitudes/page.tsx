import Link from "next/link";
import { CalendarPlus, Inbox, Tag, Trash2 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { myBookingRequests, myOfferRequests } from "@/lib/requests";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatEuro, weekdayName } from "@/lib/utils";
import {
  deleteMyBookingRequestAction,
  deleteMyOfferRequestAction,
} from "./actions";

export const metadata = { title: "Solicitudes" };

const STATUS_TONE = {
  pendiente: "warning",
  aceptada: "positive",
  rechazada: "negative",
} as const;

const STATUS_LABEL = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
} as const;

export default async function RequestsPage() {
  const user = await requireSession();
  const [bookings, offers] = await Promise.all([
    myBookingRequests(user.userId),
    myOfferRequests(user.userId),
  ]);

  const nothing = bookings.length === 0 && offers.length === 0;

  return (
    <>
      <PageHeader
        title="Solicitudes"
        subtitle="Envía nuevas solicitudes y consulta el estado de las que ya has hecho."
      />

      {/* Enviar una nueva solicitud → lleva a cada sitio */}
      <section className="glass p-6">
        <h2 className="font-semibold">Enviar una solicitud</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Elige qué quieres solicitar y te llevamos al sitio donde se hace.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/reservar" className="btn-primary">
            <CalendarPlus className="h-4 w-4" /> Reservar clase
          </Link>
          <Link href="/clases" className="btn-ghost">
            <Tag className="h-4 w-4" /> Solicitar una oferta
          </Link>
        </div>
      </section>

      {nothing ? (
        <EmptyState
          icon={Inbox}
          title="Aún no has hecho ninguna solicitud"
          description="Cuando reserves una clase o solicites una oferta, aparecerá aquí con su estado."
        />
      ) : null}

      {/* Reservas de clase */}
      {bookings.length > 0 ? (
        <section className="glass p-6">
          <h2 className="font-semibold">Reservas de clase</h2>
          <ul className="mt-4 space-y-2">
            {bookings.map((b) => (
              <li
                key={b.id}
                className="glass-soft flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {b.kind === "mensual"
                      ? `Clase semanal · ${weekdayName(b.weekday)} ${b.startTime}`
                      : `Clase puntual · ${b.date ? formatDate(b.date) : ""} ${b.startTime}`}
                  </p>
                  <p className="text-xs text-muted">
                    {b.teacherName} · {b.durationMin} min
                    {b.price > 0 ? ` · ${formatEuro(b.price)}` : ""}
                    {" · enviada "}
                    {formatDate(b.createdAt)}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                <form action={deleteMyBookingRequestAction}>
                  <input type="hidden" name="id" value={b.id} />
                  <button
                    type="submit"
                    title="Eliminar solicitud"
                    className="btn-danger !px-2.5 !py-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Ofertas solicitadas */}
      {offers.length > 0 ? (
        <section className="glass p-6">
          <h2 className="font-semibold">Ofertas solicitadas</h2>
          <ul className="mt-4 space-y-2">
            {offers.map((o) => (
              <li
                key={o.id}
                className="glass-soft flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{o.offerTitle}</p>
                  <p className="text-xs text-muted">
                    {o.classCount ? `${o.classCount} clases · ` : ""}
                    {o.price > 0 ? `${formatEuro(o.price)} · ` : ""}
                    solicitada {formatDate(o.createdAt)}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                <form action={deleteMyOfferRequestAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <button
                    type="submit"
                    title="Eliminar solicitud"
                    className="btn-danger !px-2.5 !py-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
