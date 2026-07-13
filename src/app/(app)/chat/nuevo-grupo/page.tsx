import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { GroupChatForm } from "./group-chat-form";

export const metadata = { title: "Nuevo grupo" };

export default async function NewGroupChatPage() {
  await requireSession();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/chat"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/8 bg-white/70 text-ink-soft transition hover:bg-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nuevo grupo</h1>
          <p className="text-sm text-muted">Crea un chat con varias personas del club</p>
        </div>
      </div>

      <div className="glass p-6">
        <GroupChatForm />
      </div>
    </div>
  );
}
