import Link from "next/link";

export const metadata = { title: "Soporte" };

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/login" className="text-sm text-accent hover:underline">
        ← Volver
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Soporte</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-soft">
        <p>
          ¿Necesitas ayuda con la app de Torrijos Golf? Estamos para ayudarte con
          el acceso a tu cuenta, la reserva de clases, los horarios, el chat, los
          eventos o cualquier otra duda sobre la escuela y el club.
        </p>

        <h2 className="pt-2 text-base font-semibold text-ink">Contacto</h2>
        <p>
          Escríbenos a{" "}
          <a className="text-accent" href="mailto:clubgolftorrijos@gmail.com">
            clubgolftorrijos@gmail.com
          </a>{" "}
          y te responderemos lo antes posible, normalmente en un plazo de 24 a 48
          horas laborables. Indícanos tu nombre y, si puedes, una descripción de lo
          que ocurre para ayudarte más rápido.
        </p>

        <h2 className="pt-2 text-base font-semibold text-ink">Preguntas frecuentes</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="font-medium text-ink">No puedo entrar:</span> para
            usar la app necesitas una cuenta del Club de Golf Torrijos. Si has
            olvidado tu contraseña o no tienes cuenta, contáctanos por email.
          </li>
          <li>
            <span className="font-medium text-ink">Reservas y clases:</span> desde
            la sección Clases puedes ver la disponibilidad de cada profesor y
            apuntarte a clases individuales o de grupo.
          </li>
          <li>
            <span className="font-medium text-ink">Notificaciones:</span> puedes
            activarlas o desactivarlas desde los ajustes de tu dispositivo.
          </li>
          <li>
            <span className="font-medium text-ink">Cuenta de un menor:</span> los
            padres o tutores pueden gestionar la actividad de sus hijos desde su
            propia cuenta.
          </li>
        </ul>

        <h2 className="pt-2 text-base font-semibold text-ink">Información legal</h2>
        <p>
          Consulta los{" "}
          <Link className="text-accent" href="/terminos">
            términos de uso
          </Link>{" "}
          y la{" "}
          <Link className="text-accent" href="/privacidad">
            política de privacidad
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
