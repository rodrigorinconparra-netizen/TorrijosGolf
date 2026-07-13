import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  Clock,
  Euro,
  GraduationCap,
  Layers,
  UserPlus,
  Users,
} from "lucide-react";
import {
  monthKpis,
  monthlySeries,
  occupancy,
  studentActivity,
  teacherPerformance,
  userBreakdown,
  type MonthKpis,
} from "@/lib/analytics";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { BarChart } from "@/components/ui/bar-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { formatEuro, formatDate } from "@/lib/utils";

export const metadata = { title: "Negocio" };

/** Variación mes contra mes, como texto con flecha y color. */
function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    if (current === 0) return <span className="text-faint">Sin cambios</span>;
    return (
      <span className="inline-flex items-center gap-0.5 text-positive">
        <ArrowUpRight className="h-3 w-3" /> Nuevo
      </span>
    );
  }
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-muted">
        <ArrowRight className="h-3 w-3" /> 0%
      </span>
    );
  }
  const up = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${up ? "text-positive" : "text-negative"}`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}
      {pct}% vs. mes anterior
    </span>
  );
}

export default async function AdminBusinessPage() {
  const [{ current, previous }, series, teachers, students, users, occ] =
    await Promise.all([
      monthKpis(),
      monthlySeries(12),
      teacherPerformance(),
      studentActivity(),
      userBreakdown(),
      occupancy(),
    ]);

  const kpi = (key: keyof MonthKpis) => ({
    current: current[key],
    previous: previous[key],
  });

  const totalYearIncome = series.reduce((a, p) => a + p.income, 0);
  const activeStudents = students.filter((s) => s.attended > 0 || s.noShows > 0);
  const occPct =
    occ.totalSlots > 0 ? Math.round((occ.assigned / occ.totalSlots) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* KPIs del mes en curso */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Este mes</h2>
          <Badge tone="neutral">
            {new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Ingresos"
            value={formatEuro(current.income)}
            hint=""
            icon={Euro}
          />
          <StatCard
            label="Clases impartidas"
            value={String(current.sessions)}
            unit="clases"
            icon={CalendarCheck}
          />
          <StatCard
            label="Horas trabajadas"
            value={String(current.hours)}
            unit="h"
            icon={Clock}
          />
          <StatCard
            label="Alumnos activos"
            value={String(current.activeStudents)}
            unit="alumnos"
            icon={GraduationCap}
          />
          <StatCard
            label="Altas nuevas"
            value={String(current.newUsers)}
            unit="usuarios"
            icon={UserPlus}
          />
          <StatCard
            label="Reservas aceptadas"
            value={String(current.bookings)}
            unit="reservas"
            icon={Layers}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <p>
            Ingresos: <Delta {...kpi("income")} />
          </p>
          <p>
            Clases: <Delta {...kpi("sessions")} />
          </p>
          <p>
            Alumnos activos: <Delta {...kpi("activeStudents")} />
          </p>
        </div>
      </section>

      {/* Evolución de ingresos */}
      <section className="glass p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Ingresos por mes</h2>
            <p className="mt-0.5 text-sm text-muted">Últimos 12 meses</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight text-ink">
              {formatEuro(totalYearIncome)}
            </p>
            <p className="text-xs text-muted">total del periodo</p>
          </div>
        </div>
        <div className="mt-4">
          <BarChart
            points={series.map((p) => ({
              label: p.label,
              value: p.income,
              display: formatEuro(p.income),
            }))}
          />
        </div>
      </section>

      {/* Control de profesores */}
      <section className="glass p-6">
        <h2 className="font-semibold">Rendimiento por profesor</h2>
        <p className="mb-4 mt-0.5 text-sm text-muted">
          Ingresos generados, carga de clases y alumnos asignados.
        </p>
        {teachers.length === 0 ? (
          <p className="text-sm text-faint">No hay profesores registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">Profesor</th>
                  <th className="px-3 py-2 text-right font-medium">Alumnos</th>
                  <th className="px-3 py-2 text-right font-medium">Clases (mes)</th>
                  <th className="px-3 py-2 text-right font-medium">Horas (mes)</th>
                  <th className="px-3 py-2 text-right font-medium">Ingresos (mes)</th>
                  <th className="px-3 py-2 text-right font-medium">Ingresos (total)</th>
                  <th className="py-2 pl-3 text-right font-medium">Horas libres</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.teacherId} className="border-b border-black/5 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-ink">{t.teacherName}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{t.students}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{t.sessionsMonth}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{t.hoursMonth}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatEuro(t.incomeMonth)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-accent">
                      {formatEuro(t.incomeTotal)}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-muted">
                      {t.freeHours}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Control de usuarios */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass p-6 lg:col-span-1">
          <h2 className="font-semibold">Usuarios</h2>
          <p className="mb-4 mt-0.5 text-sm text-muted">Composición del club.</p>
          <dl className="space-y-2.5 text-sm">
            <Row label="Alumnos" value={users.alumnos} />
            <Row label="Profesores" value={users.profesores} />
            <Row label="Administradores" value={users.admins} />
            <Row label="Menores (con tutor)" value={users.minors} />
            <div className="my-2 border-t border-black/10" />
            <Row label="Altas este mes" value={users.newThisMonth} accent />
            <Row label="Activos este mes" value={users.activeThisMonth} accent />
            <Row label="Total" value={users.total} strong />
          </dl>
        </div>

        <div className="glass p-6 lg:col-span-2">
          <h2 className="font-semibold">Ocupación del horario</h2>
          <p className="mb-4 mt-0.5 text-sm text-muted">
            Horas semanales recurrentes asignadas frente a las libres.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Horas totales" value={String(occ.totalSlots)} />
            <StatCard label="Asignadas" value={String(occ.assigned)} unit={`${occPct}%`} />
            <StatCard label="Libres" value={String(occ.free)} />
          </div>
          <div className="mt-4">
            <div className="h-3 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${occPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {occ.freeAvailability} franjas de disponibilidad puntual abiertas para reservar.
            </p>
          </div>
        </div>
      </section>

      {/* Actividad por alumno */}
      <section className="glass p-6">
        <h2 className="font-semibold">Alumnos por gasto</h2>
        <p className="mb-4 mt-0.5 text-sm text-muted">
          Clases asistidas, ausencias y gasto acumulado.
        </p>
        {activeStudents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Todavía sin actividad"
            description="Cuando los alumnos asistan a clases verás aquí su gasto y asistencia."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">Alumno</th>
                  <th className="px-3 py-2 text-right font-medium">Asistidas</th>
                  <th className="px-3 py-2 text-right font-medium">Ausencias</th>
                  <th className="px-3 py-2 text-right font-medium">Gasto</th>
                  <th className="py-2 pl-3 text-right font-medium">Última clase</th>
                </tr>
              </thead>
              <tbody>
                {activeStudents.map((s) => (
                  <tr key={s.studentId} className="border-b border-black/5 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-ink">{s.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.attended}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                      {s.noShows}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-accent">
                      {formatEuro(s.spent)}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-muted">
                      {s.lastDate ? formatDate(s.lastDate) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  strong,
}: {
  label: string;
  value: number;
  accent?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd
        className={
          strong
            ? "text-base font-semibold text-ink"
            : accent
              ? "font-semibold text-accent tabular-nums"
              : "font-medium text-ink tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}
