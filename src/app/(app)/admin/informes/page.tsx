import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Euro, GraduationCap } from "lucide-react";
import { teacherReports, sessionLog } from "@/lib/classes";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatEuro, toDateKey } from "@/lib/utils";

export const metadata = { title: "Informes" };

const STATUS_TONE = {
  programada: "neutral",
  impartida: "positive",
  cancelada: "negative",
} as const;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  // mes = "YYYY-MM"; por defecto, el mes actual.
  const now = new Date();
  const [year, month] = (mes ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    .split("-")
    .map(Number);

  const from = toDateKey(new Date(year, month - 1, 1));
  const to = toDateKey(new Date(year, month, 0));
  const prev = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, "0")}`;
  const next = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}`;
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  const reports = await teacherReports(from, to);
  const log = await sessionLog(from, to);

  const totalIncome = reports.reduce((a, r) => a + r.income, 0);
  const totalHours = reports.reduce((a, r) => a + r.hoursWorked, 0);
  const totalSessions = reports.reduce((a, r) => a + r.sessionsGiven, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/admin/informes?mes=${prev}`} className="btn-ghost !px-3">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <h2 className="font-semibold capitalize">{monthLabel}</h2>
        <Link href={`/admin/informes?mes=${next}`} className="btn-ghost !px-3">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Ingresos por clases"
          value={formatEuro(totalIncome)}
          icon={Euro}
        />
        <StatCard label="Horas impartidas" value={String(totalHours)} unit="h" icon={Clock} />
        <StatCard label="Clases impartidas" value={String(totalSessions)} icon={GraduationCap} />
      </div>

      <section className="glass p-6">
        <h2 className="font-semibold">Por profesor</h2>
        {reports.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Sin clases impartidas este mes. El profesor debe marcar sus clases como
            impartidas en la sección Clases.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/8 text-left text-xs text-muted">
                  <th className="pb-2 pr-4 font-medium">Profesor</th>
                  <th className="pb-2 pr-4 font-medium">Clases</th>
                  <th className="pb-2 pr-4 font-medium">Horas</th>
                  <th className="pb-2 font-medium">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.teacherId} className="border-b border-black/5 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-ink">{r.teacherName}</td>
                    <td className="py-2.5 pr-4">{r.sessionsGiven}</td>
                    <td className="py-2.5 pr-4">{r.hoursWorked} h</td>
                    <td className="py-2.5">{formatEuro(r.income)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Registro de clases y asistencias</h2>
        {log.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin actividad registrada este mes.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {log.map((s) => (
              <li
                key={s.sessionId}
                className="glass-soft flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {s.className}
                    <span className="text-muted"> · {s.teacherName}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(s.date)} · {s.startTime} ·{" "}
                    {s.kind === "grupal" ? "Grupal" : "Individual"}
                    {s.price > 0 ? ` · ${formatEuro(s.price)}` : ""}
                  </p>
                </div>
                {s.status === "impartida" ? (
                  <span className="text-xs text-muted">
                    ✓ {s.attendees} asistieron
                    {s.absents > 0 ? ` · ${s.absents} faltaron` : ""}
                  </span>
                ) : null}
                <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
