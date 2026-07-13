# Torrijos Golf 🏌️

App móvil y web del **Club de Golf Torrijos**: gestión de la escuela, clases,
profesores, alumnos, eventos y comunicación. Web (Next.js) empaquetada como app
nativa iOS/Android con Capacitor.

## Qué hace

**Roles:** admin · profesor · alumno · (registro con nº de licencia federativa).

**Panel de admin (control total del club):**
- Registrar profesores y gestionar todos los usuarios y sus roles.
- Crear grupos de clases y añadir alumnos.
- Asignar alumnos a profesores.
- Marcar las horas disponibles de cada profesor y asociarlas a un grupo o a una
  persona, indicando si son individuales o grupales, con precio.
- Informes: asistencias, horas trabajadas por profesor e ingresos por clases.
- Enviar avisos (push + email) a todo el club, solo alumnos o solo profesores.
- Crear eventos con notificación push y email.

**Profesor:**
- Ve su horario, pasa lista y marca las clases como impartidas.
- Envía entrenamientos a un alumno, un grupo o todos sus alumnos.
- Chatea o llama a sus alumnos.

**Alumno:**
- Ve sus clases y marca si va a asistir o no.
- Recibe entrenamientos y los marca como completados.
- Chatea o llama a su profesor / al club.
- Se apunta a eventos.
- Sección **Mejora tu juego** → enlaza con la app BirdieGolf.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local     # rellena DATABASE_URL (Neon) y AUTH_SECRET
npm run db:push                # crea las tablas
npm run db:seed                # (opcional) datos de demostración
npm run dev                    # http://localhost:3000
```

Tras el seed: **admin@torrijosgolf.es** / `torrijos123`.

## Apps nativas

```bash
npx cap add ios
npx cap add android
# despliega la web y pon la URL en CAP_SERVER_URL (o en capacitor.config.ts)
npm run cap:ios      # abre Xcode
npm run cap:android  # abre Android Studio
```

Ver [CLAUDE.md](CLAUDE.md) para detalles de arquitectura.
# TorrijosGolf
