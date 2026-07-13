import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Phone, Users, Settings2 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import {
  conversationDetail,
  conversationThread,
  isMember,
  markConversationRead,
} from "@/lib/chat";
import { initials } from "@/lib/utils";
import { Thread } from "./thread";

export const metadata = { title: "Chat" };

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  const conversationId = Number((await params).id);
  if (!conversationId || !(await isMember(conversationId, user.userId))) notFound();

  const detail = await conversationDetail(conversationId, user.userId);
  if (!detail) notFound();

  const thread = await conversationThread(conversationId, user.userId);
  await markConversationRead(conversationId, user.userId);

  const initialMsgs = thread.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderName,
    senderIsGuardian: m.senderIsGuardian,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    training: m.training,
  }));

  const subtitle =
    detail.kind === "group"
      ? detail.members.map((m) => m.name.split(" ")[0]).join(", ")
      : detail.otherUserId
        ? "Mensaje directo"
        : "";

  return (
    <div className="flex h-[calc(100dvh-13rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col md:h-[calc(100dvh-9rem)]">
      <div className="glass flex shrink-0 items-center gap-3 px-4 py-3">
        <Link
          href="/chat"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/8 bg-white/70 text-ink-soft transition hover:bg-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${
            detail.kind === "group"
              ? "bg-accent/12 text-accent-deep"
              : "bg-accent text-on-accent"
          }`}
        >
          {detail.kind === "group" ? (
            <Users className="h-5 w-5" />
          ) : (
            initials(detail.title)
          )}
        </span>
        {detail.kind === "group" ? (
          <Link href={`/chat/${conversationId}/info`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{detail.title}</p>
            <p className="truncate text-xs text-muted">{subtitle}</p>
          </Link>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{detail.title}</p>
            <p className="truncate text-xs text-muted">{subtitle}</p>
          </div>
        )}
        {detail.kind === "dm" && detail.otherPhone ? (
          <a
            href={`tel:${detail.otherPhone}`}
            title={`Llamar a ${detail.title}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition hover:bg-accent-deep"
          >
            <Phone className="h-4 w-4" />
          </a>
        ) : null}
        {detail.kind === "group" ? (
          <Link
            href={`/chat/${conversationId}/info`}
            title="Información del grupo"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/8 bg-white/70 text-ink-soft transition hover:bg-white"
          >
            <Settings2 className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 min-h-0 flex-1">
        <Thread
          conversationId={conversationId}
          me={user.userId}
          isAdmin={user.role === "admin"}
          isGroup={detail.kind === "group"}
          initial={initialMsgs}
        />
      </div>
    </div>
  );
}
