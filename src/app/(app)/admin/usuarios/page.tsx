import Link from "next/link";
import { asc } from "drizzle-orm";
import { Trash2, Link2, X } from "lucide-react";
import { db } from "@/lib/db";
import { teacherStudents, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { studentIdsOfTeacher } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { TeacherForm } from "./teacher-form";
import {
  assignStudentAction,
  deleteUserAction,
  setRoleAction,
  unassignStudentAction,
} from "../actions";

export const metadata = { title: "Usuarios" };

const ROLE_TONE = { admin: "warning", profesor: "accent", alumno: "neutral" } as const;
const ROLE_LABEL = { admin: "Admin", profesor: "Profesor", alumno: "Alumno" } as const;

export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  const allUsers = await db.select().from(users).orderBy(asc(users.name));
  const teachers = allUsers.filter((u) => u.role === "profesor");
  const students = allUsers.filter((u) => u.role === "alumno");

  const assignments = await db
    .select({
      teacherId: teacherStudents.teacherId,
      studentId: teacherStudents.studentId,
    })
    .from(teacherStudents);
  // Asignaciones directas (quitables desde aquí).
  const directByTeacher = new Map<number, Set<number>>();
  for (const a of assignments) {
    const set = directByTeacher.get(a.teacherId) ?? new Set<number>();
    set.add(a.studentId);
    directByTeacher.set(a.teacherId, set);
  }
  // Conjunto COMPLETO de alumnos por profesor (directos + grupos + horas).
  const allByTeacher = new Map<number, number[]>();
  for (const t of teachers) {
    allByTeacher.set(t.id, await studentIdsOfTeacher(t.id));
  }
  const nameOf = new Map(allUsers.map((u) => [u.id, u.name]));

  return (
    <div className="space-y-6">
      <section className="glass p-6">
        <h2 className="font-semibold">Registrar profesor</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Crea la cuenta del profesor; podrá entrar con el email y la contraseña
          provisional que le indiques.
        </p>
        <TeacherForm />
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Asignar alumnos a profesores</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Además de los grupos, puedes vincular alumnos directamente a un profesor
          (clases individuales, seguimiento…).
        </p>
        <form action={assignStudentAction} className="flex flex-wrap items-center gap-2">
          <select name="studentId" required className="field max-w-56" defaultValue="">
            <option value="" disabled>
              Alumno…
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted">con</span>
          <select name="teacherId" required className="field max-w-56" defaultValue="">
            <option value="" disabled>
              Profesor…
            </option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary">
            <Link2 className="h-4 w-4" /> Asignar
          </button>
        </form>

        {teachers.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {teachers.map((t) => {
              const direct = directByTeacher.get(t.id) ?? new Set<number>();
              const all = allByTeacher.get(t.id) ?? [];
              // Ordenados por nombre, con los directos primero para agrupar los quitables.
              const sorted = [...all].sort((a, b) =>
                (nameOf.get(a) ?? "").localeCompare(nameOf.get(b) ?? ""),
              );
              return (
                <li key={t.id} className="glass-soft px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{t.name}</p>
                    <Badge tone="neutral">
                      {all.length} {all.length === 1 ? "alumno" : "alumnos"}
                    </Badge>
                  </div>
                  {sorted.length === 0 ? (
                    <p className="mt-1 text-xs text-faint">Sin alumnos todavía</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sorted.map((sid) =>
                        direct.has(sid) ? (
                          <form key={sid} action={unassignStudentAction} className="inline">
                            <input type="hidden" name="teacherId" value={t.id} />
                            <input type="hidden" name="studentId" value={sid} />
                            <button
                              type="submit"
                              title="Quitar asignación directa"
                              className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-deep transition hover:bg-negative/10 hover:text-negative"
                            >
                              {nameOf.get(sid) ?? sid}
                              <X className="h-3 w-3" />
                            </button>
                          </form>
                        ) : (
                          <span
                            key={sid}
                            title="Alumno por grupo u hora asignada"
                            className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-muted"
                          >
                            {nameOf.get(sid) ?? sid}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className="glass p-6">
        <h2 className="font-semibold">Todos los usuarios ({allUsers.length})</h2>
        <ul className="mt-4 divide-y divide-black/5">
          {allUsers.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
              <Link
                href={`/admin/usuarios/${u.id}`}
                className="group min-w-0 flex-1 rounded-xl transition"
              >
                <p className="truncate text-sm font-medium text-ink group-hover:text-accent">
                  {u.name}
                  {u.id === admin.userId ? (
                    <span className="text-faint"> (tú)</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted">
                  {u.email}
                  {u.license ? ` · Lic. ${u.license}` : ""}
                  {u.phone ? ` · ${u.phone}` : ""}
                </p>
              </Link>
              <Link
                href={`/admin/usuarios/${u.id}`}
                className="btn-ghost !px-3 !py-1.5 text-xs"
              >
                Ver ficha
              </Link>
              <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
              {u.id !== admin.userId ? (
                <>
                  <form action={setRoleAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="userId" value={u.id} />
                    <select
                      name="role"
                      defaultValue={u.role}
                      className="field !w-auto !px-2.5 !py-1.5 text-xs"
                    >
                      <option value="alumno">Alumno</option>
                      <option value="profesor">Profesor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button type="submit" className="btn-ghost !px-3 !py-1.5 text-xs">
                      Cambiar
                    </button>
                  </form>
                  <form action={deleteUserAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button
                      type="submit"
                      title="Eliminar usuario"
                      className="btn-danger !px-2.5 !py-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
