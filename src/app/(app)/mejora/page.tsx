import { BarChart3, Sparkles, TrendingUp, ExternalLink, Flag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Mejora tu juego" };

const BIRDIE_URL =
  process.env.NEXT_PUBLIC_BIRDIE_URL ?? "https://birdie-golf-eight.vercel.app";

const FEATURES = [
  {
    icon: Flag,
    title: "Registra tus vueltas",
    text: "Anota golpe a golpe y lleva el control de tus rondas.",
  },
  {
    icon: BarChart3,
    title: "Estadísticas reales",
    text: "Analiza tu juego: drives, approach, juego corto y putt.",
  },
  {
    icon: Sparkles,
    title: "Coach con IA",
    text: "Recibe consejos personalizados para bajar tu hándicap.",
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
            La app que analiza tu juego y te ayuda a mejorar con un coach de
            inteligencia artificial. Complementa tus clases en Torrijos Golf.
          </p>
          <a
            href={BIRDIE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-accent-deep transition hover:bg-white/90"
          >
            Abrir BirdieGolf <ExternalLink className="h-4 w-4" />
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
      </section>
    </>
  );
}
