import {
  pgTable,
  pgEnum,
  serial,
  integer,
  real,
  text,
  boolean,
  date,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* ----------------------------------------------------------------------------
 * Enums
 * ------------------------------------------------------------------------- */

/** Roles de la app: control total (admin), profesor de la escuela y alumno. */
export const roleEnum = pgEnum("role", ["admin", "profesor", "alumno"]);

/** Tipo de clase asociada a una hora del profesor. */
export const slotKindEnum = pgEnum("slot_kind", ["individual", "grupal"]);

/** Estado de una sesión (una clase concreta en una fecha concreta). */
export const sessionStatusEnum = pgEnum("session_status", [
  "programada",
  "impartida",
  "cancelada",
]);

/** Respuesta del alumno a "¿vas a asistir?". */
export const attendancePlanEnum = pgEnum("attendance_plan", [
  "pendiente",
  "asistire",
  "no_asistire",
]);

/** Sexo del jugador (para CR/SR del campo en ligas y torneos). */
export const sexEnum = pgEnum("sex", ["hombre", "mujer"]);

/** Recorrido de una liga: 9 hoyos de ida, 9 de vuelta, o 18 completos. */
export const leagueHolesEnum = pgEnum("league_holes", ["1-9", "10-18", "18"]);

export const leagueStatusEnum = pgEnum("league_status", ["activa", "finalizada"]);

/** Estado de una vuelta/tarjeta de liga. */
export const roundStatusEnum = pgEnum("round_status", ["en_juego", "finalizada"]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "general",
  "clase",
  "entrenamiento",
  "evento",
  "chat",
]);

/* ----------------------------------------------------------------------------
 * Usuarios
 * ------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("alumno"),
  /** Número de licencia federativa (RFEG), pedido en el registro. */
  license: text("license"),
  phone: text("phone"),
  /** Tarifa por hora del profesor (para calcular horas trabajadas/ingresos). */
  hourlyRate: real("hourly_rate"),
  /** Opt-out global de push nativas (Ajustes). */
  pushEnabled: boolean("push_enabled").notNull().default(true),
  /** Si el usuario aparece en el buscador de personas del chat (Ajustes). */
  discoverable: boolean("discoverable").notNull().default(true),
  /** Si otras personas pueden añadirlo a grupos de chat (Ajustes). Los grupos de
   *  clases lo ignoran: la pertenencia la gestiona el club. */
  groupAddable: boolean("group_addable").notNull().default(true),
  /**
   * Si está definido, es una cuenta de alumno MENOR gestionada por un padre/tutor
   * (este `guardianId`). El menor no inicia sesión: el padre actúa en su nombre y
   * recibe sus avisos. Un usuario normal (con login) tiene `guardianId` nulo.
   */
  guardianId: integer("guardian_id").references((): AnyPgColumn => users.id, {
    onDelete: "cascade",
  }),
  /** Fecha de nacimiento (opcional; útil para menores). */
  birthdate: date("birthdate"),
  /** Hándicap (índice WHS) del jugador, para las ligas. Lo fija el admin. */
  handicapIndex: real("handicap_index"),
  /** Sexo del jugador (afecta al CR/SR del campo). Lo fija el admin. */
  sex: sexEnum("sex"),
  /* --- Perfil público de profesor (visible para todos) --- */
  /** Titulación o cargo, p. ej. "Profesional PGA". */
  title: text("title"),
  /** Descripción / presentación del profesor. */
  bio: text("bio"),
  /** Especialidades / habilidades, separadas por comas. */
  specialties: text("specialties"),
  /** Años de experiencia. */
  experienceYears: integer("experience_years"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Asignación directa alumno → profesor (además de la pertenencia a grupos). */
export const teacherStudents = pgTable(
  "teacher_students",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("teacher_student_unique").on(t.teacherId, t.studentId)],
);

/* ----------------------------------------------------------------------------
 * Grupos de clases
 * ------------------------------------------------------------------------- */

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  /** Profesor responsable del grupo. */
  teacherId: integer("teacher_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("group_member_unique").on(t.groupId, t.studentId)],
);

/* ----------------------------------------------------------------------------
 * Horario: horas disponibles del profesor (las marca el admin)
 * ------------------------------------------------------------------------- */

/**
 * Hora semanal recurrente de un profesor. El admin la crea, marca si es
 * individual o grupal y asocia un grupo (grupal) o un alumno (individual).
 * Una hora sin grupo/alumno asociado es "disponible" (libre para asignar).
 */
export const slots = pgTable("slots", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 1 = lunes … 7 = domingo (ISO). */
  weekday: integer("weekday").notNull(),
  /** "HH:MM" en hora local del club. */
  startTime: text("start_time").notNull(),
  /** Duración en minutos. */
  durationMin: integer("duration_min").notNull().default(60),
  kind: slotKindEnum("kind").notNull().default("individual"),
  groupId: integer("group_id").references(() => groups.id, {
    onDelete: "set null",
  }),
  studentId: integer("student_id").references(() => users.id, {
    onDelete: "set null",
  }),
  /** Precio de la clase (€) para los informes de ingresos. */
  price: real("price").notNull().default(0),
  /**
   * Si está definido, es una clase de UN SOLO DÍA (reserva puntual) en esa fecha,
   * no una hora semanal recurrente. En ese caso solo genera una ocurrencia.
   */
  oneOffDate: date("one_off_date"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Una clase concreta: instancia de un slot en una fecha. Se crea perezosamente
 * la primera vez que alguien interactúa con ella (confirmar asistencia,
 * marcarla impartida…), así el horario semanal no genera filas por adelantado.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    slotId: integer("slot_id")
      .notNull()
      .references(() => slots.id, { onDelete: "cascade" }),
    /** Fecha del día de la clase (YYYY-MM-DD). */
    date: date("date").notNull(),
    status: sessionStatusEnum("status").notNull().default("programada"),
    /** Copia del precio/duración del slot al completarla (histórico estable). */
    price: real("price"),
    durationMin: integer("duration_min"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("session_slot_date_unique").on(t.slotId, t.date)],
);

/** Asistencia de un alumno a una sesión: intención (asistiré) y realidad. */
export const attendance = pgTable(
  "attendance",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: attendancePlanEnum("plan").notNull().default("pendiente"),
    /** La marca el profesor al pasar lista (null = sin pasar lista). */
    attended: boolean("attended"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("attendance_unique").on(t.sessionId, t.studentId)],
);

/**
 * Recordatorios de clase ya enviados (para no duplicar el aviso de 24 h antes).
 * Se identifica por la ocurrencia concreta: slot + fecha + alumno.
 */
export const classReminders = pgTable(
  "class_reminders",
  {
    id: serial("id").primaryKey(),
    slotId: integer("slot_id")
      .notNull()
      .references(() => slots.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("class_reminder_unique").on(t.slotId, t.date, t.studentId)],
);

/* ----------------------------------------------------------------------------
 * Entrenamientos (el profesor los envía a alumnos o grupos)
 * ------------------------------------------------------------------------- */

export const trainings = pgTable("trainings", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trainingAssignments = pgTable(
  "training_assignments",
  {
    id: serial("id").primaryKey(),
    trainingId: integer("training_id")
      .notNull()
      .references(() => trainings.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("training_assignment_unique").on(t.trainingId, t.studentId)],
);

/* ----------------------------------------------------------------------------
 * Chat: conversaciones (DM 1-a-1 y grupos) + miembros + mensajes
 * ------------------------------------------------------------------------- */

/** Tipo de conversación: mensaje directo entre 2 personas, o grupo. */
export const conversationKindEnum = pgEnum("conversation_kind", ["dm", "group"]);

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  kind: conversationKindEnum("kind").notNull(),
  /** Nombre del chat de grupo (null en los DM: el título es el otro usuario). */
  title: text("title"),
  /**
   * Si el chat pertenece a un grupo de clases, lo enlazamos: su pertenencia se
   * sincroniza automáticamente con la del grupo (al borrar el grupo, cae en cascada).
   */
  groupId: integer("group_id").references(() => groups.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversationMembers = pgTable(
  "conversation_members",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Si este miembro participa EN NOMBRE de un menor (es su padre/tutor), aquí
     * va el id del menor: el chat muestra el nombre del niño e indica "(padre)".
     */
    onBehalfOf: integer("on_behalf_of").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    /** Hasta cuándo ha leído este usuario (para el contador de no leídos). */
    lastReadAt: timestamp("last_read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("conv_member_unique").on(t.conversationId, t.userId)],
);

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  senderId: integer("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  /** Si el mensaje representa un entrenamiento enviado al grupo, lo enlazamos
   *  para poder mostrar en el chat quién lo ha completado. */
  trainingId: integer("training_id").references(() => trainings.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ----------------------------------------------------------------------------
 * Eventos del club
 * ------------------------------------------------------------------------- */

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startsAt: timestamp("starts_at").notNull(),
  /** Enlace externo de inscripción (p. ej. la app del torneo). El botón
   *  "Apuntarme" lleva aquí. */
  url: text("url"),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const eventRsvps = pgTable(
  "event_rsvps",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    going: boolean("going").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("event_rsvp_unique").on(t.eventId, t.userId)],
);

/* ----------------------------------------------------------------------------
 * Clasificaciones (el club sube un PDF; los usuarios lo ven)
 * ------------------------------------------------------------------------- */

export const rankings = pgTable("rankings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull().default("application/pdf"),
  /** Contenido del fichero en base64 (PDF). */
  data: text("data").notNull(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ----------------------------------------------------------------------------
 * Ligas (clasificación en vivo): jornadas semanales, tarjetas y neto
 * ------------------------------------------------------------------------- */

/**
 * Liga automática: se juega una vuelta por jornada (semana). La jornada 1
 * empieza en `startDate` y cada jornada dura 7 días. El neto de cada vuelta es
 * bruto − hándicap de juego (calculado con el índice del jugador, su sexo y la
 * barra elegida, sobre los datos oficiales del campo).
 */
export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  /** Recorrido que se juega: hoyos 1-9, 10-18 o los 18. */
  holes: leagueHolesEnum("holes").notNull().default("1-9"),
  /** Fecha de inicio de la jornada 1 (las jornadas duran 7 días). */
  startDate: date("start_date").notNull(),
  /** Mínimo de jornadas jugadas para aparecer clasificado. */
  minRounds: integer("min_rounds").notNull().default(1),
  /** Cuántas jornadas (las mejores) suman al total. */
  countRounds: integer("count_rounds").notNull().default(10),
  status: leagueStatusEnum("status").notNull().default("activa"),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Partida de una jornada: el grupo que sale a jugar junto. Los marcadores de
 * cada vuelta se eligen entre los miembros de la partida.
 */
export const leagueMatches = pgTable("league_matches", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  jornada: integer("jornada").notNull(),
  date: date("date").notNull(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leagueMatchPlayers = pgTable(
  "league_match_players",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => leagueMatches.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("match_player_unique").on(t.matchId, t.playerId)],
);

/**
 * Una vuelta/tarjeta de un jugador en una jornada. Doble anotación: el jugador
 * lleva su cuenta (`scores`) y su marcador la oficial (`scoresMarker`). Solo se
 * puede firmar cuando ambas están completas y coinciden; con las dos firmas la
 * vuelta se finaliza y suma a la clasificación.
 */
export const leagueRounds = pgTable(
  "league_rounds",
  {
    id: serial("id").primaryKey(),
    leagueId: integer("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    /** Partida a la que pertenece (null si la registró el admin a mano). */
    matchId: integer("match_id").references(() => leagueMatches.id, {
      onDelete: "set null",
    }),
    playerId: integer("player_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Quién marca la vuelta (miembro de la misma partida). */
    markerId: integer("marker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Nº de jornada (1, 2, 3…), derivado de la fecha al crearla. */
    jornada: integer("jornada").notNull(),
    date: date("date").notNull(),
    /** Barra de salida elegida por el jugador en esta vuelta. */
    barra: text("barra").notNull().default("amarillas"),
    /** Golpes anotados por el propio jugador (JSON; 0 = hoyo sin anotar). */
    scores: text("scores").notNull().default("[]"),
    /** Golpes anotados por el marcador (la tarjeta oficial). */
    scoresMarker: text("scores_marker").notNull().default("[]"),
    /** Firmas: al guardar cambios se anulan; con ambas, la vuelta se finaliza. */
    playerSigned: boolean("player_signed").notNull().default(false),
    markerSigned: boolean("marker_signed").notNull().default(false),
    /** Calculados al finalizar (histórico estable aunque cambie el índice). */
    gross: integer("gross"),
    courseHcp: integer("course_hcp"),
    net: integer("net"),
    status: roundStatusEnum("status").notNull().default("en_juego"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("league_round_unique").on(t.leagueId, t.playerId, t.jornada)],
);

/* ----------------------------------------------------------------------------
 * Notificaciones in-app + tokens de push nativas
 * ------------------------------------------------------------------------- */

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull().default("general"),
  title: text("title").notNull(),
  body: text("body"),
  /** Ruta interna a la que lleva la notificación (p. ej. "/eventos"). */
  link: text("link"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deviceTokens = pgTable("device_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  platform: text("platform"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ----------------------------------------------------------------------------
 * Solicitudes de clase: el profesor propone una clase (grupo o individual) y el
 * admin la acepta (crea el grupo/hora reales) o la rechaza.
 * ------------------------------------------------------------------------- */

export const classRequestKindEnum = pgEnum("class_request_kind", [
  "individual",
  "grupal",
]);
export const classRequestStatusEnum = pgEnum("class_request_status", [
  "pendiente",
  "aceptada",
  "rechazada",
]);

export const classRequests = pgTable("class_requests", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: classRequestKindEnum("kind").notNull(),
  /** Nombre del grupo propuesto (solo grupal). */
  groupName: text("group_name"),
  /** Alumno propuesto (solo individual). */
  studentId: integer("student_id").references(() => users.id, {
    onDelete: "set null",
  }),
  weekday: integer("weekday").notNull(),
  startTime: text("start_time").notNull(),
  durationMin: integer("duration_min").notNull().default(60),
  price: real("price").notNull().default(0),
  note: text("note"),
  status: classRequestStatusEnum("status").notNull().default("pendiente"),
  decidedBy: integer("decided_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  decidedAt: timestamp("decided_at"),
});

/** Alumnos propuestos para una solicitud de clase grupal. */
export const classRequestStudents = pgTable("class_request_students", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => classRequests.id, { onDelete: "cascade" }),
  studentId: integer("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

/* ----------------------------------------------------------------------------
 * Disponibilidad de profesores y reservas de alumnos
 * ------------------------------------------------------------------------- */

/** Hora semanal LIBRE de un profesor, que marca el admin. Los alumnos pueden
 *  reservarla (puntual o mensual). */
export const teacherAvailability = pgTable("teacher_availability", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  weekday: integer("weekday").notNull(),
  startTime: text("start_time").notNull(),
  durationMin: integer("duration_min").notNull().default(60),
  /** Precio sugerido de la clase en esa hora. */
  price: real("price").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bookingKindEnum = pgEnum("booking_kind", ["puntual", "mensual"]);

/** Reserva de clase de un alumno sobre una hora disponible del profesor. La
 *  confirma el admin: puntual (un día) o mensual (clase semanal recurrente). */
export const bookingRequests = pgTable("booking_requests", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  availabilityId: integer("availability_id").references(
    () => teacherAvailability.id,
    { onDelete: "set null" },
  ),
  weekday: integer("weekday").notNull(),
  startTime: text("start_time").notNull(),
  durationMin: integer("duration_min").notNull().default(60),
  price: real("price").notNull().default(0),
  kind: bookingKindEnum("kind").notNull(),
  /** Fecha concreta (solo reservas puntuales). */
  date: date("date"),
  note: text("note"),
  status: classRequestStatusEnum("status").notNull().default("pendiente"),
  decidedBy: integer("decided_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  decidedAt: timestamp("decided_at"),
});

/**
 * Propuesta de un profesor para cambiar el horario de una de sus horas. El admin
 * la acepta (actualiza el slot) o la rechaza.
 */
export const scheduleChangeRequests = pgTable("schedule_change_requests", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id")
    .notNull()
    .references(() => slots.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  weekday: integer("weekday").notNull(),
  startTime: text("start_time").notNull(),
  durationMin: integer("duration_min").notNull().default(60),
  note: text("note"),
  status: classRequestStatusEnum("status").notNull().default("pendiente"),
  decidedBy: integer("decided_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  decidedAt: timestamp("decided_at"),
});
