import Link from "next/link";

export const metadata = { title: "Privacidad" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/login" className="text-sm text-accent hover:underline">
        ← Volver
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Política de privacidad</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-soft">
        <p>
          La app de Torrijos Golf trata los datos personales que facilitas (nombre,
          email, teléfono, número de licencia) con el fin de gestionar tu actividad
          en la escuela y el club: clases, asistencias, entrenamientos, eventos y
          comunicaciones.
        </p>
        <p>
          Los datos se almacenan de forma segura y no se ceden a terceros salvo
          obligación legal. Las notificaciones push se envían únicamente si activas
          los permisos en tu dispositivo, y puedes desactivarlas en Ajustes.
        </p>
        <p>
          Puedes ejercer tus derechos de acceso, rectificación y supresión escribiendo
          a <a className="text-accent" href="mailto:clubgolftorrijos@gmail.com">clubgolftorrijos@gmail.com</a>.
        </p>
      </div>
    </div>
  );
}
