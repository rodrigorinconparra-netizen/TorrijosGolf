import { Tag } from "lucide-react";
import type { OfferCard } from "@/lib/offers";
import { Badge } from "@/components/ui/badge";
import { formatEuro } from "@/lib/utils";
import { OfferRequestButton } from "./offer-request-button";

type OfferStatus = "pendiente" | "aceptada" | "rechazada";

/**
 * Lista de ofertas activas (bonos) que ve el alumno en Inicio y en Clases. Cada
 * tarjeta muestra el cartel, las condiciones y un botón para solicitarla.
 * `canRequest` desactiva el botón para roles que no reservan (profesor/admin).
 */
export function OffersList({
  offers,
  statuses = {},
  canRequest = true,
}: {
  offers: OfferCard[];
  statuses?: Record<number, OfferStatus>;
  canRequest?: boolean;
}) {
  if (offers.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Tag className="h-4 w-4 text-accent" /> Ofertas de clases
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {offers.map((o) => {
          const status = statuses[o.id];
          return (
            <div key={o.id} className="glass overflow-hidden !p-0">
              {o.hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/ofertas/${o.id}/imagen`}
                  alt={`Cartel de ${o.title}`}
                  className="max-h-60 w-full object-cover"
                />
              ) : null}
              <div className="space-y-2 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-ink">{o.title}</h3>
                  {o.price > 0 ? (
                    <Badge tone="accent">{formatEuro(o.price)}</Badge>
                  ) : null}
                </div>
                {o.classCount ? (
                  <p className="text-sm text-muted">{o.classCount} clases</p>
                ) : null}
                {o.description ? (
                  <p className="whitespace-pre-line text-sm text-ink-soft">
                    {o.description}
                  </p>
                ) : null}
                {canRequest ? (
                  <div className="pt-1.5">
                    {status === "aceptada" ? (
                      <Badge tone="positive">Oferta confirmada</Badge>
                    ) : status === "pendiente" ? (
                      <Badge tone="neutral">Solicitud enviada</Badge>
                    ) : (
                      <OfferRequestButton offerId={o.id} />
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
