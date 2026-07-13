import "server-only";
import { and, asc, eq, gt, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  conversationMembers,
  conversations,
  groupMembers,
  groups,
  messages,
  trainingAssignments,
  trainings,
  users,
} from "@/lib/db/schema";

/* ----------------------------------------------------------------------------
 * Conversaciones: DM (1-a-1) y grupos. Los chats de grupos de clases se enlazan
 * por `conversations.groupId` y su pertenencia se sincroniza con la del grupo.
 * ------------------------------------------------------------------------- */

export interface ConversationSummary {
  id: number;
  kind: "dm" | "group";
  /** Título a mostrar (nombre del grupo, o del otro usuario en un DM). */
  title: string;
  /** En un DM, el id del otro usuario (para llamar). */
  otherUserId: number | null;
  otherPhone: string | null;
  isClassGroup: boolean;
  memberCount: number;
  lastBody: string | null;
  lastAt: Date | null;
  unread: number;
}

/** Lista las conversaciones del usuario, ordenadas por actividad reciente. */
export async function listConversations(
  userId: number,
): Promise<ConversationSummary[]> {
  const rows = await db
    .select({
      id: conversations.id,
      kind: conversations.kind,
      title: conversations.title,
      groupId: conversations.groupId,
      lastReadAt: conversationMembers.lastReadAt,
      lastBody: sql<
        string | null
      >`(select body from messages m where m.conversation_id = ${conversations.id} order by m.created_at desc limit 1)`,
      lastAt: sql<
        Date | null
      >`(select created_at from messages m where m.conversation_id = ${conversations.id} order by m.created_at desc limit 1)`,
      memberCount: sql<number>`(select count(*) from conversation_members cm where cm.conversation_id = ${conversations.id})::int`,
      unread: sql<number>`(select count(*) from messages m where m.conversation_id = ${conversations.id} and m.sender_id <> ${userId} and (${conversationMembers.lastReadAt} is null or m.created_at > ${conversationMembers.lastReadAt}))::int`,
      otherUserId: sql<
        number | null
      >`(select cm2.user_id from conversation_members cm2 where cm2.conversation_id = ${conversations.id} and cm2.user_id <> ${userId} limit 1)`,
      otherName: sql<
        string | null
      >`(select u.name from conversation_members cm2 join users u on u.id = cm2.user_id where cm2.conversation_id = ${conversations.id} and cm2.user_id <> ${userId} limit 1)`,
      otherPhone: sql<
        string | null
      >`(select u.phone from conversation_members cm2 join users u on u.id = cm2.user_id where cm2.conversation_id = ${conversations.id} and cm2.user_id <> ${userId} limit 1)`,
    })
    .from(conversations)
    .innerJoin(
      conversationMembers,
      and(
        eq(conversationMembers.conversationId, conversations.id),
        eq(conversationMembers.userId, userId),
      ),
    );

  return rows
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.kind === "group" ? (r.title ?? "Grupo") : (r.otherName ?? "Usuario"),
      otherUserId: r.kind === "dm" ? r.otherUserId : null,
      otherPhone: r.kind === "dm" ? r.otherPhone : null,
      isClassGroup: r.groupId != null,
      memberCount: r.memberCount,
      lastBody: r.lastBody,
      // El subquery devuelve un string (driver neon-http): lo normalizamos a Date.
      lastAt: r.lastAt ? new Date(r.lastAt) : null,
      unread: r.unread,
    }))
    .sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0));
}

/** Total de mensajes sin leer (para badges). */
export async function unreadMessageCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(
      conversationMembers,
      and(
        eq(conversationMembers.conversationId, messages.conversationId),
        eq(conversationMembers.userId, userId),
      ),
    )
    .where(
      and(
        ne(messages.senderId, userId),
        or(
          isNull(conversationMembers.lastReadAt),
          gt(messages.createdAt, conversationMembers.lastReadAt),
        ),
      ),
    );
  return row?.n ?? 0;
}

export async function isMember(
  conversationId: number,
  userId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: conversationMembers.id })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export interface ConversationMemberInfo {
  /** Id del usuario que participa (el padre, si representa a un menor). */
  id: number;
  /** Nombre a mostrar: el del menor si participa en su nombre, si no el propio. */
  name: string;
  role: string;
  /** true si participa en nombre de un hijo menor. */
  isGuardian: boolean;
}

export interface ConversationDetail {
  id: number;
  kind: "dm" | "group";
  title: string;
  otherUserId: number | null;
  otherPhone: string | null;
  members: ConversationMemberInfo[];
}

/** Datos de cabecera de una conversación para el usuario dado. */
export async function conversationDetail(
  conversationId: number,
  userId: number,
): Promise<ConversationDetail | null> {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv) return null;

  const child = alias(users, "child");
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      phone: users.phone,
      childName: child.name,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .leftJoin(child, eq(child.id, conversationMembers.onBehalfOf))
    .where(eq(conversationMembers.conversationId, conversationId))
    .orderBy(asc(users.name));

  const other = conv.kind === "dm" ? members.find((m) => m.id !== userId) : undefined;

  return {
    id: conv.id,
    kind: conv.kind,
    title: conv.kind === "group" ? (conv.title ?? "Grupo") : (other?.name ?? "Usuario"),
    otherUserId: other?.id ?? null,
    otherPhone: other?.phone ?? null,
    members: members.map((m) => ({
      id: m.id,
      name: m.childName ?? m.name,
      role: m.role,
      isGuardian: Boolean(m.childName),
    })),
  };
}

/** Nombre a mostrar de cada miembro (nombre del hijo si participa como padre). */
async function memberDisplayNames(
  conversationId: number,
): Promise<Map<number, { name: string; isGuardian: boolean }>> {
  const child = alias(users, "child");
  const rows = await db
    .select({
      userId: conversationMembers.userId,
      name: users.name,
      childName: child.name,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .leftJoin(child, eq(child.id, conversationMembers.onBehalfOf))
    .where(eq(conversationMembers.conversationId, conversationId));
  return new Map(
    rows.map((r) => [
      r.userId,
      { name: r.childName ?? r.name, isGuardian: Boolean(r.childName) },
    ]),
  );
}

export interface TrainingCard {
  id: number;
  title: string;
  description: string;
  total: number;
  done: number;
  completedBy: string[];
  pendingBy: string[];
  /** Assignment del usuario que mira (si es alumno del entrenamiento). */
  myAssignmentId: number | null;
  myCompleted: boolean;
}

export interface ChatMessage {
  id: number;
  senderId: number;
  senderName: string;
  /** true si el remitente participa como padre/tutor de un menor. */
  senderIsGuardian: boolean;
  body: string;
  createdAt: Date;
  /** Presente si el mensaje es un entrenamiento enviado al grupo. */
  training?: TrainingCard;
}

/**
 * Mensajes de una conversación (orden cronológico). Los mensajes que enlazan un
 * entrenamiento se enriquecen con su progreso (quién lo ha completado) y con el
 * assignment del propio `viewerId`, para poder marcarlo desde el chat.
 */
export async function conversationThread(
  conversationId: number,
  viewerId: number,
): Promise<ChatMessage[]> {
  const rows = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      senderName: users.name,
      body: messages.body,
      trainingId: messages.trainingId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  // Nombres a mostrar (el del hijo si el remitente participa como padre).
  const displayBy = await memberDisplayNames(conversationId);

  const trainingIds = [
    ...new Set(rows.map((r) => r.trainingId).filter((id): id is number => id != null)),
  ];
  const cards = new Map<number, TrainingCard>();

  if (trainingIds.length) {
    const tInfo = await db
      .select({ id: trainings.id, title: trainings.title, description: trainings.description })
      .from(trainings)
      .where(inArray(trainings.id, trainingIds));
    const assignments = await db
      .select({
        id: trainingAssignments.id,
        trainingId: trainingAssignments.trainingId,
        studentId: trainingAssignments.studentId,
        completed: trainingAssignments.completed,
        name: users.name,
      })
      .from(trainingAssignments)
      .innerJoin(users, eq(users.id, trainingAssignments.studentId))
      .where(inArray(trainingAssignments.trainingId, trainingIds));

    for (const t of tInfo) {
      const mine = assignments.filter((a) => a.trainingId === t.id);
      const own = mine.find((a) => a.studentId === viewerId);
      cards.set(t.id, {
        id: t.id,
        title: t.title,
        description: t.description,
        total: mine.length,
        done: mine.filter((a) => a.completed).length,
        completedBy: mine.filter((a) => a.completed).map((a) => a.name),
        pendingBy: mine.filter((a) => !a.completed).map((a) => a.name),
        myAssignmentId: own?.id ?? null,
        myCompleted: own?.completed ?? false,
      });
    }
  }

  return rows.map((r) => {
    const disp = displayBy.get(r.senderId);
    return {
      id: r.id,
      senderId: r.senderId,
      senderName: disp?.name ?? r.senderName,
      senderIsGuardian: disp?.isGuardian ?? false,
      body: r.body,
      createdAt: r.createdAt,
      training: r.trainingId ? cards.get(r.trainingId) : undefined,
    };
  });
}

/** Devuelve el id de la conversación asociada a un grupo de clases (o null). */
export async function conversationIdForGroup(
  groupId: number,
): Promise<number | null> {
  const [row] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.groupId, groupId))
    .limit(1);
  return row?.id ?? null;
}

/** Inserta un mensaje "de sistema" (p. ej. una tarjeta de entrenamiento). */
export async function postGroupTrainingMessage(
  conversationId: number,
  senderId: number,
  trainingId: number,
  title: string,
): Promise<void> {
  await db.insert(messages).values({
    conversationId,
    senderId,
    body: `📋 Nuevo entrenamiento: ${title}`,
    trainingId,
  });
}

/** Marca la conversación como leída hasta ahora para el usuario. */
export async function markConversationRead(
  conversationId: number,
  userId: number,
): Promise<void> {
  await db
    .update(conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    );
}

/**
 * Devuelve el DM entre dos usuarios, creándolo si no existe. Como un DM tiene
 * exactamente 2 miembros, basta con buscar una conversación `dm` que contenga a
 * ambos.
 */
export async function getOrCreateDm(a: number, b: number): Promise<number> {
  const m1 = alias(conversationMembers, "m1");
  const m2 = alias(conversationMembers, "m2");
  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .innerJoin(m1, and(eq(m1.conversationId, conversations.id), eq(m1.userId, a)))
    .innerJoin(m2, and(eq(m2.conversationId, conversations.id), eq(m2.userId, b)))
    .where(eq(conversations.kind, "dm"))
    .limit(1);
  if (existing) return existing.id;

  const [conv] = await db
    .insert(conversations)
    .values({ kind: "dm", createdBy: a })
    .returning({ id: conversations.id });
  await db.insert(conversationMembers).values([
    { conversationId: conv.id, userId: a },
    { conversationId: conv.id, userId: b },
  ]);
  return conv.id;
}

/** ¿Es un chat de grupo gestionado por el club (ligado a un grupo de clases)? */
export async function isClassGroupChat(conversationId: number): Promise<boolean> {
  const [row] = await db
    .select({ groupId: conversations.groupId, kind: conversations.kind })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row?.kind === "group" && row.groupId != null;
}

/** Añade personas a un chat de grupo ya existente (solo grupos no de clases). */
export async function addMembersToGroupChat(
  conversationId: number,
  memberIds: number[],
): Promise<void> {
  if (memberIds.length === 0) return;
  await db
    .insert(conversationMembers)
    .values(memberIds.map((userId) => ({ conversationId, userId })))
    .onConflictDoNothing();
}

/** Saca a un usuario de un chat de grupo. */
export async function leaveGroupChat(
  conversationId: number,
  userId: number,
): Promise<void> {
  await db
    .delete(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    );
}

/**
 * Filtra una lista de ids dejando solo quienes permiten que les añadan a grupos
 * (Ajustes → groupAddable). Se usa al crear/añadir en grupos de usuarios; los
 * grupos de clases no pasan por aquí.
 */
export async function filterGroupAddable(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.groupAddable, true)));
  return rows.map((r) => r.id);
}

/** Borra un mensaje. Solo el autor (o un admin) puede hacerlo. */
export async function deleteMessage(
  messageId: number,
  userId: number,
  isAdmin: boolean,
): Promise<number | null> {
  const [msg] = await db
    .select({ id: messages.id, senderId: messages.senderId, conversationId: messages.conversationId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  if (!msg) return null;
  if (!isAdmin && msg.senderId !== userId) return null;
  await db.delete(messages).where(eq(messages.id, messageId));
  return msg.conversationId;
}

/** Crea un chat de grupo con un título y una lista de miembros (incluye al creador). */
export async function createGroupChat(
  creatorId: number,
  title: string,
  memberIds: number[],
): Promise<number> {
  const [conv] = await db
    .insert(conversations)
    .values({ kind: "group", title, createdBy: creatorId })
    .returning({ id: conversations.id });

  const ids = [...new Set([creatorId, ...memberIds])];
  await db
    .insert(conversationMembers)
    .values(ids.map((userId) => ({ conversationId: conv.id, userId })))
    .onConflictDoNothing();
  return conv.id;
}

/* ----------------------------------------------------------------------------
 * Sincronización con los grupos de clases
 * ------------------------------------------------------------------------- */

/** Devuelve (creándolo si hace falta) el chat asociado a un grupo de clases. */
export async function ensureGroupConversation(groupId: number): Promise<number> {
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group) throw new Error("El grupo no existe");

  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.groupId, groupId))
    .limit(1);

  let convId: number;
  if (existing) {
    convId = existing.id;
    // Mantén el título del chat sincronizado con el nombre del grupo.
    await db
      .update(conversations)
      .set({ title: group.name })
      .where(eq(conversations.id, convId));
  } else {
    const [conv] = await db
      .insert(conversations)
      .values({ kind: "group", title: group.name, groupId })
      .returning({ id: conversations.id });
    convId = conv.id;
  }

  await syncGroupConversationMembers(groupId, convId);
  return convId;
}

/** Alinea los miembros del chat de un grupo con sus alumnos + profesor. */
export async function syncGroupConversationMembers(
  groupId: number,
  convId?: number,
): Promise<void> {
  const [conv] = convId
    ? [{ id: convId }]
    : await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.groupId, groupId))
        .limit(1);
  if (!conv) return;

  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  // Alumnos del grupo, con su guardián si son menores gestionados.
  const memberRows = await db
    .select({ id: groupMembers.studentId, guardianId: users.guardianId })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.studentId))
    .where(eq(groupMembers.groupId, groupId));

  // Miembro del chat = el propio alumno (adulto) o su padre (menor, onBehalfOf).
  // Clave por userId; si un padre tiene varios hijos en el grupo, representa uno.
  const desired = new Map<number, number | null>();
  for (const m of memberRows) {
    if (m.guardianId) {
      if (!desired.has(m.guardianId)) desired.set(m.guardianId, m.id);
    } else {
      desired.set(m.id, null);
    }
  }
  // El profesor participa como él mismo (prioridad sobre representar a un hijo).
  if (group?.teacherId) desired.set(group.teacherId, null);

  const current = await db
    .select({
      userId: conversationMembers.userId,
      onBehalfOf: conversationMembers.onBehalfOf,
    })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conv.id));
  const currentMap = new Map(current.map((c) => [c.userId, c.onBehalfOf]));

  const toRemove = current
    .filter((c) => !desired.has(c.userId))
    .map((c) => c.userId);
  const toInsert: { conversationId: number; userId: number; onBehalfOf: number | null }[] =
    [];
  for (const [userId, onBehalfOf] of desired) {
    if (!currentMap.has(userId)) {
      toInsert.push({ conversationId: conv.id, userId, onBehalfOf });
    } else if (currentMap.get(userId) !== onBehalfOf) {
      await db
        .update(conversationMembers)
        .set({ onBehalfOf })
        .where(
          and(
            eq(conversationMembers.conversationId, conv.id),
            eq(conversationMembers.userId, userId),
          ),
        );
    }
  }

  if (toInsert.length) {
    await db.insert(conversationMembers).values(toInsert).onConflictDoNothing();
  }
  if (toRemove.length) {
    await db
      .delete(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conv.id),
          inArray(conversationMembers.userId, toRemove),
        ),
      );
  }
}

/* ----------------------------------------------------------------------------
 * Búsqueda de personas (respeta el opt-in de visibilidad)
 * ------------------------------------------------------------------------- */

export interface PersonResult {
  id: number;
  name: string;
  role: string;
}

/**
 * Busca usuarios por nombre, excluyendo al propio usuario, respetando la
 * preferencia adecuada al contexto:
 *  - `mode: "dm"`   → solo quienes aparecen en búsquedas (`discoverable`).
 *  - `mode: "group"`→ solo quienes permiten que les añadan a grupos (`groupAddable`).
 */
export async function searchPeople(
  meId: number,
  query: string,
  mode: "dm" | "group" = "dm",
  limit = 20,
): Promise<PersonResult[]> {
  const q = query.trim();
  const prefFilter =
    mode === "group" ? eq(users.groupAddable, true) : eq(users.discoverable, true);
  const where = q
    ? and(
        prefFilter,
        ne(users.id, meId),
        or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)),
      )
    : and(prefFilter, ne(users.id, meId));

  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(where)
    .orderBy(asc(users.name))
    .limit(limit);
}
