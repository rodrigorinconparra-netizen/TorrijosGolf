# Publicar Torrijos Golf en App Store y Google Play

Las apps nativas (Capacitor) son un **contenedor** que carga la web desplegada por
HTTPS (`server.url` en `capacitor.config.ts`). No empaquetan el código Next.js: por
eso **lo primero es tener la web en producción** y apuntar la app a esa URL.

Los proyectos nativos ya están generados y listos en `android/` e `ios/`, con
iconos, splash (claro/oscuro), id de app `com.torrijosgolf.app`, nombre
«Torrijos Golf» y versión 1.0. Lo que queda son los pasos que requieren **tus
cuentas y credenciales** (firma y subida a las tiendas), que debes hacer tú.

---

## 0. Requisitos (una sola vez)

| Necesitas | Para qué | Coste |
|---|---|---|
| Web desplegada en HTTPS (Vercel u otro) | La app carga esa URL | — |
| Cuenta **Apple Developer** | Publicar en App Store | 99 $/año |
| Cuenta **Google Play Console** | Publicar en Play Store | 25 $ único |
| **Xcode** (macOS) | Compilar/subir iOS | gratis |
| **Android Studio** + JDK 17 | Compilar/firmar Android | gratis |

---

## 1. Fijar la URL de producción (imprescindible)

La app **no funcionará** si apunta a una URL que no está online. Despliega la web
y pon su dominio en `CAP_SERVER_URL`:

```bash
export CAP_SERVER_URL="https://tu-dominio-real.com"   # tu web en producción
npm run cap:sync
```

(o edita el valor por defecto en `capacitor.config.ts`). Ese dominio debe servir
por HTTPS válido: `cleartext` está desactivado a propósito.

---

## 2. Sincronizar y (re)generar recursos

```bash
npm run cap:sync      # copia config + plugins a android/ e ios/
npm run cap:assets    # regenera iconos y splash desde assets/  (opcional)
```

Las imágenes fuente están en `assets/` (`icon.png` 1024², `splash.png` y
`splash-dark.png` 2732²). Si cambias el logo, sustitúyelas y ejecuta `cap:assets`.

---

## 3. Android → Google Play

### 3.1 Abrir el proyecto
```bash
npm run cap:android   # abre Android Studio
```

### 3.2 Crear la clave de firma (una vez)
```bash
keytool -genkey -v -keystore torrijosgolf.keystore \
  -alias torrijosgolf -keyalg RSA -keysize 2048 -validity 10000
```
Guarda el `.keystore` y las contraseñas **a buen recaudo** (si los pierdes no
podrás volver a actualizar la app). En `android/app/build.gradle`, dentro de
`android { }`, añade tu `signingConfigs` y asócialo a `buildTypes.release`, o usa
el asistente **Build → Generate Signed Bundle / APK** (recomendado, guarda la
config en `.jks`).

### 3.3 Generar el App Bundle (.aab)
En Android Studio: **Build → Generate Signed Bundle → Android App Bundle**, elige
tu keystore y `release`. O por línea de comandos:
```bash
cd android && ./gradlew bundleRelease
# salida: android/app/build/outputs/bundle/release/app-release.aab
```

### 3.4 Subir en Play Console
1. Crea la app (idioma español, tipo App, gratuita).
2. Sube el `.aab` a un canal (empieza por **pruebas internas**).
3. Rellena la ficha: nombre, descripción, capturas (teléfono + tablet), icono
   512², gráfico destacado 1024×500.
4. **Política de privacidad**: usa la URL de tus páginas legales (`/legal/...`).
5. **Seguridad de los datos** (Data Safety): declara que recoges email, nombre,
   etc. (auth propia) y que se cifra en tránsito.
6. Clasificación de contenido y público objetivo.
7. Añade una **cuenta de prueba** (email/clave de un usuario demo) en las notas
   para revisores.
8. Promociona de pruebas internas → **Producción** y envía a revisión.

`versionCode` (entero, sube +1 en cada release) y `versionName` están en
`android/app/build.gradle`.

---

## 4. iOS → App Store

### 4.1 Abrir el proyecto
```bash
npm run cap:ios       # abre Xcode (workspace App.xcworkspace)
```

### 4.2 Firma
En Xcode, selecciona el target **App → Signing & Capabilities**:
- Marca **Automatically manage signing** y elige tu **Team** (Apple Developer).
- Bundle Identifier: `com.torrijosgolf.app` (ya configurado).

### 4.3 Archivar y subir
1. Selecciona destino **Any iOS Device (arm64)**.
2. **Product → Archive**.
3. En el Organizer: **Distribute App → App Store Connect → Upload**.

### 4.4 App Store Connect
1. Crea la app con el bundle `com.torrijosgolf.app`.
2. Ficha: nombre, subtítulo, descripción, palabras clave, capturas (6.7" y 6.5"
   obligatorias; iPad si lo soportas), icono 1024².
3. **Privacidad de la app**: declara los datos recogidos (email, nombre…).
4. **URL de política de privacidad**: tus páginas legales.
5. **App Review Information**: añade una **cuenta demo** (usuario/clave) para que
   el revisor pueda entrar.
6. Envía a revisión.

Versión (`MARKETING_VERSION`) y build (`CURRENT_PROJECT_VERSION`) se editan en
Xcode (target App → General) o en `ios/App/App.xcodeproj/project.pbxproj`.

---

## 5. Notificaciones push (FCM) — opcional pero recomendado

Los plugins (`@capacitor/push-notifications`, `@capacitor-community/fcm`) ya están
instalados. La app se puede publicar **sin** push; para activarlas necesitas
Firebase:

1. Crea un proyecto en [Firebase](https://console.firebase.google.com) y añade
   dos apps: Android (`com.torrijosgolf.app`) e iOS (mismo bundle).

2. **Android** — descarga `google-services.json` → colócalo en `android/app/`.
   Luego aplica el plugin de Google:
   - `android/build.gradle` (raíz), en `dependencies` del `buildscript`:
     ```gradle
     classpath 'com.google.gms:google-services:4.4.2'
     ```
   - Al final de `android/app/build.gradle`:
     ```gradle
     apply plugin: 'com.google.gms.google-services'
     ```

3. **iOS** — descarga `GoogleService-Info.plist` y arrástralo dentro de la carpeta
   `App` en Xcode (que quede en el target). En **Signing & Capabilities** añade
   **Push Notifications** y **Background Modes → Remote notifications**. Sube tu
   **clave APNs** (`.p8`) a Firebase → Cloud Messaging. Inicializa Firebase en
   `ios/App/App/AppDelegate.swift` (`FirebaseApp.configure()`).

4. **Servidor** — rellena `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`
   en tu entorno (ver `.env.example`). Sin esto, `src/lib/push.ts` es no-op y el
   resto de la app sigue funcionando.

Tras cambios en gradle/plist: `npm run cap:sync`.

---

## 6. Antes de enviar: checklist de revisión

- [ ] `CAP_SERVER_URL` apunta a la web **en producción** y esta carga bien.
- [ ] Cuenta **demo** para revisores (Apple y Google la piden si hay login).
- [ ] **Política de privacidad** accesible por URL (tus páginas `/legal`).
- [ ] Formularios de privacidad/Data Safety rellenados en ambas tiendas.
- [ ] Capturas de pantalla reales en cada tamaño requerido.
- [ ] **Apple, guía 4.2 (funcionalidad mínima):** una app que solo «envuelve» una
      web puede ser rechazada. Juega a favor tener push nativas, buena UX móvil y,
      si acaso, destacar en la descripción las funciones propias de la app.

---

## Comandos útiles

```bash
npm run cap:sync      # sincroniza web/config/plugins a las apps nativas
npm run cap:assets    # regenera iconos y splash desde assets/
npm run cap:android   # abre Android Studio
npm run cap:ios       # abre Xcode
```
