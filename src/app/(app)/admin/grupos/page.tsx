import { asc, eq } from "drizzle-orm";
import { Trash2, UserPlus, X, Users } from "lucide-react";
import { db } from "@/lib/db";
import { groupMembers, groups, users } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { GroupForm } from "./group-form";
import {
  addGroupMemberAction,
  deleteGroupAction,
  removeGroupMemberAction,
  setGroupTeacherAction,
} from "../actions";

export const metadata = { title: "Grupos" };

export default async function AdminGroupsPage() {
  const allUsers = await db.select().from(users).orderBy(asc(users.name));
  const teachers = allUsers.filter((u) => u.role === "profesor");
  const students = allUsers.filter((u) => u.role === "alumno");

  const allGroups = await db.select().from(groups).orderBy(asc(groups.name));
  const members = await db
    .select({
      groupId: groupMembers.groupId,
      studentId: groupMembers.studentId,
      name: users.name,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.studentId));

  const nameOf = new Map(allUsers.map((u) => [u.id, u.name]));

  return (
    <div className="space-y-6">
      <section className="glass p-6">
        <h2 className="font-semibold">Crear grupo de clases</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Un grupo reúne a varios alumnos con un profesor (clases grupales).
        </p>
        <GroupForm teachers={teachers.map((t) => ({ id: t.id, name: t.name }))} />
      </section>

      {allGroups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aún no hay grupos"
          description="Crea el primer grupo y añade alumnos para organizar las clases grupales."
        />
      ) : (
        allGroups.map((g) => {
          const groupStudents = members.filter((m) => m.groupId === g.id);
          const memberIds = new Set(groupStudents.map((m) => m.studentId));
          const candidates = students.filter((s) => !memberIds.has(s.id));
          return (
            <section key={g.id} className="glass p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="text-sm text-muted">
                    {g.description ? `${g.description} · ` : ""}
                    {g.teacherId
                      ? `Profesor: ${nameOf.get(g.teacherId) ?? "?"}`
                      : "Sin profesor asignado"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="accent">
                    {groupStudents.length}{" "}
                    {groupStudents.length === 1 ? "alumno" : "alumnos"}
                  </Badge>
                  <form action={deleteGroupAction}>
                    <input type="hidden" name="groupId" value={g.id} />
                    <button
                      type="submit"
                      title="Eliminar grupo"
                      className="btn-danger !px-2.5 !py-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {groupStudents.length === 0 ? (
                  <p className="text-xs text-faint">Sin alumnos todavía.</p>
                ) : (
                  groupStudents.map((m) => (
                    <form key={m.studentId} action={removeGroupMemberAction} className="inline">
                      <input type="hidden" name="groupId" value={g.id} />
                      <input type="hidden" name="studentId" value={m.studentId} />
                      <button
                        type="submit"
                        title="Quitar del grupo"
                        className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-deep transition hover:bg-negative/10 hover:text-negative"
                      >
                        {m.name}
                        <X className="h-3 w-3" />
                      </button>
                    </form>
                  ))
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <form action={addGroupMemberAction} className="flex items-center gap-2">
                  <input type="hidden" name="groupId" value={g.id} />
                  <select name="studentId" required className="field !w-56" defaultValue="">
                    <option value="" disabled>
                      Añadir alumno…
                    </option>
                    {candidates.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn-ghost !px-3">
                    <UserPlus className="h-4 w-4" /> Añadir
                  </button>
                </form>
                <form action={setGroupTeacherAction} className="flex items-center gap-2">
                  <input type="hidden" name="groupId" value={g.id} />
                  <select
                    name="teacherId"
                    className="field !w-56"
                    defaultValue={g.teacherId ?? ""}
                  >
                    <option value="">Sin profesor</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn-ghost !px-3">
                    Cambiar profesor
                  </button>
                </form>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
