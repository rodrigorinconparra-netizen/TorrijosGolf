import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { conversationThread, isMember, markConversationRead } from "@/lib/chat";

/** Devuelve los mensajes de una conversación (para el polling del cliente). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const conversationId = Number((await params).id);
  if (!conversationId || !(await isMember(conversationId, user.userId))) {
    return NextResponse.json({ messages: [] });
  }

  const thread = await conversationThread(conversationId, user.userId);
  await markConversationRead(conversationId, user.userId);

  return NextResponse.json({ me: user.userId, messages: thread });
}
