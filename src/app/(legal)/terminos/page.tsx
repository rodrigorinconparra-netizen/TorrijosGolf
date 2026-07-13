import Link from "next/link";

export const metadata = { title: "Términos" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/login" className="text-sm text-accent hover:underline">
        ← Volver
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Términos de uso</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-soft">
        <p>
          Esta aplicación es de uso exclusivo para socios, alumnos y personal del
          Club de Golf Torrijos. Al registrarte, te comprometes a usarla de forma
          responsable y a mantener la confidencialidad de tu cuenta.
        </p>
        <p>
          El contenido de las clases, entrenamientos y comunicaciones es para uso
          personal. El club se reserva el derecho de suspender cuentas que hagan un
          uso indebido del servicio.
        </p>
        <p>
          Para cualquier duda, contacta con el club en{" "}
          <a className="text-accent" href="mailto:clubgolftorrijos@gmail.com">
            clubgolftorrijos@gmail.com
          </a>.
        </p>
      </div>
    </div>
  );
}
