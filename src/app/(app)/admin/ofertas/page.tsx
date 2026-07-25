import { Tag, Trash2, Users } from "lucide-react";
import { allOffersForAdmin, requestsForOffer } from "@/lib/offers";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatEuro } from "@/lib/utils";
import { OfferForm } from "./offer-form";
import {
  acceptOfferRequestAction,
  deleteOfferAction,
  rejectOfferRequestAction,
  toggleOfferAction,
} from "./actions";

export const metadata = { title: "Ofertas" };

const STATUS_TONE = {
  pendiente: "warning",
  aceptada: "positive",
  rechazada: "negative",
} as const;

export default async function AdminOffersPage() {
  const offers = await allOffersForAdmin();
  const requestsByOffer = await Promise.all(
    offers.map((o) => requestsForOffer(o.id)),
  );

  return (
    <div className="space-y-6">
      <section className="glass p-6">
        <h2 className="font-semibold">Publicar oferta de clases</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Crea un bono (p. ej. 10 clases por 100 €) con su cartel. Aparecerá en el
          Inicio y en Clases de los alumnos, que podrán solicitarlo.
        </p>
        <OfferForm />
      </section>

      {offers.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Aún no hay ofertas"
          description="Publica tu primera oferta con el formulario de arriba."
        />
      ) : (
        offers.map((o, i) => {
          const requests = requestsByOffer[i];
          return (
            <section key={o.id} className="glass p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink">{o.title}</h3>
                    <Badge tone={o.active ? "positive" : "neutral"}>
                      {o.active ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {o.classCount ? `${o.classCount} clases · ` : ""}
                    {o.price > 0 ? formatEuro(o.price) : "Sin precio"}
                  </p>
                  {o.description ? (
                    <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">
                      {o.description}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <form action={toggleOfferAction}>
                    <input type="hidden" name="offerId" value={o.id} />
                    <input type="hidden" name="active" value={String(!o.active)} />
                    <button type="submit" className="btn-ghost !px-3 !py-1.5 text-sm">
                      {o.active ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                  <form action={deleteOfferAction}>
                    <input type="hidden" name="offerId" value={o.id} />
                    <button
                      type="submit"
                      title="Eliminar oferta"
                      className="btn-danger !px-2.5 !py-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </div>

              {o.hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/ofertas/${o.id}/imagen`}
                  alt={`Cartel de ${o.title}`}
                  className="mt-4 max-h-52 rounded-2xl object-cover"
                />
              ) : null}

              <div className="mt-4 flex items-center gap-2 text-sm text-muted">
                <Users className="h-4 w-4" />
                <span>
                  {o.total} {o.total === 1 ? "solicitud" : "solicitudes"}
                  {o.pending > 0 ? ` · ${o.pending} pendiente${o.pending === 1 ? "" : "s"}` : ""}
                  {o.accepted > 0 ? ` · ${o.accepted} aceptada${o.accepted === 1 ? "" : "s"}` : ""}
                </span>
              </div>

              {requests.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {requests.map((r) => (
                    <li
                      key={r.id}
                      className="glass-soft flex flex-wrap items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">{r.studentName}</p>
                        <p className="text-xs text-muted">
                          {formatDate(r.createdAt)}
                          {r.note ? ` · “${r.note}”` : ""}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                      {r.status === "pendiente" ? (
                        <div className="flex items-center gap-1.5">
                          <form action={acceptOfferRequestAction}>
                            <input type="hidden" name="requestId" value={r.id} />
                            <button className="btn-primary !px-3 !py-1.5 text-xs">
                              Aceptar
                            </button>
                          </form>
                          <form action={rejectOfferRequestAction}>
                            <input type="hidden" name="requestId" value={r.id} />
                            <button className="btn-ghost !px-3 !py-1.5 text-xs">
                              Rechazar
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}
