import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  attendance,
  conversationMembers,
  conversations,
  deviceTokens,
  eventRsvps,
  events,
  groupMembers,
  groups,
  messages,
  notifications,
  sessions,
  slots,
  teacherStudents,
  trainingAssignments,
  trainings,
  users,
} from "./schema";
import { hashPassword } from "../auth/password";

/**
 * Puebla la base con datos de demostración: un admin, dos profesores y varios
 * alumnos, con grupos, horas de horario, un entrenamiento y un evento.
 *
 * Ejecuta:  npm run db:push   (crea las tablas)
 *           npm run db:seed   (rellena con estos datos)
 *
 * ⚠️  Borra TODOS los datos existentes antes de insertar.
 */
async function seed() {
  console.log("🌱  Limpiando tablas…");
  // El orden respeta las FKs (los ON DELETE CASCADE ayudan, pero somos explícitos).
  await db.delete(attendance);
  await db.delete(sessions);
  await db.delete(trainingAssignments);
  await db.delete(trainings);
  await db.delete(messages);
  await db.delete(conversationMembers);
  await db.delete(conversations);
  await db.delete(notifications);
  await db.delete(deviceTokens);
  await db.delete(eventRsvps);
  await db.delete(events);
  await db.delete(slots);
  await db.delete(groupMembers);
  await db.delete(groups);
  await db.delete(teacherStudents);
  await db.delete(users);

  // Contraseña de cada usuario = el texto anterior a la "@" de su email.
  // (placeholder al insertar; se re-hashea por usuario más abajo)
  const pass = await hashPassword("temporal");

  console.log("👤  Creando usuarios…");
  const [admin] = await db
    .insert(users)
    .values({
      name: "Rodrigo Rincón",
      email: "admin@torrijosgolf.es",
      passwordHash: pass,
      role: "admin",
      phone: "600100100",
      license: "ADM-001",
    })
    .returning();

  const [profAna, profLuis] = await db
    .insert(users)
    .values([
      {
        name: "Ana García",
        email: "ana@torrijosgolf.es",
        passwordHash: pass,
        role: "profesor",
        phone: "600200200",
        license: "PRO-201",
        hourlyRate: 35,
      },
      {
        name: "Luis Martín",
        email: "luis@torrijosgolf.es",
        passwordHash: pass,
        role: "profesor",
        phone: "600300300",
        license: "PRO-202",
        hourlyRate: 40,
      },
    ])
    .returning();

  const students = await db
    .insert(users)
    .values(
      [
        ["Carlos Díaz", "carlos@example.com", "600400401"],
        ["María López", "maria@example.com", "600400402"],
        ["Javier Ruiz", "javier@example.com", "600400403"],
        ["Elena Sanz", "elena@example.com", "600400404"],
        ["Pablo Moreno", "pablo@example.com", "600400405"],
      ].map(([name, email, phone], i) => ({
        name,
        email,
        passwordHash: pass,
        role: "alumno" as const,
        phone,
        license: `LIC-${1000 + i}`,
      })),
    )
    .returning();

  console.log("🔑  Fijando contraseñas (parte local del email)…");
  const allUsers = [admin, profAna, profLuis, ...students];
  for (const u of allUsers) {
    const local = u.email.split("@")[0];
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(local) })
      .where(eq(users.id, u.id));
  }

  console.log("👥  Grupos…");
  const [grupoInfantil, grupoAdultos] = await db
    .insert(groups)
    .values([
      { name: "Infantil martes", description: "Iniciación 8-14 años", teacherId: profAna.id },
      { name: "Adultos jueves", description: "Nivel intermedio", teacherId: profLuis.id },
    ])
    .returning();

  await db.insert(groupMembers).values([
    { groupId: grupoInfantil.id, studentId: students[0].id },
    { groupId: grupoInfantil.id, studentId: students[1].id },
    { groupId: grupoInfantil.id, studentId: students[2].id },
    { groupId: grupoAdultos.id, studentId: students[3].id },
    { groupId: grupoAdultos.id, studentId: students[4].id },
  ]);

  console.log("💬  Chats de grupo…");
  // Cada grupo de clases tiene su chat, con el profesor y sus alumnos.
  const groupChats: { groupId: number; teacherId: number; studentIdx: number[] }[] = [
    { groupId: grupoInfantil.id, teacherId: profAna.id, studentIdx: [0, 1, 2] },
    { groupId: grupoAdultos.id, teacherId: profLuis.id, studentIdx: [3, 4] },
  ];
  for (const gc of groupChats) {
    const [group] = await db.select().from(groups).where(eq(groups.id, gc.groupId));
    const [conv] = await db
      .insert(conversations)
      .values({ kind: "group", title: group.name, groupId: gc.groupId })
      .returning();
    const memberIds = [gc.teacherId, ...gc.studentIdx.map((i) => students[i].id)];
    await db
      .insert(conversationMembers)
      .values(memberIds.map((userId) => ({ conversationId: conv.id, userId })));
  }

  console.log("🔗  Asignaciones alumno-profesor…");
  await db.insert(teacherStudents).values([
    { teacherId: profAna.id, studentId: students[0].id },
    { teacherId: profLuis.id, studentId: students[3].id },
  ]);

  console.log("🕒  Horario…");
  await db.insert(slots).values([
    // Ana: grupal infantil los martes + individual con Carlos los lunes
    {
      teacherId: profAna.id,
      weekday: 2,
      startTime: "17:00",
      durationMin: 60,
      kind: "grupal",
      groupId: grupoInfantil.id,
      price: 15,
    },
    {
      teacherId: profAna.id,
      weekday: 1,
      startTime: "10:00",
      durationMin: 60,
      kind: "individual",
      studentId: students[0].id,
      price: 35,
    },
    // Luis: grupal adultos jueves + individual con Elena miércoles
    {
      teacherId: profLuis.id,
      weekday: 4,
      startTime: "18:00",
      durationMin: 90,
      kind: "grupal",
      groupId: grupoAdultos.id,
      price: 20,
    },
    {
      teacherId: profLuis.id,
      weekday: 3,
      startTime: "11:00",
      durationMin: 60,
      kind: "individual",
      studentId: students[3].id,
      price: 40,
    },
  ]);

  console.log("💪  Entrenamiento…");
  const [training] = await db
    .insert(trainings)
    .values({
      teacherId: profAna.id,
      title: "Rutina de putt semanal",
      description:
        "3 series de 10 putts a 1m, 2m y 3m. Objetivo: 8/10 en cada distancia. Anota tus resultados.",
    })
    .returning();
  await db.insert(trainingAssignments).values([
    { trainingId: training.id, studentId: students[0].id },
    { trainingId: training.id, studentId: students[1].id },
    { trainingId: training.id, studentId: students[2].id },
  ]);

  console.log("📅  Evento…");
  const inTwoWeeks = new Date();
  inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
  inTwoWeeks.setHours(9, 0, 0, 0);
  await db.insert(events).values({
    title: "Torneo social de primavera",
    description: "Modalidad Stableford. Inscripción en recepción. Entrega de premios y comida.",
    location: "Club de Golf Torrijos",
    startsAt: inTwoWeeks,
    createdBy: admin.id,
  });

  console.log("🔔  Notificación de bienvenida…");
  await db.insert(notifications).values(
    [admin, profAna, profLuis, ...students].map((u) => ({
      userId: u.id,
      type: "general" as const,
      title: "¡Bienvenido a la app de Torrijos Golf!",
      body: "Aquí gestionarás tus clases, entrenamientos y eventos del club.",
    })),
  );

  console.log("\n✅  Seed completado. Contraseña = texto antes de la @ del email.");
  console.log("   Admin:    admin@torrijosgolf.es / admin");
  console.log("   Profesor: ana@torrijosgolf.es  / ana");
  console.log("   Alumno:   carlos@example.com   / carlos");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌  Error en el seed:", err);
  process.exit(1);
});
