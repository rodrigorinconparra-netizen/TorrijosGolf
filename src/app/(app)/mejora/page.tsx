import { Activity, BarChart3, Sparkles, TrendingUp, Apple } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Mejora tu juego" };

// Ficha de BirdieGolf en la App Store. Configurable por env por si cambia.
const BIRDIE_APPSTORE_URL =
  process.env.NEXT_PUBLIC_BIRDIE_APPSTORE_URL ??
  "https://apps.apple.com/es/app/birdiegolf/id6788479335";

const FEATURES = [
  {
    icon: BarChart3,
    title: "Analiza tus vueltas",
    text: "Registra cada ronda y revisa tus resultados y métricas hoyo a hoyo.",
  },
  {
    icon: Activity,
    title: "Estadísticas de rendimiento",
    text: "Detecta tus fortalezas y tus puntos de mejora con datos claros.",
  },
  {
    icon: Sparkles,
    title: "Swing con IA",
    text: "Estudia tu swing con inteligencia artificial y sigue tu evolución.",
  },
];

export default function ImprovePage() {
  return (
    <>
      <PageHeader
        title="Mejora tu juego"
        subtitle="Lleva tu golf al siguiente nivel con BirdieGolf"
      />

      <section className="glass overflow-hidden p-0">
        <div className="bg-gradient-to-br from-accent to-accent-deep p-8 text-on-accent">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15">
            <TrendingUp className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-2xl font-semibold">BirdieGolf</h2>
          <p className="mt-1 max-w-md text-on-accent/85">
            Entiende y mejora cada aspecto de tu juego: analiza tus vueltas, revisa
            tus estadísticas y estudia tu swing con inteligencia artificial. El
            complemento perfecto a tus clases en Torrijos Golf.
          </p>
          <a
            href={BIRDIE_APPSTORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-accent-deep transition hover:bg-white/90"
          >
            <Apple className="h-4 w-4" /> Descargar en la App Store
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-soft p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold text-ink">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-black/5 px-6 py-4">
          <p className="text-sm text-muted">
            Tanto si empiezas como si buscas bajar tu hándicap, BirdieGolf convierte
            cada vuelta en una oportunidad para aprender. Disponible para iPhone.
          </p>
        </div>
      </section>
    </>
  );
}
