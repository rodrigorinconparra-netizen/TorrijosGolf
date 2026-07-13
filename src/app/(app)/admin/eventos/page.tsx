import { desc } from "drizzle-orm";
import { Trash2, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { isMailConfigured } from "@/lib/mail";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { EventForm } from "./event-form";
import { deleteEventAction } from "../actions";

export const metadata = { title: "Eventos" };

export default async function AdminEventsPage() {
  const allEvents = await db.select().from(events).orderBy(desc(events.startsAt));

  return (
    <div className="space-y-6">
      <section className="glass p-6">
        <h2 className="font-semibold">Crear evento</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Torneos, jornadas de puertas abiertas, comidas del club… Con aviso push y
          email opcional a todos los usuarios.
        </p>
        <EventForm mailEnabled={isMailConfigured()} />
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Todos los eventos</h2>
        {allEvents.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aún no hay eventos.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {allEvents.map((e) => {
              const past = e.startsAt < new Date();
              return (
                <li
                  key={e.id}
                  className="glass-soft flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{e.title}</p>
                    <p className="text-xs text-muted">
                      {formatDateTime(e.startsAt)}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                  {e.url ? (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Enlace de inscripción"
                      className="text-accent"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                  <Badge tone={past ? "neutral" : "accent"}>
                    {past ? "Pasado" : "Próximo"}
                  </Badge>
                  <form action={deleteEventAction}>
                    <input type="hidden" name="eventId" value={e.id} />
                    <button
                      type="submit"
                      title="Eliminar evento"
                      className="btn-danger !px-2.5 !py-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
