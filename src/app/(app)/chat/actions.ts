"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { conversationMembers, messages, users } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import {
  addMembersToGroupChat,
  createGroupChat,
  deleteMessage,
  filterGroupAddable,
  getOrCreateDm,
  isClassGroupChat,
  isMember,
  leaveGroupChat,
} from "@/lib/chat";
import { notifyUsers } from "@/lib/notify";

export interface ChatActionState {
  error?: string;
}

/** Abre (o crea) el DM con otra persona y navega a la conversación. */
export async function startDmAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const otherId = Number(formData.get("otherId"));
  if (!otherId || otherId === user.userId) return;

  // El destinatario debe existir; la visibilidad se filtra en la búsqueda, pero
  // permitimos abrir DM con cualquiera con quien ya compartas conversación/grupo.
  const [other] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, otherId))
    .limit(1);
  if (!other) return;

  const convId = await getOrCreateDm(user.userId, otherId);
  redirect(`/chat/${convId}`);
}

const groupSchema = z.object({
  title: z.string().trim().min(2, "Ponle un nombre al grupo"),
  memberIds: z.array(z.coerce.number().int().positive()).min(1, "Añade al menos una persona"),
});

/** Crea un chat de grupo con los miembros elegidos. */
export async function createGroupChatAction(
  _prev: ChatActionState,
  formData: FormData,
): Promise<ChatActionState> {
  const user = await requireSession();
  const parsed = groupSchema.safeParse({
    title: formData.get("title"),
    memberIds: formData.getAll("memberIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }

  // Respeta la preferencia de cada persona de "que me puedan añadir a grupos".
  const allowed = await filterGroupAddable(parsed.data.memberIds);
  if (allowed.length === 0) {
    return { error: "Las personas elegidas no permiten que les añadan a grupos" };
  }

  const convId = await createGroupChat(user.userId, parsed.data.title, allowed);
  redirect(`/chat/${convId}`);
}

/** Envía un mensaje a una conversación (DM o grupo). */
export async function sendMessageAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const conversationId = Number(formData.get("conversationId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!conversationId || !body) return;
  if (!(await isMember(conversationId, user.userId))) return;

  await db.insert(messages).values({
    conversationId,
    senderId: user.userId,
    body: body.slice(0, 2000),
  });

  // Notifica al resto de miembros de la conversación.
  const others = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        ne(conversationMembers.userId, user.userId),
      ),
    );

  await notifyUsers(
    others.map((o) => o.userId),
    {
      type: "chat",
      title: `Mensaje de ${user.name}`,
      body: body.slice(0, 120),
      link: `/chat/${conversationId}`,
    },
  );

  revalidatePath(`/chat/${conversationId}`);
  revalidatePath("/chat");
}

/** Añade personas a un chat de grupo existente (no los de clases). */
export async function addMembersToGroupAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const conversationId = Number(formData.get("conversationId"));
  const memberIds = formData
    .getAll("memberIds")
    .map((v) => Number(v))
    .filter(Boolean);
  if (!conversationId || memberIds.length === 0) return;
  if (!(await isMember(conversationId, user.userId))) return;
  // Los chats de grupos de clases los gestiona el club desde administración.
  if (await isClassGroupChat(conversationId)) return;

  // Solo se puede añadir a quien permite que le añadan a grupos.
  const allowed = await filterGroupAddable(memberIds);
  if (allowed.length === 0) return;

  await addMembersToGroupChat(conversationId, allowed);

  await notifyUsers(allowed, {
    type: "chat",
    title: "Te han añadido a un grupo",
    body: `${user.name} te ha añadido a un chat de grupo.`,
    link: `/chat/${conversationId}`,
  });

  revalidatePath(`/chat/${conversationId}`);
  revalidatePath(`/chat/${conversationId}/info`);
  revalidatePath("/chat");
}

/** Borra un mensaje del chat. Solo el autor (o un admin). */
export async function deleteMessageAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const messageId = Number(formData.get("messageId"));
  if (!messageId) return;
  const conversationId = await deleteMessage(
    messageId,
    user.userId,
    user.role === "admin",
  );
  if (conversationId != null) {
    revalidatePath(`/chat/${conversationId}`);
    revalidatePath("/chat");
  }
}

/** El usuario abandona un chat de grupo (no los de clases). */
export async function leaveGroupAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  const conversationId = Number(formData.get("conversationId"));
  if (!conversationId) return;
  if (!(await isMember(conversationId, user.userId))) return;
  if (await isClassGroupChat(conversationId)) return;

  await leaveGroupChat(conversationId, user.userId);
  revalidatePath("/chat");
  redirect("/chat");
}
