import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, LogOut, Users, Shield } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import {
  conversationDetail,
  isClassGroupChat,
  isMember,
} from "@/lib/chat";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import { AddMembers } from "./add-members";
import { leaveGroupAction } from "../../actions";

export const metadata = { title: "Grupo" };

const ROLE_LABEL: Record<string, string> = {
  admin: "Club",
  profesor: "Profesor",
  alumno: "Alumno",
};

export default async function GroupInfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  const conversationId = Number((await params).id);
  if (!conversationId || !(await isMember(conversationId, user.userId))) notFound();

  const detail = await conversationDetail(conversationId, user.userId);
  if (!detail || detail.kind !== "group") notFound();

  const isClassGroup = await isClassGroupChat(conversationId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/chat/${conversationId}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/8 bg-white/70 text-ink-soft transition hover:bg-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{detail.title}</h1>
          <p className="text-sm text-muted">
            {detail.members.length} miembros
            {isClassGroup ? " · Grupo de clases" : ""}
          </p>
        </div>
      </div>

      {isClassGroup ? (
        <div className="glass flex items-start gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
            <Shield className="h-4 w-4" />
          </span>
          <p className="text-sm text-muted">
            Este es el chat de un grupo de clases. Sus miembros se gestionan
            automáticamente desde el panel del club (Admin → Grupos): al añadir o
            quitar alumnos del grupo, entran o salen de este chat.
          </p>
        </div>
      ) : (
        <section className="glass p-6">
          <h2 className="font-semibold">Añadir personas</h2>
          <p className="mb-3 mt-1 text-sm text-muted">
            Busca a cualquier persona visible del club para sumarla al grupo.
          </p>
          <AddMembers
            conversationId={conversationId}
            existingIds={detail.members.map((m) => m.id)}
          />
        </section>
      )}

      <section className="glass p-6">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted" />
          <h2 className="font-semibold">Miembros</h2>
        </div>
        <ul className="mt-4 space-y-2">
          {detail.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-on-accent">
                {initials(m.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {m.name}
                  {m.isGuardian ? (
                    <span className="text-faint"> · padre/tutor</span>
                  ) : null}
                  {m.id === user.userId ? <span className="text-faint"> (tú)</span> : null}
                </p>
              </div>
              <Badge tone={m.role === "alumno" ? "neutral" : "accent"}>
                {ROLE_LABEL[m.role] ?? m.role}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      {!isClassGroup ? (
        <form action={leaveGroupAction}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <button type="submit" className="btn-danger w-full sm:w-auto">
            <LogOut className="h-4 w-4" /> Salir del grupo
          </button>
        </form>
      ) : null}
    </div>
  );
}
