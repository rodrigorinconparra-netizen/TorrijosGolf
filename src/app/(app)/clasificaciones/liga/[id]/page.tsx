import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { ChevronLeft, Trash2, Trophy, Flag } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  leagueMatches,
  leagueMatchPlayers,
  leagueRounds,
  leagues,
  users,
} from "@/lib/db/schema";
import {
  courseHandicapForHoles,
  holesFor,
  parFor,
  LEAGUE_HOLES_LABEL,
  type Barra,
  type LeagueHoles,
  type Sexo,
} from "@/lib/course";
import { currentJornada, leagueStandings } from "@/lib/league";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { RoundCard, type HoleInfo } from "./round-card";
import { CreateRoundForm, CreateMatchForm } from "./create-round-form";
import { AdminRoundForm } from "./admin-round-form";
import { LeagueEditForm } from "./league-edit-form";
import {
  deleteRoundAction,
  deleteLeagueAction,
  finishLeagueAction,
  joinMatchAction,
} from "../../liga-actions";

export const metadata = { title: "Liga" };

const BARRA_TXT: Record<string, string> = { amarillas: "Amarillas", rojas: "Rojas" };

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const user = await requireSession();
  const leagueId = Number((await params).id);
  if (!leagueId) notFound();

  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1);
  if (!league) notFound();

  const isAdmin = user.role === "admin";
  const { t } = await searchParams;
  const tab = t === "jugar" || (t === "gestion" && isAdmin) ? t : "clasificacion";

  const holes: HoleInfo[] = holesFor(league.holes as LeagueHoles).map((h) => ({
    n: h.n,
    par: h.par,
    si: h.amarillas.si,
  }));
  const jornada = currentJornada(league.startDate);
  const par = parFor(league.holes as LeagueHoles);

  const tabs = [
    { key: "clasificacion", label: "Clasificación" },
    ...(league.status === "activa" ? [{ key: "jugar", label: "Jugar jornada" }] : []),
    ...(isAdmin ? [{ key: "gestion", label: "Gestión" }] : []),
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/clasificaciones"
        className="inline-flex items-center gap-1 text-sm font-medium text-accent"
      >
        <ChevronLeft className="h-4 w-4" /> Clasificaciones
      </Link>

      <section className="glass p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Trophy className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{league.title}</h1>
            <p className="text-sm text-muted">
              {LEAGUE_HOLES_LABEL[league.holes as LeagueHoles]} · Par {par} ·{" "}
              {jornada >= 1
                ? `Jornada ${jornada}`
                : `Empieza el ${formatDate(league.startDate)}`}{" "}
              · Cuentan las {league.countRounds} mejores (mín. {league.minRounds})
            </p>
            {league.description ? (
              <p className="mt-1 text-sm text-muted">{league.description}</p>
            ) : null}
          </div>
          <Badge tone={league.status === "activa" ? "positive" : "neutral"}>
            {league.status === "activa" ? "Activa" : "Finalizada"}
          </Badge>
        </div>

        {isAdmin ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {league.status === "activa" ? (
              <form action={finishLeagueAction}>
                <input type="hidden" name="leagueId" value={league.id} />
                <button type="submit" className="btn-ghost !px-3 !py-1.5 text-xs">
                  Finalizar liga
                </button>
              </form>
            ) : null}
            <form action={deleteLeagueAction}>
              <input type="hidden" name="leagueId" value={league.id} />
              <button type="submit" className="btn-danger !px-3 !py-1.5 text-xs">
                <Trash2 className="h-3.5 w-3.5" /> Eliminar liga
              </button>
            </form>
          </div>
        ) : null}
      </section>

      <nav className="glass-soft flex gap-1 overflow-x-auto p-1.5">
        {tabs.map((x) => (
          <Link
            key={x.key}
            href={`/clasificaciones/liga/${league.id}?t=${x.key}`}
            className={cn(
              "whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition",
              tab === x.key
                ? "bg-accent text-on-accent shadow-[0_6px_16px_rgba(31,108,92,0.25)]"
                : "text-ink-soft hover:bg-black/5",
            )}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {tab === "clasificacion" ? (
        <StandingsSection leagueId={league.id} minRounds={league.minRounds} />
      ) : tab === "jugar" ? (
        <PlaySection
          league={{
            id: league.id,
            holes: league.holes as LeagueHoles,
            startDate: league.startDate,
          }}
          holesInfo={holes}
          userId={user.userId}
          jornada={jornada}
        />
      ) : (
        <AdminSection
          league={{
            id: league.id,
            title: league.title,
            description: league.description ?? "",
            holes: league.holes,
            startDate: league.startDate,
            minRounds: league.minRounds,
            countRounds: league.countRounds,
          }}
          holesInfo={holes}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Clasificación */

async function StandingsSection({
  leagueId,
  minRounds,
}: {
  leagueId: number;
  minRounds: number;
}) {
  const { jornadas, rows } = await leagueStandings(leagueId);
  const cols = Array.from({ length: Math.max(jornadas, 1) }, (_, i) => i + 1);

  if (rows.length === 0) {
    return (
      <section className="glass p-6">
        <p className="text-sm text-muted">
          Aún no hay vueltas firmadas. La clasificación aparecerá con la primera
          tarjeta.
        </p>
      </section>
    );
  }

  let pos = 0;
  return (
    <section className="glass p-6">
      <h2 className="font-semibold">Clasificación</h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Neto por jornada (bruto − hándicap de juego). Clasifican quienes hayan
        jugado al menos {minRounds} jornadas.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-center text-sm">
          <thead>
            <tr className="border-b border-black/8 text-xs text-muted">
              <th className="pb-2 pr-2 font-medium">P</th>
              <th className="pb-2 pr-3 text-left font-medium">Jugador</th>
              {cols.map((j) => (
                <th key={j} className="pb-2 px-1.5 font-medium">
                  J{j}
                </th>
              ))}
              <th className="pb-2 px-2 font-medium">Total</th>
              <th className="pb-2 font-medium">+/-PAR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              if (r.qualified) pos++;
              return (
                <tr
                  key={r.playerId}
                  className={cn(
                    "border-b border-black/5 last:border-0",
                    !r.qualified && "opacity-60",
                  )}
                >
                  <td className="py-2 pr-2 font-medium text-muted">
                    {r.qualified ? pos : "—"}
                  </td>
                  <td className="py-2 pr-3 text-left font-medium text-ink">
                    {r.playerName}
                    <span className="ml-2 text-[10px] text-faint">
                      {r.license ?? ""}
                    </span>
                  </td>
                  {cols.map((j) => (
                    <td key={j} className="px-1.5 py-2 tabular-nums">
                      {r.byJornada.get(j) ?? <span className="text-faint">·</span>}
                    </td>
                  ))}
                  <td className="px-2 py-2 font-semibold tabular-nums text-ink">
                    {r.total}
                  </td>
                  <td className="py-2 font-semibold tabular-nums">
                    {r.vsPar == null ? (
                      <span className="text-faint">—</span>
                    ) : r.vsPar < 0 ? (
                      <span className="text-positive">{r.vsPar}</span>
                    ) : r.vsPar > 0 ? (
                      <span className="text-negative">+{r.vsPar}</span>
                    ) : (
                      <span>0</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Jugar jornada */

async function PlaySection({
  league,
  holesInfo,
  userId,
  jornada,
}: {
  league: { id: number; holes: LeagueHoles; startDate: string };
  holesInfo: HoleInfo[];
  userId: number;
  jornada: number;
}) {
  if (jornada < 1) {
    return (
      <section className="glass p-6">
        <p className="text-sm text-muted">
          La liga empieza el {formatDate(league.startDate)}. ¡Prepara los palos!
        </p>
      </section>
    );
  }

  const [me] = await db
    .select({ handicapIndex: users.handicapIndex, sex: users.sex })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Partidas de la jornada actual, con sus miembros.
  const matchesRows = await db
    .select({
      matchId: leagueMatches.id,
      playerId: leagueMatchPlayers.playerId,
      playerName: users.name,
    })
    .from(leagueMatches)
    .innerJoin(leagueMatchPlayers, eq(leagueMatchPlayers.matchId, leagueMatches.id))
    .innerJoin(users, eq(users.id, leagueMatchPlayers.playerId))
    .where(and(eq(leagueMatches.leagueId, league.id), eq(leagueMatches.jornada, jornada)))
    .orderBy(asc(leagueMatches.id), asc(users.name));

  const matchMembers = new Map<number, { id: number; name: string }[]>();
  for (const r of matchesRows) {
    matchMembers.set(r.matchId, [
      ...(matchMembers.get(r.matchId) ?? []),
      { id: r.playerId, name: r.playerName },
    ]);
  }
  const myMatchId =
    matchesRows.find((r) => r.playerId === userId)?.matchId ?? null;

  // Mi vuelta de la jornada actual.
  const [mine] = await db
    .select()
    .from(leagueRounds)
    .where(
      and(
        eq(leagueRounds.leagueId, league.id),
        eq(leagueRounds.playerId, userId),
        eq(leagueRounds.jornada, jornada),
      ),
    )
    .limit(1);

  // Vueltas donde soy el marcador y siguen en juego (tarjetas oficiales que llevo).
  const marking = await db
    .select({
      round: leagueRounds,
      playerName: users.name,
      playerIndex: users.handicapIndex,
      playerSex: users.sex,
    })
    .from(leagueRounds)
    .innerJoin(users, eq(users.id, leagueRounds.playerId))
    .where(
      and(
        eq(leagueRounds.leagueId, league.id),
        eq(leagueRounds.markerId, userId),
        eq(leagueRounds.status, "en_juego"),
      ),
    )
    .orderBy(desc(leagueRounds.createdAt));

  /* --- Sin partida: crear una o unirse a otra --- */
  if (!myMatchId) {
    return (
      <section className="glass p-6">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-muted" />
          <h2 className="font-semibold">Jornada {jornada} · Tu partida</h2>
        </div>
        {me?.handicapIndex == null ? (
          <p className="mt-3 text-sm text-muted">
            El club aún no te ha asignado hándicap: pídeselo para poder jugar la
            liga.
          </p>
        ) : (
          <>
            <p className="mb-4 mt-1 text-sm text-muted">
              Para jugar, crea la partida de tu grupo o únete a una ya creada. Los
              marcadores se eligen entre los de la partida.
            </p>
            <CreateMatchForm leagueId={league.id} />
            {matchMembers.size > 0 ? (
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium text-muted">
                  Partidas de esta jornada
                </p>
                <ul className="space-y-2">
                  {[...matchMembers.entries()].map(([mid, members]) => (
                    <li
                      key={mid}
                      className="glass-soft flex flex-wrap items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">
                          Partida de {members[0]?.name.split(" ")[0]}
                        </p>
                        <p className="text-xs text-muted">
                          {members.map((m) => m.name.split(" ")[0]).join(", ")}
                        </p>
                      </div>
                      <form action={joinMatchAction}>
                        <input type="hidden" name="matchId" value={mid} />
                        <button type="submit" className="btn-primary !px-3.5 !py-2 text-sm">
                          Unirme
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>
    );
  }

  const members = matchMembers.get(myMatchId) ?? [];
  const partners = members.filter((m) => m.id !== userId);

  return (
    <>
      <section className="glass p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Flag className="h-4 w-4 text-muted" />
          <h2 className="font-semibold">Jornada {jornada} · Tu partida</h2>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {members.map((m) => (
              <Badge key={m.id} tone={m.id === userId ? "accent" : "neutral"}>
                {m.name.split(" ")[0]}
              </Badge>
            ))}
          </div>
        </div>
        {partners.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Estás solo en la partida: comparte que se unan tus compañeros para
            poder elegir marcador.
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Columna 1: mi tarjeta */}
        <section className="glass p-6">
          <h2 className="font-semibold">Mi tarjeta</h2>
          {!mine ? (
            partners.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Cuando haya más gente en la partida podrás empezar tu vuelta.
              </p>
            ) : (
              <div className="mt-3">
                <CreateRoundForm matchId={myMatchId} people={partners} />
              </div>
            )
          ) : mine.status === "finalizada" ? (
            <div className="mt-3 flex flex-wrap items-center gap-4 rounded-2xl bg-positive/10 px-4 py-3 text-sm">
              <Badge tone="positive">Cerrada</Badge>
              <span className="text-muted">
                Bruto <span className="font-semibold text-ink">{mine.gross}</span>
              </span>
              <span className="text-muted">
                Hcp <span className="font-semibold text-ink">{mine.courseHcp}</span>
              </span>
              <span className="text-muted">
                Neto <span className="font-semibold text-accent-deep">{mine.net}</span>
              </span>
              <span className="text-xs text-faint">
                {BARRA_TXT[mine.barra]} · {formatDate(mine.date)}
              </span>
            </div>
          ) : (
            <div className="mt-3">
              <p className="mb-3 text-xs text-muted">
                {BARRA_TXT[mine.barra]} · {formatDate(mine.date)} · Tú llevas tu
                cuenta; tu marcador lleva la oficial. Firmad cuando coincidan.
              </p>
              <RoundCard
                roundId={mine.id}
                holes={holesInfo}
                initialScores={JSON.parse(mine.scores) as number[]}
                otherScores={JSON.parse(mine.scoresMarker) as number[]}
                otherLabel="Marcador"
                courseHcp={
                  me?.handicapIndex != null
                    ? courseHandicapForHoles(
                        me.handicapIndex,
                        mine.barra as Barra,
                        (me.sex ?? "hombre") as Sexo,
                        league.holes,
                      )
                    : 0
                }
                signedMe={mine.playerSigned}
                signedOther={mine.markerSigned}
              />
              <form action={deleteRoundAction} className="mt-3">
                <input type="hidden" name="roundId" value={mine.id} />
                <button type="submit" className="btn-danger !px-3 !py-1.5 text-xs">
                  <Trash2 className="h-3.5 w-3.5" /> Anular mi vuelta
                </button>
              </form>
            </div>
          )}
        </section>

        {/* Columna 2: tarjetas que marco */}
        <section className="glass p-6">
          <h2 className="font-semibold">Tarjetas que marco</h2>
          {marking.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nadie te ha elegido de marcador todavía.
            </p>
          ) : (
            <div className="mt-3 space-y-8">
              {marking.map((m) => (
                <div key={m.round.id}>
                  <p className="mb-2 text-sm font-medium text-ink">
                    {m.playerName}{" "}
                    <span className="text-xs text-muted">
                      · {BARRA_TXT[m.round.barra]} · Jornada {m.round.jornada}
                    </span>
                  </p>
                  <RoundCard
                    roundId={m.round.id}
                    holes={holesInfo}
                    initialScores={JSON.parse(m.round.scoresMarker) as number[]}
                    otherScores={JSON.parse(m.round.scores) as number[]}
                    otherLabel="Jugador"
                    courseHcp={
                      m.playerIndex != null
                        ? courseHandicapForHoles(
                            m.playerIndex,
                            m.round.barra as Barra,
                            (m.playerSex ?? "hombre") as Sexo,
                            league.holes,
                          )
                        : 0
                    }
                    signedMe={m.round.markerSigned}
                    signedOther={m.round.playerSigned}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Gestión */

async function AdminSection({
  league,
  holesInfo,
}: {
  league: {
    id: number;
    title: string;
    description: string;
    holes: string;
    startDate: string;
    minRounds: number;
    countRounds: number;
  };
  holesInfo: HoleInfo[];
}) {
  const leagueId = league.id;
  const people = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(ne(users.role, "admin"))
    .orderBy(asc(users.name));

  const rounds = await db
    .select({
      round: leagueRounds,
      playerName: users.name,
    })
    .from(leagueRounds)
    .innerJoin(users, eq(users.id, leagueRounds.playerId))
    .where(eq(leagueRounds.leagueId, leagueId))
    .orderBy(desc(leagueRounds.jornada), asc(users.name));

  return (
    <>
      <section className="glass p-6">
        <h2 className="font-semibold">Editar liga</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          El mínimo y las jornadas que cuentan recalculan la clasificación al
          momento.
        </p>
        <LeagueEditForm league={league} hasRounds={rounds.length > 0} />
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Añadir o corregir una vuelta</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          La jornada se calcula por la fecha. Si el jugador ya tenía vuelta en esa
          jornada, se sobrescribe.
        </p>
        <AdminRoundForm leagueId={leagueId} holes={holesInfo} people={people} />
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Todas las vueltas ({rounds.length})</h2>
        {rounds.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin vueltas todavía.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {rounds.map(({ round: r, playerName }) => (
              <li
                key={r.id}
                className="glass-soft flex flex-wrap items-center gap-3 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    J{r.jornada} · {playerName}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(r.date)} · {BARRA_TXT[r.barra]}
                    {r.status === "finalizada"
                      ? ` · Bruto ${r.gross} · Hcp ${r.courseHcp} · Neto ${r.net}`
                      : " · En juego"}
                  </p>
                </div>
                <Badge tone={r.status === "finalizada" ? "positive" : "warning"}>
                  {r.status === "finalizada" ? "Firmada" : "En juego"}
                </Badge>
                <form action={deleteRoundAction}>
                  <input type="hidden" name="roundId" value={r.id} />
                  <button
                    type="submit"
                    title="Eliminar vuelta"
                    className="btn-danger !px-2.5 !py-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
