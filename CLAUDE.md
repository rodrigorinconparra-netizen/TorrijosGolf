# Torrijos Golf — guía para Claude

App móvil + web del Club de Golf Torrijos: escuela (clases, profesores, alumnos,
grupos, horarios, asistencias, entrenamientos), chat, eventos y notificaciones.
En español. Mismo stack y estética que BirdieGolf.

## Stack y decisiones

- **Next.js 16 (App Router) + React 19 + TS**, Tailwind v4, Neon (Postgres) + Drizzle.
- **Capacitor 6**: el shell nativo (iOS/Android) carga la web desplegada por HTTPS
  (`server.url` en `capacitor.config.ts`). No hay export estático.
- **Auth propia** (bcrypt + `jose` JWT en cookie httpOnly), sin NextAuth. Roles:
  `admin`, `profesor`, `alumno`. Ver `src/lib/auth/*`. El **primer** usuario que se
  registra se convierte en `admin`; el resto entran como `alumno`.
- **Diseño estilo Apple**: paleta blanco verdoso frío + verde teal del logo,
  glassmorphism, bordes redondeados. Utilidades en `globals.css`: `.glass`,
  `.glass-soft`, `.field`, `.btn-primary`, `.btn-ghost`, `.btn-danger`. Tokens de
  tema (`bg-accent`, `text-ink`, `text-muted`…) en `@theme`. Modo oscuro por
  `prefers-color-scheme`.

## Convenciones

- Rutas protegidas bajo `src/app/(app)/`; auth bajo `src/app/(auth)/`; legales en
  `src/app/(legal)/`.
- `src/middleware.ts` redirige sin sesión a `/login` y restringe `/admin` a admin.
- Lógica de servidor → Server Actions (`actions.ts` por sección); validación con Zod.
- Tailwind v4: los `.btn-*`/`.glass` son autocontenidos (no `@apply` de otras clases
  de componente propias, solo utilidades/tokens).
- DB: editar `src/lib/db/schema.ts` y luego `npm run db:push`.
- Notificaciones: `src/lib/notify.ts` unifica in-app (siempre) + push FCM
  (`src/lib/push.ts`, no-op sin env FCM_*) + email Resend (`src/lib/mail.ts`, no-op
  sin `RESEND_API_KEY`).

## Modelo de dominio (clases)

- `slots` = horas semanales recurrentes de un profesor (las crea el admin), marcadas
  como individual (un `studentId`) o grupal (un `groupId`), con precio.
- Una "clase" concreta = un slot en una fecha. La fila de `sessions` se crea de forma
  **perezosa** cuando alguien interactúa (confirmar asistencia, pasar lista…). Ver
  `src/lib/classes.ts` (`upcomingOccurrences`, `getOrCreateSession`).
- `attendance` guarda el plan del alumno (asistiré/no) y lo real (pasado por el
  profesor). Los informes (`teacherReports`, `sessionLog`) agregan horas trabajadas,
  ingresos y asistencias por mes.

## Puesta en marcha

1. `npm install`
2. Copia `.env.example` a `.env.local` y rellena `DATABASE_URL` (Neon) y `AUTH_SECRET`.
3. `npm run db:push` (crea tablas) y opcional `npm run db:seed` (datos demo).
4. `npm run dev` → http://localhost:3000

Credenciales demo tras el seed: `admin@torrijosgolf.es` / `torrijos123`.

## Apps nativas (Capacitor)

Los proyectos nativos ya están generados en `android/` e `ios/` (iconos, splash,
id `com.torrijosgolf.app`, v1.0). Flujo: despliega la web, pon la URL en
`CAP_SERVER_URL`, `npm run cap:sync`, y `npm run cap:android` / `npm run cap:ios`.
Assets fuente en `assets/`; regenéralos con `npm run cap:assets`.
Guía completa de firma y subida a las tiendas en **`PUBLICAR.md`**.
Para push: configura Firebase (FCM) y las variables `FCM_*` (ver `PUBLICAR.md`).

> CocoaPods puede fallar con `Encoding::CompatibilityError` si el locale no es
> UTF-8; ejecuta con `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.

## Notas

- Sin repo git aún. `next build` puede fallar al prerenderizar `/_not-found` en
  algunos entornos por un bug de Next 16 (no del código); `dev` funciona.
