import Link from "next/link";
import { desc } from "drizzle-orm";
import { Trophy, FileText, Download, Trash2, ChevronRight, Swords } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rankings, leagues } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { LEAGUE_HOLES_LABEL, type LeagueHoles } from "@/lib/course";
import { currentJornada } from "@/lib/league";
import { UploadRankingForm } from "./upload-form";
import { RankingEditForm } from "./edit-form";
import { LeagueForm } from "./league-form";
import { deleteRankingAction } from "./actions";

export const metadata = { title: "Clasificaciones" };

export default async function RankingsPage() {
  const user = await requireSession();
  const isAdmin = user.role === "admin";

  const list = await db
    .select({
      id: rankings.id,
      title: rankings.title,
      description: rankings.description,
      fileName: rankings.fileName,
      createdAt: rankings.createdAt,
    })
    .from(rankings)
    .orderBy(desc(rankings.createdAt));

  const allLeagues = await db.select().from(leagues).orderBy(desc(leagues.createdAt));

  return (
    <>
      <PageHeader
        title="Clasificaciones"
        subtitle="Ligas y competiciones del club"
      />

      {/* Ligas en vivo */}
      <section className="glass p-6">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-muted" />
          <h2 className="font-semibold">Ligas en vivo</h2>
        </div>
        <p className="mb-4 mt-1 text-sm text-muted">
          Juega tu jornada semanal y sigue la clasificación al momento.
        </p>
        {allLeagues.length === 0 ? (
          <p className="text-sm text-faint">Todavía no hay ligas.</p>
        ) : (
          <div className="space-y-2">
            {allLeagues.map((l) => {
              const jornada = currentJornada(l.startDate);
              return (
                <Link
                  key={l.id}
                  href={`/clasificaciones/liga/${l.id}`}
                  className="glass-soft flex items-center gap-3 px-4 py-3 transition hover:bg-white/70"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/12 text-accent-deep">
                    <Trophy className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{l.title}</p>
                    <p className="text-xs text-muted">
                      {LEAGUE_HOLES_LABEL[l.holes as LeagueHoles]} ·{" "}
                      {jornada >= 1 ? `Jornada ${jornada}` : "Empieza pronto"}
                    </p>
                  </div>
                  <Badge tone={l.status === "activa" ? "positive" : "neutral"}>
                    {l.status === "activa" ? "Activa" : "Finalizada"}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-faint" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {isAdmin ? (
        <section className="glass p-6">
          <h2 className="font-semibold">Crear competición en vivo</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Liga automática: jornadas semanales, tarjetas con marcador y
            clasificación calculada al momento (bruto − hándicap de juego).
          </p>
          <LeagueForm />
        </section>
      ) : null}

      {isAdmin ? (
        <section className="glass p-6">
          <h2 className="font-semibold">Publicar una clasificación</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Sube el PDF de la clasificación; lo verán todos los usuarios.
          </p>
          <UploadRankingForm />
        </section>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Todavía no hay clasificaciones"
          description="Cuando el club publique una liga o competición, aparecerá aquí para consultarla."
        />
      ) : (
        <div className="space-y-2">
          {list.map((r) => (
            <article key={r.id} className="glass p-5">
              <div className="flex flex-wrap items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
                  <FileText className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-ink">{r.title}</h3>
                  {r.description ? (
                    <p className="text-sm text-muted">{r.description}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-faint">
                    Publicada el {formatDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/clasificaciones/${r.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary !px-3.5 !py-2 text-sm"
                  >
                    <Download className="h-4 w-4" /> Ver
                  </a>
                  {isAdmin ? (
                    <form action={deleteRankingAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        title="Eliminar clasificación"
                        className="btn-danger !px-2.5 !py-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
              {isAdmin ? (
                <RankingEditForm
                  id={r.id}
                  title={r.title}
                  description={r.description ?? ""}
                />
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
