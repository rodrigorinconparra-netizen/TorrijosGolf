export interface BarPoint {
  label: string;
  value: number;
  /** Texto ya formateado que se muestra encima de la barra (opcional). */
  display?: string;
}

/**
 * Gráfico de barras de serie única (magnitud en el tiempo). Sin leyenda: el
 * título lo nombra. Barras finas con extremo redondeado ancladas a la base,
 * hueco de 2px entre ellas, ejes recesivos y etiqueta directa selectiva.
 * Se renderiza en el servidor (SVG inline con los tokens del tema).
 */
export function BarChart({ points }: { points: BarPoint[] }) {
  const slot = 48;
  const barW = 26;
  const gap = (slot - barW) / 2;
  const H = 200;
  const top = 26; // espacio para la etiqueta de valor
  const baseline = H - 26; // espacio para la etiqueta de mes
  const W = Math.max(points.length * slot, slot);
  const max = Math.max(1, ...points.map((p) => p.value));
  const maxIdx = points.reduce((mi, p, i) => (p.value > points[mi].value ? i : mi), 0);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        className="max-w-full"
        style={{ minWidth: Math.min(W, 320) }}
      >
        {/* Línea base recesiva */}
        <line
          x1={0}
          y1={baseline}
          x2={W}
          y2={baseline}
          stroke="var(--color-black)"
          strokeOpacity={0.1}
          strokeWidth={1}
        />
        {points.map((p, i) => {
          const h = p.value <= 0 ? 0 : Math.max(3, ((p.value / max) * (baseline - top)));
          const x = i * slot + gap;
          const y = baseline - h;
          const showLabel = p.value > 0 && (i === maxIdx || i === points.length - 1);
          return (
            <g key={p.label}>
              {h > 0 ? (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={4}
                  fill="var(--color-accent)"
                />
              ) : null}
              {showLabel && p.display ? (
                <text
                  x={x + barW / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--color-ink)"
                >
                  {p.display}
                </text>
              ) : null}
              <text
                x={x + barW / 2}
                y={baseline + 16}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-muted)"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
