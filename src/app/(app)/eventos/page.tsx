import { asc, desc, gte, lt } from "drizzle-orm";
import { CalendarDays, MapPin, ExternalLink } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Eventos" };

export default async function EventsPage() {
  await requireSession();
  const now = new Date();

  const upcoming = await db
    .select()
    .from(events)
    .where(gte(events.startsAt, now))
    .orderBy(asc(events.startsAt));
  const past = await db
    .select()
    .from(events)
    .where(lt(events.startsAt, now))
    .orderBy(desc(events.startsAt))
    .limit(10);

  return (
    <>
      <PageHeader
        title="Eventos del club"
        subtitle="Torneos, jornadas y actividades de Torrijos Golf"
      />

      {upcoming.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No hay eventos programados"
          description="Cuando el club organice un torneo o actividad, aparecerá aquí y recibirás un aviso."
        />
      ) : (
        <div className="space-y-3">
          {upcoming.map((e) => (
            <article key={e.id} className="glass p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
                  <CalendarDays className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-ink">{e.title}</h2>
                  <p className="mt-0.5 text-sm text-muted">{formatDateTime(e.startsAt)}</p>
                  {e.location ? (
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                      <MapPin className="h-3.5 w-3.5" /> {e.location}
                    </p>
                  ) : null}
                  {e.description ? (
                    <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">
                      {e.description}
                    </p>
                  ) : null}

                  {e.url ? (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary mt-4 !px-4 !py-2 text-sm"
                    >
                      Apuntarme <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <p className="mt-4 text-xs text-faint">
                      Inscripción no disponible todavía.
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {past.length > 0 ? (
        <section className="glass p-6">
          <h2 className="font-semibold text-muted">Eventos pasados</h2>
          <ul className="mt-3 space-y-2">
            {past.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-ink-soft">{e.title}</span>
                <Badge tone="neutral">{formatDateTime(e.startsAt)}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
