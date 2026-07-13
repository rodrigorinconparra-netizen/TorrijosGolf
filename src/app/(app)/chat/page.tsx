import Link from "next/link";
import { MessageCircle, Phone, ChevronRight, Users, UsersRound } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listConversations } from "@/lib/chat";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import { PeopleSearch } from "./people-search";

export const metadata = { title: "Chat" };

export default async function ChatListPage() {
  const user = await requireSession();
  const conversations = await listConversations(user.userId);

  return (
    <>
      <PageHeader
        title="Chat"
        subtitle="Habla con cualquier persona del club o en tus grupos"
        action={
          <Link href="/chat/nuevo-grupo" className="btn-primary text-sm">
            <UsersRound className="h-4 w-4" /> Nuevo grupo
          </Link>
        }
      />

      <PeopleSearch />

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Todavía no tienes conversaciones"
          description="Busca a una persona arriba para escribirle, o crea un grupo. Los grupos de clases aparecen aquí automáticamente."
        />
      ) : (
        <div className="glass divide-y divide-black/5 p-2">
          {conversations.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-2">
              <Link
                href={`/chat/${c.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-2 transition hover:bg-black/5"
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                    c.kind === "group"
                      ? "bg-accent/12 text-accent-deep"
                      : "bg-accent text-on-accent"
                  }`}
                >
                  {c.kind === "group" ? (
                    <Users className="h-5 w-5" />
                  ) : (
                    initials(c.title)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">{c.title}</p>
                    {c.kind === "group" ? (
                      <Badge tone={c.isClassGroup ? "accent" : "neutral"}>
                        {c.isClassGroup ? "Clase" : "Grupo"}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted">
                    {c.kind === "group" ? `${c.memberCount} miembros · ` : ""}
                    {c.lastBody ?? "Sin mensajes todavía"}
                  </p>
                </div>
                {c.unread > 0 ? (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-negative px-1.5 text-[11px] font-semibold text-on-accent">
                    {c.unread > 9 ? "9+" : c.unread}
                  </span>
                ) : (
                  <ChevronRight className="h-4 w-4 text-faint" />
                )}
              </Link>
              {c.kind === "dm" && c.otherPhone ? (
                <a
                  href={`tel:${c.otherPhone}`}
                  title={`Llamar a ${c.title}`}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/8 bg-white/70 text-accent transition hover:bg-white"
                >
                  <Phone className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
